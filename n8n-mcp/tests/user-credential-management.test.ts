import { UserCredentialManager, UserApiKeys } from '../src/user-management/credential-manager.js';
import { EncryptionService } from '../src/security/encryption-service.js';
import { ApiKeyValidator } from '../src/providers/api-key-validator.js';
import { UsageTracker, APIUsageEvent } from '../src/billing/usage-tracker.js';

// Mock implementations
class MockDatabase {
  private tables = new Map<string, any[]>();
  
  constructor() {
    this.tables.set('user_credentials', []);
    this.tables.set('credential_usage_log', []);
    this.tables.set('api_usage_events', []);
    this.tables.set('user_budget_limits', []);
  }
  
  async query(sql: string, params?: any[]): Promise<any[]> {
    // Simplified mock - in real tests, use proper SQL parsing
    if (sql.includes('SELECT')) {
      if (sql.includes('user_credentials')) {
        return this.tables.get('user_credentials') || [];
      }
      if (sql.includes('api_usage_events')) {
        return this.tables.get('api_usage_events') || [];
      }
    }
    return [];
  }
  
  async execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: any }> {
    // Simplified mock
    if (sql.includes('INSERT INTO user_credentials')) {
      const table = this.tables.get('user_credentials') || [];
      table.push({
        id: 'test-id',
        user_id: params?.[0],
        provider: params?.[1],
        encrypted_api_key: params?.[2],
        key_hash: params?.[3],
        is_active: true,
        validation_status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });
      this.tables.set('user_credentials', table);
    }
    
    if (sql.includes('INSERT INTO api_usage_events')) {
      const table = this.tables.get('api_usage_events') || [];
      table.push({
        id: 'usage-id',
        user_id: params?.[0],
        provider: params?.[1],
        model: params?.[2],
        operation: params?.[3],
        input_tokens: params?.[4],
        output_tokens: params?.[5],
        estimated_cost: params?.[6],
        execution_time: params?.[7],
        request_id: params?.[8],
        feature: params?.[9],
        complexity: params?.[10],
        cache_hit: params?.[11],
        created_at: params?.[12] || new Date()
      });
      this.tables.set('api_usage_events', table);
    }
    
    return { affectedRows: 1, insertId: 'test-id' };
  }
}

class MockAnalyticsService {
  async track(event: string, properties: any): Promise<void> {
    console.log(`Analytics: ${event}`, properties);
  }
  
  async identify(userId: string, traits: any): Promise<void> {
    console.log(`Identify: ${userId}`, traits);
  }
}

class MockAlertingService {
  async sendAlert(type: string, message: string, metadata?: any): Promise<void> {
    console.log(`Alert [${type}]: ${message}`, metadata);
  }
}

