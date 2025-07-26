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
        const token = localStorage.getItem('auth_token')
        
        // Only redirect if we actually had a token (it was invalid)
        // Don't redirect if there was no token to begin with
        if (token && token !== 'dev-token-12345') {
          console.warn('401 Unauthorized - Invalid token')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
          
          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
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
      // For n8n, first generate the workflow using AI if we have a description
      if (data.description && !data.nodes) {
        // Call AI generation endpoint first
        const generatePayload = {
          prompt: data.description,
          name: data.name,
          apiKey: data.apiKey, // Optional API key if provided
          provider: data.provider,
          credentialId: data.credentialId,
          credentialName: data.credentialName,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          useUserSettings: data.useUserSettings,
          mode: data.mode,
          userEditedPrompt: data.userEditedPrompt
        }
        
        const generationResponse = await api.post('/n8n/tools/n8n_generate_workflow', generatePayload)
        
        console.log('Generation response:', generationResponse.data)
        
        // Check if generation was successful
        if (!generationResponse.data.success) {
          throw new Error(generationResponse.data.error || 'Failed to generate workflow')
        }
        
        // Extract the generated workflow data and user configuration
        const generatedData = generationResponse.data.data
        const generatedWorkflow = generatedData?.workflow
        const userConfiguration = generatedData?.userConfiguration
        
        // Validate that we have a workflow
        if (!generatedWorkflow || !generatedWorkflow.nodes || generatedWorkflow.nodes.length === 0) {
          console.error('Invalid workflow structure:', generatedWorkflow)
          throw new Error('Generated workflow is empty or invalid')
        }
        
        console.log('User configuration:', userConfiguration)
        
        // Check if user configuration is required
        if (userConfiguration?.hasRequiredValues) {
          // Return the generation response with userConfiguration flag
          return {
            data: {
              success: true,
              requiresConfiguration: true,
              workflow: generatedWorkflow,
              userConfiguration: userConfiguration,
              generationData: {
                name: data.name,
                provider: generatedData?.provider,
                usage: generatedData?.usage
              }
            }
          }
        }
        
        // If no configuration required, create the workflow directly
        const workflowData = {
          name: generatedWorkflow.name || data.name,
          nodes: generatedWorkflow.nodes,
          connections: generatedWorkflow.connections,
          settings: generatedWorkflow.settings || {},
          active: data.active || false
        }
        
        return api.post('/n8n/tools/n8n_create_workflow', workflowData)
      } else {
        // If nodes are already provided, create directly
        const workflowData = {
          name: data.name,
          description: data.description,
          nodes: data.nodes,
          connections: data.connections || {},
          settings: data.settings || {},
          active: data.active || false
        }
        return api.post('/n8n/tools/n8n_create_workflow', workflowData)
      }
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
      return api.post('/n8n/tools/n8n_list_workflows', {})
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
  apiKey?: string
  provider?: string
  credentialId?: string
  credentialName?: string
  model?: string
  temperature?: number
  maxTokens?: number
  useUserSettings?: boolean
  mode?: string
  userEditedPrompt?: string
}) => {
  // If platform is specified, use MCP-specific endpoint
  if (data.platform) {
    const response = await createMCPAutomation(data.platform, data)
    // Return the response data directly to preserve the structure
    return response.data
  }
  
  // Otherwise, use n8n as default platform
  const response = await createMCPAutomation('n8n', data)
  // Return the response data directly to preserve the structure
  return response.data
}

// Create workflow with user configuration values
export const createWorkflowWithConfiguration = async (workflow: any, configValues: Record<string, any>) => {
  // Update the workflow nodes directly with user-provided values
  const updatedWorkflow = { ...workflow }
  
  // Update each node with the corresponding configuration values
  updatedWorkflow.nodes = workflow.nodes.map((node: any) => {
    const updatedNode = { ...node, parameters: { ...node.parameters } }
    
    // Check if there are configuration values for this node
    Object.entries(configValues).forEach(([key, value]) => {
      const [nodeId, paramName] = key.split('.')
      if (nodeId === node.id && value) {
        // Update the parameter value
        updatedNode.parameters[paramName] = value
      }
    })
    
    return updatedNode
  })
  
  // Now create the workflow with the updated configuration
  const workflowData = {
    name: updatedWorkflow.name,
    nodes: updatedWorkflow.nodes,
    connections: updatedWorkflow.connections,
    settings: updatedWorkflow.settings || {},
    active: false
  }
  
  return api.post('/n8n/tools/n8n_create_workflow', workflowData)
}

