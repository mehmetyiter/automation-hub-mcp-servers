/**
 * Universal Credential Interfaces for Multi-Platform Support
 * 
 * These interfaces provide a platform-agnostic way to manage credentials
 * across different automation platforms (n8n, Zapier, Make.com, etc.)
 */

// Platform Types
export type PlatformType = 'n8n' | 'zapier' | 'make' | 'vapi' | 'custom';

// Provider Types
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'cohere' | 'azure' | 'aws' | 'custom';

// Credential Types
export type CredentialType = 'api_key' | 'oauth2' | 'basic_auth' | 'bearer_token' | 'custom';

// Security Levels
export type SecurityLevel = 'standard' | 'high' | 'critical';

// Validation Status
export type ValidationStatus = 'valid' | 'invalid' | 'expired' | 'rate_limited' | 'unknown';

/**
 * Base credential interface that all platform-specific credentials must implement
 */
export interface IUniversalCredential {
  id: string;
  userId: string;
  name: string;
  description?: string;
  platform: PlatformType;
  provider: ProviderType;
  type: CredentialType;
  securityLevel: SecurityLevel;
  metadata: ICredentialMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

/**
 * Credential metadata for tracking and optimization
 */
export interface ICredentialMetadata {
  version: string;
  tags: string[];
  labels: Record<string, string>;
  region?: string;
  environment?: 'development' | 'staging' | 'production';
  customFields?: Record<string, any>;
}

/**
 * Encrypted credential data storage
 */
export interface IEncryptedCredential {
  credentialId: string;
  encryptedData: string;
  encryptionContext: IEncryptionContext;
  keyVersion: number;
  algorithm: string;
  checksum: string;
}

/**
 * Encryption context for secure credential handling
 */
export interface IEncryptionContext {
  securityLevel: SecurityLevel;
  platform: PlatformType;
  provider: ProviderType;
  userId: string;
  timestamp: Date;
  additionalAuthenticatedData?: string;
}

/**
 * Universal credential data structure
 */
export interface ICredentialData {
  apiKey?: string;
  secretKey?: string;
  token?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  endpoint?: string;
  region?: string;
  projectId?: string;
  organizationId?: string;
  customFields?: Record<string, any>;
}

/**
 * Credential validation result
 */
export interface IValidationResult {
  credentialId: string;
  status: ValidationStatus;
  validatedAt: Date;
  expiresAt?: Date;
  quotas?: IQuotaInfo;
  capabilities?: string[];
  errors?: IValidationError[];
  metadata?: Record<string, any>;
}

/**
 * Validation error details
 */
export interface IValidationError {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

/**
 * Quota information from provider
 */
export interface IQuotaInfo {
  total: number;
  used: number;
  remaining: number;
  resetAt?: Date;
  unit: 'requests' | 'tokens' | 'credits' | 'custom';
  limits: IQuotaLimit[];
}

/**
 * Quota limit details
 */
export interface IQuotaLimit {
  type: 'rate' | 'monthly' | 'daily' | 'concurrent';
  limit: number;
  current: number;
  windowMs?: number;
  resetAt?: Date;
}

/**
 * Platform-specific credential configuration
 */
export interface IPlatformCredentialConfig {
  platform: PlatformType;
  supportedProviders: ProviderType[];
  supportedTypes: CredentialType[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: IValidationRule[];
  transformationRules?: ITransformationRule[];
}

/**
 * Validation rule for credential fields
 */
export interface IValidationRule {
  field: string;
  type: 'required' | 'format' | 'length' | 'custom';
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  customValidator?: (value: any) => boolean;
  errorMessage: string;
}

/**
 * Transformation rule for platform adaptation
 */
export interface ITransformationRule {
  sourceField: string;
  targetField: string;
  transform: (value: any) => any;
  reverse?: (value: any) => any;
}

/**
 * Credential usage tracking
 */
export interface ICredentialUsage {
  credentialId: string;
  platform: PlatformType;
  timestamp: Date;
  operation: string;
  success: boolean;
  responseTime: number;
  tokensUsed?: number;
  cost?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Credential migration data
 */
export interface ICredentialMigration {
  sourcePlatform: PlatformType;
  targetPlatform: PlatformType;
  credentialId: string;
  mappings: IFieldMapping[];
  transformations: ITransformationRule[];
  validationStatus?: ValidationStatus;
  migrationErrors?: string[];
}

/**
 * Field mapping for migration
 */
export interface IFieldMapping {
  sourceField: string;
  targetField: string;
  required: boolean;
  defaultValue?: any;
}

/**
 * Platform adapter interface
 */
export interface IPlatformAdapter {
  platform: PlatformType;
  
