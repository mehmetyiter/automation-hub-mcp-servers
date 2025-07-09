// AI Analysis System Configuration

export const config = {
  // AI Provider Settings
  ai: {
    provider: process.env.REACT_APP_AI_PROVIDER || 'openai',
    apiKey: process.env.REACT_APP_AI_API_KEY || '',
    useUserSettings: !process.env.REACT_APP_AI_API_KEY
  },
  
  // Database Settings
  database: {
    url: process.env.REACT_APP_DATABASE_URL || '',
    useLocalStorage: !process.env.REACT_APP_DATABASE_URL
  },
  
  // API Settings
  api: {
    baseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api'
  },
  
  // Feature Flags
  features: {
    aiLearning: process.env.REACT_APP_ENABLE_AI_LEARNING !== 'false',
    patternRecognition: process.env.REACT_APP_ENABLE_PATTERN_RECOGNITION !== 'false',
    performanceOptimization: process.env.REACT_APP_ENABLE_PERFORMANCE_OPTIMIZATION !== 'false'
  },
  
  // Performance Settings
  performance: {
    cacheTimeout: parseInt(process.env.REACT_APP_CACHE_TIMEOUT || '300000'),
    maxResponseTime: parseInt(process.env.REACT_APP_MAX_RESPONSE_TIME || '5000'),
    maxNodeCount: parseInt(process.env.REACT_APP_MAX_NODE_COUNT || '50'),
    maxComplexity: parseFloat(process.env.REACT_APP_MAX_COMPLEXITY || '0.8'),
    minSuccessRate: parseFloat(process.env.REACT_APP_MIN_SUCCESS_RATE || '0.9')
  },
  
  // Logging
  logging: {
    level: process.env.REACT_APP_LOG_LEVEL || 'info'
  }
};

// Validation
export function validateConfig(): void {
  if (config.ai.provider && !['openai', 'anthropic', 'gemini'].includes(config.ai.provider)) {
    console.warn(`Invalid AI provider: ${config.ai.provider}. Using default: openai`);
    config.ai.provider = 'openai';
  }
  
  if (!config.ai.useUserSettings && !config.ai.apiKey) {
    console.error('AI API key is required when not using user settings. Please set REACT_APP_AI_API_KEY');
  }
  
  if (config.performance.maxComplexity > 1 || config.performance.maxComplexity < 0) {
    console.warn('Max complexity should be between 0 and 1. Using default: 0.8');
    config.performance.maxComplexity = 0.8;
  }
  
  if (config.performance.minSuccessRate > 1 || config.performance.minSuccessRate < 0) {
    console.warn('Min success rate should be between 0 and 1. Using default: 0.9');
    config.performance.minSuccessRate = 0.9;
  }
}

// Initialize configuration
validateConfig();