import express from 'express';
import cors from 'cors';
import { authService, loginSchema, registerSchema } from './auth-service.js';
import { db } from './database.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.AUTH_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
await db.initialize();

// Middleware to verify auth token
const authenticate = async (req: any, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }
};

// Routes
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'auth-mcp',
    timestamp: new Date().toISOString()
  });
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    
    res.json({
      success: true,
      data: {
        accessToken: result.token,
        user: result.user
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    
    res.json({
      success: true,
      data: {
        accessToken: result.token,
        user: result.user
      }
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
});

// Logout
app.post('/auth/logout', authenticate, async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.replace('Bearer ', '');
    await authService.logout(token);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Logout failed'
    });
  }
});

// Get current user
app.get('/auth/me', authenticate, async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.replace('Bearer ', '');
    const user = await authService.getUserFromToken(token);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get user'
    });
  }
});

// Verify token
app.get('/auth/verify', authenticate, async (_req: any, res) => {
  res.json({
    success: true,
    message: 'Token is valid'
  });
});

// Clean up expired sessions periodically
setInterval(async () => {
  try {
    await authService.cleanupSessions();
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}, 3600000); // Every hour

// Start server
app.listen(PORT, () => {
  console.log(`Auth MCP HTTP Server running on http://localhost:${PORT}`);
});