import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class TogetherProvider extends BaseAIProvider {
  name: AIProvider = 'together';
  
  // Together AI uses OpenAI-compatible API
  private baseUrl = 'https://api.together.xyz/v1';

  async generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(learningContext);
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      console.log('Sending request to Together AI API...');
      console.log('Model:', this.config.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 8000,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Together AI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('Together AI response received');
      console.log('Tokens used:', data.usage);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from Together AI API');
      }

      const content = data.choices[0].message.content;
      const workflow = this.parseAIResponse(content);

      return {
        success: true,
        workflow,
        usage: data.usage,
        provider: this.name
      };
    } catch (error: any) {
      console.error('Together AI API error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json() as any;
      // Filter for chat/instruct models
      return data.models
        .filter((model: any) => 
          model.id.includes('instruct') || 
          model.id.includes('chat') ||
          model.id.includes('Instruct') ||
          model.id.includes('Chat')
        )
        .map((model: any) => model.id)
        .sort();
    } catch (error) {
      console.error('Error fetching Together AI models:', error);
      // Return default Together AI models
      return [
        'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'mistralai/Mixtral-8x22B-Instruct-v0.1',
        'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
        'togethercomputer/llama-2-70b-chat'
      ];
    }
  }

  async generatePlan(prompt: string, name: string, learningContext?: any): Promise<any> {
    return this.generateWorkflow(prompt, name, learningContext);
  }

  async generateSection(prompt: string, name: string, section: any, plan: any, learningContext?: any): Promise<any> {
    return this.generateWorkflow(prompt, name, learningContext);
  }

  protected async callAIForFix(prompt: string, currentWorkflow: any): Promise<string> {
    // For now, use the same generation endpoint to fix workflows
    // Each provider can customize this implementation later
    const result = await this.generateWorkflow(prompt, 'Fix Workflow');
    
    if (result.success && result.workflow) {
      return JSON.stringify(result.workflow);
    }
    
    throw new Error(result.error || 'Failed to fix workflow');
  }
}