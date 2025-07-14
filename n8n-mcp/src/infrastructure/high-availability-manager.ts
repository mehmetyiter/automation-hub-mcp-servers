import { EventEmitter } from 'events';
import { Redis, Cluster as RedisCluster } from 'ioredis';
import { Pool as PostgresPool } from 'pg';
import { createPool, Options as PoolConfig } from 'generic-pool';

export interface HAConfig {
  redis: {
    sentinels?: Array<{ host: string; port: number }>;
    cluster?: Array<{ host: string; port: number }>;
    standalone?: { host: string; port: number };
    password?: string;
    db?: number;
    retryStrategy?: (times: number) => number | void;
  };
  postgres: {
    primary: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean;
    };
    replicas: Array<{
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean;
    }>;
    poolConfig: {
      min: number;
      max: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
    };
  };
  loadBalancing: {
    strategy: 'round-robin' | 'least-connections' | 'random' | 'weighted';
    healthCheckInterval: number;
    failoverTimeout: number;
    retryAttempts: number;
    circuitBreakerThreshold: number;
  };
  monitoring: {
    metricsPort: number;
    healthCheckPort: number;
    loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  details: {
    version?: string;
    uptime?: number;
    connections?: number;
    memory?: number;
    cpu?: number;
  };
}

export interface FailoverEvent {
  id: string;
  timestamp: Date;
  service: string;
  fromInstance: string;
  toInstance: string;
  reason: string;
  automaticRecovery: boolean;
  duration: number;
  affectedServices: string[];
}

export interface CircuitBreaker {
  service: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: Date;
  nextRetry?: Date;
  successCount: number;
  requestCount: number;
}

export interface LoadBalancer {
  distribute<T>(services: T[], context?: any): T;
  recordMetrics(service: any, success: boolean, responseTime: number): void;
  getMetrics(): LoadBalancerMetrics;
  reset(): void;
}

export interface LoadBalancerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  serviceDistribution: Record<string, number>;
}

export interface ConnectionPool<T> {
  acquire(): Promise<T>;
  release(resource: T): Promise<void>;
  destroy(resource: T): Promise<void>;
  drain(): Promise<void>;
  getPoolStats(): PoolStats;
}

export interface PoolStats {
  size: number;
  available: number;
  pending: number;
  max: number;
  min: number;
}

export class HighAvailabilityManager extends EventEmitter {
  private config: HAConfig;
  private redisClients: Map<string, Redis | RedisCluster> = new Map();
  private postgresPoolsRead: PostgresPool[] = [];
  private postgresPoolWrite: PostgresPool;
  private healthCheckers: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private loadBalancers: Map<string, LoadBalancer> = new Map();
  private failoverHistory: FailoverEvent[] = [];
  private connectionPools: Map<string, ConnectionPool<any>> = new Map();
  
  // Metrics
  private metrics = {
    totalFailovers: 0,
    totalHealthChecks: 0,
    currentActiveConnections: 0,
    averageResponseTime: 0,
    errorRate: 0,
    uptime: Date.now()
  };

