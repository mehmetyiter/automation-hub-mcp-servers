import express from 'express';
import cors from 'cors';
import { N8nClient } from './n8n-client.js';
import { AIWorkflowGeneratorV2 } from './ai-workflow-generator-v2.js';
import { AIWorkflowGeneratorV3 } from './ai-workflow-generator-v3.js';
import { LearningService } from './learning/learning-service.js';
import { WorkflowValidator } from './validation/workflow-validator.js';
import { QuickValidator } from './workflow-generation/quick-validator.js';
import { ProviderFactory } from './providers/provider-factory.js';
import aiProvidersRouter from './routes/ai-providers.js';
import { cleanWorkflow } from './utils/json-cleaner.js';
import { errorTracker } from './monitoring/error-tracker.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Helper methods for enhanced error reporting
function categorizeIssue(message: string): string {
  if (message.includes('disconnected') || message.includes('no incoming connection')) {
    return 'connection';
  }
  if (message.includes('empty branch') || message.includes('no follow-up')) {
    return 'branch_completion';
  }
  if (message.includes('merge') || message.includes('parallel')) {
    return 'parallel_processing';
  }
  if (message.includes('parameter') || message.includes('configuration')) {
    return 'configuration';
  }
  if (message.includes('error handling')) {
    return 'error_handling';
  }
  return 'general';
}

