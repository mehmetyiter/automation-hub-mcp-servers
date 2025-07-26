import express from 'express';
import cors from 'cors';
import { authService, loginSchema, registerSchema } from './auth-service.js';
import { db } from './database.js';
import { Crypto } from './crypto.js';
import { credentialTemplates } from './credential-templates.js';
import { 
  createAIProviderTable, 
  saveAIProviderSettings, 
  getAIProviderSettings, 
  getActiveAIProvider,
  setActiveAIProvider,
  deleteAIProviderSettings
} from './database-ai-providers.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// First try to load from auth-mcp's own .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Then load from monorepo root .env (for shared configs)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
// HTTP server port (can be overridden by AUTH_SERVER_PORT or AUTH_MCP_PORT)
const PORT = process.env.AUTH_SERVER_PORT || process.env.AUTH_MCP_PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
await db.initialize();
await createAIProviderTable();

// Middleware to verify auth token
const authenticate = async (req: any, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Development token bypass
    if (token === 'dev-token-12345') {
      req.user = {
        userId: 1,
        email: 'dev@example.com',
        name: 'Dev User',
        role: 'admin'
      };
      next();
      return;
    }
    
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
app.get('/auth/verify', async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Development token bypass
    if (token === 'dev-token-12345') {
      res.json({
        success: true,
        message: 'Token is valid',
        user: {
          userId: 1,
          email: 'dev@example.com',
          name: 'Dev User',
          role: 'admin'
        }
      });
      return;
    }
    
    // Production token verification
    const payload = await authService.verifyToken(token);
    res.json({
      success: true,
      message: 'Token is valid',
      user: payload
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Validate token (for internal services)
app.post('/auth/validate', authenticate, async (req: any, res) => {
  res.json({
    success: true,
    user: req.user
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
    console.log('Credential templates requested, count:', credentialTemplates.length);
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

// Add /api/credentials endpoint as alias for /auth/credentials (for frontend compatibility)
app.get('/api/credentials', authenticate, async (req: any, res) => {
  try {
    const credentials = await db.getCredentials(req.user.userId);
    
    // Don't send the actual credential data in the list
    const sanitized = credentials.map(cred => ({
      id: cred.id,
      platform: cred.platform,
      name: cred.name,
      templateId: cred.platform, // Add templateId for compatibility
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

// Add /api/credentials/:id endpoint for fetching individual credentials
app.get('/api/credentials/:id', authenticate, async (req: any, res) => {
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
        templateId: credential.platform, // Add templateId for compatibility
        credentials: decryptedData, // Use 'credentials' instead of 'data' for compatibility
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

// AI Provider Settings endpoints
app.get('/api/ai-providers/user/:userId', authenticate, async (req: any, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only access their own settings
    if (parseInt(userId) !== req.user.userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden'
      });
      return;
    }
    
    const settings = await getAIProviderSettings(req.user.userId);
    
    // Decrypt API keys and sanitize response
    const decryptedSettings = settings.map(setting => ({
      provider: setting.provider,
      model: setting.model,
      temperature: setting.temperature,
      maxTokens: setting.max_tokens,
      isActive: setting.is_active,
      // Don't send the encrypted API key
      hasApiKey: !!setting.api_key_encrypted
    }));
    
    res.json(decryptedSettings);
  } catch (error: any) {
    console.error('Get AI provider settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI provider settings'
    });
  }
});

app.post('/api/ai-providers/settings', authenticate, async (req: any, res) => {
  try {
    const { provider, apiKey, model, temperature, maxTokens } = req.body;
    
    if (!provider || !apiKey) {
      res.status(400).json({
        success: false,
        error: 'Provider and API key are required'
      });
      return;
    }
    
    // Encrypt the API key
    const encryptedApiKey = Crypto.encrypt(apiKey);
    
    await saveAIProviderSettings({
      user_id: req.user.userId,
      provider,
      api_key_encrypted: encryptedApiKey,
      model,
      temperature,
      max_tokens: maxTokens
    });
    
    res.json({
      success: true,
      message: 'AI provider settings saved'
    });
  } catch (error: any) {
    console.error('Save AI provider settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save AI provider settings'
    });
  }
});

app.post('/api/ai-providers/active', authenticate, async (req: any, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
      return;
    }
    
    await setActiveAIProvider(req.user.userId, provider);
    
    res.json({
      success: true,
      message: 'Active provider updated'
    });
  } catch (error: any) {
    console.error('Set active provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set active provider'
    });
  }
});

app.delete('/api/ai-providers/settings/:provider', authenticate, async (req: any, res) => {
  try {
    const { provider } = req.params;
    
    await deleteAIProviderSettings(req.user.userId, provider);
    
    res.json({
      success: true,
      message: 'Provider settings deleted'
    });
  } catch (error: any) {
    console.error('Delete provider settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete provider settings'
    });
  }
});

// Get specific provider with decrypted API key
app.get('/api/ai-providers/provider/:provider', authenticate, async (req: any, res) => {
  try {
    const { provider } = req.params;
    const settings = await getAIProviderSettings(req.user.userId);
    const providerSetting = settings.find(s => s.provider === provider);
    
    if (!providerSetting) {
      res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
      return;
    }
    
    // Decrypt the API key
    const decryptedApiKey = Crypto.decrypt(providerSetting.api_key_encrypted);
    
    res.json({
      success: true,
      data: {
        provider: providerSetting.provider,
        apiKey: decryptedApiKey,
        model: providerSetting.model,
        temperature: providerSetting.temperature,
        maxTokens: providerSetting.max_tokens
      }
    });
  } catch (error: any) {
    console.error('Get provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get provider'
    });
  }
});

// Get active AI provider with decrypted API key (for internal use)
app.get('/api/ai-providers/active', authenticate, async (req: any, res) => {
  try {
    const activeProvider = await getActiveAIProvider(req.user.userId);
    
    if (!activeProvider) {
      res.status(404).json({
        success: false,
        error: 'No active AI provider found'
      });
      return;
    }
    
    // Decrypt the API key
    const decryptedApiKey = Crypto.decrypt(activeProvider.api_key_encrypted);
    
    res.json({
      success: true,
      data: {
        provider: activeProvider.provider,
        apiKey: decryptedApiKey,
        model: activeProvider.model,
        temperature: activeProvider.temperature,
        maxTokens: activeProvider.max_tokens
      }
    });
  } catch (error: any) {
    console.error('Get active provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active provider'
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