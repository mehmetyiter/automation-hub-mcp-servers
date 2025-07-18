import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class AnthropicProvider extends BaseAIProvider {
  name: AIProvider = 'anthropic';

  async generateWorkflow(prompt: string, name: string): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      console.log('Sending request to Anthropic API...');
      console.log('Model:', this.config.model || 'claude-opus-4-20250514');
      console.log('Max tokens:', this.config.maxTokens || 32000);
      
      // Add timeout using AbortController
      const controller = new AbortController();
      // Remove timeout for testing - let it run as long as needed
      // const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-sonnet-4-20250514',
          messages: [
            { role: 'user', content: userPrompt }
          ],
          system: systemPrompt,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 32000
        }),
        // signal: controller.signal  // Commented out - no timeout
      });
      
      // clearTimeout(timeoutId);  // Commented out - no timeout

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      console.log('Anthropic response received');
      console.log('Tokens used:', data.usage);

      const content = data.content[0].text;
      console.log('Raw AI response length:', content.length);
      console.log('Raw AI response preview:', content.substring(0, 200) + '...');
      
      // Save raw response to file for debugging
      try {
        const fs = await import('fs');
        fs.writeFileSync('/tmp/latest-ai-response.txt', content);
        console.log('Raw AI response saved to /tmp/latest-ai-response.txt');
      } catch (e) {
        console.log('Could not save debug file:', e.message);
      }
      
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
      
      // Check if it's a timeout error
      if (error.name === 'AbortError') {
        console.error('Request timed out after 2 minutes');
        return {
          success: false,
          error: 'Request timed out. There might be a temporary issue with the API.',
          provider: this.name
        };
      }
      
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
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
}