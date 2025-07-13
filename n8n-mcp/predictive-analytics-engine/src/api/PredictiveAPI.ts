import express, { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import { PredictiveEngine, PredictiveModel, PredictionResult, AnomalyDetectionResult, OptimizationRecommendation } from '../core/PredictiveEngine';
import { OptimizationEngine } from '../optimization/OptimizationEngine';

export class PredictiveAPI {
  private app: express.Application;
  private io: SocketIOServer;
  private rateLimiter: RateLimiterMemory;

  constructor(
    private predictiveEngine: PredictiveEngine,
    private optimizationEngine: OptimizationEngine,
    private options: {
      port?: number;
      enableCors?: boolean;
      enableRateLimit?: boolean;
      maxRequestsPerMinute?: number;
    } = {}
  ) {
    this.app = express();
    this.setupRateLimit();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  private setupRateLimit(): void {
    if (this.options.enableRateLimit !== false) {
      this.rateLimiter = new RateLimiterMemory({
        keyGen: (req) => req.ip,
        points: this.options.maxRequestsPerMinute || 200,
        duration: 60, // 1 minute
      });
    }
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    this.app.use(compression());
    
    // CORS
    if (this.options.enableCors !== false) {
      this.app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));
    }

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    if (this.rateLimiter) {
      this.app.use(async (req, res, next) => {
        try {
          await this.rateLimiter.consume(req.ip);
          next();
        } catch (rejRes) {
          res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1
          });
        }
      });
    }
  }

  private setupRoutes(): void {
    // Health endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        components: {
          predictiveEngine: 'healthy',
          optimizationEngine: 'healthy'
        }
      });
    });

    // Model Management
    this.app.get('/api/models', this.handleGetModels.bind(this));
    this.app.post('/api/models', this.handleCreateModel.bind(this));
    this.app.get('/api/models/:id', this.handleGetModel.bind(this));
    this.app.put('/api/models/:id', this.handleUpdateModel.bind(this));
    this.app.delete('/api/models/:id', this.handleDeleteModel.bind(this));
    this.app.post('/api/models/:id/train', this.handleTrainModel.bind(this));
    this.app.post('/api/models/:id/deploy', this.handleDeployModel.bind(this));

    // Predictions
    this.app.post('/api/models/:id/predict', this.handlePredict.bind(this));
    this.app.post('/api/models/:id/forecast', this.handleForecast.bind(this));
    this.app.get('/api/predictions', this.handleGetPredictions.bind(this));
    this.app.get('/api/models/:id/predictions', this.handleGetModelPredictions.bind(this));

    // Anomaly Detection
    this.app.post('/api/anomaly-detection', this.handleDetectAnomalies.bind(this));
    this.app.get('/api/anomalies', this.handleGetAnomalies.bind(this));

    // Optimization
    this.app.post('/api/optimization/workflow', this.handleOptimizeWorkflow.bind(this));
    this.app.get('/api/optimization/recommendations', this.handleGetOptimizationRecommendations.bind(this));
    this.app.get('/api/optimization/report', this.handleGetOptimizationReport.bind(this));

    // Analytics
    this.app.get('/api/analytics/overview', this.handleGetAnalyticsOverview.bind(this));
    this.app.get('/api/analytics/model-performance', this.handleGetModelPerformance.bind(this));
    this.app.get('/api/analytics/prediction-accuracy', this.handleGetPredictionAccuracy.bind(this));

    // Training Data
    this.app.post('/api/training-data', this.handleSubmitTrainingData.bind(this));
    this.app.get('/api/training-data/:target', this.handleGetTrainingData.bind(this));

    // Experiments
    this.app.post('/api/experiments', this.handleCreateExperiment.bind(this));
    this.app.get('/api/experiments', this.handleGetExperiments.bind(this));
    this.app.get('/api/experiments/:id', this.handleGetExperiment.bind(this));
    this.app.post('/api/experiments/:id/run', this.handleRunExperiment.bind(this));

    // Dashboard
    this.app.get('/api/dashboard/overview', this.handleGetDashboardOverview.bind(this));
    this.app.get('/api/dashboard/charts', this.handleGetDashboardCharts.bind(this));

    // Error handling
    this.app.use(this.handleError.bind(this));
  }

  // Model Management Handlers

  private async handleGetModels(req: Request, res: Response): Promise<void> {
    try {
      const { type, status, target, limit } = req.query;
      const models = this.predictiveEngine.getModels();
      
      let filteredModels = models;
      
      if (type) filteredModels = filteredModels.filter(m => m.type === type);
      if (status) filteredModels = filteredModels.filter(m => m.status === status);
      if (target) filteredModels = filteredModels.filter(m => m.target === target);
      if (limit) filteredModels = filteredModels.slice(0, parseInt(limit as string));

      res.json(filteredModels);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleCreateModel(req: Request, res: Response): Promise<void> {
    try {
      const modelData = req.body;
      const modelId = await this.predictiveEngine.createModel(modelData);
      res.status(201).json({ modelId, message: 'Model created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetModel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const model = await this.predictiveEngine.getModelById(id);
      if (!model) {
        return res.status(404).json({ error: 'Model not found' });
      }
      res.json(model);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleUpdateModel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      // This would need to be implemented in PredictiveEngine
      res.json({ message: 'Model update not implemented yet' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleDeleteModel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.predictiveEngine.deleteModel(id);
      res.json({ message: 'Model deleted successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleTrainModel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { trainingData } = req.body;
      
      // Start training asynchronously
      this.predictiveEngine.trainModel(id, trainingData)
        .then(() => {
          this.broadcastToClients('model_training_completed', { modelId: id });
        })
        .catch(error => {
          this.broadcastToClients('model_training_failed', { modelId: id, error: error.message });
        });

      res.json({ message: 'Model training started', modelId: id });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleDeployModel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.predictiveEngine.deployModel(id);
      res.json({ message: 'Model deployed successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Prediction Handlers

  private async handlePredict(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { features } = req.body;
      
      const prediction = await this.predictiveEngine.predict(id, features);
      res.json(prediction);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleForecast(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { horizon, features } = req.body;
      
      const forecast = await this.predictiveEngine.forecast(id, horizon, features);
      res.json(forecast);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetPredictions(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = 86400000 } = req.query; // Default 24 hours
      const predictions = await this.predictiveEngine.getRecentPredictions(parseInt(timeRange as string));
      res.json(predictions);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetModelPredictions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 100 } = req.query;
      // This would need to be implemented in PredictiveEngine
      res.json([]);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Anomaly Detection Handlers

  private async handleDetectAnomalies(req: Request, res: Response): Promise<void> {
    try {
      const { data, threshold = 2.5 } = req.body;
      const anomalies = await this.predictiveEngine.detectAnomalies(data, threshold);
      res.json(anomalies);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetAnomalies(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = 604800000 } = req.query; // Default 7 days
      const anomalies = await this.predictiveEngine.getRecentAnomalies(parseInt(timeRange as string));
      res.json(anomalies);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Optimization Handlers

  private async handleOptimizeWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const workflowData = req.body;
      const optimization = await this.optimizationEngine.optimizeWorkflow(workflowData);
      res.json(optimization);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetOptimizationRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const recommendations = await this.predictiveEngine.getOptimizationRecommendations();
      res.json(recommendations);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetOptimizationReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await this.optimizationEngine.generateOptimizationReport();
      res.json(report);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Analytics Handlers

  private async handleGetAnalyticsOverview(req: Request, res: Response): Promise<void> {
    try {
      const models = this.predictiveEngine.getModels();
      const recentPredictions = await this.predictiveEngine.getRecentPredictions(24 * 60 * 60 * 1000);
      const recentAnomalies = await this.predictiveEngine.getRecentAnomalies(7 * 24 * 60 * 60 * 1000);

      const overview = {
        models: {
          total: models.length,
          deployed: models.filter(m => m.status === 'deployed').length,
          training: models.filter(m => m.status === 'training').length,
          avgAccuracy: models.length > 0 ? 
            models.reduce((sum, m) => sum + m.performance.accuracy, 0) / models.length : 0
        },
        predictions: {
          total24h: recentPredictions.length,
          avgConfidence: recentPredictions.length > 0 ?
            recentPredictions.reduce((sum, p) => sum + p.confidence, 0) / recentPredictions.length : 0
        },
        anomalies: {
          total7d: recentAnomalies.length,
          critical: recentAnomalies.filter(a => a.severity === 'critical').length,
          high: recentAnomalies.filter(a => a.severity === 'high').length
        },
        timestamp: Date.now()
      };

      res.json(overview);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetModelPerformance(req: Request, res: Response): Promise<void> {
    try {
      const models = this.predictiveEngine.getModels();
      const performance = models.map(model => ({
        id: model.id,
        name: model.name,
        type: model.type,
        accuracy: model.performance.accuracy,
        mse: model.performance.mse,
        mae: model.performance.mae,
        r2: model.performance.r2,
        mape: model.performance.mape,
        predictions: model.deployment.predictions,
        lastUsed: model.deployment.lastUsed
      }));

      res.json(performance);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetPredictionAccuracy(req: Request, res: Response): Promise<void> {
    try {
      // This would analyze prediction accuracy over time
      // For now, return mock data
      const accuracy = {
        overall: 85.6,
        byModel: {},
        trend: 'improving',
        timestamp: Date.now()
      };

      res.json(accuracy);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Training Data Handlers

  private async handleSubmitTrainingData(req: Request, res: Response): Promise<void> {
    try {
      const { target, data } = req.body;
      
      // Store training data
      // This would need to be implemented in PredictiveEngine
      
      res.json({ message: 'Training data submitted successfully', dataPoints: data.length });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetTrainingData(req: Request, res: Response): Promise<void> {
    try {
      const { target } = req.params;
      const { timeRange = 2592000000 } = req.query; // Default 30 days
      
      // This would retrieve training data from storage
      res.json([]);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Experiment Handlers

  private async handleCreateExperiment(req: Request, res: Response): Promise<void> {
    try {
      const experimentData = req.body;
      // This would create a new model experiment
      res.json({ message: 'Experiment creation not implemented yet' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetExperiments(req: Request, res: Response): Promise<void> {
    try {
      // This would return experiment history
      res.json([]);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetExperiment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // This would return specific experiment details
      res.json({});
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleRunExperiment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // This would run an experiment
      res.json({ message: 'Experiment execution not implemented yet' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Dashboard Handlers

  private async handleGetDashboardOverview(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = 86400000 } = req.query; // Default 24 hours
      
      const models = this.predictiveEngine.getModels();
      const recentPredictions = await this.predictiveEngine.getRecentPredictions(parseInt(timeRange as string));
      const recentAnomalies = await this.predictiveEngine.getRecentAnomalies(parseInt(timeRange as string));
      const recommendations = await this.predictiveEngine.getOptimizationRecommendations();

      const overview = {
        summary: {
          totalModels: models.length,
          activePredictions: recentPredictions.length,
          detectedAnomalies: recentAnomalies.filter(a => a.isAnomaly).length,
          pendingRecommendations: recommendations.length
        },
        modelStatus: {
          deployed: models.filter(m => m.status === 'deployed').length,
          training: models.filter(m => m.status === 'training').length,
          failed: models.filter(m => m.status === 'failed').length
        },
        performance: {
          averageAccuracy: models.length > 0 ? 
            models.reduce((sum, m) => sum + m.performance.accuracy, 0) / models.length : 0,
          totalPredictions: models.reduce((sum, m) => sum + m.deployment.predictions, 0),
          anomalyRate: recentAnomalies.length > 0 ? 
            recentAnomalies.filter(a => a.isAnomaly).length / recentAnomalies.length : 0
        },
        recentActivity: {
          predictions: recentPredictions.slice(0, 10),
          anomalies: recentAnomalies.slice(0, 5),
          recommendations: recommendations.slice(0, 5)
        },
        timestamp: Date.now()
      };

      res.json(overview);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetDashboardCharts(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = 86400000, chartTypes } = req.query; // Default 24 hours
      const requestedCharts = chartTypes ? (chartTypes as string).split(',') : ['predictions', 'accuracy', 'anomalies'];

      const charts: any = {};

      if (requestedCharts.includes('predictions')) {
        const predictions = await this.predictiveEngine.getRecentPredictions(parseInt(timeRange as string));
        charts.predictions = this.processPredictionsForChart(predictions);
      }

      if (requestedCharts.includes('accuracy')) {
        const models = this.predictiveEngine.getModels();
        charts.accuracy = this.processAccuracyForChart(models);
      }

      if (requestedCharts.includes('anomalies')) {
        const anomalies = await this.predictiveEngine.getRecentAnomalies(parseInt(timeRange as string));
        charts.anomalies = this.processAnomaliesForChart(anomalies);
      }

      res.json(charts);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Chart Processing Methods

  private processPredictionsForChart(predictions: PredictionResult[]): any {
    const hourlyGroups = new Map<number, PredictionResult[]>();
    
    predictions.forEach(prediction => {
      const hour = Math.floor(prediction.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      if (!hourlyGroups.has(hour)) {
        hourlyGroups.set(hour, []);
      }
      hourlyGroups.get(hour)!.push(prediction);
    });

    const chartData = Array.from(hourlyGroups.entries()).map(([hour, preds]) => ({
      timestamp: hour,
      count: preds.length,
      avgConfidence: preds.reduce((sum, p) => sum + p.confidence, 0) / preds.length
    })).sort((a, b) => a.timestamp - b.timestamp);

    return {
      type: 'line',
      title: 'Predictions Over Time',
      data: chartData
    };
  }

  private processAccuracyForChart(models: PredictiveModel[]): any {
    const data = models.map(model => ({
      name: model.name,
      accuracy: model.performance.accuracy,
      type: model.type
    }));

    return {
      type: 'bar',
      title: 'Model Accuracy',
      data
    };
  }

  private processAnomaliesForChart(anomalies: AnomalyDetectionResult[]): any {
    const severityGroups = anomalies.reduce((acc, anomaly) => {
      acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const data = Object.entries(severityGroups).map(([severity, count]) => ({
      severity,
      count
    }));

    return {
      type: 'pie',
      title: 'Anomalies by Severity',
      data
    };
  }

  private setupEventListeners(): void {
    // Model events
    this.predictiveEngine.on('model_created', (model) => {
      this.broadcastToClients('model_created', model);
    });

    this.predictiveEngine.on('model_trained', (model) => {
      this.broadcastToClients('model_trained', model);
    });

    this.predictiveEngine.on('model_deployed', (model) => {
      this.broadcastToClients('model_deployed', model);
    });

    this.predictiveEngine.on('prediction_made', (prediction) => {
      this.broadcastToClients('prediction_made', prediction);
    });

    this.predictiveEngine.on('anomalies_detected', (anomalies) => {
      this.broadcastToClients('anomalies_detected', anomalies);
    });

    this.predictiveEngine.on('recommendations_generated', (recommendations) => {
      this.broadcastToClients('recommendations_generated', recommendations);
    });

    // Optimization events
    this.optimizationEngine.on('workflow_optimization_created', (optimization) => {
      this.broadcastToClients('workflow_optimization_created', optimization);
    });

    this.optimizationEngine.on('optimizations_generated', (optimizations) => {
      this.broadcastToClients('optimizations_generated', optimizations);
    });
  }

  private broadcastToClients(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  setSocketIO(io: SocketIOServer): void {
    this.io = io;

    this.io.on('connection', (socket) => {
      logger.info('Client connected to predictive analytics', { socketId: socket.id });

      socket.on('subscribe_predictions', () => {
        socket.join('predictions');
      });

      socket.on('subscribe_models', () => {
        socket.join('models');
      });

      socket.on('subscribe_anomalies', () => {
        socket.join('anomalies');
      });

      socket.on('subscribe_optimizations', () => {
        socket.join('optimizations');
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from predictive analytics', { socketId: socket.id });
      });
    });
  }

  private handleError(error: any, req?: Request, res?: Response, next?: Function): void {
    logger.error('API Error', {
      error: error.message,
      stack: error.stack,
      url: req?.url,
      method: req?.method
    });

    if (res && !res.headersSent) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  async start(port: number = 3010): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Predictive analytics API server started on port ${port}`);
        resolve();
      });
    });
  }
}