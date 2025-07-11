import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  APMMonitor, 
  Transaction, 
  Span, 
  SpanType, 
  SamplingStrategy,
  AlertRule,
  instrument
} from '../src/code-generation/monitoring/apm-monitor';

// Mock database
jest.mock('../src/code-generation/database/code-generation-db');

describe('APMMonitor', () => {
  let apmMonitor: APMMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    apmMonitor = new APMMonitor();
  });

  afterEach(() => {
    apmMonitor.shutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Transaction Management', () => {
    it('should start and end a transaction', () => {
      const transaction = apmMonitor.startTransaction('test-transaction', 'http');
      
      expect(transaction).toBeDefined();
      expect(transaction?.id).toBeDefined();
      expect(transaction?.name).toBe('test-transaction');
      expect(transaction?.type).toBe('http');
      expect(transaction?.status).toBe('started');
      
      apmMonitor.endTransaction(transaction!.id);
      
      const completed = apmMonitor.getTransaction(transaction!.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should apply sampling strategy', () => {
      // Create monitor with 50% sampling
      const sampledMonitor = new APMMonitor({
        type: 'probabilistic',
        probability: 0.5
      });
      
      let sampled = 0;
      let notSampled = 0;
      
      // Create many transactions
      for (let i = 0; i < 100; i++) {
        const transaction = sampledMonitor.startTransaction(`test-${i}`, 'http');
        if (transaction) {
          sampled++;
          sampledMonitor.endTransaction(transaction.id);
        } else {
          notSampled++;
        }
      }
      
      // Should be roughly 50/50 with some variance
      expect(sampled).toBeGreaterThan(30);
      expect(sampled).toBeLessThan(70);
      expect(notSampled).toBeGreaterThan(30);
      expect(notSampled).toBeLessThan(70);
      
      sampledMonitor.shutdown();
    });

    it('should track transaction metadata', () => {
      const metadata = {
        userId: 'user123',
        sessionId: 'session456',
        correlationId: 'corr789',
        tags: { environment: 'test', version: '1.0.0' }
      };
      
      const transaction = apmMonitor.startTransaction('test', 'http', metadata);
      
      expect(transaction?.metadata.userId).toBe('user123');
      expect(transaction?.metadata.sessionId).toBe('session456');
      expect(transaction?.metadata.correlationId).toBe('corr789');
      expect(transaction?.metadata.tags.environment).toBe('test');
    });

    it('should set transaction context', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      
      apmMonitor.setTransactionContext(transaction!.id, {
        request: {
          method: 'GET',
          url: '/api/test',
          headers: { 'content-type': 'application/json' }
        },
        user: {
          id: 'user123',
          username: 'testuser'
        },
        custom: {
          feature: 'code-generation'
        }
      });
      
      const updated = apmMonitor.getTransaction(transaction!.id);
      expect(updated?.context.request?.method).toBe('GET');
      expect(updated?.context.user?.username).toBe('testuser');
      expect(updated?.context.custom.feature).toBe('code-generation');
    });

    it('should handle transaction errors', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      
      const error = new Error('Test error');
      apmMonitor.addTransactionError(transaction!.id, error);
      
      apmMonitor.endTransaction(transaction!.id);
      
      const completed = apmMonitor.getTransaction(transaction!.id);
      expect(completed?.status).toBe('failed');
      expect(completed?.errors.length).toBe(1);
      expect(completed?.errors[0].message).toBe('Test error');
      expect(completed?.errors[0].type).toBe('Error');
    });
  });

  describe('Span Management', () => {
    it('should create spans within a transaction', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      
      const span = apmMonitor.startSpan(
        transaction!.id,
        'database-query',
        SpanType.DATABASE_QUERY
      );
      
      expect(span).toBeDefined();
      expect(span?.transactionId).toBe(transaction!.id);
      expect(span?.name).toBe('database-query');
      expect(span?.type).toBe(SpanType.DATABASE_QUERY);
      
      apmMonitor.endSpan(span!.id);
      apmMonitor.endTransaction(transaction!.id);
      
      const completed = apmMonitor.getTransaction(transaction!.id);
      expect(completed?.spans.length).toBe(1);
      expect(completed?.spans[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should support nested spans', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      
      const parentSpan = apmMonitor.startSpan(
        transaction!.id,
        'parent-operation',
        SpanType.CUSTOM
      );
      
      const childSpan = apmMonitor.startSpan(
        transaction!.id,
        'child-operation',
        SpanType.COMPUTATION,
        parentSpan!.id
      );
      
      expect(childSpan?.parentSpanId).toBe(parentSpan!.id);
      
      apmMonitor.endSpan(childSpan!.id);
      apmMonitor.endSpan(parentSpan!.id);
      apmMonitor.endTransaction(transaction!.id);
    });

    it('should add span metadata', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      const span = apmMonitor.startSpan(
        transaction!.id,
        'db-query',
        SpanType.DATABASE_QUERY
      );
      
      apmMonitor.endSpan(span!.id, {
        db: {
          type: 'postgres',
          instance: 'main',
          statement: 'SELECT * FROM users',
          rows: 10
        }
      });
      
      apmMonitor.endTransaction(transaction!.id);
      
      const completed = apmMonitor.getTransaction(transaction!.id);
      const completedSpan = completed?.spans[0];
      
      expect(completedSpan?.metadata.db?.type).toBe('postgres');
      expect(completedSpan?.metadata.db?.rows).toBe(10);
    });

    it('should add span tags and logs', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      const span = apmMonitor.startSpan(
        transaction!.id,
        'operation',
        SpanType.CUSTOM
      );
      
      apmMonitor.setSpanTags(span!.id, {
        userId: 'user123',
        version: '1.0.0',
        critical: true
      });
      
      apmMonitor.addSpanLog(span!.id, 'info', 'Starting operation');
      apmMonitor.addSpanLog(span!.id, 'debug', 'Processing data', { count: 100 });
      
      apmMonitor.endSpan(span!.id);
      apmMonitor.endTransaction(transaction!.id);
      
      const completed = apmMonitor.getTransaction(transaction!.id);
      const completedSpan = completed?.spans[0];
      
      expect(completedSpan?.tags.userId).toBe('user123');
      expect(completedSpan?.tags.critical).toBe(true);
      expect(completedSpan?.logs.length).toBe(2);
      expect(completedSpan?.logs[0].level).toBe('info');
      expect(completedSpan?.logs[1].fields?.count).toBe(100);
    });
  });

  describe('Async Context Tracking', () => {
    it('should track transactions in async context', async () => {
      const result = await apmMonitor.runInTransaction(
        'async-operation',
        'custom',
        async (transaction) => {
          expect(transaction.id).toBeDefined();
          
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          
          return { success: true, data: 'test' };
        }
      );
      
      expect(result.success).toBe(true);
      
      // Transaction should be completed
      const transactions = apmMonitor.searchTransactions({ 
        transactionName: 'async-operation' 
      });
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].status).toBe('completed');
      expect(transactions[0].result).toEqual({ success: true, data: 'test' });
    });

    it('should handle errors in async context', async () => {
      await expect(
        apmMonitor.runInTransaction(
          'failing-operation',
          'custom',
          async () => {
            throw new Error('Async error');
          }
        )
      ).rejects.toThrow('Async error');
      
      const transactions = apmMonitor.searchTransactions({ 
        transactionName: 'failing-operation' 
      });
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].status).toBe('failed');
      expect(transactions[0].errors.length).toBe(1);
    });

    it('should track spans in async context', async () => {
      await apmMonitor.runInTransaction(
        'span-test',
        'custom',
        async (transaction) => {
          await apmMonitor.runInSpan(
            transaction,
            'async-span',
            SpanType.COMPUTATION,
            async (span) => {
              expect(span.id).toBeDefined();
              await new Promise(resolve => setTimeout(resolve, 5));
              return 'span-result';
            }
          );
        }
      );
      
      const transactions = apmMonitor.searchTransactions({ 
        transactionName: 'span-test' 
      });
      
      expect(transactions[0].spans.length).toBe(1);
      expect(transactions[0].spans[0].status).toBe('completed');
    });
  });

  describe('Metrics Calculation', () => {
    beforeEach(() => {
      // Create some test transactions
      for (let i = 0; i < 10; i++) {
        const transaction = apmMonitor.startTransaction(`test-${i}`, 'http');
        
        // Add spans
        const span = apmMonitor.startSpan(
          transaction!.id,
          'operation',
          i % 2 === 0 ? SpanType.DATABASE_QUERY : SpanType.HTTP_REQUEST
        );
        
        // Simulate duration
        jest.advanceTimersByTime(50 + i * 10);
        
        if (i % 5 === 0) {
          // Add error to some transactions
          apmMonitor.addTransactionError(transaction!.id, new Error('Test error'));
        }
        
        apmMonitor.endSpan(span!.id);
        apmMonitor.endTransaction(transaction!.id);
      }
    });

    it('should calculate transaction metrics', () => {
      // Trigger metrics calculation
      jest.advanceTimersByTime(10000);
      
      const metrics = apmMonitor.getMetrics();
      
      expect(metrics.transactions.total).toBe(10);
      expect(metrics.transactions.successful).toBe(8);
      expect(metrics.transactions.failed).toBe(2);
      expect(metrics.transactions.avgDuration).toBeGreaterThan(0);
      expect(metrics.transactions.p95Duration).toBeGreaterThan(metrics.transactions.avgDuration);
    });

    it('should calculate span metrics', () => {
      jest.advanceTimersByTime(10000);
      
      const metrics = apmMonitor.getMetrics();
      
      expect(metrics.spans.total).toBe(10);
      expect(metrics.spans.byType[SpanType.DATABASE_QUERY]).toBe(5);
      expect(metrics.spans.byType[SpanType.HTTP_REQUEST]).toBe(5);
      expect(metrics.spans.avgDuration).toBeGreaterThan(0);
    });

    it('should calculate error metrics', () => {
      jest.advanceTimersByTime(10000);
      
      const metrics = apmMonitor.getMetrics();
      
      expect(metrics.errors.total).toBe(2);
      expect(metrics.errors.rate).toBe(0.2); // 2 errors / 10 transactions
      expect(metrics.errors.byType['Error']).toBe(2);
    });

    it('should calculate throughput metrics', () => {
      jest.advanceTimersByTime(10000);
      
      const metrics = apmMonitor.getMetrics();
      
      expect(metrics.throughput.rpm).toBe(10);
      expect(metrics.throughput.tpm).toBe(10);
    });
  });

  describe('Alerting', () => {
    it('should trigger alerts based on error rate', () => {
      const alertEvents: any[] = [];
      
      apmMonitor.on('alert-triggered', (rule) => {
        alertEvents.push(rule);
      });
      
      const alertRule: AlertRule = {
        id: 'error-rate-alert',
        name: 'High Error Rate',
        condition: {
          metric: 'error_rate',
          operator: 'gt',
          threshold: 0.1,
          duration: 0
        },
        actions: [{ type: 'log', config: {} }],
        enabled: true,
        cooldown: 60000
      };
      
      apmMonitor.addAlertRule(alertRule);
      
      // Create failing transactions
      for (let i = 0; i < 10; i++) {
        const transaction = apmMonitor.startTransaction(`test-${i}`, 'http');
        if (i < 3) {
          apmMonitor.addTransactionError(transaction!.id, new Error('Test'));
        }
        apmMonitor.endTransaction(transaction!.id);
      }
      
      // Trigger alert check
      jest.advanceTimersByTime(10000);
      
      expect(alertEvents.length).toBe(1);
      expect(alertEvents[0].name).toBe('High Error Rate');
    });

    it('should respect alert cooldown period', () => {
      const alertEvents: any[] = [];
      
      apmMonitor.on('alert-triggered', (rule) => {
        alertEvents.push(rule);
      });
      
      const alertRule: AlertRule = {
        id: 'test-alert',
        name: 'Test Alert',
        condition: {
          metric: 'response_time',
          operator: 'gt',
          threshold: 0, // Always trigger
          duration: 0
        },
        actions: [{ type: 'log', config: {} }],
        enabled: true,
        cooldown: 30000 // 30 seconds
      };
      
      apmMonitor.addAlertRule(alertRule);
      
      // Create transaction
      const transaction = apmMonitor.startTransaction('test', 'http');
      jest.advanceTimersByTime(100);
      apmMonitor.endTransaction(transaction!.id);
      
      // First check - should trigger
      jest.advanceTimersByTime(10000);
      expect(alertEvents.length).toBe(1);
      
      // Second check within cooldown - should not trigger
      jest.advanceTimersByTime(10000);
      expect(alertEvents.length).toBe(1);
      
      // Third check after cooldown - should trigger again
      jest.advanceTimersByTime(20000);
      expect(alertEvents.length).toBe(2);
    });

    it('should support custom alert conditions', () => {
      const alertEvents: any[] = [];
      
      apmMonitor.on('alert-triggered', (rule) => {
        alertEvents.push(rule);
      });
      
      const alertRule: AlertRule = {
        id: 'custom-alert',
        name: 'Custom Condition',
        condition: {
          metric: 'custom',
          operator: 'gt',
          threshold: 0,
          duration: 0,
          customEvaluator: (metrics) => {
            // Alert if we have both errors and high throughput
            return metrics.errors.total > 0 && metrics.throughput.tpm > 5;
          }
        },
        actions: [{ type: 'log', config: {} }],
        enabled: true,
        cooldown: 0
      };
      
      apmMonitor.addAlertRule(alertRule);
      
      // Create transactions
      for (let i = 0; i < 10; i++) {
        const transaction = apmMonitor.startTransaction(`test-${i}`, 'http');
        if (i === 0) {
          apmMonitor.addTransactionError(transaction!.id, new Error('Test'));
        }
        apmMonitor.endTransaction(transaction!.id);
      }
      
      jest.advanceTimersByTime(10000);
      
      expect(alertEvents.length).toBe(1);
    });
  });

  describe('Transaction Search', () => {
    beforeEach(() => {
      // Create various transactions
      const scenarios = [
        { name: 'user-login', status: 'completed', duration: 100, userId: 'user1' },
        { name: 'user-login', status: 'failed', duration: 200, userId: 'user2', error: true },
        { name: 'data-processing', status: 'completed', duration: 500, userId: 'user1' },
        { name: 'api-call', status: 'completed', duration: 50, userId: 'user3' },
        { name: 'api-call', status: 'failed', duration: 1000, userId: 'user3', error: true }
      ];
      
      scenarios.forEach((scenario, index) => {
        const transaction = apmMonitor.startTransaction(scenario.name, 'http', {
          userId: scenario.userId
        });
        
        jest.advanceTimersByTime(scenario.duration);
        
        if (scenario.error) {
          apmMonitor.addTransactionError(transaction!.id, new Error('Test error'));
        }
        
        apmMonitor.endTransaction(transaction!.id);
      });
    });

    it('should search by transaction name', () => {
      const results = apmMonitor.searchTransactions({
        transactionName: 'user-login'
      });
      
      expect(results.length).toBe(2);
      expect(results.every(t => t.name.includes('user-login'))).toBe(true);
    });

    it('should search by status', () => {
      const failedResults = apmMonitor.searchTransactions({
        status: 'failed'
      });
      
      expect(failedResults.length).toBe(2);
      expect(failedResults.every(t => t.status === 'failed')).toBe(true);
    });

    it('should search by duration range', () => {
      const results = apmMonitor.searchTransactions({
        minDuration: 100,
        maxDuration: 500
      });
      
      expect(results.length).toBe(3);
      expect(results.every(t => t.duration! >= 100 && t.duration! <= 500)).toBe(true);
    });

    it('should search by user ID', () => {
      const results = apmMonitor.searchTransactions({
        userId: 'user1'
      });
      
      expect(results.length).toBe(2);
      expect(results.every(t => t.metadata.userId === 'user1')).toBe(true);
    });

    it('should search for errors only', () => {
      const results = apmMonitor.searchTransactions({
        errorOnly: true
      });
      
      expect(results.length).toBe(2);
      expect(results.every(t => t.errors.length > 0)).toBe(true);
    });

    it('should apply result limit', () => {
      const results = apmMonitor.searchTransactions({
        limit: 3
      });
      
      expect(results.length).toBe(3);
    });
  });

  describe('Distributed Tracing', () => {
    it('should create trace context', () => {
      const transaction = apmMonitor.startTransaction('test', 'http');
      
      const traceContext = apmMonitor.createTraceContext(transaction!);
      
      expect(traceContext).toBeDefined();
      
      // Decode and verify
      const decoded = JSON.parse(Buffer.from(traceContext, 'base64').toString());
      expect(decoded.traceId).toBe(transaction!.id);
      expect(decoded.flags).toBe(1);
    });

    it('should continue trace from context', () => {
      // Create parent transaction
      const parentTransaction = apmMonitor.startTransaction('parent', 'http');
      const traceContext = apmMonitor.createTraceContext(parentTransaction!);
      apmMonitor.endTransaction(parentTransaction!.id);
      
      // Continue trace in "another service"
      const childTransaction = apmMonitor.continueTrace(traceContext, 'child', 'http');
      
      expect(childTransaction?.parentId).toBe(parentTransaction!.id);
      expect(childTransaction?.metadata.correlationId).toBe(parentTransaction!.id);
    });

    it('should handle invalid trace context', () => {
      const transaction = apmMonitor.continueTrace('invalid-context', 'test', 'http');
      
      // Should create new transaction
      expect(transaction).toBeDefined();
      expect(transaction?.parentId).toBeUndefined();
    });
  });

  describe('Export Formats', () => {
    beforeEach(() => {
      // Create test transaction with spans
      const transaction = apmMonitor.startTransaction('export-test', 'http', {
        service: 'test-service',
        version: '1.0.0'
      });
      
      const span = apmMonitor.startSpan(
        transaction!.id,
        'test-span',
        SpanType.DATABASE_QUERY
      );
      
      apmMonitor.setSpanTags(span!.id, { db: 'postgres' });
      apmMonitor.addSpanLog(span!.id, 'info', 'Query executed');
      
      jest.advanceTimersByTime(100);
      
      apmMonitor.endSpan(span!.id);
      apmMonitor.endTransaction(transaction!.id);
    });

    it('should export transactions as JSON', async () => {
      const exported = await apmMonitor.exportTransactions('json');
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0].name).toBe('export-test');
    });

    it('should export transactions in OTLP format', async () => {
      const exported = await apmMonitor.exportTransactions('otlp');
      const parsed = JSON.parse(exported);
      
      expect(parsed.traces).toBeDefined();
      expect(parsed.traces[0].resourceSpans).toBeDefined();
      expect(parsed.traces[0].resourceSpans[0].resource.attributes).toBeDefined();
    });

    it('should export transactions in Jaeger format', async () => {
      const exported = await apmMonitor.exportTransactions('jaeger');
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].traceID).toBeDefined();
      expect(parsed[0].spans).toBeDefined();
      expect(parsed[0].process.serviceName).toBe('test-service');
    });
  });

  describe('Sampling Strategies', () => {
    it('should use adaptive sampling', () => {
      const adaptiveMonitor = new APMMonitor({
        type: 'adaptive',
        adaptiveConfig: {
          targetSampleRate: 0.5,
          minSampleRate: 0.1,
          maxSampleRate: 1.0
        }
      });
      
      // Simulate high throughput
      (adaptiveMonitor as any).metrics.throughput.tpm = 2000;
      
      let sampled = 0;
      for (let i = 0; i < 100; i++) {
        const transaction = adaptiveMonitor.startTransaction(`test-${i}`, 'http');
        if (transaction) {
          sampled++;
          adaptiveMonitor.endTransaction(transaction.id);
        }
      }
      
      // Should reduce sampling rate due to high throughput
      expect(sampled).toBeLessThan(80);
      
      adaptiveMonitor.shutdown();
    });

    it('should use rate limiting sampling', () => {
      const rateLimitedMonitor = new APMMonitor({
        type: 'rate-limiting',
        rateLimit: 5
      });
      
      // Try to create many transactions quickly
      const transactions: (Transaction | null)[] = [];
      for (let i = 0; i < 10; i++) {
        transactions.push(
          rateLimitedMonitor.startTransaction(`test-${i}`, 'http')
        );
      }
      
      const sampled = transactions.filter(t => t !== null).length;
      expect(sampled).toBeLessThanOrEqual(5);
      
      rateLimitedMonitor.shutdown();
    });
  });

  describe('Performance Report', () => {
    it('should generate comprehensive report', async () => {
      // Create various transactions
      for (let i = 0; i < 20; i++) {
        const transaction = apmMonitor.startTransaction(
          i % 2 === 0 ? 'api-call' : 'data-processing',
          'http',
          { userId: `user${i % 3}` }
        );
        
        // Add spans
        const spanCount = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < spanCount; j++) {
          const span = apmMonitor.startSpan(
            transaction!.id,
            `operation-${j}`,
            [SpanType.DATABASE_QUERY, SpanType.HTTP_REQUEST, SpanType.COMPUTATION][j % 3]
          );
          
          jest.advanceTimersByTime(10 + Math.random() * 50);
          apmMonitor.endSpan(span!.id);
        }
        
        // Add errors to some
        if (i % 5 === 0) {
          apmMonitor.addTransactionError(transaction!.id, new Error(`Error ${i}`));
        }
        
        jest.advanceTimersByTime(50 + Math.random() * 100);
        apmMonitor.endTransaction(transaction!.id);
      }
      
      // Add alert rules
      apmMonitor.addAlertRule({
        id: 'test-alert',
        name: 'Test Alert',
        condition: { metric: 'error_rate', operator: 'gt', threshold: 0.1, duration: 0 },
        actions: [],
        enabled: true,
        cooldown: 60000
      });
      
      // Generate report
      const report = await apmMonitor.generateReport();
      
      expect(report).toContain('APM Monitoring Report');
      expect(report).toContain('Transaction Metrics');
      expect(report).toContain('Throughput');
      expect(report).toContain('Span Analysis');
      expect(report).toContain('Error Analysis');
      expect(report).toContain('Active Monitoring');
      expect(report).toContain('Sampling');
      
      // Verify metrics are included
      expect(report).toMatch(/Total Transactions: \d+/);
      expect(report).toMatch(/Error Rate: \d+\.\d+%/);
      expect(report).toMatch(/Alert Rules: \d+/);
    });
  });

  describe('Instrumentation Helper', () => {
    it('should instrument synchronous functions', async () => {
      const testFn = (a: number, b: number) => a + b;
      
      const instrumented = instrument(
        apmMonitor,
        'add-operation',
        SpanType.COMPUTATION,
        testFn
      );
      
      const result = await instrumented(5, 3);
      expect(result).toBe(8);
      
      const transactions = apmMonitor.searchTransactions({
        transactionName: 'add-operation'
      });
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].status).toBe('completed');
    });

    it('should instrument async functions', async () => {
      const asyncFn = async (value: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return value.toUpperCase();
      };
      
      const instrumented = instrument(
        apmMonitor,
        'async-operation',
        SpanType.CUSTOM,
        asyncFn
      );
      
      const result = await instrumented('hello');
      expect(result).toBe('HELLO');
      
      const transactions = apmMonitor.searchTransactions({
        transactionName: 'async-operation'
      });
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].status).toBe('completed');
      expect(transactions[0].spans.length).toBe(1);
    });

    it('should handle instrumented function errors', async () => {
      const errorFn = async () => {
        throw new Error('Instrumented error');
      };
      
      const instrumented = instrument(
        apmMonitor,
        'error-operation',
        SpanType.CUSTOM,
        errorFn
      );
      
      await expect(instrumented()).rejects.toThrow('Instrumented error');
      
      const transactions = apmMonitor.searchTransactions({
        transactionName: 'error-operation'
      });
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].status).toBe('failed');
      expect(transactions[0].errors.length).toBe(1);
    });
  });
});