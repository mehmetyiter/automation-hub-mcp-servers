import { api } from '../services/api';

export class AIService {
  private provider: string;
  private useUserSettings: boolean;

  constructor(provider?: string, useUserSettings: boolean = true) {
    this.provider = provider || 'openai';
    this.useUserSettings = useUserSettings;
  }

  async callAI(prompt: string): Promise<string> {
    // Use the existing AI provider infrastructure through our API
    try {
      const response = await api.post('/n8n/ai-providers/chat/completion', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI assistant specializing in workflow automation and pattern analysis. Always respond with detailed, structured JSON when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        provider: this.provider,
        useSpecificProvider: true,
        useUserSettings: false  // Always use environment variables for AI analysis
      });

      const result = response.data.content || response.data.message || response.data;
      
      // If the result is already a string, return it
      if (typeof result === 'string') {
        return result;
      }
      
      // If it's an object, stringify it
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('AI API call failed:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Fallback to direct API calls if our backend is not available
      if (error.response?.status === 404 || error.code === 'ECONNREFUSED') {
        return this.callDirectAPI(prompt);
      }
      
      // If 500 error, try to extract the actual error message
      if (error.response?.status === 500 && error.response?.data?.error) {
        throw new Error(`AI service error: ${error.response.data.error}`);
      }
      
      throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
    }
  }

  private async callDirectAPI(prompt: string): Promise<string> {
    // This method requires API keys to be set in environment variables
    const apiKey = import.meta.env.VITE_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('AI API key not configured. Please set VITE_AI_API_KEY in your environment.');
    }

    if (this.provider === 'claude') {
      return await this.callClaude(prompt, apiKey);
    } else if (this.provider === 'openai') {
      return await this.callOpenAI(prompt, apiKey);
    } else if (this.provider === 'gemini') {
      return await this.callGemini(prompt, apiKey);
    } else {
      throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  private async callClaude(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private async callOpenAI(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are an expert AI assistant specializing in workflow automation and pattern analysis. Always respond with detailed, structured JSON when requested.'
        }, {
          role: 'user',
          content: prompt
        }],
        max_tokens: 3200,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callGemini(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // Helper method to validate JSON response
  async getJSONResponse(prompt: string): Promise<any> {
    // Enhance prompt to ensure JSON response
    const jsonPrompt = `${prompt}

IMPORTANT: You MUST respond ONLY with valid JSON format. Do not include any text before or after the JSON.
Do not include markdown code blocks. Just return the raw JSON object.`;
    
    const response = await this.callAI(jsonPrompt);
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try to parse the entire response
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', response);
      // Return a default structure instead of throwing
      return {
        introduction: 'Creating an innovative workflow solution',
        instructions: 'Build a creative, adaptive workflow',
        guidelines: ['Innovate', 'Adapt', 'Optimize'],
        checklist: ['Verify functionality', 'Test thoroughly', 'Document well']
      };
    }
  }
}