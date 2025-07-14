import { PlatformType, IPlatformAdapter } from '../interfaces/credential-interfaces.js';
import { N8NPlatformAdapter } from './n8n-platform-adapter.js';
import { ZapierPlatformAdapter } from './zapier-platform-adapter.js';
import { MakePlatformAdapter } from './make-platform-adapter.js';
import { VapiPlatformAdapter } from './vapi-platform-adapter.js';
import { CustomPlatformAdapter } from './custom-platform-adapter.js';

/**
 * Platform Adapter Factory
 * 
 * Creates appropriate platform adapters based on platform type
 */
export class PlatformAdapterFactory {
  private static adapters: Map<PlatformType, IPlatformAdapter> = new Map();
  private static config: Record<PlatformType, any> = {
    n8n: {},
    zapier: {},
    make: {},
    vapi: {},
    custom: {}
  };

  /**
   * Register platform configuration
   */
  static registerConfig(platform: PlatformType, config: any): void {
    this.config[platform] = config;
  }

  /**
   * Create or get a platform adapter
   */
  static getAdapter(platform: PlatformType): IPlatformAdapter {
    // Check if adapter already exists
    if (this.adapters.has(platform)) {
      return this.adapters.get(platform)!;
    }

    // Create new adapter
    const adapter = this.createAdapter(platform);
    this.adapters.set(platform, adapter);
    return adapter;
  }

  /**
   * Create a new adapter instance
   */
  private static createAdapter(platform: PlatformType): IPlatformAdapter {
    const config = this.config[platform] || {};

    switch (platform) {
      case 'n8n':
        return new N8NPlatformAdapter(config);
      
      case 'zapier':
        return new ZapierPlatformAdapter(config);
      
      case 'make':
        return new MakePlatformAdapter(config);
      
      case 'vapi':
        return new VapiPlatformAdapter(config);
      
      case 'custom':
        return new CustomPlatformAdapter(config);
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get all registered adapters
   */
  static getAllAdapters(): Map<PlatformType, IPlatformAdapter> {
    // Ensure all platform adapters are created
    const platforms: PlatformType[] = ['n8n', 'zapier', 'make', 'vapi', 'custom'];
    
    for (const platform of platforms) {
      if (!this.adapters.has(platform)) {
        this.getAdapter(platform);
      }
    }

    return new Map(this.adapters);
  }

  /**
   * Clear all cached adapters
   */
  static clearAdapters(): void {
    this.adapters.clear();
  }

  /**
   * Update adapter configuration
   */
  static updateConfig(platform: PlatformType, config: any): void {
    this.config[platform] = { ...this.config[platform], ...config };
    
    // If adapter exists, recreate it with new config
    if (this.adapters.has(platform)) {
      this.adapters.delete(platform);
      this.getAdapter(platform);
    }
  }

  /**
   * Get supported platforms
   */
  static getSupportedPlatforms(): PlatformType[] {
    return ['n8n', 'zapier', 'make', 'vapi', 'custom'];
  }

  /**
   * Check if platform is supported
   */
  static isPlatformSupported(platform: string): platform is PlatformType {
    return this.getSupportedPlatforms().includes(platform as PlatformType);
  }
}