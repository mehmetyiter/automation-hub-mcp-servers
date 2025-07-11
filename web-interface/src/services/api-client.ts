import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export interface APIClientConfig {
  baseURL: string;
  apiKey?: string;
  token?: string;
  timeout?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: Record<string, any>;
}

export class APIClient {
  private client: AxiosInstance;
  private config: APIClientConfig;

  constructor(config: APIClientConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication headers
        if (this.config.token) {
          config.headers.Authorization = `Bearer ${this.config.token}`;
        } else if (this.config.apiKey) {
          config.headers['X-API-Key'] = this.config.apiKey;
        }

        // Add request timestamp
        config.headers['X-Request-Time'] = new Date().toISOString();
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<APIResponse>) => {
        return response;
      },
      (error: AxiosError<APIResponse>) => {
        if (error.response?.status === 401) {
          // Handle authentication errors
          this.handleAuthError();
        }
        
        return Promise.reject(error);
      }
    );
  }

  private handleAuthError() {
    // Clear stored tokens
    localStorage.removeItem('auth_token');
    localStorage.removeItem('api_key');
    
    // Redirect to login if needed
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  // Update authentication
  setToken(token: string) {
    this.config.token = token;
  }

  setAPIKey(apiKey: string) {
    this.config.apiKey = apiKey;
  }

  // Generic API methods
  async get<T>(url: string, params?: any): Promise<APIResponse<T>> {
    const response = await this.client.get<APIResponse<T>>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<APIResponse<T>> {
    const response = await this.client.post<APIResponse<T>>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<APIResponse<T>> {
    const response = await this.client.put<APIResponse<T>>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<APIResponse<T>> {
    const response = await this.client.patch<APIResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<APIResponse<T>> {
    const response = await this.client.delete<APIResponse<T>>(url);
    return response.data;
  }

  // Credential API methods
  async getCredentials(params?: {
    page?: number;
    limit?: number;
    provider?: string;
    status?: string;
  }) {
    return this.get('/api/credentials', params);
  }

  async getCredential(credentialId: string) {
    return this.get(`/api/credentials/${credentialId}`);
  }

  async createCredential(credentialData: any) {
    return this.post('/api/credentials', credentialData);
  }

  async updateCredential(credentialId: string, updateData: any) {
    return this.put(`/api/credentials/${credentialId}`, updateData);
  }

  async deleteCredential(credentialId: string) {
    return this.delete(`/api/credentials/${credentialId}`);
  }

  async testCredential(credentialId: string) {
    return this.post(`/api/credentials/${credentialId}/test`);
  }

  async getCredentialUsage(credentialId: string, timeframe: string = '7d') {
    return this.get(`/api/credentials/${credentialId}/usage`, { timeframe });
  }

  // Usage API methods
  async getUsageStats(params?: {
    timeframe?: string;
    provider?: string;
    granularity?: string;
  }) {
    return this.get('/api/usage/stats', params);
  }

  async getCostAnalysis(params?: {
    timeframe?: string;
    groupBy?: string;
  }) {
    return this.get('/api/usage/cost-analysis', params);
  }

  // API key management
  async getAPIKeys() {
    return this.get('/api/api-keys');
  }

  async createAPIKey(keyData: {
    name: string;
    scopes: string[];
    expiresAt?: Date;
  }) {
    return this.post('/api/api-keys', keyData);
  }

  async revokeAPIKey(keyId: string) {
    return this.delete(`/api/api-keys/${keyId}`);
  }

  // Webhook management
  async getWebhooks() {
    return this.get('/api/webhooks');
  }

  async createWebhook(webhookData: {
    name: string;
    url: string;
    events: string[];
  }) {
    return this.post('/api/webhooks', webhookData);
  }

  async updateWebhook(webhookId: string, updateData: any) {
    return this.put(`/api/webhooks/${webhookId}`, updateData);
  }

  async deleteWebhook(webhookId: string) {
    return this.delete(`/api/webhooks/${webhookId}`);
  }

  async testWebhook(webhookId: string) {
    return this.post(`/api/webhooks/${webhookId}/test`);
  }
}

// Create default client instance
export const apiClient = new APIClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  token: localStorage.getItem('auth_token') || undefined,
  apiKey: localStorage.getItem('api_key') || undefined,
});