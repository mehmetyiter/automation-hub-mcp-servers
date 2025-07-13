import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { APIKeyManager } from '../gateway/api-key-manager';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface AuthenticatedRequest extends Request {
  auth?: {
    type: 'jwt' | 'api_key' | 'basic';
    userId?: string;
    apiKeyId?: string;
    scopes?: string[];
    plan?: string;
    rateLimit?: any;
  };
}

export interface AuthenticationConfig {
  jwtSecret: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  apiKeyManager: APIKeyManager;
  requireAuth?: boolean;
  allowedMethods?: string[];
  publicPaths?: string[];
}

export class AuthenticationMiddleware {
  private config: AuthenticationConfig;

  constructor(config: AuthenticationConfig) {
    this.config = config;
  }

  middleware() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // Check if path is public
        if (this.isPublicPath(req.path)) {
          return next();
        }

        // Check if authentication is required for this method
        if (this.config.allowedMethods && 
            this.config.allowedMethods.includes(req.method)) {
          return next();
        }

        // Extract authentication info
        const authResult = await this.extractAuthentication(req);
        
        if (!authResult.success) {
          return this.handleAuthFailure(req, res, authResult.error || 'Authentication required');
        }

        // Attach auth info to request
        req.auth = authResult.auth;
        
        // Record successful authentication
        const duration = Date.now() - startTime;
        metrics.recordMetric('auth', 'success', 1, {
          type: authResult.auth!.type,
          userId: authResult.auth!.userId || 'unknown',
          duration: duration.toString()
        });

        logger.debug('Authentication successful', {
          type: authResult.auth!.type,
          userId: authResult.auth!.userId,
          path: req.path,
          method: req.method
        });

