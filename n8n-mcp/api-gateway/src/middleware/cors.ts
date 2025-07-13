import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface CORSConfig {
  allowedOrigins?: string[] | string | boolean;
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  dynamicOrigin?: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => void;
}

export class CORSMiddleware {
  private config: CORSConfig;

  constructor(config: CORSConfig = {}) {
    this.config = {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Accept',
        'Accept-Language',
        'Content-Language',
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-API-Key',
        'X-Client-Version',
        'X-Request-ID',
        'User-Agent'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Request-ID',
        'X-Response-Time'
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204,
      ...config
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      
      try {
        // Handle origin
        this.handleOrigin(req, res, origin);
        
        // Handle credentials
        if (this.config.credentials) {
          res.header('Access-Control-Allow-Credentials', 'true');
        }
        
        // Handle methods
        if (this.config.allowedMethods) {
          res.header('Access-Control-Allow-Methods', this.config.allowedMethods.join(', '));
        }
        
        // Handle headers
        if (this.config.allowedHeaders) {
          res.header('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
        }
        
        // Handle exposed headers
        if (this.config.exposedHeaders) {
          res.header('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
        }
        
        // Handle max age for preflight
        if (this.config.maxAge !== undefined) {
          res.header('Access-Control-Max-Age', this.config.maxAge.toString());
        }
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          this.handlePreflight(req, res, next);
          return;
        }
        
        // Log CORS request
        this.logCORSRequest(req, origin);
        
        next();
        
      } catch (error) {
        logger.error('CORS middleware error', { error, origin, path: req.path });
        metrics.recordMetric('cors', 'error', 1, { 
          origin: origin || 'unknown',
          error: error.message 
        });
        
        // Continue with request even if CORS setup fails
        next();
      }
    };
  }

  private handleOrigin(req: Request, res: Response, origin?: string): void {
    if (!origin) {
      // No origin header (same-origin request or non-browser request)
      res.header('Access-Control-Allow-Origin', '*');
      return;
    }

    if (this.config.dynamicOrigin) {
      // Use dynamic origin validation
      this.config.dynamicOrigin(origin, (err, allow) => {
        if (err) {
          logger.error('Dynamic origin validation error', { error: err, origin });
          return;
        }
        
        if (allow) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Vary', 'Origin');
        } else {
          logger.warn('Origin rejected by dynamic validation', { origin });
          metrics.recordMetric('cors', 'originRejected', 1, { origin });
        }
      });
      return;
    }

    // Static origin validation
    if (this.isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else {
      logger.warn('Origin not allowed', { origin, allowedOrigins: this.config.allowedOrigins });
      metrics.recordMetric('cors', 'originBlocked', 1, { origin });
      
      // Don't set CORS headers for disallowed origins
      // This will cause the browser to block the request
    }
  }

  private isOriginAllowed(origin: string): boolean {
    const { allowedOrigins } = this.config;
    
    // Allow all origins
    if (allowedOrigins === true || allowedOrigins === '*') {
      return true;
    }
    
    // Deny all origins
    if (allowedOrigins === false) {
      return false;
    }
    
    // Check specific origin
    if (typeof allowedOrigins === 'string') {
      return origin === allowedOrigins;
    }
    
    // Check against array of allowed origins
    if (Array.isArray(allowedOrigins)) {
      return allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin === '*') {
          return true;
        }
        
        if (allowedOrigin === origin) {
          return true;
        }
        
        // Support wildcard subdomains like *.example.com
        if (allowedOrigin.startsWith('*.')) {
          const domain = allowedOrigin.slice(2);
          return origin.endsWith(domain) && (
            origin === domain || origin.endsWith('.' + domain)
          );
        }
        
        // Support regex patterns
        if (allowedOrigin.startsWith('/') && allowedOrigin.endsWith('/')) {
          const regex = new RegExp(allowedOrigin.slice(1, -1));
          return regex.test(origin);
        }
        
        return false;
      });
    }
    
    return false;
  }

  private handlePreflight(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    const requestedMethod = req.headers['access-control-request-method'];
    const requestedHeaders = req.headers['access-control-request-headers'];
    
    logger.debug('Handling CORS preflight', {
      origin,
      requestedMethod,
      requestedHeaders,
      path: req.path
    });
    
    // Validate requested method
    if (requestedMethod && this.config.allowedMethods) {
      if (!this.config.allowedMethods.includes(requestedMethod.toUpperCase())) {
        logger.warn('Requested method not allowed in preflight', {
          origin,
          requestedMethod,
          allowedMethods: this.config.allowedMethods
        });
        
        metrics.recordMetric('cors', 'preflightMethodRejected', 1, {
          origin: origin || 'unknown',
          method: requestedMethod
        });
        
        return res.status(405).end();
      }
    }
    
    // Validate requested headers
    if (requestedHeaders && this.config.allowedHeaders) {
      const requestedHeadersArray = requestedHeaders
        .split(',')
        .map(header => header.trim().toLowerCase());
      
      const allowedHeadersLower = this.config.allowedHeaders.map(h => h.toLowerCase());
      
      const unauthorizedHeaders = requestedHeadersArray.filter(
        header => !allowedHeadersLower.includes(header)
      );
      
      if (unauthorizedHeaders.length > 0) {
        logger.warn('Requested headers not allowed in preflight', {
          origin,
          unauthorizedHeaders,
          allowedHeaders: this.config.allowedHeaders
        });
        
        metrics.recordMetric('cors', 'preflightHeadersRejected', 1, {
          origin: origin || 'unknown',
          headers: unauthorizedHeaders.join(',')
        });
        
        return res.status(400).end();
      }
    }
    
    // Successful preflight
    metrics.recordMetric('cors', 'preflightSuccess', 1, {
      origin: origin || 'unknown',
      method: requestedMethod || 'unknown'
    });
    
    if (this.config.preflightContinue) {
      next();
    } else {
      res.status(this.config.optionsSuccessStatus || 204).end();
    }
  }

  private logCORSRequest(req: Request, origin?: string): void {
    if (origin) {
      logger.debug('CORS request', {
        origin,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent']
      });
      
      metrics.recordMetric('cors', 'request', 1, {
        origin,
        method: req.method
      });
    }
  }

  // Static helper methods for common CORS configurations
  static permissive(): CORSMiddleware {
    return new CORSMiddleware({
      allowedOrigins: true,
      credentials: true,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['*']
    });
  }

  static restrictive(allowedOrigins: string[]): CORSMiddleware {
    return new CORSMiddleware({
      allowedOrigins,
      credentials: false,
      allowedMethods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });
  }

  static development(): CORSMiddleware {
    return new CORSMiddleware({
      allowedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ],
      credentials: true
    });
  }

  static production(domains: string[]): CORSMiddleware {
    return new CORSMiddleware({
      allowedOrigins: domains,
      credentials: true,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      maxAge: 86400 // 24 hours
    });
  }

  // Method to create dynamic origin validator
  static createDynamicOriginValidator(
    validator: (origin: string) => Promise<boolean>
  ): CORSMiddleware {
    return new CORSMiddleware({
      dynamicOrigin: async (origin, callback) => {
        try {
          const allowed = await validator(origin);
          callback(null, allowed);
        } catch (error) {
          callback(error, false);
        }
      }
    });
  }

  // Method to validate origins against database or external service
  static createDatabaseOriginValidator(
    checkOriginFn: (origin: string) => Promise<boolean>
  ): CORSMiddleware {
    const cache = new Map<string, { allowed: boolean; expires: number }>();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    return new CORSMiddleware({
      dynamicOrigin: async (origin, callback) => {
        try {
          // Check cache first
          const cached = cache.get(origin);
          if (cached && cached.expires > Date.now()) {
            return callback(null, cached.allowed);
          }

          // Check with database/service
          const allowed = await checkOriginFn(origin);
          
          // Cache result
          cache.set(origin, {
            allowed,
            expires: Date.now() + CACHE_DURATION
          });

          callback(null, allowed);
        } catch (error) {
          logger.error('Database origin validation error', { error, origin });
          callback(error, false);
        }
      }
    });
  }

  // Method to add CSP headers along with CORS
  static withCSP(corsConfig: CORSConfig, cspPolicy: string): CORSMiddleware {
    const corsMiddleware = new CORSMiddleware(corsConfig);
    
    return {
      middleware: () => (req: Request, res: Response, next: NextFunction) => {
        // Set CSP header
        res.header('Content-Security-Policy', cspPolicy);
        
        // Apply CORS
        return corsMiddleware.middleware()(req, res, next);
      }
    } as CORSMiddleware;
  }
}