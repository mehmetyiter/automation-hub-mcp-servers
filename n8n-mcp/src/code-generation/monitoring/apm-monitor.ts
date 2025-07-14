import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';

export interface Transaction {
  id: string;
  name: string;
  type: 'http' | 'database' | 'cache' | 'external' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  parentId?: string;
  spans: Span[];
  metadata: TransactionMetadata;
  context: TransactionContext;
  errors: TransactionError[];
  result?: any;
}

export interface Span {
  id: string;
  transactionId: string;
  parentSpanId?: string;
  name: string;
  type: SpanType;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  metadata: SpanMetadata;
  tags: Record<string, string | number | boolean>;
  logs: SpanLog[];
}

export enum SpanType {
  HTTP_REQUEST = 'http_request',
  DATABASE_QUERY = 'database_query',
  CACHE_OPERATION = 'cache_operation',
  EXTERNAL_CALL = 'external_call',
  COMPUTATION = 'computation',
  IO_OPERATION = 'io_operation',
  CUSTOM = 'custom'
}

export interface TransactionMetadata {
  service: string;
  version: string;
  environment: string;
  host: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  tags: Record<string, string | number | boolean>;
}

export interface TransactionContext {
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
  };
  user?: {
    id: string;
    username?: string;
    email?: string;
  };
  custom: Record<string, any>;
}

export interface SpanMetadata {
  component: string;
  resource?: string;
  peer?: {
    address?: string;
    hostname?: string;
    port?: number;
    service?: string;
  };
  db?: {
    type: string;
    instance?: string;
    statement?: string;
    rows?: number;
  };
  http?: {
    method?: string;
    url?: string;
    statusCode?: number;
  };
}

export interface SpanLog {
  timestamp: number;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface TransactionError {
  timestamp: number;
  spanId?: string;
  type: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface APMMetrics {
  transactions: {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
  };
  spans: {
    total: number;
    byType: Record<SpanType, number>;
    avgDuration: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    rate: number;
  };
  throughput: {
    rpm: number; // requests per minute
    tpm: number; // transactions per minute
  };
}

export interface TraceSearchQuery {
  transactionName?: string;
  serviceName?: string;
  minDuration?: number;
  maxDuration?: number;
  status?: string;
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  errorOnly?: boolean;
  tags?: Record<string, string | number | boolean>;
  limit?: number;
}

export interface SamplingStrategy {
  type: 'probabilistic' | 'adaptive' | 'rate-limiting' | 'custom';
  probability?: number; // 0.0 to 1.0
  rateLimit?: number; // transactions per second
  adaptiveConfig?: {
    targetSampleRate: number;
    minSampleRate: number;
    maxSampleRate: number;
  };
  customSampler?: (transaction: Transaction) => boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  actions: AlertAction[];
  enabled: boolean;
  cooldown: number; // milliseconds
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: 'error_rate' | 'response_time' | 'throughput' | 'custom';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // how long condition must be true
  customEvaluator?: (metrics: APMMetrics) => boolean;
}

export interface AlertAction {
  type: 'log' | 'email' | 'webhook' | 'custom';
  config: Record<string, any>;
}

export class APMMonitor extends EventEmitter {
  private transactions: Map<string, Transaction> = new Map();
  private completedTransactions: Transaction[] = [];
  private spans: Map<string, Span> = new Map();
  private metrics: APMMetrics;
  private samplingStrategy: SamplingStrategy;
  private alertRules: Map<string, AlertRule> = new Map();
  private database: CodeGenerationDatabase;
  private metricsInterval?: NodeJS.Timeout;
  private activeContext: Map<string, Transaction> = new Map(); // For async context tracking

  constructor(samplingStrategy?: SamplingStrategy) {
    super();
    this.database = new CodeGenerationDatabase();
    this.samplingStrategy = samplingStrategy || {
      type: 'probabilistic',
      probability: 1.0 // Sample everything by default
    };
    
    this.metrics = this.initializeMetrics();
    this.startMetricsCollection();
    
    console.log('🔍 APM Monitor initialized');
  }

  private initializeMetrics(): APMMetrics {
    return {
      transactions: {
        total: 0,
        successful: 0,
        failed: 0,
        cancelled: 0,
        avgDuration: 0,
        p95Duration: 0,
        p99Duration: 0
      },
      spans: {
        total: 0,
        byType: {} as Record<SpanType, number>,
        avgDuration: 0
      },
      errors: {
        total: 0,
        byType: {},
        rate: 0
      },
      throughput: {
        rpm: 0,
        tpm: 0
      }
    };
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.calculateMetrics();
      this.checkAlerts();
      this.emit('metrics', this.metrics);
    }, 10000); // Every 10 seconds
  }

