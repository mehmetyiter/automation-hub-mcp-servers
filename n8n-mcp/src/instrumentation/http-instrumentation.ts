import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../observability/metrics';
import { LoggingService } from '../observability/logging';
import { TracingService } from '../observability/tracing';
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';

export class HTTPInstrumentation {
  private metrics: MetricsService;
  private logger: LoggingService;
  private tracing: TracingService;

  constructor() {
    this.metrics = MetricsService.getInstance();
    this.logger = LoggingService.getInstance();
    this.tracing = TracingService.getInstance();
  }

  // Request tracking middleware
  requestTracking() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add request ID to request object
      (req as any).requestId = requestId;
      
      // Set request ID header for response
      res.setHeader('X-Request-ID', requestId);

      // Increment active requests counter
      this.metrics.recordMetric('api', 'activeRequests', 1, {
        endpoint: req.path,
        method: req.method
      });

      // Log request
      this.logger.debug('Incoming request', {
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Response time tracking
      const originalSend = res.send;
      res.send = function(data) {
        res.send = originalSend;
        
        // Decrement active requests counter
        const duration = Date.now() - startTime;
        this.metrics.recordMetric('api', 'activeRequests', -1, {
          endpoint: req.path,
          method: req.method
        });

        // Record metrics
        this.metrics.recordAPIRequest(req.method, req.path, res.statusCode, duration);

        // Log response
        this.logger.logAPIRequest(req, res, duration);

        return res.send(data);
      }.bind(this);

      next();
    };
  }

  // OpenTelemetry tracing middleware
  tracingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const tracer = trace.getTracer('http-instrumentation', '1.0.0');
      const span = tracer.startSpan(`${req.method} ${req.path}`, {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': req.path,
          'http.host': req.hostname,
          'http.scheme': req.protocol,
          'http.user_agent': req.headers['user-agent'] || 'unknown',
          'net.peer.ip': req.ip,
          'custom.request_id': (req as any).requestId,
        }
      });

      // Extract trace context from headers if present
      const traceContext = this.tracing.extractTraceContext(req.headers as Record<string, string>);
      if (traceContext.traceId) {
        span.setAttributes({
          'parent.trace_id': traceContext.traceId,
          'parent.span_id': traceContext.spanId
        });
      }

      // Store span in request for use in other middleware
      (req as any).span = span;

      // Add user context if authenticated
      if ((req as any).user) {
        span.setAttributes({
          'user.id': (req as any).user.id,
          'user.email': (req as any).user.email,
          'user.workspace_id': (req as any).user.workspaceId
        });
      }

      // Wrap response methods to capture response data
      const originalJson = res.json;
      const originalSend = res.send;
      const originalEnd = res.end;

      res.json = function(data) {
        span.setAttributes({
          'http.response.body.size': JSON.stringify(data).length,
          'http.status_code': res.statusCode,
          'http.status_text': res.statusMessage || ''
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });

          if (data && data.error) {
            span.recordException({
              name: data.error.name || 'APIError',
              message: data.error.message || 'Unknown error',
              stack: data.error.stack
            });
          }
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
        return originalJson.call(this, data);
      };

      res.send = function(data) {
        span.setAttributes({
          'http.response.body.size': Buffer.byteLength(data || ''),
          'http.status_code': res.statusCode
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
        return originalSend.call(this, data);
      };

      res.end = function(...args: any[]) {
        span.setAttributes({
          'http.status_code': res.statusCode
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
        return originalEnd.apply(this, args);
      };

      // Continue with span context
      context.with(trace.setSpan(context.active(), span), () => {
        next();
      });
    };
  }

  // Error handling middleware
  errorHandler() {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
      const statusCode = err.statusCode || err.status || 500;
      const message = err.message || 'Internal Server Error';
      const requestId = (req as any).requestId;

      // Log error
      this.logger.error('Request error', err, {
        requestId,
        method: req.method,
        path: req.path,
        statusCode,
        userId: (req as any).user?.id
      });

      // Record error metric
      this.metrics.recordMetric('api', 'errorTotal', 1, {
        endpoint: req.path,
        method: req.method,
        status_code: statusCode.toString(),
        error_type: err.name || 'UnknownError'
      });

      // Get current span if exists
      const span = (req as any).span;
      if (span) {
        span.recordException(err);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message
        });
        span.setAttributes({
          'error.type': err.name || 'UnknownError',
          'error.message': err.message,
          'error.stack': err.stack
        });
      }

      // Send error response
      res.status(statusCode).json({
        error: {
          message,
          code: err.code || 'INTERNAL_ERROR',
          requestId,
          timestamp: new Date().toISOString()
        }
      });
    };
  }

  // Performance monitoring middleware
  performanceMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      const startCpuUsage = process.cpuUsage();
      const startMemory = process.memoryUsage();

      // Monitor response
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        const endMemory = process.memoryUsage();

        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Log performance metrics for slow requests
        if (duration > 1000) {
          this.logger.warn('Slow request detected', {
            requestId: (req as any).requestId,
            method: req.method,
            path: req.path,
            duration_ms: duration,
            cpu_usage: {
              user: endCpuUsage.user / 1000, // Convert to milliseconds
              system: endCpuUsage.system / 1000
            },
            memory_delta: {
              rss: endMemory.rss - startMemory.rss,
              heapTotal: endMemory.heapTotal - startMemory.heapTotal,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed
            }
          });
        }

        // Add performance data to span if exists
        const span = (req as any).span;
        if (span) {
          span.setAttributes({
            'performance.duration_ms': duration,
            'performance.cpu.user_ms': endCpuUsage.user / 1000,
            'performance.cpu.system_ms': endCpuUsage.system / 1000,
            'performance.memory.rss_delta': endMemory.rss - startMemory.rss,
            'performance.memory.heap_used_delta': endMemory.heapUsed - startMemory.heapUsed
          });
        }
      });

      next();
    };
  }

  // Security monitoring middleware
  securityMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /(\.\.|\/\/)/,  // Path traversal
        /(<script|javascript:|onerror=)/i,  // XSS attempts
        /(\bunion\b|\bselect\b|\bdrop\b)/i,  // SQL injection
        /(\${|\#{)/  // Template injection
      ];

      const requestData = JSON.stringify({
        path: req.path,
        query: req.query,
        body: req.body,
        headers: req.headers
      });

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestData)) {
          this.logger.logSecurityEvent({
            type: 'suspicious_request',
            severity: 'high',
            userId: (req as any).user?.id,
            ipAddress: req.ip,
            details: {
              pattern: pattern.toString(),
              method: req.method,
              path: req.path,
              userAgent: req.headers['user-agent']
            }
          });

          this.metrics.recordSecurityEvent('suspicious_activity', {
            pattern: pattern.toString(),
            endpoint: req.path
          });

          return res.status(400).json({
            error: {
              message: 'Invalid request',
              code: 'INVALID_REQUEST'
            }
          });
        }
      }

      // Check rate limiting
      const rateLimitKey = `rate_limit:${req.ip}:${req.path}`;
      // Implementation would check against Redis or in-memory store

      next();
    };
  }

  // Health check endpoint that doesn't log
  healthCheck() {
    return (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      });
    };
  }

  // Metrics endpoint
  metricsEndpoint() {
    return (req: Request, res: Response) => {
      res.redirect(this.metrics.getMetricsEndpoint());
    };
  }
}