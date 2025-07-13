import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface ValidationRule {
  path: string;
  method: string;
  schema: {
    query?: Joi.ObjectSchema;
    body?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
    headers?: Joi.ObjectSchema;
  };
  options?: ValidationOptions;
}

export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
  skipValidation?: boolean;
  customValidator?: (req: Request) => Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  sanitized?: {
    query?: any;
    body?: any;
    params?: any;
    headers?: any;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  type: string;
}

export class RequestValidator {
  private rules: Map<string, ValidationRule> = new Map();
  private commonSchemas: Map<string, Joi.ObjectSchema> = new Map();

  constructor() {
    this.initializeCommonSchemas();
    this.initializeDefaultRules();
  }

  private initializeCommonSchemas(): void {
    // Common field schemas
    this.commonSchemas.set('uuid', Joi.string().uuid());
    this.commonSchemas.set('email', Joi.string().email());
    this.commonSchemas.set('password', Joi.string().min(8).max(128));
    this.commonSchemas.set('name', Joi.string().min(1).max(255).trim());
    this.commonSchemas.set('description', Joi.string().max(1000).allow('').trim());
    this.commonSchemas.set('url', Joi.string().uri());
    this.commonSchemas.set('pagination', Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0),
      page: Joi.number().integer().min(1),
      sort: Joi.string().valid('asc', 'desc').default('desc'),
      sortBy: Joi.string().max(50)
    }));

    // API-specific schemas
    this.commonSchemas.set('apiKey', Joi.object({
      name: this.commonSchemas.get('name')!.required(),
      scopes: Joi.array().items(Joi.string().valid(
        'read', 'write', 'admin', 'webhooks', 'analytics'
      )).default(['read']),
      expiresAt: Joi.date().greater('now'),
      ipWhitelist: Joi.array().items(Joi.string().ip()),
      allowedOrigins: Joi.array().items(Joi.string().uri())
    }));

    this.commonSchemas.set('workflow', Joi.object({
      name: this.commonSchemas.get('name')!.required(),
      description: this.commonSchemas.get('description'),
      nodes: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required(),
        position: Joi.object({
          x: Joi.number().required(),
          y: Joi.number().required()
        }),
        parameters: Joi.object().unknown()
      })).required(),
      connections: Joi.array().items(Joi.object({
        source: Joi.string().required(),
        target: Joi.string().required(),
        sourceOutput: Joi.string().default('main'),
        targetInput: Joi.string().default('main')
      })),
      settings: Joi.object({
        timezone: Joi.string(),
        errorWorkflow: Joi.string().uuid(),
        saveManualExecutions: Joi.boolean().default(false)
      })
    }));

    this.commonSchemas.set('execution', Joi.object({
      workflowId: this.commonSchemas.get('uuid')!.required(),
      data: Joi.object().required(),
      mode: Joi.string().valid('manual', 'trigger', 'webhook').default('manual')
    }));
  }

  private initializeDefaultRules(): void {
    const defaultRules: ValidationRule[] = [
      // Authentication endpoints
      {
        path: '/api/auth/login',
        method: 'POST',
        schema: {
          body: Joi.object({
            email: this.commonSchemas.get('email')!.required(),
            password: Joi.string().required()
          })
        }
      },
      {
        path: '/api/auth/register',
        method: 'POST',
        schema: {
          body: Joi.object({
            name: this.commonSchemas.get('name')!.required(),
            email: this.commonSchemas.get('email')!.required(),
            password: this.commonSchemas.get('password')!.required()
          })
        }
      },

      // API Key endpoints
      {
        path: '/api/api-keys',
        method: 'POST',
        schema: {
          body: this.commonSchemas.get('apiKey')!
        }
      },
      {
        path: '/api/api-keys',
        method: 'GET',
        schema: {
          query: this.commonSchemas.get('pagination')!
        }
      },
      {
        path: '/api/api-keys/:id',
        method: 'GET',
        schema: {
          params: Joi.object({
            id: this.commonSchemas.get('uuid')!.required()
          })
        }
      },

      // Workflow endpoints
      {
        path: '/api/workflows',
        method: 'POST',
        schema: {
          body: this.commonSchemas.get('workflow')!
        }
      },
      {
        path: '/api/workflows',
        method: 'GET',
        schema: {
          query: this.commonSchemas.get('pagination')!.keys({
            search: Joi.string().max(100),
            status: Joi.string().valid('active', 'inactive'),
            tags: Joi.array().items(Joi.string())
          })
        }
      },
      {
        path: '/api/workflows/:id',
        method: 'PUT',
        schema: {
          params: Joi.object({
            id: this.commonSchemas.get('uuid')!.required()
          }),
          body: this.commonSchemas.get('workflow')!
        }
      },
      {
        path: '/api/workflows/:id/execute',
        method: 'POST',
        schema: {
          params: Joi.object({
            id: this.commonSchemas.get('uuid')!.required()
          }),
          body: Joi.object({
            data: Joi.object().default({}),
            pinData: Joi.object()
          })
        }
      },

      // Execution endpoints
      {
        path: '/api/executions',
        method: 'GET',
        schema: {
          query: this.commonSchemas.get('pagination')!.keys({
            workflowId: this.commonSchemas.get('uuid'),
            status: Joi.string().valid('new', 'running', 'success', 'error', 'canceled'),
            startedAfter: Joi.date(),
            startedBefore: Joi.date()
          })
        }
      },

      // Generic ID parameter validation
      {
        path: '/api/:resource/:id',
        method: '*',
        schema: {
          params: Joi.object({
            resource: Joi.string().required(),
            id: Joi.alternatives().try(
              this.commonSchemas.get('uuid')!,
              Joi.string().alphanum().min(1).max(50)
            ).required()
          })
        }
      }
    ];

    defaultRules.forEach(rule => {
      const key = this.generateRuleKey(rule.path, rule.method);
      this.rules.set(key, rule);
    });
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        const rule = this.findMatchingRule(req.path, req.method);
        
        if (!rule) {
          // No validation rule found, continue
          return next();
        }

        if (rule.options?.skipValidation) {
          return next();
        }

        // Custom validator takes precedence
        if (rule.options?.customValidator) {
          const result = await rule.options.customValidator(req);
          if (!result.valid) {
            return this.handleValidationError(req, res, result.errors || []);
          }
          
          // Apply sanitized values
          if (result.sanitized) {
            Object.assign(req, result.sanitized);
          }
          
          return next();
        }

        // Standard Joi validation
        const validationResult = await this.validateRequest(req, rule);
        
        if (!validationResult.valid) {
          return this.handleValidationError(req, res, validationResult.errors || []);
        }

        // Apply sanitized values
        if (validationResult.sanitized) {
          if (validationResult.sanitized.query) {
            req.query = validationResult.sanitized.query;
          }
          if (validationResult.sanitized.body) {
            req.body = validationResult.sanitized.body;
          }
          if (validationResult.sanitized.params) {
            req.params = validationResult.sanitized.params;
          }
        }

        const duration = Date.now() - startTime;
        metrics.recordMetric('validation', 'success', 1, {
          path: req.path,
          method: req.method,
          duration: duration.toString()
        });

        logger.debug('Request validation successful', {
          path: req.path,
          method: req.method,
          duration
        });

        next();

      } catch (error) {
        logger.error('Request validation error', { error, path: req.path });
        metrics.recordMetric('validation', 'error', 1, {
          path: req.path,
          method: req.method,
          error: error.message
        });

        res.status(500).json({
          error: 'Validation Error',
          message: 'Internal validation error'
        });
      }
    };
  }

  private findMatchingRule(path: string, method: string): ValidationRule | null {
    // Try exact match first
    const exactKey = this.generateRuleKey(path, method);
    if (this.rules.has(exactKey)) {
      return this.rules.get(exactKey)!;
    }

    // Try method wildcard
    const methodWildcardKey = this.generateRuleKey(path, '*');
    if (this.rules.has(methodWildcardKey)) {
      return this.rules.get(methodWildcardKey)!;
    }

    // Try pattern matching
    for (const [key, rule] of this.rules) {
      if (this.pathMatches(path, rule.path) && 
          (rule.method === '*' || rule.method === method)) {
        return rule;
      }
    }

    return null;
  }

  private pathMatches(actualPath: string, rulePath: string): boolean {
    if (actualPath === rulePath) {
      return true;
    }

    // Convert Express-style paths to regex
    const regexPattern = rulePath
      .replace(/:[^/]+/g, '([^/]+)')  // :id -> ([^/]+)
      .replace(/\*/g, '.*');          // * -> .*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(actualPath);
  }

  private async validateRequest(req: Request, rule: ValidationRule): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const sanitized: any = {};

    const options = {
      allowUnknown: rule.options?.allowUnknown ?? false,
      stripUnknown: rule.options?.stripUnknown ?? true,
      abortEarly: rule.options?.abortEarly ?? false
    };

    // Validate query parameters
    if (rule.schema.query) {
      const { error, value } = rule.schema.query.validate(req.query, options);
      if (error) {
        errors.push(...this.formatJoiErrors(error, 'query'));
      } else {
        sanitized.query = value;
      }
    }

    // Validate request body
    if (rule.schema.body) {
      const { error, value } = rule.schema.body.validate(req.body, options);
      if (error) {
        errors.push(...this.formatJoiErrors(error, 'body'));
      } else {
        sanitized.body = value;
      }
    }

    // Validate path parameters
    if (rule.schema.params) {
      const { error, value } = rule.schema.params.validate(req.params, options);
      if (error) {
        errors.push(...this.formatJoiErrors(error, 'params'));
      } else {
        sanitized.params = value;
      }
    }

    // Validate headers
    if (rule.schema.headers) {
      const { error, value } = rule.schema.headers.validate(req.headers, options);
      if (error) {
        errors.push(...this.formatJoiErrors(error, 'headers'));
      } else {
        sanitized.headers = value;
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined
    };
  }

  private formatJoiErrors(joiError: Joi.ValidationError, location: string): ValidationError[] {
    return joiError.details.map(detail => ({
      field: `${location}.${detail.path.join('.')}`,
      message: detail.message,
      value: detail.context?.value,
      type: detail.type
    }));
  }

  private handleValidationError(
    req: Request,
    res: Response,
    errors: ValidationError[]
  ): void {
    logger.warn('Request validation failed', {
      path: req.path,
      method: req.method,
      errors: errors.map(e => ({
        field: e.field,
        message: e.message,
        type: e.type
      }))
    });

    metrics.recordMetric('validation', 'failed', 1, {
      path: req.path,
      method: req.method,
      errorCount: errors.length.toString()
    });

    res.status(400).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: errors.map(error => ({
        field: error.field,
        message: error.message.replace(/"/g, ''),
        type: error.type
      })),
      timestamp: new Date().toISOString()
    });
  }

  private generateRuleKey(path: string, method: string): string {
    return `${method}:${path}`;
  }

  // Public methods for managing validation rules
  addRule(rule: ValidationRule): void {
    const key = this.generateRuleKey(rule.path, rule.method);
    this.rules.set(key, rule);
    
    logger.info('Validation rule added', {
      path: rule.path,
      method: rule.method
    });
  }

  removeRule(path: string, method: string): boolean {
    const key = this.generateRuleKey(path, method);
    const removed = this.rules.delete(key);
    
    if (removed) {
      logger.info('Validation rule removed', { path, method });
    }
    
    return removed;
  }

  addCommonSchema(name: string, schema: Joi.ObjectSchema): void {
    this.commonSchemas.set(name, schema);
    logger.info('Common schema added', { name });
  }

  getCommonSchema(name: string): Joi.ObjectSchema | undefined {
    return this.commonSchemas.get(name);
  }

  // Helper methods for creating validation rules
  static createQueryRule(path: string, method: string, schema: Joi.ObjectSchema): ValidationRule {
    return {
      path,
      method,
      schema: { query: schema }
    };
  }

  static createBodyRule(path: string, method: string, schema: Joi.ObjectSchema): ValidationRule {
    return {
      path,
      method,
      schema: { body: schema }
    };
  }

  static createParamsRule(path: string, method: string, schema: Joi.ObjectSchema): ValidationRule {
    return {
      path,
      method,
      schema: { params: schema }
    };
  }

  // Validation helper for file uploads
  static validateFileUpload(options: {
    maxSize?: number;
    allowedTypes?: string[];
    required?: boolean;
  } = {}) {
    return async (req: Request): Promise<ValidationResult> => {
      const file = req.file;
      const errors: ValidationError[] = [];

      if (options.required && !file) {
        errors.push({
          field: 'file',
          message: 'File is required',
          type: 'any.required'
        });
        return { valid: false, errors };
      }

      if (file) {
        // Check file size
        if (options.maxSize && file.size > options.maxSize) {
          errors.push({
            field: 'file.size',
            message: `File size must be less than ${options.maxSize} bytes`,
            value: file.size,
            type: 'number.max'
          });
        }

        // Check file type
        if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
          errors.push({
            field: 'file.type',
            message: `File type must be one of: ${options.allowedTypes.join(', ')}`,
            value: file.mimetype,
            type: 'string.valid'
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    };
  }

  // Rate limiting validation
  static createRateLimitRule(
    path: string,
    method: string,
    limits: { requests: number; window: number }
  ): ValidationRule {
    return {
      path,
      method,
      schema: {},
      options: {
        customValidator: async (req: Request) => {
          // This would integrate with the rate limiter
          // For now, just return valid
          return { valid: true };
        }
      }
    };
  }
}