function isAutoFixable(message: string): boolean {
  // Issues that can be automatically fixed
  const autoFixablePatterns = [
    'disconnected node',
    'no incoming connection',
    'missing webhook path',
    'missing code in function node',
    'sequential connection needed'
  ];
  
  return autoFixablePatterns.some(pattern => 
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

const app = express();
const PORT = process.env.N8N_HTTP_PORT || 3006;

const n8nClient = new N8nClient({
  apiKey: process.env.N8N_API_KEY || '',
  baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678'
});

// Initialize learning system
const learningService = LearningService.getInstance();
const feedbackCollector = learningService.getFeedbackCollector();
const validator = learningService.createValidator();

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
    credentialId: req.body.credentialId,
    useUserSettings: req.body.useUserSettings,
    hasApiKey: !!req.body.apiKey,
    hasToken: !!req.headers.authorization
  });
  
  try {
    const { prompt, name, provider, credentialId, credentialName, apiKey, model, temperature, maxTokens, useUserSettings, mode, userEditedPrompt } = req.body;
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
        console.log('Credential ID provided:', credentialId || 'none');
        console.log('Provider specified:', provider || 'none');
        
        // If credentialId is provided, fetch the specific credential
        if (credentialId && credentialId !== 'undefined') {
          console.log('Using credential ID:', credentialId);
          
          const credentialResponse = await fetch(`http://localhost:3005/auth/credentials/${credentialId}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (credentialResponse.ok) {
            const credentialData = await credentialResponse.json();
            console.log('Credential data response:', {
              success: credentialData.success,
              hasData: !!credentialData.data,
              provider: credentialData.data?.type,
              // Never log sensitive data
            });
            
            if (credentialData.success && credentialData.data) {
              const credential = credentialData.data;
              
              // Determine provider type from platform
              let providerType = credential.platform || provider;
              
              // Normalize provider names
              if (providerType === 'google_ai') {
                providerType = 'gemini';
              } else if (providerType === 'anthropic' || providerType?.includes('claude')) {
                providerType = 'anthropic';
              }
              
              generatorOptions = {
                provider: providerType,
                apiKey: credential.data?.apiKey || credential.data?.api_key || credential.credentials?.apiKey || credential.credentials?.api_key,
                model: model || (providerType === 'openai' ? 'gpt-4o' : providerType === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gemini-1.5-pro'),
                temperature: temperature || 0.7,
                maxTokens: maxTokens || 8000
              };
              console.log('Using credential-based provider settings:', {
                provider: providerType,
                credentialName: credential.name,
                hasApiKey: !!generatorOptions.apiKey,
                modelFromRequest: model || null,
                finalModel: generatorOptions.model
              });
            }
          } else {
            console.error('Failed to fetch credential data:', credentialResponse.status);
          }
        } else if (provider) {
          // Fallback to provider-based lookup if no credentialId
          console.log('Using specific provider requested:', provider);
          const providerToFetch = provider;
          console.log('Fetching provider:', providerToFetch);
          
          const providerResponse = await fetch(`http://localhost:3005/api/ai-providers/provider/${providerToFetch}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (providerResponse.ok) {
            const providerData = await providerResponse.json();
            console.log('Provider data response:', providerData);
            
            if (providerData.success && providerData.data) {
              generatorOptions = {
                provider: provider,
                apiKey: providerData.data.apiKey,
                model: providerData.data.model || model,
                temperature: providerData.data.temperature || temperature || 0.7,
                maxTokens: providerData.data.maxTokens || maxTokens || 8000
              };
              console.log('Using requested provider settings:', {
                provider: provider,
                model: generatorOptions.model,
                hasApiKey: !!generatorOptions.apiKey
              });
            }
          } else {
            console.error('Failed to fetch provider data:', providerResponse.status);
          }
        } else {
          // Get user's active AI provider
          const activeProviderResponse = await fetch('http://localhost:3005/api/ai-providers/active', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
        
        if (activeProviderResponse.ok) {
          const activeProvider = await activeProviderResponse.json();
          console.log('Active provider response:', activeProvider);
          
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
              model: activeProvider.data.model,
              hasApiKey: !!activeProvider.data.apiKey
            });
          } else {
            console.log('No active provider data found');
          }
        } else {
          console.error('Failed to fetch active provider:', activeProviderResponse.status);
          const errorText = await activeProviderResponse.text();
          console.error('Error response:', errorText);
          
          // If the auth service is down or returns an error, we should inform the user
          if (activeProviderResponse.status === 500) {
            console.log('Auth service error - will try to use provided settings or environment');
          }
        }
        }
      } catch (error) {
        console.error('Failed to fetch user AI provider settings:', error);
        // Continue with fallback options instead of failing completely
      }
    }
    
    // If user settings were requested but no API key found, return an error
    if (!generatorOptions.apiKey && useUserSettings) {
      console.error('User settings requested but no valid credential found');
      res.status(400).json({
        success: false,
        error: 'No AI provider credential selected. Please select a credential from your saved AI providers.'
      });
      return;
    }
    
    // If not using user settings and no API key provided
    if (!generatorOptions.apiKey && !apiKey) {
      res.status(400).json({
        success: false,
        error: 'API key is required. Please either select a saved credential or provide an API key.'
      });
      return;
    }
    
    // Use provided API key if no user settings
    if (!generatorOptions.apiKey && apiKey) {
      if (!provider) {
        console.error('Provider must be specified when using API key directly');
        res.status(400).json({
          success: false,
          error: 'Provider is required when providing an API key. Please specify which AI provider to use.'
        });
        return;
      }
      generatorOptions.provider = provider;
      generatorOptions.apiKey = apiKey;
      generatorOptions.model = model;
      generatorOptions.temperature = temperature || 0.7;
      generatorOptions.maxTokens = maxTokens || 8000;
    }
    
    // Add generation mode and edited prompt
    generatorOptions.mode = mode || 'quick';
    if (userEditedPrompt) {
      generatorOptions.userEditedPrompt = userEditedPrompt;
    }
    
    console.log('AI Provider:', generatorOptions.provider);
    console.log('Model:', generatorOptions.model || 'default');
    console.log('Generation Mode:', generatorOptions.mode);
    console.log('API key available:', !!generatorOptions.apiKey);
    console.log('API key source:', apiKey ? 'request' : (useUserSettings ? 'user settings' : 'environment'));
    
    if (!generatorOptions.apiKey) {
      console.error(`No API key available for ${generatorOptions.provider}`);
      res.status(400).json({
        success: false,
        error: `API key is required for ${generatorOptions.provider}. Please provide it in the request or add it as a credential.`
      });
      return;
    }
    
    // Use V3 generator with learning capabilities
    const useV3 = process.env.USE_LEARNING_ENGINE !== 'false';
    
    // Track progress messages
    const progressMessages: string[] = [];
    
    // Add progress callback to generator options
    const generatorOptionsWithProgress = {
      ...generatorOptions,
      progressCallback: (message: string) => {
        progressMessages.push(message);
        console.log(`Progress: ${message}`);
      }
    };
    
    // Enhance prompt with learning insights
    let enhancedPrompt = prompt;
    if (useV3) {
      try {
        enhancedPrompt = await learningService.enhancePrompt(prompt);
        if (enhancedPrompt !== prompt) {
          console.log('Prompt enhanced with learning insights');
        }
      } catch (error) {
        console.error('Failed to enhance prompt:', error);
      }
    }
    
    console.log(`Creating AI workflow generator ${useV3 ? 'V3 (with learning)' : 'V2'}...`);
    const generator = useV3 
      ? new AIWorkflowGeneratorV3(generatorOptionsWithProgress)
      : new AIWorkflowGeneratorV2(generatorOptionsWithProgress);
    
    console.log('Calling generateFromPrompt...');
    const startTime = Date.now();
    const result = await generator.generateFromPrompt(enhancedPrompt, name);
    const generationTime = Date.now() - startTime;
    console.log(`Generation completed in ${generationTime}ms`);
    console.log('Generation result:', {
      success: result.success,
      provider: result.provider,
      error: result.error
    });
    
    // Record generation result for learning
    if (useV3) {
      try {
        await learningService.recordGeneration({
          prompt: enhancedPrompt,
          workflowName: name,
          nodeCount: result.workflow?.nodes?.length || 0,
          provider: generatorOptions.provider,
          success: result.success,
          error: result.error
        });
      } catch (error) {
        console.error('Failed to record generation:', error);
      }
    }
    
    if (!result.success) {
      console.error('Generation failed:', result.error);
      
      // Track the error
      await errorTracker.trackError({
        type: 'generation',
        severity: 'error',
        message: result.error || 'Failed to generate workflow',
        details: {
          error: result.error,
          provider: result.provider
        },
        context: {
          prompt,
          workflowName: name,
          provider: generatorOptions.provider,
          phase: 'generation'
        }
      });
      
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
    
    // Final validation before sending to user
    console.log('Running final validation before response...');
    const finalValidator = new WorkflowValidator(feedbackCollector);
    let finalValidation = await finalValidator.validateWorkflow(result.workflow);
    let repairAttempts = 0;
    const MAX_REPAIR_ATTEMPTS = 2;
    
    while (!finalValidation.isValid && finalValidation.issues.length > 0 && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      console.log(`Final validation found ${finalValidation.issues.length} issues. Repair attempt ${repairAttempts + 1}/${MAX_REPAIR_ATTEMPTS}`);
      
      // Try QuickValidator auto-fix first
      const quickValidator = new QuickValidator();
      result.workflow = quickValidator.autoFix(result.workflow);
      
      // Re-validate
      finalValidation = await finalValidator.validateWorkflow(result.workflow);
      
      // If still has issues, request AI assistance
      if (!finalValidation.isValid && finalValidation.issues.length > 0) {
        console.log('Auto-fix insufficient. Requesting AI assistance for remaining issues...');
        
        // Prepare detailed error report for AI
        const issueReport = finalValidation.issues.map(issue => 
          `- ${issue.nodeName}: ${issue.message}${issue.suggestion ? ` (Suggestion: ${issue.suggestion})` : ''}`
        ).join('\n');
        
        // Create a repair prompt
        const repairPrompt = `The workflow "${name}" has validation issues that need fixing:
${issueReport}

Please fix these issues while maintaining the workflow's original purpose: ${prompt}

Requirements:
- All switch nodes must have proper connections for each output
- Each branch must end with a meaningful action (save, send, notify, etc.)
- No disconnected nodes
- No empty branches`;

        try {
          // Use the same AI provider to fix issues
          console.log(`Requesting workflow repair from ${generatorOptionsWithProgress.provider}...`);
          
          // Create the provider instance
          const providerInstance = ProviderFactory.createProvider(generatorOptionsWithProgress);
          
          // Prepare fix request
          const fixRequest = {
            workflow: result.workflow,
            issues: finalValidation.issues.map(issue => ({
              node: issue.nodeName,
              message: issue.message,
              type: 'general',
              suggestion: issue.suggestion
            })),
            originalPrompt: prompt
          };
          
          // Request AI fix
          const fixResult = await providerInstance.fixWorkflow(fixRequest);
          
          if (fixResult.success && fixResult.workflow) {
            console.log(`AI fix successful. Applied ${fixResult.fixesApplied?.length || 0} fixes`);
            result.workflow = fixResult.workflow;
          } else {
            console.log('AI repair failed:', fixResult.error);
          }
        } catch (error) {
          console.error('AI repair failed:', error);
        }
      }
      
      repairAttempts++;
    }
    
    // Enhanced error reporting
    const validationReport = {
      isValid: finalValidation.isValid,
      issues: finalValidation.issues.map(i => ({
        node: i.nodeName,
        nodeType: result.workflow.nodes.find((n: any) => n.name === i.nodeName)?.type || 'unknown',
        issue: i.message,
        severity: i.severity || 'warning',
        suggestion: i.suggestion,
        category: categorizeIssue(i.message),
        autoFixable: isAutoFixable(i.message)
      })),
      repairAttempts: repairAttempts,
      requiresManualFix: false
    };
    
    if (!finalValidation.isValid) {
      console.log(`WARNING: Workflow still has ${finalValidation.issues.length} issues after ${repairAttempts} repair attempts`);
      validationReport.requiresManualFix = validationReport.issues.some(i => !i.autoFixable);
      
      // Track validation issues
      await errorTracker.trackError({
        type: 'validation',
        severity: validationReport.requiresManualFix ? 'error' : 'warning',
        message: `Workflow has ${finalValidation.issues.length} validation issues after ${repairAttempts} repair attempts`,
        details: {
          issues: validationReport.issues,
          repairAttempts,
          requiresManualFix: validationReport.requiresManualFix
        },
        context: {
          prompt,
          workflowName: name,
          provider: generatorOptions.provider,
          nodeCount: result.workflow?.nodes?.length,
          connectionCount: Object.keys(result.workflow?.connections || {}).length,
          phase: 'validation'
        },
        resolution: {
          attempted: repairAttempts > 0,
          successful: false,
          method: 'auto-fix and AI repair'
        }
      });
      
      // Include detailed validation report
      result.validationReport = validationReport;
      
      // Legacy format for backward compatibility
      result.validationIssues = validationReport.issues.map(i => ({
        node: i.node,
        issue: i.issue,
        suggestion: i.suggestion
      }));
    }
    
    // Clean circular references before sending response
    let cleanedWorkflow;
    try {
      cleanedWorkflow = cleanWorkflow(result.workflow);
    } catch (cleanError: any) {
      console.error('Critical error while cleaning workflow:', cleanError);
      
      // Workflow temizleme hatası - bu ciddi bir sorun
      // Detaylı hata raporu oluştur
      const errorReport = {
        error: 'Workflow structure error',
        details: cleanError.message,
        workflowStats: {
          nodes: result.workflow?.nodes?.length || 0,
          connections: Object.keys(result.workflow?.connections || {}).length,
          hasMetadata: !!(result.workflow?.id && result.workflow?.versionId)
        },
        suggestion: 'The workflow structure contains invalid data that cannot be serialized. This is likely due to circular references or invalid node configurations.'
      };
      
      // Track serialization error
      await errorTracker.trackError({
        type: 'serialization',
        severity: 'critical',
        message: cleanError.message,
        details: {
          error: cleanError.message,
          stack: cleanError.stack,
          workflowStats: errorReport.workflowStats
        },
        context: {
          prompt,
          workflowName: name,
          provider: generatorOptions.provider,
          nodeCount: result.workflow?.nodes?.length,
          connectionCount: Object.keys(result.workflow?.connections || {}).length,
          phase: 'serialization'
        },
        stack: cleanError.stack
      });
      
      res.status(500).json({
        success: false,
        error: errorReport.error,
        details: errorReport,
        provider: result.provider
      });
      return;
    }
    
    // Debug: Save the cleaned workflow to check its structure
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(
        '/tmp/cleaned-workflow.json', 
        JSON.stringify(cleanedWorkflow, null, 2)
      );
      console.log('Cleaned workflow saved to /tmp/cleaned-workflow.json');
      console.log(`Workflow stats: ${cleanedWorkflow?.nodes?.length || 0} nodes, ${Object.keys(cleanedWorkflow?.connections || {}).length} connections`);
    } catch (err) {
      console.error('Failed to save debug workflow:', err);
    }
    
    const response = {
      success: true,
      data: {
        workflow: cleanedWorkflow,
        provider: result.provider,
        usage: result.usage,
        // Include user configuration requirements if any
        userConfiguration: cleanedWorkflow?.meta?.userConfigurationRequired || null,
        // Include progress messages for frontend display
        progressMessages: progressMessages,
        // Include enhanced validation report if there are issues
        validationReport: result.validationReport || null,
        // Legacy validation issues for backward compatibility
        validationIssues: result.validationIssues || null,
        // Include prompt information for expert mode
        generationMode: result.mode || 'quick',
        enhancedPrompt: result.enhancedPrompt || null,
        finalPrompt: result.finalPrompt || null,
        promptEdited: result.promptEdited || false,
        // Include learning insights
        learningInsights: result.learningInsights || null
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

// Get enhanced prompt without generating workflow
app.post('/tools/n8n_get_enhanced_prompt', async (req, res) => {
  console.log('\n=== n8n_get_enhanced_prompt endpoint called ===');
  
  try {
    const { prompt, name, mode } = req.body;
    
    if (!prompt || !name) {
      res.status(400).json({
        success: false,
        error: 'Prompt and name are required'
      });
      return;
    }
    
    // Import required modules
    const { EnhancedPromptGenerator } = await import('./ai-analysis/enhanced-prompt-generator.js');
    const { PromptToWorkflowMapper } = await import('./planning/prompt-to-workflow-mapper.js');
    
    // Analyze the prompt
    const mapper = new PromptToWorkflowMapper();
    const analysis = await mapper.analyzePrompt(prompt);
    
    // Convert features Map to object for the generator
    const featuresObject: Record<string, string[]> = {};
    analysis.features.forEach((value: any, key: string) => {
      featuresObject[key] = Array.isArray(value) ? value : [value];
    });
    
    // Generate enhanced prompt using the original system
    const enhancedPrompt = EnhancedPromptGenerator.generateNodePlanningPrompt(
      prompt,
      new Map(Object.entries(featuresObject))
    );
    
    res.json({
      success: true,
      enhancedPrompt: enhancedPrompt,
      mode: mode
    });
    
  } catch (error: any) {
    console.error('Get enhanced prompt error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate enhanced prompt'
    });
  }
});

// AI Analysis endpoints (mock for now)
// Fix workflow issues endpoint
app.post('/tools/n8n_fix_workflow', async (req, res) => {
  console.log('\n=== n8n_fix_workflow endpoint called ===');
  
  try {
    const { workflow, issues, originalPrompt, provider } = req.body;
    
    if (!workflow || !issues || issues.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Workflow and issues are required'
      });
      return;
    }
    
    console.log(`Fixing ${issues.length} issues in workflow with ${workflow.nodes.length} nodes`);
    
    // Get provider configuration - start with user's preference
    let generatorOptions: any = null;
    
    // Try to get user's provider settings if auth is available
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const authToken = authHeader.split(' ')[1];
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
              apiKey: activeProvider.data.apiKey
            };
            console.log(`Using user's preferred provider: ${activeProvider.data.provider}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user provider settings:', error);
      }
    }
    
    // If no user provider found, check if one was specified in request
    if (!generatorOptions && provider) {
      console.log(`No user provider configured, but provider specified in request: ${provider}`);
      res.status(400).json({
        success: false,
        error: 'No AI provider configured. Please add an AI provider credential.'
      });
      return;
    }
    
    // If still no provider, return error
    if (!generatorOptions) {
      console.log('No AI provider configured');
      res.status(400).json({
        success: false,
        error: 'No AI provider configured. Please add an AI provider credential.'
      });
      return;
    }
    
    // Create provider and use fixWorkflow method
    const providerInstance = ProviderFactory.createProvider(generatorOptions);
    
    const fixRequest = {
      workflow: workflow,
      issues: issues,
      originalPrompt: originalPrompt
    };
    
    const fixResult = await providerInstance.fixWorkflow(fixRequest);
    
    if (!fixResult.success) {
      res.status(500).json({
        success: false,
        error: fixResult.error || 'Failed to fix workflow'
      });
      return;
    }
    
    // Validate the fixed workflow
    const validator = new QuickValidator();
    const validation = validator.validate(fixResult.workflow);
    
    res.json({
      success: true,
      data: {
        workflow: fixResult.workflow,
        fixesApplied: fixResult.fixesApplied || [],
        remainingIssues: validation.errors || []
      }
    });
    
  } catch (error: any) {
    console.error('Fix workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fix workflow'
    });
  }
});

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
    
    // Submit feedback to learning engine
    await feedbackCollector.collectFeedback({
      workflowId: workflow_id,
      workflowType: feedback_type,
      outcome: rating >= 4 ? 'success' : rating <= 2 ? 'failure' : 'partial',
      userRating: rating,
      improvements: comments ? [comments] : [],
      prompt: metadata?.prompt || '',
      nodeCount: metadata?.nodeCount || 0
    });
    
    // Get feedback summary
    const summary = await feedbackCollector.getWorkflowFeedbackSummary(workflow_id);
    
    res.status(201).json({
      success: true,
      feedback: {
        id: Date.now().toString(),
        workflow_id,
        feedback_type,
        rating,
        comments: comments || '',
        metadata: metadata || {},
        created_at: new Date().toISOString()
      },
      summary,
      message: 'Feedback submitted successfully and learning system updated'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for workflow execution feedback
app.post('/api/learning/execution-result', async (req, res) => {
  try {
    const { workflow_id, success, execution_time, error, node_executions } = req.body;
    
    if (!workflow_id || success === undefined || !execution_time) {
      res.status(400).json({ 
        error: 'workflow_id, success, and execution_time are required' 
      });
      return;
    }
    
    await feedbackCollector.collectWorkflowExecutionResult(workflow_id, {
      success,
      executionTime: execution_time,
      error,
      nodeExecutions: node_executions
    });
    
    res.json({
      success: true,
      message: 'Execution result recorded successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get learning insights for a prompt
app.post('/api/learning/insights', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    
    const learningEngine = learningService.getLearningEngine();
    const context = await learningEngine.getLearningContext(prompt);
    
    res.json({
      success: true,
      insights: {
        similar_workflows: context.similarWorkflows.length,
        common_patterns: context.commonPatterns,
        errors_to_avoid: context.avoidErrors,
        best_practices: context.bestPractices
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate workflow endpoint
app.post('/api/validation/validate-workflow', async (req, res) => {
  try {
    const { workflow, workflowId } = req.body;
    
    if (!workflow) {
      res.status(400).json({ error: 'workflow is required' });
      return;
    }
    
    const validationResult = await validator.validateWorkflow(workflow, workflowId);
    
    res.json({
      success: true,
      validation: validationResult,
      summary: {
        isValid: validationResult.isValid,
        errorCount: validationResult.issues.length,
        warningCount: validationResult.warnings.length,
        nodeCount: validationResult.nodeStats.total,
        invalidNodes: validationResult.issues
          .filter(i => i.issueType === 'invalid_node_type')
          .map(i => ({ name: i.nodeName, suggestion: i.suggestion }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate and fix workflow endpoint
app.post('/api/validation/fix-workflow', async (req, res) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      res.status(400).json({ error: 'workflow is required' });
      return;
    }
    
    // First validate
    const validationResult = await validator.validateWorkflow(workflow);
    
    // Auto-fix issues
    let fixedWorkflow = { ...workflow };
    
    for (const issue of validationResult.issues) {
      if (issue.issueType === 'invalid_node_type' && issue.suggestion) {
        const node = fixedWorkflow.nodes.find((n: any) => 
          n.id === issue.nodeId || n.name === issue.nodeName
        );
        
        if (node && issue.suggestion.startsWith('Use ')) {
          const newType = issue.suggestion.replace('Use ', '').replace(' instead', '');
          node.type = newType;
          node.typeVersion = node.typeVersion || 1;
        }
      }
    }
    
    // Re-validate
    const reValidation = await validator.validateWorkflow(fixedWorkflow);
    
    res.json({
      success: true,
      original: validationResult,
      fixed: reValidation,
      workflow: fixedWorkflow,
      fixedCount: validationResult.issues.length - reValidation.issues.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Error tracking endpoints
app.get('/api/monitoring/errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const errors = await errorTracker.getRecentErrors(limit);
    
    res.json({
      success: true,
      errors,
      total: errors.length
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/monitoring/errors/metrics', async (req, res) => {
  try {
    let timeRange;
    if (req.query.start && req.query.end) {
      timeRange = {
        start: new Date(req.query.start as string),
        end: new Date(req.query.end as string)
      };
    }
    
    const metrics = await errorTracker.getMetrics(timeRange);
    
    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/monitoring/errors/insights', async (_req, res) => {
  try {
    const insights = await errorTracker.getInsights();
    
    res.json({
      success: true,
      insights
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/monitoring/errors/search', async (req, res) => {
  try {
    const results = await errorTracker.searchErrors(req.body);
    
    res.json({
      success: true,
      errors: results,
      total: results.length
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/monitoring/errors/export', async (req, res) => {
  try {
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const data = await errorTracker.exportErrors(format);
    
    const contentType = format === 'json' 
      ? 'application/json' 
      : 'text/csv';
    
    const filename = `workflow_errors_${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`n8n MCP HTTP Server V2 running on http://localhost:${PORT}`);
  console.log('Error tracking enabled - monitor at /api/monitoring/errors');
});