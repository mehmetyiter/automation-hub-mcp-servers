import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';
import { MetricsService } from '../observability/metrics.js';
import { LoggingService } from '../observability/logging.js';
import { Pool, PoolClient, QueryResult, QueryConfig } from 'pg';

export class DatabaseInstrumentation {
  private metrics: MetricsService;
  private logger: LoggingService;
  private originalQuery: any;
  private originalConnect: any;

  constructor(private pool: Pool) {
    this.metrics = MetricsService.getInstance();
    this.logger = LoggingService.getInstance();
    this.instrumentPool();
  }

  private instrumentPool(): void {
    // Store original methods
    this.originalQuery = this.pool.query.bind(this.pool);
    this.originalConnect = this.pool.connect.bind(this.pool);

    // Instrument pool.query
    this.pool.query = this.createInstrumentedQuery();

    // Instrument pool.connect
    this.pool.connect = this.createInstrumentedConnect();

    // Monitor pool statistics
    this.startPoolMonitoring();
  }

  private createInstrumentedQuery(): any {
    return async (...args: any[]): Promise<QueryResult> => {
      const startTime = Date.now();
      const tracer = trace.getTracer('database-instrumentation', '1.0.0');
      
      // Parse query details
      const queryDetails = this.parseQueryArgs(args);
      const queryType = this.extractQueryType(queryDetails.text);
      const tableName = this.extractTableName(queryDetails.text);

      // Start span
      const span = tracer.startSpan(`db.query ${queryType}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.operation': queryType,
          'db.statement': this.sanitizeQuery(queryDetails.text),
          'db.table': tableName,
          'db.user': this.pool.options.user,
          'db.name': this.pool.options.database,
          'net.peer.name': this.pool.options.host || 'localhost',
          'net.peer.port': this.pool.options.port || 5432,
        }
      });

      try {
        // Execute query with span context
        const result = await context.with(
          trace.setSpan(context.active(), span),
          async () => {
            return await this.originalQuery(...args);
          }
        );

        const duration = Date.now() - startTime;

        // Set success status
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('db.rows_affected', result.rowCount || 0);

        // Record metrics
        this.metrics.recordDatabaseQuery(queryType, tableName || 'unknown', duration, true);

        // Log slow queries
        if (duration > 1000) {
          this.logger.logDatabaseQuery(queryDetails.text, queryDetails.values || [], duration);
        }

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Record error
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });

        // Record metrics
        this.metrics.recordDatabaseQuery(queryType, tableName || 'unknown', duration, false);
        this.metrics.recordMetric('database', 'errorTotal', 1, {
          query_type: queryType,
          error_code: error.code || 'UNKNOWN'
        });

        // Log error
        this.logger.logDatabaseQuery(queryDetails.text, queryDetails.values || [], duration, error);

        throw error;
      } finally {
        span.end();
      }
    };
  }

  private createInstrumentedConnect(): any {
    return async (): Promise<PoolClient> => {
      const startTime = Date.now();
      const tracer = trace.getTracer('database-instrumentation', '1.0.0');
      
      const span = tracer.startSpan('db.connect', {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.user': this.pool.options.user,
          'db.name': this.pool.options.database,
        }
      });

      try {
        const client = await context.with(
          trace.setSpan(context.active(), span),
          async () => {
            return await this.originalConnect();
          }
        );

        const duration = Date.now() - startTime;
        span.setStatus({ code: SpanStatusCode.OK });

        // Record connection metrics
        this.metrics.recordMetric('database', 'connectionDuration', duration, {
          status: 'success'
        });

        // Instrument client query method
        const originalClientQuery = client.query.bind(client);
        client.query = this.createInstrumentedClientQuery(originalClientQuery, client);

        // Add release tracking
        const originalRelease = client.release.bind(client);
        client.release = (err?: Error) => {
          this.metrics.recordMetric('database', 'activeConnections', -1);
          originalRelease(err);
        };

        this.metrics.recordMetric('database', 'activeConnections', 1);

        return client;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });

        this.metrics.recordMetric('database', 'connectionDuration', duration, {
          status: 'failed'
        });
        this.metrics.recordMetric('database', 'connectionErrors', 1);

        throw error;
      } finally {
        span.end();
      }
    };
  }

  private createInstrumentedClientQuery(originalQuery: any, client: PoolClient): any {
    return async (...args: any[]): Promise<QueryResult> => {
      const startTime = Date.now();
      const tracer = trace.getTracer('database-instrumentation', '1.0.0');
      
      const queryDetails = this.parseQueryArgs(args);
      const queryType = this.extractQueryType(queryDetails.text);
      const tableName = this.extractTableName(queryDetails.text);

      const span = tracer.startSpan(`db.client.query ${queryType}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.operation': queryType,
          'db.statement': this.sanitizeQuery(queryDetails.text),
          'db.table': tableName,
        }
      });

