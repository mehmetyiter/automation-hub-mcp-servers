import { getEncryptionService, EncryptionService, EncryptedData } from '../security/encryption-service.js';
import { Redis } from 'ioredis';

export interface UserApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  cohere?: string;
  azure?: string;
  aws?: string;
  [provider: string]: string | undefined;
}

export interface StoredCredential {
  id: string;
  userId: string;
  provider: string;
  encryptedApiKey: EncryptedData;
  keyHash: string;
  isActive: boolean;
  lastValidatedAt?: Date;
  validationStatus: 'pending' | 'valid' | 'invalid' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialOperation {
  id: string;
  userId: string;
  provider: string;
  operation: 'store' | 'validate' | 'use' | 'rotate' | 'delete';
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  lastChecked: Date;
}

export interface Database {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: any }>;
}

export class UserCredentialManager {
  private encryptionService: EncryptionService;
  private redis: Redis;
  
  constructor(
    private database: Database,
    redisUrl?: string,
    masterKeySecret?: string
  ) {
    this.encryptionService = getEncryptionService(masterKeySecret);
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }
  
  async storeUserApiKeys(userId: string, credentials: UserApiKeys): Promise<void> {
    console.log(`📝 Storing API keys for user: ${userId}`);
    
    try {
      // Process each provider credential
      for (const [provider, apiKey] of Object.entries(credentials)) {
        if (apiKey) {
          await this.storeProviderCredential(userId, provider, apiKey);
        }
      }
      
      console.log(`✅ Successfully stored credentials for user: ${userId}`);
    } catch (error) {
      console.error('Failed to store user credentials:', error);
      await this.logCredentialOperation(userId, 'all', 'store', 'failure', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  private async storeProviderCredential(
    userId: string, 
    provider: string, 
    apiKey: string
  ): Promise<void> {
    
    // Create encryption context
    const context = {
      userId,
      provider,
      purpose: 'storage' as const
    };
    
    // Encrypt the API key
    const encryptedApiKey = await this.encryptionService.encrypt(apiKey, context);
    
    // Generate hash for validation
    const keyHash = this.encryptionService.generateApiKeyHash(apiKey);
    
    // Check if credential already exists
    const existingCredential = await this.getExistingCredential(userId, provider);
    
    if (existingCredential) {
      // Update existing credential
      await this.database.execute(`
        UPDATE user_credentials 
        SET encrypted_api_key = ?, key_hash = ?, is_active = true, 
            validation_status = 'pending', updated_at = NOW()
        WHERE user_id = ? AND provider = ?
      `, [
        JSON.stringify(encryptedApiKey),
        keyHash,
        userId,
        provider
      ]);
    } else {
      // Insert new credential
      await this.database.execute(`
        INSERT INTO user_credentials 
        (user_id, provider, encrypted_api_key, key_hash, is_active, validation_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, true, 'pending', NOW(), NOW())
      `, [
        userId,
        provider,
        JSON.stringify(encryptedApiKey),
        keyHash
      ]);
    }
    
    // Clear cache
    await this.clearCredentialCache(userId, provider);
    
    // Log operation
    await this.logCredentialOperation(userId, provider, 'store', 'success');
  }
  
  async getUserApiKeys(userId: string): Promise<UserApiKeys> {
    console.log(`🔍 Retrieving API keys for user: ${userId}`);
    
    try {
      // Check cache first
      const cacheKey = `credentials:${userId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        console.log('📋 Using cached credentials');
        return JSON.parse(cached);
      }
      
      // Fetch from database
      const credentials = await this.database.query(`
        SELECT provider, encrypted_api_key, validation_status
        FROM user_credentials 
        WHERE user_id = ? AND is_active = true
      `, [userId]);
      
      const userApiKeys: UserApiKeys = {};
      
      for (const credential of credentials) {
        try {
          const context = {
            userId,
            provider: credential.provider,
            purpose: 'storage' as const
          };
          
          const encryptedData = JSON.parse(credential.encrypted_api_key);
          const decryptedKey = await this.encryptionService.decrypt(encryptedData, context);
          
          userApiKeys[credential.provider] = decryptedKey;
        } catch (error) {
          console.error(`Failed to decrypt key for provider ${credential.provider}:`, error);
          // Continue with other providers
        }
      }
      
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(userApiKeys));
      
      return userApiKeys;
    } catch (error) {
      console.error('Failed to retrieve user credentials:', error);
      throw error;
    }
  }
  
  async validateUserCredentials(userId: string, provider: string): Promise<boolean> {
    console.log(`✅ Validating credentials for user: ${userId}, provider: ${provider}`);
    
    try {
      const credential = await this.getStoredCredential(userId, provider);
      
      if (!credential) {
        return false;
      }
      
      // Check if recently validated (within 1 hour)
      if (credential.lastValidatedAt) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (credential.lastValidatedAt > hourAgo && credential.validationStatus === 'valid') {
          return true;
        }
      }
      
      // Decrypt and validate the API key
      const context = {
        userId,
        provider,
        purpose: 'storage' as const
      };
      
      const decryptedKey = await this.encryptionService.decrypt(credential.encryptedApiKey, context);
      
      // Validate with provider (this would be implemented with actual provider APIs)
      const validationResult = await this.validateWithProvider(provider, decryptedKey);
      
      // Update validation status
      await this.updateValidationStatus(userId, provider, validationResult);
      
      // Log operation
      await this.logCredentialOperation(
        userId, 
        provider, 
        'validate', 
        validationResult.isValid ? 'success' : 'failure'
      );
      
      return validationResult.isValid;
    } catch (error) {
      console.error('Credential validation failed:', error);
      await this.logCredentialOperation(userId, provider, 'validate', 'failure', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  
  async rotateApiKey(userId: string, provider: string, newKey: string): Promise<void> {
    console.log(`🔄 Rotating API key for user: ${userId}, provider: ${provider}`);
    
    try {
      // Store the new key
      await this.storeProviderCredential(userId, provider, newKey);
      
      // Clear cache
      await this.clearCredentialCache(userId, provider);
      
      // Log operation
      await this.logCredentialOperation(userId, provider, 'rotate', 'success');
      
      console.log(`✅ Successfully rotated API key for provider: ${provider}`);
    } catch (error) {
      console.error('API key rotation failed:', error);
      await this.logCredentialOperation(userId, provider, 'rotate', 'failure', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  async deleteUserCredentials(userId: string, provider?: string): Promise<void> {
    console.log(`🗑️ Deleting credentials for user: ${userId}${provider ? `, provider: ${provider}` : ''}`);
    
    try {
      if (provider) {
        // Delete specific provider
        await this.database.execute(`
          DELETE FROM user_credentials 
          WHERE user_id = ? AND provider = ?
        `, [userId, provider]);
        
        await this.clearCredentialCache(userId, provider);
        await this.logCredentialOperation(userId, provider, 'delete', 'success');
      } else {
        // Delete all credentials for user
        await this.database.execute(`
          DELETE FROM user_credentials 
          WHERE user_id = ?
        `, [userId]);
        
        await this.clearUserCache(userId);
        await this.logCredentialOperation(userId, 'all', 'delete', 'success');
      }
      
      console.log(`✅ Successfully deleted credentials`);
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      await this.logCredentialOperation(
        userId, 
        provider || 'all', 
        'delete', 
        'failure',
        { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }
  
  private async getExistingCredential(userId: string, provider: string): Promise<any> {
    const results = await this.database.query(`
      SELECT id FROM user_credentials 
      WHERE user_id = ? AND provider = ?
    `, [userId, provider]);
    
    return results.length > 0 ? results[0] : null;
  }
  
  private async getStoredCredential(userId: string, provider: string): Promise<StoredCredential | null> {
    const results = await this.database.query(`
      SELECT * FROM user_credentials 
      WHERE user_id = ? AND provider = ? AND is_active = true
    `, [userId, provider]);
    
    if (results.length === 0) {
      return null;
    }
    
    const row = results[0];
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      encryptedApiKey: JSON.parse(row.encrypted_api_key),
      keyHash: row.key_hash,
      isActive: row.is_active,
      lastValidatedAt: row.last_validated_at,
      validationStatus: row.validation_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  private async validateWithProvider(provider: string, apiKey: string): Promise<ValidationResult> {
    // This is a simplified validation - in production, this would make actual API calls
    // to each provider to validate the API key
    
    const validationPatterns = {
      openai: /^sk-[a-zA-Z0-9]{32,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-]{32,}$/,
      google: /^[a-zA-Z0-9_-]{32,}$/,
      cohere: /^[a-zA-Z0-9]{32,}$/,
      azure: /^[a-f0-9]{32}$/,
      aws: /^[A-Z0-9]{20}$/
    };
    
    const pattern = validationPatterns[provider as keyof typeof validationPatterns];
    const isValid = pattern ? pattern.test(apiKey) : true; // Default to true for unknown providers
    
    // In production, this would make actual API calls:
    // try {
    //   const response = await fetch(`${providerApiUrls[provider]}/test`, {
    //     headers: { Authorization: `Bearer ${apiKey}` }
    //   });
    //   return { isValid: response.ok, lastChecked: new Date() };
    // } catch (error) {
    //   return { isValid: false, errorMessage: error.message, lastChecked: new Date() };
    // }
    
    return {
      isValid,
      lastChecked: new Date(),
      errorMessage: isValid ? undefined : 'Invalid API key format'
    };
  }
  
  private async updateValidationStatus(
    userId: string, 
    provider: string, 
    validationResult: ValidationResult
  ): Promise<void> {
    await this.database.execute(`
      UPDATE user_credentials 
      SET validation_status = ?, last_validated_at = NOW(), updated_at = NOW()
      WHERE user_id = ? AND provider = ?
    `, [
      validationResult.isValid ? 'valid' : 'invalid',
      userId,
      provider
    ]);
  }
  
  private async logCredentialOperation(
    userId: string,
    provider: string,
    operation: string,
    status: 'success' | 'failure',
    metadata?: { ipAddress?: string; userAgent?: string; errorMessage?: string }
  ): Promise<void> {
    try {
      await this.database.execute(`
        INSERT INTO credential_usage_log 
        (user_id, provider, operation, status, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        provider,
        operation,
        status,
        metadata?.ipAddress || null,
        metadata?.userAgent || null
      ]);
    } catch (error) {
      console.error('Failed to log credential operation:', error);
      // Don't throw - logging failure shouldn't break the main operation
    }
  }
  
  private async clearCredentialCache(userId: string, provider: string): Promise<void> {
    const keys = [
      `credentials:${userId}`,
      `credential:${userId}:${provider}`
    ];
    
    await this.redis.del(...keys);
  }
  
  private async clearUserCache(userId: string): Promise<void> {
    const pattern = `*:${userId}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  // Public utility methods
  
  async getUserCredentialStatus(userId: string): Promise<Record<string, any>> {
    const results = await this.database.query(`
      SELECT provider, validation_status, last_validated_at, is_active
      FROM user_credentials 
      WHERE user_id = ?
    `, [userId]);
    
    const status: Record<string, any> = {};
    
    for (const row of results) {
      status[row.provider] = {
        status: row.validation_status,
        lastValidated: row.last_validated_at,
        isActive: row.is_active
      };
    }
    
    return status;
  }
  
  async getCredentialUsageLog(
    userId: string, 
    limit: number = 50
  ): Promise<CredentialOperation[]> {
    const results = await this.database.query(`
      SELECT * FROM credential_usage_log 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit]);
    
    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      operation: row.operation,
      status: row.status,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      errorMessage: row.error_message
    }));
  }
  
  async hasValidCredentials(userId: string, provider?: string): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as count 
      FROM user_credentials 
      WHERE user_id = ? AND is_active = true AND validation_status = 'valid'
    `;
    const params = [userId];
    
    if (provider) {
      query += ' AND provider = ?';
      params.push(provider);
    }
    
    const results = await this.database.query(query, params);
    return results[0].count > 0;
  }
  
  async getAvailableProviders(userId: string): Promise<string[]> {
    const results = await this.database.query(`
      SELECT DISTINCT provider 
      FROM user_credentials 
      WHERE user_id = ? AND is_active = true AND validation_status = 'valid'
    `, [userId]);
    
    return results.map(row => row.provider);
  }
  
  // Health check methods
  
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      // Test database connection
      await this.database.query('SELECT 1');
      
      // Test Redis connection
      await this.redis.ping();
      
      // Test encryption service
      const testData = 'test';
      const testContext = {
        userId: 'test',
        provider: 'test',
        purpose: 'storage' as const
      };
      
      const encrypted = await this.encryptionService.encrypt(testData, testContext);
      const decrypted = await this.encryptionService.decrypt(encrypted, testContext);
      
      if (decrypted !== testData) {
        throw new Error('Encryption/decryption test failed');
      }
      
      return {
        status: 'healthy',
        details: {
          database: 'connected',
          redis: 'connected',
          encryption: 'working'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
  
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}

// Export convenience function
export function createUserCredentialManager(
  database: Database,
  redisUrl?: string,
  masterKeySecret?: string
): UserCredentialManager {
  return new UserCredentialManager(database, redisUrl, masterKeySecret);
}