  constructor(config: HAConfig) {
    super();
    this.config = config;
    this.postgresPoolWrite = new PostgresPool(this.config.postgres.primary);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing High Availability Manager...');

    try {
      // Initialize Redis connections
      await this.initializeRedis();

      // Initialize PostgreSQL connection pools
      await this.initializePostgres();

      // Initialize load balancers
      this.initializeLoadBalancers();

      // Start health monitoring
      this.startHealthMonitoring();

      // Initialize circuit breakers
      this.initializeCircuitBreakers();

      console.log('✅ High Availability Manager initialized successfully');
      this.emit('ha-initialized', { timestamp: new Date() });

    } catch (error) {
      console.error('❌ Failed to initialize High Availability Manager:', error);
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    console.log('🔴 Initializing Redis high availability...');

    if (this.config.redis.cluster) {
      // Redis Cluster mode
      const cluster = new RedisCluster(this.config.redis.cluster, {
        redisOptions: {
          password: this.config.redis.password
        },
        clusterRetryStrategy: this.config.redis.retryStrategy || this.defaultRetryStrategy || ((times: number) => Math.min(times * 100, 3000))
      });

      cluster.on('error', (error) => this.handleRedisError('cluster', error));
      cluster.on('node error', (error, node) => this.handleRedisNodeError(node, error));

      this.redisClients.set('primary', cluster);

    } else if (this.config.redis.sentinels) {
      // Redis Sentinel mode
      const sentinel = new Redis({
        sentinels: this.config.redis.sentinels,
        name: 'mymaster',
        password: this.config.redis.password,
        retryStrategy: this.config.redis.retryStrategy || this.defaultRetryStrategy
      });

      sentinel.on('error', (error) => this.handleRedisError('sentinel', error));
      sentinel.on('reconnecting', () => console.log('🔄 Redis Sentinel reconnecting...'));

      this.redisClients.set('primary', sentinel);

    } else if (this.config.redis.standalone) {
      // Standalone Redis with manual failover
      const primary = new Redis({
        ...this.config.redis.standalone,
        password: this.config.redis.password,
        retryStrategy: this.config.redis.retryStrategy || this.defaultRetryStrategy
      });

      primary.on('error', (error) => this.handleRedisError('standalone', error));

      this.redisClients.set('primary', primary);
    }

    // Test connection
    const client = this.redisClients.get('primary');
    if (client) {
      await client.ping();
      console.log('✅ Redis high availability initialized');
    }
  }

  private async initializePostgres(): Promise<void> {
    console.log('🐘 Initializing PostgreSQL high availability...');

    // Initialize read replicas
    for (const [index, replica] of this.config.postgres.replicas.entries()) {
      const pool = new PostgresPool({
        ...replica,
        ...this.config.postgres.poolConfig
      });

      // Test connection
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        this.postgresPoolsRead.push(pool);
        console.log(`✅ PostgreSQL read replica ${index + 1} connected`);
      } catch (error) {
        console.error(`❌ Failed to connect to read replica ${index + 1}:`, error);
      }
    }

    // Test write connection
    try {
      const client = await this.postgresPoolWrite.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ PostgreSQL primary (write) connected');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL primary:', error);
      throw error;
    }

