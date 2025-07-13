import { Redis } from 'ioredis';
import { TokenBucket } from '../algorithms/token-bucket';
import { SlidingWindow } from '../algorithms/sliding-window';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface RateLimitRequest {
  userId?: string;
  apiKey?: string;
  ip: string;
  path: string;
  method: string;
  userAgent?: string;
  origin?: string;
  headers: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface RateLimitResult {
  allowed: boolean;
  policy: string;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  headers: Record<string, string>;
}

export interface RateLimitPolicy {
  name: string;
  algorithm: 'token-bucket' | 'sliding-window' | 'fixed-window' | 'adaptive';
  limit: number;
  window: number; // in seconds
  burst?: number;
  priority?: number;
  conditions?: PolicyCondition[];
  overrides?: PolicyOverride[];
}

export interface PolicyCondition {
  field: string; // 'path', 'method', 'userTier', 'apiKey', etc.
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'greater' | 'less';
  value: any;
}

export interface PolicyOverride {
  condition: PolicyCondition;
  limit?: number;
  window?: number;
  algorithm?: string;
}

export interface UserBehavior {
  errorRate: number;
  avgResponseTime: number;
  burstiness: number;
  consistency: number;
  reputation: number;
}

export interface SystemLoad {
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
}

export class AdvancedRateLimiter {
  private redis: Redis;
  private policies: Map<string, RateLimitPolicy>;
  private tokenBucket: TokenBucket;
  private slidingWindow: SlidingWindow;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });
    
    this.policies = new Map();
    this.tokenBucket = new TokenBucket(this.redis);
    this.slidingWindow = new SlidingWindow(this.redis);
    
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Default policies for different user tiers
    const defaultPolicies: RateLimitPolicy[] = [
      {
        name: 'free-tier',
        algorithm: 'sliding-window',
        limit: 100,
        window: 3600, // 1 hour
        conditions: [
          { field: 'userTier', operator: 'equals', value: 'free' }
        ]
      },
      {
        name: 'pro-tier',
        algorithm: 'token-bucket',
        limit: 1000,
        window: 3600,
        burst: 50,
        conditions: [
          { field: 'userTier', operator: 'equals', value: 'pro' }
        ]
      },
      {
        name: 'enterprise-tier',
        algorithm: 'adaptive',
        limit: 10000,
        window: 3600,
        burst: 500,
        conditions: [
          { field: 'userTier', operator: 'equals', value: 'enterprise' }
        ]
      },
      {
        name: 'api-heavy-endpoints',
        algorithm: 'token-bucket',
        limit: 50,
        window: 60, // 1 minute
        burst: 10,
        priority: 10,
        conditions: [
          { field: 'path', operator: 'in', value: ['/api/workflows/execute', '/api/ai/generate'] }
        ]
      },
      {
        name: 'auth-endpoints',
        algorithm: 'sliding-window',
        limit: 5,
        window: 300, // 5 minutes
        conditions: [
          { field: 'path', operator: 'contains', value: '/auth/' }
        ]
      },
      {
        name: 'anonymous-users',
        algorithm: 'sliding-window',
        limit: 20,
        window: 3600,
        conditions: [
          { field: 'userId', operator: 'equals', value: null }
        ]
      }
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.name, policy);
    });
  }

  async checkRateLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const startTime = Date.now();
    
    try {
      // Get applicable policy
      const policy = this.getApplicablePolicy(request);
      const key = this.generateKey(request, policy);
      
      // Apply rate limiting based on algorithm
      let result: any;
      switch (policy.algorithm) {
        case 'token-bucket':
          result = await this.tokenBucketCheck(key, policy);
          break;
        case 'sliding-window':
          result = await this.slidingWindowCheck(key, policy);
          break;
        case 'fixed-window':
          result = await this.fixedWindowCheck(key, policy);
          break;
        case 'adaptive':
          result = await this.adaptiveRateLimitCheck(key, policy, request);
          break;
        default:
          throw new Error(`Unknown rate limit algorithm: ${policy.algorithm}`);
      }
      
      // Create standardized response
      const rateLimitResult: RateLimitResult = {
        allowed: result.allowed,
        policy: policy.name,
        limit: policy.limit,
        remaining: result.tokensRemaining || result.remainingRequests || 0,
        resetTime: result.resetTime || new Date(Date.now() + (policy.window * 1000)),
        retryAfter: result.retryAfter,
        headers: this.generateHeaders(result, policy)
      };

      // Record metrics
      const duration = Date.now() - startTime;
      metrics.recordMetric('rateLimit', 'checkDuration', duration, {
        policy: policy.name,
        algorithm: policy.algorithm,
        allowed: result.allowed.toString()
      });

      // Log rate limit events
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          policy: policy.name,
          key,
          userId: request.userId,
          ip: request.ip,
          path: request.path,
          remaining: rateLimitResult.remaining
        });
        
        metrics.recordMetric('rateLimit', 'blocked', 1, {
          policy: policy.name,
          userId: request.userId || 'anonymous',
          path: request.path
        });
      }

      return rateLimitResult;

    } catch (error) {
      logger.error('Rate limit check failed', { error, request });
      
      // Fail open for availability
      return {
        allowed: true,
        policy: 'fallback',
        limit: 1000,
        remaining: 999,
        resetTime: new Date(Date.now() + 3600000),
        headers: {}
      };
    }
  }

  private getApplicablePolicy(request: RateLimitRequest): RateLimitPolicy {
    // Sort policies by priority (higher priority first)
    const sortedPolicies = Array.from(this.policies.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Find first matching policy
    for (const policy of sortedPolicies) {
      if (this.evaluatePolicyConditions(policy, request)) {
        // Check for overrides
        const override = this.checkPolicyOverrides(policy, request);
        if (override) {
          return { ...policy, ...override };
        }
        return policy;
      }
    }

    // Default fallback policy
    return {
      name: 'default',
      algorithm: 'sliding-window',
      limit: 100,
      window: 3600
    };
  }

  private evaluatePolicyConditions(policy: RateLimitPolicy, request: RateLimitRequest): boolean {
    if (!policy.conditions || policy.conditions.length === 0) {
      return true;
    }

    return policy.conditions.every(condition => {
      const fieldValue = this.getFieldValue(request, condition.field);
      return this.evaluateCondition(fieldValue, condition);
    });
  }

  private getFieldValue(request: RateLimitRequest, field: string): any {
    switch (field) {
      case 'userId': return request.userId;
      case 'apiKey': return request.apiKey;
      case 'ip': return request.ip;
      case 'path': return request.path;
      case 'method': return request.method;
      case 'userAgent': return request.userAgent;
      case 'origin': return request.origin;
      case 'userTier': return request.metadata?.userTier;
      default:
        if (field.startsWith('header.')) {
          const headerName = field.substring(7);
          return request.headers[headerName];
        }
        return request.metadata?.[field];
    }
  }

  private evaluateCondition(value: any, condition: PolicyCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);
      case 'matches':
        return typeof value === 'string' && new RegExp(condition.value).test(value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'greater':
        return typeof value === 'number' && value > condition.value;
      case 'less':
        return typeof value === 'number' && value < condition.value;
      default:
        return false;
    }
  }

  private checkPolicyOverrides(policy: RateLimitPolicy, request: RateLimitRequest): Partial<RateLimitPolicy> | null {
    if (!policy.overrides) return null;

    for (const override of policy.overrides) {
      const fieldValue = this.getFieldValue(request, override.condition.field);
      if (this.evaluateCondition(fieldValue, override.condition)) {
        return {
          limit: override.limit,
          window: override.window,
          algorithm: override.algorithm as any
        };
      }
    }

    return null;
  }

  private generateKey(request: RateLimitRequest, policy: RateLimitPolicy): string {
    const parts = [policy.name];
    
    // Add user identifier
    if (request.userId) {
      parts.push(`user:${request.userId}`);
    } else if (request.apiKey) {
      parts.push(`key:${request.apiKey}`);
    } else {
      parts.push(`ip:${request.ip}`);
    }
    
    // Add additional context for specific policies
    if (policy.name.includes('endpoint')) {
      parts.push(request.path);
    }
    
    return parts.join(':');
  }

  private async tokenBucketCheck(key: string, policy: RateLimitPolicy): Promise<any> {
    return await this.tokenBucket.check(key, {
      capacity: policy.limit,
      refillRate: Math.floor(policy.limit / policy.window),
      refillInterval: 1, // 1 second
      initialTokens: policy.burst || policy.limit
    });
  }

  private async slidingWindowCheck(key: string, policy: RateLimitPolicy): Promise<any> {
    return await this.slidingWindow.check(key, {
      limit: policy.limit,
      windowSize: policy.window,
      precision: 1
    });
  }

  private async fixedWindowCheck(key: string, policy: RateLimitPolicy): Promise<any> {
    const windowKey = `fw:${key}`;
    const now = Date.now();
    const windowStart = Math.floor(now / (policy.window * 1000)) * (policy.window * 1000);
    const windowEnd = windowStart + (policy.window * 1000);
    
    try {
      const script = `
        local windowKey = KEYS[1]
        local windowStart = ARGV[1]
        local limit = tonumber(ARGV[2])
        local ttl = tonumber(ARGV[3])
        
        local current = redis.call('GET', windowKey)
        if current == false then
          current = 0
        else
          current = tonumber(current)
        end
        
        local allowed = current < limit
        
        if allowed then
          current = redis.call('INCR', windowKey)
          redis.call('EXPIRE', windowKey, ttl)
        end
        
        return {allowed and 1 or 0, current, limit - current}
      `;

      const result = await this.redis.eval(
        script,
        1,
        `${windowKey}:${windowStart}`,
        windowStart.toString(),
        policy.limit.toString(),
        policy.window.toString()
      ) as [number, number, number];

      const [allowed, currentCount, remaining] = result;
      
      return {
        allowed: allowed === 1,
        remainingRequests: remaining,
        resetTime: new Date(windowEnd)
      };
    } catch (error) {
      logger.error('Fixed window check failed', { key, error });
      return { allowed: true, remainingRequests: policy.limit, resetTime: new Date(windowEnd) };
    }
  }

  private async adaptiveRateLimitCheck(
    key: string, 
    policy: RateLimitPolicy, 
    request: RateLimitRequest
  ): Promise<any> {
    // Analyze user behavior
    const userBehavior = await this.analyzeUserBehavior(request.userId || request.ip);
    
    // Get system load
    const systemLoad = await this.getSystemLoad();
    
    // Calculate adaptive limit
    const adjustedLimit = this.calculateAdaptiveLimit(
      policy.limit,
      userBehavior,
      systemLoad
    );
    
    // Apply sliding window with adjusted limit
    const result = await this.slidingWindow.check(key, {
      limit: adjustedLimit,
      windowSize: policy.window,
      precision: 1
    });
    
    // Log adaptive decision
    await this.logAdaptiveDecision({
      userId: request.userId,
      ip: request.ip,
      originalLimit: policy.limit,
      adjustedLimit,
      userBehavior,
      systemLoad,
      allowed: result.allowed
    });
    
    return result;
  }

  private async analyzeUserBehavior(identifier: string): Promise<UserBehavior> {
    try {
      const behaviorKey = `behavior:${identifier}`;
      const data = await this.redis.hmget(
        behaviorKey,
        'errorRate',
        'avgResponseTime',
        'burstiness',
        'consistency',
        'reputation'
      );
      
      return {
        errorRate: parseFloat(data[0]) || 0.05,
        avgResponseTime: parseFloat(data[1]) || 200,
        burstiness: parseFloat(data[2]) || 0.5,
        consistency: parseFloat(data[3]) || 0.8,
        reputation: parseFloat(data[4]) || 0.7
      };
    } catch (error) {
      logger.error('Failed to analyze user behavior', { identifier, error });
      return {
        errorRate: 0.05,
        avgResponseTime: 200,
        burstiness: 0.5,
        consistency: 0.8,
        reputation: 0.7
      };
    }
  }

  private async getSystemLoad(): Promise<SystemLoad> {
    try {
      const loadKey = 'system:load';
      const data = await this.redis.hmget(
        loadKey,
        'cpu',
        'memory',
        'latency',
        'errorRate'
      );
      
      return {
        cpu: parseFloat(data[0]) || 50,
        memory: parseFloat(data[1]) || 60,
        latency: parseFloat(data[2]) || 100,
        errorRate: parseFloat(data[3]) || 0.01
      };
    } catch (error) {
      logger.error('Failed to get system load', { error });
      return {
        cpu: 50,
        memory: 60,
        latency: 100,
        errorRate: 0.01
      };
    }
  }

  private calculateAdaptiveLimit(
    baseLimit: number,
    userBehavior: UserBehavior,
    systemLoad: SystemLoad
  ): number {
    let multiplier = 1;
    
    // User behavior adjustments
    if (userBehavior.errorRate < 0.01) multiplier *= 1.5; // Reward low error rate
    if (userBehavior.errorRate > 0.1) multiplier *= 0.5;  // Penalize high error rate
    
    if (userBehavior.avgResponseTime < 100) multiplier *= 1.2; // Fast responses
    if (userBehavior.avgResponseTime > 500) multiplier *= 0.8;  // Slow responses
    
    if (userBehavior.burstiness > 0.8) multiplier *= 0.7; // Penalize bursty traffic
    if (userBehavior.consistency > 0.9) multiplier *= 1.3; // Reward consistent behavior
    
    // Reputation-based adjustment
    multiplier *= (0.5 + userBehavior.reputation);
    
    // System load adjustments
    if (systemLoad.cpu < 50) multiplier *= 1.2;
    if (systemLoad.cpu > 80) multiplier *= 0.6;
    
    if (systemLoad.errorRate < 0.01) multiplier *= 1.1;
    if (systemLoad.errorRate > 0.05) multiplier *= 0.7;
    
    // Apply bounds
    multiplier = Math.max(0.1, Math.min(3.0, multiplier));
    
    return Math.floor(baseLimit * multiplier);
  }

  private async logAdaptiveDecision(decision: any): Promise<void> {
    try {
      const logKey = `adaptive:log:${Date.now()}`;
      await this.redis.setex(logKey, 3600, JSON.stringify(decision));
      
      logger.info('Adaptive rate limit decision', decision);
      
      metrics.recordMetric('rateLimit', 'adaptiveDecision', 1, {
        userId: decision.userId || 'anonymous',
        originalLimit: decision.originalLimit.toString(),
        adjustedLimit: decision.adjustedLimit.toString(),
        allowed: decision.allowed.toString()
      });
    } catch (error) {
      logger.error('Failed to log adaptive decision', { error });
    }
  }

  private generateHeaders(result: any, policy: RateLimitPolicy): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Policy': policy.name,
      'X-RateLimit-Limit': policy.limit.toString(),
      'X-RateLimit-Remaining': (result.tokensRemaining || result.remainingRequests || 0).toString(),
      'X-RateLimit-Reset': result.resetTime ? Math.floor(result.resetTime.getTime() / 1000).toString() : '',
      'X-RateLimit-Algorithm': policy.algorithm
    };
    
    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString();
    }
    
    return headers;
  }

  async addPolicy(policy: RateLimitPolicy): Promise<void> {
    this.policies.set(policy.name, policy);
    logger.info('Rate limit policy added', { policy: policy.name });
  }

  async removePolicy(policyName: string): Promise<void> {
    this.policies.delete(policyName);
    logger.info('Rate limit policy removed', { policy: policyName });
  }

  async updateSystemLoad(load: Partial<SystemLoad>): Promise<void> {
    try {
      const loadKey = 'system:load';
      const updates: string[] = [];
      
      Object.entries(load).forEach(([key, value]) => {
        updates.push(key, value.toString());
      });
      
      if (updates.length > 0) {
        await this.redis.hmset(loadKey, ...updates);
        await this.redis.expire(loadKey, 300); // 5 minute TTL
      }
    } catch (error) {
      logger.error('Failed to update system load', { error });
    }
  }

  async updateUserBehavior(identifier: string, behavior: Partial<UserBehavior>): Promise<void> {
    try {
      const behaviorKey = `behavior:${identifier}`;
      const updates: string[] = [];
      
      Object.entries(behavior).forEach(([key, value]) => {
        updates.push(key, value.toString());
      });
      
      if (updates.length > 0) {
        await this.redis.hmset(behaviorKey, ...updates);
        await this.redis.expire(behaviorKey, 86400); // 24 hour TTL
      }
    } catch (error) {
      logger.error('Failed to update user behavior', { identifier, error });
    }
  }
}