      try {
        const result = await context.with(
          trace.setSpan(context.active(), span),
          async () => {
            return await originalQuery(...args);
          }
        );

        const duration = Date.now() - startTime;
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('db.rows_affected', result.rowCount || 0);

        return result;
      } catch (error: any) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    };
  }

  private startPoolMonitoring(): void {
    // Monitor pool statistics every 10 seconds
    setInterval(() => {
      const poolSize = this.pool.totalCount;
      const idleCount = this.pool.idleCount;
      const waitingCount = this.pool.waitingCount;

      // Update metrics
      this.metrics.recordMetric('database', 'poolSize', poolSize);
      this.metrics.recordMetric('database', 'poolActive', poolSize - idleCount);
      this.metrics.recordMetric('database', 'poolIdle', idleCount);
      this.metrics.recordMetric('database', 'poolWaiting', waitingCount);

      // Log warning if pool is under pressure
      if (waitingCount > 0 || (poolSize - idleCount) / poolSize > 0.8) {
        this.logger.warn('Database pool under pressure', {
          poolSize,
          activeConnections: poolSize - idleCount,
          waitingRequests: waitingCount,
          utilizationPercent: ((poolSize - idleCount) / poolSize) * 100
        });
      }
    }, 10000);
  }

  private parseQueryArgs(args: any[]): { text: string; values?: any[] } {
    if (typeof args[0] === 'string') {
      return {
        text: args[0],
        values: args[1]
      };
    } else if (args[0] && typeof args[0] === 'object' && 'text' in args[0]) {
      return args[0] as QueryConfig;
    }
    return { text: '' };
  }

  private extractQueryType(query: string): string {
    const trimmed = query.trim().toUpperCase();
    const firstWord = trimmed.split(/\s+/)[0];
    
    switch (firstWord) {
      case 'SELECT':
      case 'WITH':
        return 'SELECT';
      case 'INSERT':
        return 'INSERT';
      case 'UPDATE':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      case 'CREATE':
        return 'CREATE';
      case 'ALTER':
        return 'ALTER';
      case 'DROP':
        return 'DROP';
      case 'TRUNCATE':
        return 'TRUNCATE';
      case 'BEGIN':
      case 'START':
        return 'TRANSACTION';
      case 'COMMIT':
        return 'COMMIT';
      case 'ROLLBACK':
        return 'ROLLBACK';
      default:
        return 'OTHER';
    }
  }

  private extractTableName(query: string): string | undefined {
    // Simple regex patterns to extract table names
    const patterns = [
      /FROM\s+"?([\w\.]+)"?/i,
      /INTO\s+"?([\w\.]+)"?/i,
      /UPDATE\s+"?([\w\.]+)"?/i,
      /DELETE\s+FROM\s+"?([\w\.]+)"?/i,
      /CREATE\s+TABLE\s+"?([\w\.]+)"?/i,
      /ALTER\s+TABLE\s+"?([\w\.]+)"?/i,
      /DROP\s+TABLE\s+"?([\w\.]+)"?/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        // Remove schema prefix if present
        const parts = match[1].split('.');
        return parts[parts.length - 1];
      }
    }

    return undefined;
  }

  private sanitizeQuery(query: string): string {
    // Truncate very long queries
    if (query.length > 1000) {
      query = query.substring(0, 1000) + '...';
    }

    // Remove sensitive patterns
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/api_key\s*=\s*'[^']*'/gi, "api_key='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'");
  }

  // Transaction instrumentation
  async instrumentTransaction<T>(
    name: string,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const tracer = trace.getTracer('database-instrumentation', '1.0.0');
    const span = tracer.startSpan(`db.transaction ${name}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'TRANSACTION',
        'db.transaction.name': name,
      }
    });

    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');
      
      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          return await operation(client);
        }
      );

      await client.query('COMMIT');
      
      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('db.transaction.duration_ms', duration);

      this.metrics.recordMetric('database', 'transactionDuration', duration, {
        status: 'committed'
      });

      return result;
    } catch (error: any) {
      await client.query('ROLLBACK');
      
      const duration = Date.now() - startTime;
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.setAttribute('db.transaction.duration_ms', duration);

      this.metrics.recordMetric('database', 'transactionDuration', duration, {
        status: 'rolled_back'
      });
      this.metrics.recordMetric('database', 'transactionErrors', 1);

      throw error;
    } finally {
      client.release();
      span.end();
    }
  }

  // Batch operation instrumentation
  async instrumentBatch<T>(
    name: string,
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    const tracer = trace.getTracer('database-instrumentation', '1.0.0');
    const span = tracer.startSpan(`db.batch ${name}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': 'BATCH',
        'db.batch.size': operations.length,
        'db.batch.name': name,
      }
    });

    const startTime = Date.now();

    try {
      const results = await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          return await Promise.all(operations.map(op => op()));
        }
      );

      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('db.batch.duration_ms', duration);
      span.setAttribute('db.batch.avg_duration_ms', duration / operations.length);

      this.metrics.recordMetric('database', 'batchDuration', duration, {
        batch_size: operations.length.toString()
      });

      return results;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });

      this.metrics.recordMetric('database', 'batchErrors', 1);

      throw error;
    } finally {
      span.end();
    }
  }
}