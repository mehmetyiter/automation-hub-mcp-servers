import { Router, Request, Response } from 'express';
import { AIWorkflowGeneratorV2 } from '../ai-workflow-generator-v2.js';
import fetch from 'node-fetch';

const router = Router();

// Middleware to check authentication
async function requireAuth(req: Request, res: Response, next: Function): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Development token bypass
  if (token === 'dev-token-12345') {
    req.user = {
      id: 1,
      userId: 1,
      email: 'dev@example.com',
      name: 'Dev User',
      role: 'admin'
    };
    next();
    return;
  }

  try {
    // Validate token with auth service
    const authResponse = await fetch('http://localhost:3005/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!authResponse.ok) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const userData = await authResponse.json();
    req.user = userData.user;
    next();
  } catch (error) {
    console.error('Auth validation error:', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
}

// Get supported AI providers
router.get('/providers', async (_req: Request, res: Response) => {
  const { ProviderFactory } = await import('../providers/provider-factory.js');
  const providers = ProviderFactory.getActiveProviders();
  res.json({ providers });
});

// Get user's AI provider settings
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const response = await fetch(`http://localhost:3005/api/ai-providers/user/${req.user.id}`, {
      headers: {
        'Authorization': req.headers.authorization!
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch provider settings');
    }

    const settings = await response.json();
    res.json(settings);
  } catch (error: any) {
    console.error('Error fetching AI provider settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save AI provider settings
router.post('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, model, temperature, maxTokens } = req.body;

    if (!provider || !apiKey) {
      res.status(400).json({ error: 'Provider and API key are required' });
      return;
    }
    
    const generator = new AIWorkflowGeneratorV2({
      provider,
      apiKey,
      model,
      temperature,
      maxTokens
    });

    const isValid = await generator.testConnection();
    if (!isValid) {
      res.status(400).json({ error: 'Invalid API key or connection failed' });
      return;
    }
    
    // Save to auth service
    const response = await fetch('http://localhost:3005/api/ai-providers/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization!
      },
      body: JSON.stringify({
        provider,
        apiKey,
        model,
        temperature,
        maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const result = await response.json();
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error saving AI provider settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set active provider
router.post('/settings/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;

    if (!provider) {
      res.status(400).json({ error: 'Provider is required' });
      return;
    }

    const response = await fetch('http://localhost:3005/api/ai-providers/active', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization!
      },
      body: JSON.stringify({ provider })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error setting active provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available models for a provider
router.post('/models', requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body;

    if (!provider || !apiKey) {
      res.status(400).json({ error: 'Provider and API key are required' });
      return;
    }

    const generator = new AIWorkflowGeneratorV2({
      provider,
      apiKey
    });

    const models = await generator.getAvailableModels();
    res.json({ models });
  } catch (error: any) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete provider settings
router.delete('/settings/:provider', requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    const response = await fetch(`http://localhost:3005/api/ai-providers/settings/${provider}`, {
      method: 'DELETE',
      headers: {
        'Authorization': req.headers.authorization!
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting provider settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat completion endpoint
router.post('/chat/completion', requireAuth, async (req: Request, res: Response) => {
  try {
    const { messages, useUserSettings, useSpecificProvider, provider: providerName, apiKey, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    let generatorConfig: any = {};

    // If using specific provider selection
    if (useSpecificProvider && providerName) {
      // Get the specific provider's details with decrypted API key
      const providerResponse = await fetch(`http://localhost:3005/api/ai-providers/provider/${providerName}`, {
        headers: {
          'Authorization': req.headers.authorization!
        }
      });

      if (!providerResponse.ok) {
        await providerResponse.text();
        throw new Error(`No API key found for ${providerName}. Please add it in Settings.`);
      }

      const providerData = await providerResponse.json();
      
      generatorConfig = {
        provider: providerName,
        apiKey: providerData.data.apiKey,
        model: model || providerData.data.model,
        temperature: providerData.data.temperature || 0.7,
        maxTokens: providerData.data.maxTokens || 2000
      };
    }
    // If using stored user settings
    else if (useUserSettings) {
      const activeProviderResponse = await fetch('http://localhost:3005/api/ai-providers/active', {
        headers: {
          'Authorization': req.headers.authorization!
        }
      });

      if (!activeProviderResponse.ok) {
        throw new Error('No active AI provider configured. Please set one in Settings.');
      }

      const activeProvider = await activeProviderResponse.json();
      if (!activeProvider.success || !activeProvider.data) {
        throw new Error('No active AI provider found');
      }

      generatorConfig = {
        provider: activeProvider.data.provider,
        apiKey: activeProvider.data.apiKey,
        model: activeProvider.data.model || (activeProvider.data.provider === 'openai' ? 'o3' : undefined),
        temperature: activeProvider.data.temperature || 0.7,
        maxTokens: activeProvider.data.maxTokens || 2000
      };
    } else {
      // Use provided credentials
      generatorConfig = {
        provider: providerName || 'openai',
        apiKey: apiKey,
        model: model || 'o3',
        temperature: 0.7,
        maxTokens: 2000
      };

      if (!generatorConfig.apiKey) {
        res.status(400).json({ error: 'API key is required' });
        return;
      }
    }

    // Create provider instance and use chat method
    const { ProviderFactory } = await import('../providers/provider-factory.js');
    const providerInstance = ProviderFactory.createProvider(generatorConfig);
    
    // Check if the provider has a chat method
    if ('chat' in providerInstance && typeof providerInstance.chat === 'function') {
      const result = await providerInstance.chat(messages);
      
      if (result.success) {
        res.json({ 
          success: true, 
          content: result.content,
          usage: result.usage 
        });
      } else {
        throw new Error(result.error || 'Chat failed');
      }
    } else {
      // Fallback for providers without chat method - use the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        res.status(400).json({ error: 'No user message found' });
        return;
      }

      // Generate a workflow-focused response
      const workflowPrompt = `Based on this request: "${lastUserMessage.content}", provide a detailed workflow automation prompt that includes:
      1. Clear trigger events
      2. Step-by-step data processing
      3. Required integrations
      4. Error handling considerations
      5. Expected outcomes
      
      Make it comprehensive and production-ready.`;

      const generator = new AIWorkflowGeneratorV2(generatorConfig);
      const result = await generator.generateFromPrompt(workflowPrompt, 'Assistant Response');
      
      if (result.success && result.workflow) {
        const response = result.workflow.description || 
          `I'll help you create an automation for: ${lastUserMessage.content}. Here's a detailed workflow prompt that includes all necessary components.`;
        
        res.json({ 
          success: true, 
          content: response,
          usage: result.usage 
        });
      } else {
        res.json({ 
          success: true, 
          content: `I'll help you create a workflow for: ${lastUserMessage.content}. Please provide more details about your automation requirements.` 
        });
      }
    }
  } catch (error: any) {
    console.error('Chat completion error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;