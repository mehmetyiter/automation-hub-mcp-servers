import { Redis } from 'ioredis';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface SlidingWindowConfig {
  limit: number;
  windowSize: number; // in seconds
  precision?: number; // sub-window precision in seconds (default: 1)
}

export interface SlidingWindowResult {
  allowed: boolean;
  currentCount: number;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

export class SlidingWindow {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redis: Redis, keyPrefix = 'sw') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async check(
    key: string,
    config: SlidingWindowConfig,
    increment = 1
  ): Promise<SlidingWindowResult> {
    const windowKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - (config.windowSize * 1000);
    const precision = (config.precision || 1) * 1000; // convert to milliseconds
    
    try {
      // Lua script for atomic sliding window operation
      const script = `
        local windowKey = KEYS[1]
        local now = tonumber(ARGV[1])
        local windowStart = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local increment = tonumber(ARGV[4])
        local precision = tonumber(ARGV[5])
        local windowSize = tonumber(ARGV[6])
        
        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', windowKey, '-inf', windowStart)
        
        -- Count current requests in window
        local currentCount = redis.call('ZCARD', windowKey)
        
        -- Check if request would exceed limit
        local allowed = (currentCount + increment) <= limit
        
        if allowed then
          -- Add current request with score as timestamp
          -- Use precision to bucket sub-second requests
          local bucketTime = math.floor(now / precision) * precision
          redis.call('ZINCRBY', windowKey, increment, bucketTime)
          currentCount = currentCount + increment
        end
        
        -- Set TTL for cleanup
        redis.call('EXPIRE', windowKey, math.ceil(windowSize) + 1)
        
        -- Calculate retry after if blocked
        local retryAfter = 0
        if not allowed then
          -- Get the oldest request in the window
          local oldest = redis.call('ZRANGE', windowKey, 0, 0, 'WITHSCORES')
          if #oldest > 0 then
            local oldestTime = tonumber(oldest[2])
            retryAfter = math.ceil((oldestTime + (windowSize * 1000) - now) / 1000)
          else
            retryAfter = 1
          end
        end
        
        return {allowed and 1 or 0, currentCount, retryAfter}
      `;

      const result = await this.redis.eval(
        script,
        1,
        windowKey,
        now.toString(),
        windowStart.toString(),
        config.limit.toString(),
        increment.toString(),
        precision.toString(),
        config.windowSize.toString()
      ) as [number, number, number];

      const [allowed, currentCount, retryAfter] = result;
      const remainingRequests = Math.max(0, config.limit - currentCount);
      
      // Record metrics
      metrics.recordMetric('rateLimit', 'slidingWindow', 1, {
        key,
        allowed: allowed === 1 ? 'true' : 'false',
        currentCount: currentCount.toString(),
        remainingRequests: remainingRequests.toString()
      });

      const windowResult: SlidingWindowResult = {
        allowed: allowed === 1,
        currentCount,
        remainingRequests,
        resetTime: new Date(now + (config.windowSize * 1000)),
        retryAfter: retryAfter > 0 ? retryAfter : undefined
      };

      if (!windowResult.allowed) {
        logger.warn('Sliding window rate limit exceeded', {
          key,
          currentCount,
          limit: config.limit,
          retryAfter
        });
      }

      return windowResult;

    } catch (error) {
      logger.error('Sliding window check failed', { key, error });
      
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        currentCount: 0,
        remainingRequests: config.limit,
        resetTime: new Date(now + (config.windowSize * 1000))
      };
    }
  }

  async getWindowState(key: string, windowSize: number): Promise<{
    count: number;
    requests: Array<{timestamp: number, count: number}>;
  } | null> {
    try {
      const windowKey = `${this.keyPrefix}:${key}`;
      const now = Date.now();
      const windowStart = now - (windowSize * 1000);
      
      // Get all requests in the current window
      const requests = await this.redis.zrangebyscore(
        windowKey,
        windowStart,
        now,
        'WITHSCORES'
      );
      
      const requestData: Array<{timestamp: number, count: number}> = [];
      let totalCount = 0;
      
      for (let i = 0; i < requests.length; i += 2) {
        const count = parseInt(requests[i]);
        const timestamp = parseInt(requests[i + 1]);
        
        requestData.push({ timestamp, count });
        totalCount += count;
      }
      
      return {
        count: totalCount,
        requests: requestData
      };
    } catch (error) {
      logger.error('Failed to get window state', { key, error });
      return null;
    }
  }

  async resetWindow(key: string): Promise<void> {
    try {
      const windowKey = `${this.keyPrefix}:${key}`;
      await this.redis.del(windowKey);
      logger.info('Sliding window reset', { key });
    } catch (error) {
      logger.error('Failed to reset window', { key, error });
    }
  }

  async getWindowMetrics(key: string, windowSize: number): Promise<{
    requestRate: number; // requests per second
    peakRate: number;
    averageRate: number;
    requestDistribution: number[]; // requests per second bucket
  } | null> {
    try {
      const state = await this.getWindowState(key, windowSize);
      if (!state) return null;

      // Calculate request rate metrics
      const buckets = new Array(windowSize).fill(0);
      const bucketSize = 1000; // 1 second buckets
      
      state.requests.forEach(req => {
        const bucketIndex = Math.floor((Date.now() - req.timestamp) / bucketSize);
        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
          buckets[buckets.length - 1 - bucketIndex] += req.count;
        }
      });
      
      const totalRequests = state.count;
      const requestRate = totalRequests / windowSize;
      const peakRate = Math.max(...buckets);
      const averageRate = buckets.reduce((sum, count) => sum + count, 0) / buckets.length;
      
      return {
        requestRate,
        peakRate,
        averageRate,
        requestDistribution: buckets
      };
    } catch (error) {
      logger.error('Failed to get window metrics', { key, error });
      return null;
    }
  }

  async analyzePattern(key: string, windowSize: number): Promise<{
    isBursty: boolean;
    burstiness: number; // 0-1 scale
    consistency: number; // 0-1 scale
    trend: 'increasing' | 'decreasing' | 'stable';
  } | null> {
    try {
      const metrics = await this.getWindowMetrics(key, windowSize);
      if (!metrics) return null;

      const distribution = metrics.requestDistribution;
      const average = metrics.averageRate;
      
      // Calculate burstiness (coefficient of variation)
      const variance = distribution.reduce((sum, val) => {
        return sum + Math.pow(val - average, 2);
      }, 0) / distribution.length;
      
      const standardDeviation = Math.sqrt(variance);
      const burstiness = average > 0 ? standardDeviation / average : 0;
      
      // Calculate consistency (inverse of burstiness, normalized)
      const consistency = Math.max(0, 1 - (burstiness / 2));
      
      // Determine trend
      const firstHalf = distribution.slice(0, Math.floor(distribution.length / 2));
      const secondHalf = distribution.slice(Math.floor(distribution.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      let trend: 'increasing' | 'decreasing' | 'stable';
      const changeThreshold = 0.2; // 20% change
      
      if (secondAvg > firstAvg * (1 + changeThreshold)) {
        trend = 'increasing';
      } else if (secondAvg < firstAvg * (1 - changeThreshold)) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }
      
      return {
        isBursty: burstiness > 1.0,
        burstiness: Math.min(1, burstiness),
        consistency,
        trend
      };
    } catch (error) {
      logger.error('Failed to analyze pattern', { key, error });
      return null;
    }
  }
}