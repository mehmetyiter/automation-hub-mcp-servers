import { EventEmitter } from 'events';
import { CircuitBreaker, CircuitBreakerConfig, CircuitState, CircuitBreakerOptions } from './circuit-breaker.js';

export interface PredictiveConfig extends CircuitBreakerConfig {
  predictionEnabled: boolean;
  predictionWindow: number;          // Time window for predictions (ms)
  predictionSamples: number;         // Minimum samples for prediction
  anomalyThreshold: number;          // Z-score threshold for anomaly detection
  trendSensitivity: number;          // Sensitivity to trend changes (0-1)
  preemptiveOpenThreshold: number;   // Confidence threshold to open preemptively (0-1)
  adaptiveThresholds: boolean;       // Enable adaptive threshold adjustment
}

export interface PerformanceMetric {
  timestamp: number;
  responseTime: number;
  success: boolean;
  errorType?: string;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
    connections?: number;
  };
}

export interface PredictionResult {
  failureProbability: number;
  expectedResponseTime: number;
  anomalyScore: number;
  trend: 'improving' | 'stable' | 'degrading' | 'critical';
  confidence: number;
  recommendations: string[];
  predictedFailureTime?: number;
}

export interface AdaptiveThresholds {
  responseTime: { p50: number; p95: number; p99: number };
  errorRate: number;
  adaptedAt: Date;
}

export class PredictiveCircuitBreaker extends CircuitBreaker {
  private metrics: PerformanceMetric[] = [];
  private predictions: PredictionResult[] = [];
  private adaptiveThresholds?: AdaptiveThresholds;
  private predictionInterval?: NodeJS.Timer;
  private config: PredictiveConfig;
  
  // Statistical tracking
  private movingAverages: {
    responseTime: number[];
    errorRate: number[];
    resourceUsage: number[];
  } = {
    responseTime: [],
    errorRate: [],
    resourceUsage: []
  };
  
  // Machine learning model state (simplified)
  private modelWeights = {
    responseTimeWeight: 0.3,
    errorRateWeight: 0.4,
    trendWeight: 0.2,
    resourceWeight: 0.1
  };
  
  constructor(options: CircuitBreakerOptions & { config?: Partial<PredictiveConfig> } = {}) {
    super(options);
    
    this.config = {
      ...this.config,
      predictionEnabled: true,
      predictionWindow: 300000,      // 5 minutes
      predictionSamples: 20,
      anomalyThreshold: 2.5,
      trendSensitivity: 0.7,
      preemptiveOpenThreshold: 0.8,
      adaptiveThresholds: true,
      ...options.config
    } as PredictiveConfig;
    
    if (this.config.predictionEnabled) {
      this.startPredictionEngine();
    }
    
    console.log(`🔮 Predictive circuit breaker '${this.getName()}' initialized`);
  }
  
  private startPredictionEngine(): void {
    this.predictionInterval = setInterval(() => {
      this.performPrediction();
    }, 10000); // Predict every 10 seconds
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const resourceSnapshot = this.captureResourceSnapshot();
    
    try {
      // Check predictions before executing
      if (this.shouldBlockBasedOnPrediction()) {
        const error = new Error(`Circuit breaker '${this.getName()}' preemptively opened due to failure prediction`);
        this.emit('predictive-block', error);
        throw error;
      }
      
      const result = await super.execute(operation);
      
      // Record success metric
      this.recordMetric({
        timestamp: startTime,
        responseTime: Date.now() - startTime,
        success: true,
        resourceUsage: resourceSnapshot
      });
      
      return result;
      
    } catch (error) {
      // Record failure metric
      this.recordMetric({
        timestamp: startTime,
        responseTime: Date.now() - startTime,
        success: false,
        errorType: this.classifyError(error as Error),
        resourceUsage: resourceSnapshot
      });
      
      throw error;
    }
  }
  
