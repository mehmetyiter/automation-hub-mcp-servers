import axios from 'axios';
import { Pool } from 'pg';
import * as Redis from 'redis';
import * as AWS from 'aws-sdk';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';
import { FailoverConfig, RegionHealth } from './failover-controller';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface HealthCheckResult {
  isHealthy: boolean;
  services: {
    api: boolean;
    database: boolean;
    cache: boolean;
    storage: boolean;
  };
  metrics: {
    latency: number;
    errorRate: number;
    throughput: number;
  };
  details: {
    apiEndpoints: EndpointHealth[];
    databaseStatus: DatabaseHealth;
    cacheStatus: CacheHealth;
    storageStatus: StorageHealth;
  };
}

export interface EndpointHealth {
  endpoint: string;
  status: number;
  latency: number;
  healthy: boolean;
}

export interface DatabaseHealth {
  connected: boolean;
  replicationLag: number;
  connectionCount: number;
  queryLatency: number;
}

export interface CacheHealth {
  connected: boolean;
  hitRate: number;
  memoryUsage: number;
  evictionRate: number;
}

export interface StorageHealth {
  accessible: boolean;
  writeLatency: number;
  readLatency: number;
  availableSpace: number;
}

export class HealthMonitor {
  private cloudWatch: AWS.CloudWatch;
  private s3: AWS.S3;
  private regionEndpoints: Map<string, string> = new Map();
  private dbPools: Map<string, Pool> = new Map();
  private redisClients: Map<string, Redis.RedisClientType> = new Map();

  constructor(private config: FailoverConfig) {
    this.cloudWatch = new AWS.CloudWatch();
    this.s3 = new AWS.S3();
    this.initializeRegionEndpoints();
  }

  private initializeRegionEndpoints(): void {
    // Map regions to their endpoints
    this.regionEndpoints.set('us-east-1', 'https://api-us-east-1.n8n-mcp.com');
    this.regionEndpoints.set('eu-west-1', 'https://api-eu-west-1.n8n-mcp.com');
    this.regionEndpoints.set('ap-southeast-1', 'https://api-ap-southeast-1.n8n-mcp.com');
  }

  async checkRegionHealth(region: string): Promise<RegionHealth> {
    const startTime = Date.now();
    logger.debug('Checking region health', { region });

    try {
      const healthResult = await this.performHealthChecks(region);
      
      const health: RegionHealth = {
        region,
        isHealthy: healthResult.isHealthy,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        services: healthResult.services,
        metrics: healthResult.metrics
      };

      const checkDuration = Date.now() - startTime;
      metrics.recordMetric('health', 'checkDuration', checkDuration, { region });

      return health;
    } catch (error) {
      logger.error('Health check failed', { region, error });
      
      return {
        region,
        isHealthy: false,
        lastCheck: new Date(),
        consecutiveFailures: 1,
        services: {
          api: false,
          database: false,
          cache: false,
          storage: false
        },
        metrics: {
          latency: Infinity,
          errorRate: 1,
          throughput: 0
        }
      };
    }
  }

  async performDeepHealthCheck(region: string): Promise<HealthCheckResult> {
    logger.info('Performing deep health check', { region });
    
    const [apiHealth, dbHealth, cacheHealth, storageHealth] = await Promise.all([
      this.checkAPIHealth(region),
      this.checkDatabaseHealth(region),
      this.checkCacheHealth(region),
      this.checkStorageHealth(region)
    ]);

    // Get CloudWatch metrics
    const cwMetrics = await this.getCloudWatchMetrics(region);

    const isHealthy = apiHealth.healthy && dbHealth.connected && 
                     cacheHealth.connected && storageHealth.accessible;

    return {
      isHealthy,
      services: {
        api: apiHealth.healthy,
        database: dbHealth.connected,
        cache: cacheHealth.connected,
        storage: storageHealth.accessible
      },
      metrics: {
        latency: apiHealth.avgLatency,
        errorRate: cwMetrics.errorRate,
        throughput: cwMetrics.throughput
      },
      details: {
        apiEndpoints: apiHealth.endpoints,
        databaseStatus: dbHealth,
        cacheStatus: cacheHealth,
        storageStatus: storageHealth
      }
    };
  }

