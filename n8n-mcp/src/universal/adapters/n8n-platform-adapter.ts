import { BasePlatformAdapter } from './base-platform-adapter.js';
import {
  IUniversalCredential,
  ICredentialData,
  IValidationResult,
  ICredentialUsage,
  IUsageStats,
  PlatformType,
  IQuotaInfo,
  IOperationStat
} from '../interfaces/credential-interfaces.js';

/**
 * n8n Platform Adapter
 * 
 * Handles credential management specific to n8n automation platform
 */
export class N8NPlatformAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'n8n';
  
  private readonly supportedProviders = [
    'openai', 'anthropic', 'google', 'cohere', 'azure', 'aws'
  ];
  
  private readonly providerEndpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1',
    cohere: 'https://api.cohere.ai/v1',
    azure: 'https://{instance}.openai.azure.com',
    aws: 'https://bedrock.{region}.amazonaws.com'
  };

  constructor(config?: any) {
    super(config);
  }

  /**
   * Transform credential data for n8n format
   */
  async transformCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<any> {
    // Transform to n8n credential format
    const n8nCredential: any = {
      name: credential.name,
      type: this.mapProviderToN8NType(credential.provider),
      data: {}
    };

    // Map fields based on provider
    switch (credential.provider) {
      case 'openai':
        n8nCredential.data = {
          apiKey: data.apiKey,
          organizationId: data.organizationId || '',
          baseURL: data.endpoint || this.providerEndpoints.openai
        };
        break;
      
      case 'anthropic':
        n8nCredential.data = {
          apiKey: data.apiKey,
          baseURL: data.endpoint || this.providerEndpoints.anthropic
        };
        break;
      
      case 'google':
        n8nCredential.data = {
          apiKey: data.apiKey,
          projectId: data.projectId || '',
          region: data.region || 'us-central1'
        };
        break;
      
      case 'cohere':
        n8nCredential.data = {
          apiKey: data.apiKey,
          baseURL: data.endpoint || this.providerEndpoints.cohere
        };
        break;
      
      case 'azure':
        n8nCredential.data = {
          apiKey: data.apiKey,
          resourceName: data.endpoint?.match(/https:\/\/(.+?)\.openai\.azure\.com/)?.[1] || '',
          apiVersion: '2023-12-01-preview',
          deploymentName: data.customFields?.deploymentName || ''
        };
        break;
      
      case 'aws':
        n8nCredential.data = {
          accessKeyId: data.apiKey,
          secretAccessKey: data.secretKey || '',
          region: data.region || 'us-east-1',
          modelId: data.customFields?.modelId || 'anthropic.claude-v2'
        };
        break;
      
      default:
        // Generic mapping
        n8nCredential.data = {
          apiKey: data.apiKey,
          ...data.customFields
        };
    }

    return n8nCredential;
  }

  /**
   * Track usage for n8n workflows
   */
  async trackUsage(usage: ICredentialUsage): Promise<void> {
    // Store usage data in n8n's tracking system
    // This would integrate with n8n's internal usage tracking
    
    // For now, we'll store in a local tracking system
    if (this.config?.usageTracker) {
      await this.config.usageTracker.track({
        ...usage,
        platform: 'n8n',
        workflowId: usage.metadata?.workflowId,
        nodeId: usage.metadata?.nodeId,
        executionId: usage.metadata?.executionId
      });
    }
  }

  /**
   * Get usage statistics for n8n
   */
  async getUsageStats(credentialId: string, period: Date): Promise<IUsageStats> {
    // This would query n8n's execution history
    // For now, returning mock data
    
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

    // Would query actual usage data here
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
      
      // Group by operation
      const operationMap = new Map<string, IOperationStat>();
      for (const record of usageData.records) {
        const op = operationMap.get(record.operation) || {
          operation: record.operation,
          count: 0,
          averageResponseTime: 0,
          successRate: 0,
          totalCost: 0
        };
        
        op.count++;
        op.totalCost += record.cost || 0;
        operationMap.set(record.operation, op);
      }
      
      stats.topOperations = Array.from(operationMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return stats;
  }

  /**
   * Test connection for n8n credential
   */
  async testConnection(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<boolean> {
    try {
      // Test based on provider
      switch (credential.provider) {
        case 'openai':
          return await this.testOpenAIConnection(data);
        
        case 'anthropic':
          return await this.testAnthropicConnection(data);
        
        case 'google':
          return await this.testGoogleConnection(data);
        
        case 'cohere':
          return await this.testCohereConnection(data);
        
        case 'azure':
          return await this.testAzureConnection(data);
        
        case 'aws':
          return await this.testAWSConnection(data);
        
        default:
          // Generic test - just check if API key exists
          return !!data.apiKey;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get capabilities for n8n workflows
   */
  async getCapabilities(credential: IUniversalCredential): Promise<string[]> {
    const capabilities: string[] = ['workflow_execution'];

    // Add provider-specific capabilities
    switch (credential.provider) {
      case 'openai':
        capabilities.push(
          'text_generation',
          'chat_completion',
          'embeddings',
          'image_generation',
          'audio_transcription',
          'function_calling'
        );
        break;
      
      case 'anthropic':
        capabilities.push(
          'text_generation',
          'chat_completion',
          'function_calling',
          'vision'
        );
        break;
      
      case 'google':
        capabilities.push(
          'text_generation',
          'chat_completion',
          'embeddings',
          'vision'
        );
        break;
      
      case 'cohere':
        capabilities.push(
          'text_generation',
          'chat_completion',
          'embeddings',
          'rerank',
          'classify'
        );
        break;
      
      case 'azure':
        capabilities.push(
          'text_generation',
          'chat_completion',
          'embeddings',
          'image_generation'
        );
        break;
      
      case 'aws':
        capabilities.push(
          'text_generation',
          'chat_completion',
          'embeddings'
        );
        break;
    }

    return capabilities;
  }

  /**
   * Perform validation for n8n credential
   */
  protected async performValidation(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<IValidationResult> {
    const errors = [];

    // Check if provider is supported
    if (!this.supportedProviders.includes(credential.provider)) {
      errors.push(this.createValidationError(
        'UNSUPPORTED_PROVIDER',
        `Provider '${credential.provider}' is not supported in n8n`,
        'provider',
        `Supported providers: ${this.supportedProviders.join(', ')}`
      ));
    }

    // Validate required fields based on provider
    const requiredFields = this.getRequiredFields(credential.provider);
    errors.push(...this.validateRequiredFields(data, requiredFields));

    // Validate API key format
    if (data.apiKey) {
      const pattern = this.getApiKeyPattern(credential.provider);
      if (pattern) {
        errors.push(...this.validateApiKeyFormat(data.apiKey, pattern));
      }
    }

    // If no errors so far, test the connection
    if (errors.length === 0) {
      const connectionValid = await this.testConnection(credential, data);
      if (!connectionValid) {
        errors.push(this.createValidationError(
          'CONNECTION_TEST_FAILED',
          'Failed to connect to the provider API',
          undefined,
          'Please check your credentials and try again'
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
   * Map provider to n8n credential type
   */
  private mapProviderToN8NType(provider: string): string {
    const typeMap: Record<string, string> = {
      openai: 'openAiApi',
      anthropic: 'anthropicApi',
      google: 'googleAiApi',
      cohere: 'cohereApi',
      azure: 'azureOpenAiApi',
      aws: 'awsBedrockApi'
    };

    return typeMap[provider] || 'genericApi';
  }

  /**
   * Get required fields for provider
   */
  private getRequiredFields(provider: string): string[] {
    switch (provider) {
      case 'openai':
        return ['apiKey'];
      case 'anthropic':
        return ['apiKey'];
      case 'google':
        return ['apiKey'];
      case 'cohere':
        return ['apiKey'];
      case 'azure':
        return ['apiKey', 'endpoint'];
      case 'aws':
        return ['apiKey', 'secretKey', 'region'];
      default:
        return ['apiKey'];
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
      const response = await this.makeAuthenticatedRequest(
        `${data.endpoint || this.providerEndpoints.openai}/models`,
        { method: 'GET' },
        { type: 'api_key' } as any,
        data
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
        `${data.endpoint || this.providerEndpoints.anthropic}/messages`,
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

      // Anthropic returns 400 for invalid request but 401 for auth issues
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  /**
   * Test Google connection
   */
  private async testGoogleConnection(data: ICredentialData): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.providerEndpoints.google}/models?key=${data.apiKey}`,
        { method: 'GET' }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test Cohere connection
   */
  private async testCohereConnection(data: ICredentialData): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${data.endpoint || this.providerEndpoints.cohere}/check-api-key`,
        { method: 'POST' },
        { type: 'bearer_token' } as any,
        { ...data, token: data.apiKey }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test Azure OpenAI connection
   */
  private async testAzureConnection(data: ICredentialData): Promise<boolean> {
    try {
      if (!data.endpoint) return false;
      
      const response = await fetch(
        `${data.endpoint}/openai/models?api-version=2023-12-01-preview`,
        {
          method: 'GET',
          headers: {
            'api-key': data.apiKey!
          }
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test AWS Bedrock connection
   */
  private async testAWSConnection(data: ICredentialData): Promise<boolean> {
    // AWS requires signature v4 authentication
    // This is a simplified check
    return !!(data.apiKey && data.secretKey && data.region);
  }
}

// Export factory function
export function createN8NPlatformAdapter(config?: any): N8NPlatformAdapter {
  return new N8NPlatformAdapter(config);
}