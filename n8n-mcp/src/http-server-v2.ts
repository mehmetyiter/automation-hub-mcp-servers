import express from 'express';
import cors from 'cors';
import { N8nClient } from './n8n-client.js';
import { AIWorkflowGeneratorV2 } from './ai-workflow-generator-v2.js';
import aiProvidersRouter from './routes/ai-providers.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.N8N_HTTP_PORT || 3006;

const n8nClient = new N8nClient({
  apiKey: process.env.N8N_API_KEY || '',
  baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678'
});

app.use(cors());
app.use(express.json());

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// AI Providers routes
app.use('/api/ai-providers', aiProvidersRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'n8n-mcp-http',
    timestamp: new Date().toISOString()
  });
});

// List workflows
app.post('/tools/n8n_list_workflows', async (_req, res) => {
  try {
    const workflows = await n8nClient.listWorkflows();
    res.json({
      success: true,
      data: workflows
    });
  } catch (error: any) {
    console.error('List workflows error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list workflows'
    });
  }
});

// Get workflow
app.post('/tools/n8n_get_workflow', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Workflow ID is required'
      });
      return;
    }
    const workflow = await n8nClient.getWorkflow(id);
    res.json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get workflow'
    });
  }
});

// Execute workflow
app.post('/tools/n8n_execute_workflow', async (req, res) => {
  try {
    const { id, data } = req.body;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Workflow ID is required'
      });
      return;
    }
    const result = await n8nClient.executeWorkflow(id, data);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Execute workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute workflow'
    });
  }
});

// Create workflow
app.post('/tools/n8n_create_workflow', async (req, res) => {
  try {
    const { name, nodes, connections, settings, active } = req.body;
    
    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Workflow name is required'
      });
      return;
    }
    
    if (!nodes || !Array.isArray(nodes)) {
      res.status(400).json({
        success: false,
        error: 'Workflow nodes array is required'
      });
      return;
    }
    
    if (!connections || typeof connections !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Workflow connections object is required'
      });
      return;
    }
    
    const workflow = await n8nClient.createWorkflow({
      name,
      nodes,
      connections,
      settings: settings || {},
      active: active || false
    });
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    console.error('Create workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create workflow'
    });
  }
});

// Update workflow
app.post('/tools/n8n_update_workflow', async (req, res) => {
  try {
    const { id, name, nodes, connections, settings, active } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Workflow ID is required'
      });
      return;
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (nodes !== undefined) updates.nodes = nodes;
    if (connections !== undefined) updates.connections = connections;
    if (settings !== undefined) updates.settings = settings;
    if (active !== undefined) updates.active = active;
    
    const workflow = await n8nClient.updateWorkflow(id, updates);
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error: any) {
    console.error('Update workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update workflow'
    });
  }
});

// Delete workflow
app.post('/tools/n8n_delete_workflow', async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Workflow ID is required'
      });
      return;
    }
    
    await n8nClient.deleteWorkflow(id);
    
    res.json({
      success: true,
      message: `Workflow ${id} deleted successfully`
    });
  } catch (error: any) {
    console.error('Delete workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete workflow'
    });
  }
});

