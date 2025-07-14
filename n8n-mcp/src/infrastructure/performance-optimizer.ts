import { EventEmitter } from 'events';
import { Pool as PostgresPool, PoolConfig } from 'pg';
import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';
import { MonitoringService } from '../monitoring/monitoring-service.js';

export interface PerformanceConfig {
  database: {
    connectionPool: {
      min: number;
      max: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
      statementTimeout: number;
      query_timeout: number;
    };
    queryOptimization: {
      enablePreparedStatements: boolean;
      enableQueryCache: boolean;
      queryCacheTTL: number;
      maxQueryCacheSize: number;
      enableParallelQueries: boolean;
      maxParallelQueries: number;
    };
    indexing: {
      autoAnalyze: boolean;
      analyzeThreshold: number;
      vacuumSettings: {
        autoVacuum: boolean;
        vacuumThreshold: number;
        analyzeThreshold: number;
      };
    };
  };
  cache: {
    redis: {
      enablePipelining: boolean;
      enableClustering: boolean;
      maxRetries: number;
      retryDelay: number;
      commandTimeout: number;
      enableOfflineQueue: boolean;
      maxRetriesPerRequest: number;
    };
    memory: {
      maxSize: number;
      ttl: number;
      updateAgeOnGet: boolean;
      staleWhileRevalidate: boolean;
      sizeCalculation?: (value: any, key: string) => number;
    };
    strategies: {
      credentialsCacheTTL: number;
      validationCacheTTL: number;
      costDataCacheTTL: number;
      userDataCacheTTL: number;
    };
  };
  optimization: {
    enableAutoTuning: boolean;
    monitoringInterval: number;
    performanceThresholds: {
      maxQueryTime: number;
      minCacheHitRate: number;
      maxConnectionWaitTime: number;
      maxMemoryUsage: number;
    };
    batchProcessing: {
      enableBatching: boolean;
      batchSize: number;
      batchTimeout: number;
      maxConcurrentBatches: number;
    };
  };
}

export interface PerformanceMetrics {
  database: {
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    averageQueryTime: number;
    slowQueries: number;
    preparedStatementHitRate: number;
    indexHitRate: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    memoryUsage: number;
    redisLatency: number;
    keyCount: number;
  };
  overall: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    saturation: number;
  };
}

export interface QueryOptimization {
  query: string;
  executionTime: number;
  optimizedQuery?: string;
  indexSuggestions: string[];
  optimizationTips: string[];
  estimatedImprovement: number;
}

export interface CacheStrategy {
  key: string;
  ttl: number;
  priority: 'high' | 'medium' | 'low';
  invalidationTriggers: string[];
  compressionEnabled: boolean;
  warmupOnStartup: boolean;
}

export class PerformanceOptimizer extends EventEmitter {
  private config: PerformanceConfig;
  private postgresPool: PostgresPool;
  private redisClient: Redis;
  private memoryCache: LRUCache<string, any>;
  private monitoringService?: MonitoringService;
  
  // Performance tracking
  private queryStats = new Map<string, { count: number; totalTime: number; errors: number }>();
  private cacheStats = { hits: 0, misses: 0, evictions: 0 };
  private preparedStatements = new Map<string, string>();
  private slowQueryLog: Array<{ query: string; time: number; timestamp: Date }> = [];
  
  // Auto-tuning
  private autoTuningInterval?: NodeJS.Timeout;
  private performanceHistory: PerformanceMetrics[] = [];
  private optimizationSuggestions: QueryOptimization[] = [];

  constructor(config: PerformanceConfig, postgresPool: PostgresPool, redisClient: Redis) {
    super();
    this.config = config;
    this.postgresPool = postgresPool;
    this.redisClient = redisClient;
    
    // Initialize memory cache
    this.memoryCache = new LRUCache({
      max: config.cache.memory.maxSize,
      ttl: config.cache.memory.ttl,
      updateAgeOnGet: config.cache.memory.updateAgeOnGet,
      sizeCalculation: config.cache.memory.sizeCalculation,
      dispose: (value, key) => {
        this.cacheStats.evictions++;
        this.emit('cache-eviction', { key, value });
      }
    });
  }

