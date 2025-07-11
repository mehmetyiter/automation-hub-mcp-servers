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
 * Make.com Platform Adapter
 * 
 * Handles credential management specific to Make.com (formerly Integromat) automation platform
 */
export class MakePlatformAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'make';
  
  private readonly supportedProviders = [
    'openai', 'anthropic', 'google', 'cohere', 'azure', 'custom'
  ];
  
  private readonly makeConnectionTypes: Record<string, string> = {
    api_key: 'apikey',
    oauth2: 'oauth',
    basic_auth: 'basic',
    bearer_token: 'token',
    custom: 'other'
  };

  constructor(config?: any) {
    super(config);
  }

  /**
   * Transform credential data for Make.com format
   */
  async transformCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<any> {
    // Transform to Make.com connection format
    const makeConnection: any = {
      name: credential.name,
      type: this.makeConnectionTypes[credential.type] || 'other',
      data: {},
      metadata: {
        provider: credential.provider,
        created: credential.createdAt,
        updated: credential.updatedAt,
        environment: credential.metadata.environment || 'production'
      }
    };

    // Map common fields based on connection type
    switch (credential.type) {
      case 'api_key':
        makeConnection.data = {
          apiKey: data.apiKey,
          ...(data.endpoint && { url: data.endpoint })
        };
        break;
      
      case 'oauth2':
        makeConnection.data = {
          accessToken: data.token,
          refreshToken: data.refreshToken,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          tokenType: 'Bearer',
          expiresIn: 3600 // Default expiry
        };
        break;
      
      case 'basic_auth':
        makeConnection.data = {
          username: data.username,
          password: data.password,
          ...(data.endpoint && { url: data.endpoint })
        };
        break;
      
      case 'bearer_token':
        makeConnection.data = {
          token: data.token,
          tokenType: 'Bearer',
          ...(data.endpoint && { url: data.endpoint })
        };
        break;
    }

    // Add provider-specific mappings for Make.com modules
    switch (credential.provider) {
      case 'openai':
        makeConnection.app = 'openai';
        makeConnection.data = {
          ...makeConnection.data,
          organizationId: data.organizationId || '',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048
        };
        break;
      
      case 'anthropic':
        makeConnection.app = 'anthropic';
        makeConnection.data = {
          ...makeConnection.data,
          anthropicVersion: '2023-06-01',
          model: 'claude-3-opus-20240229',
          maxTokens: 4096
        };
        break;
      
      case 'google':
        makeConnection.app = 'google-generative-ai';
        makeConnection.data = {
          ...makeConnection.data,
          projectId: data.projectId || '',
          location: data.region || 'us-central1',
          model: 'gemini-pro'
        };
        break;
      
      case 'cohere':
        makeConnection.app = 'cohere';
        makeConnection.data = {
          ...makeConnection.data,
          model: 'command',
          temperature: 0.7
        };
        break;
      
      case 'azure':
        makeConnection.app = 'azure-openai';
        makeConnection.data = {
          ...makeConnection.data,
          resourceName: data.endpoint?.match(/https:\/\/(.+?)\.openai\.azure\.com/)?.[1] || '',
          deploymentId: data.customFields?.deploymentName || '',
          apiVersion: '2023-12-01-preview'
        };
        break;
      
      default:
        makeConnection.app = 'http';
        makeConnection.data = {
          ...makeConnection.data,
          ...data.customFields
        };
    }

    // Add Make.com specific settings
    makeConnection.settings = {
      timeout: 30000, // 30 seconds
      retries: 3,
      headers: this.getDefaultHeaders(credential.provider),
      rateLimit: this.getRateLimitSettings(credential.provider)
    };

    return makeConnection;
  }

  /**
   * Track usage for Make.com scenarios
   */
  async trackUsage(usage: ICredentialUsage): Promise<void> {
    // Store usage data for Make.com scenarios
    if (this.config?.usageTracker) {
      await this.config.usageTracker.track({
        ...usage,
        platform: 'make',
        scenarioId: usage.metadata?.scenarioId,
        executionId: usage.metadata?.executionId,
        moduleId: usage.metadata?.moduleId,
        organizationId: usage.metadata?.organizationId
      });
    }
  }

  /**
   * Get usage statistics for Make.com
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

    // Query Make.com-specific usage data
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
      
      // Group by scenario
      const scenarioMap = new Map<string, IOperationStat>();
      for (const record of usageData.records) {
        const scenarioId = record.metadata?.scenarioId || 'unknown';
        const op = scenarioMap.get(scenarioId) || {
          operation: `Scenario: ${scenarioId}`,
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
        
        scenarioMap.set(scenarioId, op);
      }
      
      // Add module-level statistics
      const moduleStats = this.aggregateModuleStats(usageData.records);
      
      stats.topOperations = [
        ...Array.from(scenarioMap.values()),
        ...moduleStats
      ]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return stats;
  }

  /**
   * Test connection for Make.com credential
   */
  async testConnection(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<boolean> {
    try {
      // Test based on connection type and provider
      switch (credential.type) {
        case 'api_key':
          if (!data.apiKey) return false;
          
          // For known providers, test the actual API
          if (credential.provider === 'openai') {
            return await this.testOpenAIConnection(data);
          } else if (credential.provider === 'anthropic') {
            return await this.testAnthropicConnection(data);
          }
          
          return true;
        
        case 'oauth2':
          // Validate OAuth2 fields
          return !!(data.token && data.clientId);
        
        case 'basic_auth':
          return !!(data.username && data.password);
        
        case 'bearer_token':
          return !!data.token;
        
        default:
          return Object.keys(data).length > 0;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get capabilities for Make.com modules
   */
  async getCapabilities(credential: IUniversalCredential): Promise<string[]> {
    const capabilities: string[] = [
      'scenario_execution',
      'module_support',
      'webhook_support',
      'data_store_support',
      'error_handling',
      'instant_triggers',
      'scheduled_execution'
    ];

    // Add provider-specific module capabilities
    switch (credential.provider) {
      case 'openai':
        capabilities.push(
          'gpt_completions',
          'chat_completions',
          'embeddings',
          'dalle_images',
          'whisper_transcription',
          'moderation',
          'fine_tuning'
        );
        break;
      
      case 'anthropic':
        capabilities.push(
          'claude_messages',
          'claude_completions',
          'vision_analysis',
          'function_calling'
        );
        break;
      
      case 'google':
        capabilities.push(
          'gemini_generation',
          'palm_chat',
          'embeddings',
          'vision_understanding'
        );
        break;
      
      case 'cohere':
        capabilities.push(
          'text_generation',
          'embeddings',
          'classification',
          'reranking',
          'summarization'
        );
        break;
      
      case 'azure':
        capabilities.push(
          'azure_openai_completions',
          'azure_embeddings',
          'azure_dalle'
        );
        break;
    }

    // Add Make.com specific features
    capabilities.push(
      'data_transformation',
      'json_parsing',
      'array_operations',
      'text_parsing',
      'date_operations',
      'math_operations',
      'flow_control'
    );

    return capabilities;
  }

  /**
   * Perform validation for Make.com credential
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
        `Provider '${credential.provider}' is not supported in Make.com`,
        'provider',
        `Supported providers: ${this.supportedProviders.join(', ')}`
      ));
    }

    // Validate connection type requirements
    switch (credential.type) {
      case 'api_key':
        if (!data.apiKey) {
          errors.push(this.createValidationError(
            'MISSING_API_KEY',
            'API key is required for Make.com connection',
            'apiKey'
          ));
        }
        
        // Validate API key format for known providers
        if (data.apiKey && credential.provider !== 'custom') {
          const pattern = this.getApiKeyPattern(credential.provider);
          if (pattern && !pattern.test(data.apiKey)) {
            errors.push(this.createValidationError(
              'INVALID_API_KEY_FORMAT',
              'API key format is invalid for the selected provider',
              'apiKey',
              'Please check your API key format'
            ));
          }
        }
        break;
      
      case 'oauth2':
        const requiredOAuthFields = ['token', 'clientId'];
        for (const field of requiredOAuthFields) {
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
            'MISSING_AUTH_CREDENTIALS',
            'Username and password are required',
            data.username ? 'password' : 'username'
          ));
        }
        break;
    }

    // Validate Make.com specific requirements
    if (data.endpoint) {
      try {
        new URL(data.endpoint);
      } catch {
        errors.push(this.createValidationError(
          'INVALID_ENDPOINT',
          'Endpoint URL is invalid',
          'endpoint',
          'Please provide a valid URL'
        ));
      }
    }

    // Test connection if no errors
    if (errors.length === 0) {
      const connectionValid = await this.testConnection(credential, data);
      if (!connectionValid) {
        errors.push(this.createValidationError(
          'CONNECTION_TEST_FAILED',
          'Failed to establish connection with the provider',
          undefined,
          'Please verify your credentials and try again'
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
   * Get default headers for provider
   */
  private getDefaultHeaders(provider: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Make.com/1.0'
    };

    switch (provider) {
      case 'anthropic':
        headers['anthropic-version'] = '2023-06-01';
        break;
      
      case 'openai':
        headers['OpenAI-Beta'] = 'assistants=v1';
        break;
    }

    return headers;
  }

  /**
   * Get rate limit settings for provider
   */
  private getRateLimitSettings(provider: string): any {
    switch (provider) {
      case 'openai':
        return {
          requests: 3000,
          window: 60000, // 1 minute
          maxConcurrent: 50
        };
      
      case 'anthropic':
        return {
          requests: 1000,
          window: 60000,
          maxConcurrent: 25
        };
      
      case 'google':
        return {
          requests: 60,
          window: 60000,
          maxConcurrent: 10
        };
      
      default:
        return {
          requests: 100,
          window: 60000,
          maxConcurrent: 10
        };
    }
  }

  /**
   * Get API key pattern for provider
   */
  private getApiKeyPattern(provider: string): RegExp | null {
    switch (provider) {
      case 'openai':
        return /^sk-[a-zA-Z0-9]{48}$/;
      case 'anthropic':
        return /^sk-ant-[a-zA-Z0-9-]+$/;
      case 'google':
        return /^[a-zA-Z0-9-_]{39}$/;
      case 'cohere':
        return /^[a-zA-Z0-9]{40}$/;
      default:
        return null;
    }
  }

  /**
   * Test OpenAI connection
   */
  private async testOpenAIConnection(data: ICredentialData): Promise<boolean> {
    try {
      const response = await fetch(
        `${data.endpoint || 'https://api.openai.com/v1'}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${data.apiKey}`
          }
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test Anthropic connection
   */
  private async testAnthropicConnection(data: ICredentialData): Promise<boolean> {
    try {
      const response = await fetch(
        `${data.endpoint || 'https://api.anthropic.com/v1'}/messages`,
        {
          method: 'POST',
          headers: {
            'x-api-key': data.apiKey!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          })
        }
      );
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  /**
   * Aggregate module-level statistics
   */
  private aggregateModuleStats(records: any[]): IOperationStat[] {
    const moduleMap = new Map<string, IOperationStat>();
    
    for (const record of records) {
      const moduleId = record.metadata?.moduleId || 'unknown';
      const op = moduleMap.get(moduleId) || {
        operation: `Module: ${moduleId}`,
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
      
      moduleMap.set(moduleId, op);
    }
    
    return Array.from(moduleMap.values());
  }

  /**
   * Get Make.com specific metadata
   */
  getMakeMetadata(credential: IUniversalCredential): any {
    return {
      app: this.mapProviderToMakeApp(credential.provider),
      connectionType: this.makeConnectionTypes[credential.type],
      modules: this.getSupportedModules(credential.provider),
      triggers: this.getSupportedTriggers(credential.provider),
      maxExecutionTime: 40, // seconds
      dataTransferLimit: 5, // MB
      features: this.getMakeFeatures(credential.provider)
    };
  }

  /**
   * Map provider to Make.com app
   */
  private mapProviderToMakeApp(provider: string): string {
    const appMap: Record<string, string> = {
      openai: 'openai',
      anthropic: 'anthropic',
      google: 'google-ai',
      cohere: 'cohere',
      azure: 'azure-openai',
      custom: 'http'
    };
    return appMap[provider] || 'http';
  }

  /**
   * Get supported modules for provider
   */
  private getSupportedModules(provider: string): string[] {
    switch (provider) {
      case 'openai':
        return [
          'createCompletion',
          'createChatCompletion',
          'createEmbedding',
          'createImage',
          'createImageEdit',
          'createTranscription',
          'createTranslation',
          'listModels'
        ];
      
      case 'anthropic':
        return [
          'createMessage',
          'createCompletion',
          'streamMessage'
        ];
      
      case 'google':
        return [
          'generateContent',
          'generateChat',
          'embedContent',
          'countTokens'
        ];
      
      default:
        return ['makeAPICall'];
    }
  }

  /**
   * Get supported triggers for provider
   */
  private getSupportedTriggers(provider: string): string[] {
    // Most AI providers don't have native triggers
    return ['webhook', 'schedule'];
  }

  /**
   * Get Make.com features for provider
   */
  private getMakeFeatures(provider: string): string[] {
    const commonFeatures = [
      'error_handling',
      'retries',
      'timeouts',
      'data_mapping',
      'filtering',
      'routing'
    ];

    const providerFeatures: Record<string, string[]> = {
      openai: ['streaming', 'function_calling', 'fine_tuning'],
      anthropic: ['streaming', 'function_calling'],
      google: ['streaming', 'safety_settings'],
      cohere: ['streaming', 'connectors']
    };

    return [...commonFeatures, ...(providerFeatures[provider] || [])];
  }
}

// Export factory function
export function createMakePlatformAdapter(config?: any): MakePlatformAdapter {
  return new MakePlatformAdapter(config);
}