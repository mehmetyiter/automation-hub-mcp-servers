import { register, Gauge, Counter, Histogram, Summary, collectDefaultMetrics, Registry } from 'prom-client';
import express from 'express';
import { EventEmitter } from 'events';

export interface MetricsConfig {
  port: number;
  path: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics: boolean;
  prefix?: string;
  buckets?: number[];
  percentiles?: number[];
  maxAgeSeconds?: number;
  ageBuckets?: number;
  pruneAgedBuckets?: boolean;
}

export interface CustomMetric {
  name: string;
  help: string;
  type: 'gauge' | 'counter' | 'histogram' | 'summary';
  labelNames?: string[];
  buckets?: number[]; // For histogram
  percentiles?: number[]; // For summary
  maxAgeSeconds?: number; // For summary
  ageBuckets?: number; // For summary
}

export class PrometheusMetricsCollector extends EventEmitter {
  private registry: Registry;
  private app: express.Application;
  private server: any;
  private config: MetricsConfig;
  
  // Core metrics
  private metrics: Map<string, Gauge | Counter | Histogram | Summary> = new Map();
  
  // Predefined metrics for credential management system
  private credentialMetrics = {
    // Credential operations
    credentialOperations: null as Counter | null,
    credentialOperationDuration: null as Histogram | null,
    activeCredentials: null as Gauge | null,
    credentialValidations: null as Counter | null,
    credentialValidationDuration: null as Histogram | null,
    
    // API usage metrics
    apiRequests: null as Counter | null,
    apiRequestDuration: null as Histogram | null,
    apiRequestSize: null as Histogram | null,
    apiResponseSize: null as Histogram | null,
    apiConcurrentRequests: null as Gauge | null,
    
    // Cost metrics
    estimatedCost: null as Gauge | null,
    costByProvider: null as Gauge | null,
    costOptimizationSavings: null as Gauge | null,
    budgetUtilization: null as Gauge | null,
    
    // Security metrics
    securityEvents: null as Counter | null,
    blockedRequests: null as Counter | null,
    authenticationAttempts: null as Counter | null,
    activeSessions: null as Gauge | null,
    encryptionOperations: null as Counter | null,
    
    // Performance metrics
    databaseConnections: null as Gauge | null,
    databaseQueryDuration: null as Histogram | null,
    cacheHitRate: null as Gauge | null,
    queueSize: null as Gauge | null,
    processingLatency: null as Histogram | null,
    
    // System health metrics
    serviceHealth: null as Gauge | null,
    circuitBreakerStatus: null as Gauge | null,
    errorRate: null as Gauge | null,
    uptime: null as Gauge | null,
    memoryUsage: null as Gauge | null,
    cpuUsage: null as Gauge | null
  };

  constructor(config: MetricsConfig) {
    super();
    this.config = config;
    this.registry = new Registry();
    this.app = express();
    
    if (config.defaultLabels) {
      this.registry.setDefaultLabels(config.defaultLabels);
    }
    
    this.initializeMetrics();
    this.setupEndpoints();
  }

