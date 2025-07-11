import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface RateLimitedRequest extends Request {
  user?: { id: string };
  apiKey?: { id: string };
  ip: string;
}

export interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  identifier?: 'ip' | 'user' | 'apikey';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export class RateLimitingMiddleware {
  private db: Pool;
  
  constructor(db: Pool) {
    this.db = db;
  }

  createRateLimit = (config: RateLimitConfig) => {
    return async (req: RateLimitedRequest, res: Response, next: NextFunction) => {
      try {
        const identifier = this.getIdentifier(req, config.identifier || 'ip');
        const now = new Date();
        const windowStart = new Date(now.getTime() - config.windowSizeMs);

        // Clean up old records
        await this.cleanupOldRecords(identifier, windowStart);

        // Get current count for this window
        const currentCount = await this.getCurrentCount(identifier, windowStart);

        if (currentCount >= config.maxRequests) {
          const resetTime = new Date(now.getTime() + config.windowSizeMs);
          
          res.set({
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toISOString()
          });

          return res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: config.message || 'Too many requests, please try again later',
              details: {
                limit: config.maxRequests,
                windowSizeMs: config.windowSizeMs,
                resetTime: resetTime.toISOString()
              }
            }
          });
        }

        // Record this request
        await this.recordRequest(identifier, now);

        // Set rate limit headers
        const remaining = Math.max(0, config.maxRequests - currentCount - 1);
        const resetTime = new Date(now.getTime() + config.windowSizeMs);
        
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': resetTime.toISOString()
        });

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Continue on error to avoid blocking legitimate requests
        next();
      }
    };
  };

  private getIdentifier(req: RateLimitedRequest, type: 'ip' | 'user' | 'apikey'): string {
    switch (type) {
      case 'user':
        return req.user?.id || req.ip;
      case 'apikey':
        return req.apiKey?.id || req.user?.id || req.ip;
      case 'ip':
      default:
        return req.ip;
    }
  }

  private async getCurrentCount(identifier: string, windowStart: Date): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM rate_limit_buckets 
       WHERE identifier = $1 AND window_start >= $2`,
      [identifier, windowStart]
    );
    
    return parseInt(result.rows[0]?.count || '0');
  }

  private async recordRequest(identifier: string, timestamp: Date): Promise<void> {
    // Use minute-based buckets
    const bucketStart = new Date(timestamp);
    bucketStart.setSeconds(0, 0);
    const bucketEnd = new Date(bucketStart.getTime() + 60000);

    await this.db.query(
      `INSERT INTO rate_limit_buckets (identifier, bucket_type, current_count, max_count, window_start, window_end)
       VALUES ($1, 'minute', 1, 1000, $2, $3)
       ON CONFLICT (identifier, bucket_type, window_start)
       DO UPDATE SET 
         current_count = rate_limit_buckets.current_count + 1,
         updated_at = NOW()`,
      [identifier, bucketStart, bucketEnd]
    );
  }

  private async cleanupOldRecords(identifier: string, cutoffTime: Date): Promise<void> {
    await this.db.query(
      'DELETE FROM rate_limit_buckets WHERE identifier = $1 AND window_end < $2',
      [identifier, cutoffTime]
    );
  }

  // Predefined rate limit configurations
  static readonly CONFIGS = {
    STRICT: {
      windowSizeMs: 60000, // 1 minute
      maxRequests: 60,
      message: 'Rate limit exceeded: maximum 60 requests per minute'
    },
    MODERATE: {
      windowSizeMs: 60000, // 1 minute
      maxRequests: 100,
      message: 'Rate limit exceeded: maximum 100 requests per minute'
    },
    LENIENT: {
      windowSizeMs: 60000, // 1 minute
      maxRequests: 200,
      message: 'Rate limit exceeded: maximum 200 requests per minute'
    },
    API_KEY: {
      windowSizeMs: 60000, // 1 minute
      maxRequests: 1000,
      identifier: 'apikey' as const,
      message: 'API key rate limit exceeded'
    },
    PUBLIC: {
      windowSizeMs: 3600000, // 1 hour
      maxRequests: 1000,
      identifier: 'ip' as const,
      message: 'Public API rate limit exceeded: maximum 1000 requests per hour'
    }
  };
}