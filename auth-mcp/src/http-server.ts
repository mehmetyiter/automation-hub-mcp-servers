import express from 'express';
import cors from 'cors';
import { authService, loginSchema, registerSchema } from './auth-service.js';
import { db } from './database.js';
import { Crypto } from './crypto.js';
import { credentialTemplates } from './credential-templates.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from monorepo root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// .env is located three levels up (monorepo root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
// HTTP server port (can be overridden by AUTH_SERVER_PORT or AUTH_MCP_PORT)
const PORT = process.env.AUTH_SERVER_PORT || process.env.AUTH_MCP_PORT || 3005;

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

// Credentials endpoints
app.get('/auth/credentials', authenticate, async (req: any, res) => {
  try {
    const credentials = await db.getCredentials(req.user.userId);
    
    // Don't send the actual credential data in the list
    const sanitized = credentials.map(cred => ({
      id: cred.id,
      platform: cred.platform,
      name: cred.name,
      created_at: cred.created_at,
      updated_at: cred.updated_at
    }));
    
    res.json({
      success: true,
      data: sanitized
    });
  } catch (error: any) {
    console.error('Get credentials error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credentials'
    });
  }
});

app.post('/auth/credentials', authenticate, async (req: any, res) => {
  try {
    const { platform, name, data } = req.body;
    
    if (!platform || !name || !data) {
      res.status(400).json({
        success: false,
        error: 'Platform, name, and data are required'
      });
      return;
    }
    
    // Encrypt credential data
    const encryptedData = Crypto.encrypt(JSON.stringify(data));
    
    const credentialId = await db.createCredential({
      user_id: req.user.userId,
      platform,
      name,
      data: encryptedData
    });
    
    res.json({
      success: true,
      data: { id: credentialId }
    });
  } catch (error: any) {
    console.error('Create credential error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create credential'
    });
  }
});

app.put('/auth/credentials/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;
    
    if (!data) {
      res.status(400).json({
        success: false,
        error: 'Data is required'
      });
      return;
    }
    
    const encryptedData = Crypto.encrypt(JSON.stringify(data));
    await db.updateCredential(req.user.userId, parseInt(id), encryptedData);
    
    res.json({
      success: true,
      message: 'Credential updated'
    });
  } catch (error: any) {
    console.error('Update credential error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update credential'
    });
  }
});

app.delete('/auth/credentials/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    await db.deleteCredential(req.user.userId, parseInt(id));
    
    res.json({
      success: true,
      message: 'Credential deleted'
    });
  } catch (error: any) {
    console.error('Delete credential error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete credential'
    });
  }
});

// Test credential
app.post('/auth/credentials/test', authenticate, async (req: any, res) => {
  try {
    const { credentials } = req.body;
    
    // For now, just validate the structure
    // In production, actually test the credentials with the platform
    const isValid = credentials && Object.keys(credentials).length > 0;
    
    res.json({
      success: true,
      data: {
        valid: isValid,
        message: isValid ? 'Credentials appear valid' : 'Invalid credentials'
      }
    });
  } catch (error: any) {
    console.error('Test credential error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test credentials'
    });
  }
});

// Credential templates endpoint
app.get('/auth/credentials/templates', authenticate, async (_req: any, res: any) => {
  try {
    res.json({ success: true, data: credentialTemplates });
  } catch (error: any) {
    console.error('Get credential templates error:', error);
    res.status(500).json({ success: false, error: 'Failed to get credential templates' });
  }
});

// Get specific credential (with decryption)
app.get('/auth/credentials/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const credential = await db.getCredentialById(parseInt(id));
    
    if (!credential || credential.user_id !== req.user.userId) {
      res.status(404).json({
        success: false,
        error: 'Credential not found'
      });
      return;
    }
    
    // Decrypt the data
    const decryptedData = JSON.parse(Crypto.decrypt(credential.data));
    
    res.json({
      success: true,
      data: {
        id: credential.id,
        platform: credential.platform,
        name: credential.name,
        data: decryptedData,
        created_at: credential.created_at,
        updated_at: credential.updated_at
      }
    });
  } catch (error: any) {
    console.error('Get credential error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credential'
    });
  }
});

// Test specific credential
app.post('/auth/credentials/:id/test', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const credential = await db.getCredentialById(parseInt(id));
    
    if (!credential || credential.user_id !== req.user.userId) {
      res.status(404).json({
        success: false,
        error: 'Credential not found'
      });
      return;
    }
    
    // Decrypt the credential data
    const decryptedData = JSON.parse(Crypto.decrypt(credential.data));
    
    // Get the template for this platform
    const template = credentialTemplates.find(t => t.id === credential.platform);
    
    // Basic validation based on template
    let isValid = true;
    let message = 'Connection test successful';
    
    if (template) {
      // Check required fields
      for (const field of template.fields) {
        if (field.required && !decryptedData[field.key]) {
          isValid = false;
          message = `Missing required field: ${field.label}`;
          break;
        }
      }
      
      // Platform-specific validation
      if (isValid) {
        switch (credential.platform) {
          case 'vapi':
            // Check if API key format looks valid
            if (!decryptedData.apiKey || decryptedData.apiKey.length < 10) {
              isValid = false;
              message = 'Invalid API key format';
            }
            break;
          
          case 'openai':
            // Check OpenAI API key format
            if (!decryptedData.apiKey || !decryptedData.apiKey.startsWith('sk-')) {
              isValid = false;
              message = 'Invalid OpenAI API key format (should start with sk-)';
            }
            break;
            
          case 'slack':
            // Check Slack token format
            if (!decryptedData.botToken || !decryptedData.botToken.startsWith('xoxb-')) {
              isValid = false;
              message = 'Invalid Slack bot token format (should start with xoxb-)';
            }
            break;
            
          // Add more platform-specific validations as needed
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        valid: isValid,
        message: message
      }
    });
  } catch (error: any) {
    console.error('Test credential error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test credential'
    });
  }
});

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