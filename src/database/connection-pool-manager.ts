import { Pool, PoolConfig, Client } from 'pg';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  averageAcquisitionTime: number;
  connectionErrors: number;
  poolUtilization: number;
}

export interface ConnectionConfig extends PoolConfig {
  statementTimeout?: number;
  queryTimeout?: number;
  idleInTransactionSessionTimeout?: number;
  applicationName?: string;
  maxConnectionsPerOperation?: Map<string, number>;
}

export class ConnectionPoolManager extends EventEmitter {
  private pools: Map<string, Pool> = new Map();
  private metrics: Map<string, PoolMetrics> = new Map();
  private healthCheckInterval: NodeJS.Timer;
  private logger: Logger;
  private readonly defaultConfig: ConnectionConfig = {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeout: 30000,
    queryTimeout: 60000,
    idleInTransactionSessionTimeout: 60000
  };

  constructor(private baseConfig: ConnectionConfig, logger: Logger) {
    super();
    this.logger = logger;
    this.initializeHealthChecks();
  }

  async createPool(name: string, config?: Partial<ConnectionConfig>): Promise<Pool> {
    this.logger.info(`🏊 Creating connection pool: ${name}`);

    const poolConfig = {
      ...this.defaultConfig,
      ...this.baseConfig,
      ...config,
      application_name: `${this.baseConfig.applicationName || 'n8n-mcp'}_${name}`
    };

    const pool = new Pool(poolConfig);

    pool.on('connect', (client) => {
      this.onClientConnect(name, client);
    });

    pool.on('acquire', (client) => {
      this.onClientAcquire(name, client);
    });

    pool.on('error', (err, client) => {
      this.onPoolError(name, err, client);
    });

    pool.on('remove', (client) => {
      this.onClientRemove(name, client);
    });

    this.pools.set(name, pool);
    this.initializeMetrics(name);

    await this.testPool(pool, name);

    return pool;
  }

  async initializeOptimizedPools(): Promise<void> {
    await this.createPool('read_heavy', {
      max: 30,
      min: 10,
      statementTimeout: 5000,
      queryTimeout: 10000
    });

    await this.createPool('write_operations', {
      max: 15,
      min: 5,
      statementTimeout: 30000,
      queryTimeout: 60000
    });

    await this.createPool('analytics', {
      max: 10,
      min: 2,
      statementTimeout: 300000,
      queryTimeout: 600000
    });

    await this.createPool('batch_operations', {
      max: 5,
      min: 1,
      statementTimeout: 600000,
      queryTimeout: 1200000
    });

    await this.createPool('realtime', {
      max: 50,
      min: 20,
      statementTimeout: 2000,
      queryTimeout: 5000,
      idleTimeoutMillis: 60000
    });
  }

  getPool(operationType: 'read' | 'write' | 'analytics' | 'batch' | 'realtime' = 'read'): Pool {
    const poolMap = {
      read: 'read_heavy',
      write: 'write_operations',
      analytics: 'analytics',
      batch: 'batch_operations',
      realtime: 'realtime'
    };

    const poolName = poolMap[operationType];
    const pool = this.pools.get(poolName);

    if (!pool) {
      throw new Error(`Pool ${poolName} not initialized`);
    }

    return pool;
  }

