import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { appConfig, validateConfig, featureFlags, performanceConfig } from './utils/config';
import { PredictionStorage } from './storage/PredictionStorage';
import { PredictiveEngine } from './core/PredictiveEngine';
import { OptimizationEngine } from './optimization/OptimizationEngine';
import { PredictiveAPI } from './api/PredictiveAPI';

class PredictiveAnalyticsApplication {
  private predictionStorage: PredictionStorage;
  private predictiveEngine: PredictiveEngine;
  private optimizationEngine: OptimizationEngine;
  private predictiveAPI: PredictiveAPI;
  private io: SocketIOServer;
  private server: any;

  constructor() {
    this.validateEnvironment();
    this.initializeComponents();
    this.setupGracefulShutdown();
  }

  private validateEnvironment(): void {
    try {
      validateConfig();
      logger.info('Configuration validated successfully');
      
      if (Object.values(featureFlags).some(flag => flag)) {
        logger.info('Feature flags enabled', featureFlags);
      }
      
      logger.info('Performance configuration loaded', performanceConfig);
    } catch (error) {
      logger.error('Configuration validation failed', { error: error.message });
      process.exit(1);
    }
  }

  private initializeComponents(): void {
    // Initialize storage layer
    this.predictionStorage = new PredictionStorage(appConfig.database);

    // Initialize predictive engine
    this.predictiveEngine = new PredictiveEngine(this.predictionStorage, {
      enableAutoRetrain: appConfig.predictive.enableAutoRetrain,
      enableAnomalyDetection: appConfig.predictive.enableAnomalyDetection,
      enableOptimizationRecommendations: appConfig.predictive.enableOptimizationRecommendations,
      maxModels: appConfig.predictive.maxModels,
      predictionCacheTTL: appConfig.predictive.predictionCacheTTL
    });

    // Initialize optimization engine
    this.optimizationEngine = new OptimizationEngine(this.predictiveEngine, {
      enableWorkflowOptimization: appConfig.optimization.enableWorkflowOptimization,
      enableResourceOptimization: appConfig.optimization.enableResourceOptimization,
      enablePerformanceOptimization: appConfig.optimization.enablePerformanceOptimization,
      enableCostOptimization: appConfig.optimization.enableCostOptimization,
      optimizationInterval: appConfig.optimization.optimizationInterval,
      minDataPoints: appConfig.optimization.minDataPointsForOptimization,
      confidenceThreshold: appConfig.predictive.confidenceThreshold
    });

    // Initialize API layer
    this.predictiveAPI = new PredictiveAPI(this.predictiveEngine, this.optimizationEngine, {
      port: appConfig.server.port,
      enableCors: appConfig.server.enableCors,
      enableRateLimit: appConfig.server.enableRateLimit,
      maxRequestsPerMinute: appConfig.server.maxRequestsPerMinute
    });

    // Setup WebSocket server
    this.setupWebSocketServer();

    // Setup cross-component integrations
    this.setupIntegrations();

    logger.info('Predictive analytics components initialized');
  }

  private setupWebSocketServer(): void {
    const app = this.predictiveAPI.getApp();
    this.server = createServer(app);
    
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    // Connect WebSocket to API
    this.predictiveAPI.setSocketIO(this.io);

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();

    logger.info('WebSocket server configured');
  }

  private setupWebSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected to predictive analytics', { 
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Handle subscription requests
      socket.on('subscribe', (channels: string[]) => {
        channels.forEach(channel => {
          if (['predictions', 'models', 'anomalies', 'optimizations', 'experiments'].includes(channel)) {
            socket.join(channel);
            logger.debug('Client subscribed to channel', { socketId: socket.id, channel });
          }
        });
      });

      // Handle unsubscription requests
      socket.on('unsubscribe', (channels: string[]) => {
        channels.forEach(channel => {
          socket.leave(channel);
          logger.debug('Client unsubscribed from channel', { socketId: socket.id, channel });
        });
      });

      // Handle real-time prediction requests
      socket.on('predict_realtime', async (data) => {
        try {
          const { modelId, features } = data;
          const prediction = await this.predictiveEngine.predict(modelId, features);
          socket.emit('prediction_result', prediction);
        } catch (error) {
          socket.emit('prediction_error', { error: error.message });
        }
      });

