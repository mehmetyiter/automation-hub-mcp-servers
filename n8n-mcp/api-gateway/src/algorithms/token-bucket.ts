import { Redis } from 'ioredis';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number; // tokens per second
  refillInterval: number; // in seconds
  initialTokens?: number;
}

export interface TokenBucketResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfter?: number; // seconds
  resetTime?: Date;
}

export class TokenBucket {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redis: Redis, keyPrefix = 'tb') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async check(
    key: string,
    config: TokenBucketConfig,
    requestTokens = 1
  ): Promise<TokenBucketResult> {
    const bucketKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    
    try {
      // Lua script for atomic token bucket operation
      const script = `
        local bucketKey = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local refillInterval = tonumber(ARGV[3])
        local requestTokens = tonumber(ARGV[4])
        local now = tonumber(ARGV[5])
        local initialTokens = tonumber(ARGV[6])
        
        -- Get current bucket state
        local bucket = redis.call('HMGET', bucketKey, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1])
        local lastRefill = tonumber(bucket[2])
        
        -- Initialize bucket if it doesn't exist
        if tokens == nil then
          tokens = initialTokens or capacity
          lastRefill = now
        end
        
        -- Calculate tokens to add based on time elapsed
        local timePassed = (now - lastRefill) / 1000 -- convert to seconds
        local tokensToAdd = math.floor(timePassed / refillInterval) * refillRate
        
        -- Add tokens but don't exceed capacity
        tokens = math.min(capacity, tokens + tokensToAdd)
        
        -- Update last refill time
        if tokensToAdd > 0 then
          lastRefill = now
        end
        
        -- Check if request can be fulfilled
        local allowed = tokens >= requestTokens
        local retryAfter = 0
        
        if allowed then
          tokens = tokens - requestTokens
        else
          -- Calculate retry after
          local tokensNeeded = requestTokens - tokens
          retryAfter = math.ceil(tokensNeeded / refillRate) * refillInterval
        end
        
        -- Update bucket state
        redis.call('HMSET', bucketKey, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', bucketKey, refillInterval * 10) -- TTL for cleanup
        
        return {allowed and 1 or 0, tokens, retryAfter}
      `;

      const result = await this.redis.eval(
        script,
        1,
        bucketKey,
        config.capacity.toString(),
        config.refillRate.toString(),
        config.refillInterval.toString(),
        requestTokens.toString(),
        now.toString(),
        (config.initialTokens || config.capacity).toString()
      ) as [number, number, number];

      const [allowed, tokensRemaining, retryAfter] = result;
      
      // Record metrics
      metrics.recordMetric('rateLimit', 'tokenBucket', 1, {
        key,
        allowed: allowed === 1 ? 'true' : 'false',
        tokensRemaining: tokensRemaining.toString()
      });

      const bucketResult: TokenBucketResult = {
        allowed: allowed === 1,
        tokensRemaining,
        retryAfter: retryAfter > 0 ? retryAfter : undefined,
        resetTime: new Date(now + (retryAfter * 1000))
      };

      if (!bucketResult.allowed) {
        logger.warn('Token bucket rate limit exceeded', {
          key,
          requestTokens,
          tokensRemaining,
          retryAfter
        });
      }

      return bucketResult;

    } catch (error) {
      logger.error('Token bucket check failed', { key, error });
      
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        tokensRemaining: config.capacity,
        retryAfter: undefined
      };
    }
  }

  async getBucketState(key: string): Promise<{tokens: number, lastRefill: number} | null> {
    try {
      const bucketKey = `${this.keyPrefix}:${key}`;
      const result = await this.redis.hmget(bucketKey, 'tokens', 'lastRefill');
      
      if (result[0] === null || result[1] === null) {
        return null;
      }
      
      return {
        tokens: parseInt(result[0]),
        lastRefill: parseInt(result[1])
      };
    } catch (error) {
      logger.error('Failed to get bucket state', { key, error });
      return null;
    }
  }

  async resetBucket(key: string): Promise<void> {
    try {
      const bucketKey = `${this.keyPrefix}:${key}`;
      await this.redis.del(bucketKey);
      logger.info('Token bucket reset', { key });
    } catch (error) {
      logger.error('Failed to reset bucket', { key, error });
    }
  }

  async getBucketMetrics(key: string): Promise<{
    currentTokens: number;
    capacity: number;
    fillRate: number;
    utilizationRate: number;
  } | null> {
    try {
      const state = await this.getBucketState(key);
      if (!state) return null;

      // Calculate utilization over the last minute
      const utilizationKey = `${this.keyPrefix}:util:${key}`;
      const utilization = await this.redis.get(utilizationKey);
      
      return {
        currentTokens: state.tokens,
        capacity: 0, // Would need to store capacity in Redis
        fillRate: 0, // Would need to store fill rate in Redis
        utilizationRate: utilization ? parseFloat(utilization) : 0
      };
    } catch (error) {
      logger.error('Failed to get bucket metrics', { key, error });
      return null;
    }
  }
}