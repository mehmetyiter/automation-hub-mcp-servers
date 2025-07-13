import axios from 'axios';

export class AuthService {
  async validateApiKey(apiKey: string, baseUrl: string): Promise<boolean> {
    try {
      const response = await axios.get(`${baseUrl}/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      return response.status === 200;
    } catch (error: any) {
      if (error.response?.status === 401) {
        return false;
      }
      throw new Error(`Failed to validate API key: ${error.message}`);
    }
  }

  async getUserInfo(apiKey: string, baseUrl: string): Promise<any> {
    try {
      const response = await axios.get(`${baseUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }
}