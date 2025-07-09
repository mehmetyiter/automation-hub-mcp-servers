import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class AnthropicProvider extends BaseAIProvider {
  name: AIProvider = 'anthropic';

  async generateWorkflow(prompt: string, name: string): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: userPrompt }
          ],
          system: systemPrompt,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 8000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      console.log('Anthropic response received');
      console.log('Tokens used:', data.usage);

      const content = data.content[0].text;
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
      console.error('Anthropic generation error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, so we return known models
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
}