  private async performHealthChecks(region: string): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkAPIHealth(region),
      this.checkDatabaseHealth(region),
      this.checkCacheHealth(region),
      this.checkStorageHealth(region)
    ]);

    const apiHealth = checks[0].status === 'fulfilled' ? checks[0].value : null;
    const dbHealth = checks[1].status === 'fulfilled' ? checks[1].value : null;
    const cacheHealth = checks[2].status === 'fulfilled' ? checks[2].value : null;
    const storageHealth = checks[3].status === 'fulfilled' ? checks[3].value : null;

    const cwMetrics = await this.getCloudWatchMetrics(region).catch(() => ({
      errorRate: 0,
      throughput: 0
    }));

    return {
      isHealthy: !!(apiHealth?.healthy && dbHealth?.connected && 
                   cacheHealth?.connected && storageHealth?.accessible),
      services: {
        api: !!apiHealth?.healthy,
        database: !!dbHealth?.connected,
        cache: !!cacheHealth?.connected,
        storage: !!storageHealth?.accessible
      },
      metrics: {
        latency: apiHealth?.avgLatency || Infinity,
        errorRate: cwMetrics.errorRate,
        throughput: cwMetrics.throughput
      },
      details: {
        apiEndpoints: apiHealth?.endpoints || [],
        databaseStatus: dbHealth || { connected: false, replicationLag: Infinity, connectionCount: 0, queryLatency: Infinity },
        cacheStatus: cacheHealth || { connected: false, hitRate: 0, memoryUsage: 0, evictionRate: 0 },
        storageStatus: storageHealth || { accessible: false, writeLatency: Infinity, readLatency: Infinity, availableSpace: 0 }
      }
    };
  }

  private async checkAPIHealth(region: string): Promise<{
    healthy: boolean;
    avgLatency: number;
    endpoints: EndpointHealth[];
  }> {
    const baseUrl = this.regionEndpoints.get(region);
    if (!baseUrl) {
      throw new Error(`No endpoint configured for region ${region}`);
    }

    const endpoints = [
      '/health',
      '/api/health',
      '/api/v1/status'
    ];

    const results: EndpointHealth[] = [];
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        const latency = Date.now() - startTime;
        results.push({
          endpoint,
          status: response.status,
          latency,
          healthy: response.status >= 200 && response.status < 300
        });
      } catch (error) {
        results.push({
          endpoint,
          status: 0,
          latency: Date.now() - startTime,
          healthy: false
        });
      }
    }

    const healthyEndpoints = results.filter(r => r.healthy);
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    return {
      healthy: healthyEndpoints.length >= endpoints.length / 2,
      avgLatency,
      endpoints: results
    };
  }

  private async checkDatabaseHealth(region: string): Promise<DatabaseHealth> {
    const pool = this.getRegionDbPool(region);
    
    try {
      // Check basic connectivity
      const connectStart = Date.now();
      const client = await pool.connect();
      const connectLatency = Date.now() - connectStart;
      
      try {
        // Check query performance
        const queryStart = Date.now();
        await client.query('SELECT 1');
        const queryLatency = Date.now() - queryStart;
        
        // Check replication lag (if replica)
        let replicationLag = 0;
        try {
          const lagResult = await client.query(`
            SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 as lag_ms
          `);
          replicationLag = lagResult.rows[0]?.lag_ms || 0;
        } catch (e) {
          // Not a replica or no replication
        }
        
        // Get connection stats
        const statsResult = await client.query(`
          SELECT count(*) as total,
                 count(*) FILTER (WHERE state = 'active') as active
          FROM pg_stat_activity
          WHERE datname = current_database()
        `);
        
        return {
          connected: true,
          replicationLag,
          connectionCount: parseInt(statsResult.rows[0].total),
          queryLatency
        };
        
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Database health check failed', { region, error });
      return {
        connected: false,
        replicationLag: Infinity,
        connectionCount: 0,
        queryLatency: Infinity
      };
    }
  }

  private async checkCacheHealth(region: string): Promise<CacheHealth> {
    const client = this.getRegionRedisClient(region);
    
    try {
      // Ping Redis
      const pingStart = Date.now();
      await client.ping();
      const pingLatency = Date.now() - pingStart;
      
      // Get Redis info
      const info = await client.info('stats');
      const stats = this.parseRedisInfo(info);
      
      // Calculate hit rate
      const hits = parseInt(stats.keyspace_hits || '0');
      const misses = parseInt(stats.keyspace_misses || '0');
      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;
      
      // Get memory info
      const memInfo = await client.info('memory');
      const memStats = this.parseRedisInfo(memInfo);
      const usedMemory = parseInt(memStats.used_memory || '0');
      const maxMemory = parseInt(memStats.maxmemory || '0') || Infinity;
      const memoryUsage = maxMemory > 0 ? usedMemory / maxMemory : 0;
      
      // Get eviction stats
      const evicted = parseInt(stats.evicted_keys || '0');
      const cmdProcessed = parseInt(stats.total_commands_processed || '0');
      const evictionRate = cmdProcessed > 0 ? evicted / cmdProcessed : 0;
      
      return {
        connected: true,
        hitRate,
        memoryUsage,
        evictionRate
      };
      
    } catch (error) {
      logger.error('Cache health check failed', { region, error });
      return {
        connected: false,
        hitRate: 0,
        memoryUsage: 0,
        evictionRate: 0
      };
    }
  }

  private async checkStorageHealth(region: string): Promise<StorageHealth> {
    const testKey = `health-check/${region}/${Date.now()}`;
    const testData = Buffer.from('health-check-data');
    
    try {
      // Test write
      const writeStart = Date.now();
      await this.s3.putObject({
        Bucket: `n8n-mcp-${region}`,
        Key: testKey,
        Body: testData
      }).promise();
      const writeLatency = Date.now() - writeStart;
      
      // Test read
      const readStart = Date.now();
      const result = await this.s3.getObject({
        Bucket: `n8n-mcp-${region}`,
        Key: testKey
      }).promise();
      const readLatency = Date.now() - readStart;
      
      // Verify data integrity
      if (!result.Body || !testData.equals(result.Body as Buffer)) {
        throw new Error('Data integrity check failed');
      }
      
      // Clean up
      await this.s3.deleteObject({
        Bucket: `n8n-mcp-${region}`,
        Key: testKey
      }).promise();
      
      // Get bucket metrics
      const bucketMetrics = await this.getBucketMetrics(region);
      
      return {
        accessible: true,
        writeLatency,
        readLatency,
        availableSpace: bucketMetrics.availableSpace
      };
      
    } catch (error) {
      logger.error('Storage health check failed', { region, error });
      return {
        accessible: false,
        writeLatency: Infinity,
        readLatency: Infinity,
        availableSpace: 0
      };
    }
  }

  private async getCloudWatchMetrics(region: string): Promise<{
    errorRate: number;
    throughput: number;
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes
    
    try {
      // Get error rate
      const errorRateResponse = await this.cloudWatch.getMetricStatistics({
        Namespace: 'n8n-mcp',
        MetricName: 'APIErrors',
        Dimensions: [{ Name: 'Region', Value: region }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Average']
      }).promise();
      
      // Get throughput
      const throughputResponse = await this.cloudWatch.getMetricStatistics({
        Namespace: 'n8n-mcp',
        MetricName: 'APIRequests',
        Dimensions: [{ Name: 'Region', Value: region }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum']
      }).promise();
      
      const errorRate = errorRateResponse.Datapoints[0]?.Average || 0;
      const throughput = (throughputResponse.Datapoints[0]?.Sum || 0) / 300; // Requests per second
      
      return { errorRate, throughput };
      
    } catch (error) {
      logger.error('Failed to get CloudWatch metrics', { region, error });
      return { errorRate: 0, throughput: 0 };
    }
  }

  private getRegionDbPool(region: string): Pool {
    if (!this.dbPools.has(region)) {
      this.dbPools.set(region, new Pool({
        host: `db.${region}.n8n-mcp.internal`,
        port: 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      }));
    }
    return this.dbPools.get(region)!;
  }

  private getRegionRedisClient(region: string): Redis.RedisClientType {
    if (!this.redisClients.has(region)) {
      const client = Redis.createClient({
        url: `redis://redis.${region}.n8n-mcp.internal:6379`,
        socket: {
          connectTimeout: 5000
        }
      }) as Redis.RedisClientType;
      
      client.connect();
      this.redisClients.set(region, client);
    }
    return this.redisClients.get(region)!;
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }

  private async getBucketMetrics(region: string): Promise<{ availableSpace: number }> {
    // This would get actual bucket metrics
    // Simplified for this example
    return { availableSpace: 1000000000000 }; // 1TB
  }

  async cleanup(): Promise<void> {
    // Close database pools
    for (const pool of this.dbPools.values()) {
      await pool.end();
    }
    
    // Close Redis clients
    for (const client of this.redisClients.values()) {
      await client.quit();
    }
  }
}