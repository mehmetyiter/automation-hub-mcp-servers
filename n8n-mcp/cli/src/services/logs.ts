import axios, { AxiosInstance } from 'axios';
import { AuthConfig } from './config';
import { WebSocketClient } from './websocket';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  nodeName?: string;
  executionId?: string;
  workflowId?: string;
  service?: string;
  metadata?: any;
}

export interface LogsParams {
  limit?: number;
  level?: string;
  since?: Date;
  service?: string;
}

export class LogsService {
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

  async getExecutionLogs(executionId: string): Promise<LogEntry[]> {
    const response = await this.client.get(`/executions/${executionId}/logs`);
    return response.data;
  }

  async getWorkflowLogs(workflowId: string, params?: LogsParams): Promise<LogEntry[]> {
    const response = await this.client.get(`/workflows/${workflowId}/logs`, { 
      params: this.formatParams(params) 
    });
    return response.data;
  }

  async getSystemLogs(params?: LogsParams): Promise<LogEntry[]> {
    const response = await this.client.get('/logs/system', { 
      params: this.formatParams(params) 
    });
    return response.data;
  }

  async streamExecutionLogs(executionId: string, onLog: (log: LogEntry) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsClient.connect(`/executions/${executionId}/logs/stream`);
      
      this.wsClient.on('message', (data) => {
        if (data.type === 'log') {
          onLog(data.log);
        } else if (data.type === 'end') {
          this.wsClient.disconnect();
          resolve();
        }
      });
      
      this.wsClient.on('error', reject);
      this.wsClient.on('close', resolve);
    });
  }

  async streamWorkflowLogs(
    workflowId: string, 
    params: LogsParams | undefined,
    onLog: (log: LogEntry) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams(this.formatParams(params) as any).toString();
      const path = `/workflows/${workflowId}/logs/stream${queryParams ? '?' + queryParams : ''}`;
      
      this.wsClient.connect(path);
      
      this.wsClient.on('message', (data) => {
        if (data.type === 'log') {
          onLog(data.log);
        }
      });
      
      this.wsClient.on('error', reject);
      this.wsClient.on('close', resolve);
    });
  }

  async streamSystemLogs(
    params: LogsParams | undefined,
    onLog: (log: LogEntry) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams(this.formatParams(params) as any).toString();
      const path = `/logs/system/stream${queryParams ? '?' + queryParams : ''}`;
      
      this.wsClient.connect(path);
      
      this.wsClient.on('message', (data) => {
        if (data.type === 'log') {
          onLog(data.log);
        }
      });
      
      this.wsClient.on('error', reject);
      this.wsClient.on('close', resolve);
    });
  }

  private formatParams(params?: LogsParams): any {
    if (!params) return {};
    
    const formatted: any = {};
    
    if (params.limit) formatted.limit = params.limit;
    if (params.level) formatted.level = params.level;
    if (params.service) formatted.service = params.service;
    if (params.since) formatted.since = params.since.toISOString();
    
    return formatted;
  }
}