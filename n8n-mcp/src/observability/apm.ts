import { TracingService } from './tracing';
import { MetricsService } from './metrics';
import { LoggingService } from './logging';
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

interface APMConfig {
  serviceName: string;
  environment: string;
  version: string;
  // APM provider specific configs
  elasticApm?: {
    serverUrl: string;
    secretToken?: string;
    apiKey?: string;
  };
  newRelic?: {
    appName: string;
    licenseKey: string;
  };
  datadog?: {
    agentHost: string;
    agentPort: number;
    service: string;
  };
}

interface Transaction {
  id: string;
  name: string;
  type: string;
  startTime: number;
  spans: Span[];
}

interface Span {
  id: string;
  name: string;
  type: string;
  startTime: number;
  duration?: number;
  parent?: string;
  context?: any;
}

export class APMService {
  private static instance: APMService;
  private tracing: TracingService;
  private metrics: MetricsService;
  private logger: LoggingService;
  private transactions: Map<string, Transaction> = new Map();
  private config: APMConfig;

  constructor(config: APMConfig) {
    this.config = config;
    this.tracing = TracingService.getInstance();
    this.metrics = MetricsService.getInstance();
    this.logger = LoggingService.getInstance();
    
    this.initializeAPMProvider();
  }

  static getInstance(config?: APMConfig): APMService {
    if (!APMService.instance) {
      if (!config) {
        throw new Error('APM configuration required for first initialization');
      }
      APMService.instance = new APMService(config);
    }
    return APMService.instance;
  }

  private initializeAPMProvider(): void {
    // Initialize based on configuration
    if (this.config.elasticApm) {
      this.initializeElasticAPM();
    } else if (this.config.newRelic) {
      this.initializeNewRelic();
    } else if (this.config.datadog) {
      this.initializeDatadog();
    }
    
    // Set up custom instrumentation
    this.setupCustomInstrumentation();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  private initializeElasticAPM(): void {
    // Elastic APM would be initialized here
    // This is a placeholder for the actual implementation
    this.logger.info('Initializing Elastic APM', {
      serverUrl: this.config.elasticApm?.serverUrl,
      serviceName: this.config.serviceName
    });
  }

  private initializeNewRelic(): void {
    // New Relic would be initialized here
    this.logger.info('Initializing New Relic APM', {
      appName: this.config.newRelic?.appName
    });
  }

  private initializeDatadog(): void {
    // Datadog APM would be initialized here
    this.logger.info('Initializing Datadog APM', {
      service: this.config.datadog?.service,
      agentHost: this.config.datadog?.agentHost
    });
  }

  private setupCustomInstrumentation(): void {
    // Set up process-level metrics
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.recordMetric('apm', 'heapUsed', memUsage.heapUsed);
      this.metrics.recordMetric('apm', 'heapTotal', memUsage.heapTotal);
      this.metrics.recordMetric('apm', 'rss', memUsage.rss);
      this.metrics.recordMetric('apm', 'cpuUser', cpuUsage.user);
      this.metrics.recordMetric('apm', 'cpuSystem', cpuUsage.system);
    }, 10000);

    // Monitor event loop lag
    this.monitorEventLoopLag();
    
