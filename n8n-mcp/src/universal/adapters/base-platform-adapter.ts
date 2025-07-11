import {
  IPlatformAdapter,
  IUniversalCredential,
  ICredentialData,
  IValidationResult,
  ICredentialUsage,
  IUsageStats,
  PlatformType,
  ValidationStatus,
  IValidationError
} from '../interfaces/credential-interfaces.js';

/**
 * Base Platform Adapter
 * 
 * Provides common functionality that all platform adapters can extend
 */
export abstract class BasePlatformAdapter implements IPlatformAdapter {
  abstract platform: PlatformType;
  
  protected validationCache: Map<string, { result: IValidationResult; timestamp: number }> = new Map();
  protected cacheTTL: number = 300000; // 5 minutes
  
  constructor(protected config?: any) {}

  /**
   * Validate credential with caching support
   */
  async validateCredential(
    credential: IUniversalCredential, 
    data: ICredentialData
  ): Promise<IValidationResult> {
    // Check cache
    const cacheKey = this.getCacheKey(credential.id);
    const cached = this.validationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    // Perform validation
    const result = await this.performValidation(credential, data);
    
    // Cache result
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Transform credential data for the specific platform
   */
  abstract transformCredential(
    credential: IUniversalCredential, 
    data: ICredentialData
  ): Promise<any>;

  /**
   * Track credential usage
   */
  abstract trackUsage(usage: ICredentialUsage): Promise<void>;

  /**
   * Get usage statistics for a credential
   */
  abstract getUsageStats(credentialId: string, period: Date): Promise<IUsageStats>;

  /**
   * Test connection with the credential
   */
  abstract testConnection(
    credential: IUniversalCredential, 
    data: ICredentialData
  ): Promise<boolean>;

  /**
   * Get platform-specific capabilities
   */
  abstract getCapabilities(credential: IUniversalCredential): Promise<string[]>;

  /**
   * Refresh credential if supported
   */
  async refreshCredential(
    credential: IUniversalCredential, 
    data: ICredentialData
  ): Promise<ICredentialData> {
    // Default implementation - no refresh needed
    return data;
  }

  /**
   * Perform the actual validation - to be implemented by subclasses
   */
  protected abstract performValidation(
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<IValidationResult>;

  /**
   * Helper method to create validation result
   */
  protected createValidationResult(
    credentialId: string,
    status: ValidationStatus,
    errors?: IValidationError[]
  ): IValidationResult {
    return {
      credentialId,
      status,
      validatedAt: new Date(),
      errors
    };
  }

  /**
   * Helper method to create validation error
   */
  protected createValidationError(
    code: string,
    message: string,
    field?: string,
    suggestion?: string
  ): IValidationError {
    return {
      code,
      message,
      field,
      suggestion
    };
  }

  /**
   * Get cache key for credential
   */
  protected getCacheKey(credentialId: string): string {
    return `${this.platform}:${credentialId}`;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Common field validation
   */
  protected validateRequiredFields(
    data: ICredentialData,
    requiredFields: string[]
  ): IValidationError[] {
    const errors: IValidationError[] = [];

    for (const field of requiredFields) {
      if (!data[field as keyof ICredentialData]) {
        errors.push(this.createValidationError(
          'MISSING_REQUIRED_FIELD',
          `Required field '${field}' is missing`,
          field,
          `Please provide a value for ${field}`
        ));
      }
    }

    return errors;
  }

  /**
   * Validate API key format
   */
  protected validateApiKeyFormat(apiKey: string, pattern?: RegExp): IValidationError[] {
    const errors: IValidationError[] = [];

    if (!apiKey) {
      errors.push(this.createValidationError(
        'MISSING_API_KEY',
        'API key is required',
        'apiKey',
        'Please provide an API key'
      ));
      return errors;
    }

    if (pattern && !pattern.test(apiKey)) {
      errors.push(this.createValidationError(
        'INVALID_API_KEY_FORMAT',
        'API key format is invalid',
        'apiKey',
        'Please check your API key format'
      ));
    }

    return errors;
  }

  /**
   * Make HTTP request with credential
   */
  protected async makeAuthenticatedRequest(
    url: string,
    options: RequestInit,
    credential: IUniversalCredential,
    data: ICredentialData
  ): Promise<Response> {
    // Add authentication headers based on credential type
    const headers = new Headers(options.headers);

    switch (credential.type) {
      case 'api_key':
        if (data.apiKey) {
          headers.set('Authorization', `Bearer ${data.apiKey}`);
        }
        break;
      
      case 'basic_auth':
        if (data.username && data.password) {
          const auth = Buffer.from(`${data.username}:${data.password}`).toString('base64');
          headers.set('Authorization', `Basic ${auth}`);
        }
        break;
      
      case 'bearer_token':
        if (data.token) {
          headers.set('Authorization', `Bearer ${data.token}`);
        }
        break;
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Extract error message from various response formats
   */
  protected async extractErrorMessage(response: Response): Promise<string> {
    try {
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return data.error?.message || data.message || data.error || 'Unknown error';
      }
      
      return await response.text();
    } catch {
      return `HTTP ${response.status}: ${response.statusText}`;
    }
  }

  /**
   * Parse rate limit headers
   */
  protected parseRateLimitHeaders(headers: Headers): {
    limit?: number;
    remaining?: number;
    reset?: Date;
  } {
    const limit = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset') || headers.get('ratelimit-reset');

    return {
      limit: limit ? parseInt(limit) : undefined,
      remaining: remaining ? parseInt(remaining) : undefined,
      reset: reset ? new Date(parseInt(reset) * 1000) : undefined
    };
  }
}