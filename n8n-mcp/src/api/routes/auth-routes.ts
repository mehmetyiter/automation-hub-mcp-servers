import { Router } from 'express';
import { Pool } from 'pg';
import { AuthenticationMiddleware } from '../middleware/authentication.js';
import { AuthorizationMiddleware } from '../middleware/authorization.js';
import { ValidationMiddleware } from '../middleware/validation.js';
import { RateLimitingMiddleware } from '../middleware/rate-limiting.js';

export function createAuthRoutes(db: Pool): Router {
  const router = Router();
  const authMiddleware = new AuthenticationMiddleware(db);
  const authzMiddleware = new AuthorizationMiddleware();
  const rateLimitMiddleware = new RateLimitingMiddleware(db);

  // Rate limiting for auth routes
  const authRateLimit = rateLimitMiddleware.createRateLimit({
    windowSizeMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    identifier: 'ip',
    message: 'Too many authentication attempts, please try again later'
  });

  // Public routes (no authentication required)
  router.post('/login', 
    authRateLimit,
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.LOGIN
    }),
    async (req, res) => {
      // Implement login logic
      res.json({ message: 'Login endpoint' });
    }
  );

  router.post('/register',
    authRateLimit,
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.REGISTER
    }),
    async (req, res) => {
      // Implement registration logic
      res.json({ message: 'Register endpoint' });
    }
  );

  router.post('/forgot-password',
    authRateLimit,
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.FORGOT_PASSWORD
    }),
    async (req, res) => {
      // Implement forgot password logic
      res.json({ message: 'Forgot password endpoint' });
    }
  );

  router.post('/reset-password',
    authRateLimit,
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.RESET_PASSWORD
    }),
    async (req, res) => {
      // Implement reset password logic
      res.json({ message: 'Reset password endpoint' });
    }
  );

  // Protected routes (authentication required)
  router.use(authMiddleware.authenticate);

  router.post('/refresh-token', async (req, res) => {
    // Implement token refresh logic
    res.json({ message: 'Refresh token endpoint' });
  });

  router.post('/logout', async (req, res) => {
    // Implement logout logic
    res.json({ message: 'Logout endpoint' });
  });

  router.get('/profile', async (req, res) => {
    // Get user profile
    res.json({ message: 'Profile endpoint' });
  });

  router.put('/profile',
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.UPDATE_PROFILE
    }),
    async (req, res) => {
      // Update user profile
      res.json({ message: 'Update profile endpoint' });
    }
  );

  router.put('/change-password',
    ValidationMiddleware.validate({
      body: ValidationMiddleware.SCHEMAS.CHANGE_PASSWORD
    }),
    async (req, res) => {
      // Change password
      res.json({ message: 'Change password endpoint' });
    }
  );

  // Admin only routes
  router.get('/users',
    authzMiddleware.requireRole('admin'),
    ValidationMiddleware.validate({
      query: ValidationMiddleware.SCHEMAS.PAGINATION_QUERY
    }),
    async (req, res) => {
      // List all users (admin only)
      res.json({ message: 'List users endpoint' });
    }
  );

  router.put('/users/:userId/role',
    authzMiddleware.requireRole('admin'),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM,
      body: ValidationMiddleware.SCHEMAS.UPDATE_USER_ROLE
    }),
    async (req, res) => {
      // Update user role (admin only)
      res.json({ message: 'Update user role endpoint' });
    }
  );

  router.delete('/users/:userId',
    authzMiddleware.requireRole('admin'),
    ValidationMiddleware.validate({
      params: ValidationMiddleware.SCHEMAS.UUID_PARAM
    }),
    async (req, res) => {
      // Delete user (admin only)
      res.json({ message: 'Delete user endpoint' });
    }
  );

  return router;
}

// SCHEMAS are already defined in the validation middleware