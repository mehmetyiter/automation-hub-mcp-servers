import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationSchema {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
}

export class ValidationMiddleware {
  static validate = (schema: ValidationSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const errors: string[] = [];

      // Validate request body
      if (schema.body) {
        const { error } = schema.body.validate(req.body);
        if (error) {
          errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`);
        }
      }

      // Validate query parameters
      if (schema.query) {
        const { error } = schema.query.validate(req.query);
        if (error) {
          errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`);
        }
      }

      // Validate path parameters
      if (schema.params) {
        const { error } = schema.params.validate(req.params);
        if (error) {
          errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`);
        }
      }

      // Validate headers
      if (schema.headers) {
        const { error } = schema.headers.validate(req.headers);
        if (error) {
          errors.push(`Headers: ${error.details.map(d => d.message).join(', ')}`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors
          }
        });
      }

      next();
    };
  };

  // Common validation schemas
  static readonly SCHEMAS = {
    UUID_PARAM: Joi.object({
      id: Joi.string().uuid().required()
    }),
    
    PAGINATION_QUERY: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }),

    CREDENTIAL_CREATE: Joi.object({
      provider: Joi.string().valid('openai', 'anthropic', 'google', 'cohere', 'replicate').required(),
      name: Joi.string().min(1).max(200).required(),
      credentials: Joi.object().required(),
      isDefault: Joi.boolean().default(false),
      metadata: Joi.object().default({})
    }),

    CREDENTIAL_UPDATE: Joi.object({
      name: Joi.string().min(1).max(200).optional(),
      credentials: Joi.object().optional(),
      isDefault: Joi.boolean().optional(),
      metadata: Joi.object().optional()
    }),

    API_KEY_CREATE: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      scopes: Joi.array().items(Joi.string().valid('read', 'write', 'admin')).min(1).required(),
      expiresAt: Joi.date().greater('now').optional(),
      rateLimit: Joi.number().integer().min(1).max(10000).default(1000),
      dailyLimit: Joi.number().integer().min(1).max(1000000).default(50000)
    }),

    WEBHOOK_CREATE: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      url: Joi.string().uri().required(),
      events: Joi.array().items(Joi.string()).min(1).required(),
      retryCount: Joi.number().integer().min(0).max(10).default(3),
      timeoutMs: Joi.number().integer().min(1000).max(60000).default(30000)
    }),

    WEBHOOK_UPDATE: Joi.object({
      name: Joi.string().min(1).max(200).optional(),
      url: Joi.string().uri().optional(),
      events: Joi.array().items(Joi.string()).min(1).optional(),
      isActive: Joi.boolean().optional(),
      retryCount: Joi.number().integer().min(0).max(10).optional(),
      timeoutMs: Joi.number().integer().min(1000).max(60000).optional()
    }),

    USAGE_QUERY: Joi.object({
      timeframe: Joi.string().valid('1h', '24h', '7d', '30d', '90d').default('7d'),
      provider: Joi.string().optional(),
      granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day'),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional()
    }).with('startDate', 'endDate'),

    SUBSCRIPTION_CREATE: Joi.object({
      events: Joi.array().items(Joi.string()).min(1).required(),
      filters: Joi.object().optional()
    })
  };
}