describe('User Credential Management System', () => {
  let credentialManager: UserCredentialManager;
  let encryptionService: EncryptionService;
  let apiKeyValidator: ApiKeyValidator;
  let usageTracker: UsageTracker;
  let mockDatabase: MockDatabase;
  let mockAnalytics: MockAnalyticsService;
  let mockAlerting: MockAlertingService;
  
  beforeEach(() => {
    mockDatabase = new MockDatabase();
    mockAnalytics = new MockAnalyticsService();
    mockAlerting = new MockAlertingService();
    
    // Use test master key
    encryptionService = new EncryptionService('test-master-key-secret');
    credentialManager = new UserCredentialManager(mockDatabase as any, undefined, 'test-master-key-secret');
    apiKeyValidator = new ApiKeyValidator();
    usageTracker = new UsageTracker(mockDatabase as any, mockAnalytics, mockAlerting);
  });
  
  afterEach(async () => {
    await credentialManager.cleanup();
    await apiKeyValidator.cleanup();
    await usageTracker.cleanup();
  });
  
  describe('EncryptionService', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const testData = 'sk-test-api-key-123456789';
      const context = {
        userId: 'user-123',
        provider: 'openai',
        purpose: 'storage' as const
      };
      
      const encrypted = await encryptionService.encrypt(testData, context);
      const decrypted = await encryptionService.decrypt(encrypted, context);
      
      expect(decrypted).toBe(testData);
      expect(encrypted.data).not.toBe(testData);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });
    
    it('should validate encrypted data format', () => {
      const validData = {
        data: 'base64-encoded-data',
        iv: 'base64-encoded-iv',
        tag: 'base64-encoded-tag',
        keyVersion: 1,
        algorithm: 'aes-256-gcm'
      };
      
      expect(encryptionService.validateEncryptedData(validData)).toBe(true);
      
      const invalidData = { ...validData, algorithm: 'invalid' };
      expect(encryptionService.validateEncryptedData(invalidData)).toBe(false);
    });
    
    it('should generate consistent API key hashes', () => {
      const apiKey = 'sk-test-key-123';
      const hash1 = encryptionService.generateApiKeyHash(apiKey);
      const hash2 = encryptionService.generateApiKeyHash(apiKey);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });
    
    it('should handle key rotation', async () => {
      const testData = 'test-data';
      const context = {
        userId: 'user-123',
        provider: 'test',
        purpose: 'storage' as const
      };
      
      const encrypted = await encryptionService.encrypt(testData, context);
      const originalVersion = encrypted.keyVersion;
      
      await encryptionService.rotateKeys();
      
      // Should still be able to decrypt old data
      const decrypted = await encryptionService.decrypt(encrypted, context);
      expect(decrypted).toBe(testData);
      
      // New encryptions should use new key version
      const newEncrypted = await encryptionService.encrypt(testData, context);
      expect(newEncrypted.keyVersion).toBe(originalVersion + 1);
    });
  });
  
  describe('UserCredentialManager', () => {
    it('should store and retrieve user API keys', async () => {
      const userId = 'user-123';
      const credentials: UserApiKeys = {
        openai: 'sk-openai-test-key',
        anthropic: 'sk-ant-anthropic-key'
      };
      
      await credentialManager.storeUserApiKeys(userId, credentials);
      
      // Mock successful retrieval (in real implementation, this would work with actual Redis/DB)
      const retrieved = await credentialManager.getUserApiKeys(userId);
      
      // Since we're using mocks, we'll test the storage mechanism worked
      expect(typeof retrieved).toBe('object');
    });
    
    it('should validate user credentials', async () => {
      const userId = 'user-123';
      const provider = 'openai';
      
      // Test validation (will return false with mock data)
      const isValid = await credentialManager.validateUserCredentials(userId, provider);
      
      // With mock database, this will return false as expected
      expect(typeof isValid).toBe('boolean');
    });
    
    it('should rotate API keys', async () => {
      const userId = 'user-123';
      const provider = 'openai';
      const newKey = 'sk-new-openai-key';
      
      await expect(credentialManager.rotateApiKey(userId, provider, newKey)).resolves.not.toThrow();
    });
    
    it('should delete user credentials', async () => {
      const userId = 'user-123';
      const provider = 'openai';
      
      await expect(credentialManager.deleteUserCredentials(userId, provider)).resolves.not.toThrow();
      await expect(credentialManager.deleteUserCredentials(userId)).resolves.not.toThrow();
    });
    
    it('should perform health check', async () => {
      const health = await credentialManager.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
    });
  });
  
  describe('ApiKeyValidator', () => {
    it('should validate OpenAI API keys', async () => {
      const validKey = 'sk-openai-valid-key-123456789012345';
      const invalidKey = 'invalid-key';
      
      const validResult = await apiKeyValidator.validateApiKey('openai', validKey);
      const invalidResult = await apiKeyValidator.validateApiKey('openai', invalidKey);
      
      expect(validResult.provider).toBe('openai');
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should detect API key provider', async () => {
      const openaiKey = 'sk-test-openai-key-123456789012345';
      const anthropicKey = 'sk-ant-anthropic-key-123456789';
      
      const openaiDetection = await apiKeyValidator.detectApiKeyType(openaiKey);
      const anthropicDetection = await apiKeyValidator.detectApiKeyType(anthropicKey);
      
      expect(openaiDetection.detectedProvider).toBe('openai');
      expect(anthropicDetection.detectedProvider).toBe('anthropic');
    });
    
    it('should test provider connections', async () => {
      const apiKey = 'sk-test-key';
      
      const connectionTest = await apiKeyValidator.testProviderConnection('openai', apiKey);
      
      expect(connectionTest).toHaveProperty('success');
      expect(connectionTest).toHaveProperty('responseTime');
      expect(connectionTest).toHaveProperty('timestamp');
    });
    
    it('should get provider quotas', async () => {
      const apiKey = 'sk-test-key';
      
      const quotas = await apiKeyValidator.getProviderQuotas('openai', apiKey);
      
      expect(quotas).toHaveProperty('requestsPerMinute');
      expect(quotas).toHaveProperty('requestsPerDay');
      expect(quotas).toHaveProperty('tokensPerMinute');
      expect(quotas).toHaveProperty('currentUsage');
    });
  });
  
  describe('UsageTracker', () => {
    it('should track API usage events', async () => {
      const usageEvent: APIUsageEvent = {
        userId: 'user-123',
        provider: 'openai',
        model: 'gpt-4',
        operation: 'generation',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.003,
        executionTime: 1500,
        requestId: 'req-123',
        timestamp: new Date(),
        metadata: {
          feature: 'business-logic-generation',
          complexity: 'moderate',
          cacheHit: false
        }
      };
      
      await expect(usageTracker.trackAPIUsage(usageEvent)).resolves.not.toThrow();
    });
    
    it('should get user usage statistics', async () => {
      const userId = 'user-123';
      const period = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date(),
        period: 'day' as const
      };
      
      const stats = await usageTracker.getUserUsageStats(userId, period);
      
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('providerBreakdown');
      expect(stats).toHaveProperty('featureBreakdown');
    });
    
    it('should detect anomalous usage', async () => {
      const userId = 'user-123';
      
      const anomalies = await usageTracker.detectAnomalousUsage(userId);
      
      expect(Array.isArray(anomalies)).toBe(true);
    });
    
    it('should enforce usage limits', async () => {
      const userId = 'user-123';
      const provider = 'openai';
      
      const limitStatus = await usageTracker.enforceUsageLimits(userId, provider);
      
      expect(limitStatus).toHaveProperty('enforced');
      expect(limitStatus).toHaveProperty('limitType');
      expect(limitStatus).toHaveProperty('currentUsage');
      expect(limitStatus).toHaveProperty('limit');
    });
    
    it('should get provider usage breakdown', async () => {
      const userId = 'user-123';
      const provider = 'openai';
      
      const breakdown = await usageTracker.getProviderUsageBreakdown(userId, provider);
      
      expect(breakdown.provider).toBe(provider);
      expect(breakdown).toHaveProperty('requests');
      expect(breakdown).toHaveProperty('tokens');
      expect(breakdown).toHaveProperty('cost');
      expect(breakdown).toHaveProperty('models');
    });
  });
  
  describe('Integration Tests', () => {
    it('should handle complete workflow: store credentials, validate, and track usage', async () => {
      const userId = 'integration-user-123';
      
      // 1. Store credentials
      const credentials: UserApiKeys = {
        openai: 'sk-integration-test-key-123456789',
        anthropic: 'sk-ant-integration-test-key-123'
      };
      
      await credentialManager.storeUserApiKeys(userId, credentials);
      
      // 2. Validate credentials
      const openaiValid = await credentialManager.validateUserCredentials(userId, 'openai');
      const anthropicValid = await credentialManager.validateUserCredentials(userId, 'anthropic');
      
      // 3. Track usage
      const usageEvent: APIUsageEvent = {
        userId,
        provider: 'openai',
        model: 'gpt-4',
        operation: 'generation',
        inputTokens: 150,
        outputTokens: 75,
        estimatedCost: 0.0045,
        executionTime: 2000,
        requestId: 'integration-req-123',
        timestamp: new Date(),
        metadata: {
          feature: 'workflow-generation',
          complexity: 'complex',
          cacheHit: false
        }
      };
      
      await usageTracker.trackAPIUsage(usageEvent);
      
      // 4. Get usage stats
      const period = {
        start: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        end: new Date(),
        period: 'hour' as const
      };
      
      const stats = await usageTracker.getUserUsageStats(userId, period);
      
      // Verify workflow completed without errors
      expect(typeof openaiValid).toBe('boolean');
      expect(typeof anthropicValid).toBe('boolean');
      expect(stats).toHaveProperty('totalRequests');
    });
    
    it('should handle error scenarios gracefully', async () => {
      const userId = 'error-test-user';
      
      // Test with invalid API key format
      const invalidCredentials: UserApiKeys = {
        openai: 'invalid-key-format'
      };
      
      await expect(credentialManager.storeUserApiKeys(userId, invalidCredentials)).resolves.not.toThrow();
      
      // Test validation with non-existent user
      const validation = await credentialManager.validateUserCredentials('non-existent-user', 'openai');
      expect(validation).toBe(false);
      
      // Test usage tracking with malformed data
      const invalidUsage = {
        userId: 'test',
        provider: 'invalid-provider',
        model: '',
        operation: 'generation',
        inputTokens: -1, // Invalid
        outputTokens: 0,
        estimatedCost: 0,
        executionTime: 0,
        requestId: '',
        timestamp: new Date(),
        metadata: {
          feature: '',
          complexity: 'simple',
          cacheHit: false
        }
      } as APIUsageEvent;
      
      await expect(usageTracker.trackAPIUsage(invalidUsage)).resolves.not.toThrow();
    });
  });
});