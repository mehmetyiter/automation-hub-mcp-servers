import { Request, Response, NextFunction } from 'express';

export interface CorsConfig {
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export class CorsMiddleware {
  static create(config: CorsConfig = {}) {
    const defaultConfig: CorsConfig = {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With', 
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-User-Id',
        'X-Request-Time'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining', 
        'X-RateLimit-Reset',
        'X-Total-Count',
        'X-Page-Count'
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 200
    };

    const finalConfig = { ...defaultConfig, ...config };

    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      
      // Set Access-Control-Allow-Origin
      if (finalConfig.origin === true) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      } else if (finalConfig.origin === false) {
        // Don't set origin header
      } else if (typeof finalConfig.origin === 'string') {
        res.header('Access-Control-Allow-Origin', finalConfig.origin);
      } else if (Array.isArray(finalConfig.origin)) {
        if (origin && finalConfig.origin.includes(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
        }
      } else if (typeof finalConfig.origin === 'function') {
        finalConfig.origin(origin, (err, allow) => {
          if (err) {
            return next(err);
          }
          if (allow) {
            res.header('Access-Control-Allow-Origin', origin || '*');
          }
        });
      }

      // Set other CORS headers
      if (finalConfig.credentials) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }

      if (finalConfig.exposedHeaders && finalConfig.exposedHeaders.length > 0) {
        res.header('Access-Control-Expose-Headers', finalConfig.exposedHeaders.join(', '));
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        if (finalConfig.methods && finalConfig.methods.length > 0) {
          res.header('Access-Control-Allow-Methods', finalConfig.methods.join(', '));
        }

        if (finalConfig.allowedHeaders && finalConfig.allowedHeaders.length > 0) {
          res.header('Access-Control-Allow-Headers', finalConfig.allowedHeaders.join(', '));
        }

        if (finalConfig.maxAge) {
          res.header('Access-Control-Max-Age', finalConfig.maxAge.toString());
        }

        if (finalConfig.preflightContinue) {
          return next();
        } else {
          return res.status(finalConfig.optionsSuccessStatus || 204).end();
        }
      }

      next();
    };
  }

  // Predefined CORS configurations
  static readonly CONFIGS = {
    DEVELOPMENT: {
      origin: true,
      credentials: true
    },
    
    PRODUCTION: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
      credentials: true
    },
    
    API_ONLY: {
      origin: false,
      credentials: false,
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ]
    },
    
    STRICT: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 3600 // 1 hour
    }
  };
}