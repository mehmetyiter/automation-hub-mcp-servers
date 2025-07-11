import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import autocannon from 'autocannon';
import { createTestApp } from '../fixtures/test-app';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-database';
import { generateTestToken } from '../fixtures/test-auth';

describe('Load Testing', () => {
  let app: any;
  let server: any;
  let authToken: string;
  let baseUrl: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
    
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    
    authToken = generateTestToken('load-test-user');
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await teardownTestDatabase();
  });

  describe('API Endpoint Performance', () => {
    it('should handle credential listing under load', async () => {
      const result = await autocannon({
        url: `${baseUrl}/api/v1/credentials`,
        connections: 10,
        duration: 10,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.latency.mean).toBeLessThan(100); // < 100ms average
      expect(result.requests.mean).toBeGreaterThan(50); // > 50 req/sec
    });

    it('should handle credential creation under load', async () => {
      const credentialPayload = {
        provider: 'openai',
        apiKey: 'sk-test1234567890abcdef',
        name: 'Load Test Key'
      };

      const result = await autocannon({
        url: `${baseUrl}/api/v1/credentials`,
        method: 'POST',
        connections: 5,
        duration: 10,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentialPayload)
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.mean).toBeLessThan(200); // < 200ms for writes
      expect(result.requests.mean).toBeGreaterThan(20); // > 20 req/sec for writes
    });

    it('should handle usage analytics queries under load', async () => {
      const result = await autocannon({
        url: `${baseUrl}/api/v1/usage/analytics?timeframe=7d`,
        connections: 15,
        duration: 10,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.latency.mean).toBeLessThan(300); // < 300ms for analytics
      expect(result.requests.mean).toBeGreaterThan(30); // > 30 req/sec
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should handle rate limiting gracefully under high load', async () => {
      const result = await autocannon({
        url: `${baseUrl}/api/v1/credentials`,
        connections: 50, // High concurrency
        duration: 5,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Should handle rate limiting without errors
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      
      // Some requests should be rate limited (429)
      const rateLimitedCount = result['429'] || 0;
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // Should still maintain good performance for accepted requests
      expect(result.latency.p95).toBeLessThan(500);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run sustained load for 30 seconds
      await autocannon({
        url: `${baseUrl}/api/v1/health`,
        connections: 20,
        duration: 30,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const finalMemory = process.memoryUsage();
      
      // Memory growth should be reasonable (< 50MB increase)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });

  describe('Database Connection Pool Performance', () => {
    it('should efficiently manage database connections', async () => {
      const result = await autocannon({
        url: `${baseUrl}/api/v1/credentials`,
        connections: 25, // More than default pool size
        duration: 15,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      
      // Should handle more connections than pool size efficiently
      expect(result.latency.mean).toBeLessThan(150);
      expect(result.requests.mean).toBeGreaterThan(40);
    });
  });

  describe('Concurrent User Simulation', () => {
    it('should handle multiple users with different access patterns', async () => {
      const userTokens = Array.from({ length: 5 }, (_, i) => 
        generateTestToken(`load-test-user-${i}`)
      );

      const scenarios = [
        // Read-heavy users
        ...userTokens.slice(0, 3).map(token => autocannon({
          url: `${baseUrl}/api/v1/credentials`,
          connections: 5,
          duration: 10,
          headers: { 'Authorization': `Bearer ${token}` }
        })),
        
        // Analytics users
        ...userTokens.slice(3, 5).map(token => autocannon({
          url: `${baseUrl}/api/v1/usage/analytics?timeframe=30d`,
          connections: 3,
          duration: 10,
          headers: { 'Authorization': `Bearer ${token}` }
        }))
      ];

      const results = await Promise.all(scenarios);
      
      // All scenarios should complete successfully
      results.forEach(result => {
        expect(result.errors).toBe(0);
        expect(result.timeouts).toBe(0);
        expect(result.latency.mean).toBeLessThan(200);
      });
    });
  });
});