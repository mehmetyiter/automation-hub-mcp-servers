import axios, { AxiosInstance } from 'axios';
import { AuthConfig } from './config';

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowListParams {
  limit?: number;
  page?: number;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class WorkflowService {
  private client: AxiosInstance;

  constructor(auth: AuthConfig) {
    this.client = axios.create({
      baseURL: auth.baseUrl,
      headers: {
        'Authorization': `Bearer ${auth.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async list(params?: WorkflowListParams): Promise<PaginatedResponse<Workflow>> {
    const response = await this.client.get('/workflows', { params });
    return response.data;
  }

  async get(id: string): Promise<Workflow> {
    const response = await this.client.get(`/workflows/${id}`);
    return response.data;
  }

  async create(data: any): Promise<Workflow> {
    const response = await this.client.post('/workflows', data);
    return response.data;
  }

  async update(id: string, data: any): Promise<Workflow> {
    const response = await this.client.put(`/workflows/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/workflows/${id}`);
  }

  async activate(id: string): Promise<void> {
    await this.client.patch(`/workflows/${id}/activate`);
  }

  async deactivate(id: string): Promise<void> {
    await this.client.patch(`/workflows/${id}/deactivate`);
  }

  async execute(id: string, data?: any): Promise<any> {
    const response = await this.client.post(`/workflows/${id}/execute`, { data });
    return response.data;
  }

  async waitForExecution(executionId: string, timeout: number = 300000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await this.client.get(`/executions/${executionId}`);
      const execution = response.data;
      
      if (execution.finished) {
        return execution;
      }
      
      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Execution timeout');
  }
}