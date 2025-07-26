import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class PerplexityProvider extends BaseAIProvider {
  name: AIProvider = 'perplexity';
  
  // Perplexity uses OpenAI-compatible API
  private baseUrl = 'https://api.perplexity.ai';

  async generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(learningContext);
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      console.log('Sending request to Perplexity API...');
      console.log('Model:', this.config.model || 'llama-3.1-sonar-large-128k-online');
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'llama-3.1-sonar-large-128k-online',
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
        throw new Error(`Perplexity API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('Perplexity response received');
      console.log('Tokens used:', data.usage);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from Perplexity API');
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
      console.error('Perplexity API error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Perplexity doesn't have a specific models endpoint, so we'll test with a minimal completion
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    // Perplexity doesn't expose a models endpoint, so we return known models
    return [
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-huge-128k-online',
      'llama-3.1-8b-instruct',
      'llama-3.1-70b-instruct'
    ];
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