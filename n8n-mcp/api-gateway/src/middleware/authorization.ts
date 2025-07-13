import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authentication';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface AuthorizationRule {
  resource: string;
  action: string;
  conditions?: AuthorizationCondition[];
  effect: 'allow' | 'deny';
  priority?: number;
}

export interface AuthorizationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not_in' | 'greater' | 'less';
  value: any;
}

export interface ResourcePermission {
  resource: string;
  actions: string[];
  conditions?: AuthorizationCondition[];
}

export interface AuthorizationContext {
  userId: string;
  scopes: string[];
  plan: string;
  resource: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export class AuthorizationMiddleware {
  private rules: Map<string, AuthorizationRule[]> = new Map();
  private rolePermissions: Map<string, ResourcePermission[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Default rules for different resources
    const defaultRules: AuthorizationRule[] = [
      // Workflow permissions
      {
        resource: 'workflows',
        action: 'read',
        effect: 'allow',
        conditions: [
          { field: 'scope', operator: 'in', value: ['read', 'write', 'admin'] }
        ]
      },
      {
        resource: 'workflows',
        action: 'write',
        effect: 'allow',
        conditions: [
          { field: 'scope', operator: 'in', value: ['write', 'admin'] }
        ]
      },
      {
        resource: 'workflows',
        action: 'delete',
        effect: 'allow',
        conditions: [
          { field: 'scope', operator: 'equals', value: 'admin' },
          { field: 'owner', operator: 'equals', value: '${userId}' }
        ]
      },
      
      // User data permissions
      {
        resource: 'users',
        action: 'read',
        effect: 'allow',
        conditions: [
          { field: 'userId', operator: 'equals', value: '${userId}' }
        ]
      },
      {
        resource: 'users',
        action: 'write',
        effect: 'allow',
        conditions: [
          { field: 'userId', operator: 'equals', value: '${userId}' }
        ]
      },
      {
        resource: 'users',
        action: 'admin',
        effect: 'allow',
        conditions: [
          { field: 'scope', operator: 'equals', value: 'admin' }
        ]
      },
      
      // API key permissions
      {
        resource: 'api-keys',
        action: 'read',
        effect: 'allow',
        conditions: [
          { field: 'owner', operator: 'equals', value: '${userId}' }
        ]
      },
      {
        resource: 'api-keys',
        action: 'write',
        effect: 'allow',
        conditions: [
          { field: 'owner', operator: 'equals', value: '${userId}' },
          { field: 'plan', operator: 'in', value: ['pro', 'enterprise'] }
        ]
      },
      
      // Analytics permissions
      {
        resource: 'analytics',
        action: 'read',
        effect: 'allow',
        conditions: [
          { field: 'scope', operator: 'in', value: ['analytics', 'admin'] }
        ]
      },
      
      // Admin permissions
      {
        resource: '*',
        action: '*',
        effect: 'allow',
        priority: 1000,
        conditions: [
          { field: 'scope', operator: 'equals', value: 'admin' }
        ]
      }
    ];

    // Group rules by resource
    defaultRules.forEach(rule => {
      if (!this.rules.has(rule.resource)) {
        this.rules.set(rule.resource, []);
      }
      this.rules.get(rule.resource)!.push(rule);
    });

    // Sort rules by priority (higher priority first)
    this.rules.forEach(rules => {
      rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    });
  }

  middleware() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const context = this.buildAuthorizationContext(req);
        const authorized = await this.checkAuthorization(context);

        if (!authorized.allowed) {
          return this.handleAuthorizationFailure(req, res, authorized.reason);
        }

        logger.debug('Authorization successful', {
          userId: context.userId,
          resource: context.resource,
          action: context.action,
          resourceId: context.resourceId
        });

        metrics.recordMetric('authorization', 'success', 1, {
          userId: context.userId,
          resource: context.resource,
          action: context.action
        });

        next();

      } catch (error) {
        logger.error('Authorization middleware error', { error, path: req.path });
        metrics.recordMetric('authorization', 'error', 1, {
          path: req.path,
          error: error.message
        });

        return res.status(500).json({
          error: 'Authorization error',
          message: 'Internal server error'
        });
      }
    };
  }

  private buildAuthorizationContext(req: AuthenticatedRequest): AuthorizationContext {
    const resource = this.extractResource(req.path);
    const action = this.extractAction(req.method, req.path);
    const resourceId = this.extractResourceId(req.path);

    return {
      userId: req.auth!.userId!,
      scopes: req.auth!.scopes || [],
      plan: req.auth!.plan || 'free',
      resource,
      action,
      resourceId,
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers
      }
    };
  }

  private extractResource(path: string): string {
    // Extract resource from path like /api/v1/workflows/123 -> workflows
    const pathParts = path.split('/').filter(part => part.length > 0);
    
    // Skip common prefixes
    let resourceIndex = 0;
    if (pathParts[0] === 'api') resourceIndex++;
    if (pathParts[resourceIndex]?.startsWith('v')) resourceIndex++;
    
    return pathParts[resourceIndex] || 'unknown';
  }

  private extractAction(method: string, path: string): string {
    const upperMethod = method.toUpperCase();
    
    // Map HTTP methods to actions
    switch (upperMethod) {
      case 'GET':
        return 'read';
      case 'POST':
        return path.includes('/execute') ? 'execute' : 'write';
      case 'PUT':
      case 'PATCH':
        return 'write';
      case 'DELETE':
        return 'delete';
      default:
        return 'unknown';
    }
  }

  private extractResourceId(path: string): string | undefined {
    // Extract ID from path like /api/v1/workflows/123 -> 123
    const pathParts = path.split('/').filter(part => part.length > 0);
    
    // Look for UUID or numeric ID patterns
    for (const part of pathParts) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part) ||
          /^\d+$/.test(part)) {
        return part;
      }
    }
    
    return undefined;
  }

  private async checkAuthorization(context: AuthorizationContext): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Get applicable rules for the resource
    const resourceRules = this.rules.get(context.resource) || [];
    const wildcardRules = this.rules.get('*') || [];
    const allRules = [...resourceRules, ...wildcardRules];

    // Check each rule in priority order
    for (const rule of allRules) {
      if (this.ruleMatches(rule, context)) {
        const conditionsMet = await this.evaluateConditions(rule.conditions || [], context);
        
        if (conditionsMet) {
          if (rule.effect === 'allow') {
            return { allowed: true };
          } else {
            return { 
              allowed: false, 
              reason: `Access denied by rule: ${rule.resource}:${rule.action}` 
            };
          }
        }
      }
    }

    // Default deny
    return { 
      allowed: false, 
      reason: `No matching authorization rule found for ${context.resource}:${context.action}` 
    };
  }

  private ruleMatches(rule: AuthorizationRule, context: AuthorizationContext): boolean {
    // Check if resource matches
    if (rule.resource !== '*' && rule.resource !== context.resource) {
      return false;
    }

    // Check if action matches
    if (rule.action !== '*' && rule.action !== context.action) {
      return false;
    }

    return true;
  }

  private async evaluateConditions(
    conditions: AuthorizationCondition[], 
    context: AuthorizationContext
  ): Promise<boolean> {
    // All conditions must be met (AND logic)
    for (const condition of conditions) {
      if (!await this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    
    return true;
  }

  private async evaluateCondition(
    condition: AuthorizationCondition, 
    context: AuthorizationContext
  ): Promise<boolean> {
    const fieldValue = this.getFieldValue(condition.field, context);
    const conditionValue = this.resolveValue(condition.value, context);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(conditionValue);
        }
        return String(fieldValue).includes(String(conditionValue));
      
      case 'matches':
        return new RegExp(conditionValue).test(String(fieldValue));
      
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      
      case 'not_in':
        return !Array.isArray(conditionValue) || !conditionValue.includes(fieldValue);
      
      case 'greater':
        return Number(fieldValue) > Number(conditionValue);
      
      case 'less':
        return Number(fieldValue) < Number(conditionValue);
      
      default:
        logger.warn('Unknown condition operator', { operator: condition.operator });
        return false;
    }
  }

  private getFieldValue(field: string, context: AuthorizationContext): any {
    switch (field) {
      case 'userId':
        return context.userId;
      case 'scope':
        return context.scopes;
      case 'plan':
        return context.plan;
      case 'resource':
        return context.resource;
      case 'action':
        return context.action;
      case 'resourceId':
        return context.resourceId;
      case 'owner':
        // This would typically require a database lookup
        return context.userId; // Simplified for this example
      default:
        // Check metadata
        return context.metadata?.[field];
    }
  }

  private resolveValue(value: any, context: AuthorizationContext): any {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const fieldName = value.slice(2, -1);
      return this.getFieldValue(fieldName, context);
    }
    return value;
  }

  private handleAuthorizationFailure(
    req: AuthenticatedRequest,
    res: Response,
    reason: string
  ): void {
    logger.warn('Authorization failed', {
      userId: req.auth?.userId,
      path: req.path,
      method: req.method,
      reason
    });

    metrics.recordMetric('authorization', 'failed', 1, {
      userId: req.auth?.userId || 'unknown',
      path: req.path,
      method: req.method,
      reason: reason.replace(/\s+/g, '_').toLowerCase()
    });

    res.status(403).json({
      error: 'Forbidden',
      message: reason,
      timestamp: new Date().toISOString(),
      path: req.path
    });
  }

  // Helper method to add custom authorization rule
  addRule(rule: AuthorizationRule): void {
    if (!this.rules.has(rule.resource)) {
      this.rules.set(rule.resource, []);
    }
    
    this.rules.get(rule.resource)!.push(rule);
    
    // Re-sort by priority
    this.rules.get(rule.resource)!.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    logger.info('Authorization rule added', {
      resource: rule.resource,
      action: rule.action,
      effect: rule.effect
    });
  }

  // Helper method to remove authorization rule
  removeRule(resource: string, action: string): boolean {
    const rules = this.rules.get(resource);
    if (!rules) return false;

    const initialLength = rules.length;
    const filteredRules = rules.filter(rule => 
      !(rule.resource === resource && rule.action === action)
    );
    
    this.rules.set(resource, filteredRules);
    
    const removed = filteredRules.length < initialLength;
    if (removed) {
      logger.info('Authorization rule removed', { resource, action });
    }
    
    return removed;
  }

  // Static helper methods for specific authorization checks
  static requireResource(resource: string, action: string = 'read') {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const authMiddleware = new AuthorizationMiddleware();
      const context: AuthorizationContext = {
        userId: req.auth.userId!,
        scopes: req.auth.scopes || [],
        plan: req.auth.plan || 'free',
        resource,
        action,
        resourceId: req.params.id,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          headers: req.headers
        }
      };

      const result = await authMiddleware.checkAuthorization(context);
      
      if (!result.allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: result.reason
        });
      }

      next();
    };
  }

  // Helper method to check if user owns resource
  static requireOwnership(resourceType: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID required' });
      }

      // This would typically involve a database lookup to check ownership
      // For now, we'll implement a simplified check
      const isOwner = await AuthorizationMiddleware.checkResourceOwnership(
        req.auth.userId!,
        resourceType,
        resourceId
      );

      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not own this resource'
        });
      }

      next();
    };
  }

  // Helper method to check resource ownership (would be implemented with actual database)
  private static async checkResourceOwnership(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    // This is a placeholder - in real implementation, this would query the database
    // to check if the user owns the specified resource
    
    logger.debug('Checking resource ownership', { userId, resourceType, resourceId });
    
    // For demonstration, assume user owns resources that contain their userId in the ID
    return resourceId.includes(userId);
  }

  // Helper method for admin-only access
  static requireAdmin() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.auth.scopes?.includes('admin')) {
        logger.warn('Admin access denied', {
          userId: req.auth.userId,
          scopes: req.auth.scopes,
          path: req.path
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin access required'
        });
      }

      next();
    };
  }
}