// Generate workflow from prompt using AI V2
app.post('/tools/n8n_generate_workflow', async (req, res) => {
  console.log('\n=== n8n_generate_workflow V2 endpoint called ===');
  console.log('Request body:', {
    prompt: req.body.prompt?.substring(0, 100) + '...',
    name: req.body.name,
    provider: req.body.provider,
    useUserSettings: req.body.useUserSettings,
    hasApiKey: !!req.body.apiKey,
    hasToken: !!req.headers.authorization
  });
  
  try {
    const { prompt, name, provider, apiKey, model, temperature, maxTokens, useUserSettings } = req.body;
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!prompt) {
      console.error('Missing required field: prompt');
      res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
      return;
    }
    
    if (!name) {
      console.error('Missing required field: name');
      res.status(400).json({
        success: false,
        error: 'Workflow name is required'
      });
      return;
    }
    
    let generatorOptions: any = {};
    
    // If user wants to use their saved AI provider settings
    if (useUserSettings && authToken) {
      try {
        console.log('Fetching user AI provider settings...');
        
        // Get user's active AI provider
        const activeProviderResponse = await fetch('http://localhost:3005/api/ai-providers/active', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (activeProviderResponse.ok) {
          const activeProvider = await activeProviderResponse.json();
          
          if (activeProvider.success && activeProvider.data) {
            generatorOptions = {
              provider: activeProvider.data.provider,
              apiKey: activeProvider.data.apiKey,
              model: activeProvider.data.model,
              temperature: activeProvider.data.temperature || 0.7,
              maxTokens: activeProvider.data.maxTokens || 8000
            };
            console.log('Using user AI provider settings:', {
              provider: activeProvider.data.provider,
              model: activeProvider.data.model
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch user AI provider settings:', error);
      }
    }
    
    // Use provided options or fall back to environment variables
    if (!generatorOptions.apiKey) {
      generatorOptions.provider = provider || process.env.AI_PROVIDER || 'openai';
      generatorOptions.apiKey = apiKey;
      generatorOptions.model = model;
      generatorOptions.temperature = temperature;
      generatorOptions.maxTokens = maxTokens;
      
      // If no API key provided, try environment variables
      if (!generatorOptions.apiKey) {
        if (generatorOptions.provider === 'anthropic') {
          generatorOptions.apiKey = process.env.ANTHROPIC_API_KEY;
        } else if (generatorOptions.provider === 'openai') {
          generatorOptions.apiKey = process.env.OPENAI_API_KEY;
        } else if (generatorOptions.provider === 'gemini') {
          generatorOptions.apiKey = process.env.GEMINI_API_KEY;
        }
      }
    }
    
    console.log('AI Provider:', generatorOptions.provider);
    console.log('Model:', generatorOptions.model || 'default');
    console.log('API key available:', !!generatorOptions.apiKey);
    console.log('API key source:', apiKey ? 'request' : (useUserSettings ? 'user settings' : 'environment'));
    
    if (!generatorOptions.apiKey) {
      console.error(`No API key available for ${generatorOptions.provider}`);
      res.status(400).json({
        success: false,
        error: `API key is required for ${generatorOptions.provider}. Please provide it in the request, save it in your settings, or set the appropriate environment variable.`
      });
      return;
    }
    
    console.log('Creating AI workflow generator V2...');
    const generator = new AIWorkflowGeneratorV2(generatorOptions);
    
    console.log('Calling generateFromPrompt...');
    const startTime = Date.now();
    const result = await generator.generateFromPrompt(prompt, name);
    const generationTime = Date.now() - startTime;
    console.log(`Generation completed in ${generationTime}ms`);
    console.log('Generation result:', {
      success: result.success,
      provider: result.provider,
      error: result.error
    });
    
    if (!result.success) {
      console.error('Generation failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate workflow',
        provider: result.provider
      });
      return;
    }
    
    // Return the generated workflow WITHOUT creating it
    console.log('Generated workflow successfully');
    
    if (!result.workflow) {
      console.error('No workflow object in result');
      res.status(500).json({
        success: false,
        error: 'Generated result does not contain a workflow'
      });
      return;
    }
    
    const response = {
      success: true,
      data: {
        workflow: result.workflow,
        provider: result.provider,
        usage: result.usage
      }
    };
    
    console.log('Sending successful response');
    res.json(response);
  } catch (error: any) {
    console.error('Generate workflow error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate workflow'
    });
  }
});

// AI Analysis endpoints (mock for now)
app.get('/api/ai-analysis/feedback', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json({
      feedback: [],
      total: 0,
      limit
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai-analysis/performance-metrics', async (_req, res) => {
  try {
    res.json({
      metrics: {
        overall: {
          successRate: 0.95,
          avgExecutionTime: 5000,
          totalExecutions: 0
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Pattern recognition endpoint
app.get('/api/ai-analysis/patterns', async (req, res) => {
  try {
    const { domain, status } = req.query;
    
    // Mock successful patterns
    const patterns = [
      {
        id: '1',
        pattern: 'Webhook trigger for real-time processing',
        domain: domain || 'general',
        confidence: 0.95,
        usage_count: 15,
        success_rate: 0.92
      },
      {
        id: '2',
        pattern: 'API integration for data retrieval',
        domain: domain || 'general',
        confidence: 0.88,
        usage_count: 12,
        success_rate: 0.85
      }
    ];
    
    res.json({
      patterns,
      total: patterns.length,
      status: status || 'all'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deep analysis search endpoint
app.get('/api/ai-analysis/deep-analyses/search', async (req, res) => {
  try {
    const { query, domain, status } = req.query;
    
    // Mock deep analyses based on search query
    const analyses = [
      {
        id: '1',
        workflow_id: 'wf-123',
        analysis_type: 'complexity',
        domain: domain || 'e-commerce',
        status: status || 'completed',
        insights: {
          complexity_score: 0.85,
          optimization_suggestions: [
            'Consider adding error handling nodes',
            'Implement retry logic for API calls'
          ],
          pattern_matches: ['webhook-api-integration', 'parallel-processing']
        },
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        workflow_id: 'wf-456',
        analysis_type: 'performance',
        domain: domain || 'sales',
        status: status || 'completed',
        insights: {
          execution_time_avg: 5200,
          bottlenecks: ['PDF generation', 'Email sending'],
          optimization_potential: 0.72
        },
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    
    // Filter by query if provided
    const filteredAnalyses = query 
      ? analyses.filter(a => 
          a.workflow_id.includes(query as string) || 
          a.analysis_type.includes(query as string) ||
          (typeof a.domain === 'string' && a.domain.includes(query as string))
        )
      : analyses;
    
    res.json({
      analyses: filteredAnalyses,
      total: filteredAnalyses.length,
      query: query || ''
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create deep analysis endpoint
app.post('/api/ai-analysis/deep-analyses', async (req, res) => {
  try {
    const { workflow_id, analysis_type, domain, options } = req.body;
    
    if (!workflow_id) {
      res.status(400).json({ error: 'workflow_id is required' });
      return;
    }
    
    // Mock creating a deep analysis
    const analysis = {
      id: Date.now().toString(),
      workflow_id,
      analysis_type: analysis_type || 'comprehensive',
      domain: domain || 'general',
      status: 'processing',
      insights: null,
      options: options || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Simulate async processing
    setTimeout(() => {
      // In a real implementation, this would update the analysis status
      console.log(`Analysis ${analysis.id} completed`);
    }, 5000);
    
    res.status(201).json({
      success: true,
      analysis
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit feedback endpoint
app.post('/api/ai-analysis/feedback', async (req, res) => {
  try {
    const { workflow_id, feedback_type, rating, comments, metadata } = req.body;
    
    if (!workflow_id || !feedback_type || rating === undefined) {
      res.status(400).json({ 
        error: 'workflow_id, feedback_type, and rating are required' 
      });
      return;
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      res.status(400).json({ 
        error: 'rating must be between 1 and 5' 
      });
      return;
    }
    
    // Mock feedback submission
    const feedback = {
      id: Date.now().toString(),
      workflow_id,
      feedback_type,
      rating,
      comments: comments || '',
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      user_id: 'anonymous' // In real implementation, get from auth
    };
    
    res.status(201).json({
      success: true,
      feedback,
      message: 'Feedback submitted successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`n8n MCP HTTP Server V2 running on http://localhost:${PORT}`);
});