  // Transaction Management

  startTransaction(
    name: string,
    type: Transaction['type'] = 'custom',
    metadata?: Partial<TransactionMetadata>
  ): Transaction | null {
    // Apply sampling
    if (!this.shouldSample()) {
      return null;
    }
    
    const transaction: Transaction = {
      id: this.generateId(),
      name,
      type,
      startTime: performance.now(),
      status: 'started',
      spans: [],
      metadata: {
        service: 'code-generation',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        host: process.env.HOSTNAME || 'localhost',
        tags: {},
        ...metadata
      },
      context: {
        custom: {}
      },
      errors: []
    };
    
    this.transactions.set(transaction.id, transaction);
    this.emit('transaction-started', transaction);
    
    return transaction;
  }

  endTransaction(transactionId: string, result?: any): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;
    
    transaction.endTime = performance.now();
    transaction.duration = transaction.endTime - transaction.startTime;
    transaction.status = transaction.errors.length > 0 ? 'failed' : 'completed';
    transaction.result = result;
    
    // Complete any open spans
    transaction.spans.forEach(span => {
      if (span.status === 'started') {
        this.endSpan(span.id);
      }
    });
    
    this.transactions.delete(transactionId);
    this.completedTransactions.push(transaction);
    
    // Keep history size manageable
    if (this.completedTransactions.length > 10000) {
      this.completedTransactions = this.completedTransactions.slice(-5000);
    }
    
    this.emit('transaction-ended', transaction);
    
