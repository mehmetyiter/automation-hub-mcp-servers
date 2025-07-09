import { AIProvider, AIProviderConfig, AIProviderInterface } from '../types/ai-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';

export class ProviderFactory {
  static createProvider(config: AIProviderConfig): AIProviderInterface {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'llama':
        // TODO: Implement Llama provider
        throw new Error('Llama provider not implemented yet');
      case 'deepseek':
        // TODO: Implement DeepSeek provider
        throw new Error('DeepSeek provider not implemented yet');
      case 'perplexity':
        // TODO: Implement Perplexity provider
        throw new Error('Perplexity provider not implemented yet');
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  static getSupportedProviders(): AIProvider[] {
    return ['openai', 'anthropic', 'gemini', 'llama', 'deepseek', 'perplexity'];
  }

  static getActiveProviders(): AIProvider[] {
    // Currently active providers
    return ['openai', 'anthropic', 'gemini'];
  }
}