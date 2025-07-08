import axios from 'axios'

// MCP Server API endpoints
const MCP_SERVERS = {
  n8n: '/api/n8n',
  database: '/api/database',
  auth: '/api/auth',
  make: '/api/make',
  zapier: '/api/zapier',
  vapi: '/api/vapi'
}

// Create axios instances for each MCP server
export const mcpClients = {
  n8n: axios.create({ baseURL: MCP_SERVERS.n8n }),
  database: axios.create({ baseURL: MCP_SERVERS.database }),
  auth: axios.create({ baseURL: MCP_SERVERS.auth }),
  make: axios.create({ baseURL: MCP_SERVERS.make }),
  zapier: axios.create({ baseURL: MCP_SERVERS.zapier }),
  vapi: axios.create({ baseURL: MCP_SERVERS.vapi })
}

// n8n MCP API
export const n8nAPI = {
  health: () => mcpClients.n8n.get('/health'),
  
  listWorkflows: (params?: { limit?: number, active?: boolean }) =>
    mcpClients.n8n.post('/tools/n8n_list_workflows', params || {}),
  
  getWorkflow: (id: string) =>
    mcpClients.n8n.post('/tools/n8n_get_workflow', { id }),
  
  createWorkflow: (data: any) =>
    mcpClients.n8n.post('/tools/n8n_create_workflow', data),
  
  updateWorkflow: (id: string, data: any) =>
    mcpClients.n8n.post('/tools/n8n_update_workflow', { id, ...data }),
  
  deleteWorkflow: (id: string) =>
    mcpClients.n8n.post('/tools/n8n_delete_workflow', { id }),
  
  executeWorkflow: (id: string, data?: any) =>
    mcpClients.n8n.post('/tools/n8n_execute_workflow', { id, data }),
  
  getExecutions: (workflowId: string, limit?: number) =>
    mcpClients.n8n.post('/tools/n8n_get_executions', { workflowId, limit }),
  
  getCredentials: () =>
    mcpClients.n8n.post('/tools/n8n_get_credentials', {}),
  
  testConnection: () =>
    mcpClients.n8n.post('/tools/n8n_test_connection', {}),
  
  generateWorkflow: (prompt: string, name: string, apiKey?: string) =>
    mcpClients.n8n.post('/tools/n8n_generate_workflow', { prompt, name, apiKey })
}

// Database MCP API (placeholder)
export const databaseAPI = {
  health: () => mcpClients.database.get('/health')
}

// Auth MCP API (placeholder)
export const authAPI = {
  health: () => mcpClients.auth.get('/health')
}

// Make.com MCP API (placeholder)
export const makeAPI = {
  health: () => mcpClients.make.get('/health')
}

// Zapier MCP API (placeholder)
export const zapierAPI = {
  health: () => mcpClients.zapier.get('/health')
}

// Vapi MCP API (placeholder)
export const vapiAPI = {
  health: () => mcpClients.vapi.get('/health')
}