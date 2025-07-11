import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../fixtures/test-app';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-database';
import { generateTestToken } from '../fixtures/test-auth';

describe('API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
    
    testUserId = 'test-user-123';
    authToken = generateTestToken(testUserId);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('POST /api/v1/credentials', () => {
    it('should create a new credential successfully', async () => {
      const credentialData = {
        provider: 'openai',
        apiKey: 'sk-test1234567890abcdef',
        name: 'Test OpenAI Key',
        metadata: {
          environment: 'production',
          project: 'test-project'
        }
      };

      const response = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send(credentialData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          userId: testUserId,
          provider: 'openai',
          name: 'Test OpenAI Key',
          validationStatus: 'pending',
          isActive: true
        }
      });

      expect(response.body.data.apiKey).toBeUndefined();
      expect(response.body.data.encryptedApiKey).toBeUndefined();
    });

    it('should validate API key format', async () => {
      const invalidCredentials = [
        { provider: 'openai', apiKey: 'invalid-key' },
        { provider: 'anthropic', apiKey: 'sk-123' },
        { provider: 'google', apiKey: '' }
      ];

      for (const credential of invalidCredentials) {
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send(credential)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Invalid')
          }
        });
      }
    });

    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 15 }, () =>
        request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            provider: 'openai',
            apiKey: 'sk-test1234567890abcdef',
            name: 'Rate limit test'
          })
      );

      const responses = await Promise.all(requests);
      
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      if (rateLimited.length > 0) {
        const rateLimitedResponse = rateLimited[0];
        expect(rateLimitedResponse.body).toMatchObject({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED'
          }
        });
        
        expect(rateLimitedResponse.headers['x-ratelimit-limit']).toBeDefined();
        expect(rateLimitedResponse.headers['x-ratelimit-remaining']).toBe('0');
        expect(rateLimitedResponse.headers['x-ratelimit-reset']).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/credentials', () => {
    it('should list user credentials with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          total: expect.any(Number),
          pages: expect.any(Number)
        }
      });
    });

    it('should filter credentials by provider', async () => {
      const response = await request(app)
        .get('/api/v1/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ provider: 'openai' })
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: 'openai' })
        ])
      );
    });
  });

  describe('GET /api/v1/usage/analytics', () => {
    it('should return usage analytics', async () => {
      const response = await request(app)
        .get('/api/v1/usage/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeframe: '7d' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalCost: expect.any(Number),
          totalRequests: expect.any(Number),
          totalTokens: expect.any(Number),
          providerBreakdown: expect.any(Array),
          costTrends: expect.any(Array)
        }
      });
    });

    it('should support CSV export', async () => {
      const response = await request(app)
        .get('/api/v1/usage/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          format: 'csv',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      });
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: expect.stringContaining('JSON')
        }
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });
  });
});