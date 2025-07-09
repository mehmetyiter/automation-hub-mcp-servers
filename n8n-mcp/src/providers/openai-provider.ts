import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class OpenAIProvider extends BaseAIProvider {
  name: AIProvider = 'openai';

  async generateWorkflow(prompt: string, name: string): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model === 'o3' ? 'gpt-4o' : (this.config.model || 'gpt-4o'),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 8000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      console.log('OpenAI response received');
      console.log('Tokens used:', data.usage);

      const content = data.choices[0].message.content;
      const workflow = this.parseAIResponse(content);

      if (!this.validateWorkflowStructure(workflow)) {
        throw new Error('Generated workflow has invalid structure');
      }

      return {
        success: true,
        workflow,
        usage: data.usage,
        provider: this.name
      };
    } catch (error: any) {
      console.error('OpenAI generation error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
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
      const response = await fetch('https://api.openai.com/v1/models', {
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
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  async chat(messages: any[]): Promise<any> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model === 'o3' ? 'gpt-4o' : (this.config.model || 'gpt-4o'),
          messages: messages,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      return {
        success: true,
        content: data.choices[0].message.content,
        usage: data.usage
      };
    } catch (error: any) {
      console.error('OpenAI chat error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}