import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class MistralProvider extends BaseAIProvider {
  name: AIProvider = 'mistral';
  
  private baseUrl = 'https://api.mistral.ai/v1';

  async generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(learningContext);
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      console.log('Sending request to Mistral API...');
      console.log('Model:', this.config.model || 'mistral-large-latest');
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'mistral-large-latest',
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
        throw new Error(`Mistral API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('Mistral response received');
      console.log('Tokens used:', data.usage);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from Mistral API');
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
      console.error('Mistral API error:', error);
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
      return data.data
        .map((model: any) => model.id)
        .sort();
    } catch (error) {
      console.error('Error fetching Mistral models:', error);
      // Return default Mistral models
      return [
        'mistral-large-latest',
        'mistral-medium-latest',
        'mistral-small-latest',
        'mistral-embed',
        'open-mistral-7b',
        'open-mixtral-8x7b',
        'open-mixtral-8x22b'
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