  // Credential operations
  validateCredential(credential: IUniversalCredential, data: ICredentialData): Promise<IValidationResult>;
  transformCredential(credential: IUniversalCredential, data: ICredentialData): Promise<any>;
  
  // Usage operations
  trackUsage(usage: ICredentialUsage): Promise<void>;
  getUsageStats(credentialId: string, period: Date): Promise<IUsageStats>;
  
  // Platform-specific operations
  testConnection(credential: IUniversalCredential, data: ICredentialData): Promise<boolean>;
  getCapabilities(credential: IUniversalCredential): Promise<string[]>;
  refreshCredential?(credential: IUniversalCredential, data: ICredentialData): Promise<ICredentialData>;
}

/**
 * Usage statistics
 */
export interface IUsageStats {
  credentialId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  totalCost: number;
  errorRate: number;
  topOperations: IOperationStat[];
}

/**
 * Operation statistics
 */
export interface IOperationStat {
  operation: string;
  count: number;
  averageResponseTime: number;
  successRate: number;
  totalCost: number;
}

/**
 * Credential manager interface
 */
export interface IUniversalCredentialManager {
  // CRUD operations
  create(credential: Omit<IUniversalCredential, 'id' | 'createdAt' | 'updatedAt'>, data: ICredentialData): Promise<IUniversalCredential>;
  read(credentialId: string): Promise<IUniversalCredential>;
  update(credentialId: string, updates: Partial<IUniversalCredential>, data?: Partial<ICredentialData>): Promise<IUniversalCredential>;
  delete(credentialId: string): Promise<void>;
  
  // List and search
  list(userId: string, filters?: ICredentialFilters): Promise<IUniversalCredential[]>;
  search(query: ICredentialSearchQuery): Promise<IUniversalCredential[]>;
  
  // Validation and testing
  validate(credentialId: string): Promise<IValidationResult>;
  test(credentialId: string): Promise<boolean>;
  
  // Platform operations
  migrate(credentialId: string, targetPlatform: PlatformType): Promise<ICredentialMigration>;
  export(credentialId: string, format: 'json' | 'yaml' | 'env'): Promise<string>;
  import(data: string, format: 'json' | 'yaml' | 'env'): Promise<IUniversalCredential>;
}

/**
 * Credential filters
 */
export interface ICredentialFilters {
  platform?: PlatformType;
  provider?: ProviderType;
  type?: CredentialType;
  securityLevel?: SecurityLevel;
  tags?: string[];
  environment?: string;
  validOnly?: boolean;
}

/**
 * Credential search query
 */
export interface ICredentialSearchQuery {
  text?: string;
  userId?: string;
  platforms?: PlatformType[];
  providers?: ProviderType[];
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  lastUsedAfter?: Date;
  validOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Credential security policy
 */
export interface ICredentialSecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: ISecurityRule[];
  enforcement: 'strict' | 'warn' | 'audit';
  appliesTo: {
    platforms?: PlatformType[];
    providers?: ProviderType[];
    securityLevels?: SecurityLevel[];
    users?: string[];
    tags?: string[];
  };
}

/**
 * Security rule
 */
export interface ISecurityRule {
  type: 'rotation' | 'access' | 'validation' | 'encryption' | 'audit';
  condition: string;
  action: string;
  parameters?: Record<string, any>;
}

/**
 * Credential lifecycle events
 */
export interface ICredentialEvent {
  id: string;
  credentialId: string;
  userId: string;
  type: CredentialEventType;
  timestamp: Date;
  details: Record<string, any>;
  platform?: PlatformType;
  ipAddress?: string;
  userAgent?: string;
}

export type CredentialEventType = 
  | 'created' 
  | 'updated' 
  | 'deleted' 
  | 'validated' 
  | 'used' 
  | 'rotated' 
  | 'expired' 
  | 'migrated' 
  | 'exported' 
  | 'imported';

/**
 * Batch operation result
 */
export interface IBatchOperationResult<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: Error;
  }>;
  total: number;
  successCount: number;
  failureCount: number;
  duration: number;
}

/**
 * Health check result
 */
export interface IHealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    duration?: number;
  }>;
  timestamp: Date;
}