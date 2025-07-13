import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { TestFactory } from '../../src/testing/test-factory';
import { TestDataManager } from '../../src/testing/test-data-manager';
import { DatabaseHelper } from './helpers/database-helper';
import { MockHelper } from './helpers/mock-helper';
import { LoggingService } from '../../src/observability/logging';

// Global test configuration
const TEST_CONFIG = {
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433'),
    database: process.env.TEST_DB_NAME || 'n8n_mcp_test',
    username: process.env.TEST_DB_USER || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password'
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6380'),
    db: parseInt(process.env.TEST_REDIS_DB || '1')
  },
  timeout: 30000,
  logLevel: 'error' // Suppress logs during tests
};

// Global instances
let dbPool: Pool;
let redisClient: Redis;
let testFactory: TestFactory;
let testDataManager: TestDataManager;
let databaseHelper: DatabaseHelper;
let mockHelper: MockHelper;

// Setup before all tests
beforeAll(async () => {
  // Initialize logging with test config
  LoggingService.configure({
    level: TEST_CONFIG.logLevel,
    silent: true
  });

  // Initialize database connection
  dbPool = new Pool({
    host: TEST_CONFIG.database.host,
    port: TEST_CONFIG.database.port,
    database: TEST_CONFIG.database.database,
    user: TEST_CONFIG.database.username,
    password: TEST_CONFIG.database.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  // Initialize Redis connection
  redisClient = new Redis({
    host: TEST_CONFIG.redis.host,
    port: TEST_CONFIG.redis.port,
    db: TEST_CONFIG.redis.db,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100
  });

  // Initialize helpers
  databaseHelper = new DatabaseHelper(dbPool);
  mockHelper = new MockHelper();

  // Initialize test factory
  testFactory = new TestFactory(dbPool, redisClient);
  await testFactory.initialize();

  // Initialize test data manager
  testDataManager = new TestDataManager(dbPool, redisClient, testFactory);

  // Setup test database schema
  await databaseHelper.setupTestSchema();

  // Wait for connections to be ready
  await dbPool.query('SELECT 1');
  await redisClient.ping();

  console.log('🧪 Test environment initialized');
}, TEST_CONFIG.timeout);

// Cleanup after all tests
afterAll(async () => {
  try {
    // Cleanup test data
    await testDataManager.cleanupAll();

    // Close connections
    await dbPool.end();
    await redisClient.quit();

    console.log('🧹 Test environment cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}, TEST_CONFIG.timeout);

// Setup before each test
beforeEach(async () => {
  // Start transaction for database isolation
  await databaseHelper.beginTransaction();

  // Clear Redis test data
  await redisClient.flushdb();

  // Reset mocks
  mockHelper.resetAllMocks();

  // Start fresh test context
  await testDataManager.startTestContext();
});

// Cleanup after each test
afterEach(async () => {
  try {
    // Cleanup test context
    await testDataManager.endTestContext();

    // Rollback database transaction
    await databaseHelper.rollbackTransaction();

    // Clear Redis
    await redisClient.flushdb();

    // Reset mocks
    mockHelper.resetAllMocks();
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
  }
});

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false
      };
    }
  },

  toHaveBeenCalledWithObjectContaining(received: jest.Mock, expected: object) {
    const calls = received.mock.calls;
    const pass = calls.some(call => 
      call.some(arg => 
        typeof arg === 'object' && 
        Object.keys(expected).every(key => 
          arg[key] !== undefined && 
          JSON.stringify(arg[key]) === JSON.stringify(expected[key])
        )
      )
    );

    if (pass) {
      return {
        message: () => `expected mock not to have been called with object containing ${JSON.stringify(expected)}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected mock to have been called with object containing ${JSON.stringify(expected)}`,
        pass: false
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  factory: testFactory,
  dataManager: testDataManager,
  db: databaseHelper,
  mock: mockHelper,
  redis: redisClient,
  
  // Utility functions
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateTestId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  createTestUser: async (overrides = {}) => {
    return await testFactory.create('user', overrides);
  },
  
  createTestWorkflow: async (overrides = {}) => {
    return await testFactory.create('workflow', overrides);
  },
  
  expectValidResponse: (response: any) => {
    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
    expect(response.data).toBeDefined();
  },
  
  expectValidApiResponse: (response: any, status = 200) => {
    expect(response.status).toBe(status);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toBeDefined();
  },
  
  expectValidationError: (response: any, field?: string) => {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation Error');
    if (field) {
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining(field)
          })
        ])
      );
    }
  }
};

// Performance testing utilities
global.performanceUtils = {
  benchmark: async (fn: Function, iterations = 100) => {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
      p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)]
    };
  },
  
  measureMemory: () => {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external
      };
    }
    return null;
  }
};

// Mock server utilities for external services
global.mockServer = {
  start: mockHelper.startMockServer.bind(mockHelper),
  stop: mockHelper.stopMockServer.bind(mockHelper),
  mock: mockHelper.mockEndpoint.bind(mockHelper),
  reset: mockHelper.resetMockServer.bind(mockHelper)
};

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Increase test timeout for slower operations
jest.setTimeout(TEST_CONFIG.timeout);

// Configure test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.API_KEY_SALT = 'test-api-key-salt';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';

export {
  dbPool,
  redisClient,
  testFactory,
  testDataManager,
  databaseHelper,
  mockHelper,
  TEST_CONFIG
};

// Type declarations for global utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toHaveBeenCalledWithObjectContaining(expected: object): R;
    }
  }

  var testUtils: {
    factory: TestFactory;
    dataManager: TestDataManager;
    db: DatabaseHelper;
    mock: MockHelper;
    redis: Redis;
    wait: (ms: number) => Promise<void>;
    generateTestId: () => string;
    createTestUser: (overrides?: any) => Promise<any>;
    createTestWorkflow: (overrides?: any) => Promise<any>;
    expectValidResponse: (response: any) => void;
    expectValidApiResponse: (response: any, status?: number) => void;
    expectValidationError: (response: any, field?: string) => void;
  };

  var performanceUtils: {
    benchmark: (fn: Function, iterations?: number) => Promise<{
      min: number;
      max: number;
      avg: number;
      p95: number;
      p99: number;
    }>;
    measureMemory: () => any;
  };

  var mockServer: {
    start: (port?: number) => Promise<void>;
    stop: () => Promise<void>;
    mock: (endpoint: string, response: any) => void;
    reset: () => void;
  };
}