    // Store significant transactions
    if (transaction.duration > 1000 || transaction.errors.length > 0) {
      this.storeTransaction(transaction);
    }
  }

  // Span Management

  startSpan(
    transactionId: string,
    name: string,
    type: SpanType,
    parentSpanId?: string
  ): Span | null {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;
    
    const span: Span = {
      id: this.generateId(),
      transactionId,
      parentSpanId,
      name,
      type,
      startTime: performance.now(),
      status: 'started',
      metadata: {
        component: 'code-generation'
      },
      tags: {},
      logs: []
    };
    
    this.spans.set(span.id, span);
    transaction.spans.push(span);
    
    this.emit('span-started', span);
    
    return span;
  }

  endSpan(spanId: string, metadata?: Partial<SpanMetadata>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
    span.status = 'completed';
    
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }
    
    this.spans.delete(spanId);
    this.emit('span-ended', span);
  }

  // Context and Error Tracking

  setTransactionContext(transactionId: string, context: Partial<TransactionContext>): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;
    
    transaction.context = {
      ...transaction.context,
      ...context,
      custom: {
        ...transaction.context.custom,
        ...(context.custom || {})
      }
    };
  }

  addTransactionError(transactionId: string, error: Error | TransactionError): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;
    
    const transactionError: TransactionError = 
      error instanceof Error ? {
        timestamp: Date.now(),
        type: error.name,
        message: error.message,
        stack: error.stack
      } : error;
    
    transaction.errors.push(transactionError);
    transaction.status = 'failed';
    
    this.emit('transaction-error', { transaction, error: transactionError });
  }

  addSpanLog(spanId: string, level: SpanLog['level'], message: string, fields?: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields
    });
  }

  setSpanTags(spanId: string, tags: Record<string, string | number | boolean>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.tags = { ...span.tags, ...tags };
  }

  // Async Context Tracking

  runInTransaction<T>(
    name: string,
    type: Transaction['type'],
    fn: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    const transaction = this.startTransaction(name, type);
    if (!transaction) {
      return fn({} as Transaction); // Not sampled
    }
    
    // Store in async context
    const asyncId = crypto.randomUUID();
    this.activeContext.set(asyncId, transaction);
    
    return fn(transaction)
      .then(result => {
        this.endTransaction(transaction.id, result);
        return result;
      })
      .catch(error => {
        this.addTransactionError(transaction.id, error);
        this.endTransaction(transaction.id);
        throw error;
      })
      .finally(() => {
        this.activeContext.delete(asyncId);
      });
  }

  async runInSpan<T>(
    transaction: Transaction,
    name: string,
    type: SpanType,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(transaction.id, name, type);
    if (!span) {
      return fn({} as Span); // Transaction not found
    }
    
    try {
      const result = await fn(span);
      this.endSpan(span.id);
      return result;
    } catch (error) {
      span.status = 'failed';
      this.addSpanLog(span.id, 'error', error instanceof Error ? error.message : String(error));
      this.endSpan(span.id);
      throw error;
    }
  }

  // Sampling

  private shouldSample(): boolean {
    switch (this.samplingStrategy.type) {
      case 'probabilistic':
        return Math.random() < (this.samplingStrategy.probability || 1.0);
      
      case 'adaptive':
        return this.adaptiveSampling();
      
      case 'rate-limiting':
        return this.rateLimitingSampling();
      
      case 'custom':
        return true; // Custom sampler applied at transaction level
      
      default:
        return true;
    }
  }

  private adaptiveSampling(): boolean {
    const config = this.samplingStrategy.adaptiveConfig!;
    const currentTpm = this.metrics.throughput.tpm;
    
    // Adjust sample rate based on throughput
    let sampleRate = config.targetSampleRate;
    
    if (currentTpm > 1000) {
      sampleRate = Math.max(config.minSampleRate, sampleRate * 0.5);
    } else if (currentTpm < 100) {
      sampleRate = Math.min(config.maxSampleRate, sampleRate * 1.5);
    }
    
    return Math.random() < sampleRate;
  }

  private rateLimitingSampling(): boolean {
    const limit = this.samplingStrategy.rateLimit || 100;
    const currentRate = this.transactions.size;
    
    return currentRate < limit;
  }

  // Metrics Calculation

  private calculateMetrics(): void {
    const now = Date.now();
    const recentTransactions = this.completedTransactions.filter(
      t => t.endTime && (now - t.startTime) < 60000 // Last minute
    );
    
    // Transaction metrics
    const durations = recentTransactions.map(t => t.duration!).sort((a, b) => a - b);
    
    this.metrics.transactions = {
      total: recentTransactions.length,
      successful: recentTransactions.filter(t => t.status === 'completed' && t.errors.length === 0).length,
      failed: recentTransactions.filter(t => t.status === 'failed').length,
      cancelled: recentTransactions.filter(t => t.status === 'cancelled').length,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0
    };
    
    // Span metrics
    const allSpans = recentTransactions.flatMap(t => t.spans);
    const spansByType = allSpans.reduce((acc, span) => {
      acc[span.type] = (acc[span.type] || 0) + 1;
      return acc;
    }, {} as Record<SpanType, number>);
    
    this.metrics.spans = {
      total: allSpans.length,
      byType: spansByType,
      avgDuration: allSpans.length > 0 ? 
        allSpans.reduce((sum, s) => sum + (s.duration || 0), 0) / allSpans.length : 0
    };
    
    // Error metrics
    const allErrors = recentTransactions.flatMap(t => t.errors);
    const errorsByType = allErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    this.metrics.errors = {
      total: allErrors.length,
      byType: errorsByType,
      rate: recentTransactions.length > 0 ? allErrors.length / recentTransactions.length : 0
    };
    
    // Throughput
    this.metrics.throughput = {
      rpm: recentTransactions.length,
      tpm: recentTransactions.length
    };
  }

  // Alerting

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  private checkAlerts(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }
      
      if (this.evaluateAlertCondition(rule.condition)) {
        this.triggerAlert(rule);
      }
    }
  }

  private evaluateAlertCondition(condition: AlertCondition): boolean {
    let value: number;
    
    switch (condition.metric) {
      case 'error_rate':
        value = this.metrics.errors.rate;
        break;
      case 'response_time':
        value = this.metrics.transactions.avgDuration;
        break;
      case 'throughput':
        value = this.metrics.throughput.tpm;
        break;
      case 'custom':
        return condition.customEvaluator ? condition.customEvaluator(this.metrics) : false;
      default:
        return false;
    }
    
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lte': return value <= condition.threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule): void {
    rule.lastTriggered = new Date();
    
    for (const action of rule.actions) {
      this.executeAlertAction(action, rule);
    }
    
    this.emit('alert-triggered', rule);
  }

  private executeAlertAction(action: AlertAction, rule: AlertRule): void {
    switch (action.type) {
      case 'log':
        console.error(`⚠️ APM Alert: ${rule.name}`);
        break;
      case 'webhook':
        // Send webhook notification
        break;
      case 'email':
        // Send email notification
        break;
      case 'custom':
        // Execute custom action
        break;
    }
  }

  // Querying and Search

  searchTransactions(query: TraceSearchQuery): Transaction[] {
    let results = this.completedTransactions;
    
    if (query.transactionName) {
      results = results.filter(t => t.name.includes(query.transactionName));
    }
    
    if (query.status) {
      results = results.filter(t => t.status === query.status);
    }
    
    if (query.minDuration !== undefined) {
      results = results.filter(t => t.duration && t.duration >= query.minDuration);
    }
    
    if (query.maxDuration !== undefined) {
      results = results.filter(t => t.duration && t.duration <= query.maxDuration);
    }
    
    if (query.errorOnly) {
      results = results.filter(t => t.errors.length > 0);
    }
    
    if (query.userId) {
      results = results.filter(t => t.metadata.userId === query.userId);
    }
    
    if (query.tags) {
      results = results.filter(t => {
        for (const [key, value] of Object.entries(query.tags)) {
          if (t.metadata.tags[key] !== value) return false;
        }
        return true;
      });
    }
    
    // Sort by start time descending
    results.sort((a, b) => b.startTime - a.startTime);
    
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }

  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId) || 
           this.completedTransactions.find(t => t.id === transactionId);
  }

  getMetrics(): APMMetrics {
    return { ...this.metrics };
  }

  // Distributed Tracing

  createTraceContext(transaction: Transaction): string {
    return Buffer.from(JSON.stringify({
      traceId: transaction.id,
      spanId: transaction.spans[0]?.id || transaction.id,
      flags: 1 // Sampled
    })).toString('base64');
  }

  continueTrace(traceContext: string, name: string, type: Transaction['type']): Transaction | null {
    try {
      const context = JSON.parse(Buffer.from(traceContext, 'base64').toString());
      const transaction = this.startTransaction(name, type);
      
      if (transaction) {
        transaction.parentId = context.traceId;
        transaction.metadata.correlationId = context.traceId;
      }
      
      return transaction;
    } catch {
      return this.startTransaction(name, type);
    }
  }

  // Storage and Export

  private async storeTransaction(transaction: Transaction): Promise<void> {
    try {
      await this.database.saveLearningData({
        request: {
          description: transaction.name,
          nodeType: 'apm_transaction',
          workflowContext: {},
          requirements: {}
        },
        generatedCode: JSON.stringify(transaction),
        executionResult: {
          success: transaction.status === 'completed',
          executionTime: transaction.duration,
          memoryUsed: 0
        },
        patterns: [],
        timestamp: new Date(transaction.startTime).toISOString()
      });
    } catch (error) {
      console.error('Failed to store transaction:', error);
    }
  }

  async exportTransactions(format: 'json' | 'otlp' | 'jaeger' = 'json'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(this.completedTransactions, null, 2);
      
      case 'otlp':
        // Convert to OpenTelemetry format
        return this.convertToOTLP();
      
      case 'jaeger':
        // Convert to Jaeger format
        return this.convertToJaeger();
      
      default:
        return JSON.stringify(this.completedTransactions);
    }
  }

  private convertToOTLP(): string {
    // OpenTelemetry Protocol conversion
    const traces = this.completedTransactions.map(t => ({
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: t.metadata.service } },
            { key: 'service.version', value: { stringValue: t.metadata.version } }
          ]
        },
        instrumentationLibrarySpans: [{
          spans: t.spans.map(s => ({
            traceId: t.id,
            spanId: s.id,
            parentSpanId: s.parentSpanId,
            name: s.name,
            startTimeUnixNano: s.startTime * 1000000,
            endTimeUnixNano: (s.endTime || s.startTime) * 1000000,
            status: { code: s.status === 'completed' ? 1 : 2 }
          }))
        }]
      }]
    }));
    
    return JSON.stringify({ traces });
  }

  private convertToJaeger(): string {
    // Jaeger format conversion
    const traces = this.completedTransactions.map(t => ({
      traceID: t.id,
      spans: t.spans.map(s => ({
        traceID: t.id,
        spanID: s.id,
        operationName: s.name,
        startTime: s.startTime * 1000,
        duration: (s.duration || 0) * 1000,
        tags: Object.entries(s.tags).map(([key, value]) => ({
          key,
          type: typeof value === 'string' ? 'string' : 
                typeof value === 'number' ? 'float64' : 'bool',
          value
        })),
        logs: s.logs.map(l => ({
          timestamp: l.timestamp,
          fields: [
            { key: 'level', value: l.level },
            { key: 'message', value: l.message }
          ]
        }))
      })),
      process: {
        serviceName: t.metadata.service,
        tags: [
          { key: 'hostname', value: t.metadata.host },
          { key: 'version', value: t.metadata.version }
        ]
      }
    }));
    
    return JSON.stringify(traces);
  }

  // Utility Methods

  private generateId(): string {
    return crypto.randomUUID();
  }

  updateSamplingStrategy(strategy: SamplingStrategy): void {
    this.samplingStrategy = strategy;
  }

  clearTransactions(): void {
    this.completedTransactions = [];
    this.transactions.clear();
    this.spans.clear();
  }

  async generateReport(): Promise<string> {
    const metrics = this.getMetrics();
    const topErrors = Object.entries(metrics.errors.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    const topSpanTypes = Object.entries(metrics.spans.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    return `
# APM Monitoring Report
## Generated: ${new Date().toISOString()}

### Transaction Metrics
- Total Transactions: ${metrics.transactions.total}
- Successful: ${metrics.transactions.successful} (${(metrics.transactions.successful / metrics.transactions.total * 100).toFixed(1)}%)
- Failed: ${metrics.transactions.failed} (${(metrics.transactions.failed / metrics.transactions.total * 100).toFixed(1)}%)
- Average Duration: ${metrics.transactions.avgDuration.toFixed(2)}ms
- P95 Duration: ${metrics.transactions.p95Duration.toFixed(2)}ms
- P99 Duration: ${metrics.transactions.p99Duration.toFixed(2)}ms

### Throughput
- Requests per Minute: ${metrics.throughput.rpm}
- Transactions per Minute: ${metrics.throughput.tpm}

### Span Analysis
- Total Spans: ${metrics.spans.total}
- Average Span Duration: ${metrics.spans.avgDuration.toFixed(2)}ms
- Top Span Types:
${topSpanTypes.map(([type, count]) => `  - ${type}: ${count}`).join('\n')}

### Error Analysis
- Total Errors: ${metrics.errors.total}
- Error Rate: ${(metrics.errors.rate * 100).toFixed(2)}%
- Top Error Types:
${topErrors.map(([type, count]) => `  - ${type}: ${count}`).join('\n')}

### Active Monitoring
- Active Transactions: ${this.transactions.size}
- Active Spans: ${this.spans.size}
- Alert Rules: ${this.alertRules.size}

### Sampling
- Strategy: ${this.samplingStrategy.type}
${this.samplingStrategy.type === 'probabilistic' ? `- Probability: ${(this.samplingStrategy.probability! * 100).toFixed(1)}%` : ''}
${this.samplingStrategy.type === 'rate-limiting' ? `- Rate Limit: ${this.samplingStrategy.rateLimit} tps` : ''}
`;
  }

  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // End all active transactions
    for (const transaction of this.transactions.values()) {
      this.endTransaction(transaction.id);
    }
    
    console.log('🛑 APM Monitor shutdown complete');
  }
}

// Helper function for instrumenting functions
export function instrument<T extends (...args: any[]) => any>(
  apm: APMMonitor,
  name: string,
  type: SpanType,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const transaction = apm.startTransaction(name, 'custom');
    if (!transaction) return fn(...args);
    
    const span = apm.startSpan(transaction.id, name, type);
    if (!span) return fn(...args);
    
    try {
      const result = await fn(...args);
      apm.endSpan(span.id);
      apm.endTransaction(transaction.id, result);
      return result;
    } catch (error) {
      apm.addTransactionError(transaction.id, error as Error);
      apm.endSpan(span.id);
      apm.endTransaction(transaction.id);
      throw error;
    }
  }) as T;
}