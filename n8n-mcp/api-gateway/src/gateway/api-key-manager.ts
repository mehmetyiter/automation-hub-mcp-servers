import crypto from 'crypto';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { KeyRotationService } from './key-rotation-service';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface APIKeyRequest {
  name: string;
  userId: string;
  scopes?: string[];
  plan?: 'free' | 'pro' | 'enterprise';
  expiresAt?: Date;
  rateLimit?: RateLimitConfig;
  ipWhitelist?: string[];
  allowedOrigins?: string[];
  webhookUrl?: string;
  enableRotation?: boolean;
  rotationInterval?: number; // in days
  metadata?: Record<string, any>;
}

export interface APIKey {
  id: string;
  hash: string;
  name: string;
  userId: string;
  scopes: string[];
  rateLimit: RateLimitConfig;
  expiresAt?: Date;
  metadata: APIKeyMetadata;
  key?: string; // Only present on creation
}

export interface APIKeyMetadata {
  created: Date;
  lastUsed?: Date;
  usageCount: number;
  ipWhitelist: string[];
  allowedOrigins: string[];
  webhookUrl?: string;
  plan: string;
  status: 'active' | 'suspended' | 'rotating' | 'expired';
  rotationConfig?: {
    enabled: boolean;
    interval: number; // days
    lastRotation?: Date;
    nextRotation?: Date;
  };
}

export interface RateLimitConfig {
  requests: number;
  window: number; // seconds
  burst?: number;
  algorithm?: 'token-bucket' | 'sliding-window' | 'fixed-window';
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  apiKey?: APIKey;
  rateLimit?: RateLimitConfig;
  scopes?: string[];
}

