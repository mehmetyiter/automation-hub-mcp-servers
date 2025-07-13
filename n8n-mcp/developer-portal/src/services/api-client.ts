import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiClientConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  environment?: 'sandbox' | 'staging' | 'production';
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestId?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any[];
  requestId?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: this.getEnvironmentUrl(config.environment || 'sandbox'),
      timeout: 30000,
      ...config
    };

    this.client = this.createClient();
    this.setupInterceptors();
  }

  private getEnvironmentUrl(environment: string): string {
    const urls = {
      sandbox: 'https://sandbox-api.n8n-mcp.com',
      staging: 'https://staging-api.n8n-mcp.com',
      production: 'https://api.n8n-mcp.com'
    };
    return urls[environment as keyof typeof urls] || urls.sandbox;
  }

  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'n8n-MCP-Explorer/1.0.0'
      }
    });
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication if available
        if (this.config.apiKey) {
          config.headers.Authorization = `Bearer ${this.config.apiKey}`;
        }

        // Add request ID for tracking
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        config.headers['X-Environment'] = this.config.environment || 'sandbox';

        // Store request metadata
        config.metadata = {
          requestId,
          startTime: Date.now()
        };

        return config;
      },
      (error) => {
        return Promise.reject(this.formatError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Add response metadata
        const requestId = response.config.headers['X-Request-ID'] as string;
        const startTime = (response.config as any).metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : undefined;

        return {
          ...response,
          requestId,
          duration
        };
      },
      (error) => {
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatError(error: any): ApiError {
    const requestId = error.config?.headers?.['X-Request-ID'];
    
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.message || error.message,
        status: error.response.status,
        code: error.response.data?.error,
        details: error.response.data?.details,
        requestId
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        message: 'Network error - no response received',
        status: 0,
        code: 'NETWORK_ERROR',
        requestId
      };
    } else {
      // Something else happened
      return {
        message: error.message || 'Unknown error occurred',
        status: 0,
        code: 'UNKNOWN_ERROR',
        requestId
      };
    }
  }

  // Authentication methods
  async generateSandboxToken(): Promise<{ token: string; expiresIn: number }> {
    try {
      const response = await this.client.post('/auth/sandbox-token', {
        purpose: 'api_explorer',
        expires_in: 3600
      });

      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; user?: any }> {
    try {
      const response = await this.client.get('/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return {
        valid: true,
        user: response.data.user
      };
    } catch (error) {
      const apiError = this.formatError(error);
      if (apiError.status === 401) {
        return { valid: false };
      }
      throw apiError;
    }
  }

  // Health check
  async healthCheck(): Promise<any> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  // Workflow methods
  async getWorkflows(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    tags?: string;
  }): Promise<any> {
    try {
      const response = await this.client.get('/workflows', { params });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async createWorkflow(data: {
    name: string;
    description?: string;
    prompt?: string;
    nodes?: any[];
    connections?: any[];
    tags?: string[];
    active?: boolean;
  }): Promise<any> {
    try {
      const response = await this.client.post('/workflows', data);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getWorkflow(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/workflows/${id}`);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async updateWorkflow(id: string, data: any): Promise<any> {
    try {
      const response = await this.client.put(`/workflows/${id}`, data);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${id}`);
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeWorkflow(id: string, data?: any, mode: 'sync' | 'async' = 'async'): Promise<any> {
    try {
      const response = await this.client.post(`/workflows/${id}/execute`, data, {
        params: { mode }
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  // Execution methods
  async getWorkflowExecutions(workflowId: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
    from?: string;
    to?: string;
  }): Promise<any> {
    try {
      const response = await this.client.get(`/workflows/${workflowId}/executions`, { params });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getExecution(id: string, includeData: boolean = false): Promise<any> {
    try {
      const response = await this.client.get(`/executions/${id}`, {
        params: { include_data: includeData }
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  // API Key methods
  async getApiKeys(): Promise<any> {
    try {
      const response = await this.client.get('/api-keys');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async createApiKey(data: {
    name: string;
    scopes: string[];
    expires_at?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post('/api-keys', data);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async revokeApiKey(id: string): Promise<void> {
    try {
      await this.client.delete(`/api-keys/${id}`);
    } catch (error) {
      throw this.formatError(error);
    }
  }

  // Generic request method for custom endpoints
  async request<T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request(config);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        requestId: (response as any).requestId
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  // Configuration methods
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  setEnvironment(environment: 'sandbox' | 'staging' | 'production'): void {
    this.config.environment = environment;
    this.config.baseURL = this.getEnvironmentUrl(environment);
    this.client.defaults.baseURL = this.config.baseURL;
  }

  getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  // Utility methods
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  getEnvironment(): string {
    return this.config.environment || 'sandbox';
  }

  getBaseURL(): string {
    return this.config.baseURL || '';
  }
}

// Default instance
export const apiClient = new ApiClient();