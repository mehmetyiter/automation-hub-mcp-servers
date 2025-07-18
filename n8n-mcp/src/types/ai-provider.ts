export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'llama' | 'deepseek' | 'perplexity';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  endpoint?: string; // For custom endpoints (e.g., Llama)
  temperature?: number;
  maxTokens?: number;
}

export interface AIProviderSettings {
  id: string;
  userId: string;
  provider: AIProvider;
  apiKeyEncrypted: string;
  modelPreferences?: {
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface AIProviderInterface {
  name: AIProvider;
  generateWorkflow(prompt: string, name: string): Promise<any>;
  testConnection(): Promise<boolean>;
  getModels(): Promise<string[]>;
  chat?(messages: any[]): Promise<any>;
  applyPostProcessing?(workflow: any): any;
}