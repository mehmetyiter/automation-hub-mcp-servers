import { Router, Request, Response } from 'express';
import { AIWorkflowGeneratorV2 } from '../ai-workflow-generator-v2.js';
import fetch from 'node-fetch';
import { AIChatService } from '../services/ai-chat-service.js';

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
    const { messages, useUserSettings, useSpecificProvider, provider: providerName, apiKey, model, temperature, maxTokens, credentialId, useCredentialId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    // Initialize chat service
    const chatService = new AIChatService();
    
    let generatorConfig: any = {};
    
    console.log('Chat completion request:', {
      useCredentialId,
      credentialId,
      useSpecificProvider,
      provider: providerName,
      useUserSettings,
      hasApiKey: !!apiKey
    });

    // If using credential ID
    if (useCredentialId && credentialId && credentialId !== 'undefined') {
      console.log('Fetching credential:', credentialId);
      // Get credential details from auth service
      const credentialResponse = await fetch(`http://localhost:3005/auth/credentials/${credentialId}`, {
        headers: {
          'Authorization': req.headers.authorization!
        }
      });

      if (!credentialResponse.ok) {
        const error = await credentialResponse.text();
        console.error('Failed to fetch credential:', credentialResponse.status, error);
        throw new Error(`Failed to get credential: ${error}`);
      }

      const credentialData = await credentialResponse.json();
      const credential = credentialData.data;
      
      // Determine provider type from platform field
      let providerType = credential.platform || credential.templateId;
      
      if (!providerType) {
        console.error('No provider type found in credential');
        throw new Error('Invalid credential: missing provider type');
      }
      
      // Normalize provider names
      if (providerType === 'google_ai') {
        providerType = 'gemini';
      } else if (providerType === 'anthropic' || providerType?.includes('claude')) {
        providerType = 'anthropic';
      }
      
      // Model is required
      if (!model) {
        res.status(400).json({ error: 'Model selection is required' });
        return;
      }
      
      generatorConfig = {
        provider: providerType,
        apiKey: credential.data?.apiKey || credential.data?.api_key || credential.credentials?.apiKey || credential.credentials?.api_key,
        model: model,
        temperature: temperature || 0.7,
        maxTokens: maxTokens // No default
      };
    }
    // If using specific provider selection - ALWAYS use user's stored API keys
    else if (useSpecificProvider && providerName) {
      // Get the specific provider's details with decrypted API key
      const providerResponse = await fetch(`http://localhost:3005/api/ai-providers/provider/${providerName}`, {
        headers: {
          'Authorization': req.headers.authorization!
        }
      });

      if (!providerResponse.ok) {
        await providerResponse.text();
        throw new Error(`No API key found for ${providerName}. Please add it as a credential.`);
      }

      const providerData = await providerResponse.json();
      
      // Model is required
      if (!model && !providerData.data.model) {
        res.status(400).json({ error: 'Model selection is required' });
        return;
      }
      
      generatorConfig = {
        provider: providerName,
        apiKey: providerData.data.apiKey,
        model: model || providerData.data.model,
        temperature: providerData.data.temperature || 0.7,
        maxTokens: providerData.data.maxTokens // No default
      };
    }
    // If using stored user settings
    else if (useUserSettings) {
      console.log('Fetching active provider for user settings...');
      const activeProviderResponse = await fetch('http://localhost:3005/api/ai-providers/active', {
        headers: {
          'Authorization': req.headers.authorization!
        }
      });

      if (!activeProviderResponse.ok) {
        const errorText = await activeProviderResponse.text();
        console.error('Failed to fetch active provider:', activeProviderResponse.status, errorText);
        throw new Error('No active AI provider configured. Please set one in Settings.');
      }

      const activeProvider = await activeProviderResponse.json();
      console.log('Active provider response:', activeProvider);
      
      if (!activeProvider.success || !activeProvider.data) {
        throw new Error('No active AI provider found. Please configure one in Settings.');
      }

      // Model is required
      if (!model && !activeProvider.data.model) {
        res.status(400).json({ error: 'Model selection is required' });
        return;
      }
      
      generatorConfig = {
        provider: activeProvider.data.provider,
        apiKey: activeProvider.data.apiKey,
        model: model || activeProvider.data.model,
        temperature: activeProvider.data.temperature || 0.7,
        maxTokens: activeProvider.data.maxTokens // No default
      };
    } else if (providerName && apiKey) {
      // Model is required
      if (!model) {
        res.status(400).json({ error: 'Model selection is required' });
        return;
      }
      
      // Use provided credentials
      generatorConfig = {
        provider: providerName,
        apiKey: apiKey,
        model: model,
        temperature: 0.7,
        maxTokens: maxTokens // Use provided maxTokens, no default
      };
    } else {
      res.status(400).json({ 
        error: 'Either select a credential or provide both provider and API key' 
      });
      return;
    }

    // Use our enhanced chat service instead of direct provider
    const result = await chatService.processChat(messages, generatorConfig);
    
    if (result.success) {
      res.json({
        success: true,
        content: result.content,
        usage: result.usage,
        // Include analysis data for debugging (optional)
        _analysis: result.analysis
      });
    } else {
      // If chat service fails, fallback to direct provider
      const { ProviderFactory } = await import('../providers/provider-factory.js');
      const providerInstance = ProviderFactory.createProvider(generatorConfig);
      
      // Check if the provider has a chat method
      if ('chat' in providerInstance && typeof providerInstance.chat === 'function') {
        const fallbackResult = await providerInstance.chat(messages);
        
        if (fallbackResult.success) {
          res.json({ 
            success: true, 
            content: fallbackResult.content,
            usage: fallbackResult.usage,
            _note: 'Fallback to direct provider due to chat service error'
          });
        } else {
          throw new Error(fallbackResult.error || 'Chat failed');
        }
      } else {
      // Fallback for providers without chat method - use the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        res.status(400).json({ error: 'No user message found' });
        return;
      }

      // Generate a workflow-focused response
      // For chat context, we should just process the user's message directly
      const generator = new AIWorkflowGeneratorV2(generatorConfig);
      
      // Pass the user's message directly to the workflow generator
      // This will use the proper system prompt that requests JSON format
      const result = await generator.generateFromPrompt(lastUserMessage.content, 'Assistant Response');
      
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
    }
  } catch (error: any) {
    console.error('Chat completion error:', error);
    
    // Extract user-friendly error message
    let errorMessage = error.message || 'Failed to process chat request';
    let statusCode = 500;
    
    // Handle token limit errors
    if (error.message?.includes('max_tokens')) {
      const match = error.message.match(/max_tokens: (\d+) > (\d+)/);
      if (match) {
        errorMessage = `Token limit exceeded: You requested ${match[1]} tokens but the selected model supports a maximum of ${match[2]} tokens. Please reduce the max tokens setting.`;
        statusCode = 400;
      }
    }
    // Handle rate limit errors
    else if (error.message?.includes('rate_limit') || error.message?.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
      statusCode = 429;
    }
    // Handle authentication errors
    else if (error.message?.includes('401') || error.message?.includes('authentication')) {
      errorMessage = 'Authentication failed. Please check your API credentials.';
      statusCode = 401;
    }
    
    res.status(statusCode).json({ error: errorMessage });
  }
});

export default router;