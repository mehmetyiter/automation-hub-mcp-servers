import { request, APIRequestContext } from '@playwright/test';
import { User } from '../../../../src/testing/test-factory';

export interface APIClientConfig {
  baseURL: string;
  user?: User;
  apiKey?: string;
  timeout?: number;
}

export interface APIResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  ok: boolean;
}

export class APIClient {
  private context: APIRequestContext | null = null;
  private config: APIClientConfig;
  private authToken: string | null = null;

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: 10000,
      ...config
    };
  }

  async authenticate(): Promise<void> {
    if (!this.context) {
      this.context = await request.newContext({
        baseURL: this.config.baseURL,
        timeout: this.config.timeout
      });
    }

    if (this.config.user) {
      // Authenticate with user credentials
      const response = await this.context.post('/api/auth/login', {
        data: {
          email: this.config.user.email,
          password: 'password123' // Default test password
        }
      });

      if (!response.ok()) {
        throw new Error(`Authentication failed: ${response.status()}`);
      }

      const authData = await response.json();
      this.authToken = authData.token;
    } else if (this.config.apiKey) {
      // Use API key authentication
      this.authToken = this.config.apiKey;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.authToken) {
      if (this.config.apiKey) {
        headers['X-API-Key'] = this.authToken;
      } else {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
    }

    return headers;
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<APIResponse<T>> {
    if (!this.context) {
      throw new Error('API client not initialized. Call authenticate() first.');
    }

    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await this.context.get(url, {
      headers: this.getHeaders()
    });

    return this.processResponse<T>(response);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    if (!this.context) {
      throw new Error('API client not initialized. Call authenticate() first.');
    }

    const response = await this.context.post(endpoint, {
      headers: this.getHeaders(),
      data: data ? JSON.stringify(data) : undefined
    });

    return this.processResponse<T>(response);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    if (!this.context) {
      throw new Error('API client not initialized. Call authenticate() first.');
    }

    const response = await this.context.put(endpoint, {
      headers: this.getHeaders(),
      data: data ? JSON.stringify(data) : undefined
    });

    return this.processResponse<T>(response);
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    if (!this.context) {
      throw new Error('API client not initialized. Call authenticate() first.');
    }

    const response = await this.context.patch(endpoint, {
      headers: this.getHeaders(),
      data: data ? JSON.stringify(data) : undefined
    });

    return this.processResponse<T>(response);
  }

  async delete<T = any>(endpoint: string): Promise<APIResponse<T>> {
    if (!this.context) {
      throw new Error('API client not initialized. Call authenticate() first.');
    }

    const response = await this.context.delete(endpoint, {
      headers: this.getHeaders()
    });

    return this.processResponse<T>(response);
  }

  private async processResponse<T>(response: any): Promise<APIResponse<T>> {
    const status = response.status();
    const headers: Record<string, string> = {};
    
    // Extract headers
    const responseHeaders = response.headers();
    Object.keys(responseHeaders).forEach(key => {
      headers[key] = responseHeaders[key];
    });

    let data: T;
    try {
      data = await response.json();
    } catch {
      // If response is not JSON, return as text
      data = await response.text() as any;
    }

    return {
      status,
      data,
      headers,
      ok: response.ok()
    };
  }

  // Convenience methods for common API operations
  async createUser(userData: Partial<User>): Promise<APIResponse<User>> {
    return this.post<User>('/api/users', userData);
  }

  async getUser(userId: string): Promise<APIResponse<User>> {
    return this.get<User>(`/api/users/${userId}`);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<APIResponse<User>> {
    return this.put<User>(`/api/users/${userId}`, userData);
  }

  async deleteUser(userId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/api/users/${userId}`);
  }

  async createWorkflow(workflowData: any): Promise<APIResponse<any>> {
    return this.post('/api/workflows', workflowData);
  }

  async getWorkflows(params?: Record<string, any>): Promise<APIResponse<any[]>> {
    return this.get('/api/workflows', params);
  }

  async getWorkflow(workflowId: string): Promise<APIResponse<any>> {
    return this.get(`/api/workflows/${workflowId}`);
  }

  async updateWorkflow(workflowId: string, workflowData: any): Promise<APIResponse<any>> {
    return this.put(`/api/workflows/${workflowId}`, workflowData);
  }

  async deleteWorkflow(workflowId: string): Promise<APIResponse<void>> {
    return this.delete(`/api/workflows/${workflowId}`);
  }

  async executeWorkflow(workflowId: string, data?: any): Promise<APIResponse<any>> {
    return this.post(`/api/workflows/${workflowId}/execute`, data);
  }

  async getExecutions(workflowId?: string): Promise<APIResponse<any[]>> {
    const endpoint = workflowId ? `/api/workflows/${workflowId}/executions` : '/api/executions';
    return this.get(endpoint);
  }

  async getExecution(executionId: string): Promise<APIResponse<any>> {
    return this.get(`/api/executions/${executionId}`);
  }

  async createApiKey(keyData: any): Promise<APIResponse<any>> {
    return this.post('/api/api-keys', keyData);
  }

  async getApiKeys(): Promise<APIResponse<any[]>> {
    return this.get('/api/api-keys');
  }

  async revokeApiKey(keyId: string): Promise<APIResponse<void>> {
    return this.delete(`/api/api-keys/${keyId}`);
  }

  async createCredential(credentialData: any): Promise<APIResponse<any>> {
    return this.post('/api/credentials', credentialData);
  }

  async getCredentials(): Promise<APIResponse<any[]>> {
    return this.get('/api/credentials');
  }

  async updateCredential(credentialId: string, credentialData: any): Promise<APIResponse<any>> {
    return this.put(`/api/credentials/${credentialId}`, credentialData);
  }

  async deleteCredential(credentialId: string): Promise<APIResponse<void>> {
    return this.delete(`/api/credentials/${credentialId}`);
  }

  // Health and status endpoints
  async getHealth(): Promise<APIResponse<any>> {
    return this.get('/health');
  }

  async getStatus(): Promise<APIResponse<any>> {
    return this.get('/api/status');
  }

  async getMetrics(): Promise<APIResponse<any>> {
    return this.get('/api/metrics');
  }

  // Utility methods
  async waitForExecution(executionId: string, timeout = 30000): Promise<APIResponse<any>> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const execution = await this.getExecution(executionId);
      
      if (execution.data.status === 'success' || execution.data.status === 'error') {
        return execution;
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Execution ${executionId} did not complete within ${timeout}ms`);
  }

  async uploadFile(endpoint: string, filePath: string, fieldName = 'file'): Promise<APIResponse<any>> {
    if (!this.context) {
      throw new Error('API client not initialized. Call authenticate() first.');
    }

    const fs = require('fs');
    const path = require('path');
    
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    const response = await this.context.post(endpoint, {
      headers: {
        ...this.getHeaders(),
        'Content-Type': undefined // Let browser set it for multipart
      },
      multipart: {
        [fieldName]: {
          name: fileName,
          mimeType: 'application/octet-stream',
          buffer: fileContent
        }
      }
    });

    return this.processResponse(response);
  }

  // Rate limiting test helpers
  async testRateLimit(endpoint: string, requestCount: number, expectedStatus = 429): Promise<{
    requests: APIResponse<any>[];
    rateLimitHit: boolean;
    rateLimitAfter: number;
  }> {
    const requests: APIResponse<any>[] = [];
    let rateLimitHit = false;
    let rateLimitAfter = 0;

    for (let i = 0; i < requestCount; i++) {
      const response = await this.get(endpoint);
      requests.push(response);

      if (response.status === expectedStatus) {
        rateLimitHit = true;
        rateLimitAfter = i + 1;
        break;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      requests,
      rateLimitHit,
      rateLimitAfter
    };
  }

  // Batch operations
  async batch<T>(operations: Array<() => Promise<APIResponse<T>>>): Promise<APIResponse<T>[]> {
    return Promise.all(operations.map(op => op()));
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    this.authToken = null;
  }

  // Error handling helpers
  expectSuccess<T>(response: APIResponse<T>): T {
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
    }
    return response.data;
  }

  expectError(response: APIResponse<any>, expectedStatus: number): any {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
    return response.data;
  }

  expectValidationError(response: APIResponse<any>, field?: string): any {
    this.expectError(response, 400);
    
    if (field && response.data.details) {
      const hasFieldError = response.data.details.some((detail: any) => 
        detail.field.includes(field)
      );
      if (!hasFieldError) {
        throw new Error(`Expected validation error for field '${field}', but not found`);
      }
    }
    
    return response.data;
  }

  // Performance testing helpers
  async measureResponseTime<T>(operation: () => Promise<APIResponse<T>>): Promise<{
    response: APIResponse<T>;
    duration: number;
  }> {
    const start = Date.now();
    const response = await operation();
    const duration = Date.now() - start;
    
    return { response, duration };
  }

  async benchmarkEndpoint(endpoint: string, iterations = 10): Promise<{
    min: number;
    max: number;
    avg: number;
    responses: APIResponse<any>[];
  }> {
    const times: number[] = [];
    const responses: APIResponse<any>[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const { response, duration } = await this.measureResponseTime(() => this.get(endpoint));
      times.push(duration);
      responses.push(response);
    }
    
    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      responses
    };
  }
}