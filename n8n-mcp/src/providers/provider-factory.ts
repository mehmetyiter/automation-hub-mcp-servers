import { AIProvider, AIProviderConfig, AIProviderInterface } from '../types/ai-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { GroqProvider } from './groq-provider.js';
import { MistralProvider } from './mistral-provider.js';
import { CohereProvider } from './cohere-provider.js';
import { PerplexityProvider } from './perplexity-provider.js';
import { TogetherProvider } from './together-provider.js';

export class ProviderFactory {
  static createProvider(config: AIProviderConfig): AIProviderInterface {
    // Normalize provider name (handle aliases)
    const providerName = config.provider as string;
    const normalizedProvider = (providerName === 'claude' ? 'anthropic' : providerName) as AIProvider;
    const normalizedConfig = { ...config, provider: normalizedProvider };
    
    switch (normalizedProvider) {
      case 'openai':
        return new OpenAIProvider(normalizedConfig);
      case 'anthropic':
        return new AnthropicProvider(normalizedConfig);
      case 'gemini':
        return new GeminiProvider(normalizedConfig);
      case 'llama':
        // TODO: Implement Llama provider (for local/self-hosted models)
        throw new Error('Llama provider not implemented yet');
      case 'deepseek':
        return new DeepSeekProvider(normalizedConfig);
      case 'perplexity':
        return new PerplexityProvider(normalizedConfig);
      case 'groq':
        return new GroqProvider(normalizedConfig);
      case 'mistral':
        return new MistralProvider(normalizedConfig);
      case 'cohere':
        return new CohereProvider(normalizedConfig);
      case 'together':
        return new TogetherProvider(normalizedConfig);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  static getSupportedProviders(): AIProvider[] {
    return ['openai', 'anthropic', 'gemini', 'llama', 'deepseek', 'perplexity', 'groq', 'mistral', 'cohere', 'together'];
  }

  static getActiveProviders(): AIProvider[] {
    // Currently active providers (all except llama which needs local setup)
    return ['openai', 'anthropic', 'gemini', 'deepseek', 'perplexity', 'groq', 'mistral', 'cohere', 'together'];
  }
}