  async initialize(monitoringService?: MonitoringService): Promise<void> {
    console.log('🚀 Initializing Performance Optimizer...');

    try {
      this.monitoringService = monitoringService;

      // Setup database optimizations
      await this.optimizeDatabase();

      // Setup cache optimizations
      await this.optimizeCache();

      // Start auto-tuning if enabled
      if (this.config.optimization.enableAutoTuning) {
        this.startAutoTuning();
      }

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      console.log('✅ Performance Optimizer initialized');
      this.emit('optimizer-initialized', { timestamp: new Date() });

    } catch (error) {
      console.error('❌ Failed to initialize Performance Optimizer:', error);
      throw error;
    }
  }

  // Database Optimization Methods

  private async optimizeDatabase(): Promise<void> {
    console.log('🗄️ Optimizing database performance...');

    // Configure connection pool
    await this.configureConnectionPool();

    // Setup prepared statements
    if (this.config.database.queryOptimization.enablePreparedStatements) {
      await this.setupPreparedStatements();
    }

    // Analyze and optimize indexes
    if (this.config.database.indexing.autoAnalyze) {
      await this.analyzeAndOptimizeIndexes();
    }

    // Configure vacuum settings
    if (this.config.database.indexing.vacuumSettings.autoVacuum) {
      await this.configureAutoVacuum();
    }

    console.log('✅ Database optimization completed');
  }

  private async configureConnectionPool(): Promise<void> {
    // Pool is already created, but we can adjust settings
    const pool = this.postgresPool;
    
    // Set statement timeout for all connections
    pool.on('connect', async (client) => {
      await client.query(`SET statement_timeout = ${this.config.database.connectionPool.statementTimeout}`);
      await client.query(`SET lock_timeout = ${this.config.database.connectionPool.query_timeout}`);
      
      // Enable query timing
      await client.query('SET track_io_timing = ON');
    });

    console.log('✅ Connection pool configured');
  }

  private async setupPreparedStatements(): Promise<void> {
    console.log('📝 Setting up prepared statements...');

    // Common queries that benefit from preparation
    const preparedQueries = {
      getCredential: `
        SELECT encrypted_api_key, key_hash, is_active, validation_status 
        FROM user_credentials 
        WHERE user_id = $1 AND provider = $2 AND is_active = true
      `,
      validateCredential: `
        UPDATE user_credentials 
        SET last_validated_at = NOW(), validation_status = $3 
        WHERE user_id = $1 AND provider = $2
      `,
      trackUsage: `
        INSERT INTO api_usage_events (user_id, provider, tokens, cost, timestamp) 
        VALUES ($1, $2, $3, $4, $5)
      `,
      getUserUsage: `
        SELECT SUM(tokens) as total_tokens, SUM(cost) as total_cost 
        FROM api_usage_events 
        WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
      `,
      getActiveCredentialCount: `
        SELECT COUNT(*) as count 
        FROM user_credentials 
        WHERE is_active = true AND validation_status = 'valid'
      `
    };

    // Prepare statements
    const client = await this.postgresPool.connect();
    try {
      for (const [name, query] of Object.entries(preparedQueries)) {
        await client.query(`PREPARE ${name} AS ${query}`);
        this.preparedStatements.set(name, query);
      }
      console.log(`✅ Prepared ${this.preparedStatements.size} statements`);
    } finally {
      client.release();
    }
  }

