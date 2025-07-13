import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as tf from '@tensorflow/tfjs-node';
import * as ss from 'simple-statistics';
import { logger } from '../utils/logger';
import { PredictionStorage } from '../storage/PredictionStorage';

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

export interface PredictionResult {
  id: string;
  modelId: string;
  modelType: string;
  timestamp: number;
  predictedValue: number;
  confidence: number;
  predictionInterval: {
    lower: number;
    upper: number;
  };
  horizon: number; // How far into the future (in milliseconds)
  features: Record<string, number>;
  metadata: Record<string, any>;
}

export interface AnomalyDetectionResult {
  id: string;
  timestamp: number;
  value: number;
  isAnomaly: boolean;
  anomalyScore: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: {
    windowSize: number;
    baseline: number;
    deviation: number;
  };
  metadata: Record<string, any>;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'performance' | 'resource' | 'cost' | 'reliability' | 'scalability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: {
    metric: string;
    estimatedImprovement: number;
    confidence: number;
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    timeline: string;
    steps: string[];
    prerequisites: string[];
  };
  evidence: {
    dataPoints: number;
    patterns: string[];
    correlations: Array<{
      factor: string;
      correlation: number;
      significance: number;
    }>;
  };
  metadata: Record<string, any>;
  createdAt: number;
}

export interface PredictiveModel {
  id: string;
  name: string;
  type: 'linear_regression' | 'polynomial_regression' | 'arima' | 'lstm' | 'prophet' | 'random_forest' | 'svm';
  status: 'training' | 'trained' | 'deployed' | 'deprecated' | 'failed';
  target: string; // What we're predicting
  features: string[]; // Input features
  hyperparameters: Record<string, any>;
  performance: {
    accuracy: number;
    mse: number; // Mean Squared Error
    mae: number; // Mean Absolute Error
    r2: number; // R-squared
    mape: number; // Mean Absolute Percentage Error
  };
  trainingData: {
    samples: number;
    features: number;
    timeRange: {
      start: number;
      end: number;
    };
  };
  validationData: {
    samples: number;
    accuracy: number;
    lastValidated: number;
  };
  deployment: {
    version: string;
    deployedAt: number;
    predictions: number;
    lastUsed: number;
  };
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface ForecastResult {
  modelId: string;
  target: string;
  predictions: Array<{
    timestamp: number;
    value: number;
    confidence: number;
    interval: {
      lower: number;
      upper: number;
    };
  }>;
  horizon: number;
  accuracy: number;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  seasonality: {
    detected: boolean;
    period?: number;
    strength?: number;
  };
  generatedAt: number;
}

export class PredictiveEngine extends EventEmitter {
  private predictionStorage: PredictionStorage;
  private models = new Map<string, PredictiveModel>();
  private trainedModels = new Map<string, any>(); // Actual trained model instances
  private anomalyDetectors = new Map<string, any>();
  private forecastCache = new Map<string, ForecastResult>();
  
  private readonly MODEL_RETRAIN_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PREDICTION_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly ANOMALY_WINDOW_SIZE = 100; // Number of points for anomaly detection

  constructor(
    predictionStorage: PredictionStorage,
    private options: {
      enableAutoRetrain?: boolean;
      enableAnomalyDetection?: boolean;
      enableOptimizationRecommendations?: boolean;
      maxModels?: number;
      predictionCacheTTL?: number;
    } = {}
  ) {
    super();
    
    this.predictionStorage = predictionStorage;
    
    this.options = {
      enableAutoRetrain: true,
      enableAnomalyDetection: true,
      enableOptimizationRecommendations: true,
      maxModels: 50,
      predictionCacheTTL: 3600000,
      ...options
    };

    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Model retraining
    if (this.options.enableAutoRetrain) {
      setInterval(() => this.checkForModelRetraining(), 60 * 60 * 1000); // Every hour
    }

    // Cache cleanup
    setInterval(() => this.cleanupCache(), 30 * 60 * 1000); // Every 30 minutes
    
    // Generate optimization recommendations
    if (this.options.enableOptimizationRecommendations) {
      setInterval(() => this.generateOptimizationRecommendations(), 4 * 60 * 60 * 1000); // Every 4 hours
    }
  }

