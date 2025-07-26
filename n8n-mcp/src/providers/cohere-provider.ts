import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class CohereProvider extends BaseAIProvider {
  name: AIProvider = 'cohere';
  
  private baseUrl = 'https://api.cohere.ai/v1';

  async generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(learningContext);
    const fullPrompt = `${systemPrompt}\n\nCreate an n8n workflow named "${name}" for: ${prompt}\n\nRespond with valid JSON only.`;

    try {
      console.log('Sending request to Cohere API...');
      console.log('Model:', this.config.model || 'command-r-plus');
      
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'command-r-plus',
          message: fullPrompt,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 8000,
          preamble: "You are an n8n workflow generation expert. Always respond with valid JSON."
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cohere API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('Cohere response received');
      
      if (!data.text) {
        throw new Error('Invalid response from Cohere API');
      }

      // Extract JSON from response
      const jsonMatch = data.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Cohere response');
      }

      const workflow = this.parseAIResponse(jsonMatch[0]);

      return {
        success: true,
        workflow,
        usage: data.meta?.tokens,
        provider: this.name
      };
    } catch (error: any) {
      console.error('Cohere API error:', error);
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
      return data.models
        .map((model: any) => model.name)
        .sort();
    } catch (error) {
      console.error('Error fetching Cohere models:', error);
      // Return default Cohere models
      return [
        'command-r-plus',
        'command-r',
        'command',
        'command-light',
        'embed-english-v3.0',
        'embed-multilingual-v3.0'
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