  private initializeMetrics(): void {
    console.log('📊 Initializing Prometheus metrics...');

    // Collect default Node.js metrics if enabled
    if (this.config.collectDefaultMetrics) {
      collectDefaultMetrics({ 
        register: this.registry,
        prefix: this.config.prefix
      });
    }

    // Initialize credential operation metrics
    this.credentialMetrics.credentialOperations = new Counter({
      name: `${this.config.prefix}credential_operations_total`,
      help: 'Total number of credential operations',
      labelNames: ['operation', 'provider', 'status'],
      registers: [this.registry]
    });

    this.credentialMetrics.credentialOperationDuration = new Histogram({
      name: `${this.config.prefix}credential_operation_duration_seconds`,
      help: 'Duration of credential operations in seconds',
      labelNames: ['operation', 'provider'],
      buckets: this.config.buckets || [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.credentialMetrics.activeCredentials = new Gauge({
      name: `${this.config.prefix}active_credentials`,
      help: 'Number of active credentials',
      labelNames: ['provider', 'status'],
      registers: [this.registry]
    });

    this.credentialMetrics.credentialValidations = new Counter({
      name: `${this.config.prefix}credential_validations_total`,
      help: 'Total number of credential validations',
      labelNames: ['provider', 'result'],
      registers: [this.registry]
    });

    this.credentialMetrics.credentialValidationDuration = new Histogram({
      name: `${this.config.prefix}credential_validation_duration_seconds`,
      help: 'Duration of credential validations in seconds',
      labelNames: ['provider'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    // Initialize API usage metrics
    this.credentialMetrics.apiRequests = new Counter({
      name: `${this.config.prefix}api_requests_total`,
      help: 'Total number of API requests',
      labelNames: ['method', 'endpoint', 'status_code', 'provider'],
      registers: [this.registry]
    });

    this.credentialMetrics.apiRequestDuration = new Histogram({
      name: `${this.config.prefix}api_request_duration_seconds`,
      help: 'Duration of API requests in seconds',
      labelNames: ['method', 'endpoint', 'provider'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    this.credentialMetrics.apiRequestSize = new Histogram({
      name: `${this.config.prefix}api_request_size_bytes`,
      help: 'Size of API requests in bytes',
      labelNames: ['method', 'endpoint', 'provider'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry]
    });

    this.credentialMetrics.apiResponseSize = new Histogram({
      name: `${this.config.prefix}api_response_size_bytes`,
      help: 'Size of API responses in bytes',
      labelNames: ['method', 'endpoint', 'provider'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry]
    });

    this.credentialMetrics.apiConcurrentRequests = new Gauge({
      name: `${this.config.prefix}api_concurrent_requests`,
      help: 'Number of concurrent API requests',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    // Initialize cost metrics
    this.credentialMetrics.estimatedCost = new Gauge({
      name: `${this.config.prefix}estimated_cost_dollars`,
      help: 'Estimated cost in dollars',
      labelNames: ['period', 'type'],
      registers: [this.registry]
    });

    this.credentialMetrics.costByProvider = new Gauge({
      name: `${this.config.prefix}cost_by_provider_dollars`,
      help: 'Cost by provider in dollars',
      labelNames: ['provider', 'model', 'period'],
      registers: [this.registry]
    });

    this.credentialMetrics.costOptimizationSavings = new Gauge({
      name: `${this.config.prefix}cost_optimization_savings_dollars`,
      help: 'Cost optimization savings in dollars',
      labelNames: ['optimization_type', 'period'],
      registers: [this.registry]
    });

    this.credentialMetrics.budgetUtilization = new Gauge({
      name: `${this.config.prefix}budget_utilization_percent`,
      help: 'Budget utilization percentage',
      labelNames: ['budget_type', 'user_id'],
      registers: [this.registry]
    });

    // Initialize security metrics
    this.credentialMetrics.securityEvents = new Counter({
      name: `${this.config.prefix}security_events_total`,
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'source'],
      registers: [this.registry]
    });

    this.credentialMetrics.blockedRequests = new Counter({
      name: `${this.config.prefix}blocked_requests_total`,
      help: 'Total number of blocked requests',
      labelNames: ['reason', 'source'],
      registers: [this.registry]
    });

    this.credentialMetrics.authenticationAttempts = new Counter({
      name: `${this.config.prefix}authentication_attempts_total`,
      help: 'Total number of authentication attempts',
      labelNames: ['method', 'result'],
      registers: [this.registry]
    });

    this.credentialMetrics.activeSessions = new Gauge({
      name: `${this.config.prefix}active_sessions`,
      help: 'Number of active sessions',
      labelNames: ['session_type'],
      registers: [this.registry]
    });

    this.credentialMetrics.encryptionOperations = new Counter({
      name: `${this.config.prefix}encryption_operations_total`,
      help: 'Total number of encryption operations',
      labelNames: ['operation', 'algorithm'],
      registers: [this.registry]
    });

    // Initialize performance metrics
    this.credentialMetrics.databaseConnections = new Gauge({
      name: `${this.config.prefix}database_connections`,
      help: 'Number of database connections',
      labelNames: ['state', 'pool'],
      registers: [this.registry]
    });

    this.credentialMetrics.databaseQueryDuration = new Histogram({
      name: `${this.config.prefix}database_query_duration_seconds`,
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.credentialMetrics.cacheHitRate = new Gauge({
      name: `${this.config.prefix}cache_hit_rate`,
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });

    this.credentialMetrics.queueSize = new Gauge({
      name: `${this.config.prefix}queue_size`,
      help: 'Size of various queues',
      labelNames: ['queue_name'],
      registers: [this.registry]
    });

    this.credentialMetrics.processingLatency = new Histogram({
      name: `${this.config.prefix}processing_latency_seconds`,
      help: 'Processing latency in seconds',
      labelNames: ['operation_type'],
      buckets: [0.001, 0.01, 0.1, 1, 10],
      registers: [this.registry]
    });

    // Initialize system health metrics
    this.credentialMetrics.serviceHealth = new Gauge({
      name: `${this.config.prefix}service_health`,
      help: 'Service health status (1=healthy, 0=unhealthy)',
      labelNames: ['service', 'component'],
      registers: [this.registry]
    });

    this.credentialMetrics.circuitBreakerStatus = new Gauge({
      name: `${this.config.prefix}circuit_breaker_status`,
      help: 'Circuit breaker status (0=closed, 1=open, 2=half-open)',
      labelNames: ['service'],
      registers: [this.registry]
    });

    this.credentialMetrics.errorRate = new Gauge({
      name: `${this.config.prefix}error_rate_percent`,
      help: 'Error rate percentage',
      labelNames: ['service', 'error_type'],
      registers: [this.registry]
    });

    this.credentialMetrics.uptime = new Gauge({
      name: `${this.config.prefix}uptime_seconds`,
      help: 'Service uptime in seconds',
      registers: [this.registry]
    });

    this.credentialMetrics.memoryUsage = new Gauge({
      name: `${this.config.prefix}memory_usage_bytes`,
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.credentialMetrics.cpuUsage = new Gauge({
      name: `${this.config.prefix}cpu_usage_percent`,
      help: 'CPU usage percentage',
      labelNames: ['core'],
      registers: [this.registry]
    });

    console.log('✅ Prometheus metrics initialized');
  }

  private setupEndpoints(): void {
    // Metrics endpoint
    this.app.get(this.config.path, async (req, res) => {
      try {
        res.set('Content-Type', this.registry.contentType);
        const metrics = await this.registry.metrics();
        res.end(metrics);
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });

    // Metrics metadata endpoint
    this.app.get('/metrics/metadata', (req, res) => {
      const metadata = this.getMetricsMetadata();
      res.json(metadata);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`📊 Prometheus metrics server listening on port ${this.config.port}`);
        console.log(`📊 Metrics available at http://localhost:${this.config.port}${this.config.path}`);
        this.emit('server-started', { port: this.config.port });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('📊 Prometheus metrics server stopped');
          this.emit('server-stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Metric recording methods

  recordCredentialOperation(operation: string, provider: string, status: 'success' | 'failure', duration: number): void {
    this.credentialMetrics.credentialOperations?.inc({ operation, provider, status });
    this.credentialMetrics.credentialOperationDuration?.observe({ operation, provider }, duration);
  }

  recordApiRequest(method: string, endpoint: string, statusCode: number, provider: string, duration: number): void {
    this.credentialMetrics.apiRequests?.inc({ 
      method, 
      endpoint, 
      status_code: statusCode.toString(), 
      provider 
    });
    this.credentialMetrics.apiRequestDuration?.observe({ method, endpoint, provider }, duration);
  }

  recordApiRequestSize(method: string, endpoint: string, provider: string, size: number): void {
    this.credentialMetrics.apiRequestSize?.observe({ method, endpoint, provider }, size);
  }

  recordApiResponseSize(method: string, endpoint: string, provider: string, size: number): void {
    this.credentialMetrics.apiResponseSize?.observe({ method, endpoint, provider }, size);
  }

  updateConcurrentRequests(provider: string, delta: number): void {
    if (delta > 0) {
      this.credentialMetrics.apiConcurrentRequests?.inc({ provider }, delta);
    } else {
      this.credentialMetrics.apiConcurrentRequests?.dec({ provider }, Math.abs(delta));
    }
  }

  updateActiveCredentials(provider: string, status: string, count: number): void {
    this.credentialMetrics.activeCredentials?.set({ provider, status }, count);
  }

  recordCredentialValidation(provider: string, result: 'valid' | 'invalid', duration: number): void {
    this.credentialMetrics.credentialValidations?.inc({ provider, result });
    this.credentialMetrics.credentialValidationDuration?.observe({ provider }, duration);
  }

  updateEstimatedCost(period: string, type: string, amount: number): void {
    this.credentialMetrics.estimatedCost?.set({ period, type }, amount);
  }

  updateCostByProvider(provider: string, model: string, period: string, amount: number): void {
    this.credentialMetrics.costByProvider?.set({ provider, model, period }, amount);
  }

  updateCostOptimizationSavings(optimizationType: string, period: string, amount: number): void {
    this.credentialMetrics.costOptimizationSavings?.set({ optimization_type: optimizationType, period }, amount);
  }

  updateBudgetUtilization(budgetType: string, userId: string, percentage: number): void {
    this.credentialMetrics.budgetUtilization?.set({ budget_type: budgetType, user_id: userId }, percentage);
  }

  recordSecurityEvent(eventType: string, severity: string, source: string): void {
    this.credentialMetrics.securityEvents?.inc({ event_type: eventType, severity, source });
  }

  recordBlockedRequest(reason: string, source: string): void {
    this.credentialMetrics.blockedRequests?.inc({ reason, source });
  }

  recordAuthenticationAttempt(method: string, result: 'success' | 'failure'): void {
    this.credentialMetrics.authenticationAttempts?.inc({ method, result });
  }

  updateActiveSessions(sessionType: string, count: number): void {
    this.credentialMetrics.activeSessions?.set({ session_type: sessionType }, count);
  }

  recordEncryptionOperation(operation: string, algorithm: string): void {
    this.credentialMetrics.encryptionOperations?.inc({ operation, algorithm });
  }

  updateDatabaseConnections(state: string, pool: string, count: number): void {
    this.credentialMetrics.databaseConnections?.set({ state, pool }, count);
  }

  recordDatabaseQuery(queryType: string, table: string, duration: number): void {
    this.credentialMetrics.databaseQueryDuration?.observe({ query_type: queryType, table }, duration);
  }

  updateCacheHitRate(cacheType: string, rate: number): void {
    this.credentialMetrics.cacheHitRate?.set({ cache_type: cacheType }, rate);
  }

  updateQueueSize(queueName: string, size: number): void {
    this.credentialMetrics.queueSize?.set({ queue_name: queueName }, size);
  }

  recordProcessingLatency(operationType: string, latency: number): void {
    this.credentialMetrics.processingLatency?.observe({ operation_type: operationType }, latency);
  }

  updateServiceHealth(service: string, component: string, isHealthy: boolean): void {
    this.credentialMetrics.serviceHealth?.set({ service, component }, isHealthy ? 1 : 0);
  }

  updateCircuitBreakerStatus(service: string, state: 'closed' | 'open' | 'half-open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    this.credentialMetrics.circuitBreakerStatus?.set({ service }, stateValue);
  }

  updateErrorRate(service: string, errorType: string, rate: number): void {
    this.credentialMetrics.errorRate?.set({ service, error_type: errorType }, rate);
  }

  updateUptime(seconds: number): void {
    this.credentialMetrics.uptime?.set(seconds);
  }

  updateMemoryUsage(type: string, bytes: number): void {
    this.credentialMetrics.memoryUsage?.set({ type }, bytes);
  }

  updateCpuUsage(core: string, percentage: number): void {
    this.credentialMetrics.cpuUsage?.set({ core }, percentage);
  }

  // Custom metric creation
  createCustomMetric(config: CustomMetric): void {
    let metric: Gauge | Counter | Histogram | Summary;

    switch (config.type) {
      case 'gauge':
        metric = new Gauge({
          name: `${this.config.prefix}${config.name}`,
          help: config.help,
          labelNames: config.labelNames,
          registers: [this.registry]
        });
        break;

      case 'counter':
        metric = new Counter({
          name: `${this.config.prefix}${config.name}`,
          help: config.help,
          labelNames: config.labelNames,
          registers: [this.registry]
        });
        break;

      case 'histogram':
        metric = new Histogram({
          name: `${this.config.prefix}${config.name}`,
          help: config.help,
          labelNames: config.labelNames,
          buckets: config.buckets || this.config.buckets,
          registers: [this.registry]
        });
        break;

      case 'summary':
        metric = new Summary({
          name: `${this.config.prefix}${config.name}`,
          help: config.help,
          labelNames: config.labelNames,
          percentiles: config.percentiles || this.config.percentiles,
          maxAgeSeconds: config.maxAgeSeconds || this.config.maxAgeSeconds,
          ageBuckets: config.ageBuckets || this.config.ageBuckets,
          registers: [this.registry]
        });
        break;
    }

    this.metrics.set(config.name, metric);
    console.log(`✅ Created custom metric: ${config.name}`);
  }

  getCustomMetric(name: string): Gauge | Counter | Histogram | Summary | undefined {
    return this.metrics.get(name);
  }

  // Utility methods
  private getMetricsMetadata(): any {
    const metadata: any = {
      prefix: this.config.prefix,
      metrics: []
    };

    // Add all registered metrics
    for (const [name, metric] of Object.entries(this.credentialMetrics)) {
      if (metric) {
        metadata.metrics.push({
          name: (metric as any).name,
          type: (metric as any).constructor.name.toLowerCase(),
          help: (metric as any).help,
          labelNames: (metric as any).labelNames || []
        });
      }
    }

    // Add custom metrics
    for (const [name, metric] of this.metrics.entries()) {
      metadata.metrics.push({
        name: (metric as any).name,
        type: (metric as any).constructor.name.toLowerCase(),
        help: (metric as any).help,
        labelNames: (metric as any).labelNames || []
      });
    }

    return metadata;
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  reset(): void {
    this.registry.clear();
    this.metrics.clear();
    this.initializeMetrics();
    console.log('📊 Metrics reset');
  }
}

// Export convenience function
export function createPrometheusMetricsCollector(config: MetricsConfig): PrometheusMetricsCollector {
  return new PrometheusMetricsCollector(config);
}

// Export default configuration
export const defaultMetricsConfig: MetricsConfig = {
  port: 9090,
  path: '/metrics',
  collectDefaultMetrics: true,
  prefix: 'credential_mgmt_',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  maxAgeSeconds: 600,
  ageBuckets: 5,
  pruneAgedBuckets: true
};