export interface KeyStore {
  save(apiKey: APIKey): Promise<void>;
  findByHash(hash: string): Promise<APIKey | null>;
  findById(id: string): Promise<APIKey | null>;
  findByUserId(userId: string): Promise<APIKey[]>;
  update(id: string, updates: Partial<APIKey>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  list(filters?: KeyListFilters): Promise<APIKey[]>;
}

export interface KeyListFilters {
  userId?: string;
  status?: string;
  plan?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export class DatabaseKeyStore implements KeyStore {
  constructor(private db: Pool) {}

  async save(apiKey: APIKey): Promise<void> {
    const query = `
      INSERT INTO api_keys (
        id, hash, name, user_id, scopes, rate_limit, 
        expires_at, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        hash = EXCLUDED.hash,
        name = EXCLUDED.name,
        scopes = EXCLUDED.scopes,
        rate_limit = EXCLUDED.rate_limit,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    await this.db.query(query, [
      apiKey.id,
      apiKey.hash,
      apiKey.name,
      apiKey.userId,
      JSON.stringify(apiKey.scopes),
      JSON.stringify(apiKey.rateLimit),
      apiKey.expiresAt,
      JSON.stringify(apiKey.metadata),
      apiKey.metadata.created
    ]);
  }

  async findByHash(hash: string): Promise<APIKey | null> {
    const query = `
      SELECT * FROM api_keys 
      WHERE hash = $1 AND (expires_at IS NULL OR expires_at > NOW())
    `;
    
    const result = await this.db.query(query, [hash]);
    return result.rows.length > 0 ? this.mapRowToAPIKey(result.rows[0]) : null;
  }

  async findById(id: string): Promise<APIKey | null> {
    const query = `SELECT * FROM api_keys WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToAPIKey(result.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<APIKey[]> {
    const query = `
      SELECT * FROM api_keys 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToAPIKey(row));
  }

  async update(id: string, updates: Partial<APIKey>): Promise<boolean> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name) {
      setClause.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.scopes) {
      setClause.push(`scopes = $${paramIndex++}`);
      values.push(JSON.stringify(updates.scopes));
    }
    if (updates.rateLimit) {
      setClause.push(`rate_limit = $${paramIndex++}`);
      values.push(JSON.stringify(updates.rateLimit));
    }
    if (updates.expiresAt !== undefined) {
      setClause.push(`expires_at = $${paramIndex++}`);
      values.push(updates.expiresAt);
    }
    if (updates.metadata) {
      setClause.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (setClause.length === 0) return false;

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE api_keys 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
    `;

    const result = await this.db.query(query, values);
    return result.rowCount > 0;
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM api_keys WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  async list(filters: KeyListFilters = {}): Promise<APIKey[]> {
    let query = `SELECT * FROM api_keys WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      values.push(filters.userId);
    }
    if (filters.status) {
      query += ` AND metadata->>'status' = $${paramIndex++}`;
      values.push(filters.status);
    }
    if (filters.plan) {
      query += ` AND metadata->>'plan' = $${paramIndex++}`;
      values.push(filters.plan);
    }
    if (filters.createdAfter) {
      query += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.createdAfter);
    }
    if (filters.createdBefore) {
      query += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.createdBefore);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(filters.limit);
    }
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      values.push(filters.offset);
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToAPIKey(row));
  }

  private mapRowToAPIKey(row: any): APIKey {
    return {
      id: row.id,
      hash: row.hash,
      name: row.name,
      userId: row.user_id,
      scopes: JSON.parse(row.scopes || '[]'),
      rateLimit: JSON.parse(row.rate_limit || '{}'),
      expiresAt: row.expires_at,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}

export class APIKeyManager {
  private keyStore: KeyStore;
  private rotationService: KeyRotationService;
  private redis: Redis;
  
  constructor(db: Pool) {
    this.keyStore = new DatabaseKeyStore(db);
    this.rotationService = new KeyRotationService();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      enableOfflineQueue: false
    });
  }

  async generateAPIKey(request: APIKeyRequest): Promise<APIKey> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateKeyRequest(request);
      
      // Generate secure key
      const keyValue = this.generateSecureKey();
      const keyHash = this.hashKey(keyValue);
      
      // Create key metadata
      const apiKey: APIKey = {
        id: crypto.randomUUID(),
        hash: keyHash,
        name: request.name,
        userId: request.userId,
        scopes: request.scopes || this.getDefaultScopes(request.plan),
        rateLimit: request.rateLimit || this.getDefaultRateLimit(request.plan),
        expiresAt: request.expiresAt || this.calculateExpiration(request.plan),
        metadata: {
          created: new Date(),
          lastUsed: null,
          usageCount: 0,
          ipWhitelist: request.ipWhitelist || [],
          allowedOrigins: request.allowedOrigins || ['*'],
          webhookUrl: request.webhookUrl,
          plan: request.plan || 'free',
          status: 'active',
          rotationConfig: request.enableRotation ? {
            enabled: true,
            interval: request.rotationInterval || 90,
            nextRotation: this.calculateNextRotation(request.rotationInterval || 90)
          } : undefined
        }
      };
      
      // Store key
      await this.keyStore.save(apiKey);
      
      // Cache key hash for fast validation
      await this.cacheKeyHash(keyHash, apiKey.id);
      
      // Schedule rotation if enabled
      if (request.enableRotation) {
        await this.rotationService.scheduleRotation(
          apiKey.id,
          request.rotationInterval || 90,
          {
            notificationUrl: request.webhookUrl,
            gracePeriodHours: 24
          }
        );
      }
      
      // Record metrics
      const duration = Date.now() - startTime;
      metrics.recordMetric('apiKey', 'generated', 1, {
        userId: request.userId,
        plan: request.plan || 'free',
        duration: duration.toString()
      });
      
      logger.info('API key generated', {
        keyId: apiKey.id,
        userId: request.userId,
        plan: request.plan,
        scopes: apiKey.scopes
      });
      
      // Return key value only once
      return {
        ...apiKey,
        key: keyValue
      };
      
    } catch (error) {
      logger.error('Failed to generate API key', { error, request });
      metrics.recordMetric('apiKey', 'generationFailed', 1, {
        userId: request.userId,
        error: error.message
      });
      throw error;
    }
  }

  async validateAPIKey(keyValue: string, request: any): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Hash the provided key
      const keyHash = this.hashKey(keyValue);
      
      // Check cache first
      const cachedKeyId = await this.redis.get(`key_hash:${keyHash}`);
      let apiKey: APIKey | null = null;
      
      if (cachedKeyId) {
        apiKey = await this.keyStore.findById(cachedKeyId);
      } else {
        apiKey = await this.keyStore.findByHash(keyHash);
        if (apiKey) {
          await this.cacheKeyHash(keyHash, apiKey.id);
        }
      }
      
      if (!apiKey) {
        metrics.recordMetric('apiKey', 'validationFailed', 1, { reason: 'invalid_key' });
        return { valid: false, reason: 'Invalid API key' };
      }
      
      // Check key status
      if (apiKey.metadata.status !== 'active') {
        metrics.recordMetric('apiKey', 'validationFailed', 1, { 
          reason: 'inactive_key',
          status: apiKey.metadata.status 
        });
        return { valid: false, reason: `API key is ${apiKey.metadata.status}` };
      }
      
      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        await this.updateKeyStatus(apiKey.id, 'expired');
        metrics.recordMetric('apiKey', 'validationFailed', 1, { reason: 'expired' });
        return { valid: false, reason: 'API key expired' };
      }
      
      // Check IP whitelist
      if (apiKey.metadata.ipWhitelist.length > 0) {
        const clientIP = this.getClientIP(request);
        if (!this.isIPWhitelisted(clientIP, apiKey.metadata.ipWhitelist)) {
          metrics.recordMetric('apiKey', 'validationFailed', 1, { reason: 'ip_not_whitelisted' });
          return { valid: false, reason: 'IP not whitelisted' };
        }
      }
      
      // Check origin
      const origin = request.headers?.origin;
      if (origin && !this.isOriginAllowed(origin, apiKey.metadata.allowedOrigins)) {
        metrics.recordMetric('apiKey', 'validationFailed', 1, { reason: 'origin_not_allowed' });
        return { valid: false, reason: 'Origin not allowed' };
      }
      
      // Check scopes
      const requiredScope = this.getRequiredScope(request);
      if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
        metrics.recordMetric('apiKey', 'validationFailed', 1, { reason: 'insufficient_permissions' });
        return { valid: false, reason: 'Insufficient permissions' };
      }
      
      // Update usage statistics asynchronously
      this.updateUsageStats(apiKey.id).catch(error => {
        logger.error('Failed to update usage stats', { keyId: apiKey.id, error });
      });
      
      // Record successful validation
      const duration = Date.now() - startTime;
      metrics.recordMetric('apiKey', 'validated', 1, {
        keyId: apiKey.id,
        userId: apiKey.userId,
        duration: duration.toString()
      });
      
      return {
        valid: true,
        apiKey,
        rateLimit: apiKey.rateLimit,
        scopes: apiKey.scopes
      };
      
    } catch (error) {
      logger.error('API key validation error', { error });
      metrics.recordMetric('apiKey', 'validationError', 1, { error: error.message });
      
      // Fail open for availability
      return { valid: true, reason: 'Validation error - failing open' };
    }
  }

  async revokeAPIKey(keyId: string, reason?: string): Promise<boolean> {
    try {
      const apiKey = await this.keyStore.findById(keyId);
      if (!apiKey) {
        return false;
      }
      
      // Update key status
      const updated = await this.keyStore.update(keyId, {
        metadata: {
          ...apiKey.metadata,
          status: 'suspended'
        }
      });
      
      if (updated) {
        // Remove from cache
        await this.redis.del(`key_hash:${apiKey.hash}`);
        
        // Cancel any scheduled rotations
        // Implementation would need rotation job lookup
        
        logger.info('API key revoked', { keyId, reason });
        metrics.recordMetric('apiKey', 'revoked', 1, { keyId, reason: reason || 'manual' });
      }
      
      return updated;
    } catch (error) {
      logger.error('Failed to revoke API key', { keyId, error });
      return false;
    }
  }

  async updateKeyScopes(keyId: string, scopes: string[]): Promise<boolean> {
    try {
      const updated = await this.keyStore.update(keyId, { scopes });
      
      if (updated) {
        logger.info('API key scopes updated', { keyId, scopes });
        metrics.recordMetric('apiKey', 'scopesUpdated', 1, { keyId });
      }
      
      return updated;
    } catch (error) {
      logger.error('Failed to update key scopes', { keyId, error });
      return false;
    }
  }

  async updateRateLimit(keyId: string, rateLimit: RateLimitConfig): Promise<boolean> {
    try {
      const updated = await this.keyStore.update(keyId, { rateLimit });
      
      if (updated) {
        logger.info('API key rate limit updated', { keyId, rateLimit });
        metrics.recordMetric('apiKey', 'rateLimitUpdated', 1, { keyId });
      }
      
      return updated;
    } catch (error) {
      logger.error('Failed to update rate limit', { keyId, error });
      return false;
    }
  }

  async getKeyUsageStats(keyId: string): Promise<any> {
    try {
      const apiKey = await this.keyStore.findById(keyId);
      if (!apiKey) return null;

      // Get usage stats from Redis
      const usageData = await this.redis.hmget(
        `key_usage:${keyId}`,
        'totalRequests',
        'successfulRequests',
        'failedRequests',
        'lastHourRequests',
        'averageResponseTime'
      );

      return {
        keyId,
        totalRequests: parseInt(usageData[0]) || 0,
        successfulRequests: parseInt(usageData[1]) || 0,
        failedRequests: parseInt(usageData[2]) || 0,
        lastHourRequests: parseInt(usageData[3]) || 0,
        averageResponseTime: parseFloat(usageData[4]) || 0,
        lastUsed: apiKey.metadata.lastUsed,
        created: apiKey.metadata.created
      };
    } catch (error) {
      logger.error('Failed to get usage stats', { keyId, error });
      return null;
    }
  }

  private validateKeyRequest(request: APIKeyRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('API key name is required');
    }
    
    if (!request.userId || request.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
    
    if (request.scopes && request.scopes.some(scope => !this.isValidScope(scope))) {
      throw new Error('Invalid scope provided');
    }
    
    if (request.ipWhitelist && request.ipWhitelist.some(ip => !this.isValidIP(ip))) {
      throw new Error('Invalid IP address in whitelist');
    }
  }

  private generateSecureKey(): string {
    const prefix = 'sk_live_';
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url');
    return `${prefix}${key}`;
  }

  private hashKey(key: string): string {
    return crypto
      .createHash('sha256')
      .update(key + (process.env.API_KEY_SALT || 'default-salt'))
      .digest('hex');
  }

  private getDefaultScopes(plan?: string): string[] {
    switch (plan) {
      case 'enterprise':
        return ['read', 'write', 'admin', 'webhooks', 'analytics'];
      case 'pro':
        return ['read', 'write', 'webhooks'];
      case 'free':
      default:
        return ['read'];
    }
  }

  private getDefaultRateLimit(plan?: string): RateLimitConfig {
    switch (plan) {
      case 'enterprise':
        return { requests: 10000, window: 3600, burst: 500, algorithm: 'token-bucket' };
      case 'pro':
        return { requests: 1000, window: 3600, burst: 50, algorithm: 'sliding-window' };
      case 'free':
      default:
        return { requests: 100, window: 3600, algorithm: 'sliding-window' };
    }
  }

  private calculateExpiration(plan?: string): Date | undefined {
    if (plan === 'free') {
      // Free tier keys expire after 6 months
      return new Date(Date.now() + (6 * 30 * 24 * 60 * 60 * 1000));
    }
    // Pro and enterprise keys don't expire by default
    return undefined;
  }

  private calculateNextRotation(intervalDays: number): Date {
    return new Date(Date.now() + (intervalDays * 24 * 60 * 60 * 1000));
  }

  private async cacheKeyHash(hash: string, keyId: string): Promise<void> {
    await this.redis.setex(`key_hash:${hash}`, 3600, keyId); // 1 hour cache
  }

  private getClientIP(request: any): string {
    return request.headers?.['x-forwarded-for']?.split(',')[0] ||
           request.headers?.['x-real-ip'] ||
           request.connection?.remoteAddress ||
           request.ip ||
           '127.0.0.1';
  }

  private isIPWhitelisted(clientIP: string, whitelist: string[]): boolean {
    return whitelist.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation support would go here
        return false;
      }
      return allowedIP === clientIP;
    });
  }

  private isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  }

  private getRequiredScope(request: any): string | null {
    const method = request.method?.toUpperCase();
    const path = request.path || request.url;
    
    if (method === 'GET') return 'read';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return 'write';
    if (path?.includes('/admin/')) return 'admin';
    if (path?.includes('/webhooks/')) return 'webhooks';
    
    return null;
  }

  private async updateUsageStats(keyId: string): Promise<void> {
    const usageKey = `key_usage:${keyId}`;
    const now = Date.now();
    
    // Increment counters
    await this.redis.hincrby(usageKey, 'totalRequests', 1);
    await this.redis.hset(usageKey, 'lastUsed', now);
    
    // Update last used in database
    const apiKey = await this.keyStore.findById(keyId);
    if (apiKey) {
      await this.keyStore.update(keyId, {
        metadata: {
          ...apiKey.metadata,
          lastUsed: new Date(),
          usageCount: apiKey.metadata.usageCount + 1
        }
      });
    }
    
    // Set TTL for usage data
    await this.redis.expire(usageKey, 86400); // 24 hours
  }

  private async updateKeyStatus(keyId: string, status: string): Promise<void> {
    const apiKey = await this.keyStore.findById(keyId);
    if (apiKey) {
      await this.keyStore.update(keyId, {
        metadata: {
          ...apiKey.metadata,
          status: status as any
        }
      });
    }
  }

  private isValidScope(scope: string): boolean {
    const validScopes = ['read', 'write', 'admin', 'webhooks', 'analytics'];
    return validScopes.includes(scope);
  }

  private isValidIP(ip: string): boolean {
    // Basic IP validation - would be more comprehensive in production
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipRegex.test(ip);
  }
}