import { config } from 'dotenv';

// Load environment variables
config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  enableRateLimit: boolean;
  maxRequestsPerMinute: number;
}

export interface PredictiveConfig {
  enableAutoRetrain: boolean;
  enableAnomalyDetection: boolean;
  enableOptimizationRecommendations: boolean;
  maxModels: number;
  predictionCacheTTL: number;
  modelRetrainInterval: number;
  minDataPoints: number;
  confidenceThreshold: number;
}

export interface OptimizationConfig {
  enableWorkflowOptimization: boolean;
  enableResourceOptimization: boolean;
  enablePerformanceOptimization: boolean;
  enableCostOptimization: boolean;
  optimizationInterval: number;
  minDataPointsForOptimization: number;
}

export interface MLConfig {
  enableTensorFlow: boolean;
  enableGPU: boolean;
  modelSaveDir: string;
  maxTrainingEpochs: number;
  defaultBatchSize: number;
  validationSplit: number;
  earlyStoppingPatience: number;
}

export interface CacheConfig {
  enableRedis: boolean;
  redisUrl?: string;
  redisPassword?: string;
  defaultTTL: number;
  maxMemoryPolicy: string;
}

export interface MonitoringConfig {
  enablePrometheus: boolean;
  prometheusPort: number;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  enablePerformanceTracking: boolean;
}

export interface SecurityConfig {
  enableAuthentication: boolean;
  jwtSecret?: string;
  jwtExpiresIn: string;
  apiKeyHeader: string;
  enableApiKeys: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface ApplicationConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  predictive: PredictiveConfig;
  optimization: OptimizationConfig;
  ml: MLConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  environment: 'development' | 'staging' | 'production';
  logLevel: string;
}

function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const appConfig: ApplicationConfig = {
  environment: (process.env.NODE_ENV as any) || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  database: {
    host: getEnvString('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', 5432),
    database: getEnvString('DB_NAME', 'predictive_analytics'),
    username: getEnvString('DB_USERNAME', 'postgres'),
    password: getEnvString('DB_PASSWORD', 'password'),
    ssl: getEnvBoolean('DB_SSL', false),
    maxConnections: getEnvNumber('DB_MAX_CONNECTIONS', 20)
  },

  server: {
    port: getEnvNumber('PORT', 3010),
    host: getEnvString('HOST', '0.0.0.0'),
    enableCors: getEnvBoolean('ENABLE_CORS', true),
    enableRateLimit: getEnvBoolean('ENABLE_RATE_LIMIT', true),
    maxRequestsPerMinute: getEnvNumber('MAX_REQUESTS_PER_MINUTE', 200)
  },

  predictive: {
    enableAutoRetrain: getEnvBoolean('ENABLE_AUTO_RETRAIN', true),
    enableAnomalyDetection: getEnvBoolean('ENABLE_ANOMALY_DETECTION', true),
    enableOptimizationRecommendations: getEnvBoolean('ENABLE_OPTIMIZATION_RECOMMENDATIONS', true),
    maxModels: getEnvNumber('MAX_MODELS', 50),
    predictionCacheTTL: getEnvNumber('PREDICTION_CACHE_TTL', 3600000), // 1 hour
    modelRetrainInterval: getEnvNumber('MODEL_RETRAIN_INTERVAL', 86400000), // 24 hours
    minDataPoints: getEnvNumber('MIN_DATA_POINTS', 100),
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7')
  },

  optimization: {
    enableWorkflowOptimization: getEnvBoolean('ENABLE_WORKFLOW_OPTIMIZATION', true),
    enableResourceOptimization: getEnvBoolean('ENABLE_RESOURCE_OPTIMIZATION', true),
    enablePerformanceOptimization: getEnvBoolean('ENABLE_PERFORMANCE_OPTIMIZATION', true),
    enableCostOptimization: getEnvBoolean('ENABLE_COST_OPTIMIZATION', true),
    optimizationInterval: getEnvNumber('OPTIMIZATION_INTERVAL', 14400000), // 4 hours
    minDataPointsForOptimization: getEnvNumber('MIN_DATA_POINTS_OPTIMIZATION', 100)
  },

  ml: {
    enableTensorFlow: getEnvBoolean('ENABLE_TENSORFLOW', true),
    enableGPU: getEnvBoolean('ENABLE_GPU', false),
    modelSaveDir: getEnvString('MODEL_SAVE_DIR', './models'),
    maxTrainingEpochs: getEnvNumber('MAX_TRAINING_EPOCHS', 100),
    defaultBatchSize: getEnvNumber('DEFAULT_BATCH_SIZE', 32),
    validationSplit: parseFloat(process.env.VALIDATION_SPLIT || '0.2'),
    earlyStoppingPatience: getEnvNumber('EARLY_STOPPING_PATIENCE', 10)
  },

  cache: {
    enableRedis: getEnvBoolean('ENABLE_REDIS', false),
    redisUrl: process.env.REDIS_URL,
    redisPassword: process.env.REDIS_PASSWORD,
    defaultTTL: getEnvNumber('CACHE_DEFAULT_TTL', 3600), // 1 hour
    maxMemoryPolicy: getEnvString('REDIS_MAX_MEMORY_POLICY', 'allkeys-lru')
  },

  monitoring: {
    enablePrometheus: getEnvBoolean('ENABLE_PROMETHEUS', true),
    prometheusPort: getEnvNumber('PROMETHEUS_PORT', 9090),
    enableHealthChecks: getEnvBoolean('ENABLE_HEALTH_CHECKS', true),
    healthCheckInterval: getEnvNumber('HEALTH_CHECK_INTERVAL', 30000), // 30 seconds
    enablePerformanceTracking: getEnvBoolean('ENABLE_PERFORMANCE_TRACKING', true)
  },

  security: {
    enableAuthentication: getEnvBoolean('ENABLE_AUTHENTICATION', false),
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: getEnvString('JWT_EXPIRES_IN', '24h'),
    apiKeyHeader: getEnvString('API_KEY_HEADER', 'X-API-Key'),
    enableApiKeys: getEnvBoolean('ENABLE_API_KEYS', false),
    rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000), // 1 minute
    rateLimitMaxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 200)
  }
};

