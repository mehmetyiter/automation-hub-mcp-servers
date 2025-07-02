import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const TOOLS: Tool[] = [
  {
    name: 'n8n_create_workflow',
    description: 'Create a new n8n workflow',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Workflow description' },
        nodes: { type: 'array', description: 'Workflow nodes' },
        connections: { type: 'object', description: 'Node connections' },
        settings: { type: 'object', description: 'Workflow settings' },
        active: { type: 'boolean', description: 'Activate workflow', default: false },
      },
      required: ['name', 'nodes', 'connections'],
    },
  },
  {
    name: 'n8n_list_workflows',
    description: 'List all n8n workflows',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean', description: 'Filter by active status' },
        limit: { type: 'number', description: 'Maximum number of workflows', default: 100 },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
  },
  {
    name: 'n8n_get_workflow',
    description: 'Get a specific n8n workflow by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'n8n_execute_workflow',
    description: 'Execute an n8n workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
        data: { type: 'object', description: 'Input data for workflow' },
      },
      required: ['id'],
    },
  },
  {
    name: 'n8n_update_workflow',
    description: 'Update an existing n8n workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
        name: { type: 'string', description: 'New workflow name' },
        nodes: { type: 'array', description: 'Updated nodes' },
        connections: { type: 'object', description: 'Updated connections' },
        settings: { type: 'object', description: 'Updated settings' },
        active: { type: 'boolean', description: 'Activation status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'n8n_delete_workflow',
    description: 'Delete an n8n workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'n8n_get_executions',
    description: 'Get workflow execution history',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID' },
        limit: { type: 'number', description: 'Maximum number of executions', default: 50 },
      },
    },
  },
  {
    name: 'n8n_get_credentials',
    description: 'List available credentials',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'n8n_test_connection',
    description: 'Test n8n connection',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];