import axios from 'axios';

export class AIService {
  private provider: string;
  private apiUrl: string;

  constructor(provider: string = 'openai') {
    this.provider = provider;
    // Use the API gateway for AI calls
    this.apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:8080/api';
  }

  async callAI(prompt: string): Promise<string> {
    try {
      const response = await axios.post(`${this.apiUrl}/n8n/ai-providers/chat/completion`, {
        messages: [
          {
            role: 'system',
            content: 'You are an expert code generator specializing in n8n workflow automation. Always provide detailed, production-ready code.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        provider: this.provider,
        temperature: 0.3,
        max_tokens: 4000
      });

      return response.data.content || response.data.message || response.data;
    } catch (error: any) {
      console.error('AI Service error:', error);
      throw new Error(`AI service failed: ${error.message}`);
    }
  }

  async getJSONResponse(prompt: string): Promise<any> {
    const response = await this.callAI(prompt);
    
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
      throw new Error('AI response was not valid JSON');
    }
  }
}