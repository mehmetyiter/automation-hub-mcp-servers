import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  IUniversalCredential,
  ICredentialData,
  IValidationResult,
  ICredentialFilters,
  ICredentialSearchQuery,
  ICredentialMigration,
  IUniversalCredentialManager,
  PlatformType,
  IPlatformAdapter,
  ICredentialUsage,
  IBatchOperationResult,
  IEncryptedCredential,
  IEncryptionContext,
  SecurityLevel,
  ValidationStatus
} from './interfaces/credential-interfaces.js';
import { AdvancedEncryptionService } from '../security/advanced-encryption-service.js';
import { UserCredentialManager } from '../services/user-credential-manager.js';
import { AdvancedSecurityMonitoring } from '../security/advanced-security-monitoring.js';
import { MonitoringService } from '../monitoring/monitoring-service.js';
import { HighAvailabilityManager } from '../infrastructure/high-availability-manager.js';
import { PerformanceOptimizer } from '../infrastructure/performance-optimizer.js';

export interface UniversalCredentialManagerConfig {
  platforms: Map<PlatformType, IPlatformAdapter>;
  encryption: AdvancedEncryptionService;
  security: AdvancedSecurityMonitoring;
  monitoring: MonitoringService;
  haManager?: HighAvailabilityManager;
  performanceOptimizer?: PerformanceOptimizer;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export class UniversalCredentialManager extends EventEmitter implements IUniversalCredentialManager {
  private config: UniversalCredentialManagerConfig;
  private platformAdapters: Map<PlatformType, IPlatformAdapter>;
  private credentialCache: Map<string, { credential: IUniversalCredential; data: ICredentialData; timestamp: number }> = new Map();
  private validationCache: Map<string, { result: IValidationResult; timestamp: number }> = new Map();

  constructor(config: UniversalCredentialManagerConfig) {
    super();
    this.config = config;
    this.platformAdapters = config.platforms;
    this.setupCacheCleanup();
  }

  private setupCacheCleanup(): void {
    if (this.config.cacheEnabled) {
      setInterval(() => {
        const now = Date.now();
        const ttl = this.config.cacheTTL || 300000; // 5 minutes default

        // Clean credential cache
        for (const [id, cached] of this.credentialCache.entries()) {
          if (now - cached.timestamp > ttl) {
            this.credentialCache.delete(id);
          }
        }

        // Clean validation cache
        for (const [id, cached] of this.validationCache.entries()) {
          if (now - cached.timestamp > ttl) {
            this.validationCache.delete(id);
          }
        }
      }, 60000); // Run every minute
    }
  }

  async create(
    credential: Omit<IUniversalCredential, 'id' | 'createdAt' | 'updatedAt'>, 
    data: ICredentialData
  ): Promise<IUniversalCredential> {
    const startTime = Date.now();

    try {
      // Generate unique ID
      const id = uuidv4();
      const now = new Date();

      // Create full credential object
      const fullCredential: IUniversalCredential = {
        ...credential,
        id,
        createdAt: now,
        updatedAt: now
      };

      // Validate with platform adapter
      const adapter = this.platformAdapters.get(credential.platform);
      if (!adapter) {
        throw new Error(`Platform adapter not found for: ${credential.platform}`);
      }

      const validationResult = await adapter.validateCredential(fullCredential, data);
      if (validationResult.status !== 'valid') {
        throw new Error(`Credential validation failed: ${validationResult.errors?.[0]?.message || 'Unknown error'}`);
      }

      // Encrypt credential data
      const encryptionContext: IEncryptionContext = {
        securityLevel: credential.securityLevel,
        platform: credential.platform,
        provider: credential.provider,
        userId: credential.userId,
        timestamp: now
      };

      const encrypted = await this.config.encryption.encryptWithContext(
        JSON.stringify(data),
        encryptionContext,
        credential.securityLevel
      );

      // Store in database using underlying credential manager
      const dbClient = await this.getDatabase();
      await dbClient.query(
        `INSERT INTO universal_credentials 
         (id, user_id, name, description, platform, provider, type, security_level, 
          metadata, created_at, updated_at, encrypted_data, encryption_context, key_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          fullCredential.id,
          fullCredential.userId,
          fullCredential.name,
          fullCredential.description,
          fullCredential.platform,
          fullCredential.provider,
          fullCredential.type,
          fullCredential.securityLevel,
          JSON.stringify(fullCredential.metadata),
          fullCredential.createdAt,
          fullCredential.updatedAt,
          encrypted.encryptedData,
          JSON.stringify(encryptionContext),
          encrypted.keyVersion
        ]
      );

      // Record metrics
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('create', credential.provider, 'success', duration / 1000);

      // Record security event
      await this.config.security.recordSecurityEvent({
        type: 'credential_created',
        severity: 'info',
        userId: credential.userId,
        resourceId: fullCredential.id,
        resourceType: 'credential',
        platform: credential.platform,
        action: 'create',
        metadata: {
          provider: credential.provider,
          securityLevel: credential.securityLevel
        }
      });

      // Cache if enabled
      if (this.config.cacheEnabled) {
        this.credentialCache.set(fullCredential.id, {
          credential: fullCredential,
          data,
          timestamp: Date.now()
        });
      }

      this.emit('credential-created', fullCredential);
      return fullCredential;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('create', credential.provider, 'failure', duration / 1000);

      await this.config.security.recordSecurityEvent({
        type: 'credential_creation_failed',
        severity: 'warning',
        userId: credential.userId,
        resourceType: 'credential',
        platform: credential.platform,
        action: 'create',
        metadata: {
          error: error.message,
          provider: credential.provider
        }
      });

      throw error;
    }
  }

  async read(credentialId: string): Promise<IUniversalCredential> {
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.credentialCache.get(credentialId);
        if (cached) {
          return cached.credential;
        }
      }

      // Read from database
      const dbClient = await this.getDatabase();
      const result = await dbClient.query(
        `SELECT * FROM universal_credentials WHERE id = $1`,
        [credentialId]
      );

      if (result.rows.length === 0) {
        throw new Error('Credential not found');
      }

      const row = result.rows[0];
      const credential: IUniversalCredential = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        platform: row.platform,
        provider: row.provider,
        type: row.type,
        securityLevel: row.security_level,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at
      };

      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('read', credential.provider, 'success', duration / 1000);

      return credential;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('read', 'unknown', 'failure', duration / 1000);
      throw error;
    }
  }

  async update(
    credentialId: string, 
    updates: Partial<IUniversalCredential>, 
    data?: Partial<ICredentialData>
  ): Promise<IUniversalCredential> {
    const startTime = Date.now();

    try {
      // Get existing credential
      const existing = await this.read(credentialId);

      // Merge updates
      const updated: IUniversalCredential = {
        ...existing,
        ...updates,
        id: existing.id, // Preserve ID
        createdAt: existing.createdAt, // Preserve creation date
        updatedAt: new Date()
      };

      // If data is provided, validate and re-encrypt
      if (data) {
        // Get existing data
        const existingData = await this.getDecryptedData(credentialId);
        const mergedData = { ...existingData, ...data };

        // Validate with platform adapter
        const adapter = this.platformAdapters.get(updated.platform);
        if (!adapter) {
          throw new Error(`Platform adapter not found for: ${updated.platform}`);
        }

        const validationResult = await adapter.validateCredential(updated, mergedData);
        if (validationResult.status !== 'valid') {
          throw new Error(`Credential validation failed: ${validationResult.errors?.[0]?.message || 'Unknown error'}`);
        }

        // Re-encrypt with new data
        const encryptionContext: IEncryptionContext = {
          securityLevel: updated.securityLevel,
          platform: updated.platform,
          provider: updated.provider,
          userId: updated.userId,
          timestamp: updated.updatedAt
        };

        const encrypted = await this.config.encryption.encryptWithContext(
          JSON.stringify(mergedData),
          encryptionContext,
          updated.securityLevel
        );

        // Update with new encrypted data
        const dbClient = await this.getDatabase();
        await dbClient.query(
          `UPDATE universal_credentials 
           SET name = $2, description = $3, metadata = $4, updated_at = $5, 
               encrypted_data = $6, encryption_context = $7, key_version = $8,
               security_level = $9
           WHERE id = $1`,
          [
            credentialId,
            updated.name,
            updated.description,
            JSON.stringify(updated.metadata),
            updated.updatedAt,
            encrypted.encryptedData,
            JSON.stringify(encryptionContext),
            encrypted.keyVersion,
            updated.securityLevel
          ]
        );

        // Update cache
        if (this.config.cacheEnabled) {
          this.credentialCache.set(credentialId, {
            credential: updated,
            data: mergedData,
            timestamp: Date.now()
          });
        }
      } else {
        // Update metadata only
        const dbClient = await this.getDatabase();
        await dbClient.query(
          `UPDATE universal_credentials 
           SET name = $2, description = $3, metadata = $4, updated_at = $5
           WHERE id = $1`,
          [
            credentialId,
            updated.name,
            updated.description,
            JSON.stringify(updated.metadata),
            updated.updatedAt
          ]
        );
      }

      // Clear validation cache
      this.validationCache.delete(credentialId);

      // Record metrics
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('update', updated.provider, 'success', duration / 1000);

      // Record security event
      await this.config.security.recordSecurityEvent({
        type: 'credential_updated',
        severity: 'info',
        userId: updated.userId,
        resourceId: credentialId,
        resourceType: 'credential',
        platform: updated.platform,
        action: 'update',
        metadata: {
          changes: Object.keys(updates)
        }
      });

      this.emit('credential-updated', updated);
      return updated;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('update', 'unknown', 'failure', duration / 1000);
      throw error;
    }
  }

  async delete(credentialId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Get credential for logging
      const credential = await this.read(credentialId);

      // Delete from database
      const dbClient = await this.getDatabase();
      await dbClient.query(
        `DELETE FROM universal_credentials WHERE id = $1`,
        [credentialId]
      );

      // Clear caches
      this.credentialCache.delete(credentialId);
      this.validationCache.delete(credentialId);

      // Record metrics
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('delete', credential.provider, 'success', duration / 1000);

      // Record security event
      await this.config.security.recordSecurityEvent({
        type: 'credential_deleted',
        severity: 'warning',
        userId: credential.userId,
        resourceId: credentialId,
        resourceType: 'credential',
        platform: credential.platform,
        action: 'delete',
        metadata: {
          provider: credential.provider,
          name: credential.name
        }
      });

      this.emit('credential-deleted', credentialId);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('delete', 'unknown', 'failure', duration / 1000);
      throw error;
    }
  }

  async list(userId: string, filters?: ICredentialFilters): Promise<IUniversalCredential[]> {
    try {
      let query = `SELECT * FROM universal_credentials WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIndex = 2;

      // Apply filters
      if (filters) {
        if (filters.platform) {
          query += ` AND platform = $${paramIndex++}`;
          params.push(filters.platform);
        }
        if (filters.provider) {
          query += ` AND provider = $${paramIndex++}`;
          params.push(filters.provider);
        }
        if (filters.type) {
          query += ` AND type = $${paramIndex++}`;
          params.push(filters.type);
        }
        if (filters.securityLevel) {
          query += ` AND security_level = $${paramIndex++}`;
          params.push(filters.securityLevel);
        }
        if (filters.environment) {
          query += ` AND metadata->>'environment' = $${paramIndex++}`;
          params.push(filters.environment);
        }
        if (filters.validOnly) {
          // This would require a join with validation results table
          // For now, we'll filter in memory after validation
        }
      }

      query += ` ORDER BY created_at DESC`;

      const dbClient = await this.getDatabase();
      const result = await dbClient.query(query, params);

      const credentials: IUniversalCredential[] = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        platform: row.platform,
        provider: row.provider,
        type: row.type,
        securityLevel: row.security_level,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at
      }));

      // Filter by validity if requested
      if (filters?.validOnly) {
        const validationPromises = credentials.map(c => this.validate(c.id));
        const validationResults = await Promise.all(validationPromises);
        
        return credentials.filter((c, index) => 
          validationResults[index].status === 'valid'
        );
      }

      return credentials;

    } catch (error) {
      throw new Error(`Failed to list credentials: ${error.message}`);
    }
  }

  async search(query: ICredentialSearchQuery): Promise<IUniversalCredential[]> {
    try {
      let sqlQuery = `SELECT * FROM universal_credentials WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      // Build search query
      if (query.userId) {
        sqlQuery += ` AND user_id = $${paramIndex++}`;
        params.push(query.userId);
      }

      if (query.text) {
        sqlQuery += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex++})`;
        params.push(`%${query.text}%`);
      }

      if (query.platforms && query.platforms.length > 0) {
        sqlQuery += ` AND platform = ANY($${paramIndex++})`;
        params.push(query.platforms);
      }

      if (query.providers && query.providers.length > 0) {
        sqlQuery += ` AND provider = ANY($${paramIndex++})`;
        params.push(query.providers);
      }

      if (query.createdAfter) {
        sqlQuery += ` AND created_at >= $${paramIndex++}`;
        params.push(query.createdAfter);
      }

      if (query.createdBefore) {
        sqlQuery += ` AND created_at <= $${paramIndex++}`;
        params.push(query.createdBefore);
      }

      if (query.lastUsedAfter) {
        sqlQuery += ` AND last_used_at >= $${paramIndex++}`;
        params.push(query.lastUsedAfter);
      }

      // Apply limit and offset
      if (query.limit) {
        sqlQuery += ` LIMIT $${paramIndex++}`;
        params.push(query.limit);
      }

      if (query.offset) {
        sqlQuery += ` OFFSET $${paramIndex++}`;
        params.push(query.offset);
      }

      const dbClient = await this.getDatabase();
      const result = await dbClient.query(sqlQuery, params);

      const credentials: IUniversalCredential[] = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        platform: row.platform,
        provider: row.provider,
        type: row.type,
        securityLevel: row.security_level,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at
      }));

      // Filter by validity if requested
      if (query.validOnly) {
        const validationPromises = credentials.map(c => this.validate(c.id));
        const validationResults = await Promise.all(validationPromises);
        
        return credentials.filter((c, index) => 
          validationResults[index].status === 'valid'
        );
      }

      return credentials;

    } catch (error) {
      throw new Error(`Failed to search credentials: ${error.message}`);
    }
  }

  async validate(credentialId: string): Promise<IValidationResult> {
    const startTime = Date.now();

    try {
      // Check validation cache
      if (this.config.cacheEnabled) {
        const cached = this.validationCache.get(credentialId);
        if (cached) {
          return cached.result;
        }
      }

      // Get credential and data
      const credential = await this.read(credentialId);
      const data = await this.getDecryptedData(credentialId);

      // Get platform adapter
      const adapter = this.platformAdapters.get(credential.platform);
      if (!adapter) {
        throw new Error(`Platform adapter not found for: ${credential.platform}`);
      }

      // Validate with adapter
      const result = await adapter.validateCredential(credential, data);

      // Update last validated timestamp
      const dbClient = await this.getDatabase();
      await dbClient.query(
        `UPDATE universal_credentials 
         SET last_validated_at = $2, validation_status = $3
         WHERE id = $1`,
        [credentialId, new Date(), result.status]
      );

      // Cache result
      if (this.config.cacheEnabled) {
        this.validationCache.set(credentialId, {
          result,
          timestamp: Date.now()
        });
      }

      // Record metrics
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('validate', credential.provider, 'success', duration / 1000);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.config.monitoring.recordCredentialOperation('validate', 'unknown', 'failure', duration / 1000);
      throw error;
    }
  }

  async test(credentialId: string): Promise<boolean> {
    try {
      // Get credential and data
      const credential = await this.read(credentialId);
      const data = await this.getDecryptedData(credentialId);

      // Get platform adapter
      const adapter = this.platformAdapters.get(credential.platform);
      if (!adapter) {
        throw new Error(`Platform adapter not found for: ${credential.platform}`);
      }

      // Test connection
      const success = await adapter.testConnection(credential, data);

      // Update last used timestamp if successful
      if (success) {
        const dbClient = await this.getDatabase();
        await dbClient.query(
          `UPDATE universal_credentials SET last_used_at = $2 WHERE id = $1`,
          [credentialId, new Date()]
        );
      }

      return success;

    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async migrate(credentialId: string, targetPlatform: PlatformType): Promise<ICredentialMigration> {
    try {
      // Get source credential and data
      const sourceCredential = await this.read(credentialId);
      const sourceData = await this.getDecryptedData(credentialId);

      // Get platform adapters
      const sourceAdapter = this.platformAdapters.get(sourceCredential.platform);
      const targetAdapter = this.platformAdapters.get(targetPlatform);

      if (!sourceAdapter || !targetAdapter) {
        throw new Error('Platform adapter not found');
      }

      // Get platform configurations
      const targetConfig = await this.getPlatformConfig(targetPlatform);

      // Create migration plan
      const migration: ICredentialMigration = {
        sourcePlatform: sourceCredential.platform,
        targetPlatform,
        credentialId,
        mappings: this.createFieldMappings(sourceCredential.platform, targetPlatform),
        transformations: this.createTransformations(sourceCredential.platform, targetPlatform)
      };

      // Transform data for target platform
      const transformedData = await targetAdapter.transformCredential(
        { ...sourceCredential, platform: targetPlatform },
        sourceData
      );

      // Validate transformed data
      const validationResult = await targetAdapter.validateCredential(
        { ...sourceCredential, platform: targetPlatform },
        transformedData
      );

      migration.validationStatus = validationResult.status;
      if (validationResult.errors) {
        migration.migrationErrors = validationResult.errors.map(e => e.message);
      }

      // Record security event
      await this.config.security.recordSecurityEvent({
        type: 'credential_migrated',
        severity: 'info',
        userId: sourceCredential.userId,
        resourceId: credentialId,
        resourceType: 'credential',
        platform: sourceCredential.platform,
        action: 'migrate',
        metadata: {
          sourcePlatform: sourceCredential.platform,
          targetPlatform,
          success: validationResult.status === 'valid'
        }
      });

      return migration;

    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  async export(credentialId: string, format: 'json' | 'yaml' | 'env'): Promise<string> {
    try {
      const credential = await this.read(credentialId);
      const data = await this.getDecryptedData(credentialId);

      // Remove sensitive fields for export
      const exportData = {
        ...credential,
        data: this.sanitizeDataForExport(data)
      };

      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        
        case 'yaml':
          // Would use a YAML library here
          return this.convertToYaml(exportData);
        
        case 'env':
          return this.convertToEnv(exportData);
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  async import(data: string, format: 'json' | 'yaml' | 'env'): Promise<IUniversalCredential> {
    try {
      let parsedData: any;

      switch (format) {
        case 'json':
          parsedData = JSON.parse(data);
          break;
        
        case 'yaml':
          // Would use a YAML library here
          parsedData = this.parseYaml(data);
          break;
        
        case 'env':
          parsedData = this.parseEnv(data);
          break;
        
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Create new credential from imported data
      const { data: credentialData, ...credentialInfo } = parsedData;
      
      return await this.create(credentialInfo, credentialData);

    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Helper methods

  private async getDatabase(): Promise<any> {
    if (this.config.haManager) {
      return await this.config.haManager.getPostgresClient('write');
    }
    // Fallback to direct connection
    throw new Error('Database connection not configured');
  }

  private async getDecryptedData(credentialId: string): Promise<ICredentialData> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.credentialCache.get(credentialId);
      if (cached) {
        return cached.data;
      }
    }

    // Get from database
    const dbClient = await this.getDatabase();
    const result = await dbClient.query(
      `SELECT encrypted_data, encryption_context, key_version FROM universal_credentials WHERE id = $1`,
      [credentialId]
    );

    if (result.rows.length === 0) {
      throw new Error('Credential not found');
    }

    const row = result.rows[0];
    const encryptionContext = JSON.parse(row.encryption_context);

    // Decrypt data
    const decrypted = await this.config.encryption.decryptWithContext(
      row.encrypted_data,
      encryptionContext
    );

    return JSON.parse(decrypted);
  }

  private async getPlatformConfig(platform: PlatformType): Promise<any> {
    // This would load platform-specific configuration
    // For now, returning a basic config
    return {
      platform,
      requiredFields: ['apiKey'],
      optionalFields: ['endpoint', 'region']
    };
  }

  private createFieldMappings(source: PlatformType, target: PlatformType): any[] {
    // Create field mappings based on platform types
    // This is a simplified version
    const commonMappings = [
      { sourceField: 'apiKey', targetField: 'apiKey', required: true },
      { sourceField: 'endpoint', targetField: 'endpoint', required: false }
    ];

    // Add platform-specific mappings
    if (source === 'openai' && target === 'anthropic') {
      commonMappings.push({
        sourceField: 'organizationId',
        targetField: 'workspaceId',
        required: false
      });
    }

    return commonMappings;
  }

  private createTransformations(source: PlatformType, target: PlatformType): any[] {
    // Create transformation rules based on platform types
    const transformations = [];

    // Example transformation
    if (source === 'openai' && target === 'anthropic') {
      transformations.push({
        sourceField: 'model',
        targetField: 'model',
        transform: (value: string) => {
          // Map OpenAI models to Anthropic models
          const modelMap: Record<string, string> = {
            'gpt-4': 'claude-3-opus',
            'gpt-3.5-turbo': 'claude-3-sonnet'
          };
          return modelMap[value] || value;
        }
      });
    }

    return transformations;
  }

  private sanitizeDataForExport(data: ICredentialData): any {
    // Remove or mask sensitive fields
    const sanitized = { ...data };
    
    if (sanitized.apiKey) {
      sanitized.apiKey = `${sanitized.apiKey.substring(0, 8)}...${sanitized.apiKey.slice(-4)}`;
    }
    
    if (sanitized.secretKey) {
      sanitized.secretKey = '***REDACTED***';
    }
    
    if (sanitized.password) {
      sanitized.password = '***REDACTED***';
    }

    return sanitized;
  }

  private convertToYaml(data: any): string {
    // Simplified YAML conversion
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
  }

  private convertToEnv(data: any): string {
    // Convert to environment variable format
    const envVars: string[] = [];
    const prefix = data.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    const flattenObject = (obj: any, parentKey = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const envKey = parentKey ? `${parentKey}_${key}` : key;
        if (typeof value === 'object' && value !== null) {
          flattenObject(value, envKey);
        } else {
          envVars.push(`${prefix}_${envKey.toUpperCase()}="${value}"`);
        }
      }
    };

    if (data.data) {
      flattenObject(data.data);
    }

    return envVars.join('\n');
  }

  private parseYaml(data: string): any {
    // Simplified YAML parsing
    const result: any = {};
    const lines = data.split('\n');
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        try {
          result[key.trim()] = JSON.parse(value);
        } catch {
          result[key.trim()] = value;
        }
      }
    }

    return result;
  }

  private parseEnv(data: string): any {
    // Parse environment variable format
    const lines = data.split('\n');
    const result: any = { data: {} };
    
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)="?(.+?)"?$/);
      if (match) {
        const [, key, value] = match;
        // Remove prefix and convert to camelCase
        const parts = key.toLowerCase().split('_');
        const fieldName = parts.slice(1).reduce((acc, part, index) => {
          return acc + (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1));
        }, '');
        
        result.data[fieldName] = value;
      }
    }

    return result;
  }

  // Public utility methods

  async trackUsage(usage: ICredentialUsage): Promise<void> {
    try {
      // Get platform adapter
      const adapter = this.platformAdapters.get(usage.platform);
      if (adapter) {
        await adapter.trackUsage(usage);
      }

      // Update last used timestamp
      const dbClient = await this.getDatabase();
      await dbClient.query(
        `UPDATE universal_credentials SET last_used_at = $2 WHERE id = $1`,
        [usage.credentialId, usage.timestamp]
      );

      // Record metrics
      this.config.monitoring.recordApiRequest(
        'usage',
        usage.operation,
        usage.success ? 200 : 500,
        usage.platform,
        usage.responseTime / 1000
      );

    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  async batchValidate(credentialIds: string[]): Promise<IBatchOperationResult<IValidationResult>> {
    const startTime = Date.now();
    const results: IValidationResult[] = [];
    const failed: Array<{ item: IValidationResult; error: Error }> = [];

    for (const id of credentialIds) {
      try {
        const result = await this.validate(id);
        results.push(result);
      } catch (error) {
        failed.push({
          item: {
            credentialId: id,
            status: 'unknown' as ValidationStatus,
            validatedAt: new Date()
          },
          error
        });
      }
    }

    return {
      successful: results,
      failed,
      total: credentialIds.length,
      successCount: results.length,
      failureCount: failed.length,
      duration: Date.now() - startTime
    };
  }

  async rotateCredentials(userId: string): Promise<void> {
    try {
      // Get all credentials for user
      const credentials = await this.list(userId);

      // Rotate encryption keys
      await this.config.encryption.rotateKeysWithZeroDowntime();

      // Re-encrypt all credentials with new keys
      for (const credential of credentials) {
        const data = await this.getDecryptedData(credential.id);
        await this.update(credential.id, {}, data);
      }

      // Record security event
      await this.config.security.recordSecurityEvent({
        type: 'credentials_rotated',
        severity: 'info',
        userId,
        resourceType: 'credential',
        action: 'rotate',
        metadata: {
          count: credentials.length
        }
      });

    } catch (error) {
      throw new Error(`Credential rotation failed: ${error.message}`);
    }
  }

  async destroy(): Promise<void> {
    this.credentialCache.clear();
    this.validationCache.clear();
    this.removeAllListeners();
  }
}

// Export factory function
export function createUniversalCredentialManager(config: UniversalCredentialManagerConfig): UniversalCredentialManager {
  return new UniversalCredentialManager(config);
}