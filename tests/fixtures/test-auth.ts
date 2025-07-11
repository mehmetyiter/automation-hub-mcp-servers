import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const TEST_JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-key-1234567890';

export function generateTestToken(userId: string, expiresIn: string = '1h'): string {
  return jwt.sign(
    {
      sub: userId,
      email: `${userId}@test.com`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    },
    TEST_JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

export function verifyTestToken(token: string): any {
  try {
    return jwt.verify(token, TEST_JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid test token');
  }
}

export function generateTestApiKey(provider: string): string {
  const prefixes = {
    openai: 'sk-',
    anthropic: 'sk-ant-',
    google: 'AIza',
    azure: 'az-'
  };

  const prefix = prefixes[provider as keyof typeof prefixes] || 'test-';
  const randomPart = crypto.randomBytes(16).toString('hex');
  
  return `${prefix}${randomPart}`;
}

export function generateTestCredentials(count: number = 1) {
  const providers = ['openai', 'anthropic', 'google', 'azure'];
  const credentials = [];

  for (let i = 0; i < count; i++) {
    const provider = providers[i % providers.length];
    credentials.push({
      id: `test-cred-${i + 1}`,
      provider,
      name: `Test ${provider.charAt(0).toUpperCase() + provider.slice(1)} Key ${i + 1}`,
      apiKey: generateTestApiKey(provider),
      isActive: true,
      validationStatus: Math.random() > 0.3 ? 'valid' : 'pending',
      metadata: {
        environment: i % 2 === 0 ? 'production' : 'staging',
        project: `test-project-${Math.floor(i / 2) + 1}`
      }
    });
  }

  return credentials;
}

export function mockAuthMiddleware() {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header'
        }
      });
    }

    try {
      const token = authHeader.substring(7);
      const decoded = verifyTestToken(token);
      
      req.user = {
        id: decoded.sub,
        email: decoded.email
      };
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    }
  };
}

export class TestAuthHelper {
  private users: Map<string, any> = new Map();
  private sessions: Map<string, any> = new Map();

  createTestUser(userData: Partial<{
    id: string;
    email: string;
    password: string;
    isActive: boolean;
  }> = {}) {
    const user = {
      id: userData.id || `test-user-${Date.now()}`,
      email: userData.email || `test-${Date.now()}@example.com`,
      password: userData.password || 'TestPassword123!',
      isActive: userData.isActive ?? true,
      createdAt: new Date().toISOString()
    };

    this.users.set(user.id, user);
    return user;
  }

  createTestSession(userId: string, sessionData: Partial<{
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
  }> = {}) {
    const session = {
      id: `session-${Date.now()}`,
      userId,
      token: generateTestToken(userId),
      expiresAt: sessionData.expiresAt || new Date(Date.now() + 3600000), // 1 hour
      ipAddress: sessionData.ipAddress || '127.0.0.1',
      userAgent: sessionData.userAgent || 'Test User Agent',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    this.sessions.set(session.token, session);
    return session;
  }

  getUser(userId: string) {
    return this.users.get(userId);
  }

  getSession(token: string) {
    return this.sessions.get(token);
  }

  revokeSession(token: string) {
    const session = this.sessions.get(token);
    if (session) {
      session.isActive = false;
    }
  }

  cleanup() {
    this.users.clear();
    this.sessions.clear();
  }
}