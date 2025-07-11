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
 * Vapi Platform Adapter
 * 
 * Handles credential management specific to Vapi voice AI platform
 */
export class VapiPlatformAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'vapi';
  
  private readonly supportedProviders = [
    'openai', 'anthropic', 'google', 'azure', 'custom'
  ];
  
  private readonly vapiAuthTypes: Record<string, string> = {
    api_key: 'apiKey',
    bearer_token: 'bearer',
    custom: 'custom'
  };

  constructor(config?: any) {
    super(config);
  }

  /**
   * Transform credential data for Vapi format
   */
  async transformCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<any> {
    // Transform to Vapi credential format
    const vapiCredential: any = {
      name: credential.name,
      type: 'ai_provider',
      provider: credential.provider,
      authType: this.vapiAuthTypes[credential.type] || 'apiKey',
      config: {}
    };

    // Map provider-specific configurations
    switch (credential.provider) {
      case 'openai':
        vapiCredential.config = {
          apiKey: data.apiKey,
          model: 'gpt-4-turbo-preview',
          temperature: 0.7,
          maxTokens: 500,
          voiceSettings: {
            voice: 'alloy',
            speed: 1.0,
            pitch: 1.0
          },
          ...(data.organizationId && { organizationId: data.organizationId })
        };
        break;
      
      case 'anthropic':
        vapiCredential.config = {
          apiKey: data.apiKey,
          model: 'claude-3-opus-20240229',
          maxTokens: 1000,
          temperature: 0.7,
          voiceSettings: {
            // Vapi would handle TTS separately
            provider: 'elevenlabs',
            voiceId: 'default'
          }
        };
        break;
      
      case 'google':
        vapiCredential.config = {
          apiKey: data.apiKey,
          model: 'gemini-pro',
          projectId: data.projectId || '',
          location: data.region || 'us-central1',
          voiceSettings: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-F',
            speakingRate: 1.0,
            pitch: 0.0
          }
        };
        break;
      
      case 'azure':
        vapiCredential.config = {
          apiKey: data.apiKey,
          endpoint: data.endpoint,
          deploymentName: data.customFields?.deploymentName || '',
          apiVersion: '2023-12-01-preview',
          voiceSettings: {
            voiceName: 'en-US-JennyNeural',
            rate: '0%',
            pitch: '0%'
          }
        };
        break;
      
      default:
        vapiCredential.config = {
          apiKey: data.apiKey,
          endpoint: data.endpoint,
          ...data.customFields
        };
    }

    // Add Vapi-specific settings
    vapiCredential.settings = {
      // Voice interaction settings
      voice: {
        interruptionThreshold: 100, // ms
        endOfSpeechTimeout: 1000, // ms
        noSpeechTimeout: 5000, // ms
        backgroundNoiseLevel: 0.3
      },
      // AI behavior settings
      behavior: {
        systemPrompt: this.getDefaultSystemPrompt(credential.provider),
        temperature: vapiCredential.config.temperature || 0.7,
        maxTurns: 20,
        contextWindow: 4000
      },
      // Call settings
      call: {
        maxDuration: 3600, // 1 hour
        recordingEnabled: false,
        transcriptionEnabled: true,
        webhookUrl: data.customFields?.webhookUrl
      }
    };

    return vapiCredential;
  }

  /**
   * Track usage for Vapi calls
   */
  async trackUsage(usage: ICredentialUsage): Promise<void> {
    // Store usage data for Vapi voice calls
    if (this.config?.usageTracker) {
      await this.config.usageTracker.track({
        ...usage,
        platform: 'vapi',
        callId: usage.metadata?.callId,
        assistantId: usage.metadata?.assistantId,
        duration: usage.metadata?.duration, // Call duration in seconds
        turnCount: usage.metadata?.turnCount,
        voiceProvider: usage.metadata?.voiceProvider
      });
    }
  }

  /**
   * Get usage statistics for Vapi
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

    // Query Vapi-specific usage data
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
      
      // Group by assistant
      const assistantMap = new Map<string, IOperationStat>();
      let totalDuration = 0;
      let callCount = 0;
      
      for (const record of usageData.records) {
        const assistantId = record.metadata?.assistantId || 'default';
        const op = assistantMap.get(assistantId) || {
          operation: `Assistant: ${assistantId}`,
          count: 0,
          averageResponseTime: 0,
          successRate: 0,
          totalCost: 0
        };
        
        op.count++;
        op.totalCost += record.cost || 0;
        
        // For Vapi, response time is call duration
        if (record.metadata?.duration) {
          totalDuration += record.metadata.duration;
          callCount++;
          op.averageResponseTime = totalDuration / callCount;
        }
        
        if (record.success) {
          op.successRate = ((op.successRate * (op.count - 1)) + 100) / op.count;
        } else {
          op.successRate = (op.successRate * (op.count - 1)) / op.count;
        }
        
        assistantMap.set(assistantId, op);
      }
      
      // Add voice-specific metrics
      const voiceStats = this.aggregateVoiceStats(usageData.records);
      
      stats.topOperations = [
        ...Array.from(assistantMap.values()),
        ...voiceStats
      ]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return stats;
  }

  /**
   * Test connection for Vapi credential
   */
  async testConnection(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<boolean> {
    try {
      // Test AI provider connection
      switch (credential.provider) {
        case 'openai':
          return await this.testOpenAIConnection(data);
        
        case 'anthropic':
          return await this.testAnthropicConnection(data);
        
        case 'google':
          return await this.testGoogleConnection(data);
        
        case 'azure':
          return await this.testAzureConnection(data);
        
        default:
          // For custom providers, just validate API key exists
          return !!data.apiKey;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get capabilities for Vapi voice AI
   */
  async getCapabilities(credential: IUniversalCredential): Promise<string[]> {
    const capabilities: string[] = [
      'voice_calls',
      'real_time_conversation',
      'voice_synthesis',
      'speech_recognition',
      'call_recording',
      'call_transcription',
      'webhook_events',
      'custom_assistants'
    ];

    // Add provider-specific capabilities
    switch (credential.provider) {
      case 'openai':
        capabilities.push(
          'gpt4_turbo',
          'function_calling',
          'whisper_transcription',
          'tts_voices'
        );
        break;
      
      case 'anthropic':
        capabilities.push(
          'claude_3',
          'long_context',
          'function_calling'
        );
        break;
      
      case 'google':
        capabilities.push(
          'gemini_pro',
          'multilingual',
          'neural_voices'
        );
        break;
      
      case 'azure':
        capabilities.push(
          'azure_openai',
          'neural_tts',
          'custom_voices'
        );
        break;
    }

    // Add voice-specific capabilities
    capabilities.push(
      'interruption_handling',
      'background_noise_suppression',
      'custom_voice_settings',
      'multi_turn_conversation',
      'context_preservation',
      'emotion_detection',
      'speaker_diarization'
    );

    return capabilities;
  }

  /**
   * Perform validation for Vapi credential
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
        `Provider '${credential.provider}' is not supported in Vapi`,
        'provider',
        `Supported providers: ${this.supportedProviders.join(', ')}`
      ));
    }

    // Validate credential type
    if (!['api_key', 'bearer_token', 'custom'].includes(credential.type)) {
      errors.push(this.createValidationError(
        'UNSUPPORTED_AUTH_TYPE',
        `Authentication type '${credential.type}' is not supported in Vapi`,
        'type',
        'Vapi supports API key and bearer token authentication'
      ));
    }

    // Validate required fields
    if (!data.apiKey && credential.type === 'api_key') {
      errors.push(this.createValidationError(
        'MISSING_API_KEY',
        'API key is required for Vapi',
        'apiKey'
      ));
    }

    // Validate provider-specific requirements
    if (credential.provider === 'azure' && !data.endpoint) {
      errors.push(this.createValidationError(
        'MISSING_ENDPOINT',
        'Endpoint is required for Azure OpenAI',
        'endpoint',
        'Please provide your Azure OpenAI endpoint URL'
      ));
    }

    // Test connection if no errors
    if (errors.length === 0) {
      const connectionValid = await this.testConnection(credential, data);
      if (!connectionValid) {
        errors.push(this.createValidationError(
          'CONNECTION_TEST_FAILED',
          'Failed to connect to the AI provider',
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
   * Get default system prompt for provider
   */
  private getDefaultSystemPrompt(provider: string): string {
    return `You are a helpful voice assistant. Keep your responses concise and natural for voice interaction. 
    Avoid using formatting, lists, or long explanations. Speak as if having a natural conversation.`;
  }

  /**
   * Test OpenAI connection
   */
  private async testOpenAIConnection(data: ICredentialData): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.apiKey}`
        }
      });
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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      });
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
        `https://generativelanguage.googleapis.com/v1/models?key=${data.apiKey}`,
        { method: 'GET' }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test Azure connection
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
   * Aggregate voice-specific statistics
   */
  private aggregateVoiceStats(records: any[]): IOperationStat[] {
    const voiceProviderMap = new Map<string, IOperationStat>();
    
    for (const record of records) {
      const voiceProvider = record.metadata?.voiceProvider || 'default_tts';
      const op = voiceProviderMap.get(voiceProvider) || {
        operation: `Voice: ${voiceProvider}`,
        count: 0,
        averageResponseTime: 0,
        successRate: 0,
        totalCost: 0
      };
      
      op.count++;
      // Voice cost is separate from AI cost
      op.totalCost += record.metadata?.voiceCost || 0;
      
      if (record.success) {
        op.successRate = ((op.successRate * (op.count - 1)) + 100) / op.count;
      } else {
        op.successRate = (op.successRate * (op.count - 1)) / op.count;
      }
      
      voiceProviderMap.set(voiceProvider, op);
    }
    
    return Array.from(voiceProviderMap.values());
  }

  /**
   * Get Vapi-specific metadata
   */
  getVapiMetadata(credential: IUniversalCredential): any {
    return {
      aiProvider: credential.provider,
      supportedVoiceProviders: ['openai', 'elevenlabs', 'google', 'azure', 'aws'],
      features: {
        realTime: true,
        streaming: true,
        functionCalling: ['openai', 'anthropic'].includes(credential.provider),
        multiLanguage: ['google', 'azure'].includes(credential.provider),
        customVoices: ['elevenlabs', 'azure'].includes(credential.provider)
      },
      limits: {
        maxCallDuration: 3600, // 1 hour
        maxTurnsPerCall: 100,
        maxTokensPerTurn: 1000,
        concurrentCalls: 10
      }
    };
  }
}

// Export factory function
export function createVapiPlatformAdapter(config?: any): VapiPlatformAdapter {
  return new VapiPlatformAdapter(config);
}