  private shouldBlockBasedOnPrediction(): boolean {
    if (!this.config.predictionEnabled || this.getState() !== CircuitState.CLOSED) {
      return false;
    }
    
    const latestPrediction = this.predictions[this.predictions.length - 1];
    if (!latestPrediction) {
      return false;
    }
    
    // Check if we should preemptively open based on predictions
    if (latestPrediction.failureProbability >= this.config.preemptiveOpenThreshold &&
        latestPrediction.confidence >= 0.7) {
      console.warn(`⚠️ ${this.getName()}: High failure probability detected (${(latestPrediction.failureProbability * 100).toFixed(1)}%)`);
      
      // Transition to open state preemptively
      this.transitionToOpen();
      return true;
    }
    
    return false;
  }
  
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only metrics within prediction window
    const cutoff = Date.now() - this.config.predictionWindow;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    // Update moving averages
    this.updateMovingAverages();
    
    // Adapt thresholds if enabled
    if (this.config.adaptiveThresholds && this.metrics.length >= this.config.predictionSamples) {
      this.adaptThresholds();
    }
  }
  
  private updateMovingAverages(): void {
    const windowSize = 10;
    
    // Response time moving average
    const recentResponseTimes = this.metrics.slice(-windowSize).map(m => m.responseTime);
    if (recentResponseTimes.length > 0) {
      const avg = recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length;
      this.movingAverages.responseTime.push(avg);
      if (this.movingAverages.responseTime.length > windowSize) {
        this.movingAverages.responseTime.shift();
      }
    }
    
    // Error rate moving average
    const recentMetrics = this.metrics.slice(-windowSize);
    if (recentMetrics.length > 0) {
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
      this.movingAverages.errorRate.push(errorRate);
      if (this.movingAverages.errorRate.length > windowSize) {
        this.movingAverages.errorRate.shift();
      }
    }
    
    // Resource usage moving average
    const recentResources = this.metrics.slice(-windowSize)
      .filter(m => m.resourceUsage)
      .map(m => {
        const r = m.resourceUsage!;
        return (r.cpu || 0) * 0.4 + (r.memory || 0) * 0.4 + (r.connections || 0) * 0.2;
      });
    
    if (recentResources.length > 0) {
      const avg = recentResources.reduce((a, b) => a + b, 0) / recentResources.length;
      this.movingAverages.resourceUsage.push(avg);
      if (this.movingAverages.resourceUsage.length > windowSize) {
        this.movingAverages.resourceUsage.shift();
      }
    }
  }
  
  private performPrediction(): void {
    if (this.metrics.length < this.config.predictionSamples) {
      return;
    }
    
    const prediction = this.predictFailure();
    this.predictions.push(prediction);
    
    // Keep only recent predictions
    if (this.predictions.length > 100) {
      this.predictions = this.predictions.slice(-100);
    }
    
    // Emit prediction event
    this.emit('prediction', prediction);
    
    // Log significant predictions
    if (prediction.failureProbability > 0.7 || prediction.trend === 'critical') {
      console.warn(`🔮 ${this.getName()}: Critical prediction - ${JSON.stringify({
        probability: `${(prediction.failureProbability * 100).toFixed(1)}%`,
        trend: prediction.trend,
        anomalyScore: prediction.anomalyScore.toFixed(2)
      })}`);
    }
  }
  
  private predictFailure(): PredictionResult {
    const recentMetrics = this.metrics.slice(-this.config.predictionSamples);
    
    // Calculate basic statistics
    const stats = this.calculateStatistics(recentMetrics);
    
    // Detect anomalies
    const anomalyScore = this.detectAnomalies(stats);
    
    // Analyze trends
    const trend = this.analyzeTrend();
    
    // Calculate failure probability using weighted factors
    const failureProbability = this.calculateFailureProbability(stats, anomalyScore, trend);
    
    // Predict response time
    const expectedResponseTime = this.predictResponseTime();
    
    // Calculate confidence based on data quality and consistency
    const confidence = this.calculatePredictionConfidence(recentMetrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(failureProbability, trend, anomalyScore);
    
    // Predict time to failure if trend is degrading
    const predictedFailureTime = trend === 'degrading' || trend === 'critical' 
      ? this.predictTimeToFailure(stats, trend) 
      : undefined;
    
    return {
      failureProbability,
      expectedResponseTime,
      anomalyScore,
      trend,
      confidence,
      recommendations,
      predictedFailureTime
    };
  }
  
  private calculateStatistics(metrics: PerformanceMetric[]): any {
    const responseTimes = metrics.map(m => m.responseTime);
    const errorRate = metrics.filter(m => !m.success).length / metrics.length;
    
    return {
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      stdDevResponseTime: this.calculateStdDev(responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      errorRate,
      errorTypes: this.countErrorTypes(metrics),
      resourcePressure: this.calculateResourcePressure(metrics)
    };
  }
  
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private detectAnomalies(stats: any): number {
    // Use z-score for anomaly detection
    const recentAvg = this.movingAverages.responseTime[this.movingAverages.responseTime.length - 1] || 0;
    const historicalAvg = this.movingAverages.responseTime.reduce((a, b) => a + b, 0) / this.movingAverages.responseTime.length || recentAvg;
    
    const zScore = stats.stdDevResponseTime > 0 
      ? Math.abs(recentAvg - historicalAvg) / stats.stdDevResponseTime 
      : 0;
    
    // Combine with error rate anomaly
    const errorRateAnomaly = stats.errorRate > 0.1 ? stats.errorRate * 10 : 0;
    
    return Math.min(zScore + errorRateAnomaly, 10); // Cap at 10
  }
  
  private analyzeTrend(): 'improving' | 'stable' | 'degrading' | 'critical' {
    if (this.movingAverages.responseTime.length < 3) {
      return 'stable';
    }
    
    const recent = this.movingAverages.responseTime.slice(-3);
    const older = this.movingAverages.responseTime.slice(-6, -3);
    
    if (older.length === 0) {
      return 'stable';
    }
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const change = (recentAvg - olderAvg) / olderAvg;
    
    // Check error rate trend
    const recentErrors = this.movingAverages.errorRate.slice(-3);
    const errorTrend = recentErrors.length > 0 
      ? recentErrors[recentErrors.length - 1] - recentErrors[0] 
      : 0;
    
    // Combine response time and error trends
    if (change > 0.5 || errorTrend > 0.3) {
      return 'critical';
    } else if (change > 0.2 || errorTrend > 0.1) {
      return 'degrading';
    } else if (change < -0.1 && errorTrend <= 0) {
      return 'improving';
    }
    
    return 'stable';
  }
  
  private calculateFailureProbability(stats: any, anomalyScore: number, trend: string): number {
    // Base probability from error rate
    let probability = stats.errorRate;
    
    // Adjust based on anomaly score
    probability += (anomalyScore / 10) * this.modelWeights.responseTimeWeight;
    
    // Adjust based on trend
    const trendMultipliers: Record<string, number> = {
      'improving': 0.7,
      'stable': 1.0,
      'degrading': 1.5,
      'critical': 2.0
    };
    probability *= trendMultipliers[trend] * this.modelWeights.trendWeight;
    
    // Adjust based on resource pressure
    probability += stats.resourcePressure * this.modelWeights.resourceWeight;
    
    // Apply learned adjustments
    probability = this.applyLearnedAdjustments(probability);
    
    return Math.min(Math.max(probability, 0), 1);
  }
  
  private applyLearnedAdjustments(baseProbability: number): number {
    // Simple learning: adjust based on recent prediction accuracy
    const recentPredictions = this.predictions.slice(-10);
    if (recentPredictions.length === 0) {
      return baseProbability;
    }
    
    // This is a simplified learning mechanism
    // In production, you'd use more sophisticated ML models
    const accuracy = this.calculatePredictionAccuracy();
    const adjustment = accuracy > 0.8 ? 1.1 : accuracy < 0.5 ? 0.9 : 1.0;
    
    return baseProbability * adjustment;
  }
  
  private calculatePredictionAccuracy(): number {
    // Simplified accuracy calculation
    // In reality, you'd compare predictions with actual outcomes
    return 0.75; // Placeholder
  }
  
  private predictResponseTime(): number {
    if (this.movingAverages.responseTime.length === 0) {
      return 0;
    }
    
    // Simple linear extrapolation
    const recent = this.movingAverages.responseTime.slice(-5);
    const weights = [0.1, 0.15, 0.2, 0.25, 0.3]; // More weight on recent values
    
    let weightedSum = 0;
    let weightSum = 0;
    
    recent.forEach((value, index) => {
      if (index < weights.length) {
        weightedSum += value * weights[index];
        weightSum += weights[index];
      }
    });
    
    return weightSum > 0 ? weightedSum / weightSum : recent[recent.length - 1];
  }
  
  private calculatePredictionConfidence(metrics: PerformanceMetric[]): number {
    // Factors affecting confidence:
    // 1. Data consistency
    const consistency = 1 - (this.calculateStdDev(metrics.map(m => m.responseTime)) / 
      (metrics.reduce((a, m) => a + m.responseTime, 0) / metrics.length));
    
    // 2. Sample size
    const sampleConfidence = Math.min(metrics.length / (this.config.predictionSamples * 2), 1);
    
    // 3. Trend stability
    const trendStability = this.calculateTrendStability();
    
    return (consistency * 0.4 + sampleConfidence * 0.3 + trendStability * 0.3);
  }
  
  private calculateTrendStability(): number {
    if (this.movingAverages.responseTime.length < 5) {
      return 0.5;
    }
    
    const recent = this.movingAverages.responseTime.slice(-5);
    const variance = this.calculateStdDev(recent);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    return mean > 0 ? Math.max(0, 1 - (variance / mean)) : 0.5;
  }
  
  private predictTimeToFailure(stats: any, trend: string): number | undefined {
    if (trend !== 'degrading' && trend !== 'critical') {
      return undefined;
    }
    
    // Estimate based on rate of degradation
    const degradationRate = this.calculateDegradationRate();
    if (degradationRate <= 0) {
      return undefined;
    }
    
    // Calculate remaining capacity
    const currentErrorRate = stats.errorRate;
    const criticalErrorRate = 0.5; // 50% error rate considered critical
    const remainingCapacity = criticalErrorRate - currentErrorRate;
    
    if (remainingCapacity <= 0) {
      return Date.now(); // Already at critical level
    }
    
    // Estimate time to reach critical level
    const timeToFailure = (remainingCapacity / degradationRate) * 60000; // Convert to milliseconds
    
    return Date.now() + Math.max(timeToFailure, 0);
  }
  
  private calculateDegradationRate(): number {
    const errorRates = this.movingAverages.errorRate;
    if (errorRates.length < 2) {
      return 0;
    }
    
    // Simple linear regression
    const n = errorRates.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = errorRates.reduce((a, b) => a + b, 0);
    const sumXY = errorRates.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return Math.max(slope, 0); // Only positive degradation
  }
  
  private generateRecommendations(
    failureProbability: number, 
    trend: string, 
    anomalyScore: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (failureProbability > 0.8) {
      recommendations.push('Consider scaling up resources immediately');
      recommendations.push('Review recent changes that might have caused degradation');
    }
    
    if (trend === 'critical') {
      recommendations.push('Implement immediate remediation measures');
      recommendations.push('Consider activating disaster recovery procedures');
    } else if (trend === 'degrading') {
      recommendations.push('Monitor closely for further degradation');
      recommendations.push('Prepare scaling or optimization strategies');
    }
    
    if (anomalyScore > this.config.anomalyThreshold) {
      recommendations.push('Investigate anomalous behavior patterns');
      recommendations.push('Check for unusual traffic or attack patterns');
    }
    
    if (this.adaptiveThresholds) {
      const p95 = this.adaptiveThresholds.responseTime.p95;
      const current = this.movingAverages.responseTime[this.movingAverages.responseTime.length - 1] || 0;
      if (current > p95 * 0.8) {
        recommendations.push(`Response time approaching P95 threshold (${p95}ms)`);
      }
    }
    
    return recommendations;
  }
  
  private captureResourceSnapshot(): any {
    // In a real implementation, this would capture actual resource metrics
    // For now, we'll simulate with random values
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      connections: Math.floor(Math.random() * 1000)
    };
  }
  
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('memory')) return 'memory';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('unauthorized') || message.includes('forbidden')) return 'auth';
    
    return 'unknown';
  }
  
  private countErrorTypes(metrics: PerformanceMetric[]): Record<string, number> {
    const errorCounts: Record<string, number> = {};
    
    metrics.filter(m => !m.success && m.errorType).forEach(m => {
      errorCounts[m.errorType!] = (errorCounts[m.errorType!] || 0) + 1;
    });
    
    return errorCounts;
  }
  
  private calculateResourcePressure(metrics: PerformanceMetric[]): number {
    const withResources = metrics.filter(m => m.resourceUsage);
    if (withResources.length === 0) return 0;
    
    const avgCpu = withResources.reduce((sum, m) => sum + (m.resourceUsage?.cpu || 0), 0) / withResources.length;
    const avgMemory = withResources.reduce((sum, m) => sum + (m.resourceUsage?.memory || 0), 0) / withResources.length;
    const avgConnections = withResources.reduce((sum, m) => sum + (m.resourceUsage?.connections || 0), 0) / withResources.length;
    
    // Normalize and weight
    return (avgCpu / 100) * 0.4 + (avgMemory / 100) * 0.4 + Math.min(avgConnections / 1000, 1) * 0.2;
  }
  
  private adaptThresholds(): void {
    const responseTimes = this.metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const errorRate = this.metrics.filter(m => !m.success).length / this.metrics.length;
    
    this.adaptiveThresholds = {
      responseTime: {
        p50: this.calculatePercentile(responseTimes, 50),
        p95: this.calculatePercentile(responseTimes, 95),
        p99: this.calculatePercentile(responseTimes, 99)
      },
      errorRate: Math.max(errorRate * 1.5, 0.05), // Allow 50% above current rate, min 5%
      adaptedAt: new Date()
    };
    
    console.log(`📊 ${this.getName()}: Adapted thresholds - P95: ${this.adaptiveThresholds.responseTime.p95}ms, Error rate: ${(this.adaptiveThresholds.errorRate * 100).toFixed(1)}%`);
  }
  
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
  
  // Public API methods
  getPredictions(): PredictionResult[] {
    return [...this.predictions];
  }
  
  getLatestPrediction(): PredictionResult | null {
    return this.predictions.length > 0 ? this.predictions[this.predictions.length - 1] : null;
  }
  
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
  
  getAdaptiveThresholds(): AdaptiveThresholds | undefined {
    return this.adaptiveThresholds;
  }
  
  getPredictiveStats(): any {
    const basicStats = this.getDetailedStats();
    const latestPrediction = this.getLatestPrediction();
    
    return {
      ...basicStats,
      prediction: latestPrediction,
      adaptiveThresholds: this.adaptiveThresholds,
      metrics: {
        count: this.metrics.length,
        window: this.config.predictionWindow,
        movingAverages: {
          responseTime: this.movingAverages.responseTime[this.movingAverages.responseTime.length - 1] || 0,
          errorRate: this.movingAverages.errorRate[this.movingAverages.errorRate.length - 1] || 0
        }
      }
    };
  }
  
  // Override reset to clear predictions
  reset(): void {
    super.reset();
    this.metrics = [];
    this.predictions = [];
    this.movingAverages = {
      responseTime: [],
      errorRate: [],
      resourceUsage: []
    };
    this.adaptiveThresholds = undefined;
    console.log(`🔄 ${this.getName()}: Predictive circuit breaker reset`);
  }
  
  destroy(): void {
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
    }
    this.removeAllListeners();
    console.log(`🗑️ ${this.getName()}: Predictive circuit breaker destroyed`);
  }
}

// Helper function to create predictive circuit breaker with presets
export function createPredictiveCircuitBreaker(
  name: string,
  preset: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
): PredictiveCircuitBreaker {
  const presets = {
    conservative: {
      failureThreshold: 10,
      successThreshold: 5,
      timeout: 120000,
      preemptiveOpenThreshold: 0.9,
      trendSensitivity: 0.5,
      anomalyThreshold: 3.0
    },
    balanced: {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      preemptiveOpenThreshold: 0.8,
      trendSensitivity: 0.7,
      anomalyThreshold: 2.5
    },
    aggressive: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      preemptiveOpenThreshold: 0.7,
      trendSensitivity: 0.9,
      anomalyThreshold: 2.0
    }
  };
  
  return new PredictiveCircuitBreaker({
    name,
    config: presets[preset] as Partial<PredictiveConfig>
  });
}