  private async analyzeAndOptimizeIndexes(): Promise<void> {
    console.log('🔍 Analyzing and optimizing indexes...');

    const client = await this.postgresPool.connect();
    try {
      // Get index usage statistics
      const indexStats = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan ASC
      `);

      // Identify unused indexes
      const unusedIndexes = indexStats.rows.filter(idx => idx.idx_scan === '0');
      if (unusedIndexes.length > 0) {
        console.log(`⚠️ Found ${unusedIndexes.length} unused indexes`);
        this.emit('unused-indexes', unusedIndexes);
      }

      // Analyze missing indexes (simplified - in production use pg_stat_statements)
      const missingIndexes = await this.detectMissingIndexes(client);
      if (missingIndexes.length > 0) {
        console.log(`💡 Suggested ${missingIndexes.length} new indexes`);
        this.emit('missing-indexes', missingIndexes);
      }

      // Run ANALYZE on key tables
      const tables = ['user_credentials', 'api_usage_events', 'security_events'];
      for (const table of tables) {
        await client.query(`ANALYZE ${table}`);
      }

      console.log('✅ Index analysis completed');

    } finally {
      client.release();
    }
  }

  private async detectMissingIndexes(client: any): Promise<string[]> {
    const suggestions: string[] = [];

    // Check for common query patterns that would benefit from indexes
    const queryPatterns = [
      {
        table: 'api_usage_events',
        columns: ['user_id', 'timestamp'],
        reason: 'Frequent time-range queries by user'
      },
      {
        table: 'api_usage_events',
        columns: ['provider', 'timestamp'],
        reason: 'Provider usage analysis'
      },
      {
        table: 'security_events',
        columns: ['user_id', 'event_type', 'timestamp'],
        reason: 'Security event filtering'
      },
      {
        table: 'user_credentials',
        columns: ['validation_status', 'last_validated_at'],
        reason: 'Credential validation queries'
      }
    ];

    for (const pattern of queryPatterns) {
      const indexName = `idx_${pattern.table}_${pattern.columns.join('_')}`;
      
      // Check if index exists
      const existingIndex = await client.query(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = $1 AND indexname = $2
      `, [pattern.table, indexName]);

      if (existingIndex.rows.length === 0) {
        suggestions.push(
          `CREATE INDEX ${indexName} ON ${pattern.table} (${pattern.columns.join(', ')}) -- ${pattern.reason}`
        );
      }
    }