        next();
        
      } catch (error) {
        logger.error('Authentication middleware error', { error, path: req.path });
        metrics.recordMetric('auth', 'error', 1, { 
          path: req.path, 
          error: error.message 
        });
        
        return this.handleAuthFailure(req, res, 'Authentication error');
      }
    };
  }

  private async extractAuthentication(req: AuthenticatedRequest): Promise<{
    success: boolean;
    auth?: AuthenticatedRequest['auth'];
    error?: string;
  }> {
    // Try JWT authentication first
    const jwtResult = await this.tryJWTAuthentication(req);
    if (jwtResult.success) {
      return jwtResult;
    }

    // Try API key authentication
    const apiKeyResult = await this.tryAPIKeyAuthentication(req);
    if (apiKeyResult.success) {
      return apiKeyResult;
    }

    // Try basic authentication
    const basicResult = await this.tryBasicAuthentication(req);
    if (basicResult.success) {
      return basicResult;
    }

    return {
      success: false,
      error: 'No valid authentication method found'
    };
  }

  private async tryJWTAuthentication(req: AuthenticatedRequest): Promise<{
    success: boolean;
    auth?: AuthenticatedRequest['auth'];
    error?: string;
  }> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, error: 'No Bearer token found' };
      }

      const token = authHeader.substring(7);
      
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience
      }) as any;

      // Validate token claims
      if (!decoded.sub) {
        return { success: false, error: 'Invalid token: missing subject' };
      }

      return {
        success: true,
        auth: {
          type: 'jwt',
          userId: decoded.sub,
          scopes: decoded.scopes || [],
          plan: decoded.plan || 'free'
        }
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Token expired' };
      } else if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid token' };
      }
      
      return { success: false, error: 'JWT authentication failed' };
    }
  }

  private async tryAPIKeyAuthentication(req: AuthenticatedRequest): Promise<{
    success: boolean;
    auth?: AuthenticatedRequest['auth'];
    error?: string;
  }> {
    try {
      // Check for API key in header
      let apiKey = req.headers['x-api-key'] as string;
      
      // Check for API key in Authorization header
      if (!apiKey) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer sk_')) {
          apiKey = authHeader.substring(7);
        }
      }

      // Check for API key in query parameter (not recommended for production)
      if (!apiKey && req.query.api_key) {
        apiKey = req.query.api_key as string;
      }

      if (!apiKey) {
        return { success: false, error: 'No API key found' };
      }

      // Validate API key
      const validation = await this.config.apiKeyManager.validateAPIKey(apiKey, req);
      
      if (!validation.valid) {
        metrics.recordMetric('auth', 'apiKeyRejected', 1, { 
          reason: validation.reason 
        });
        return { success: false, error: validation.reason };
      }

      return {
        success: true,
        auth: {
          type: 'api_key',
          userId: validation.apiKey!.userId,
          apiKeyId: validation.apiKey!.id,
          scopes: validation.scopes || [],
          plan: validation.apiKey!.metadata.plan,
          rateLimit: validation.rateLimit
        }
      };

    } catch (error) {
      logger.error('API key authentication error', { error });
      return { success: false, error: 'API key authentication failed' };
    }
  }

  private async tryBasicAuthentication(req: AuthenticatedRequest): Promise<{
    success: boolean;
    auth?: AuthenticatedRequest['auth'];
    error?: string;
  }> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return { success: false, error: 'No Basic auth found' };
      }

      const base64Credentials = authHeader.substring(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [username, password] = credentials.split(':');

      if (!username || !password) {
        return { success: false, error: 'Invalid Basic auth format' };
      }

      // For basic auth, we'll treat the username as an API key
      // This is a common pattern for API authentication
      const validation = await this.config.apiKeyManager.validateAPIKey(username, req);
      
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      return {
        success: true,
        auth: {
          type: 'basic',
          userId: validation.apiKey!.userId,
          apiKeyId: validation.apiKey!.id,
          scopes: validation.scopes || [],
          plan: validation.apiKey!.metadata.plan,
          rateLimit: validation.rateLimit
        }
      };

    } catch (error) {
      return { success: false, error: 'Basic authentication failed' };
    }
  }

  private isPublicPath(path: string): boolean {
    if (!this.config.publicPaths) return false;
    
    return this.config.publicPaths.some(publicPath => {
      if (publicPath.endsWith('*')) {
        const prefix = publicPath.slice(0, -1);
        return path.startsWith(prefix);
      }
      return path === publicPath;
    });
  }

  private handleAuthFailure(
    req: AuthenticatedRequest, 
    res: Response, 
    error: string
  ): void {
    const clientIP = this.getClientIP(req);
    
    logger.warn('Authentication failed', {
      path: req.path,
      method: req.method,
      clientIP,
      userAgent: req.headers['user-agent'],
      error
    });

    metrics.recordMetric('auth', 'failed', 1, {
      path: req.path,
      method: req.method,
      error: error.replace(/\s+/g, '_').toLowerCase()
    });

    // Set appropriate headers
    const challengeHeader = this.buildWWWAuthenticateHeader();
    
    res.status(401).json({
      error: 'Unauthorized',
      message: error,
      timestamp: new Date().toISOString(),
      path: req.path
    });

    if (challengeHeader) {
      res.set('WWW-Authenticate', challengeHeader);
    }
  }

  private buildWWWAuthenticateHeader(): string {
    const challenges = [];
    
    // JWT Bearer token challenge
    challenges.push('Bearer realm="API"');
    
    // API Key challenge
    challenges.push('ApiKey realm="API"');
    
    // Basic auth challenge
    challenges.push('Basic realm="API"');
    
    return challenges.join(', ');
  }

  private getClientIP(req: Request): string {
    return req.headers['x-forwarded-for']?.toString().split(',')[0] ||
           req.headers['x-real-ip']?.toString() ||
           req.socket.remoteAddress ||
           'unknown';
  }

  // Helper method to check if user has required scope
  static requireScope(scope: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      if (!req.auth.scopes?.includes(scope)) {
        logger.warn('Insufficient scope', {
          userId: req.auth.userId,
          requiredScope: scope,
          userScopes: req.auth.scopes,
          path: req.path
        });

        metrics.recordMetric('auth', 'insufficientScope', 1, {
          userId: req.auth.userId || 'unknown',
          requiredScope: scope,
          path: req.path
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: `Scope '${scope}' required`,
          requiredScope: scope,
          userScopes: req.auth.scopes
        });
      }

      next();
    };
  }

  // Helper method to check if user has required plan
  static requirePlan(minPlan: 'free' | 'pro' | 'enterprise') {
    const planLevels = { free: 0, pro: 1, enterprise: 2 };
    
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      const userPlanLevel = planLevels[req.auth.plan as keyof typeof planLevels] || 0;
      const requiredPlanLevel = planLevels[minPlan];

      if (userPlanLevel < requiredPlanLevel) {
        logger.warn('Insufficient plan', {
          userId: req.auth.userId,
          userPlan: req.auth.plan,
          requiredPlan: minPlan,
          path: req.path
        });

        metrics.recordMetric('auth', 'insufficientPlan', 1, {
          userId: req.auth.userId || 'unknown',
          userPlan: req.auth.plan || 'unknown',
          requiredPlan: minPlan,
          path: req.path
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: `Plan '${minPlan}' or higher required`,
          userPlan: req.auth.plan,
          requiredPlan: minPlan
        });
      }

      next();
    };
  }

  // Helper method to get authenticated user info
  static getAuthInfo(req: AuthenticatedRequest): AuthenticatedRequest['auth'] | null {
    return req.auth || null;
  }

  // Helper method to check if user is authenticated
  static isAuthenticated(req: AuthenticatedRequest): boolean {
    return !!req.auth;
  }

  // Helper method to get user ID
  static getUserId(req: AuthenticatedRequest): string | null {
    return req.auth?.userId || null;
  }

  // Helper method to check if user has any of the required scopes
  static requireAnyScope(scopes: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      const hasAnyScope = scopes.some(scope => 
        req.auth!.scopes?.includes(scope)
      );

      if (!hasAnyScope) {
        logger.warn('Insufficient scopes', {
          userId: req.auth.userId,
          requiredScopes: scopes,
          userScopes: req.auth.scopes,
          path: req.path
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: `One of the following scopes required: ${scopes.join(', ')}`,
          requiredScopes: scopes,
          userScopes: req.auth.scopes
        });
      }

      next();
    };
  }
}