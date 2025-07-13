import Configstore from 'configstore';
import * as keytar from 'keytar';
import * as os from 'os';

const SERVICE_NAME = 'n8n-mcp-cli';

export interface AuthConfig {
  apiKey: string;
  baseUrl: string;
}

export class ConfigService {
  private config: Configstore;

  constructor() {
    this.config = new Configstore('n8n-mcp-cli', {
      defaults: {
        profiles: {}
      }
    });
  }

  async setAuth(profile: string, auth: AuthConfig): Promise<void> {
    // Store API key securely in system keychain if available
    try {
      await keytar.setPassword(SERVICE_NAME, profile, auth.apiKey);
      // Store other config in file (without API key)
      this.config.set(`profiles.${profile}`, {
        baseUrl: auth.baseUrl
      });
    } catch {
      // Fallback to storing in config file (less secure)
      console.warn('Unable to use system keychain, storing API key in config file');
      this.config.set(`profiles.${profile}`, auth);
    }
  }

  async getAuth(profile: string): Promise<AuthConfig | null> {
    const profileConfig = this.config.get(`profiles.${profile}`);
    if (!profileConfig) return null;

    // Try to get API key from keychain
    try {
      const apiKey = await keytar.getPassword(SERVICE_NAME, profile);
      if (apiKey) {
        return {
          apiKey,
          baseUrl: profileConfig.baseUrl
        };
      }
    } catch {
      // Fallback to config file
      if (profileConfig.apiKey) {
        return profileConfig as AuthConfig;
      }
    }

    return null;
  }

  async removeAuth(profile: string): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, profile);
    } catch {
      // Ignore keychain errors
    }
    this.config.delete(`profiles.${profile}`);
  }

  async listProfiles(): Promise<string[]> {
    const profiles = this.config.get('profiles') || {};
    return Object.keys(profiles);
  }

  async get(key: string, profile?: string): Promise<any> {
    if (profile) {
      return this.config.get(`profiles.${profile}.${key}`);
    }
    return this.config.get(key);
  }

  async set(key: string, value: any, profile?: string): Promise<void> {
    if (profile) {
      this.config.set(`profiles.${profile}.${key}`, value);
    } else {
      this.config.set(key, value);
    }
  }

  async unset(key: string, profile?: string): Promise<void> {
    if (profile) {
      this.config.delete(`profiles.${profile}.${key}`);
    } else {
      this.config.delete(key);
    }
  }

  async getAllConfigs(profile?: string): Promise<Record<string, any>> {
    if (profile) {
      const profileConfig = this.config.get(`profiles.${profile}`) || {};
      // Add API key from keychain if available
      try {
        const apiKey = await keytar.getPassword(SERVICE_NAME, profile);
        if (apiKey) {
          profileConfig.apiKey = apiKey;
        }
      } catch {
        // Ignore keychain errors
      }
      return profileConfig;
    }
    return this.config.all || {};
  }

  async resetProfile(profile: string): Promise<void> {
    await this.removeAuth(profile);
    this.config.delete(`profiles.${profile}`);
  }

  async resetAll(): Promise<void> {
    const profiles = await this.listProfiles();
    for (const profile of profiles) {
      await this.removeAuth(profile);
    }
    this.config.clear();
  }
}