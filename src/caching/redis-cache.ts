import Redis from 'ioredis';
import { Logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: string;
}

export class RedisCache {
  private client: Redis;
  private logger: Logger;
  private stats = { hits: 0, misses: 0 };

  constructor(redisUrl: string, logger: Logger) {
    this.client = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    });

    this.logger = logger;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis error:', error);
    });

    this.client.on('ready', () => {
      this.logger.info('Redis ready');
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
  }

  private buildKey(key: string, namespace?: string): string {
    const prefix = namespace || 'n8n-mcp';
    return `${prefix}:${key}`;
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      if (options.serialize !== false) {
        return JSON.parse(value) as T;
      }
      
      return value as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const serializedValue = options.serialize !== false ? 
        JSON.stringify(value) : 
        String(value);
      
      if (options.ttl) {
        await this.client.setex(fullKey, options.ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttl: number, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await this.client.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, namespace?: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key, namespace);
      return await this.client.incr(fullKey);
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  async decrement(key: string, namespace?: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key, namespace);
      return await this.client.decr(fullKey);
    } catch (error) {
      this.logger.error(`Cache decrement error for key ${key}:`, error);
      return 0;
    }
  }

  async getPattern(pattern: string, namespace?: string): Promise<string[]> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      return await this.client.keys(fullPattern);
    } catch (error) {
      this.logger.error(`Cache getPattern error for pattern ${pattern}:`, error);
      return [];
    }
  }

  async delPattern(pattern: string, namespace?: string): Promise<number> {
    try {
      const keys = await this.getPattern(pattern, namespace);
      if (keys.length === 0) return 0;
      
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Cache delPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.client.info('memory');
      const keys = await this.client.dbsize();
      
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys,
        memory
      };
    } catch (error) {
      this.logger.error('Cache getStats error:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0,
        memory: 'unknown'
      };
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      await this.client.flushall();
      this.stats = { hits: 0, misses: 0 };
      return true;
    } catch (error) {
      this.logger.error('Cache flushAll error:', error);
      return false;
    }
  }

  async getMultiple<T>(
    keys: string[], 
    options: CacheOptions = {}
  ): Promise<Record<string, T | null>> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.namespace));
      const values = await this.client.mget(...fullKeys);
      
      const result: Record<string, T | null> = {};
      
      keys.forEach((key, index) => {
        const value = values[index];
        if (value === null) {
          this.stats.misses++;
          result[key] = null;
        } else {
          this.stats.hits++;
          result[key] = options.serialize !== false ? 
            JSON.parse(value) : 
            value as T;
        }
      });
      
      return result;
    } catch (error) {
      this.logger.error('Cache getMultiple error:', error);
      return keys.reduce((acc, key) => {
        acc[key] = null;
        this.stats.misses++;
        return acc;
      }, {} as Record<string, T | null>);
    }
  }

  async setMultiple<T>(
    data: Record<string, T>, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const pipeline = this.client.pipeline();
      
      Object.entries(data).forEach(([key, value]) => {
        const fullKey = this.buildKey(key, options.namespace);
        const serializedValue = options.serialize !== false ? 
          JSON.stringify(value) : 
          String(value);
        
        if (options.ttl) {
          pipeline.setex(fullKey, options.ttl, serializedValue);
        } else {
          pipeline.set(fullKey, serializedValue);
        }
      });
      
      await pipeline.exec();
      return true;
    } catch (error) {
      this.logger.error('Cache setMultiple error:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }

  getClient(): Redis {
    return this.client;
  }
}