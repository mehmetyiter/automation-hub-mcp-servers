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
 * Custom Platform Adapter
 * 
 * Handles credential management for custom/generic platforms
 * Provides maximum flexibility for non-standard integrations
 */
export class CustomPlatformAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'custom';

  constructor(config?: any) {
    super(config);
  }

  /**
   * Transform credential data for custom format
   * Minimal transformation - preserves original structure
   */
  async transformCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<any> {
    // For custom platforms, we preserve the data structure as much as possible
    const customCredential: any = {
      id: credential.id,
      name: credential.name,
      description: credential.description,
      metadata: {
        ...credential.metadata,
        platform: 'custom',
        provider: credential.provider,
        type: credential.type,
        created: credential.createdAt,
        updated: credential.updatedAt
      }
    };

    // Map authentication data based on credential type
    switch (credential.type) {
      case 'api_key':
        customCredential.auth = {
          type: 'apiKey',
          apiKey: data.apiKey,
          apiKeyHeader: data.customFields?.apiKeyHeader || 'X-API-Key',
          apiKeyLocation: data.customFields?.apiKeyLocation || 'header'
        };
        break;
      
      case 'oauth2':
        customCredential.auth = {
          type: 'oauth2',
          accessToken: data.token,
          refreshToken: data.refreshToken,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          tokenType: 'Bearer',
          scope: data.customFields?.scope,
          expiresAt: data.customFields?.expiresAt
        };
        break;
      
      case 'basic_auth':
        customCredential.auth = {
          type: 'basic',
          username: data.username,
          password: data.password
        };
        break;
      
      case 'bearer_token':
        customCredential.auth = {
          type: 'bearer',
          token: data.token,
          tokenPrefix: data.customFields?.tokenPrefix || 'Bearer'
        };
        break;
      
      case 'custom':
        customCredential.auth = {
          type: 'custom',
          ...data.customFields
        };
        break;
    }

    // Add connection details
    customCredential.connection = {
      baseUrl: data.endpoint,
      timeout: data.customFields?.timeout || 30000,
      headers: data.customFields?.headers || {},
      queryParams: data.customFields?.queryParams || {},
      retryConfig: {
        maxRetries: data.customFields?.maxRetries || 3,
        retryDelay: data.customFields?.retryDelay || 1000,
        backoffMultiplier: data.customFields?.backoffMultiplier || 2
      }
    };

    // Add any additional custom fields
    customCredential.customData = Object.entries(data.customFields || {})
      .filter(([key]) => !['headers', 'queryParams', 'timeout', 'maxRetries', 'retryDelay', 'backoffMultiplier'].includes(key))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return customCredential;
  }

  /**
   * Track usage for custom platforms
   */
  async trackUsage(usage: ICredentialUsage): Promise<void> {
    // Store usage data with custom platform metadata
    if (this.config?.usageTracker) {
      await this.config.usageTracker.track({
        ...usage,
        platform: 'custom',
        customPlatformName: usage.metadata?.platformName || 'unknown',
        endpoint: usage.metadata?.endpoint,
        method: usage.metadata?.method,
        statusCode: usage.metadata?.statusCode,
        customMetadata: usage.metadata
      });
    }
  }

  /**
   * Get usage statistics for custom platform
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

    if (this.config?.usageTracker) {
      const usageData = await this.config.usageTracker.getStats(credentialId, period, endDate);
      
      stats.totalRequests = usageData.totalRequests;
      stats.successfulRequests = usageData.successfulRequests;
      stats.failedRequests = usageData.failedRequests;
      stats.averageResponseTime = usageData.averageResponseTime;
      stats.totalTokensUsed = usageData.totalTokensUsed || 0;
      stats.totalCost = usageData.totalCost || 0;
      stats.errorRate = stats.totalRequests > 0 
        ? (stats.failedRequests / stats.totalRequests) * 100 
        : 0;
      
      // Group by endpoint and method
      const operationMap = new Map<string, IOperationStat>();
      
      for (const record of usageData.records) {
        const endpoint = record.metadata?.endpoint || 'unknown';
        const method = record.metadata?.method || 'unknown';
        const operationKey = `${method} ${endpoint}`;
        
        const op = operationMap.get(operationKey) || {
          operation: operationKey,
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
        
        operationMap.set(operationKey, op);
      }
      
      stats.topOperations = Array.from(operationMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return stats;
  }

  /**
   * Test connection for custom platform
   */
  async testConnection(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<boolean> {
    try {
      // If a test endpoint is provided, use it
      if (data.customFields?.testEndpoint) {
        const testUrl = data.endpoint 
          ? new URL(data.customFields.testEndpoint, data.endpoint).toString()
          : data.customFields.testEndpoint;

        const response = await this.makeAuthenticatedRequest(
          testUrl,
          {
            method: data.customFields?.testMethod || 'GET',
            headers: data.customFields?.testHeaders || {}
          },
          credential,
          data
        );

        // Check for custom success criteria
        if (data.customFields?.successStatusCodes) {
          const validCodes = data.customFields.successStatusCodes as number[];
          return validCodes.includes(response.status);
        }

        return response.ok;
      }

      // Default validation - just check if required fields exist
      switch (credential.type) {
        case 'api_key':
          return !!data.apiKey;
        case 'oauth2':
          return !!(data.token && data.clientId);
        case 'basic_auth':
          return !!(data.username && data.password);
        case 'bearer_token':
          return !!data.token;
        case 'custom':
          // For custom type, assume valid if any data exists
          return Object.keys(data).length > 0;
        default:
          return false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get capabilities for custom platform
   */
  async getCapabilities(credential: IUniversalCredential): Promise<string[]> {
    const capabilities: string[] = [
      'custom_integration',
      'flexible_auth',
      'custom_headers',
      'custom_parameters',
      'webhook_support',
      'batch_operations'
    ];

    // Add capabilities from custom fields
    if (credential.metadata.customFields?.capabilities) {
      const customCaps = credential.metadata.customFields.capabilities;
      if (Array.isArray(customCaps)) {
        capabilities.push(...customCaps);
      }
    }

    // Add auth-specific capabilities
    switch (credential.type) {
      case 'oauth2':
        capabilities.push('oauth_flow', 'token_refresh');
        break;
      case 'api_key':
        capabilities.push('api_key_auth');
        break;
      case 'basic_auth':
        capabilities.push('basic_authentication');
        break;
      case 'bearer_token':
        capabilities.push('bearer_token_auth');
        break;
      case 'custom':
        capabilities.push('custom_authentication');
        break;
    }

    return capabilities;
  }

  /**
   * Refresh credential if custom refresh logic is provided
   */
  async refreshCredential(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<ICredentialData> {
    // Check if custom refresh logic is provided
    if (data.customFields?.refreshEndpoint && credential.type === 'oauth2') {
      try {
        const refreshUrl = data.endpoint 
          ? new URL(data.customFields.refreshEndpoint, data.endpoint).toString()
          : data.customFields.refreshEndpoint;

        const refreshBody = {
          grant_type: 'refresh_token',
          refresh_token: data.refreshToken,
          client_id: data.clientId,
          client_secret: data.clientSecret,
          ...data.customFields?.refreshParams
        };

        const response = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...data.customFields?.refreshHeaders
          },
          body: new URLSearchParams(refreshBody).toString()
        });

        if (response.ok) {
          const tokens = await response.json();
          return {
            ...data,
            token: tokens.access_token,
            refreshToken: tokens.refresh_token || data.refreshToken,
            customFields: {
              ...data.customFields,
              expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000
            }
          };
        }
      } catch (error) {
        console.error('Custom refresh failed:', error);
      }
    }

    return data;
  }

  /**
   * Perform validation for custom platform credential
   */
  protected async performValidation(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<IValidationResult> {
    const errors = [];

    // Validate based on credential type
    switch (credential.type) {
      case 'api_key':
        if (!data.apiKey) {
          errors.push(this.createValidationError(
            'MISSING_API_KEY',
            'API key is required',
            'apiKey'
          ));
        }
        
        // Check custom validation pattern if provided
        if (data.apiKey && data.customFields?.apiKeyPattern) {
          const pattern = new RegExp(data.customFields.apiKeyPattern);
          if (!pattern.test(data.apiKey)) {
            errors.push(this.createValidationError(
              'INVALID_API_KEY_FORMAT',
              'API key does not match the expected format',
              'apiKey',
              `Expected format: ${data.customFields.apiKeyPattern}`
            ));
          }
        }
        break;
      
      case 'oauth2':
        if (!data.token) {
          errors.push(this.createValidationError(
            'MISSING_ACCESS_TOKEN',
            'Access token is required',
            'token'
          ));
        }
        if (!data.clientId) {
          errors.push(this.createValidationError(
            'MISSING_CLIENT_ID',
            'Client ID is required',
            'clientId'
          ));
        }
        break;
      
      case 'basic_auth':
        if (!data.username) {
          errors.push(this.createValidationError(
            'MISSING_USERNAME',
            'Username is required',
            'username'
          ));
        }
        if (!data.password) {
          errors.push(this.createValidationError(
            'MISSING_PASSWORD',
            'Password is required',
            'password'
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
      
      case 'custom':
        // Check for required custom fields
        if (data.customFields?.requiredFields) {
          const requiredFields = data.customFields.requiredFields as string[];
          for (const field of requiredFields) {
            if (!data.customFields?.[field]) {
              errors.push(this.createValidationError(
                'MISSING_CUSTOM_FIELD',
                `Required field '${field}' is missing`,
                field
              ));
            }
          }
        }
        break;
    }

    // Validate endpoint URL if provided
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

    // Test connection if no errors and test is enabled
    if (errors.length === 0 && data.customFields?.enableConnectionTest !== false) {
      const connectionValid = await this.testConnection(credential, data);
      if (!connectionValid) {
        errors.push(this.createValidationError(
          'CONNECTION_TEST_FAILED',
          'Failed to establish connection',
          undefined,
          'Please verify your credentials and endpoint configuration'
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
   * Override makeAuthenticatedRequest to support custom auth schemes
   */
  protected async makeAuthenticatedRequest(
    url: string,
    options: RequestInit,
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<Response> {
    const headers = new Headers(options.headers);

    // Apply custom authentication based on type
    switch (credential.type) {
      case 'api_key':
        const headerName = data.customFields?.apiKeyHeader || 'X-API-Key';
        const location = data.customFields?.apiKeyLocation || 'header';
        
        if (location === 'header') {
          headers.set(headerName, data.apiKey!);
        } else if (location === 'query') {
          const urlObj = new URL(url);
          urlObj.searchParams.set(headerName, data.apiKey!);
          url = urlObj.toString();
        }
        break;
      
      case 'custom':
        // Apply custom headers
        if (data.customFields?.authHeaders) {
          const authHeaders = data.customFields.authHeaders as Record<string, string>;
          for (const [key, value] of Object.entries(authHeaders)) {
            headers.set(key, value);
          }
        }
        
        // Apply custom query parameters
        if (data.customFields?.authParams) {
          const urlObj = new URL(url);
          const authParams = data.customFields.authParams as Record<string, string>;
          for (const [key, value] of Object.entries(authParams)) {
            urlObj.searchParams.set(key, value);
          }
          url = urlObj.toString();
        }
        break;
      
      default:
        // Use base class implementation for standard types
        return super.makeAuthenticatedRequest(url, options, credential, data);
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Get custom platform metadata
   */
  getCustomMetadata(credential: IUniversalCredential): any {
    return {
      platformName: credential.metadata.customFields?.platformName || 'Custom Platform',
      authType: credential.type,
      capabilities: this.getCapabilities(credential),
      configuration: {
        endpoint: credential.metadata.customFields?.endpoint,
        timeout: credential.metadata.customFields?.timeout || 30000,
        retryEnabled: credential.metadata.customFields?.retryEnabled !== false,
        customHeaders: credential.metadata.customFields?.headers || {},
        customParams: credential.metadata.customFields?.queryParams || {}
      },
      validation: {
        testEndpoint: credential.metadata.customFields?.testEndpoint,
        testMethod: credential.metadata.customFields?.testMethod || 'GET',
        successStatusCodes: credential.metadata.customFields?.successStatusCodes || [200],
        requiredFields: credential.metadata.customFields?.requiredFields || []
      }
    };
  }
}

// Export factory function
export function createCustomPlatformAdapter(config?: any): CustomPlatformAdapter {
  return new CustomPlatformAdapter(config);
}