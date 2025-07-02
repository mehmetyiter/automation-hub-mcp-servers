import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface N8nWorkflow {
  id?: string;
  name: string;
  active?: boolean;
  nodes: any[];
  connections: Record<string, any>;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  workflowData?: N8nWorkflow;
  data?: any;
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListWorkflowsOptions {
  active?: boolean;
  limit?: number;
  cursor?: string;
}

export class N8nClient {
  private client: AxiosInstance;

  constructor(config: N8nClientConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, '') + '/api/v1',
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`n8n API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('n8n API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`n8n API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('n8n API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/workflows?limit=1');
      return true;
    } catch (error) {
      logger.error('n8n connection test failed:', error);
      return false;
    }
  }

  async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    // Remove active field as it's read-only in n8n API
    const { active, ...workflowPayload } = workflow;
    const response = await this.client.post('/workflows', workflowPayload);
    return response.data.data || response.data;
  }

  async listWorkflows(options?: ListWorkflowsOptions): Promise<N8nWorkflow[]> {
    const params = new URLSearchParams();
    if (options?.active !== undefined) {
      params.append('active', options.active.toString());
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.cursor) {
      params.append('cursor', options.cursor);
    }

    const response = await this.client.get(`/workflows?${params.toString()}`);
    return response.data.data || [];
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.client.get(`/workflows/${id}`);
    return response.data.data || response.data;
  }

  async updateWorkflow(id: string, updates: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.client.put(`/workflows/${id}`, updates);
    return response.data.data || response.data;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.client.delete(`/workflows/${id}`);
  }

  async executeWorkflow(id: string, data?: any): Promise<any> {
    const response = await this.client.post(`/workflows/${id}/execute`, {
      workflowData: data || {},
    });
    return response.data.data || response.data;
  }

  async getExecutions(workflowId?: string, limit = 50): Promise<N8nExecution[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (workflowId) {
      params.append('workflowId', workflowId);
    }

    const response = await this.client.get(`/executions?${params.toString()}`);
    return response.data.data || [];
  }

  async getExecution(id: string): Promise<N8nExecution> {
    const response = await this.client.get(`/executions/${id}`);
    return response.data.data || response.data;
  }

  async getCredentials(): Promise<N8nCredential[]> {
    const response = await this.client.get('/credentials');
    return response.data.data || [];
  }

  async activateWorkflow(id: string): Promise<void> {
    await this.updateWorkflow(id, { active: true });
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.updateWorkflow(id, { active: false });
  }
}