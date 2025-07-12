import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Meter, Counter, Histogram, ObservableGauge, UpDownCounter } from '@opentelemetry/api';

interface MetricInstruments {
  [key: string]: Counter | Histogram | ObservableGauge | UpDownCounter;
}

interface MetricCategories {
  [key: string]: MetricInstruments;
}

export class MetricsService {
  private static instance: MetricsService;
  private meterProvider: MeterProvider;
  private meters: MetricCategories = {};
  private prometheusExporter: PrometheusExporter;
  
  constructor() {
    // Initialize Prometheus exporter
    this.prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.METRICS_PORT || '9464'),
      endpoint: '/metrics',
    }, () => {
      console.log(`Prometheus metrics server started on port ${process.env.METRICS_PORT || '9464'}`);
    });

    // Create meter provider with resource
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'n8n-mcp',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.VERSION || '1.0.0',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'automation-hub',
      })
    );

    this.meterProvider = new MeterProvider({
      resource,
      readers: [this.prometheusExporter],
    });
    
    this.initializeMetrics();
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private initializeMetrics(): void {
    const meter = this.meterProvider.getMeter('n8n-mcp-metrics', '1.0.0');
    
    // API metrics
    const apiMetrics: MetricInstruments = {
      requestDuration: meter.createHistogram('api_request_duration_ms', {
        description: 'API request duration in milliseconds',
        unit: 'ms',
      }),
      requestTotal: meter.createCounter('api_requests_total', {
        description: 'Total number of API requests',
      }),
      errorTotal: meter.createCounter('api_errors_total', {
        description: 'Total number of API errors',
      }),
      activeRequests: meter.createUpDownCounter('api_active_requests', {
        description: 'Number of active API requests',
      }),
    };

    // AI Provider metrics
    const aiMetrics: MetricInstruments = {
      cost: meter.createCounter('ai_provider_cost_usd', {
        description: 'Total cost by AI provider in USD',
        unit: 'USD',
      }),
      tokens: meter.createCounter('ai_provider_tokens_total', {
        description: 'Total tokens used by provider',
      }),
      latency: meter.createHistogram('ai_provider_latency_ms', {
        description: 'AI provider response latency',
        unit: 'ms',
      }),
      errorRate: meter.createCounter('ai_provider_errors_total', {
        description: 'Total AI provider errors',
      }),
      cacheHits: meter.createCounter('ai_provider_cache_hits_total', {
        description: 'Total cache hits for AI provider calls',
      }),
    };

    // Database metrics
    const dbMetrics: MetricInstruments = {
      connectionPoolSize: meter.createUpDownCounter('db_connection_pool_size', {
        description: 'Database connection pool size',
      }),
      connectionPoolActive: meter.createUpDownCounter('db_connection_pool_active', {
        description: 'Active database connections',
      }),
      queryDuration: meter.createHistogram('db_query_duration_ms', {
        description: 'Database query duration',
        unit: 'ms',
      }),
      queryErrors: meter.createCounter('db_query_errors_total', {
        description: 'Total database query errors',
      }),
      transactionDuration: meter.createHistogram('db_transaction_duration_ms', {
        description: 'Database transaction duration',
        unit: 'ms',
      }),
    };

    // Business metrics
    const businessMetrics: MetricInstruments = {
      activeUsers: meter.createObservableGauge('active_users_total', {
        description: 'Total number of active users',
      }, async (observableResult) => {
        // This would be populated from actual data
        const activeUsers = await this.getActiveUserCount();
        observableResult.observe(activeUsers);
      }),
      credentialsCreated: meter.createCounter('credentials_created_total', {
        description: 'Total credentials created',
      }),
      automationsCreated: meter.createCounter('automations_created_total', {
        description: 'Total automations created',
      }),
      automationsExecuted: meter.createCounter('automations_executed_total', {
        description: 'Total automations executed',
      }),
      workflowExecutionTime: meter.createHistogram('workflow_execution_time_ms', {
        description: 'Workflow execution time',
        unit: 'ms',
      }),
    };

    // Cache metrics
    const cacheMetrics: MetricInstruments = {
      hits: meter.createCounter('cache_hits_total', {
        description: 'Total cache hits',
      }),
      misses: meter.createCounter('cache_misses_total', {
        description: 'Total cache misses',
      }),
      evictions: meter.createCounter('cache_evictions_total', {
        description: 'Total cache evictions',
      }),
      hitRate: meter.createObservableGauge('cache_hit_rate', {
        description: 'Cache hit rate percentage',
      }, async (observableResult) => {
        const hitRate = await this.calculateCacheHitRate();
        observableResult.observe(hitRate);
      }),
    };

    // Cost optimization metrics
    const costMetrics: MetricInstruments = {
      savings: meter.createCounter('cost_savings_usd', {
        description: 'Total cost savings from optimizations',
        unit: 'USD',
      }),
      optimizationEvents: meter.createCounter('cost_optimization_events_total', {
        description: 'Total cost optimization events',
      }),
      providerSwitches: meter.createCounter('provider_switches_total', {
        description: 'Total provider switches for cost optimization',
      }),
    };

    // Security metrics
    const securityMetrics: MetricInstruments = {
      authFailures: meter.createCounter('auth_failures_total', {
        description: 'Total authentication failures',
      }),
      suspiciousActivities: meter.createCounter('suspicious_activities_total', {
        description: 'Total suspicious activities detected',
      }),
      blockedRequests: meter.createCounter('blocked_requests_total', {
        description: 'Total blocked requests',
      }),
      securityScore: meter.createObservableGauge('security_score', {
        description: 'Current security score (0-100)',
      }, async (observableResult) => {
        const score = await this.calculateSecurityScore();
        observableResult.observe(score);
      }),
    };

    // SLO metrics
    const sloMetrics: MetricInstruments = {
      compliance: meter.createObservableGauge('slo_compliance_percentage', {
        description: 'SLO compliance percentage',
      }, async (observableResult) => {
        const compliance = await this.calculateSLOCompliance();
        observableResult.observe(compliance);
      }),
      availabilityTarget: meter.createObservableGauge('slo_availability_target', {
        description: 'Availability SLO target percentage',
      }, async (observableResult) => {
        observableResult.observe(99.9);
      }),
      errorBudgetRemaining: meter.createObservableGauge('slo_error_budget_remaining', {
        description: 'Error budget remaining percentage',
      }, async (observableResult) => {
        const errorBudget = await this.calculateErrorBudget();
        observableResult.observe(errorBudget);
      }),
    };

    // System metrics
    const systemMetrics: MetricInstruments = {
      cpuUsage: meter.createObservableGauge('system_cpu_usage_percent', {
        description: 'CPU usage percentage',
      }, async (observableResult) => {
        const cpuUsage = await this.getCPUUsage();
        observableResult.observe(cpuUsage);
      }),
      memoryUsage: meter.createObservableGauge('system_memory_usage_bytes', {
        description: 'Memory usage in bytes',
        unit: 'bytes',
      }, async (observableResult) => {
        const memUsage = process.memoryUsage();
        observableResult.observe(memUsage.heapUsed, { type: 'heap' });
        observableResult.observe(memUsage.rss, { type: 'rss' });
        observableResult.observe(memUsage.external, { type: 'external' });
      }),
      gcPauses: meter.createHistogram('system_gc_pause_ms', {
        description: 'Garbage collection pause duration',
        unit: 'ms',
      }),
    };

    // Store metrics for access
    this.meters = {
      api: apiMetrics,
      ai: aiMetrics,
      db: dbMetrics,
      business: businessMetrics,
      cache: cacheMetrics,
      cost: costMetrics,
      security: securityMetrics,
      slo: sloMetrics,
      system: systemMetrics,
    };
  }

  // Helper method to record metrics
  recordMetric(category: string, metric: string, value: number, attributes?: Record<string, any>): void {
    const categoryMetrics = this.meters[category];
    if (categoryMetrics && categoryMetrics[metric]) {
      const instrument = categoryMetrics[metric];
      
      if ('add' in instrument) {
        // Counter or UpDownCounter
        instrument.add(value, attributes);
      } else if ('record' in instrument) {
        // Histogram
        instrument.record(value, attributes);
      }
    }
  }

  // Record API request
  recordAPIRequest(method: string, endpoint: string, statusCode: number, duration: number): void {
    const attributes = { method, endpoint, status_code: statusCode.toString() };
    
    this.recordMetric('api', 'requestTotal', 1, attributes);
    this.recordMetric('api', 'requestDuration', duration, attributes);
    
    if (statusCode >= 400) {
      this.recordMetric('api', 'errorTotal', 1, attributes);
    }
  }

  // Record AI provider usage
  recordAIUsage(provider: string, model: string, tokens: number, cost: number, duration: number, cached: boolean = false): void {
    const attributes = { provider, model };
    
    this.recordMetric('ai', 'tokens', tokens, attributes);
    this.recordMetric('ai', 'cost', cost, attributes);
    this.recordMetric('ai', 'latency', duration, attributes);
    
    if (cached) {
      this.recordMetric('ai', 'cacheHits', 1, attributes);
    }
  }

  // Record database operation
  recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    const attributes = { operation, table };
    
    this.recordMetric('db', 'queryDuration', duration, attributes);
    
    if (!success) {
      this.recordMetric('db', 'queryErrors', 1, attributes);
    }
  }

  // Record cache operation
  recordCacheOperation(operation: 'hit' | 'miss' | 'eviction', key?: string): void {
    const attributes = key ? { key_prefix: key.split(':')[0] } : undefined;
    
    switch (operation) {
      case 'hit':
        this.recordMetric('cache', 'hits', 1, attributes);
        break;
      case 'miss':
        this.recordMetric('cache', 'misses', 1, attributes);
        break;
      case 'eviction':
        this.recordMetric('cache', 'evictions', 1, attributes);
        break;
    }
  }

  // Record security event
  recordSecurityEvent(eventType: 'auth_failure' | 'suspicious_activity' | 'blocked_request', details?: Record<string, any>): void {
    switch (eventType) {
      case 'auth_failure':
        this.recordMetric('security', 'authFailures', 1, details);
        break;
      case 'suspicious_activity':
        this.recordMetric('security', 'suspiciousActivities', 1, details);
        break;
      case 'blocked_request':
        this.recordMetric('security', 'blockedRequests', 1, details);
        break;
    }
  }

  // Private helper methods for observable gauges
  private async getActiveUserCount(): Promise<number> {
    // Implementation would query the database
    return 100; // Placeholder
  }

  private async calculateCacheHitRate(): Promise<number> {
    // Implementation would calculate from cache stats
    return 85.5; // Placeholder
  }

  private async calculateSecurityScore(): Promise<number> {
    // Implementation would calculate based on security metrics
    return 92; // Placeholder
  }

  private async calculateSLOCompliance(): Promise<number> {
    // Implementation would calculate based on SLO targets
    return 99.5; // Placeholder
  }

  private async calculateErrorBudget(): Promise<number> {
    // Implementation would calculate remaining error budget
    return 75; // Placeholder
  }

  private async getCPUUsage(): Promise<number> {
    // Implementation would get actual CPU usage
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu: any) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return 100 - ~~(100 * totalIdle / totalTick);
  }

  // Get metrics endpoint URL
  getMetricsEndpoint(): string {
    return `http://localhost:${process.env.METRICS_PORT || '9464'}/metrics`;
  }

  // Shutdown metrics
  async shutdown(): Promise<void> {
    await this.prometheusExporter.shutdown();
  }
}