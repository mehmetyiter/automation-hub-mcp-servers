import axios from 'axios';

export class AIService {
  private provider: string;
  private apiUrl: string;
  private authToken?: string;
  private credentialId?: string;

  constructor(provider: string, authToken?: string, credentialId?: string) {
    if (!provider && !credentialId) {
      throw new Error('Either provider or credentialId is required for AI Service');
    }
    this.provider = provider;
    this.authToken = authToken;
    this.credentialId = credentialId;
    // Use the API gateway for AI calls
    this.apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:8080/api';
  }

  async callAI(prompt: string): Promise<string> {
    try {
      const requestData: any = {
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
        temperature: 0.3,
        max_tokens: 4000
      };

      // If credential ID is provided, use it
      if (this.credentialId) {
        requestData.useCredentialId = true;
        requestData.credentialId = this.credentialId;
      } else {
        // Otherwise use user settings
        requestData.useUserSettings = true;
      }

      const headers: any = {
        'Content-Type': 'application/json'
      };

      // Add auth token if available
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await axios.post(
        `${this.apiUrl}/n8n/ai-providers/chat/completion`, 
        requestData,
        { headers }
      );

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