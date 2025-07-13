import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { 
  PredictiveModel, 
  PredictionResult, 
  AnomalyDetectionResult, 
  OptimizationRecommendation,
  TimeSeriesData
} from '../core/PredictiveEngine';

export class PredictionStorage {
  private pool: Pool;
  private initialized = false;

  constructor(private config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
  }) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.createTables();
      await this.createIndexes();
      this.initialized = true;
      logger.info('Prediction storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize prediction storage', { error: error.message });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create predictive models table
      await client.query(`
        CREATE TABLE IF NOT EXISTS predictive_models (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          target VARCHAR(255) NOT NULL,
          features JSONB NOT NULL DEFAULT '[]',
          hyperparameters JSONB NOT NULL DEFAULT '{}',
          performance JSONB NOT NULL DEFAULT '{}',
          training_data JSONB NOT NULL DEFAULT '{}',
          validation_data JSONB NOT NULL DEFAULT '{}',
          deployment JSONB NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      // Create predictions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS predictions (
          id UUID PRIMARY KEY,
          model_id UUID NOT NULL,
          model_type VARCHAR(50) NOT NULL,
          timestamp BIGINT NOT NULL,
          predicted_value DECIMAL(15,6) NOT NULL,
          confidence DECIMAL(5,4) NOT NULL,
          prediction_interval JSONB NOT NULL,
          horizon INTEGER NOT NULL DEFAULT 0,
          features JSONB NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create anomalies table
      await client.query(`
        CREATE TABLE IF NOT EXISTS anomalies (
          id UUID PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          value DECIMAL(15,6) NOT NULL,
          is_anomaly BOOLEAN NOT NULL,
          anomaly_score DECIMAL(10,6) NOT NULL,
          threshold DECIMAL(10,6) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          context JSONB NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create optimization recommendations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS optimization_recommendations (
          id UUID PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          priority VARCHAR(20) NOT NULL,
          title VARCHAR(500) NOT NULL,
          description TEXT NOT NULL,
          impact JSONB NOT NULL DEFAULT '{}',
          implementation JSONB NOT NULL DEFAULT '{}',
          evidence JSONB NOT NULL DEFAULT '{}',
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          implemented_at BIGINT,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at BIGINT NOT NULL
        );
      `);

      // Create forecasts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS forecasts (
          id UUID PRIMARY KEY,
          model_id UUID NOT NULL,
          target VARCHAR(255) NOT NULL,
          predictions JSONB NOT NULL DEFAULT '[]',
          horizon INTEGER NOT NULL,
          accuracy DECIMAL(5,2) NOT NULL,
          trend VARCHAR(20) NOT NULL,
          seasonality JSONB NOT NULL DEFAULT '{}',
          generated_at BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create training data table
      await client.query(`
        CREATE TABLE IF NOT EXISTS training_data (
          id SERIAL PRIMARY KEY,
          target VARCHAR(255) NOT NULL,
          timestamp BIGINT NOT NULL,
          value DECIMAL(15,6) NOT NULL,
          features JSONB NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create model performance history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS model_performance_history (
          id SERIAL PRIMARY KEY,
          model_id UUID NOT NULL,
          timestamp BIGINT NOT NULL,
          accuracy DECIMAL(5,2) NOT NULL,
          mse DECIMAL(15,6) NOT NULL,
          mae DECIMAL(15,6) NOT NULL,
          r2 DECIMAL(8,6) NOT NULL,
          mape DECIMAL(8,6) NOT NULL,
          predictions_count INTEGER NOT NULL DEFAULT 0,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create feature importance table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feature_importance (
          id SERIAL PRIMARY KEY,
          model_id UUID NOT NULL,
          feature_name VARCHAR(255) NOT NULL,
          importance_score DECIMAL(8,6) NOT NULL,
          rank INTEGER NOT NULL,
          calculation_method VARCHAR(50) NOT NULL,
          timestamp BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create model experiments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS model_experiments (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          model_type VARCHAR(50) NOT NULL,
          hyperparameters JSONB NOT NULL DEFAULT '{}',
          dataset_config JSONB NOT NULL DEFAULT '{}',
          results JSONB NOT NULL DEFAULT '{}',
          status VARCHAR(20) NOT NULL,
          started_at BIGINT NOT NULL,
          completed_at BIGINT,
          created_by VARCHAR(255),
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create prediction accuracy tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS prediction_accuracy_tracking (
          id SERIAL PRIMARY KEY,
          prediction_id UUID NOT NULL,
          actual_value DECIMAL(15,6),
          error_value DECIMAL(15,6),
          absolute_error DECIMAL(15,6),
          percentage_error DECIMAL(8,6),
          measured_at BIGINT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      logger.info('Prediction storage tables created successfully');
    } finally {
      client.release();
    }
  }

  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Predictive models indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_models_type ON predictive_models(type);
        CREATE INDEX IF NOT EXISTS idx_models_status ON predictive_models(status);
        CREATE INDEX IF NOT EXISTS idx_models_target ON predictive_models(target);
        CREATE INDEX IF NOT EXISTS idx_models_created_at ON predictive_models(created_at);
      `);

      // Predictions indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_predictions_model_id ON predictions(model_id);
        CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_predictions_model_timestamp ON predictions(model_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);
      `);

      // Anomalies indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp);
        CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
        CREATE INDEX IF NOT EXISTS idx_anomalies_is_anomaly ON anomalies(is_anomaly);
        CREATE INDEX IF NOT EXISTS idx_anomalies_created_at ON anomalies(created_at);
      `);

      // Optimization recommendations indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_recommendations_type ON optimization_recommendations(type);
        CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON optimization_recommendations(priority);
        CREATE INDEX IF NOT EXISTS idx_recommendations_status ON optimization_recommendations(status);
        CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON optimization_recommendations(created_at);
      `);

      // Forecasts indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_forecasts_model_id ON forecasts(model_id);
        CREATE INDEX IF NOT EXISTS idx_forecasts_target ON forecasts(target);
        CREATE INDEX IF NOT EXISTS idx_forecasts_generated_at ON forecasts(generated_at);
      `);

      // Training data indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_training_data_target ON training_data(target);
        CREATE INDEX IF NOT EXISTS idx_training_data_timestamp ON training_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_training_data_target_timestamp ON training_data(target, timestamp);
      `);

      // Model performance history indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_performance_model_id ON model_performance_history(model_id);
        CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON model_performance_history(timestamp);
        CREATE INDEX IF NOT EXISTS idx_performance_model_timestamp ON model_performance_history(model_id, timestamp);
      `);

      // Feature importance indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_feature_importance_model_id ON feature_importance(model_id);
        CREATE INDEX IF NOT EXISTS idx_feature_importance_feature ON feature_importance(feature_name);
        CREATE INDEX IF NOT EXISTS idx_feature_importance_score ON feature_importance(importance_score);
      `);

      // Model experiments indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_experiments_model_type ON model_experiments(model_type);
        CREATE INDEX IF NOT EXISTS idx_experiments_status ON model_experiments(status);
        CREATE INDEX IF NOT EXISTS idx_experiments_started_at ON model_experiments(started_at);
      `);

      // Prediction accuracy tracking indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_accuracy_tracking_prediction_id ON prediction_accuracy_tracking(prediction_id);
        CREATE INDEX IF NOT EXISTS idx_accuracy_tracking_measured_at ON prediction_accuracy_tracking(measured_at);
      `);

      logger.info('Prediction storage indexes created successfully');
    } finally {
      client.release();
    }
  }

  // Model Management

  async storeModel(model: PredictiveModel): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO predictive_models (
          id, name, type, status, target, features, hyperparameters, performance,
          training_data, validation_data, deployment, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        model.id,
        model.name,
        model.type,
        model.status,
        model.target,
        JSON.stringify(model.features),
        JSON.stringify(model.hyperparameters),
        JSON.stringify(model.performance),
        JSON.stringify(model.trainingData),
        JSON.stringify(model.validationData),
        JSON.stringify(model.deployment),
        JSON.stringify(model.metadata),
        model.createdAt,
        model.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async updateModel(model: PredictiveModel): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        UPDATE predictive_models SET
          name = $2,
          type = $3,
          status = $4,
          target = $5,
          features = $6,
          hyperparameters = $7,
          performance = $8,
          training_data = $9,
          validation_data = $10,
          deployment = $11,
          metadata = $12,
          updated_at = $13
        WHERE id = $1
      `, [
        model.id,
        model.name,
        model.type,
        model.status,
        model.target,
        JSON.stringify(model.features),
        JSON.stringify(model.hyperparameters),
        JSON.stringify(model.performance),
        JSON.stringify(model.trainingData),
        JSON.stringify(model.validationData),
        JSON.stringify(model.deployment),
        JSON.stringify(model.metadata),
        model.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getModel(modelId: string): Promise<PredictiveModel | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM predictive_models WHERE id = $1', [modelId]);
      if (result.rows.length === 0) return null;
      
      return this.mapRowToModel(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getModels(filters?: {
    type?: string;
    status?: string;
    target?: string;
    limit?: number;
  }): Promise<PredictiveModel[]> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT * FROM predictive_models WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.type) {
        query += ` AND type = $${paramIndex}`;
        params.push(filters.type);
        paramIndex++;
      }

      if (filters?.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters?.target) {
        query += ` AND target = $${paramIndex}`;
        params.push(filters.target);
        paramIndex++;
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToModel(row));
    } finally {
      client.release();
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete related data
      await client.query('DELETE FROM predictions WHERE model_id = $1', [modelId]);
      await client.query('DELETE FROM forecasts WHERE model_id = $1', [modelId]);
      await client.query('DELETE FROM model_performance_history WHERE model_id = $1', [modelId]);
      await client.query('DELETE FROM feature_importance WHERE model_id = $1', [modelId]);
      
      // Delete the model
      await client.query('DELETE FROM predictive_models WHERE id = $1', [modelId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Predictions

  async storePrediction(prediction: PredictionResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO predictions (
          id, model_id, model_type, timestamp, predicted_value, confidence,
          prediction_interval, horizon, features, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        prediction.id,
        prediction.modelId,
        prediction.modelType,
        prediction.timestamp,
        prediction.predictedValue,
        prediction.confidence,
        JSON.stringify(prediction.predictionInterval),
        prediction.horizon,
        JSON.stringify(prediction.features),
        JSON.stringify(prediction.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async getRecentPredictions(timeRange: number): Promise<PredictionResult[]> {
    const client = await this.pool.connect();
    const cutoff = Date.now() - timeRange;
    
    try {
      const result = await client.query(`
        SELECT * FROM predictions 
        WHERE timestamp >= $1 
        ORDER BY timestamp DESC 
        LIMIT 1000
      `, [cutoff]);
      
      return result.rows.map(row => this.mapRowToPrediction(row));
    } finally {
      client.release();
    }
  }

  async getPredictionsByModel(modelId: string, limit: number = 100): Promise<PredictionResult[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM predictions 
        WHERE model_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [modelId, limit]);
      
      return result.rows.map(row => this.mapRowToPrediction(row));
    } finally {
      client.release();
    }
  }

  // Anomalies

  async storeAnomaly(anomaly: AnomalyDetectionResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO anomalies (
          id, timestamp, value, is_anomaly, anomaly_score, threshold,
          severity, context, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        anomaly.id,
        anomaly.timestamp,
        anomaly.value,
        anomaly.isAnomaly,
        anomaly.anomalyScore,
        anomaly.threshold,
        anomaly.severity,
        JSON.stringify(anomaly.context),
        JSON.stringify(anomaly.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async getRecentAnomalies(timeRange: number): Promise<AnomalyDetectionResult[]> {
    const client = await this.pool.connect();
    const cutoff = Date.now() - timeRange;
    
    try {
      const result = await client.query(`
        SELECT * FROM anomalies 
        WHERE timestamp >= $1 
        ORDER BY timestamp DESC 
        LIMIT 1000
      `, [cutoff]);
      
      return result.rows.map(row => this.mapRowToAnomaly(row));
    } finally {
      client.release();
    }
  }

  // Optimization Recommendations

  async storeRecommendation(recommendation: OptimizationRecommendation): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO optimization_recommendations (
          id, type, priority, title, description, impact, implementation,
          evidence, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        recommendation.id,
        recommendation.type,
        recommendation.priority,
        recommendation.title,
        recommendation.description,
        JSON.stringify(recommendation.impact),
        JSON.stringify(recommendation.implementation),
        JSON.stringify(recommendation.evidence),
        JSON.stringify(recommendation.metadata),
        recommendation.createdAt
      ]);
    } finally {
      client.release();
    }
  }

  async getRecentRecommendations(limit: number = 50): Promise<OptimizationRecommendation[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM optimization_recommendations 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
      
      return result.rows.map(row => this.mapRowToRecommendation(row));
    } finally {
      client.release();
    }
  }

  // Training Data

  async storeTrainingData(data: TimeSeriesData, target: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO training_data (target, timestamp, value, metadata)
        VALUES ($1, $2, $3, $4)
      `, [
        target,
        data.timestamp,
        data.value,
        JSON.stringify(data.metadata || {})
      ]);
    } finally {
      client.release();
    }
  }

  async getRecentTrainingData(target: string, timeRange: number): Promise<TimeSeriesData[]> {
    const client = await this.pool.connect();
    const cutoff = Date.now() - timeRange;
    
    try {
      const result = await client.query(`
        SELECT timestamp, value, metadata 
        FROM training_data 
        WHERE target = $1 AND timestamp >= $2 
        ORDER BY timestamp ASC
      `, [target, cutoff]);
      
      return result.rows.map(row => ({
        timestamp: parseInt(row.timestamp),
        value: parseFloat(row.value),
        metadata: row.metadata
      }));
    } finally {
      client.release();
    }
  }

  // Performance Tracking

  async storeModelPerformance(modelId: string, performance: any): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO model_performance_history (
          model_id, timestamp, accuracy, mse, mae, r2, mape, predictions_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        modelId,
        Date.now(),
        performance.accuracy,
        performance.mse,
        performance.mae,
        performance.r2,
        performance.mape,
        performance.predictions_count || 0
      ]);
    } finally {
      client.release();
    }
  }

  async getModelPerformanceHistory(modelId: string, limit: number = 100): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM model_performance_history 
        WHERE model_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [modelId, limit]);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Data Cleanup

  async cleanup(maxAge: number): Promise<void> {
    const client = await this.pool.connect();
    const cutoffTime = Date.now() - maxAge;
    
    try {
      await client.query('BEGIN');

      // Clean up old predictions
      const predictionsCleanup = await client.query(
        'DELETE FROM predictions WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up old anomalies
      const anomaliesCleanup = await client.query(
        'DELETE FROM anomalies WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up old training data
      const trainingDataCleanup = await client.query(
        'DELETE FROM training_data WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up old performance history
      const performanceCleanup = await client.query(
        'DELETE FROM model_performance_history WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up old forecasts
      const forecastsCleanup = await client.query(
        'DELETE FROM forecasts WHERE generated_at < $1',
        [cutoffTime]
      );

      await client.query('COMMIT');

      logger.info('Prediction storage cleanup completed', {
        deletedPredictions: predictionsCleanup.rowCount,
        deletedAnomalies: anomaliesCleanup.rowCount,
        deletedTrainingData: trainingDataCleanup.rowCount,
        deletedPerformance: performanceCleanup.rowCount,
        deletedForecasts: forecastsCleanup.rowCount
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Prediction storage cleanup failed', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  // Mapping Methods

  private mapRowToModel(row: any): PredictiveModel {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      target: row.target,
      features: row.features,
      hyperparameters: row.hyperparameters,
      performance: row.performance,
      trainingData: row.training_data,
      validationData: row.validation_data,
      deployment: row.deployment,
      metadata: row.metadata,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at)
    };
  }

  private mapRowToPrediction(row: any): PredictionResult {
    return {
      id: row.id,
      modelId: row.model_id,
      modelType: row.model_type,
      timestamp: parseInt(row.timestamp),
      predictedValue: parseFloat(row.predicted_value),
      confidence: parseFloat(row.confidence),
      predictionInterval: row.prediction_interval,
      horizon: row.horizon,
      features: row.features,
      metadata: row.metadata
    };
  }

  private mapRowToAnomaly(row: any): AnomalyDetectionResult {
    return {
      id: row.id,
      timestamp: parseInt(row.timestamp),
      value: parseFloat(row.value),
      isAnomaly: row.is_anomaly,
      anomalyScore: parseFloat(row.anomaly_score),
      threshold: parseFloat(row.threshold),
      severity: row.severity,
      context: row.context,
      metadata: row.metadata
    };
  }

  private mapRowToRecommendation(row: any): OptimizationRecommendation {
    return {
      id: row.id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      description: row.description,
      impact: row.impact,
      implementation: row.implementation,
      evidence: row.evidence,
      metadata: row.metadata,
      createdAt: parseInt(row.created_at)
    };
  }

  async destroy(): Promise<void> {
    await this.pool.end();
    logger.info('Prediction storage connections closed');
  }
}