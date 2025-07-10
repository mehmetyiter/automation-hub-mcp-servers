import express from 'express';
import cors from 'cors';
import { N8nClient } from './n8n-client.js';
import { AIWorkflowGeneratorV3 } from './ai-workflow-generator-v3.js';
import { DynamicCodeGenerator } from './code-generation/dynamic-code-generator.js';
import { VisualCodeBuilder } from './code-generation/visual-builder/visual-code-builder.js';
import aiProvidersRouter from './routes/ai-providers.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.N8N_HTTP_PORT || 3006;

const n8nClient = new N8nClient({
  apiKey: process.env.N8N_API_KEY || '',
  baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678'
});

const dynamicCodeGenerator = new DynamicCodeGenerator(process.env.AI_PROVIDER);
const visualCodeBuilder = new VisualCodeBuilder(process.env.AI_PROVIDER);

app.use(cors());
app.use(express.json());

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

// Generate workflow from prompt using AI
app.post('/tools/n8n_generate_workflow', async (req, res) => {
  console.log('\n=== n8n_generate_workflow endpoint called ===');
  console.log('Request body:', {
    prompt: req.body.prompt?.substring(0, 100) + '...',
    name: req.body.name,
    hasApiKey: !!req.body.apiKey
  });
  
  try {
    const { prompt, name, apiKey } = req.body;
    
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
    
    // Determine provider and API key
    const provider = process.env.AI_PROVIDER || 'anthropic';
    let effectiveApiKey = apiKey;
    
    if (!effectiveApiKey) {
      if (provider === 'anthropic') {
        effectiveApiKey = process.env.ANTHROPIC_API_KEY;
      } else {
        effectiveApiKey = process.env.OPENAI_API_KEY;
      }
    }
    
    console.log('AI Provider:', provider);
    console.log('API key source:', apiKey ? 'request' : 'environment');
    console.log('API key available:', !!effectiveApiKey);
    console.log('API key length:', effectiveApiKey?.length || 0);
    
    if (!effectiveApiKey) {
      console.error(`No ${provider} API key available`);
      res.status(400).json({
        success: false,
        error: `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key is required. Please provide it in the request or set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} environment variable.`
      });
      return;
    }
    
    console.log('Creating AI workflow generator V3 with real-time learning...');
    const generator = new AIWorkflowGeneratorV3({
      provider: provider as 'openai' | 'anthropic',
      apiKey: effectiveApiKey
    });
    
    console.log('Calling generateFromPrompt...');
    const startTime = Date.now();
    const result = await generator.generateFromPrompt(prompt, name);
    const generationTime = Date.now() - startTime;
    console.log(`Generation completed in ${generationTime}ms`);
    console.log('Generation result:', {
      success: result.success,
      method: result.method,
      confidence: result.confidence,
      error: result.error
    });
    
    if (!result.success) {
      console.error('Generation failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate workflow'
      });
      return;
    }
    
    // Return the generated workflow WITHOUT creating it
    console.log('Generated workflow successfully');
    console.log('Result workflow object:', JSON.stringify(result.workflow, null, 2));
    
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
        workflow: result.workflow,  // Return the generated workflow structure
        confidence: result.confidence,
        generatedBy: result.method === 'ai-generated' ? 'AI' : result.method
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

// Multi-language code generation endpoint
app.post('/api/n8n/code/generate', async (req, res) => {
  try {
    const { description, language, nodeType, requirements } = req.body;
    
    if (!description) {
      res.status(400).json({ error: 'Description is required' });
      return;
    }
    
    const request = {
      description,
      nodeType: nodeType || 'code',
      requirements: {
        language: language || 'javascript',
        ...requirements
      },
      workflowContext: {}
    };
    
    const result = await dynamicCodeGenerator.generateCode(request);
    
    res.json({
      success: result.success,
      code: result.code,
      language: request.requirements.language,
      metadata: result.metadata,
      validation: result.validation
    });
  } catch (error: any) {
    console.error('Code generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get supported languages
app.get('/api/n8n/code/languages', (req, res) => {
  res.json({
    languages: [
      { id: 'javascript', name: 'JavaScript', extensions: ['.js'] },
      { id: 'typescript', name: 'TypeScript', extensions: ['.ts'] },
      { id: 'python', name: 'Python', extensions: ['.py'] },
      { id: 'sql', name: 'SQL', extensions: ['.sql'], dialects: ['mysql', 'postgresql', 'sqlite', 'mssql', 'oracle'] },
      { id: 'r', name: 'R', extensions: ['.r', '.R'] }
    ]
  });
});

// Code versioning endpoints
app.get('/api/n8n/code/versions/:codeId', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const versions = await dynamicCodeGenerator.getCodeVersions(codeId);
    res.json({ versions });
  } catch (error: any) {
    console.error('Failed to get code versions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/code/versions/:codeId/active', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const version = await dynamicCodeGenerator.getActiveCodeVersion(codeId);
    res.json({ version });
  } catch (error: any) {
    console.error('Failed to get active version:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/code/versions/:codeId/compare', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const { versionAId, versionBId } = req.body;
    const comparison = await dynamicCodeGenerator.compareCodeVersions(codeId, versionAId, versionBId);
    res.json({ comparison });
  } catch (error: any) {
    console.error('Failed to compare versions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/code/versions/:codeId/rollback', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const { targetVersionId, reason } = req.body;
    const result = await dynamicCodeGenerator.rollbackCode(codeId, targetVersionId, reason);
    res.json({ result });
  } catch (error: any) {
    console.error('Failed to rollback code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/code/versions/:codeId/improve', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const { improvements, reason } = req.body;
    const newVersion = await dynamicCodeGenerator.improveCode(codeId, improvements, reason);
    res.json({ version: newVersion });
  } catch (error: any) {
    console.error('Failed to improve code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/code/versions/:codeId/deploy', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const { versionId, environment } = req.body;
    await dynamicCodeGenerator.deployCodeVersion(codeId, versionId, environment);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to deploy version:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/code/versions/:codeId/report', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const report = await dynamicCodeGenerator.generateVersionReport(codeId);
    res.json({ report });
  } catch (error: any) {
    console.error('Failed to generate version report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Visual Code Builder endpoints
app.post('/api/n8n/visual-builder/flows', async (req, res) => {
  try {
    const { name, description, language } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Flow name is required' });
      return;
    }
    
    const flow = await visualCodeBuilder.createVisualFlow(
      name,
      description || '',
      language || 'javascript'
    );
    
    res.json({ flow });
  } catch (error: any) {
    console.error('Failed to create visual flow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/visual-builder/flows/:flowId/blocks', async (req, res) => {
  try {
    const flowId = req.params.flowId;
    const { blockType, templateName, position } = req.body;
    
    const block = await visualCodeBuilder.addBlock(
      flowId,
      blockType,
      templateName,
      position || { x: 0, y: 0 }
    );
    
    res.json({ block });
  } catch (error: any) {
    console.error('Failed to add block:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/visual-builder/flows/:flowId/connections', async (req, res) => {
  try {
    const flowId = req.params.flowId;
    const { fromBlockId, fromOutput, toBlockId, toInput } = req.body;
    
    const connection = await visualCodeBuilder.connectBlocks(
      flowId,
      fromBlockId,
      fromOutput || 'output',
      toBlockId,
      toInput || 'input'
    );
    
    res.json({ connection });
  } catch (error: any) {
    console.error('Failed to connect blocks:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/n8n/visual-builder/flows/:flowId/blocks/:blockId/parameters', async (req, res) => {
  try {
    const { flowId, blockId } = req.params;
    const { parameterName, value } = req.body;
    
    await visualCodeBuilder.updateBlockParameter(
      flowId,
      blockId,
      parameterName,
      value
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update block parameter:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/visual-builder/flows/:flowId/generate', async (req, res) => {
  try {
    const flowId = req.params.flowId;
    const result = await visualCodeBuilder.generateCodeFromVisualFlow(flowId);
    
    res.json({
      success: result.success,
      code: result.code,
      metadata: result.metadata,
      validation: result.validation
    });
  } catch (error: any) {
    console.error('Failed to generate code from visual flow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/visual-builder/flows/:flowId/preview', async (req, res) => {
  try {
    const flowId = req.params.flowId;
    const preview = await visualCodeBuilder.previewCode(flowId);
    
    res.json({ preview });
  } catch (error: any) {
    console.error('Failed to preview code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/visual-builder/flows/:flowId/export', async (req, res) => {
  try {
    const flowId = req.params.flowId;
    const exportData = await visualCodeBuilder.exportFlow(flowId);
    
    res.json({ data: exportData });
  } catch (error: any) {
    console.error('Failed to export flow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/visual-builder/flows/import', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      res.status(400).json({ error: 'Flow data is required' });
      return;
    }
    
    const flow = await visualCodeBuilder.importFlow(data);
    res.json({ flow });
  } catch (error: any) {
    console.error('Failed to import flow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/visual-builder/templates/:language', async (req, res) => {
  try {
    const language = req.params.language;
    const templates = visualCodeBuilder.getAvailableBlockTemplates(language);
    
    res.json({ templates });
  } catch (error: any) {
    console.error('Failed to get block templates:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/visual-builder/flows/:flowId/suggest/:blockId', async (req, res) => {
  try {
    const { flowId, blockId } = req.params;
    const suggestions = await visualCodeBuilder.suggestNextBlock(flowId, blockId);
    
    res.json({ suggestions });
  } catch (error: any) {
    console.error('Failed to get block suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Performance profiling endpoints
app.post('/api/n8n/code/profile/:codeId', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const options = req.body.options || {};
    
    const profile = await dynamicCodeGenerator.profileCode(codeId, options);
    res.json({ profile });
  } catch (error: any) {
    console.error('Failed to profile code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/code/optimize/:codeId', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const { profileId } = req.body;
    
    const result = await dynamicCodeGenerator.optimizeCodeWithProfile(codeId, profileId);
    res.json({ result });
  } catch (error: any) {
    console.error('Failed to optimize code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/code/performance-report/:codeId', async (req, res) => {
  try {
    const codeId = req.params.codeId;
    const report = await dynamicCodeGenerator.generatePerformanceReport(codeId);
    res.json({ report });
  } catch (error: any) {
    console.error('Failed to generate performance report:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/n8n/code/compare-performance', async (req, res) => {
  try {
    const { codeId1, codeId2 } = req.body;
    
    if (!codeId1 || !codeId2) {
      res.status(400).json({ error: 'Both codeId1 and codeId2 are required' });
      return;
    }
    
    const comparison = await dynamicCodeGenerator.compareCodePerformance(codeId1, codeId2);
    res.json({ comparison });
  } catch (error: any) {
    console.error('Failed to compare code performance:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`n8n MCP HTTP Server running on http://localhost:${PORT}`);
});