export function validateConfig(): void {
  const errors: string[] = [];

  // Validate database configuration
  if (!appConfig.database.host) errors.push('Database host is required');
  if (!appConfig.database.database) errors.push('Database name is required');
  if (!appConfig.database.username) errors.push('Database username is required');

  // Validate ML configuration
  if (appConfig.ml.validationSplit < 0 || appConfig.ml.validationSplit > 1) {
    errors.push('Validation split must be between 0 and 1');
  }

  if (appConfig.predictive.confidenceThreshold < 0 || appConfig.predictive.confidenceThreshold > 1) {
    errors.push('Confidence threshold must be between 0 and 1');
  }

  // Validate security configuration
  if (appConfig.security.enableAuthentication && !appConfig.security.jwtSecret) {
    errors.push('JWT secret is required when authentication is enabled');
  }

  // Validate cache configuration
  if (appConfig.cache.enableRedis && !appConfig.cache.redisUrl) {
    errors.push('Redis URL is required when Redis caching is enabled');
  }

  // Validate intervals
  if (appConfig.predictive.modelRetrainInterval < 60000) {
    errors.push('Model retrain interval must be at least 1 minute');
  }

  if (appConfig.optimization.optimizationInterval < 60000) {
    errors.push('Optimization interval must be at least 1 minute');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Feature flags for experimental features
export const featureFlags = {
  enableExperimentalModels: getEnvBoolean('ENABLE_EXPERIMENTAL_MODELS', false),
  enableAutoHyperparameterTuning: getEnvBoolean('ENABLE_AUTO_HYPERPARAMETER_TUNING', false),
  enableDistributedTraining: getEnvBoolean('ENABLE_DISTRIBUTED_TRAINING', false),
  enableModelVersioning: getEnvBoolean('ENABLE_MODEL_VERSIONING', true),
  enableAdvancedAnomalyDetection: getEnvBoolean('ENABLE_ADVANCED_ANOMALY_DETECTION', false),
  enableRealtimePredictions: getEnvBoolean('ENABLE_REALTIME_PREDICTIONS', true),
  enableModelExplainability: getEnvBoolean('ENABLE_MODEL_EXPLAINABILITY', false),
  enableA11yTesting: getEnvBoolean('ENABLE_A11Y_TESTING', false),
  enableCustomMetrics: getEnvBoolean('ENABLE_CUSTOM_METRICS', true),
  enableDataDrift: getEnvBoolean('ENABLE_DATA_DRIFT_DETECTION', false)
};

// Performance tuning configuration
export const performanceConfig = {
  maxConcurrentPredictions: getEnvNumber('MAX_CONCURRENT_PREDICTIONS', 100),
  maxConcurrentTraining: getEnvNumber('MAX_CONCURRENT_TRAINING', 5),
  predictionTimeoutMs: getEnvNumber('PREDICTION_TIMEOUT_MS', 30000),
  trainingTimeoutMs: getEnvNumber('TRAINING_TIMEOUT_MS', 3600000), // 1 hour
  maxMemoryUsagePercent: getEnvNumber('MAX_MEMORY_USAGE_PERCENT', 80),
  maxCpuUsagePercent: getEnvNumber('MAX_CPU_USAGE_PERCENT', 80),
  garbageCollectionInterval: getEnvNumber('GC_INTERVAL_MS', 300000), // 5 minutes
  modelCleanupInterval: getEnvNumber('MODEL_CLEANUP_INTERVAL_MS', 3600000) // 1 hour
};

export default appConfig;