import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3005'

// MCP Server endpoints
const MCP_SERVERS = {
  n8n: '/api/n8n',
  database: '/api/database',
  auth: '/api/auth',
  make: '/api/make',
  zapier: '/api/zapier',
  vapi: '/api/vapi'
}

// Main API client
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth API client (direct to auth server)
const authClient = axios.create({
  baseURL: AUTH_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// MCP-specific clients
const mcpClients = {
  n8n: axios.create({ baseURL: MCP_SERVERS.n8n }),
  database: axios.create({ baseURL: MCP_SERVERS.database }),
  auth: axios.create({ baseURL: MCP_SERVERS.auth }),
  make: axios.create({ baseURL: MCP_SERVERS.make }),
  zapier: axios.create({ baseURL: MCP_SERVERS.zapier }),
  vapi: axios.create({ baseURL: MCP_SERVERS.vapi })
}

// Request interceptor for auth and workspace
const setupInterceptors = (client: any) => {
  client.interceptors.request.use(
    (config: any) => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      
      // Add workspace ID to requests that need it
      const workspaceId = localStorage.getItem('current_workspace_id')
      if (workspaceId) {
        // Add workspaceId to header for all requests
        config.headers['X-Workspace-ID'] = workspaceId
        
        // Also add to request body for POST, PUT, PATCH
        if (['post', 'put', 'patch'].includes(config.method || '')) {
          config.data = config.data || {}
          if (!config.data.workspaceId) {
            config.data.workspaceId = workspaceId
          }
        }
      }
      
      return config
    },
    (error: any) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (error.response?.status === 401) {
        // Handle unauthorized
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        
        // Only redirect if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )
}

// Setup interceptors for all clients
setupInterceptors(api)
setupInterceptors(authClient)
Object.values(mcpClients).forEach(client => setupInterceptors(client))

// Export the api instance
export { api }

// Platform-specific automation functions that work with MCP
const createMCPAutomation = async (platform: string, data: any) => {
  switch (platform) {
    case 'n8n':
      // n8n requires nodes and connections
      const workflowData = {
        name: data.name,
        description: data.description, // Pass description for pattern matching
        nodes: data.nodes,
        connections: data.connections || {},
        settings: data.settings || {},
        active: data.active || false
      }
      return mcpClients.n8n.post('/tools/n8n_create_workflow', workflowData)
    case 'make':
      return mcpClients.make.post('/tools/make_create_scenario', data)
    case 'zapier':
      return mcpClients.zapier.post('/tools/zapier_create_zap', data)
    case 'vapi':
      return mcpClients.vapi.post('/tools/vapi_create_assistant', data)
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

const listMCPAutomations = async (platform: string) => {
  switch (platform) {
    case 'n8n':
      return mcpClients.n8n.post('/tools/n8n_list_workflows', {})
    case 'make':
      return mcpClients.make.post('/tools/make_list_scenarios', {})
    case 'zapier':
      return mcpClients.zapier.post('/tools/zapier_list_zaps', {})
    case 'vapi':
      return mcpClients.vapi.post('/tools/vapi_list_assistants', {})
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

// Unified API functions that work across all platforms
export const createAutomation = async (data: {
  description: string
  name: string
  platform?: string
}) => {
  // If platform is specified, use MCP-specific endpoint
  if (data.platform) {
    const response = await createMCPAutomation(data.platform, data)
    // Normalize response structure
    if (response.data.success && response.data.result) {
      return {
        success: true,
        data: response.data.result
      }
    }
    return response.data
  }
  
  // Otherwise, use database to store automation metadata
  const response = await mcpClients.database.post('/automations', data)
  return response.data
}

export const listAutomations = async (platform?: string) => {
  if (platform) {
    // Get automations from specific platform
    const response = await listMCPAutomations(platform)
    return response.data?.result || []
  }
  
  // Get all automations from all platforms
  const platforms = ['n8n', 'make', 'zapier', 'vapi']
  const results = await Promise.allSettled(
    platforms.map(p => listMCPAutomations(p))
  )
  
  const automations: any[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.data?.result) {
      const platformAutomations = result.value.data.result.map((auto: any) => ({
        ...auto,
        platform: platforms[index]
      }))
      automations.push(...platformAutomations)
    }
  })
  
  return automations
}

export const getAutomation = async (id: string) => {
  // Try to get from database first
  try {
    const response = await mcpClients.database.get(`/automations/${id}`)
    return response.data
  } catch (error) {
    // If not in database, might be platform-specific ID
    // Would need platform info to route correctly
    throw error
  }
}

export const updateAutomation = async (id: string, data: any) => {
  const response = await mcpClients.database.put(`/automations/${id}`, data)
  return response.data
}

export const deleteAutomation = async (id: string) => {
  const response = await mcpClients.database.delete(`/automations/${id}`)
  return response.data
}

export const executeAutomation = async (id: string, data?: any) => {
  // Would need to know the platform to execute correctly
  // For now, assume it's stored in database with platform info
  const automation = await getAutomation(id)
  
  switch (automation.platform) {
    case 'n8n':
      return mcpClients.n8n.post('/tools/n8n_execute_workflow', { id, data })
    case 'make':
      return mcpClients.make.post('/tools/make_run_scenario', { id, data })
    case 'zapier':
      return mcpClients.zapier.post('/tools/zapier_trigger_zap', { id, data })
    case 'vapi':
      return mcpClients.vapi.post('/tools/vapi_call_assistant', { id, data })
    default:
      throw new Error(`Unsupported platform: ${automation.platform}`)
  }
}

export const getAutomationLogs = async (id: string) => {
  const response = await mcpClients.database.get(`/automations/${id}/logs`)
  return response.data
}

export const getPlatformStatus = async () => {
  const platforms = ['n8n', 'make', 'zapier', 'vapi']
  const statuses = await Promise.allSettled(
    platforms.map(p => mcpClients[p as keyof typeof mcpClients].get('/health'))
  )
  
  return platforms.map((platform, index) => ({
    platform,
    status: statuses[index].status === 'fulfilled' ? 'connected' : 'disconnected',
    details: statuses[index].status === 'fulfilled' 
      ? (statuses[index] as any).value.data
      : (statuses[index] as any).reason
  }))
}

export const testPlatformConnection = async (platform: string) => {
  const client = mcpClients[platform as keyof typeof mcpClients]
  if (!client) {
    throw new Error(`Unknown platform: ${platform}`)
  }
  
  const response = await client.get('/health')
  return response.data
}

export const getAnalytics = async (platform?: string, timeRange?: string) => {
  const params = { platform, timeRange }
  const response = await mcpClients.database.get('/analytics', { params })
  return response.data
}

// Credential API endpoints - using database MCP
export const credentialAPI = {
  list: async () => {
    const response = await mcpClients.database.get('/credentials')
    return response.data
  },

  get: async (id: string) => {
    const response = await mcpClients.database.get(`/credentials/${id}`)
    return response.data
  },

  create: async (data: {
    name: string
    templateId: string
    values: Record<string, any>
  }) => {
    const response = await mcpClients.database.post('/credentials', data)
    return response.data
  },

  update: async (id: string, data: {
    values: Record<string, any>
  }) => {
    const response = await mcpClients.database.put(`/credentials/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await mcpClients.database.delete(`/credentials/${id}`)
    return response.data
  },

  verify: async (id: string) => {
    const response = await mcpClients.database.post(`/credentials/${id}/test`)
    return response.data
  },

  validate: async (data: {
    templateId: string
    data: Record<string, any>
  }) => {
    const response = await mcpClients.database.post('/credentials/validate', data)
    return response.data
  },

  test: async (id: string) => {
    const response = await mcpClients.database.post(`/credentials/${id}/test`)
    return response.data
  },

  getTemplates: async () => {
    const response = await mcpClients.database.get('/credentials/templates')
    return response.data
  }
}

// Workspace API - using database MCP
export const workspaceAPI = {
  list: async () => {
    const response = await mcpClients.database.get('/workspaces')
    return response.data
  }
}

// Auth API endpoints - using auth server directly
export const authAPI = {
  login: async (email: string, password: string, workspaceId?: string) => {
    const response = await authClient.post('/auth/login', { email, password })
    
    // Store auth data if successful
    if (response.data?.success && response.data?.data?.accessToken) {
      localStorage.setItem('auth_token', response.data.data.accessToken)
      localStorage.setItem('user', JSON.stringify(response.data.data.user))
      if (workspaceId) {
        localStorage.setItem('current_workspace_id', workspaceId)
      }
    }
    
    return response.data
  },
  
  logout: async () => {
    try {
      const response = await authClient.post('/auth/logout')
      // Clear local storage after successful logout
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      localStorage.removeItem('current_workspace_id')
      return response.data
    } catch (error) {
      // Clear local storage even if logout fails
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      localStorage.removeItem('current_workspace_id')
      return { success: true }
    }
  },
  
  getMe: async () => {
    const response = await authClient.get('/auth/me')
    return response.data
  },
  
  register: async (data: { email: string; password: string; name: string; role?: string }) => {
    const response = await authClient.post('/auth/register', data)
    
    // Store auth data if successful
    if (response.data?.success && response.data?.data?.accessToken) {
      localStorage.setItem('auth_token', response.data.data.accessToken)
      localStorage.setItem('user', JSON.stringify(response.data.data.user))
    }
    
    return response.data
  },
  
  verify: async () => {
    const response = await authClient.get('/auth/verify')
    return response.data
  }
}

// n8n-specific API exports for components that need them
export const n8nAPI = {
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
    mcpClients.n8n.post('/tools/n8n_test_connection', {})
}