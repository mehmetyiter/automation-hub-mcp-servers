import { Router } from 'express';
import { Pool } from 'pg';
import { CredentialController } from '../controllers/credential-controller.js';
import { AuthenticationMiddleware } from '../middleware/authentication.js';
import { AuthorizationMiddleware } from '../middleware/authorization.js';
import { ValidationMiddleware } from '../middleware/validation.js';
import { RateLimitingMiddleware } from '../middleware/rate-limiting.js';

export function createCredentialRoutes(db: Pool): Router {
  const router = Router();
  const credentialController = new CredentialController(db);
  const authMiddleware = new AuthenticationMiddleware(db);
  const authzMiddleware = new AuthorizationMiddleware();
  const rateLimitMiddleware = new RateLimitingMiddleware(db);

  // Apply authentication to all routes
  router.use(authMiddleware.authenticate);

  // Apply rate limiting
  const credentialRateLimit = rateLimitMiddleware.createRateLimit(
    RateLimitingMiddleware.CONFIGS.MODERATE
  );
  router.use(credentialRateLimit);

  // GET /credentials - Get all credentials for user
  router.get('/',
    authzMiddleware.requireScope(['read']),
    ValidationMiddleware.validate({
      query: ValidationMiddleware.SCHEMAS.PAGINATION_QUERY.keys({
        provider: ValidationMiddleware.SCHEMAS.CREDENTIAL_CREATE.extract('provider').optional(),
        status: ValidationMiddleware.SCHEMAS.CREDENTIAL_STATUS.optional()
      })
    }),
    credentialController.getAllCredentials
  );

  // POST /credentials - Create new credential
  router.post('/',
    authzMiddleware.requireScope(['write']),
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.CREDENTIAL_CREATE
    }),
    credentialController.createCredential
  );

  // GET /credentials/:credentialId - Get specific credential
  router.get('/:credentialId',
    authzMiddleware.requireScope(['read']),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM.keys({
        credentialId: ValidationMiddleware.SCHEMAS.UUID_PARAM.extract('id').required()
      })
    }),
    credentialController.getCredential
  );

  // PUT /credentials/:credentialId - Update credential
  router.put('/:credentialId',
    authzMiddleware.requireScope(['write']),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM.keys({
        credentialId: ValidationMiddleware.SCHEMAS.UUID_PARAM.extract('id').required()
      }),
      body: ValidationMiddleware.SCHEMAS.CREDENTIAL_UPDATE
    }),
    credentialController.updateCredential
  );

  // DELETE /credentials/:credentialId - Delete credential
  router.delete('/:credentialId',
    authzMiddleware.requireScope(['write']),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM.keys({
        credentialId: ValidationMiddleware.SCHEMAS.UUID_PARAM.extract('id').required()
      })
    }),
    credentialController.deleteCredential
  );

  // POST /credentials/:credentialId/test - Test credential
  router.post('/:credentialId/test',
    authzMiddleware.requireScope(['read']),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM.keys({
        credentialId: ValidationMiddleware.SCHEMAS.UUID_PARAM.extract('id').required()
      })
    }),
    credentialController.testCredential
  );

  // GET /credentials/:credentialId/usage - Get credential usage stats
  router.get('/:credentialId/usage',
    authzMiddleware.requireScope(['read']),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM.keys({
        credentialId: ValidationMiddleware.SCHEMAS.UUID_PARAM.extract('id').required()
      }),
      query: ValidationMiddleware.SCHEMAS.USAGE_QUERY
    }),
    credentialController.getCredentialUsage
  );

  // Admin routes for managing any user's credentials
  router.get('/users/:userId',
    authzMiddleware.requireRole(['admin']),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM.keys({
        userId: ValidationMiddleware.SCHEMAS.UUID_PARAM.extract('id').required()
      }),
      query: ValidationMiddleware.SCHEMAS.PAGINATION_QUERY
    }),
    credentialController.getAllCredentials
  );

  return router;
}

// CREDENTIAL_STATUS schema is already defined in validation middleware