import { BasePlatformAdapter } from './base-platform-adapter.js';
import {
  IUniversalCredential,
  ICredentialData,
  IValidationResult,
  ICredentialUsage,
  IUsageStats,
  PlatformType,
  IOperationStat
} from '../interfaces/credential-interfaces.js';

/**
 * Zapier Platform Adapter
 * 
 * Handles credential management specific to Zapier automation platform
 */
export class ZapierPlatformAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'zapier';
  
  private readonly supportedProviders = [
    'openai', 'anthropic', 'google', 'cohere', 'custom'
  ];
  
  private readonly zapierAuthTypes: Record<string, string> = {
    api_key: 'api_key',
    oauth2: 'oauth2',
    basic_auth: 'basic',
    bearer_token: 'bearer',
    custom: 'custom'
  };

  constructor(config?: any) {
    super(config);
  }

  /**
   * Transform credential data for Zapier format
   */
  async transformCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<any> {
    // Transform to Zapier credential format
    const zapierCredential: any = {
      name: credential.name,
      authType: this.zapierAuthTypes[credential.type] || 'custom',
      fields: {}
    };

    // Map fields based on provider and type
    switch (credential.type) {
      case 'api_key':
        zapierCredential.fields = {
          api_key: data.apiKey,
          ...(data.endpoint && { base_url: data.endpoint })
        };
        break;
      
      case 'oauth2':
        zapierCredential.fields = {
          access_token: data.token,
          refresh_token: data.refreshToken,
          client_id: data.clientId,
          client_secret: data.clientSecret
        };
        break;
      
      case 'basic_auth':
        zapierCredential.fields = {
          username: data.username,
          password: data.password
        };
        break;
      
      case 'bearer_token':
        zapierCredential.fields = {
          token: data.token
        };
        break;
      
      default:
        // Map all custom fields
        zapierCredential.fields = {
          ...data.customFields,
          ...(data.apiKey && { api_key: data.apiKey }),
          ...(data.endpoint && { base_url: data.endpoint })
        };
    }

    // Add provider-specific fields
    switch (credential.provider) {
      case 'openai':
        zapierCredential.app = 'openai';
        if (data.organizationId) {
          zapierCredential.fields.organization_id = data.organizationId;
        }
        break;
      
      case 'anthropic':
        zapierCredential.app = 'anthropic';
        zapierCredential.fields.anthropic_version = '2023-06-01';
        break;
      
      case 'google':
        zapierCredential.app = 'google_ai';
        if (data.projectId) {
          zapierCredential.fields.project_id = data.projectId;
        }
        break;
      
      case 'cohere':
        zapierCredential.app = 'cohere';
        break;
      
      default:
        zapierCredential.app = 'custom';
    }

    // Add metadata for Zapier
    zapierCredential.metadata = {
      created_at: credential.createdAt,
      updated_at: credential.updatedAt,
      environment: credential.metadata.environment || 'production',
      tags: credential.metadata.tags
    };

    return zapierCredential;
  }

  /**
   * Track usage for Zapier integrations
   */
  async trackUsage(usage: ICredentialUsage): Promise<void> {
    // Store usage data for Zapier zaps
    if (this.config?.usageTracker) {
      await this.config.usageTracker.track({
        ...usage,
        platform: 'zapier',
        zapId: usage.metadata?.zapId,
        taskId: usage.metadata?.taskId,
        stepId: usage.metadata?.stepId
      });
    }
  }

  /**
   * Get usage statistics for Zapier
   */
  async getUsageStats(credentialId: string, period: Date): Promise<IUsageStats> {
    const endDate = new Date();
    const stats: IUsageStats = {
      credentialId,
      period: {
        start: period,
        end: endDate
      },
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      errorRate: 0,
      topOperations: []
    };

    // Query Zapier-specific usage data
    if (this.config?.usageTracker) {
      const usageData = await this.config.usageTracker.getStats(credentialId, period, endDate);
      
      stats.totalRequests = usageData.totalRequests;
      stats.successfulRequests = usageData.successfulRequests;
      stats.failedRequests = usageData.failedRequests;
      stats.averageResponseTime = usageData.averageResponseTime;
      stats.totalTokensUsed = usageData.totalTokensUsed;
      stats.totalCost = usageData.totalCost;
      stats.errorRate = stats.totalRequests > 0 
        ? (stats.failedRequests / stats.totalRequests) * 100 
        : 0;
      
      // Group by Zap
      const zapMap = new Map<string, IOperationStat>();
      for (const record of usageData.records) {
        const zapId = record.metadata?.zapId || 'unknown';
        const op = zapMap.get(zapId) || {
          operation: `Zap: ${zapId}`,
          count: 0,
          averageResponseTime: 0,
          successRate: 0,
          totalCost: 0
        };
        
        op.count++;
        op.totalCost += record.cost || 0;
        op.averageResponseTime = 
          (op.averageResponseTime * (op.count - 1) + record.responseTime) / op.count;
        
        if (record.success) {
          op.successRate = ((op.successRate * (op.count - 1)) + 100) / op.count;
        } else {
          op.successRate = (op.successRate * (op.count - 1)) / op.count;
        }
        
        zapMap.set(zapId, op);
      }
      
      stats.topOperations = Array.from(zapMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return stats;
  }

  /**
   * Test connection for Zapier credential
   */
  async testConnection(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<boolean> {
    try {
      // For Zapier, we validate the credential format
      // Actual API testing would be done by Zapier's platform
      
      switch (credential.type) {
        case 'api_key':
          return !!data.apiKey && data.apiKey.length > 0;
        
        case 'oauth2':
          return !!data.token && !!data.clientId;
        
        case 'basic_auth':
          return !!data.username && !!data.password;
        
        case 'bearer_token':
          return !!data.token;
        
        default:
          // For custom auth, just check if there's some data
          return Object.keys(data).length > 0;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get capabilities for Zapier integrations
   */
  async getCapabilities(credential: IUniversalCredential): Promise<string[]> {
    const capabilities: string[] = [
      'zap_execution',
      'trigger_support',
      'action_support',
      'search_support',
      'webhook_support'
    ];

    // Add provider-specific capabilities
    switch (credential.provider) {
      case 'openai':
        capabilities.push(
          'ai_text_generation',
          'ai_chat',
          'ai_embeddings',
          'ai_image_generation'
        );
        break;
      
      case 'anthropic':
        capabilities.push(
          'ai_text_generation',
          'ai_chat',
          'ai_function_calling'
        );
        break;
      
      case 'google':
        capabilities.push(
          'ai_text_generation',
          'ai_chat',
          'ai_embeddings'
        );
        break;
      
      case 'cohere':
        capabilities.push(
          'ai_text_generation',
          'ai_embeddings',
          'ai_classification'
        );
        break;
    }

    // Add auth-specific capabilities
    switch (credential.type) {
      case 'oauth2':
        capabilities.push('oauth_refresh', 'token_management');
        break;
      
      case 'api_key':
        capabilities.push('api_key_auth');
        break;
      
      case 'basic_auth':
        capabilities.push('basic_auth');
        break;
    }

    return capabilities;
  }

  /**
   * Refresh OAuth2 credentials if supported
   */
  async refreshCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<ICredentialData> {
    if (credential.type !== 'oauth2' || !data.refreshToken) {
      return data;
    }

    try {
      // This would integrate with Zapier's OAuth refresh mechanism
      // For now, we'll simulate the refresh
      
      if (this.config?.oauthRefresher) {
        const newTokens = await this.config.oauthRefresher.refresh({
          clientId: data.clientId!,
          clientSecret: data.clientSecret!,
          refreshToken: data.refreshToken,
          provider: credential.provider
        });

        return {
          ...data,
          token: newTokens.accessToken,
          refreshToken: newTokens.refreshToken || data.refreshToken,
          expiresAt: newTokens.expiresAt
        };
      }

      return data;
    } catch (error) {
      console.error('Failed to refresh credential:', error);
      throw new Error('OAuth refresh failed');
    }
  }

  /**
   * Perform validation for Zapier credential
   */
  protected async performValidation(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<IValidationResult> {
    const errors = [];

    // Check if provider is supported
    if (credential.provider !== 'custom' && !this.supportedProviders.includes(credential.provider)) {
      errors.push(this.createValidationError(
        'UNSUPPORTED_PROVIDER',
        `Provider '${credential.provider}' is not supported in Zapier`,
        'provider',
        `Supported providers: ${this.supportedProviders.join(', ')}`
      ));
    }

    // Validate based on auth type
    switch (credential.type) {
      case 'api_key':
        if (!data.apiKey) {
          errors.push(this.createValidationError(
            'MISSING_API_KEY',
            'API key is required',
            'apiKey'
          ));
        }
        break;
      
      case 'oauth2':
        const oauthFields = ['token', 'clientId'];
        for (const field of oauthFields) {
          if (!data[field as keyof ICredentialData]) {
            errors.push(this.createValidationError(
              'MISSING_OAUTH_FIELD',
              `OAuth field '${field}' is required`,
              field
            ));
          }
        }
        break;
      
      case 'basic_auth':
        if (!data.username || !data.password) {
          errors.push(this.createValidationError(
            'MISSING_BASIC_AUTH',
            'Username and password are required',
            'username'
          ));
        }
        break;
      
      case 'bearer_token':
        if (!data.token) {
          errors.push(this.createValidationError(
            'MISSING_BEARER_TOKEN',
            'Bearer token is required',
            'token'
          ));
        }
        break;
    }

    // Validate Zapier-specific requirements
    if (credential.metadata.environment === 'production' && !credential.name) {
      errors.push(this.createValidationError(
        'MISSING_NAME',
        'Credential name is required for production use',
        'name'
      ));
    }

    // Test connection if no errors
    if (errors.length === 0) {
      const connectionValid = await this.testConnection(credential, data);
      if (!connectionValid) {
        errors.push(this.createValidationError(
          'INVALID_CREDENTIAL_FORMAT',
          'Credential format is invalid for Zapier',
          undefined,
          'Please check your credential configuration'
        ));
      }
    }

    return this.createValidationResult(
      credential.id,
      errors.length === 0 ? 'valid' : 'invalid',
      errors.length > 0 ? errors : undefined
    );
  }

  /**
   * Get Zapier-specific metadata
   */
  getZapierMetadata(credential: IUniversalCredential): any {
    return {
      app: this.mapProviderToZapierApp(credential.provider),
      authType: this.zapierAuthTypes[credential.type],
      scopes: this.getRequiredScopes(credential.provider),
      triggers: this.getSupportedTriggers(credential.provider),
      actions: this.getSupportedActions(credential.provider)
    };
  }

  /**
   * Map provider to Zapier app
   */
  private mapProviderToZapierApp(provider: string): string {
    const appMap: Record<string, string> = {
      openai: 'openai',
      anthropic: 'claude',
      google: 'google-ai',
      cohere: 'cohere',
      custom: 'webhooks'
    };

    return appMap[provider] || 'custom';
  }

  /**
   * Get required OAuth scopes
   */
  private getRequiredScopes(provider: string): string[] {
    switch (provider) {
      case 'google':
        return ['https://www.googleapis.com/auth/generative-language'];
      default:
        return [];
    }
  }

  /**
   * Get supported triggers
   */
  private getSupportedTriggers(provider: string): string[] {
    // Most AI providers don't have triggers in Zapier
    return ['webhook'];
  }

  /**
   * Get supported actions
   */
  private getSupportedActions(provider: string): string[] {
    switch (provider) {
      case 'openai':
        return [
          'create_completion',
          'create_chat_completion',
          'create_embedding',
          'create_image',
          'create_transcription'
        ];
      
      case 'anthropic':
        return [
          'create_message',
          'create_completion'
        ];
      
      case 'google':
        return [
          'generate_text',
          'generate_chat',
          'create_embedding'
        ];
      
      case 'cohere':
        return [
          'generate',
          'embed',
          'classify',
          'rerank'
        ];
      
      default:
        return ['custom_request'];
    }
  }
}

// Export factory function
export function createZapierPlatformAdapter(config?: any): ZapierPlatformAdapter {
  return new ZapierPlatformAdapter(config);
}