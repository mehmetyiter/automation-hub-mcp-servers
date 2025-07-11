import express from 'express';
import { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { setupTestDatabase } from './test-database';
import { AdvancedEncryptionService } from '../../src/security/advanced-encryption-service';
import { Logger } from '../../src/utils/logger';

export async function createTestApp(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(helmet({
    contentSecurityPolicy: false // Disable for testing
  }));
  
  app.use(cors({
    origin: true,
    credentials: true
  }));
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting for testing (more permissive)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  app.use(limiter);

  // Initialize services
  const logger = new Logger();
  const encryptionService = new AdvancedEncryptionService(
    process.env.TEST_ENCRYPTION_KEY || 'test-key-1234567890123456789012345678901234567890'
  );

  // Store services in app locals for access in tests
  app.locals.logger = logger;
  app.locals.encryptionService = encryptionService;
  app.locals.database = await setupTestDatabase();

  // Health check endpoint
  app.get('/api/v1/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  });

  // Mock authentication middleware
  app.use('/api/v1', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header'
        }
      });
    }

    const token = authHeader.substring(7);
    // Simple token validation for testing
    if (token.startsWith('test-user-')) {
      req.user = { id: token, email: `${token}@test.com` };
      next();
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    }
  });

  // Credentials endpoints
  app.post('/api/v1/credentials', async (req, res) => {
    try {
      const { provider, apiKey, name, metadata } = req.body;

      // Validation
      if (!provider || !apiKey || !name) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields'
          }
        });
      }

      // Basic API key format validation
      if (provider === 'openai' && !apiKey.startsWith('sk-')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid API key format for OpenAI'
          }
        });
      }

      const credentialId = `cred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      res.status(201).json({
        success: true,
        data: {
          id: credentialId,
          userId: req.user.id,
          provider,
          name,
          validationStatus: 'pending',
          isActive: true,
          createdAt: new Date().toISOString(),
          metadata: metadata || {}
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create credential'
        }
      });
    }
  });

  app.get('/api/v1/credentials', async (req, res) => {
    try {
      const { page = 1, limit = 10, provider, isActive } = req.query;
      
      // Mock credentials data
      let credentials = [
        {
          id: 'cred-1',
          userId: req.user.id,
          provider: 'openai',
          name: 'OpenAI Production',
          validationStatus: 'valid',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 'cred-2',
          userId: req.user.id,
          provider: 'anthropic',
          name: 'Claude API',
          validationStatus: 'valid',
          isActive: true,
          createdAt: '2024-01-02T00:00:00Z'
        },
        {
          id: 'cred-3',
          userId: req.user.id,
          provider: 'google',
          name: 'Gemini Test',
          validationStatus: 'pending',
          isActive: false,
          createdAt: '2024-01-03T00:00:00Z'
        }
      ];

      // Apply filters
      if (provider) {
        credentials = credentials.filter(c => c.provider === provider);
      }
      
      if (isActive !== undefined) {
        credentials = credentials.filter(c => c.isActive === (isActive === 'true'));
      }

      // Pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedCredentials = credentials.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedCredentials,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: credentials.length,
          pages: Math.ceil(credentials.length / Number(limit))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch credentials'
        }
      });
    }
  });

  app.get('/api/v1/usage/analytics', async (req, res) => {
    try {
      const { timeframe = '7d' } = req.query;

      res.json({
        success: true,
        data: {
          totalCost: 125.50,
          totalRequests: 1500,
          totalTokens: 750000,
          providerBreakdown: [
            { provider: 'openai', cost: 85.30, percentage: 68.0 },
            { provider: 'anthropic', cost: 40.20, percentage: 32.0 }
          ],
          costTrends: [
            { date: '2024-01-01', cost: 15.20 },
            { date: '2024-01-02', cost: 18.50 },
            { date: '2024-01-03', cost: 22.80 }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch analytics'
        }
      });
    }
  });

  app.get('/api/v1/usage/export', async (req, res) => {
    try {
      const { format = 'csv' } = req.query;

      if (format === 'csv') {
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="usage-export.csv"'
        });
        
        res.send('provider,model,cost,tokens,date\nopenai,gpt-4,0.05,1000,2024-01-01\nanthropic,claude-3,0.03,800,2024-01-02');
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Unsupported export format'
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to export data'
        }
      });
    }
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON in request body'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  });

  return app;
}