export const listAutomations = async (platform?: string) => {
  if (platform) {
    // Get automations from specific platform
    const response = await listMCPAutomations(platform)
    // Handle different response formats
    const data = response.data?.data || response.data?.result || []
    return Array.isArray(data) ? data : []
  }
  
  // Get all automations from all platforms
  // Only query n8n for now since other services are not available
  const platforms = ['n8n'] // Removed 'make', 'zapier', 'vapi' until they're implemented
  const results = await Promise.allSettled(
    platforms.map(p => listMCPAutomations(p))
  )
  
  const automations: any[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      // Handle different response formats
      const data = result.value.data?.data || result.value.data?.result || []
      if (Array.isArray(data)) {
        const platformAutomations = data.map((auto: any) => ({
          ...auto,
          platform: platforms[index]
        }))
        automations.push(...platformAutomations)
      }
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
      return api.post('/n8n/tools/n8n_execute_workflow', { id, data })
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

// Credential API endpoints - using auth MCP
export const credentialAPI = {
  list: async () => {
    // List credentials via API proxy to Auth MCP
    const response = await api.get('/auth/credentials')
    return response.data
  },

  get: async (id: string) => {
    const response = await api.get(`/auth/credentials/${id}`)
    return response.data
  },

  create: async (data: {
    templateId: string
    name: string
    values: Record<string, any>
  }) => {
    // Transform form data to match server expectations
    const payload = {
      platform: data.templateId,
      name: data.name,
      data: data.values
    }
    const response = await api.post('/auth/credentials', payload)
    return response.data
  },

  update: async (id: string, data: {
    values: Record<string, any>
  }) => {
    // Transform form data to match server expectations
    const payload = {
      data: data.values
    }
    const response = await api.put(`/auth/credentials/${id}`, payload)
    return response.data
  },

  delete: async (id: string) => {
    const response = await api.delete(`/auth/credentials/${id}`)
    return response.data
  },

  verify: async (id: string) => {
    const response = await api.post(`/auth/credentials/${id}/test`)
    return response.data
  },

  validate: async (data: {
    templateId: string
    data: Record<string, any>
  }) => {
    // Transform form data to match server expectations
    const payload = {
      credentials: data.data
    }
    const response = await api.post('/auth/credentials/test', payload)
    return response.data
  },

  test: async (credentialId: string) => {
    // First get the credential data
    const credResponse = await api.get(`/auth/credentials/${credentialId}`)
    if (!credResponse.data || !credResponse.data.success || !credResponse.data.data) {
      throw new Error('Failed to get credential data')
    }
    
    // Then test it using the test endpoint
    const payload = {
      credentials: credResponse.data.data.data // This is the decrypted credential values
    }
    const response = await api.post('/auth/credentials/test', payload)
    return response.data
  },

  getTemplates: async () => {
    // Fetch credential templates via API proxy to Auth MCP
    const response = await api.get('/auth/credentials/templates')
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
    // Login via API proxy to Auth MCP
    const response = await api.post('/auth/login', { email, password })
    
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
      const response = await api.post('/auth/logout')
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
    const response = await api.get('/auth/me')
    return response.data
  },
  
  register: async (data: { email: string; password: string; name: string; role?: string }) => {
    const response = await api.post('/auth/register', data)
    
    // Store auth data if successful
    if (response.data?.success && response.data?.data?.accessToken) {
      localStorage.setItem('auth_token', response.data.data.accessToken)
      localStorage.setItem('user', JSON.stringify(response.data.data.user))
    }
    
    return response.data
  },
  
  verify: async () => {
    const response = await api.get('/auth/verify')
    return response.data
  }
}

// n8n-specific API exports for components that need them
export const n8nAPI = {
  listWorkflows: (params?: { limit?: number, active?: boolean }) =>
    api.post('/n8n/tools/n8n_list_workflows', params || {}),
  
  getWorkflow: (id: string) =>
    api.post('/n8n/tools/n8n_get_workflow', { id }),
  
  createWorkflow: (data: any) =>
    api.post('/n8n/tools/n8n_create_workflow', data),
  
  updateWorkflow: (id: string, data: any) =>
    api.post('/n8n/tools/n8n_update_workflow', { id, ...data }),
  
  deleteWorkflow: (id: string) =>
    api.post('/n8n/tools/n8n_delete_workflow', { id }),
  
  executeWorkflow: (id: string, data?: any) =>
    api.post('/n8n/tools/n8n_execute_workflow', { id, data }),
  
  getExecutions: (workflowId: string, limit?: number) =>
    api.post('/n8n/tools/n8n_get_executions', { workflowId, limit }),
  
  getCredentials: () =>
    api.post('/n8n/tools/n8n_get_credentials', {}),
  
  testConnection: () =>
    api.post('/n8n/tools/n8n_test_connection', {}),
  
  generateWorkflow: (prompt: string, name: string, apiKey?: string) =>
    api.post('/n8n/tools/n8n_generate_workflow', { prompt, name, apiKey })
}