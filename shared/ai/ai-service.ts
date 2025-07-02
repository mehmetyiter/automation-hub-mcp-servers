export interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  workflow?: any;
  confidence?: number;
  suggestions?: string[];
  requiredCredentials?: string[];
  error?: string;
}

export class AIService {
  private config: AIServiceConfig;

  constructor(apiKey?: string, config?: Partial<AIServiceConfig>) {
    this.config = {
      provider: config?.provider || 'openai',
      apiKey: apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
      model: config?.model || 'gpt-4',
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 2000,
      ...config
    };
  }

  async generateWorkflow(
    platform: string,
    prompt: string,
    name: string
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.getSystemPrompt(platform);
      const userPrompt = `${prompt}\n\nWorkflow Name: ${name}`;

      let response: string;

      switch (this.config.provider) {
        case 'openai':
          response = await this.callOpenAI(systemPrompt, userPrompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(systemPrompt, userPrompt);
          break;
        case 'local':
          response = await this.callLocalModel(systemPrompt, userPrompt);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${this.config.provider}`);
      }

      return this.parseAIResponse(response, platform);
    } catch (error) {
      console.error('AI generation error:', error);
      return {
        error: error instanceof Error ? error.message : 'AI generation failed',
        confidence: 0
      };
    }
  }

  async enhance(prompt: string): Promise<AIResponse> {
    try {
      let response: string;

      switch (this.config.provider) {
        case 'openai':
          response = await this.callOpenAI('', prompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic('', prompt);
          break;
        case 'local':
          response = await this.callLocalModel('', prompt);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${this.config.provider}`);
      }

      return this.parseAIResponse(response);
    } catch (error) {
      console.error('AI enhancement error:', error);
      return {
        error: error instanceof Error ? error.message : 'AI enhancement failed',
        confidence: 0
      };
    }
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-opus-20240229',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private async callLocalModel(systemPrompt: string, userPrompt: string): Promise<string> {
    // Placeholder for local model integration (e.g., Ollama)
    throw new Error('Local model not implemented. Use OpenAI or Anthropic.');
  }

  private getSystemPrompt(platform: string): string {
    const basePrompt = `You are an expert automation workflow designer. Create production-ready workflows that follow best practices.`;

    const platformPrompts: Record<string, string> = {
      n8n: `${basePrompt}
        
        Create n8n workflows with proper node structure and connections.
        Use appropriate n8n node types and ensure all parameters are valid.
        Include error handling and consider edge cases.
        
        Return a JSON object with this structure:
        {
          "workflow": {
            "nodes": [...],
            "connections": {...},
            "settings": {...}
          },
          "confidence": 0.0-1.0,
          "requiredCredentials": ["service1", "service2"],
          "suggestions": ["suggestion1", "suggestion2"]
        }`,

      make: `${basePrompt}
        
        Create Make.com scenarios with proper module configuration.
        Use appropriate Make.com modules and ensure all parameters are valid.
        
        Return a JSON object with this structure:
        {
          "workflow": {
            "scenario": {
              "name": "...",
              "modules": [...],
              "connections": [...]
            }
          },
          "confidence": 0.0-1.0,
          "requiredCredentials": ["service1", "service2"],
          "suggestions": ["suggestion1", "suggestion2"]
        }`,

      zapier: `${basePrompt}
        
        Create Zapier zaps with proper trigger and action configuration.
        Use appropriate Zapier apps and ensure all parameters are valid.
        
        Return a JSON object with this structure:
        {
          "workflow": {
            "zap": {
              "name": "...",
              "trigger": {...},
              "actions": [...]
            }
          },
          "confidence": 0.0-1.0,
          "requiredCredentials": ["service1", "service2"],
          "suggestions": ["suggestion1", "suggestion2"]
        }`,

      vapi: `${basePrompt}
        
        Create VAPI voice assistants with proper configuration.
        Include appropriate voice settings, functions, and conversation flow.
        
        Return a JSON object with this structure:
        {
          "workflow": {
            "assistant": {
              "name": "...",
              "firstMessage": "...",
              "context": "...",
              "voice": {...},
              "model": {...},
              "functions": [...]
            }
          },
          "confidence": 0.0-1.0,
          "requiredCredentials": ["service1", "service2"],
          "suggestions": ["suggestion1", "suggestion2"]
        }`
    };

    return platformPrompts[platform] || basePrompt;
  }

  private parseAIResponse(response: string, platform?: string): AIResponse {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response);
      
      // Validate the response structure
      if (parsed.workflow) {
        return {
          workflow: parsed.workflow,
          confidence: parsed.confidence || 0.8,
          suggestions: parsed.suggestions || [],
          requiredCredentials: parsed.requiredCredentials || []
        };
      }

      // If no workflow in response, try to extract it
      if (platform && parsed.nodes) {
        return {
          workflow: {
            nodes: parsed.nodes,
            connections: parsed.connections || {},
            settings: parsed.settings || {}
          },
          confidence: 0.7
        };
      }

      throw new Error('Invalid AI response structure');
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          return this.parseAIResponse(JSON.stringify(extracted), platform);
        } catch {
          // Extraction failed
        }
      }

      return {
        error: 'Failed to parse AI response',
        confidence: 0
      };
    }
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  getProvider(): string {
    return this.config.provider;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateWorkflow(
        'n8n',
        'Create a simple hello world workflow',
        'Test Workflow'
      );
      return !response.error;
    } catch {
      return false;
    }
  }
}