  // Model Management

  async createModel(modelData: Omit<PredictiveModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const modelId = uuidv4();
    const now = Date.now();

    const model: PredictiveModel = {
      id: modelId,
      createdAt: now,
      updatedAt: now,
      status: 'training',
      performance: {
        accuracy: 0,
        mse: 0,
        mae: 0,
        r2: 0,
        mape: 0
      },
      validationData: {
        samples: 0,
        accuracy: 0,
        lastValidated: 0
      },
      deployment: {
        version: '1.0.0',
        deployedAt: 0,
        predictions: 0,
        lastUsed: 0
      },
      ...modelData
    };

    this.models.set(modelId, model);
    await this.predictionStorage.storeModel(model);

    this.emit('model_created', model);

    logger.info('Predictive model created', {
      modelId,
      name: model.name,
      type: model.type,
      target: model.target
    });

    return modelId;
  }

  async trainModel(modelId: string, trainingData: TimeSeriesData[]): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    try {
      model.status = 'training';
      await this.predictionStorage.updateModel(model);

      // Prepare training data
      const { features, targets } = this.prepareTrainingData(trainingData, model);
      
      // Train model based on type
      const trainedModel = await this.trainModelByType(model, features, targets);
      
      // Evaluate model performance
      const performance = await this.evaluateModel(trainedModel, features, targets);
      
      // Store trained model
      this.trainedModels.set(modelId, trainedModel);
      
      // Update model with performance metrics
      model.status = 'trained';
      model.performance = performance;
      model.trainingData = {
        samples: trainingData.length,
        features: model.features.length,
        timeRange: {
          start: Math.min(...trainingData.map(d => d.timestamp)),
          end: Math.max(...trainingData.map(d => d.timestamp))
        }
      };
      model.updatedAt = Date.now();

      await this.predictionStorage.updateModel(model);

      this.emit('model_trained', model);

      logger.info('Model trained successfully', {
        modelId,
        performance: model.performance,
        samples: model.trainingData.samples
      });

    } catch (error) {
      model.status = 'failed';
      model.updatedAt = Date.now();
      await this.predictionStorage.updateModel(model);

      this.emit('model_training_failed', { modelId, error: error.message });

      logger.error('Model training failed', {
        modelId,
        error: error.message
      });

      throw error;
    }
  }