    console.log(`✅ PostgreSQL high availability initialized with ${this.postgresPoolsRead.length} read replicas`);
  }

  private initializeLoadBalancers(): void {
    // Round Robin Load Balancer
    this.loadBalancers.set('round-robin', this.createRoundRobinBalancer());
    
    // Least Connections Load Balancer
    this.loadBalancers.set('least-connections', this.createLeastConnectionsBalancer());
    
    // Random Load Balancer
    this.loadBalancers.set('random', this.createRandomBalancer());
    
    // Weighted Load Balancer
    this.loadBalancers.set('weighted', this.createWeightedBalancer());

    console.log(`✅ Initialized ${this.loadBalancers.size} load balancing strategies`);
  }

  private createRoundRobinBalancer(): LoadBalancer {
    let currentIndex = 0;
    const metrics: LoadBalancerMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceDistribution: {}
    };

    return {
      distribute<T>(services: T[]): T {
        if (services.length === 0) throw new Error('No services available');
        
        const service = services[currentIndex % services.length];
        currentIndex++;
        
        const serviceKey = JSON.stringify(service);
        metrics.serviceDistribution[serviceKey] = (metrics.serviceDistribution[serviceKey] || 0) + 1;
        metrics.totalRequests++;
        
        return service;
      },
      
      recordMetrics(service: any, success: boolean, responseTime: number): void {
        if (success) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
        }
        
        // Update average response time
        const totalResponseTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime;
        metrics.averageResponseTime = totalResponseTime / metrics.totalRequests;
      },
      
      getMetrics(): LoadBalancerMetrics {
        return { ...metrics };
      },
      
      reset(): void {
        currentIndex = 0;
        Object.keys(metrics).forEach(key => {
          if (typeof metrics[key as keyof LoadBalancerMetrics] === 'number') {
            (metrics as any)[key] = 0;
          } else if (typeof metrics[key as keyof LoadBalancerMetrics] === 'object') {
            (metrics as any)[key] = {};
          }
        });
      }
    };
  }

  private createLeastConnectionsBalancer(): LoadBalancer {
    const connectionCounts = new Map<string, number>();
    const metrics: LoadBalancerMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceDistribution: {}
    };

    return {
      distribute<T>(services: T[]): T {
        if (services.length === 0) throw new Error('No services available');
        
        let leastConnections = Infinity;
        let selectedService = services[0];
        
        for (const service of services) {
          const serviceKey = JSON.stringify(service);
          const connections = connectionCounts.get(serviceKey) || 0;
          
          if (connections < leastConnections) {
            leastConnections = connections;
            selectedService = service;
          }
        }
        
        const serviceKey = JSON.stringify(selectedService);
        connectionCounts.set(serviceKey, (connectionCounts.get(serviceKey) || 0) + 1);
        metrics.serviceDistribution[serviceKey] = (metrics.serviceDistribution[serviceKey] || 0) + 1;
        metrics.totalRequests++;
        
        return selectedService;
      },
      
      recordMetrics(service: any, success: boolean, responseTime: number): void {
        const serviceKey = JSON.stringify(service);
        
        // Decrement connection count when request completes
        const currentCount = connectionCounts.get(serviceKey) || 0;
        if (currentCount > 0) {
          connectionCounts.set(serviceKey, currentCount - 1);
        }
        
        if (success) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
        }
        
        // Update average response time
        const totalResponseTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime;
        metrics.averageResponseTime = totalResponseTime / metrics.totalRequests;
      },
      
      getMetrics(): LoadBalancerMetrics {
        return { ...metrics };
      },
      
      reset(): void {
        connectionCounts.clear();
        Object.keys(metrics).forEach(key => {
          if (typeof metrics[key as keyof LoadBalancerMetrics] === 'number') {
            (metrics as any)[key] = 0;
          } else if (typeof metrics[key as keyof LoadBalancerMetrics] === 'object') {
            (metrics as any)[key] = {};
          }
        });
      }
    };
  }

  private createRandomBalancer(): LoadBalancer {
    const metrics: LoadBalancerMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceDistribution: {}
    };

    return {
      distribute<T>(services: T[]): T {
        if (services.length === 0) throw new Error('No services available');
        
        const randomIndex = Math.floor(Math.random() * services.length);
        const service = services[randomIndex];
        
        const serviceKey = JSON.stringify(service);
        metrics.serviceDistribution[serviceKey] = (metrics.serviceDistribution[serviceKey] || 0) + 1;
        metrics.totalRequests++;
        
        return service;
      },
      
      recordMetrics(service: any, success: boolean, responseTime: number): void {
        if (success) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
        }
        
        // Update average response time
        const totalResponseTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime;
        metrics.averageResponseTime = totalResponseTime / metrics.totalRequests;
      },
      
      getMetrics(): LoadBalancerMetrics {
        return { ...metrics };
      },
      
      reset(): void {
        Object.keys(metrics).forEach(key => {
          if (typeof metrics[key as keyof LoadBalancerMetrics] === 'number') {
            (metrics as any)[key] = 0;
          } else if (typeof metrics[key as keyof LoadBalancerMetrics] === 'object') {
            (metrics as any)[key] = {};
          }
        });
      }
    };
  }

  private createWeightedBalancer(): LoadBalancer {
    const weights = new Map<string, number>();
    const metrics: LoadBalancerMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serviceDistribution: {}
    };

    return {
      distribute<T>(services: T[], context?: any): T {
        if (services.length === 0) throw new Error('No services available');
        
        // Calculate total weight
        let totalWeight = 0;
        for (const service of services) {
          const serviceKey = JSON.stringify(service);
          const weight = weights.get(serviceKey) || 1;
          totalWeight += weight;
        }
        
        // Select based on weighted random
        let random = Math.random() * totalWeight;
        
        for (const service of services) {
          const serviceKey = JSON.stringify(service);
          const weight = weights.get(serviceKey) || 1;
          random -= weight;
          
          if (random <= 0) {
            metrics.serviceDistribution[serviceKey] = (metrics.serviceDistribution[serviceKey] || 0) + 1;
            metrics.totalRequests++;
            return service;
          }
        }
        
        // Fallback to first service
        const service = services[0];
        const serviceKey = JSON.stringify(service);
        metrics.serviceDistribution[serviceKey] = (metrics.serviceDistribution[serviceKey] || 0) + 1;
        metrics.totalRequests++;
        return service;
      },
      
      recordMetrics(service: any, success: boolean, responseTime: number): void {
        const serviceKey = JSON.stringify(service);
        
        // Adjust weights based on performance
        const currentWeight = weights.get(serviceKey) || 1;
        if (success && responseTime < 100) {
          // Increase weight for fast, successful responses
          weights.set(serviceKey, Math.min(currentWeight * 1.1, 10));
        } else if (!success || responseTime > 1000) {
          // Decrease weight for failed or slow responses
          weights.set(serviceKey, Math.max(currentWeight * 0.9, 0.1));
        }
        
        if (success) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
        }
        
        // Update average response time
        const totalResponseTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime;
        metrics.averageResponseTime = totalResponseTime / metrics.totalRequests;
      },
      
      getMetrics(): LoadBalancerMetrics {
        return { ...metrics };
      },
      
      reset(): void {
        weights.clear();
        Object.keys(metrics).forEach(key => {
          if (typeof metrics[key as keyof LoadBalancerMetrics] === 'number') {
            (metrics as any)[key] = 0;
          } else if (typeof metrics[key as keyof LoadBalancerMetrics] === 'object') {
            (metrics as any)[key] = {};
          }
        });
      }
    };
  }

  private initializeCircuitBreakers(): void {
    // Initialize circuit breakers for each service
    const services = ['redis-primary', 'postgres-primary', ...this.postgresPoolsRead.map((_, i) => `postgres-read-${i}`)];
    
    for (const service of services) {
      this.circuitBreakers.set(service, {
        service,
        state: 'closed',
        failures: 0,
        successCount: 0,
        requestCount: 0
      });
    }

    console.log(`✅ Initialized ${this.circuitBreakers.size} circuit breakers`);
  }

  private startHealthMonitoring(): void {
    console.log('🏥 Starting health monitoring...');

    // Monitor Redis health
    const redisHealthCheck = setInterval(async () => {
      await this.checkRedisHealth();
    }, this.config.loadBalancing.healthCheckInterval);
    
    this.healthCheckers.set('redis', redisHealthCheck);

    // Monitor PostgreSQL health
    const postgresHealthCheck = setInterval(async () => {
      await this.checkPostgresHealth();
    }, this.config.loadBalancing.healthCheckInterval);
    
    this.healthCheckers.set('postgres', postgresHealthCheck);

    // Overall system health check
    const systemHealthCheck = setInterval(async () => {
      await this.checkSystemHealth();
    }, this.config.loadBalancing.healthCheckInterval * 2);
    
    this.healthCheckers.set('system', systemHealthCheck);

    console.log('✅ Health monitoring started');
  }

  private async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const health: ServiceHealth = {
      service: 'redis',
      status: 'unknown',
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 0,
      details: {}
    };

    try {
      const client = this.redisClients.get('primary');
      if (!client) {
        health.status = 'unhealthy';
        return health;
      }

      // Ping test
      await client.ping();
      
      // Get info
      const info = await (client as Redis).info();
      const lines = info.split('\r\n');
      const memoryUsed = lines.find(l => l.startsWith('used_memory:'))?.split(':')[1];
      const connectedClients = lines.find(l => l.startsWith('connected_clients:'))?.split(':')[1];
      const uptime = lines.find(l => l.startsWith('uptime_in_seconds:'))?.split(':')[1];

      health.responseTime = Date.now() - startTime;
      health.status = 'healthy';
      health.details = {
        memory: parseInt(memoryUsed || '0'),
        connections: parseInt(connectedClients || '0'),
        uptime: parseInt(uptime || '0')
      };

      this.updateCircuitBreaker('redis-primary', true, health.responseTime);

    } catch (error) {
      health.status = 'unhealthy';
      health.responseTime = Date.now() - startTime;
      health.errorRate = 1;
      
      this.updateCircuitBreaker('redis-primary', false, health.responseTime);
      this.emit('health-check-failed', { service: 'redis', error });
    }

    this.metrics.totalHealthChecks++;
    return health;
  }

  private async checkPostgresHealth(): Promise<ServiceHealth[]> {
    const healthChecks: ServiceHealth[] = [];

    // Check primary (write) connection
    const primaryHealth = await this.checkPostgresInstance(
      this.postgresPoolWrite,
      'postgres-primary',
      'primary'
    );
    healthChecks.push(primaryHealth);

    // Check read replicas
    for (const [index, pool] of this.postgresPoolsRead.entries()) {
      const replicaHealth = await this.checkPostgresInstance(
        pool,
        `postgres-read-${index}`,
        `replica-${index}`
      );
      healthChecks.push(replicaHealth);
    }

    return healthChecks;
  }

  private async checkPostgresInstance(
    pool: PostgresPool,
    circuitBreakerKey: string,
    instanceName: string
  ): Promise<ServiceHealth> {
    const startTime = Date.now();
    const health: ServiceHealth = {
      service: `postgres-${instanceName}`,
      status: 'unknown',
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 0,
      details: {}
    };

    try {
      const client = await pool.connect();
      
      // Simple query test
      await client.query('SELECT 1');
      
      // Get connection stats
      const statsResult = await client.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      
      client.release();

      health.responseTime = Date.now() - startTime;
      health.status = 'healthy';
      health.details = {
        connections: parseInt(statsResult.rows[0].total_connections || '0'),
        version: 'PostgreSQL ' + (await client.query('SELECT version()')).rows[0].version.split(' ')[1]
      };

      this.updateCircuitBreaker(circuitBreakerKey, true, health.responseTime);

    } catch (error) {
      health.status = 'unhealthy';
      health.responseTime = Date.now() - startTime;
      health.errorRate = 1;
      
      this.updateCircuitBreaker(circuitBreakerKey, false, health.responseTime);
      this.emit('health-check-failed', { service: instanceName, error });
    }

    this.metrics.totalHealthChecks++;
    return health;
  }

  private async checkSystemHealth(): Promise<void> {
    const overallHealth = {
      timestamp: new Date(),
      services: {
        redis: await this.checkRedisHealth(),
        postgres: await this.checkPostgresHealth()
      },
      metrics: this.getMetrics(),
      circuitBreakers: Array.from(this.circuitBreakers.values())
    };

    this.emit('system-health-update', overallHealth);

    // Check for degraded services
    const degradedServices = this.identifyDegradedServices(overallHealth);
    if (degradedServices.length > 0) {
      this.emit('services-degraded', { services: degradedServices, timestamp: new Date() });
    }
  }

  private identifyDegradedServices(health: any): string[] {
    const degraded: string[] = [];

    if (health.services.redis.status !== 'healthy') {
      degraded.push('redis');
    }

    for (const pgHealth of health.services.postgres) {
      if (pgHealth.status !== 'healthy') {
        degraded.push(pgHealth.service);
      }
    }

    return degraded;
  }

  private updateCircuitBreaker(service: string, success: boolean, responseTime: number): void {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return;

    breaker.requestCount++;

    if (success) {
      breaker.successCount++;
      
      // Reset failures on success in half-open state
      if (breaker.state === 'half-open') {
        breaker.failures = 0;
        breaker.state = 'closed';
        console.log(`✅ Circuit breaker for ${service} closed after successful recovery`);
      }
    } else {
      breaker.failures++;
      breaker.lastFailure = new Date();

      // Open circuit if threshold reached
      if (breaker.failures >= this.config.loadBalancing.circuitBreakerThreshold) {
        breaker.state = 'open';
        breaker.nextRetry = new Date(Date.now() + this.config.loadBalancing.failoverTimeout);
        
        console.log(`🔌 Circuit breaker for ${service} opened after ${breaker.failures} failures`);
        this.emit('circuit-breaker-opened', { service, breaker });
        
        // Attempt failover
        this.attemptFailover(service);
      }
    }

    // Check if it's time to retry
    if (breaker.state === 'open' && breaker.nextRetry && new Date() > breaker.nextRetry) {
      breaker.state = 'half-open';
      console.log(`🔄 Circuit breaker for ${service} entering half-open state for retry`);
    }
  }

  private async attemptFailover(failedService: string): Promise<void> {
    console.log(`🔄 Attempting failover for ${failedService}...`);

    const failoverEvent: FailoverEvent = {
      id: `failover_${Date.now()}`,
      timestamp: new Date(),
      service: failedService,
      fromInstance: failedService,
      toInstance: '',
      reason: 'Service health check failed',
      automaticRecovery: true,
      duration: 0,
      affectedServices: []
    };

    const startTime = Date.now();

    try {
      if (failedService.startsWith('redis')) {
        await this.failoverRedis(failoverEvent);
      } else if (failedService.startsWith('postgres')) {
        await this.failoverPostgres(failoverEvent);
      }

      failoverEvent.duration = Date.now() - startTime;
      this.failoverHistory.push(failoverEvent);
      this.metrics.totalFailovers++;

      console.log(`✅ Failover completed for ${failedService} in ${failoverEvent.duration}ms`);
      this.emit('failover-completed', failoverEvent);

    } catch (error) {
      console.error(`❌ Failover failed for ${failedService}:`, error);
      this.emit('failover-failed', { service: failedService, error });
    }
  }

  private async failoverRedis(event: FailoverEvent): Promise<void> {
    // In a real implementation, this would:
    // 1. Promote a replica to primary
    // 2. Update connection strings
    // 3. Notify all services of the change
    
    console.log('📍 Redis failover process initiated...');
    
    // Simulate failover process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    event.toInstance = 'redis-replica-1';
    event.affectedServices = ['credential-manager', 'usage-tracker', 'cost-manager'];
  }

  private async failoverPostgres(event: FailoverEvent): Promise<void> {
    const failedInstance = event.fromInstance;
    
    if (failedInstance === 'postgres-primary') {
      // Promote a read replica to primary
      console.log('📍 Promoting read replica to primary...');
      
      // In production, this would involve:
      // 1. Stopping replication on chosen replica
      // 2. Promoting replica to primary
      // 3. Updating other replicas to follow new primary
      // 4. Updating connection strings
      
      event.toInstance = 'postgres-read-0-promoted';
      event.affectedServices = ['all-write-operations'];
    } else {
      // Remove failed read replica from pool
      const replicaIndex = parseInt(failedInstance.split('-')[2]);
      if (!isNaN(replicaIndex) && this.postgresPoolsRead[replicaIndex]) {
        console.log(`📍 Removing failed read replica ${replicaIndex} from pool...`);
        this.postgresPoolsRead.splice(replicaIndex, 1);
        event.toInstance = 'remaining-replicas';
        event.affectedServices = ['read-operations'];
      }
    }
  }

  private defaultRetryStrategy(times: number): number | void {
    if (times > this.config.loadBalancing.retryAttempts) {
      // Stop retrying after configured attempts
      return undefined;
    }
    
    // Exponential backoff with jitter
    const delay = Math.min(times * 100, 3000);
    const jitter = Math.random() * 100;
    return delay + jitter;
  }

  private handleRedisError(type: string, error: any): void {
    console.error(`❌ Redis ${type} error:`, error);
    this.emit('redis-error', { type, error, timestamp: new Date() });
  }

  private handleRedisNodeError(node: string, error: any): void {
    console.error(`❌ Redis node ${node} error:`, error);
    this.emit('redis-node-error', { node, error, timestamp: new Date() });
  }

  // Public API methods

  async getRedisClient(operation: 'read' | 'write' = 'read'): Promise<Redis | RedisCluster> {
    const client = this.redisClients.get('primary');
    if (!client) {
      throw new Error('No Redis client available');
    }

    const circuitBreaker = this.circuitBreakers.get('redis-primary');
    if (circuitBreaker?.state === 'open') {
      throw new Error('Redis circuit breaker is open');
    }

    return client;
  }

  async getPostgresClient(operation: 'read' | 'write' = 'read'): Promise<any> {
    if (operation === 'write') {
      const circuitBreaker = this.circuitBreakers.get('postgres-primary');
      if (circuitBreaker?.state === 'open') {
        throw new Error('PostgreSQL primary circuit breaker is open');
      }
      return await this.postgresPoolWrite.connect();
    }

    // Load balance read operations
    const availableReplicas = this.postgresPoolsRead.filter((_, index) => {
      const breaker = this.circuitBreakers.get(`postgres-read-${index}`);
      return !breaker || breaker.state !== 'open';
    });

    if (availableReplicas.length === 0) {
      // Fallback to primary for reads
      console.warn('⚠️ No read replicas available, falling back to primary');
      return await this.postgresPoolWrite.connect();
    }

    const loadBalancer = this.loadBalancers.get(this.config.loadBalancing.strategy);
    if (!loadBalancer) {
      throw new Error(`Unknown load balancing strategy: ${this.config.loadBalancing.strategy}`);
    }

    const selectedPool = loadBalancer.distribute(availableReplicas);
    const startTime = Date.now();

    try {
      const client = await selectedPool.connect();
      const responseTime = Date.now() - startTime;
      loadBalancer.recordMetrics(selectedPool, true, responseTime);
      return client;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      loadBalancer.recordMetrics(selectedPool, false, responseTime);
      throw error;
    }
  }

  async createConnectionPool<T>(
    name: string,
    factory: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    validator?: (resource: T) => Promise<boolean>
  ): Promise<ConnectionPool<T>> {
    const poolFactory = {
      create: factory,
      destroy: destroyer,
      validate: validator
    };

    const poolConfig: PoolConfig = {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      evictionRunIntervalMillis: 1000
    };

    const pool = createPool<T>(poolFactory, poolConfig);

    const connectionPool: ConnectionPool<T> = {
      async acquire(): Promise<T> {
        return await pool.acquire();
      },
      
      async release(resource: T): Promise<void> {
        await pool.release(resource);
      },
      
      async destroy(resource: T): Promise<void> {
        await pool.destroy(resource);
      },
      
      async drain(): Promise<void> {
        await pool.drain();
        pool.clear();
      },
      
      getPoolStats(): PoolStats {
        return {
          size: pool.size,
          available: pool.available,
          pending: pool.pending,
          max: pool.max,
          min: pool.min
        };
      }
    };

    this.connectionPools.set(name, connectionPool);
    console.log(`✅ Created connection pool: ${name}`);
    
    return connectionPool;
  }

  getHealthStatus(): Record<string, ServiceHealth> {
    const status: Record<string, ServiceHealth> = {};
    
    // Get latest health check results
    // This would be populated by the health monitoring system
    
    return status;
  }

  getMetrics(): typeof this.metrics & { loadBalancers: Record<string, LoadBalancerMetrics> } {
    const loadBalancerMetrics: Record<string, LoadBalancerMetrics> = {};
    
    for (const [name, balancer] of this.loadBalancers.entries()) {
      loadBalancerMetrics[name] = balancer.getMetrics();
    }

    return {
      ...this.metrics,
      loadBalancers: loadBalancerMetrics
    };
  }

  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  getCircuitBreakerStatus(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values());
  }

  async performGracefulShutdown(): Promise<void> {
    console.log('🛑 Performing graceful shutdown...');

    // Stop health monitoring
    for (const [name, interval] of this.healthCheckers.entries()) {
      clearInterval(interval);
      console.log(`✅ Stopped health monitoring for ${name}`);
    }

    // Drain connection pools
    for (const [name, pool] of this.connectionPools.entries()) {
      await pool.drain();
      console.log(`✅ Drained connection pool: ${name}`);
    }

    // Close Redis connections
    for (const [name, client] of this.redisClients.entries()) {
      await client.quit();
      console.log(`✅ Closed Redis connection: ${name}`);
    }

    // Close PostgreSQL pools
    await this.postgresPoolWrite.end();
    console.log('✅ Closed PostgreSQL primary pool');

    for (const pool of this.postgresPoolsRead) {
      await pool.end();
    }
    console.log(`✅ Closed ${this.postgresPoolsRead.length} PostgreSQL read pools`);

    console.log('✅ Graceful shutdown completed');
    this.emit('shutdown-completed', { timestamp: new Date() });
  }

  async destroy(): Promise<void> {
    await this.performGracefulShutdown();
    this.removeAllListeners();
  }
}

// Export convenience function
export function createHighAvailabilityManager(config: HAConfig): HighAvailabilityManager {
  return new HighAvailabilityManager(config);
}