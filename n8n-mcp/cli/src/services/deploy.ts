import axios, { AxiosInstance } from 'axios';
import { AuthConfig } from './config';
import { Workflow } from './workflow';

export class DeployService {
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

  async createWorkflow(data: any): Promise<Workflow> {
    const response = await this.client.post('/workflows', data);
    return response.data;
  }

  async updateWorkflow(id: string, data: any): Promise<Workflow> {
    const response = await this.client.put(`/workflows/${id}`, data);
    return response.data;
  }

  async listAllWorkflows(): Promise<Workflow[]> {
    const workflows: Workflow[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.get('/workflows', {
        params: { page, limit: 100 }
      });

      workflows.push(...response.data.data);
      
      if (response.data.pagination.page >= response.data.pagination.totalPages) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return workflows;
  }
}