    return suggestions;
  }

  private async configureAutoVacuum(): Promise<void> {
    const client = await this.postgresPool.connect();
    try {
      // Configure autovacuum for key tables
      const tables = ['user_credentials', 'api_usage_events', 'security_events'];
      
      for (const table of tables) {
        await client.query(`
          ALTER TABLE ${table} SET (
            autovacuum_vacuum_scale_factor = 0.1,
            autovacuum_analyze_scale_factor = 0.05,
            autovacuum_vacuum_threshold = ${this.config.database.indexing.vacuumSettings.vacuumThreshold},
            autovacuum_analyze_threshold = ${this.config.database.indexing.vacuumSettings.analyzeThreshold}
          )
        `);
      }

      console.log('✅ Auto-vacuum configured');
    } finally {
      client.release();
    }
  }

  // Cache Optimization Methods

  private async optimizeCache(): Promise<void> {
    console.log('💾 Optimizing cache performance...');

    // Configure Redis optimizations
    if (this.config.cache.redis.enablePipelining) {
      this.setupRedisPipelining();
    }

    // Setup cache warming
    await this.warmupCache();

    // Configure cache strategies
    this.setupCacheStrategies();

    console.log('✅ Cache optimization completed');
  }

  private setupRedisPipelining(): void {
    // Redis pipelining is handled automatically by ioredis
    // We can configure batch settings
    (this.redisClient as any).options.enableAutoPipelining = true;
    console.log('✅ Redis pipelining enabled');
  }

  private async warmupCache(): Promise<void> {
    console.log('🔥 Warming up cache...');

    try {
      // Warm up frequently accessed data
      const client = await this.postgresPool.connect();
      
      try {
        // Cache active credentials count
        const credCount = await client.query(
          'SELECT COUNT(*) as count FROM user_credentials WHERE is_active = true'
        );
        await this.setCache('stats:active_credentials', credCount.rows[0].count, 300);

        // Cache provider list
        const providers = await client.query(
          'SELECT DISTINCT provider FROM user_credentials WHERE is_active = true'
        );
        await this.setCache('stats:active_providers', providers.rows.map(r => r.provider), 600);

        console.log('✅ Cache warmed up');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Cache warmup failed:', error);
    }
  }

  private setupCacheStrategies(): void {
    // Define caching strategies for different data types
    const strategies: CacheStrategy[] = [
      {
        key: 'credential:*',
        ttl: this.config.cache.strategies.credentialsCacheTTL,
        priority: 'high',
        invalidationTriggers: ['credential_update', 'credential_delete'],
        compressionEnabled: true,
        warmupOnStartup: false
      },
      {
        key: 'validation:*',
        ttl: this.config.cache.strategies.validationCacheTTL,
        priority: 'medium',
        invalidationTriggers: ['validation_complete'],
        compressionEnabled: false,
        warmupOnStartup: false
      },
      {
        key: 'cost:*',
        ttl: this.config.cache.strategies.costDataCacheTTL,
        priority: 'low',
        invalidationTriggers: ['usage_tracked'],
        compressionEnabled: false,
        warmupOnStartup: true
      },
      {
        key: 'user:*',
        ttl: this.config.cache.strategies.userDataCacheTTL,
        priority: 'high',
        invalidationTriggers: ['user_update'],
        compressionEnabled: true,
        warmupOnStartup: false
      }
    ];

    // Store strategies for later use
    this.emit('cache-strategies-configured', strategies);
  }

  // Query Execution Methods

  async executeOptimizedQuery<T>(
    query: string,
    params: any[] = [],
    options: { 
      cache?: boolean; 
      cacheKey?: string; 
      cacheTTL?: number;
      prepared?: string;
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const queryHash = this.hashQuery(query, params);

    try {
      // Check cache first if enabled
      if (options.cache && options.cacheKey) {
        const cached = await this.getCache<T[]>(options.cacheKey);
        if (cached !== null) {
          this.cacheStats.hits++;
          this.updateQueryStats(queryHash, Date.now() - startTime, false);
          return cached;
        }
        this.cacheStats.misses++;
      }

      // Get connection from pool
      const client = await this.postgresPool.connect();
      
      try {
        let result;

        // Use prepared statement if available
        if (options.prepared && this.preparedStatements.has(options.prepared)) {
          result = await client.query(`EXECUTE ${options.prepared}(${params.map((_, i) => `$${i + 1}`).join(', ')})`, params);
        } else {
          result = await client.query(query, params);
        }

        const executionTime = Date.now() - startTime;
        this.updateQueryStats(queryHash, executionTime, false);

        // Check if query is slow
        if (executionTime > this.config.optimization.performanceThresholds.maxQueryTime) {
          this.logSlowQuery(query, executionTime);
        }

        // Cache result if enabled
        if (options.cache && options.cacheKey) {
          await this.setCache(options.cacheKey, result.rows, options.cacheTTL || 300);
        }

        return result.rows;

      } finally {
        client.release();
      }

    } catch (error) {
      this.updateQueryStats(queryHash, Date.now() - startTime, true);
      throw error;
    }
  }

  async executeBatch<T>(
    queries: Array<{ query: string; params: any[]; key?: string }>,
    options: { parallel?: boolean } = {}
  ): Promise<T[][]> {
    if (!this.config.optimization.batchProcessing.enableBatching) {
      // Execute queries sequentially if batching is disabled
      const results: T[][] = [];
      for (const q of queries) {
        const result = await this.executeOptimizedQuery<T>(q.query, q.params);
        results.push(result);
      }
      return results;
    }

    const startTime = Date.now();
    console.log(`🔄 Executing batch of ${queries.length} queries...`);

    if (options.parallel && this.config.database.queryOptimization.enableParallelQueries) {
      // Execute queries in parallel with concurrency limit
      const batchSize = Math.min(
        this.config.optimization.batchProcessing.maxConcurrentBatches,
        queries.length
      );

      const results: T[][] = [];
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(q => this.executeOptimizedQuery<T>(q.query, q.params, { cacheKey: q.key }))
        );
        results.push(...batchResults);
      }

      console.log(`✅ Batch execution completed in ${Date.now() - startTime}ms`);
      return results;

    } else {
      // Execute queries sequentially
      const results: T[][] = [];
      for (const q of queries) {
        const result = await this.executeOptimizedQuery<T>(q.query, q.params, { cacheKey: q.key });
        results.push(result);
      }

      console.log(`✅ Sequential batch execution completed in ${Date.now() - startTime}ms`);
      return results;
    }
  }

  // Cache Methods

  async getCache<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached !== undefined) {
      return memCached as T;
    }

    // Check Redis
    try {
      const value = await this.redisClient.get(key);
      if (value) {
        const parsed = JSON.parse(value);
        // Also store in memory cache for faster access
        this.memoryCache.set(key, parsed);
        return parsed as T;
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
    }

    return null;
  }

  async setCache(key: string, value: any, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.config.cache.memory.ttl;

    // Store in memory cache
    this.memoryCache.set(key, value, { ttl: effectiveTTL * 1000 });

    // Store in Redis
    try {
      await this.redisClient.setex(key, effectiveTTL, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  async invalidateCache(pattern: string): Promise<void> {
    // Invalidate memory cache
    const keys = Array.from(this.memoryCache.keys());
    for (const key of keys) {
      if (typeof key === 'string' && key.match(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate Redis cache
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }

  // Performance Monitoring Methods

  private setupPerformanceMonitoring(): void {
    // Monitor query performance
    setInterval(async () => {
      const metrics = await this.collectPerformanceMetrics();
      this.performanceHistory.push(metrics);
      
      // Keep only recent history
      if (this.performanceHistory.length > 100) {
        this.performanceHistory.shift();
      }

      // Update monitoring service if available
      if (this.monitoringService) {
        this.monitoringService.updateDatabaseMetrics(
          metrics.database.activeConnections,
          metrics.database.averageQueryTime,
          'all'
        );
        this.monitoringService.updateCacheMetrics(metrics.cache.hitRate);
      }

      this.emit('performance-metrics', metrics);
    }, this.config.optimization.monitoringInterval);
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Get database metrics
    const dbMetrics = await this.getDatabaseMetrics();
    
    // Calculate cache metrics
    const totalCacheRequests = this.cacheStats.hits + this.cacheStats.misses;
    const cacheHitRate = totalCacheRequests > 0 ? 
      (this.cacheStats.hits / totalCacheRequests) * 100 : 0;

    return {
      database: dbMetrics,
      cache: {
        hitRate: cacheHitRate,
        missRate: 100 - cacheHitRate,
        evictionRate: this.cacheStats.evictions,
        memoryUsage: this.memoryCache.size,
        redisLatency: await this.getRedisLatency(),
        keyCount: this.memoryCache.size + await this.redisClient.dbsize()
      },
      overall: {
        responseTime: this.calculateAverageResponseTime(),
        throughput: this.calculateThroughput(),
        errorRate: this.calculateErrorRate(),
        saturation: this.calculateSaturation()
      }
    };
  }

  private async getDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    const client = await this.postgresPool.connect();
    try {
      // Get connection stats
      const connStats = await client.query(`
        SELECT 
          numbackends as active,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle,
          (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Client') as waiting
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      // Calculate average query time
      let totalTime = 0;
      let totalQueries = 0;
      for (const stats of this.queryStats.values()) {
        totalTime += stats.totalTime;
        totalQueries += stats.count;
      }
      const avgQueryTime = totalQueries > 0 ? totalTime / totalQueries : 0;

      return {
        activeConnections: parseInt(connStats.rows[0].active),
        idleConnections: parseInt(connStats.rows[0].idle),
        waitingConnections: parseInt(connStats.rows[0].waiting),
        averageQueryTime: avgQueryTime,
        slowQueries: this.slowQueryLog.length,
        preparedStatementHitRate: this.calculatePreparedStatementHitRate(),
        indexHitRate: await this.getIndexHitRate(client)
      };
    } finally {
      client.release();
    }
  }

  private async getIndexHitRate(client: any): Promise<number> {
    const result = await client.query(`
      SELECT 
        sum(idx_blks_hit)::float / nullif(sum(idx_blks_hit + idx_blks_read), 0) * 100 as hit_rate
      FROM pg_statio_user_indexes
    `);
    return parseFloat(result.rows[0]?.hit_rate || '0');
  }

  private async getRedisLatency(): Promise<number> {
    const start = Date.now();
    await this.redisClient.ping();
    return Date.now() - start;
  }

  // Auto-tuning Methods

  private startAutoTuning(): void {
    console.log('🎛️ Starting auto-tuning...');

    this.autoTuningInterval = setInterval(async () => {
      await this.performAutoTuning();
    }, 60000); // Every minute

    // Perform initial tuning
    this.performAutoTuning();
  }

  private async performAutoTuning(): Promise<void> {
    const metrics = await this.collectPerformanceMetrics();

    // Check cache hit rate
    if (metrics.cache.hitRate < this.config.optimization.performanceThresholds.minCacheHitRate) {
      console.log(`⚠️ Low cache hit rate: ${metrics.cache.hitRate.toFixed(2)}%`);
      await this.optimizeCacheStrategy();
    }

    // Check query performance
    if (metrics.database.averageQueryTime > this.config.optimization.performanceThresholds.maxQueryTime) {
      console.log(`⚠️ High average query time: ${metrics.database.averageQueryTime}ms`);
      await this.analyzeSlowQueries();
    }

    // Check connection pool saturation
    const poolSaturation = metrics.database.activeConnections / this.config.database.connectionPool.max;
    if (poolSaturation > 0.8) {
      console.log(`⚠️ Connection pool saturation: ${(poolSaturation * 100).toFixed(2)}%`);
      this.emit('pool-saturation-warning', { saturation: poolSaturation });
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (heapUsagePercent > this.config.optimization.performanceThresholds.maxMemoryUsage) {
      console.log(`⚠️ High memory usage: ${heapUsagePercent.toFixed(2)}%`);
      this.optimizeMemoryUsage();
    }
  }

  private async optimizeCacheStrategy(): Promise<void> {
    // Analyze cache misses and adjust TTLs
    console.log('🔧 Optimizing cache strategy...');

    // Increase TTLs for frequently accessed but often missed keys
    const newStrategies = {
      credentialsCacheTTL: this.config.cache.strategies.credentialsCacheTTL * 1.5,
      validationCacheTTL: this.config.cache.strategies.validationCacheTTL * 1.5,
      costDataCacheTTL: this.config.cache.strategies.costDataCacheTTL * 2,
      userDataCacheTTL: this.config.cache.strategies.userDataCacheTTL * 1.5
    };

    this.config.cache.strategies = newStrategies;
    console.log('✅ Cache strategy optimized');
  }

  private async analyzeSlowQueries(): Promise<void> {
    console.log('🔍 Analyzing slow queries...');

    // Group slow queries by pattern
    const queryPatterns = new Map<string, { count: number; avgTime: number; example: string }>();

    for (const slowQuery of this.slowQueryLog) {
      const pattern = this.extractQueryPattern(slowQuery.query);
      const existing = queryPatterns.get(pattern) || { count: 0, avgTime: 0, example: slowQuery.query };
      
      existing.count++;
      existing.avgTime = (existing.avgTime * (existing.count - 1) + slowQuery.time) / existing.count;
      
      queryPatterns.set(pattern, existing);
    }

    // Generate optimization suggestions
    for (const [pattern, stats] of queryPatterns.entries()) {
      if (stats.count > 5) { // Recurring slow query
        const optimization: QueryOptimization = {
          query: stats.example,
          executionTime: stats.avgTime,
          indexSuggestions: await this.suggestIndexesForQuery(stats.example),
          optimizationTips: this.generateOptimizationTips(pattern),
          estimatedImprovement: 50 // Placeholder
        };
        
        this.optimizationSuggestions.push(optimization);
      }
    }

    this.emit('query-optimizations', this.optimizationSuggestions);
  }

  private optimizeMemoryUsage(): void {
    console.log('🧹 Optimizing memory usage...');

    // Clear old entries from memory cache
    const oldSize = this.memoryCache.size;
    this.memoryCache.purgeStale();
    const cleared = oldSize - this.memoryCache.size;

    if (cleared > 0) {
      console.log(`✅ Cleared ${cleared} stale cache entries`);
    }

    // Clear query stats for old queries
    const now = Date.now();
    for (const [hash, stats] of this.queryStats.entries()) {
      if (stats.count < 10 && (now - stats.totalTime) > 3600000) { // 1 hour old
        this.queryStats.delete(hash);
      }
    }

    // Trim slow query log
    if (this.slowQueryLog.length > 100) {
      this.slowQueryLog = this.slowQueryLog.slice(-100);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('✅ Garbage collection triggered');
    }
  }

  // Utility Methods

  private hashQuery(query: string, params: any[]): string {
    const crypto = require('crypto');
    return crypto.createHash('md5')
      .update(query + JSON.stringify(params))
      .digest('hex');
  }

  private updateQueryStats(hash: string, time: number, error: boolean): void {
    const stats = this.queryStats.get(hash) || { count: 0, totalTime: 0, errors: 0 };
    stats.count++;
    stats.totalTime += time;
    if (error) stats.errors++;
    this.queryStats.set(hash, stats);
  }

  private logSlowQuery(query: string, time: number): void {
    this.slowQueryLog.push({
      query,
      time,
      timestamp: new Date()
    });

    // Keep only recent slow queries
    if (this.slowQueryLog.length > 1000) {
      this.slowQueryLog.shift();
    }

    console.warn(`🐌 Slow query detected (${time}ms): ${query.substring(0, 100)}...`);
  }

  private extractQueryPattern(query: string): string {
    // Remove specific values to identify query patterns
    return query
      .replace(/\$\d+/g, '$?')  // Replace parameter placeholders
      .replace(/'\w+'/g, "'?'") // Replace string literals
      .replace(/\d+/g, '?')     // Replace numbers
      .trim();
  }

  private async suggestIndexesForQuery(query: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Simple pattern matching for WHERE clauses
    const whereMatch = query.match(/WHERE\s+(\w+)\s*=/i);
    if (whereMatch) {
      suggestions.push(`Consider index on column: ${whereMatch[1]}`);
    }

    // JOIN conditions
    const joinMatch = query.match(/JOIN\s+\w+\s+ON\s+\w+\.(\w+)\s*=\s*\w+\.(\w+)/i);
    if (joinMatch) {
      suggestions.push(`Consider indexes on join columns: ${joinMatch[1]}, ${joinMatch[2]}`);
    }

    // ORDER BY columns
    const orderMatch = query.match(/ORDER\s+BY\s+(\w+)/i);
    if (orderMatch) {
      suggestions.push(`Consider index on sort column: ${orderMatch[1]}`);
    }

    return suggestions;
  }

  private generateOptimizationTips(pattern: string): string[] {
    const tips: string[] = [];

    if (pattern.includes('SELECT *')) {
      tips.push('Select only required columns instead of SELECT *');
    }

    if (pattern.includes('NOT IN')) {
      tips.push('Consider using NOT EXISTS instead of NOT IN');
    }

    if (pattern.includes('LIKE')) {
      tips.push('Consider full-text search for text queries');
    }

    if (pattern.includes('COUNT(*)') && pattern.includes('JOIN')) {
      tips.push('Consider maintaining a counter cache for complex counts');
    }

    return tips;
  }

  private calculatePreparedStatementHitRate(): number {
    // This would track actual prepared statement usage
    // For now, return a placeholder
    return 85;
  }

  private calculateAverageResponseTime(): number {
    if (this.queryStats.size === 0) return 0;
    
    let totalTime = 0;
    let totalCount = 0;
    
    for (const stats of this.queryStats.values()) {
      totalTime += stats.totalTime;
      totalCount += stats.count;
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  private calculateThroughput(): number {
    // Queries per second
    let totalQueries = 0;
    for (const stats of this.queryStats.values()) {
      totalQueries += stats.count;
    }
    
    // Assuming stats are collected over the monitoring interval
    return totalQueries / (this.config.optimization.monitoringInterval / 1000);
  }

  private calculateErrorRate(): number {
    let totalErrors = 0;
    let totalQueries = 0;
    
    for (const stats of this.queryStats.values()) {
      totalErrors += stats.errors;
      totalQueries += stats.count;
    }
    
    return totalQueries > 0 ? (totalErrors / totalQueries) * 100 : 0;
  }

  private calculateSaturation(): number {
    // System saturation based on various factors
    const factors = [
      this.performanceHistory[this.performanceHistory.length - 1]?.database.activeConnections / 
        this.config.database.connectionPool.max,
      this.performanceHistory[this.performanceHistory.length - 1]?.cache.memoryUsage / 
        this.config.cache.memory.maxSize,
      this.calculateErrorRate() / 10 // Error rate contribution
    ];
    
    return Math.min(100, factors.reduce((a, b) => a + b, 0) / factors.length * 100);
  }

  // Public API Methods

  getPerformanceMetrics(): PerformanceMetrics | null {
    return this.performanceHistory[this.performanceHistory.length - 1] || null;
  }

  getOptimizationSuggestions(): QueryOptimization[] {
    return [...this.optimizationSuggestions];
  }

  getSlowQueries(limit: number = 10): typeof this.slowQueryLog {
    return this.slowQueryLog.slice(-limit);
  }

  getCacheStatistics(): typeof this.cacheStats & { memoryUsage: number; redisKeys: Promise<number> } {
    return {
      ...this.cacheStats,
      memoryUsage: this.memoryCache.size,
      redisKeys: this.redisClient.dbsize()
    };
  }

  async optimizeNow(): Promise<void> {
    console.log('⚡ Running immediate optimization...');
    await this.performAutoTuning();
  }

  async destroy(): Promise<void> {
    if (this.autoTuningInterval) {
      clearInterval(this.autoTuningInterval);
    }
    
    this.memoryCache.clear();
    this.removeAllListeners();
    
    console.log('✅ Performance optimizer destroyed');
  }
}

// Export convenience function
export function createPerformanceOptimizer(
  config: PerformanceConfig,
  postgresPool: PostgresPool,
  redisClient: Redis
): PerformanceOptimizer {
  return new PerformanceOptimizer(config, postgresPool, redisClient);
}

// Export default configuration
export const defaultPerformanceConfig: PerformanceConfig = {
  database: {
    connectionPool: {
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statementTimeout: 30000,
      query_timeout: 10000
    },
    queryOptimization: {
      enablePreparedStatements: true,
      enableQueryCache: true,
      queryCacheTTL: 300,
      maxQueryCacheSize: 1000,
      enableParallelQueries: true,
      maxParallelQueries: 5
    },
    indexing: {
      autoAnalyze: true,
      analyzeThreshold: 1000,
      vacuumSettings: {
        autoVacuum: true,
        vacuumThreshold: 1000,
        analyzeThreshold: 500
      }
    }
  },
  cache: {
    redis: {
      enablePipelining: true,
      enableClustering: false,
      maxRetries: 3,
      retryDelay: 100,
      commandTimeout: 5000,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3
    },
    memory: {
      maxSize: 10000,
      ttl: 300000, // 5 minutes
      updateAgeOnGet: true,
      staleWhileRevalidate: true
    },
    strategies: {
      credentialsCacheTTL: 600,    // 10 minutes
      validationCacheTTL: 300,     // 5 minutes
      costDataCacheTTL: 1800,      // 30 minutes
      userDataCacheTTL: 900        // 15 minutes
    }
  },
  optimization: {
    enableAutoTuning: true,
    monitoringInterval: 30000, // 30 seconds
    performanceThresholds: {
      maxQueryTime: 100,        // 100ms
      minCacheHitRate: 80,      // 80%
      maxConnectionWaitTime: 1000, // 1 second
      maxMemoryUsage: 85        // 85%
    },
    batchProcessing: {
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 100,
      maxConcurrentBatches: 3
    }
  }
};