import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { createHash } from 'crypto';
import { Pool } from 'pg';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  apiKey?: {
    id: string;
    userId: string;
    scopes: string[];
  };
}

export class AuthenticationMiddleware {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  // JWT token authentication
  authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authentication token required'
          }
        });
      }

      const token = authHeader.slice(7);
      const decoded = verify(token, process.env.JWT_SECRET!) as any;
      
      // Get user from database
      const user = await this.db.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (user.rows.length === 0 || !user.rows[0].is_active) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token'
          }
        });
      }

      req.user = user.rows[0];
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_VERIFICATION_FAILED',
          message: 'Token verification failed'
        }
      });
    }
  };

  // API key authentication
  authenticateAPIKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key required'
          }
        });
      }

      // Hash the provided API key
      const keyHash = createHash('sha256').update(apiKey).digest('hex');
      
      // Find and validate API key
      const result = await this.db.query(`
        SELECT ak.*, u.email, u.role 
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.key_hash = $1 AND ak.is_active = true
          AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
      `, [keyHash]);

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key'
          }
        });
      }

      const keyData = result.rows[0];

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit(
        keyData.id,
        keyData.rate_limit,
        keyData.daily_limit
      );

      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded',
            details: {
              resetTime: rateLimitCheck.resetTime,
              remaining: rateLimitCheck.remaining
            }
          }
        });
      }

      // Update last used timestamp and usage count
      await this.db.query(
        'UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE id = $1',
        [keyData.id]
      );

      req.user = {
        id: keyData.user_id,
        email: keyData.email,
        role: keyData.role
      };
      req.apiKey = {
        id: keyData.id,
        userId: keyData.user_id,
        scopes: keyData.scopes
      };

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication service error'
        }
      });
    }
  };

  // Rate limit checker
  private async checkRateLimit(apiKeyId: string, rateLimit: number, dailyLimit: number) {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      // Check minute rate limit
      const minuteCount = await this.db.query(
        'SELECT COUNT(*) FROM api_usage_logs WHERE api_key_id = $1 AND created_at > $2',
        [apiKeyId, oneMinuteAgo]
      );

      // Check daily rate limit
      const dailyCount = await this.db.query(
        'SELECT COUNT(*) FROM api_usage_logs WHERE api_key_id = $1 AND created_at > $2',
        [apiKeyId, oneDayAgo]
      );

      const minuteUsage = parseInt(minuteCount.rows[0].count);
      const dailyUsage = parseInt(dailyCount.rows[0].count);

      if (minuteUsage >= rateLimit) {
        return {
          allowed: false,
          resetTime: new Date(now.getTime() + (60000 - (now.getTime() % 60000))),
          remaining: 0
        };
      }

      if (dailyUsage >= dailyLimit) {
        return {
          allowed: false,
          resetTime: new Date(now.getTime() + (86400000 - (now.getTime() % 86400000))),
          remaining: 0
        };
      }

      return {
        allowed: true,
        remaining: Math.min(rateLimit - minuteUsage, dailyLimit - dailyUsage)
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: 0 };
    }
  }

  // Flexible authentication (JWT or API key)
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const hasJWT = req.headers.authorization?.startsWith('Bearer ');
    const hasAPIKey = req.headers['x-api-key'];

    if (hasJWT) {
      return this.authenticateJWT(req, res, next);
    } else if (hasAPIKey) {
      return this.authenticateAPIKey(req, res, next);
    } else {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_AUTHENTICATION',
          message: 'Authentication required (JWT token or API key)'
        }
      });
    }
  };
}