    // Monitor garbage collection
    this.monitorGarbageCollection();
  }

  private monitorEventLoopLag(): void {
    let lastCheck = process.hrtime.bigint();
    
    setInterval(() => {
      const now = process.hrtime.bigint();
      const delay = Number(now - lastCheck) / 1000000; // Convert to ms
      const expectedDelay = 100; // We expect 100ms intervals
      const lag = Math.max(0, delay - expectedDelay);
      
      this.metrics.recordMetric('apm', 'eventLoopLag', lag);
      
      if (lag > 50) {
        this.logger.warn('High event loop lag detected', {
          lag_ms: lag,
          threshold_ms: 50
        });
      }
      
      lastCheck = now;
    }, 100);
  }

  private monitorGarbageCollection(): void {
    try {
      const perfHooks = require('perf_hooks');
      const obs = new perfHooks.PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.recordMetric('apm', 'gcDuration', entry.duration, {
            gc_type: entry.kind === perfHooks.constants.NODE_PERFORMANCE_GC_MAJOR ? 'major' : 'minor'
          });
          
          if (entry.duration > 100) {
            this.logger.warn('Long garbage collection detected', {
              duration_ms: entry.duration,
              type: entry.kind === perfHooks.constants.NODE_PERFORMANCE_GC_MAJOR ? 'major' : 'minor'
            });
          }
        });
      });
      
      obs.observe({ entryTypes: ['gc'] });
    } catch (err) {
      this.logger.warn('Unable to monitor garbage collection', { error: err });
    }
  }

  private startPerformanceMonitoring(): void {
    // Monitor HTTP server performance
    if (global.httpServer) {
      this.monitorHttpServer(global.httpServer);
    }
    
    // Monitor database performance
    this.monitorDatabasePerformance();
    
    // Monitor external service calls
    this.monitorExternalServices();
  }

  private monitorHttpServer(server: any): void {
    server.on('request', (req: any, res: any) => {
      const transaction = this.startTransaction(
        `${req.method} ${req.url}`,
        'request'
      );
      
      res.on('finish', () => {
        this.endTransaction(transaction.id);
      });
    });
  }

  private monitorDatabasePerformance(): void {
    // This would hook into database query execution
    // Placeholder for actual implementation
  }

  private monitorExternalServices(): void {
    // Monitor HTTP client requests
    const http = require('http');
    const https = require('https');
    
    [http, https].forEach(module => {
      const originalRequest = module.request;
      module.request = (...args: any[]) => {
        const span = this.startSpan('http.request', 'external');
        const req = originalRequest.apply(module, args);
        
        req.on('response', (res: any) => {
          span.context = {
            statusCode: res.statusCode,
            url: args[0]?.href || args[0]
          };
          this.endSpan(span.id);
        });
        
        req.on('error', (err: any) => {
          span.context = { error: err.message };
          this.endSpan(span.id);
        });
        
        return req;
      };
    });
  }

  // Transaction management
  startTransaction(name: string, type: string): Transaction {
    const transaction: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      startTime: Date.now(),
      spans: []
    };
    
    this.transactions.set(transaction.id, transaction);
    
    // Create OpenTelemetry span
    const tracer = trace.getTracer('apm', '1.0.0');
    const span = tracer.startSpan(name, {
      kind: SpanKind.SERVER,
      attributes: {
        'apm.transaction.id': transaction.id,
        'apm.transaction.type': type
      }
    });
    
    // Store span reference
    (transaction as any).span = span;
    
    return transaction;
  }

  endTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return;
    }
    
    const duration = Date.now() - transaction.startTime;
    
    // End OpenTelemetry span
    if ((transaction as any).span) {
      (transaction as any).span.end();
    }
    
    // Record metrics
    this.metrics.recordMetric('apm', 'transactionDuration', duration, {
      name: transaction.name,
      type: transaction.type
    });
    
    // Log slow transactions
    if (duration > 1000) {
      this.logger.warn('Slow transaction detected', {
        transaction_id: transactionId,
        name: transaction.name,
        duration_ms: duration,
        span_count: transaction.spans.length
      });
    }
    
    this.transactions.delete(transactionId);
  }

  // Span management
  startSpan(name: string, type: string, parentId?: string): Span {
    const span: Span = {
      id: `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      startTime: Date.now(),
      parent: parentId
    };
    
    // Find parent transaction
    for (const [_, transaction] of this.transactions) {
      if (parentId && transaction.spans.some(s => s.id === parentId)) {
        transaction.spans.push(span);
        break;
      } else if (!parentId) {
        // Add to most recent transaction if no parent specified
        transaction.spans.push(span);
        break;
      }
    }
    
    return span;
  }

  endSpan(spanId: string): void {
    for (const [_, transaction] of this.transactions) {
      const span = transaction.spans.find(s => s.id === spanId);
      if (span) {
        span.duration = Date.now() - span.startTime;
        
        // Record span metrics
        this.metrics.recordMetric('apm', 'spanDuration', span.duration, {
          name: span.name,
          type: span.type
        });
        
        break;
      }
    }
  }

  // Error tracking
  captureError(error: Error, context?: any): void {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Log error with full context
    this.logger.error('APM Error Captured', error, {
      error_id: errorId,
      ...context
    });
    
    // Record error metrics
    this.metrics.recordMetric('apm', 'errorCount', 1, {
      error_type: error.name,
      error_message: error.message
    });
    
    // Send to APM provider
    this.sendErrorToAPM(error, errorId, context);
  }

  private sendErrorToAPM(error: Error, errorId: string, context?: any): void {
    // This would send the error to the configured APM provider
    // Placeholder for actual implementation
  }

  // Custom metrics
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.recordMetric('apm', name, value, tags);
  }

  // User tracking
  setUser(userId: string, email?: string, metadata?: any): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttributes({
        'user.id': userId,
        'user.email': email || '',
        ...Object.entries(metadata || {}).reduce((acc, [key, value]) => {
          acc[`user.${key}`] = String(value);
          return acc;
        }, {} as Record<string, string>)
      });
    }
  }

  // Custom context
  addContext(key: string, value: any): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute(`custom.${key}`, String(value));
    }
  }

  // Performance marks
  mark(name: string): void {
    try {
      performance.mark(name);
    } catch (err) {
      // Fallback if performance API not available
      this.logger.debug('Performance mark failed', { name, error: err });
    }
  }

  measure(name: string, startMark: string, endMark: string): void {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        this.recordMetric(`measure.${name}`, measure.duration);
      }
    } catch (err) {
      this.logger.debug('Performance measure failed', { name, error: err });
    }
  }

  // Service map tracking
  recordServiceDependency(source: string, target: string, operation: string, duration: number, success: boolean): void {
    this.metrics.recordMetric('apm', 'serviceDependency', duration, {
      source_service: source,
      target_service: target,
      operation,
      status: success ? 'success' : 'failure'
    });
  }

  // SLI tracking
  recordSLI(name: string, value: number, target: number): void {
    const withinSLO = value >= target;
    
    this.metrics.recordMetric('apm', 'sli', value, {
      sli_name: name,
      within_slo: withinSLO.toString()
    });
    
    if (!withinSLO) {
      this.logger.warn('SLI violation detected', {
        sli_name: name,
        current_value: value,
        target_value: target
      });
    }
  }
}