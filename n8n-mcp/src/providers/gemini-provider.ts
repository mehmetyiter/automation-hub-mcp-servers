import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class GeminiProvider extends BaseAIProvider {
  name: AIProvider = 'gemini';

  async generateWorkflow(prompt: string, name: string): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = `${systemPrompt}\n\nCreate an n8n workflow named "${name}" for: ${prompt}`;

    try {
      const model = this.config.model || 'gemini-1.5-pro-002';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: this.config.temperature || 0.7,
            maxOutputTokens: this.config.maxTokens || 16000,
            topK: 40,
            topP: 0.95
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      console.log('Gemini response received');
      
      // Extract the generated text
      const content = data.candidates[0].content.parts[0].text;
      const workflow = this.parseAIResponse(content);

      if (!this.validateWorkflowStructure(workflow)) {
        throw new Error('Generated workflow has invalid structure');
      }

      return {
        success: true,
        workflow,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0
        },
        provider: this.name
      };
    } catch (error: any) {
      console.error('Gemini generation error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json() as any;
      return data.models
        .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: any) => model.name.replace('models/', ''))
        .sort();
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'];
    }
  }

  async chat(messages: any[]): Promise<any> {
    try {
      const model = this.config.model || 'gemini-1.5-pro-002';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

      // Convert messages to Gemini format
      // Gemini doesn't support system messages, so we'll prepend them to the first user message
      let systemPrompt = '';
      const contents = messages
        .filter(msg => {
          if (msg.role === 'system') {
            systemPrompt += msg.content + '\n\n';
            return false;
          }
          return true;
        })
        .map((msg, index) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ 
            text: index === 0 && systemPrompt ? systemPrompt + msg.content : msg.content 
          }]
        }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: this.config.temperature || 0.7,
            maxOutputTokens: this.config.maxTokens || 2000,
            topK: 40,
            topP: 0.95,
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      const content = data.candidates[0].content.parts[0].text;

      return {
        success: true,
        content: content,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error: any) {
      console.error('Gemini chat error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}