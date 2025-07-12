import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { trace } from '@opentelemetry/api';
import { Request, Response } from 'express';

interface SecurityEvent {
  type: string;
  severity: string;
  userId?: string;
  ipAddress?: string;
  details: Record<string, any>;
}

interface LogContext {
  userId?: string;
  workspaceId?: string;
  requestId?: string;
  [key: string]: any;
}

export class LoggingService {
  private static instance: LoggingService;
  private logger: winston.Logger;
  
  constructor() {
    const esTransportOpts = {
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        auth: process.env.ELASTICSEARCH_USER && process.env.ELASTICSEARCH_PASSWORD ? {
          username: process.env.ELASTICSEARCH_USER,
          password: process.env.ELASTICSEARCH_PASSWORD,
        } : undefined,
      },
      index: 'n8n-mcp-logs',
      dataStream: true,
      transformer: this.logTransformer,
      ensureIndexTemplate: true,
      indexTemplate: {
        index_patterns: ['n8n-mcp-logs-*'],
        template: {
          settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
            'index.lifecycle.name': 'n8n-mcp-logs-policy',
            'index.lifecycle.rollover_alias': 'n8n-mcp-logs',
          },
          mappings: {
            properties: {
              '@timestamp': { type: 'date' },
              severity: { type: 'keyword' },
              message: { type: 'text' },
              'service.name': { type: 'keyword' },
              'service.version': { type: 'keyword' },
              'service.environment': { type: 'keyword' },
              'service.instance.id': { type: 'keyword' },
              'trace.id': { type: 'keyword' },
              'trace.span_id': { type: 'keyword' },
              'user.id': { type: 'keyword' },
              'user.email': { type: 'keyword' },
              'http.method': { type: 'keyword' },
              'http.url': { type: 'keyword' },
              'http.status_code': { type: 'integer' },
              'http.duration_ms': { type: 'integer' },
              'error.type': { type: 'keyword' },
              'error.stack': { type: 'text' },
            },
          },
        },
      },
    };

    // Create custom format for console output
    const consoleFormat = winston.format.printf((info) => {
      const span = trace.getActiveSpan();
      const traceId = span?.spanContext().traceId || 'no-trace';
      const timestamp = info.timestamp || new Date().toISOString();
      
      let message = `[${timestamp}] [${traceId}] ${info.level}: ${info.message}`;
      
      // Add structured data if present
      if (info.metadata) {
        message += ` | ${JSON.stringify(info.metadata)}`;
      }
      
      return message;
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
      ),
      defaultMeta: {
        service: 'n8n-mcp',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.VERSION || '1.0.0',
        instance: process.env.INSTANCE_ID || `instance-${Date.now()}`,
      },
      transports: [
        // Console transport with custom format
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            consoleFormat
          ),
        }),
        // File transport for error logs
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true,
        }),
        // File transport for combined logs
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true,
        }),
      ],
    });

    // Add Elasticsearch transport only if URL is configured
    if (process.env.ELASTICSEARCH_URL) {
      this.logger.add(new ElasticsearchTransport(esTransportOpts));
    }

    // Handle uncaught exceptions and rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    );
    
    this.logger.rejections.handle(
      new winston.transports.File({ filename: 'logs/rejections.log' })
    );
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private logTransformer = (logData: any) => {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    
    const transformed = {
      '@timestamp': logData.timestamp || new Date().toISOString(),
      severity: logData.level,
      message: logData.message,
      service: {
        name: logData.service,
        version: logData.version,
        environment: logData.environment,
        instance: {
          id: logData.instance,
        },
      },
      trace: spanContext ? {
        id: spanContext.traceId,
        span_id: spanContext.spanId,
      } : undefined,
      ...logData.metadata,
    };

    // Remove duplicate fields
    delete transformed.level;
    delete transformed.timestamp;
    delete transformed.service;
    delete transformed.version;
    delete transformed.environment;
    delete transformed.instance;
    delete transformed.metadata;

    return transformed;
  };

  // Add context to logger
  private addContext(context?: LogContext): Record<string, any> {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    
    return {
      ...context,
      trace: spanContext ? {
        id: spanContext.traceId,
        span_id: spanContext.spanId,
      } : undefined,
    };
  }

  // Structured logging methods
  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.addContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.addContext(context));
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...this.addContext(context),
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      } : undefined,
    };
    
    this.logger.error(message, errorContext);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.addContext(context));
  }

  // Specialized logging methods
  logAPIRequest(req: Request, res: Response, duration: number): void {
    const context: LogContext = {
      http: {
        method: req.method,
        url: req.originalUrl,
        status_code: res.statusCode,
        user_agent: req.headers['user-agent'],
        remote_ip: req.ip,
        duration_ms: duration,
        request_id: req.headers['x-request-id'] as string,
        referer: req.headers.referer,
      },
      user: req.user ? {
        id: (req.user as any).id,
        email: (req.user as any).email,
      } : undefined,
      query: req.query,
    };

    const level = res.statusCode >= 500 ? 'error' : 
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    this.logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, context);
  }

  logSecurityEvent(event: SecurityEvent): void {
    const context: LogContext = {
      security: {
        event_type: event.type,
        severity: event.severity,
        user_id: event.userId,
        ip_address: event.ipAddress,
        details: event.details,
        timestamp: new Date().toISOString(),
      },
    };

    const level = event.severity === 'critical' ? 'error' :
                  event.severity === 'high' ? 'warn' : 'info';
    
    this.logger.log(level, `Security Event: ${event.type}`, context);
  }

  logAIProviderCall(provider: string, model: string, operation: string, result: any, error?: Error): void {
    const context: LogContext = {
      ai_provider: {
        provider,
        model,
        operation,
        success: !error,
        tokens_used: result?.usage?.total_tokens,
        cost: result?.cost,
        cached: result?.cached,
        duration_ms: result?.duration,
        error: error ? {
          message: error.message,
          code: (error as any).code,
        } : undefined,
      },
    };

    if (error) {
      this.logger.error(`AI Provider Error: ${provider}/${operation}`, context);
    } else {
      this.logger.info(`AI Provider Call: ${provider}/${operation}`, context);
    }
  }

  logDatabaseQuery(query: string, params: any[], duration: number, error?: Error): void {
    const context: LogContext = {
      database: {
        query: this.sanitizeQuery(query),
        param_count: params.length,
        duration_ms: duration,
        success: !error,
        error: error ? {
          message: error.message,
          code: (error as any).code,
        } : undefined,
      },
    };

    if (error) {
      this.logger.error('Database Query Error', context);
    } else if (duration > 1000) {
      this.logger.warn('Slow Database Query', context);
    } else {
      this.logger.debug('Database Query', context);
    }
  }

  logBusinessEvent(eventType: string, details: Record<string, any>): void {
    const context: LogContext = {
      business_event: {
        type: eventType,
        ...details,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.info(`Business Event: ${eventType}`, context);
  }

  logPerformanceMetric(metric: string, value: number, unit: string, tags?: Record<string, string>): void {
    const context: LogContext = {
      performance: {
        metric,
        value,
        unit,
        tags,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.info(`Performance Metric: ${metric}`, context);
  }

  // Audit logging for compliance
  logAuditEvent(action: string, resourceType: string, resourceId: string, userId: string, changes?: any): void {
    const context: LogContext = {
      audit: {
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        user_id: userId,
        changes,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.info(`Audit Event: ${action} ${resourceType}/${resourceId}`, context);
  }

  // Helper to sanitize sensitive data from queries
  private sanitizeQuery(query: string): string {
    // Remove potential sensitive data patterns
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/api_key\s*=\s*'[^']*'/gi, "api_key='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'");
  }

  // Create child logger with additional context
  createChildLogger(context: LogContext): any {
    return {
      info: (message: string, additionalContext?: LogContext) => 
        this.info(message, { ...context, ...additionalContext }),
      warn: (message: string, additionalContext?: LogContext) => 
        this.warn(message, { ...context, ...additionalContext }),
      error: (message: string, error?: Error, additionalContext?: LogContext) => 
        this.error(message, error, { ...context, ...additionalContext }),
      debug: (message: string, additionalContext?: LogContext) => 
        this.debug(message, { ...context, ...additionalContext }),
    };
  }

  // Get logger instance (for compatibility)
  getLogger(): winston.Logger {
    return this.logger;
  }
}