import axios, { AxiosInstance } from 'axios';
import { AuthConfig } from './config';
import { WebSocketClient } from './websocket';

export interface Execution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status?: string;
  data?: any;
  error?: any;
}

export interface ExecutionListParams {
  limit?: number;
  page?: number;
  status?: string;
}

export class ExecutionService {
  private client: AxiosInstance;
  private wsClient: WebSocketClient;

  constructor(auth: AuthConfig) {
    this.client = axios.create({
      baseURL: auth.baseUrl,
      headers: {
        'Authorization': `Bearer ${auth.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.wsClient = new WebSocketClient(auth);
  }

  async list(workflowId: string, params?: ExecutionListParams): Promise<any> {
    const response = await this.client.get(`/workflows/${workflowId}/executions`, { params });
    return response.data;
  }

  async get(id: string): Promise<Execution> {
    const response = await this.client.get(`/executions/${id}`);
    return response.data;
  }

  async stop(id: string): Promise<void> {
    await this.client.post(`/executions/${id}/stop`);
  }

  async retry(id: string): Promise<Execution> {
    const response = await this.client.post(`/executions/${id}/retry`);
    return response.data;
  }

  async waitForCompletion(id: string, timeout: number = 300000): Promise<Execution> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const execution = await this.get(id);
      
      if (execution.finished) {
        return execution;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Execution timeout');
  }

  async watch(id: string, onEvent: (event: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsClient.connect(`/executions/${id}/watch`);
      
      this.wsClient.on('message', (data) => {
        onEvent(data);
        
        if (data.type === 'execution-finished' || data.type === 'execution-error') {
          this.wsClient.disconnect();
          resolve();
        }
      });
      
      this.wsClient.on('error', (error) => {
        reject(error);
      });
      
      this.wsClient.on('close', () => {
        resolve();
      });
    });
  }
}