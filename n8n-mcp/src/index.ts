#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { N8nClient } from './n8n-client.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { TOOLS } from './tools.js';

// Tool schemas
const CreateWorkflowSchema = z.object({
  name: z.string().describe('Workflow name'),
  description: z.string().optional().describe('Workflow description'),
  nodes: z.array(z.any()).describe('Workflow nodes'),
  connections: z.record(z.any()).describe('Node connections'),
  settings: z.record(z.any()).optional().describe('Workflow settings'),
  active: z.boolean().optional().default(false).describe('Activate workflow'),
});

const ListWorkflowsSchema = z.object({
  active: z.boolean().optional().describe('Filter by active status'),
  limit: z.number().optional().default(100).describe('Maximum number of workflows'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

const GetWorkflowSchema = z.object({
  id: z.string().describe('Workflow ID'),
});

const ExecuteWorkflowSchema = z.object({
  id: z.string().describe('Workflow ID'),
  data: z.record(z.any()).optional().describe('Input data for workflow'),
});

const UpdateWorkflowSchema = z.object({
  id: z.string().describe('Workflow ID'),
  name: z.string().optional().describe('New workflow name'),
  nodes: z.array(z.any()).optional().describe('Updated nodes'),
  connections: z.record(z.any()).optional().describe('Updated connections'),
  settings: z.record(z.any()).optional().describe('Updated settings'),
  active: z.boolean().optional().describe('Activation status'),
});

const DeleteWorkflowSchema = z.object({
  id: z.string().describe('Workflow ID'),
});

// Tool definitions moved to tools.ts

async function main() {
  logger.info('Starting n8n MCP Server...');

  const n8nClient = new N8nClient({
    baseUrl: config.n8n.baseUrl,
    apiKey: config.n8n.apiKey,
  });

  // Test connection
  const isConnected = await n8nClient.testConnection();
  if (!isConnected) {
    logger.error('Failed to connect to n8n. Please check your configuration.');
    process.exit(1);
  }
  logger.info('Successfully connected to n8n');

  const server = new Server(
    {
      name: 'n8n-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'n8n_create_workflow': {
          const validated = CreateWorkflowSchema.parse(args);
          const workflow = await n8nClient.createWorkflow({
            name: validated.name,
            nodes: validated.nodes,
            connections: validated.connections,
            settings: validated.settings || {},
            active: validated.active,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Workflow created successfully:\n${JSON.stringify(workflow, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_list_workflows': {
          const validated = ListWorkflowsSchema.parse(args);
          const workflows = await n8nClient.listWorkflows(validated);
          return {
            content: [
              {
                type: 'text',
                text: `Found ${workflows.length} workflows:\n${JSON.stringify(workflows, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_get_workflow': {
          const validated = GetWorkflowSchema.parse(args);
          const workflow = await n8nClient.getWorkflow(validated.id);
          return {
            content: [
              {
                type: 'text',
                text: `Workflow details:\n${JSON.stringify(workflow, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_execute_workflow': {
          const validated = ExecuteWorkflowSchema.parse(args);
          const result = await n8nClient.executeWorkflow(validated.id, validated.data);
          return {
            content: [
              {
                type: 'text',
                text: `Workflow execution result:\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_update_workflow': {
          const validated = UpdateWorkflowSchema.parse(args);
          const workflow = await n8nClient.updateWorkflow(validated.id, {
            name: validated.name,
            nodes: validated.nodes,
            connections: validated.connections,
            settings: validated.settings,
            active: validated.active,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Workflow updated successfully:\n${JSON.stringify(workflow, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_delete_workflow': {
          const validated = DeleteWorkflowSchema.parse(args);
          await n8nClient.deleteWorkflow(validated.id);
          return {
            content: [
              {
                type: 'text',
                text: `Workflow ${validated.id} deleted successfully`,
              },
            ],
          };
        }

        case 'n8n_get_executions': {
          const { workflowId, limit = 50 } = args as any;
          const executions = await n8nClient.getExecutions(workflowId, limit);
          return {
            content: [
              {
                type: 'text',
                text: `Found ${executions.length} executions:\n${JSON.stringify(executions, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_get_credentials': {
          const credentials = await n8nClient.getCredentials();
          return {
            content: [
              {
                type: 'text',
                text: `Available credentials:\n${JSON.stringify(credentials, null, 2)}`,
              },
            ],
          };
        }

        case 'n8n_test_connection': {
          const isConnected = await n8nClient.testConnection();
          return {
            content: [
              {
                type: 'text',
                text: isConnected ? 'n8n connection successful' : 'n8n connection failed',
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error('Tool execution error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('n8n MCP Server started successfully');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});