      // Handle real-time anomaly detection
      socket.on('detect_anomalies_realtime', async (data) => {
        try {
          const { data: timeSeriesData, threshold } = data;
          const anomalies = await this.predictiveEngine.detectAnomalies(timeSeriesData, threshold);
          socket.emit('anomalies_result', anomalies);
        } catch (error) {
          socket.emit('anomaly_detection_error', { error: error.message });
        }
      });

      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected from predictive analytics', { 
          socketId: socket.id, 
          reason 
        });
      });
    });
  }

  private setupIntegrations(): void {
    // Predictive Engine Events
    this.predictiveEngine.on('model_created', (model) => {
      logger.info('Model created', { modelId: model.id, name: model.name, type: model.type });
    });

    this.predictiveEngine.on('model_trained', (model) => {
      logger.info('Model trained successfully', { 
        modelId: model.id, 
        accuracy: model.performance.accuracy,
        trainingTime: Date.now() - model.updatedAt
      });
    });

    this.predictiveEngine.on('model_training_failed', (event) => {
      logger.error('Model training failed', event);
    });

    this.predictiveEngine.on('prediction_made', (prediction) => {
      logger.debug('Prediction made', { 
        modelId: prediction.modelId, 
        confidence: prediction.confidence 
      });
    });

    this.predictiveEngine.on('anomalies_detected', (anomalies) => {
      const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
      if (criticalAnomalies.length > 0) {
        logger.warn('Critical anomalies detected', { 
          count: criticalAnomalies.length,
          anomalies: criticalAnomalies.map(a => ({ 
            timestamp: a.timestamp, 
            score: a.anomalyScore 
          }))
        });
      }
    });

    this.predictiveEngine.on('recommendations_generated', (recommendations) => {
      const highPriority = recommendations.filter(r => r.priority === 'high' || r.priority === 'critical');
      if (highPriority.length > 0) {
        logger.info('High-priority recommendations generated', { 
          count: highPriority.length 
        });
      }
    });

    // Optimization Engine Events
    this.optimizationEngine.on('workflow_optimization_created', (optimization) => {
      logger.info('Workflow optimization created', {
        workflowId: optimization.workflowId,
        type: optimization.optimizationType,
        confidence: optimization.confidence,
        estimatedSavings: optimization.estimatedSavings
      });
    });

    this.optimizationEngine.on('optimizations_generated', (optimizations) => {
      logger.info('Optimization recommendations generated', { 
        count: optimizations.length 
      });
    });

    this.optimizationEngine.on('optimization_error', (error) => {
      logger.error('Optimization error', { error: error.message });
    });

    logger.info('Cross-component integrations configured');
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        // Stop accepting new connections
        if (this.server) {
          await new Promise<void>((resolve) => {
            this.server.close(() => {
              logger.info('HTTP server closed');
              resolve();
            });
          });
        }

        // Close WebSocket connections
        if (this.io) {
          this.io.close();
          logger.info('WebSocket server closed');
        }

        // Cleanup predictive engine
        if (this.predictiveEngine) {
          this.predictiveEngine.destroy();
          logger.info('Predictive engine cleaned up');
        }

        // Cleanup optimization engine
        if (this.optimizationEngine) {
          this.optimizationEngine.destroy();
          logger.info('Optimization engine cleaned up');
        }

        // Close database connections
        if (this.predictionStorage) {
          await this.predictionStorage.destroy();
          logger.info('Database connections closed');
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);

      } catch (error) {
        logger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize database
      logger.info('Initializing database...');
      await this.predictionStorage.initialize();

      // Start the server
      logger.info(`Starting predictive analytics server on port ${appConfig.server.port}...`);
      
      await new Promise<void>((resolve) => {
        this.server.listen(appConfig.server.port, appConfig.server.host, () => {
          logger.info(`Predictive analytics server started successfully`, {
            port: appConfig.server.port,
            host: appConfig.server.host,
            environment: appConfig.environment,
            pid: process.pid,
            features: Object.entries(featureFlags).filter(([, enabled]) => enabled).map(([name]) => name)
          });
          resolve();
        });
      });

      // Setup demonstration models and data
      await this.setupDemoData();

      logger.info('Predictive analytics application startup completed');

    } catch (error) {
      logger.error('Failed to start predictive analytics application', { 
        error: error.message,
        stack: error.stack 
      });
      process.exit(1);
    }
  }

  private async setupDemoData(): Promise<void> {
    try {
      // Create demonstration predictive models
      if (appConfig.environment === 'development') {
        // Workflow execution time prediction model
        const workflowModelId = await this.predictiveEngine.createModel({
          name: 'Workflow Execution Time Predictor',
          type: 'linear_regression',
          target: 'execution_time',
          features: ['workflow_complexity', 'data_size', 'node_count', 'historical_avg'],
          hyperparameters: {
            learningRate: 0.01,
            regularization: 0.001
          },
          thresholds: {
            responseTime: {
              warning: 5000,
              critical: 10000
            },
            availability: {
              warning: 95,
              critical: 90
            }
          },
          enabled: true,
          tags: ['workflow', 'performance', 'demo'],
          metadata: {
            description: 'Predicts workflow execution time based on complexity and data size',
            createdFor: 'demonstration'
          }
        });

        // Resource usage prediction model
        const resourceModelId = await this.predictiveEngine.createModel({
          name: 'Resource Usage Predictor',
          type: 'random_forest',
          target: 'resource_usage',
          features: ['cpu_baseline', 'memory_baseline', 'network_load', 'concurrent_workflows'],
          hyperparameters: {
            nTrees: 100,
            maxDepth: 10,
            minSamplesLeaf: 5
          },
          thresholds: {
            responseTime: {
              warning: 2000,
              critical: 5000
            },
            availability: {
              warning: 98,
              critical: 95
            }
          },
          enabled: true,
          tags: ['resource', 'infrastructure', 'demo'],
          metadata: {
            description: 'Predicts system resource usage for capacity planning',
            createdFor: 'demonstration'
          }
        });

        // Error rate prediction model
        const errorModelId = await this.predictiveEngine.createModel({
          name: 'Error Rate Predictor',
          type: 'lstm',
          target: 'error_rate',
          features: ['historical_errors', 'system_load', 'time_of_day', 'day_of_week'],
          hyperparameters: {
            units: 50,
            dropout: 0.2,
            lookBack: 10,
            epochs: 50
          },
          thresholds: {
            responseTime: {
              warning: 3000,
              critical: 8000
            },
            availability: {
              warning: 99,
              critical: 97
            }
          },
          enabled: true,
          tags: ['error', 'reliability', 'demo'],
          metadata: {
            description: 'Predicts error rates to enable proactive error prevention',
            createdFor: 'demonstration'
          }
        });

        logger.info('Demo predictive models created', {
          workflowModel: workflowModelId,
          resourceModel: resourceModelId,
          errorModel: errorModelId
        });

        // Generate some sample training data
        await this.generateSampleTrainingData();
      }
    } catch (error) {
      logger.warn('Failed to setup demo data', { error: error.message });
    }
  }

  private async generateSampleTrainingData(): Promise<void> {
    // Generate sample workflow execution data
    const workflowData = [];
    for (let i = 0; i < 200; i++) {
      const complexity = Math.random() * 10;
      const dataSize = Math.random() * 1000;
      const nodeCount = Math.floor(Math.random() * 20) + 1;
      const executionTime = complexity * 100 + dataSize * 0.5 + nodeCount * 50 + Math.random() * 500;
      
      workflowData.push({
        timestamp: Date.now() - (i * 60000), // Data points every minute
        value: executionTime,
        metadata: {
          complexity,
          dataSize,
          nodeCount,
          type: 'workflow_execution'
        }
      });
    }

    // Generate sample resource usage data
    const resourceData = [];
    for (let i = 0; i < 200; i++) {
      const baseUsage = 30 + Math.sin(i * 0.1) * 20; // Sinusoidal pattern
      const noise = Math.random() * 10;
      const usage = Math.max(0, Math.min(100, baseUsage + noise));
      
      resourceData.push({
        timestamp: Date.now() - (i * 60000),
        value: usage,
        metadata: {
          type: 'cpu_usage',
          baseline: baseUsage
        }
      });
    }

    // Generate sample error rate data
    const errorData = [];
    for (let i = 0; i < 200; i++) {
      const baseRate = 0.05; // 5% base error rate
      const spike = Math.random() < 0.1 ? Math.random() * 0.2 : 0; // 10% chance of error spike
      const errorRate = baseRate + spike;
      
      errorData.push({
        timestamp: Date.now() - (i * 60000),
        value: errorRate,
        metadata: {
          type: 'error_rate',
          spike: spike > 0
        }
      });
    }

    // Store the sample data
    for (const data of workflowData) {
      await this.predictionStorage.storeTrainingData(data, 'execution_time');
    }

    for (const data of resourceData) {
      await this.predictionStorage.storeTrainingData(data, 'resource_usage');
    }

    for (const data of errorData) {
      await this.predictionStorage.storeTrainingData(data, 'error_rate');
    }

    logger.info('Sample training data generated', {
      workflowDataPoints: workflowData.length,
      resourceDataPoints: resourceData.length,
      errorDataPoints: errorData.length
    });
  }
}

// Start the application
const app = new PredictiveAnalyticsApplication();
app.start().catch((error) => {
  logger.error('Application startup failed', { error: error.message });
  process.exit(1);
});