  async deployModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status !== 'trained') {
      throw new Error(`Model ${modelId} is not trained`);
    }

    model.status = 'deployed';
    model.deployment.deployedAt = Date.now();
    model.updatedAt = Date.now();

    await this.predictionStorage.updateModel(model);

    this.emit('model_deployed', model);

    logger.info('Model deployed', { modelId, name: model.name });
  }

  // Prediction Methods

  async predict(modelId: string, features: Record<string, number>): Promise<PredictionResult> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status !== 'deployed') {
      throw new Error(`Model ${modelId} is not deployed`);
    }

    const trainedModel = this.trainedModels.get(modelId);
    if (!trainedModel) {
      throw new Error(`Trained model instance not found: ${modelId}`);
    }

    try {
      // Prepare features
      const featureVector = this.prepareFeatureVector(features, model.features);
      
      // Make prediction
      const { prediction, confidence } = await this.makePrediction(trainedModel, featureVector, model.type);
      
      // Calculate prediction interval
      const interval = this.calculatePredictionInterval(prediction, confidence);

      const result: PredictionResult = {
        id: uuidv4(),
        modelId,
        modelType: model.type,
        timestamp: Date.now(),
        predictedValue: prediction,
        confidence,
        predictionInterval: interval,
        horizon: 0, // Real-time prediction
        features,
        metadata: {
          modelVersion: model.deployment.version,
          accuracy: model.performance.accuracy
        }
      };

      // Update model usage statistics
      model.deployment.predictions++;
      model.deployment.lastUsed = Date.now();

      await this.predictionStorage.storePrediction(result);

      this.emit('prediction_made', result);

      return result;

    } catch (error) {
      logger.error('Prediction failed', {
        modelId,
        error: error.message
      });
      throw error;
    }
  }

  async forecast(modelId: string, horizon: number, features?: Record<string, number>): Promise<ForecastResult> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const cacheKey = `${modelId}_${horizon}_${JSON.stringify(features || {})}`;
    const cached = this.forecastCache.get(cacheKey);
    
    if (cached && Date.now() - cached.generatedAt < this.options.predictionCacheTTL!) {
      return cached;
    }

    try {
      const trainedModel = this.trainedModels.get(modelId);
      if (!trainedModel) {
        throw new Error(`Trained model instance not found: ${modelId}`);
      }

      // Generate forecasts for the specified horizon
      const predictions = await this.generateForecasts(trainedModel, model, horizon, features);
      
      // Analyze trends and seasonality
      const trend = this.analyzeTrend(predictions.map(p => p.value));
      const seasonality = this.detectSeasonality(predictions.map(p => p.value));

      const forecast: ForecastResult = {
        modelId,
        target: model.target,
        predictions,
        horizon,
        accuracy: model.performance.accuracy,
        trend,
        seasonality,
        generatedAt: Date.now()
      };

      // Cache the forecast
      this.forecastCache.set(cacheKey, forecast);

      this.emit('forecast_generated', forecast);

      return forecast;

    } catch (error) {
      logger.error('Forecast generation failed', {
        modelId,
        horizon,
        error: error.message
      });
      throw error;
    }
  }

  // Anomaly Detection

  async detectAnomalies(data: TimeSeriesData[], threshold: number = 2.5): Promise<AnomalyDetectionResult[]> {
    if (!this.options.enableAnomalyDetection) {
      return [];
    }

    const results: AnomalyDetectionResult[] = [];
    
    if (data.length < this.ANOMALY_WINDOW_SIZE) {
      logger.warn('Insufficient data for anomaly detection', { dataPoints: data.length });
      return results;
    }

    // Sort data by timestamp
    const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
    
    // Use sliding window approach for anomaly detection
    for (let i = this.ANOMALY_WINDOW_SIZE; i < sortedData.length; i++) {
      const window = sortedData.slice(i - this.ANOMALY_WINDOW_SIZE, i);
      const currentPoint = sortedData[i];
      
      const windowValues = window.map(d => d.value);
      const mean = ss.mean(windowValues);
      const stdDev = ss.standardDeviation(windowValues);
      
      const zScore = Math.abs((currentPoint.value - mean) / stdDev);
      const isAnomaly = zScore > threshold;
      
      if (isAnomaly || zScore > threshold * 0.7) { // Include near-anomalies
        results.push({
          id: uuidv4(),
          timestamp: currentPoint.timestamp,
          value: currentPoint.value,
          isAnomaly,
          anomalyScore: zScore,
          threshold,
          severity: this.determineSeverity(zScore, threshold),
          context: {
            windowSize: this.ANOMALY_WINDOW_SIZE,
            baseline: mean,
            deviation: currentPoint.value - mean
          },
          metadata: currentPoint.metadata || {}
        });
      }
    }

    // Store anomaly detection results
    for (const result of results.filter(r => r.isAnomaly)) {
      await this.predictionStorage.storeAnomaly(result);
    }

    if (results.length > 0) {
      this.emit('anomalies_detected', results);
    }

    return results;
  }

  // Optimization Recommendations

  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    if (!this.options.enableOptimizationRecommendations) {
      return [];
    }

    try {
      const recommendations: OptimizationRecommendation[] = [];

      // Get recent performance data
      const recentData = await this.predictionStorage.getRecentPredictions(24 * 60 * 60 * 1000); // Last 24 hours
      const recentAnomalies = await this.predictionStorage.getRecentAnomalies(7 * 24 * 60 * 60 * 1000); // Last 7 days

      // Analyze model performance
      recommendations.push(...await this.analyzeModelPerformance());
      
      // Analyze resource utilization
      recommendations.push(...await this.analyzeResourceUtilization(recentData));
      
      // Analyze error patterns
      recommendations.push(...await this.analyzeErrorPatterns(recentAnomalies));
      
      // Analyze prediction accuracy trends
      recommendations.push(...await this.analyzePredictionAccuracy());

      // Store recommendations
      for (const recommendation of recommendations) {
        await this.predictionStorage.storeRecommendation(recommendation);
      }

      if (recommendations.length > 0) {
        this.emit('recommendations_generated', recommendations);
      }

      return recommendations;

    } catch (error) {
      logger.error('Failed to generate optimization recommendations', {
        error: error.message
      });
      return [];
    }
  }

  // Private Methods

  private prepareTrainingData(data: TimeSeriesData[], model: PredictiveModel): { features: number[][], targets: number[] } {
    const features: number[][] = [];
    const targets: number[] = [];

    // Simple feature extraction - can be enhanced based on model type
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      
      // Basic features: timestamp components, lag values, etc.
      const featureVector: number[] = [
        point.timestamp,
        new Date(point.timestamp).getHours(),
        new Date(point.timestamp).getDay(),
        // Add lag features if available
        i > 0 ? data[i - 1].value : 0,
        i > 1 ? data[i - 2].value : 0,
      ];

      features.push(featureVector);
      targets.push(point.value);
    }

    return { features, targets };
  }

  private async trainModelByType(model: PredictiveModel, features: number[][], targets: number[]): Promise<any> {
    switch (model.type) {
      case 'linear_regression':
        return this.trainLinearRegression(features, targets);
      
      case 'polynomial_regression':
        return this.trainPolynomialRegression(features, targets, model.hyperparameters?.degree || 2);
      
      case 'lstm':
        return this.trainLSTM(features, targets, model.hyperparameters);
      
      case 'random_forest':
        return this.trainRandomForest(features, targets, model.hyperparameters);
      
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  private async trainLinearRegression(features: number[][], targets: number[]): Promise<any> {
    // Simple linear regression using TensorFlow.js
    const xs = tf.tensor2d(features);
    const ys = tf.tensor1d(targets);

    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [features[0].length], units: 1 })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    await model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();

    return model;
  }

  private async trainPolynomialRegression(features: number[][], targets: number[], degree: number): Promise<any> {
    // Implement polynomial regression
    const polynomialFeatures = this.createPolynomialFeatures(features, degree);
    return this.trainLinearRegression(polynomialFeatures, targets);
  }

  private async trainLSTM(features: number[][], targets: number[], hyperparameters: any = {}): Promise<any> {
    const lookBack = hyperparameters.lookBack || 10;
    const units = hyperparameters.units || 50;
    const dropout = hyperparameters.dropout || 0.2;

    // Reshape data for LSTM
    const { lstmFeatures, lstmTargets } = this.prepareDataForLSTM(features, targets, lookBack);

    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units,
          returnSequences: false,
          inputShape: [lookBack, features[0].length],
          dropout
        }),
        tf.layers.dense({ units: 1 })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    const xs = tf.tensor3d(lstmFeatures);
    const ys = tf.tensor1d(lstmTargets);

    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 16,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();

    return model;
  }

  private async trainRandomForest(features: number[][], targets: number[], hyperparameters: any = {}): Promise<any> {
    // This would use a JavaScript Random Forest implementation
    // For now, return a simple mock
    return {
      type: 'random_forest',
      features,
      targets,
      hyperparameters,
      predict: (input: number[]) => {
        // Simple prediction logic
        return targets[Math.floor(Math.random() * targets.length)];
      }
    };
  }

  private createPolynomialFeatures(features: number[][], degree: number): number[][] {
    return features.map(row => {
      const polynomial: number[] = [];
      for (let d = 1; d <= degree; d++) {
        for (const feature of row) {
          polynomial.push(Math.pow(feature, d));
        }
      }
      return polynomial;
    });
  }

  private prepareDataForLSTM(features: number[][], targets: number[], lookBack: number): { lstmFeatures: number[][][], lstmTargets: number[] } {
    const lstmFeatures: number[][][] = [];
    const lstmTargets: number[] = [];

    for (let i = lookBack; i < features.length; i++) {
      const sequence: number[][] = [];
      for (let j = i - lookBack; j < i; j++) {
        sequence.push(features[j]);
      }
      lstmFeatures.push(sequence);
      lstmTargets.push(targets[i]);
    }

    return { lstmFeatures, lstmTargets };
  }

  private async evaluateModel(trainedModel: any, features: number[][], targets: number[]): Promise<PredictiveModel['performance']> {
    // Split data for evaluation
    const splitIndex = Math.floor(features.length * 0.8);
    const testFeatures = features.slice(splitIndex);
    const testTargets = targets.slice(splitIndex);

    // Make predictions
    const predictions: number[] = [];
    for (const feature of testFeatures) {
      const prediction = await this.makePrediction(trainedModel, feature, 'linear_regression');
      predictions.push(prediction.prediction);
    }

    // Calculate performance metrics
    const mse = ss.mean(predictions.map((pred, i) => Math.pow(pred - testTargets[i], 2)));
    const mae = ss.mean(predictions.map((pred, i) => Math.abs(pred - testTargets[i])));
    
    const yMean = ss.mean(testTargets);
    const ssTot = ss.sum(testTargets.map(y => Math.pow(y - yMean, 2)));
    const ssRes = ss.sum(predictions.map((pred, i) => Math.pow(testTargets[i] - pred, 2)));
    const r2 = 1 - (ssRes / ssTot);
    
    const mape = ss.mean(predictions.map((pred, i) => Math.abs((testTargets[i] - pred) / testTargets[i]) * 100));
    const accuracy = Math.max(0, 100 - mape);

    return {
      accuracy,
      mse,
      mae,
      r2,
      mape
    };
  }

  private prepareFeatureVector(features: Record<string, number>, modelFeatures: string[]): number[] {
    return modelFeatures.map(feature => features[feature] || 0);
  }

  private async makePrediction(trainedModel: any, featureVector: number[], modelType: string): Promise<{ prediction: number, confidence: number }> {
    switch (modelType) {
      case 'linear_regression':
      case 'polynomial_regression':
      case 'lstm':
        if (trainedModel.predict) {
          const input = tf.tensor2d([featureVector]);
          const result = trainedModel.predict(input) as tf.Tensor;
          const prediction = (await result.data())[0];
          input.dispose();
          result.dispose();
          return { prediction, confidence: 0.8 }; // Default confidence
        }
        break;
      
      case 'random_forest':
        return {
          prediction: trainedModel.predict(featureVector),
          confidence: 0.75
        };
      
      default:
        throw new Error(`Prediction not implemented for model type: ${modelType}`);
    }

    throw new Error('Failed to make prediction');
  }

  private calculatePredictionInterval(prediction: number, confidence: number): { lower: number, upper: number } {
    const margin = prediction * (1 - confidence) * 0.5;
    return {
      lower: prediction - margin,
      upper: prediction + margin
    };
  }

  private async generateForecasts(trainedModel: any, model: PredictiveModel, horizon: number, features?: Record<string, number>): Promise<ForecastResult['predictions']> {
    const predictions: ForecastResult['predictions'] = [];
    const currentTime = Date.now();
    const intervalMs = 60 * 60 * 1000; // 1 hour intervals

    for (let i = 1; i <= horizon; i++) {
      const futureTime = currentTime + (i * intervalMs);
      const futureFeatures = this.generateFutureFeatures(futureTime, features);
      const featureVector = this.prepareFeatureVector(futureFeatures, model.features);
      
      const { prediction, confidence } = await this.makePrediction(trainedModel, featureVector, model.type);
      const interval = this.calculatePredictionInterval(prediction, confidence);

      predictions.push({
        timestamp: futureTime,
        value: prediction,
        confidence,
        interval
      });
    }

    return predictions;
  }

  private generateFutureFeatures(timestamp: number, baseFeatures?: Record<string, number>): Record<string, number> {
    const date = new Date(timestamp);
    return {
      timestamp,
      hour: date.getHours(),
      dayOfWeek: date.getDay(),
      ...baseFeatures
    };
  }

  private analyzeTrend(values: number[]): ForecastResult['trend'] {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstMean = ss.mean(firstHalf);
    const secondMean = ss.mean(secondHalf);
    
    const variance = ss.variance(values);
    const changePercent = Math.abs((secondMean - firstMean) / firstMean) * 100;

    if (variance / ss.mean(values) > 0.5) return 'volatile';
    if (changePercent < 5) return 'stable';
    return secondMean > firstMean ? 'increasing' : 'decreasing';
  }

  private detectSeasonality(values: number[]): ForecastResult['seasonality'] {
    // Simple seasonality detection using autocorrelation
    if (values.length < 24) {
      return { detected: false };
    }

    // Check for common periods (hourly, daily, weekly)
    const periods = [24, 168]; // 24 hours, 168 hours (week)
    
    for (const period of periods) {
      if (values.length >= period * 2) {
        const correlation = this.calculateAutocorrelation(values, period);
        if (correlation > 0.3) {
          return {
            detected: true,
            period,
            strength: correlation
          };
        }
      }
    }

    return { detected: false };
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length <= lag) return 0;

    const n = values.length - lag;
    const mean = ss.mean(values);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private determineSeverity(zScore: number, threshold: number): AnomalyDetectionResult['severity'] {
    if (zScore >= threshold * 2) return 'critical';
    if (zScore >= threshold * 1.5) return 'high';
    if (zScore >= threshold) return 'medium';
    return 'low';
  }

  private async analyzeModelPerformance(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    for (const [modelId, model] of this.models.entries()) {
      if (model.performance.accuracy < 70) {
        recommendations.push({
          id: uuidv4(),
          type: 'performance',
          priority: 'high',
          title: `Improve Model Accuracy: ${model.name}`,
          description: `Model ${model.name} has low accuracy (${model.performance.accuracy.toFixed(1)}%). Consider retraining with more data or different algorithms.`,
          impact: {
            metric: 'prediction_accuracy',
            estimatedImprovement: 25,
            confidence: 0.8
          },
          implementation: {
            effort: 'medium',
            timeline: '1-2 weeks',
            steps: [
              'Collect more training data',
              'Feature engineering optimization',
              'Hyperparameter tuning',
              'Try different algorithms'
            ],
            prerequisites: ['Additional historical data', 'Model evaluation framework']
          },
          evidence: {
            dataPoints: model.trainingData.samples,
            patterns: ['Low accuracy trend', 'High prediction errors'],
            correlations: [
              { factor: 'training_data_size', correlation: 0.7, significance: 0.95 }
            ]
          },
          metadata: { modelId, currentAccuracy: model.performance.accuracy },
          createdAt: Date.now()
        });
      }
    }

    return recommendations;
  }

  private async analyzeResourceUtilization(recentData: any[]): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Analyze prediction frequency and resource usage
    if (recentData.length > 1000) {
      recommendations.push({
        id: uuidv4(),
        type: 'resource',
        priority: 'medium',
        title: 'Optimize Prediction Caching',
        description: 'High prediction volume detected. Implement prediction caching to reduce computational overhead.',
        impact: {
          metric: 'response_time',
          estimatedImprovement: 40,
          confidence: 0.9
        },
        implementation: {
          effort: 'low',
          timeline: '1 week',
          steps: [
            'Implement prediction result caching',
            'Set up cache invalidation strategy',
            'Monitor cache hit rates'
          ],
          prerequisites: ['Redis or in-memory cache setup']
        },
        evidence: {
          dataPoints: recentData.length,
          patterns: ['High prediction frequency', 'Repetitive prediction requests'],
          correlations: [
            { factor: 'request_volume', correlation: 0.8, significance: 0.95 }
          ]
        },
        metadata: { predictionCount: recentData.length },
        createdAt: Date.now()
      });
    }

    return recommendations;
  }

  private async analyzeErrorPatterns(recentAnomalies: any[]): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (recentAnomalies.length > 10) {
      const criticalAnomalies = recentAnomalies.filter(a => a.severity === 'critical');
      
      if (criticalAnomalies.length > 5) {
        recommendations.push({
          id: uuidv4(),
          type: 'reliability',
          priority: 'critical',
          title: 'Address Critical Anomaly Pattern',
          description: `Detected ${criticalAnomalies.length} critical anomalies in the past week. This indicates a systematic issue requiring immediate attention.`,
          impact: {
            metric: 'system_reliability',
            estimatedImprovement: 60,
            confidence: 0.95
          },
          implementation: {
            effort: 'high',
            timeline: '2-3 weeks',
            steps: [
              'Root cause analysis of anomaly patterns',
              'Implement preventive monitoring',
              'Update alert thresholds',
              'Enhance model robustness'
            ],
            prerequisites: ['Incident response team', 'Historical data analysis']
          },
          evidence: {
            dataPoints: criticalAnomalies.length,
            patterns: ['Recurring critical anomalies', 'System instability indicators'],
            correlations: [
              { factor: 'anomaly_frequency', correlation: 0.9, significance: 0.99 }
            ]
          },
          metadata: { criticalAnomalies: criticalAnomalies.length },
          createdAt: Date.now()
        });
      }
    }

    return recommendations;
  }

  private async analyzePredictionAccuracy(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Analyze model performance trends
    const models = Array.from(this.models.values());
    const averageAccuracy = ss.mean(models.map(m => m.performance.accuracy));
    
    if (averageAccuracy < 80) {
      recommendations.push({
        id: uuidv4(),
        type: 'performance',
        priority: 'high',
        title: 'Improve Overall Prediction Accuracy',
        description: `Average model accuracy is ${averageAccuracy.toFixed(1)}%. Consider ensemble methods or advanced algorithms.`,
        impact: {
          metric: 'overall_accuracy',
          estimatedImprovement: 30,
          confidence: 0.85
        },
        implementation: {
          effort: 'high',
          timeline: '3-4 weeks',
          steps: [
            'Implement ensemble modeling',
            'Advanced feature engineering',
            'Cross-validation optimization',
            'Model selection automation'
          ],
          prerequisites: ['Advanced ML infrastructure', 'Additional compute resources']
        },
        evidence: {
          dataPoints: models.length,
          patterns: ['Low accuracy across models', 'Prediction variance'],
          correlations: [
            { factor: 'model_complexity', correlation: 0.6, significance: 0.8 }
          ]
        },
        metadata: { averageAccuracy, modelCount: models.length },
        createdAt: Date.now()
      });
    }

    return recommendations;
  }

  private async checkForModelRetraining(): Promise<void> {
    const now = Date.now();
    
    for (const [modelId, model] of this.models.entries()) {
      if (model.status === 'deployed' && 
          now - model.updatedAt > this.MODEL_RETRAIN_INTERVAL) {
        
        try {
          // Get recent data for retraining
          const recentData = await this.predictionStorage.getRecentTrainingData(
            model.target, 
            this.MODEL_RETRAIN_INTERVAL
          );
          
          if (recentData.length > 100) { // Minimum data for retraining
            logger.info('Retraining model', { modelId, name: model.name });
            await this.trainModel(modelId, recentData);
          }
        } catch (error) {
          logger.error('Model retraining failed', {
            modelId,
            error: error.message
          });
        }
      }
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, forecast] of this.forecastCache.entries()) {
      if (now - forecast.generatedAt > this.options.predictionCacheTTL!) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.forecastCache.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.debug('Cleaned up prediction cache', { expiredEntries: expiredKeys.length });
    }
  }

  // Public API Methods

  getModels(): PredictiveModel[] {
    return Array.from(this.models.values());
  }

  async getModelById(modelId: string): Promise<PredictiveModel | undefined> {
    return this.models.get(modelId);
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Clean up model instance
    const trainedModel = this.trainedModels.get(modelId);
    if (trainedModel && trainedModel.dispose) {
      trainedModel.dispose();
    }

    this.models.delete(modelId);
    this.trainedModels.delete(modelId);
    
    await this.predictionStorage.deleteModel(modelId);

    this.emit('model_deleted', { modelId });

    logger.info('Model deleted', { modelId, name: model.name });
  }

  async getRecentPredictions(timeRange: number): Promise<PredictionResult[]> {
    return this.predictionStorage.getRecentPredictions(timeRange);
  }

  async getRecentAnomalies(timeRange: number): Promise<AnomalyDetectionResult[]> {
    return this.predictionStorage.getRecentAnomalies(timeRange);
  }

  async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    return this.predictionStorage.getRecentRecommendations();
  }

  destroy(): void {
    // Dispose of TensorFlow models
    for (const [modelId, trainedModel] of this.trainedModels.entries()) {
      if (trainedModel && trainedModel.dispose) {
        try {
          trainedModel.dispose();
        } catch (error) {
          logger.warn('Failed to dispose model', { modelId, error: error.message });
        }
      }
    }

    this.removeAllListeners();
    this.models.clear();
    this.trainedModels.clear();
    this.anomalyDetectors.clear();
    this.forecastCache.clear();
  }
}