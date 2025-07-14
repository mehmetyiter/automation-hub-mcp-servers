import { Request, Response, NextFunction } from 'express';

interface AuthorizedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  apiKey?: {
    scopes: string[];
  };
}

export class AuthorizationMiddleware {
  
  // Check if user has required role
  requireRole = (requiredRoles: string | string[]) => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PRIVILEGES',
            message: 'Insufficient privileges for this operation'
          }
        });
        return;
      }

      next();
    };
  };

  // Check if user owns resource or is admin
  requireOwnershipOrAdmin = (getResourceUserId: (req: Request) => string) => {
    return (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const resourceUserId = getResourceUserId(req);
      
      if (req.user.role === 'admin' || req.user.id === resourceUserId) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this resource'
          }
        });
        return;
      }
    };
  };

  // Check API key scopes
  requireScope = (requiredScopes: string | string[]) => {
    const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
    
    return (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      // If authenticated with JWT, check user role
      if (req.user && !req.apiKey) {
        if (req.user.role === 'admin') {
          return next(); // Admins have all scopes
        }
        
        // For regular users with JWT, allow basic operations
        const allowedForUsers = ['read', 'write'];
        const hasPermission = scopes.every(scope => allowedForUsers.includes(scope));
        
        if (!hasPermission) {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PRIVILEGES',
              message: 'Insufficient privileges for this operation'
            }
          });
          return;
        }
        
        return next();
      }

      // If authenticated with API key, check scopes
      if (req.apiKey) {
        const hasRequiredScopes = scopes.every(scope => 
          req.apiKey!.scopes.includes(scope) || req.apiKey!.scopes.includes('admin')
        );

        if (!hasRequiredScopes) {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_SCOPE',
              message: `Required scope(s): ${scopes.join(', ')}`
            }
          });
          return;
        }

        return next();
      }

      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
      return;
    };
  };
}