  async query(
    text: string,
    params?: any[],
    operationType?: 'read' | 'write' | 'analytics' | 'batch'
  ): Promise<any> {
    const detectedType = operationType || this.detectOperationType(text);
    const pool = this.getPool(detectedType);
    
    const start = Date.now();
    let client: Client | undefined;

    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      
      const duration = Date.now() - start;
      this.updateQueryMetrics(detectedType, duration, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateQueryMetrics(detectedType, duration, false);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async transaction<T>(
    callback: (client: Client) => Promise<T>,
    isolationLevel: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' = 'READ COMMITTED'
  ): Promise<T> {
    const pool = this.getPool('write');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private onClientConnect(poolName: string, client: any): void {
    this.logger.info(`✅ Client connected to pool: ${poolName}`);
    
    client.query(`SET statement_timeout = ${this.defaultConfig.statementTimeout}`);
    client.query(`SET idle_in_transaction_session_timeout = ${this.defaultConfig.idleInTransactionSessionTimeout}`);
  }

  private onClientAcquire(poolName: string, client: any): void {
    const metrics = this.metrics.get(poolName);
    if (metrics) {
      metrics.totalConnections = this.pools.get(poolName)?.totalCount || 0;
      metrics.idleConnections = this.pools.get(poolName)?.idleCount || 0;
      metrics.waitingRequests = this.pools.get(poolName)?.waitingCount || 0;
    }
  }

  private onPoolError(poolName: string, error: Error, client: any): void {
    this.logger.error(`❌ Pool error in ${poolName}:`, error);
    
    const metrics = this.metrics.get(poolName);
    if (metrics) {
      metrics.connectionErrors++;
    }

    this.emit('pool-error', { poolName, error });
  }

  private onClientRemove(poolName: string, client: any): void {
    this.logger.info(`🔌 Client removed from pool: ${poolName}`);
  }

  private initializeMetrics(poolName: string): void {
    this.metrics.set(poolName, {
      totalConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      averageAcquisitionTime: 0,
      connectionErrors: 0,
      poolUtilization: 0
    });
  }

  private updateQueryMetrics(poolType: string, duration: number, success: boolean): void {
    this.emit('query-executed', {
      poolType,
      duration,
      success,
      timestamp: new Date()
    });
  }

  private detectOperationType(query: string): 'read' | 'write' | 'analytics' | 'batch' {
    const normalizedQuery = query.trim().toUpperCase();

    if (normalizedQuery.startsWith('SELECT')) {
      if (normalizedQuery.includes('GROUP BY') || 
          normalizedQuery.includes('WINDOW') ||
          normalizedQuery.includes('WITH')) {
        return 'analytics';
      }
      return 'read';
    }

    if (normalizedQuery.startsWith('INSERT') || 
        normalizedQuery.startsWith('UPDATE') ||
        normalizedQuery.startsWith('DELETE')) {
      return 'write';
    }

    if (normalizedQuery.startsWith('COPY') || 
        normalizedQuery.includes('BULK')) {
      return 'batch';
    }

    return 'read';
  }

  private async testPool(pool: Pool, name: string): Promise<void> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.logger.info(`✅ Pool ${name} connectivity test passed`);
    } catch (error) {
      this.logger.error(`❌ Pool ${name} connectivity test failed:`, error);
      throw error;
    }
  }

  private initializeHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [name, pool] of this.pools.entries()) {
        await this.checkPoolHealth(name, pool);
      }
    }, 30000);
  }

  private async checkPoolHealth(name: string, pool: Pool): Promise<void> {
    try {
      const metrics = this.metrics.get(name);
      if (!metrics) return;

      const total = pool.totalCount;
      const idle = pool.idleCount;
      const waiting = pool.waitingCount;
      
      metrics.poolUtilization = total > 0 ? ((total - idle) / total) * 100 : 0;

      if (metrics.poolUtilization > 90) {
        this.logger.warn(`⚠️ Pool ${name} is ${metrics.poolUtilization.toFixed(1)}% utilized`);
      }

      if (waiting > 5) {
        this.logger.warn(`⚠️ Pool ${name} has ${waiting} waiting clients`);
      }

      this.emit('health-check', { poolName: name, metrics });
    } catch (error) {
      this.logger.error(`Health check failed for pool ${name}:`, error);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down connection pools...');
    
    clearInterval(this.healthCheckInterval);

    for (const [name, pool] of this.pools.entries()) {
      try {
        await pool.end();
        this.logger.info(`✅ Pool ${name} shut down successfully`);
      } catch (error) {
        this.logger.error(`❌ Error shutting down pool ${name}:`, error);
      }
    }

    this.pools.clear();
    this.metrics.clear();
  }

  getMetrics(): Map<string, PoolMetrics> {
    return new Map(this.metrics);
  }

  async resizePoolsBasedOnLoad(): Promise<void> {
    for (const [name, pool] of this.pools.entries()) {
      const metrics = this.metrics.get(name);
      if (!metrics) continue;

      if (metrics.poolUtilization > 80 && pool.options.max < 50) {
        const newMax = Math.min(pool.options.max + 10, 50);
        this.logger.info(`📈 Pool ${name} needs resize to ${newMax} (current utilization: ${metrics.poolUtilization}%)`);
      }

      if (metrics.poolUtilization < 20 && pool.options.max > 10) {
        const newMax = Math.max(pool.options.max - 5, 10);
        this.logger.info(`📉 Pool ${name} could resize down to ${newMax} (current utilization: ${metrics.poolUtilization}%)`);
      }
    }
  }
}