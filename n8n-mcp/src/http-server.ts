import express from 'express';
import { N8nClient } from './n8n-client.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { TOOLS } from './tools.js';
import { findMatchingPatterns } from './pattern-matcher.js';
import { AIWorkflowGenerator } from './ai-workflow-generator.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize n8n client
const n8nClient = new N8nClient({
  baseUrl: config.n8n.baseUrl,
  apiKey: config.n8n.apiKey,
});

// Initialize AI workflow generator
const aiGenerator = new AIWorkflowGenerator({
  useAI: true,
  apiKey: process.env.OPENAI_API_KEY,
  provider: 'openai'
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  const isConnected = await n8nClient.testConnection();
  res.json({ 
    status: isConnected ? 'healthy' : 'unhealthy',
    service: 'n8n-mcp',
    connected: isConnected
  });
});

// List available tools
app.get('/tools', (_req, res) => {
  res.json({ tools: TOOLS });
});

// Call a tool
app.post('/tools/:toolName', async (req, res): Promise<void> => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    let result: any;

    switch (toolName) {
      case 'n8n_create_workflow':
        // If description is provided, try to generate workflow from AI or patterns
        if (args.description && !args.nodes) {
          try {
            // First try AI generation
            logger.info(`Attempting AI workflow generation for: ${args.description}`);
            const aiResult = await aiGenerator.generateFromPrompt(args.description, args.name);
            
            if (aiResult.success && aiResult.workflow) {
              logger.info(`AI generated workflow successfully using ${aiResult.method} method with confidence ${aiResult.confidence}`);
              result = await n8nClient.createWorkflow({
                ...aiResult.workflow,
                active: args.active || false,
              });
            } else {
              // Fallback to pattern matching
              const matchingPatterns = findMatchingPatterns(args.description, 'n8n');
              if (matchingPatterns.length > 0) {
                const bestPattern = matchingPatterns[0];
                logger.info(`Found pattern match: ${bestPattern.name} for: ${args.description}`);
                
                if (bestPattern.platforms.n8n) {
                  result = await n8nClient.createWorkflow({
                    name: args.name,
                    nodes: bestPattern.platforms.n8n.nodes,
                    connections: bestPattern.platforms.n8n.connections,
                    settings: args.settings || {},
                    active: args.active || false,
                  });
                } else {
                  logger.warn(`Pattern ${bestPattern.name} does not have n8n implementation`);
                  throw new Error('Pattern does not support n8n platform');
                }
              } else {
                logger.info(`No pattern match found, creating basic workflow`);
                result = await n8nClient.createWorkflow({
                  name: args.name,
                  nodes: args.nodes || [
                    {
                      id: 'manual_trigger',
                      name: 'Manual Trigger',
                      type: 'n8n-nodes-base.manualTrigger',
                      typeVersion: 1,
                      position: [250, 300],
                      parameters: {}
                    }
                  ],
                  connections: args.connections || {},
                  settings: args.settings || {},
                  active: args.active || false,
                });
              }
            }
          } catch (error) {
            logger.error('Workflow generation error:', error);
            throw error;
          }
        } else {
          result = await n8nClient.createWorkflow({
            name: args.name,
            nodes: args.nodes,
            connections: args.connections,
            settings: args.settings || {},
            active: args.active || false,
          });
        }
        break;

      case 'n8n_list_workflows':
        result = await n8nClient.listWorkflows(args);
        break;

      case 'n8n_get_workflow':
        result = await n8nClient.getWorkflow(args.id);
        break;

      case 'n8n_execute_workflow':
        result = await n8nClient.executeWorkflow(args.id, args.data);
        break;

      case 'n8n_update_workflow':
        result = await n8nClient.updateWorkflow(args.id, {
          name: args.name,
          nodes: args.nodes,
          connections: args.connections,
          settings: args.settings,
          active: args.active,
        });
        break;

      case 'n8n_delete_workflow':
        await n8nClient.deleteWorkflow(args.id);
        result = { success: true, message: `Workflow ${args.id} deleted` };
        break;

      case 'n8n_get_executions':
        result = await n8nClient.getExecutions(args.workflowId, args.limit);
        break;

      case 'n8n_get_credentials':
        result = await n8nClient.getCredentials();
        break;

      case 'n8n_test_connection':
        const isConnected = await n8nClient.testConnection();
        result = { connected: isConnected };
        break;

      default:
        res.status(404).json({ error: `Unknown tool: ${toolName}` });
        return;
    }

    res.json({ success: true, result });
  } catch (error) {
    logger.error('Tool execution error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start server
const PORT = process.env.HTTP_PORT || 3100;
app.listen(PORT, () => {
  logger.info(`n8n MCP HTTP Server running on http://localhost:${PORT}`);
});