/**
 * Custom error types for the code generation system
 */

export class CodeGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'CodeGenerationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CodeGenerationError {
  constructor(
    message: string,
    public validationDetails?: {
      field?: string;
      value?: any;
      rule?: string;
    }
  ) {
    super(message, 'VALIDATION_ERROR', validationDetails);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends CodeGenerationError {
  constructor(
    message: string,
    public securityIssues: string[],
    public severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ) {
    super(message, 'SECURITY_ERROR', { securityIssues, severity });
    this.name = 'SecurityError';
  }
}

export class DatabaseError extends CodeGenerationError {
  constructor(
    message: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message, 'DATABASE_ERROR', { operation, originalError });
    this.name = 'DatabaseError';
  }
}

export class AIServiceError extends CodeGenerationError {
  constructor(
    message: string,
    public provider: string,
    public apiError?: any
  ) {
    super(message, 'AI_SERVICE_ERROR', { provider, apiError });
    this.name = 'AIServiceError';
  }
}

export class LanguageAdapterError extends CodeGenerationError {
  constructor(
    message: string,
    public language: string,
    public adapterError?: any
  ) {
    super(message, 'LANGUAGE_ADAPTER_ERROR', { language, adapterError });
    this.name = 'LanguageAdapterError';
  }
}

export class PerformanceError extends CodeGenerationError {
  constructor(
    message: string,
    public metric: string,
    public threshold: number,
    public actual: number
  ) {
    super(message, 'PERFORMANCE_ERROR', { metric, threshold, actual });
    this.name = 'PerformanceError';
  }
}

export class VersioningError extends CodeGenerationError {
  constructor(
    message: string,
    public versionId?: string,
    public operation?: string
  ) {
    super(message, 'VERSIONING_ERROR', { versionId, operation });
    this.name = 'VersioningError';
  }
}

export class CacheError extends CodeGenerationError {
  constructor(
    message: string,
    public cacheKey?: string,
    public operation?: 'get' | 'set' | 'delete' | 'clear'
  ) {
    super(message, 'CACHE_ERROR', { cacheKey, operation });
    this.name = 'CacheError';
  }
}

export class WorkflowError extends CodeGenerationError {
  constructor(
    message: string,
    public workflowId?: string,
    public nodeId?: string
  ) {
    super(message, 'WORKFLOW_ERROR', { workflowId, nodeId });
    this.name = 'WorkflowError';
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  static handle(error: Error): CodeGenerationError {
    // If it's already a custom error, return it
    if (error instanceof CodeGenerationError) {
      return error;
    }

    // Convert generic errors to appropriate custom errors
    const message = error.message.toLowerCase();
    
    if (message.includes('validation')) {
      return new ValidationError(error.message);
    }
    
    if (message.includes('security') || message.includes('injection')) {
      return new SecurityError(error.message, [error.message]);
    }
    
    if (message.includes('database') || message.includes('sqlite')) {
      return new DatabaseError(error.message, 'unknown', error);
    }
    
    if (message.includes('ai') || message.includes('openai') || message.includes('anthropic')) {
      return new AIServiceError(error.message, 'unknown', error);
    }
    
    // Default to generic CodeGenerationError
    return new CodeGenerationError(error.message, 'UNKNOWN_ERROR', { originalError: error });
  }

  static toJSON(error: CodeGenerationError): any {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      context: error.context,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  static isRetryable(error: CodeGenerationError): boolean {
    // Determine if an error is retryable
    if (error instanceof AIServiceError) {
      // AI service errors might be temporary
      return true;
    }
    
    if (error instanceof DatabaseError) {
      // Some database errors might be temporary (locks, etc)
      const message = error.message.toLowerCase();
      return message.includes('lock') || message.includes('busy');
    }
    
    if (error instanceof PerformanceError) {
      // Performance issues might improve on retry
      return true;
    }
    
    // Security and validation errors are not retryable
    return false;
  }
}