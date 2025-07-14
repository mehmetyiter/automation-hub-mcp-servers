import { EventEmitter } from 'events';
import { HealthChecker, HealthStatus, HealthCheck, ComponentHealth, SystemMetrics, HealthAlert } from './health-checker.js';

export interface PredictiveHealthConfig {
  enabled: boolean;
  predictionWindow: number;           // Time window for predictions (ms)
  minDataPoints: number;              // Minimum data points for prediction
  trendAnalysisInterval: number;      // Interval for trend analysis (ms)
  anomalyDetectionSensitivity: number;// Sensitivity for anomaly detection (0-1)
  predictiveAlertThreshold: number;   // Threshold for predictive alerts (0-1)
  adaptiveLearning: boolean;          // Enable ML-based adaptive learning
}

export interface HealthTrend {
  component: string;
  direction: 'improving' | 'stable' | 'degrading' | 'critical';
  rate: number;                       // Rate of change
  confidence: number;                 // Confidence in trend (0-1)
  predictedTimeToFailure?: number;    // Predicted time until failure (ms)
  recommendation?: string;
}

export interface HealthPrediction {
  timestamp: Date;
  overallHealth: {
    current: 'healthy' | 'degraded' | 'unhealthy';
    predicted: 'healthy' | 'degraded' | 'unhealthy';
    confidence: number;
    timeHorizon: number;              // How far into future (ms)
  };
  componentPredictions: Map<string, {
    current: 'healthy' | 'degraded' | 'unhealthy';
    predicted: 'healthy' | 'degraded' | 'unhealthy';
    confidence: number;
    risk: number;                     // Risk score (0-1)
  }>;
  trends: HealthTrend[];
  anomalies: HealthAnomaly[];
  recommendations: string[];
  riskScore: number;                  // Overall risk score (0-1)
}

export interface HealthAnomaly {
  component: string;
  metric: string;
  value: number;
  expectedRange: { min: number; max: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
}

interface HealthMetricHistory {
  timestamp: Date;
  status: HealthStatus;
  trends: Map<string, number[]>;
  anomalies: HealthAnomaly[];
}

export class PredictiveHealthMonitor extends EventEmitter {
  private healthChecker: HealthChecker;
  private config: PredictiveHealthConfig;
  private healthHistory: HealthMetricHistory[] = [];
  private trendAnalysisInterval?: NodeJS.Timeout;
  private predictions: HealthPrediction[] = [];
  
  // Statistical models
  private baselineMetrics: Map<string, {
    mean: number;
    stdDev: number;
    percentiles: { p50: number; p95: number; p99: number };
  }> = new Map();
  
  // Machine learning state
  private modelWeights = {
    trend: 0.3,
    anomaly: 0.25,
    resource: 0.25,
    history: 0.2
  };
  
  private seasonalPatterns: Map<string, number[]> = new Map();
  
  constructor(healthChecker: HealthChecker, config?: Partial<PredictiveHealthConfig>) {
    super();
    
    this.healthChecker = healthChecker;
    this.config = {
      enabled: true,
      predictionWindow: 3600000,       // 1 hour
      minDataPoints: 10,
      trendAnalysisInterval: 60000,    // 1 minute
      anomalyDetectionSensitivity: 0.8,
      predictiveAlertThreshold: 0.7,
      adaptiveLearning: true,
      ...config
    };
    
    if (this.config.enabled) {
      this.initialize();
    }
    
    console.log('🔮 Predictive Health Monitor initialized');
  }
  
  private initialize(): void {
    // Subscribe to health check events
    this.healthChecker.on('healthCheck', (status: HealthStatus) => {
      this.recordHealthMetrics(status);
    });
    
    // Start trend analysis
    this.trendAnalysisInterval = setInterval(() => {
      this.analyzeTrends();
    }, this.config.trendAnalysisInterval);
    
    // Initialize baselines
    this.initializeBaselines();
  }
  
  private recordHealthMetrics(status: HealthStatus): void {
    // Extract trends from current status
    const trends = this.extractTrends(status);
    
    // Detect anomalies
    const anomalies = this.detectAnomalies(status);
    
    // Store in history
    this.healthHistory.push({
      timestamp: new Date(status.timestamp),
      status,
      trends,
      anomalies
    });
    
    // Keep only data within prediction window
    const cutoff = Date.now() - this.config.predictionWindow;
    this.healthHistory = this.healthHistory.filter(h => h.timestamp.getTime() > cutoff);
    
    // Update baselines if adaptive learning is enabled
    if (this.config.adaptiveLearning) {
      this.updateBaselines(status);
    }
    
    // Check for immediate alerts
    if (anomalies.length > 0) {
      anomalies.forEach(anomaly => {
        if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
          this.emit('anomaly', anomaly);
        }
      });
    }
  }
  
  private extractTrends(status: HealthStatus): Map<string, number[]> {
    const trends = new Map<string, number[]>();
    
    // Extract memory trend
    trends.set('memory', [status.metrics.memoryUsage.usagePercentage]);
    
    // Extract CPU trend
    trends.set('cpu', [status.metrics.cpuUsage.total]);
    
    // Extract response time trends
    Object.entries(status.components).forEach(([component, health]) => {
      if (health.responseTime !== undefined) {
        trends.set(`${component}_responseTime`, [health.responseTime]);
      }
    });
    
    // Extract custom metrics
    if (status.metrics.diskUsage) {
      trends.set('disk', [status.metrics.diskUsage.usagePercentage]);
    }
    
    if (status.metrics.networkConnections) {
      trends.set('connections', [status.metrics.networkConnections.active]);
    }
    
    return trends;
  }
  
  private detectAnomalies(status: HealthStatus): HealthAnomaly[] {
    const anomalies: HealthAnomaly[] = [];
    
    // Check memory anomalies
    const memoryUsage = status.metrics.memoryUsage.usagePercentage;
    const memoryBaseline = this.baselineMetrics.get('memory');
    if (memoryBaseline && this.isAnomaly(memoryUsage, memoryBaseline)) {
      anomalies.push({
        component: 'memory',
        metric: 'usage_percentage',
        value: memoryUsage,
        expectedRange: { 
          min: memoryBaseline.mean - 2 * memoryBaseline.stdDev,
          max: memoryBaseline.mean + 2 * memoryBaseline.stdDev
        },
        severity: this.calculateAnomalySeverity(memoryUsage, memoryBaseline),
        timestamp: new Date(status.timestamp),
        description: `Memory usage ${memoryUsage.toFixed(1)}% is outside normal range`
      });
    }
    
    // Check CPU anomalies
    const cpuUsage = status.metrics.cpuUsage.total;
    const cpuBaseline = this.baselineMetrics.get('cpu');
    if (cpuBaseline && this.isAnomaly(cpuUsage, cpuBaseline)) {
      anomalies.push({
        component: 'cpu',
        metric: 'total_usage',
        value: cpuUsage,
        expectedRange: {
          min: cpuBaseline.mean - 2 * cpuBaseline.stdDev,
          max: cpuBaseline.mean + 2 * cpuBaseline.stdDev
        },
        severity: this.calculateAnomalySeverity(cpuUsage, cpuBaseline),
        timestamp: new Date(status.timestamp),
        description: `CPU usage ${cpuUsage.toFixed(1)}% is anomalous`
      });
    }
    
    // Check response time anomalies
    Object.entries(status.components).forEach(([component, health]) => {
      if (health.responseTime !== undefined) {
        const baseline = this.baselineMetrics.get(`${component}_responseTime`);
        if (baseline && this.isAnomaly(health.responseTime, baseline)) {
          anomalies.push({
            component,
            metric: 'response_time',
            value: health.responseTime,
            expectedRange: {
              min: baseline.mean - 2 * baseline.stdDev,
              max: baseline.mean + 2 * baseline.stdDev
            },
            severity: this.calculateAnomalySeverity(health.responseTime, baseline),
            timestamp: new Date(status.timestamp),
            description: `${component} response time ${health.responseTime}ms is anomalous`
          });
        }
      }
    });
    
    // Check for sudden state changes
    if (this.healthHistory.length > 0) {
      const previousStatus = this.healthHistory[this.healthHistory.length - 1].status;
      this.detectStateChangeAnomalies(status, previousStatus, anomalies);
    }
    
    return anomalies;
  }
  
  private isAnomaly(value: number, baseline: { mean: number; stdDev: number }): boolean {
    const zScore = Math.abs(value - baseline.mean) / baseline.stdDev;
    return zScore > (2 / this.config.anomalyDetectionSensitivity);
  }
  
  private calculateAnomalySeverity(
    value: number, 
    baseline: { mean: number; stdDev: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    const zScore = Math.abs(value - baseline.mean) / baseline.stdDev;
    
    if (zScore > 4) return 'critical';
    if (zScore > 3) return 'high';
    if (zScore > 2) return 'medium';
    return 'low';
  }
  
  private detectStateChangeAnomalies(
    current: HealthStatus, 
    previous: HealthStatus, 
    anomalies: HealthAnomaly[]
  ): void {
    // Check for component status changes
    Object.keys(current.components).forEach(component => {
      const currentHealth = (current.components as any)[component];
      const previousHealth = (previous.components as any)[component];
      
      if (currentHealth.status !== previousHealth.status && 
          currentHealth.status === 'unhealthy') {
        anomalies.push({
          component,
          metric: 'status',
          value: 0,
          expectedRange: { min: 1, max: 1 },
          severity: 'high',
          timestamp: new Date(current.timestamp),
          description: `${component} transitioned from ${previousHealth.status} to unhealthy`
        });
      }
    });
  }
  
  private analyzeTrends(): void {
    if (this.healthHistory.length < this.config.minDataPoints) {
      return;
    }
    
    const prediction = this.generatePrediction();
    this.predictions.push(prediction);
    
    // Keep only recent predictions
    if (this.predictions.length > 100) {
      this.predictions = this.predictions.slice(-100);
    }
    
    // Emit prediction event
    this.emit('prediction', prediction);
    
    // Check for predictive alerts
    this.checkPredictiveAlerts(prediction);
    
    // Log significant predictions
    if (prediction.riskScore > this.config.predictiveAlertThreshold) {
      console.warn(`⚠️ High health risk detected: ${(prediction.riskScore * 100).toFixed(1)}%`);
    }
  }
  
  private generatePrediction(): HealthPrediction {
    const trends = this.calculateTrends();
    const anomalies = this.getRecentAnomalies();
    const componentPredictions = this.predictComponentHealth();
    const overallPrediction = this.predictOverallHealth(componentPredictions, trends);
    const recommendations = this.generateRecommendations(trends, anomalies, overallPrediction);
    const riskScore = this.calculateRiskScore(trends, anomalies, componentPredictions);
    
    return {
      timestamp: new Date(),
      overallHealth: overallPrediction,
      componentPredictions,
      trends: Array.from(trends.values()),
      anomalies,
      recommendations,
      riskScore
    };
  }
  
  private calculateTrends(): Map<string, HealthTrend> {
    const trends = new Map<string, HealthTrend>();
    
    // Analyze each metric's trend
    const metricsToAnalyze = ['memory', 'cpu', 'database_responseTime', 'cache_responseTime'];
    
    metricsToAnalyze.forEach(metric => {
      const values = this.extractMetricHistory(metric);
      if (values.length >= 5) {
        const trend = this.analyzeMetricTrend(metric, values);
        trends.set(metric, trend);
      }
    });
    
    return trends;
  }
  
  private extractMetricHistory(metric: string): number[] {
    const values: number[] = [];
    
    this.healthHistory.forEach(history => {
      let value: number | undefined;
      
      switch (metric) {
        case 'memory':
          value = history.status.metrics.memoryUsage.usagePercentage;
          break;
        case 'cpu':
          value = history.status.metrics.cpuUsage.total;
          break;
        default:
          if (metric.endsWith('_responseTime')) {
            const component = metric.replace('_responseTime', '');
            const health = (history.status.components as any)[component];
            value = health?.responseTime;
          }
      }
      
      if (value !== undefined) {
        values.push(value);
      }
    });
    
    return values;
  }
  
  private analyzeMetricTrend(metric: string, values: number[]): HealthTrend {
    // Calculate linear regression
    const regression = this.calculateLinearRegression(values);
    
    // Determine trend direction
    let direction: 'improving' | 'stable' | 'degrading' | 'critical';
    const normalizedSlope = regression.slope / (regression.mean || 1);
    
    // For metrics where lower is better (response time)
    const lowerIsBetter = metric.includes('responseTime') || metric.includes('cpu') || metric.includes('memory');
    
    if (Math.abs(normalizedSlope) < 0.01) {
      direction = 'stable';
    } else if (normalizedSlope > 0.1) {
      direction = lowerIsBetter ? 'degrading' : 'improving';
    } else if (normalizedSlope > 0.3) {
      direction = lowerIsBetter ? 'critical' : 'improving';
    } else if (normalizedSlope < -0.1) {
      direction = lowerIsBetter ? 'improving' : 'degrading';
    } else if (normalizedSlope < -0.3) {
      direction = lowerIsBetter ? 'improving' : 'critical';
    } else {
      direction = 'stable';
    }
    
    // Calculate predicted time to failure for degrading trends
    let predictedTimeToFailure: number | undefined;
    if ((direction === 'degrading' || direction === 'critical') && regression.slope !== 0) {
      const threshold = this.getFailureThreshold(metric);
      const currentValue = values[values.length - 1];
      const timeToThreshold = (threshold - currentValue) / regression.slope;
      
      if (timeToThreshold > 0) {
        predictedTimeToFailure = timeToThreshold * this.config.trendAnalysisInterval;
      }
    }
    
    return {
      component: metric,
      direction,
      rate: regression.slope,
      confidence: regression.r2,
      predictedTimeToFailure,
      recommendation: this.generateTrendRecommendation(metric, direction, regression)
    };
  }
  
  private calculateLinearRegression(values: number[]): {
    slope: number;
    intercept: number;
    r2: number;
    mean: number;
  } {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY2 = values.reduce((sum, y) => sum + y * y, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const mean = sumY / n;
    const totalSS = sumY2 - n * mean * mean;
    const residualSS = values.reduce((sum, y, x) => {
      const predicted = slope * x + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    
    const r2 = totalSS > 0 ? 1 - (residualSS / totalSS) : 0;
    
    return { slope, intercept, r2, mean };
  }
  
  private getFailureThreshold(metric: string): number {
    const thresholds: Record<string, number> = {
      memory: 95,
      cpu: 95,
      database_responseTime: 5000,
      cache_responseTime: 1000
    };
    
    return thresholds[metric] || 100;
  }
  
  private generateTrendRecommendation(
    metric: string, 
    direction: string, 
    regression: any
  ): string {
    if (direction === 'stable' || direction === 'improving') {
      return '';
    }
    
    const recommendations: Record<string, string> = {
      memory: 'Consider increasing memory allocation or optimizing memory usage',
      cpu: 'Consider scaling horizontally or optimizing CPU-intensive operations',
      database_responseTime: 'Optimize database queries or consider connection pooling',
      cache_responseTime: 'Check cache configuration or consider cache warming'
    };
    
    return recommendations[metric] || `Monitor ${metric} closely for further degradation`;
  }
  
  private getRecentAnomalies(): HealthAnomaly[] {
    const recentHistory = this.healthHistory.slice(-10);
    const anomalies: HealthAnomaly[] = [];
    
    recentHistory.forEach(history => {
      anomalies.push(...history.anomalies);
    });
    
    return anomalies;
  }
  
  private predictComponentHealth(): Map<string, any> {
    const predictions = new Map();
    const latestStatus = this.healthHistory[this.healthHistory.length - 1]?.status;
    
    if (!latestStatus) {
      return predictions;
    }
    
    Object.entries(latestStatus.components).forEach(([component, health]) => {
      const trend = this.calculateComponentTrend(component);
      const anomalyCount = this.getRecentAnomalies()
        .filter(a => a.component === component).length;
      
      let predicted: 'healthy' | 'degraded' | 'unhealthy' = health.status;
      let risk = 0;
      
      // Predict based on trend and anomalies
      if (trend && (trend.direction === 'degrading' || trend.direction === 'critical')) {
        risk += 0.5 * trend.confidence;
        if (trend.predictedTimeToFailure && trend.predictedTimeToFailure < 3600000) {
          predicted = 'unhealthy';
          risk += 0.3;
        } else if (health.status === 'healthy') {
          predicted = 'degraded';
          risk += 0.2;
        }
      }
      
      if (anomalyCount > 2) {
        risk += 0.2;
        if (predicted === 'healthy') {
          predicted = 'degraded';
        }
      }
      
      predictions.set(component, {
        current: health.status,
        predicted,
        confidence: trend ? trend.confidence : 0.5,
        risk: Math.min(risk, 1)
      });
    });
    
    return predictions;
  }
  
  private calculateComponentTrend(component: string): HealthTrend | undefined {
    const trends = this.calculateTrends();
    
    // Look for component-specific trends
    for (const [key, trend] of trends) {
      if (key.startsWith(component)) {
        return trend;
      }
    }
    
    return undefined;
  }
  
  private predictOverallHealth(
    componentPredictions: Map<string, any>,
    trends: Map<string, HealthTrend>
  ): any {
    const latestStatus = this.healthHistory[this.healthHistory.length - 1]?.status;
    const current = latestStatus?.status || 'healthy';
    
    // Count unhealthy predictions
    let unhealthyCount = 0;
    let degradedCount = 0;
    let totalRisk = 0;
    
    componentPredictions.forEach(prediction => {
      if (prediction.predicted === 'unhealthy') unhealthyCount++;
      if (prediction.predicted === 'degraded') degradedCount++;
      totalRisk += prediction.risk;
    });
    
    // Determine predicted status
    let predicted: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      predicted = 'unhealthy';
    } else if (degradedCount > componentPredictions.size / 3) {
      predicted = 'degraded';
    } else {
      predicted = 'healthy';
    }
    
    // Calculate confidence based on trend consistency
    const trendConfidences = Array.from(trends.values()).map(t => t.confidence);
    const avgConfidence = trendConfidences.length > 0
      ? trendConfidences.reduce((a, b) => a + b, 0) / trendConfidences.length
      : 0.5;
    
    return {
      current,
      predicted,
      confidence: avgConfidence,
      timeHorizon: 3600000 // 1 hour prediction
    };
  }
  
  private generateRecommendations(
    trends: Map<string, HealthTrend>,
    anomalies: HealthAnomaly[],
    overallPrediction: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Add trend-based recommendations
    trends.forEach(trend => {
      if (trend.recommendation) {
        recommendations.push(trend.recommendation);
      }
    });
    
    // Add anomaly-based recommendations
    const criticalAnomalies = anomalies.filter(a => 
      a.severity === 'critical' || a.severity === 'high'
    );
    
    if (criticalAnomalies.length > 0) {
      recommendations.push('Investigate recent anomalies in system behavior');
    }
    
    // Add prediction-based recommendations
    if (overallPrediction.predicted === 'unhealthy' && overallPrediction.current !== 'unhealthy') {
      recommendations.push('Prepare for potential system degradation');
      recommendations.push('Consider preemptive scaling or resource allocation');
    }
    
    // Add specific recommendations based on patterns
    if (this.detectMemoryLeak()) {
      recommendations.push('Potential memory leak detected - investigate memory allocation');
    }
    
    if (this.detectPerformanceDegradation()) {
      recommendations.push('Performance degradation detected - review recent changes');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }
  
  private calculateRiskScore(
    trends: Map<string, HealthTrend>,
    anomalies: HealthAnomaly[],
    componentPredictions: Map<string, any>
  ): number {
    let riskScore = 0;
    
    // Factor in trends
    trends.forEach(trend => {
      if (trend.direction === 'critical') {
        riskScore += 0.3 * trend.confidence;
      } else if (trend.direction === 'degrading') {
        riskScore += 0.2 * trend.confidence;
      }
    });
    
    // Factor in anomalies
    const anomalyScore = anomalies.reduce((score, anomaly) => {
      const severityScores = { low: 0.1, medium: 0.2, high: 0.3, critical: 0.4 };
      return score + severityScores[anomaly.severity];
    }, 0);
    riskScore += Math.min(anomalyScore, 0.3);
    
    // Factor in component predictions
    let componentRisk = 0;
    componentPredictions.forEach(prediction => {
      componentRisk += prediction.risk;
    });
    riskScore += (componentRisk / componentPredictions.size) * 0.4;
    
    return Math.min(riskScore, 1);
  }
  
  private detectMemoryLeak(): boolean {
    const memoryValues = this.extractMetricHistory('memory');
    if (memoryValues.length < 10) return false;
    
    const regression = this.calculateLinearRegression(memoryValues);
    return regression.slope > 0.5 && regression.r2 > 0.8;
  }
  
  private detectPerformanceDegradation(): boolean {
    const responseMetrics = ['database_responseTime', 'cache_responseTime'];
    let degradationCount = 0;
    
    responseMetrics.forEach(metric => {
      const values = this.extractMetricHistory(metric);
      if (values.length >= 5) {
        const regression = this.calculateLinearRegression(values);
        if (regression.slope > 0 && regression.r2 > 0.7) {
          degradationCount++;
        }
      }
    });
    
    return degradationCount > 0;
  }
  
  private checkPredictiveAlerts(prediction: HealthPrediction): void {
    const alerts: HealthAlert[] = [];
    
    // Check overall health prediction
    if (prediction.overallHealth.predicted === 'unhealthy' && 
        prediction.overallHealth.confidence > this.config.predictiveAlertThreshold) {
      alerts.push({
        level: 'critical',
        component: 'system',
        message: 'System health predicted to degrade to unhealthy state',
        timestamp: Date.now()
      });
    }
    
    // Check component predictions
    prediction.componentPredictions.forEach((pred, component) => {
      if (pred.risk > this.config.predictiveAlertThreshold) {
        alerts.push({
          level: pred.risk > 0.8 ? 'critical' : 'warning',
          component,
          message: `${component} at high risk of failure (${(pred.risk * 100).toFixed(1)}% risk)`,
          timestamp: Date.now()
        });
      }
    });
    
    // Check critical trends
    prediction.trends.forEach(trend => {
      if (trend.direction === 'critical' && trend.predictedTimeToFailure) {
        const hoursToFailure = trend.predictedTimeToFailure / (1000 * 60 * 60);
        alerts.push({
          level: hoursToFailure < 1 ? 'critical' : 'warning',
          component: trend.component,
          message: `${trend.component} predicted to fail in ${hoursToFailure.toFixed(1)} hours`,
          timestamp: Date.now()
        });
      }
    });
    
    // Emit alerts
    alerts.forEach(alert => this.emit('predictive-alert', alert));
  }
  
  private initializeBaselines(): void {
    // Initialize with default baselines
    this.baselineMetrics.set('memory', {
      mean: 50,
      stdDev: 15,
      percentiles: { p50: 50, p95: 80, p99: 90 }
    });
    
    this.baselineMetrics.set('cpu', {
      mean: 30,
      stdDev: 20,
      percentiles: { p50: 30, p95: 70, p99: 85 }
    });
    
    this.baselineMetrics.set('database_responseTime', {
      mean: 100,
      stdDev: 50,
      percentiles: { p50: 80, p95: 200, p99: 500 }
    });
    
    this.baselineMetrics.set('cache_responseTime', {
      mean: 10,
      stdDev: 5,
      percentiles: { p50: 8, p95: 20, p99: 50 }
    });
  }
  
  private updateBaselines(status: HealthStatus): void {
    // Update memory baseline
    this.updateMetricBaseline('memory', status.metrics.memoryUsage.usagePercentage);
    
    // Update CPU baseline
    this.updateMetricBaseline('cpu', status.metrics.cpuUsage.total);
    
    // Update response time baselines
    Object.entries(status.components).forEach(([component, health]) => {
      if (health.responseTime !== undefined) {
        this.updateMetricBaseline(`${component}_responseTime`, health.responseTime);
      }
    });
  }
  
  private updateMetricBaseline(metric: string, value: number): void {
    const values = this.extractMetricHistory(metric);
    if (values.length < 20) return;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    this.baselineMetrics.set(metric, {
      mean,
      stdDev,
      percentiles: {
        p50: this.getPercentile(sorted, 50),
        p95: this.getPercentile(sorted, 95),
        p99: this.getPercentile(sorted, 99)
      }
    });
  }
  
  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
  
  // Public API methods
  getLatestPrediction(): HealthPrediction | null {
    return this.predictions.length > 0 ? this.predictions[this.predictions.length - 1] : null;
  }
  
  getPredictionHistory(): HealthPrediction[] {
    return [...this.predictions];
  }
  
  getHealthTrends(): HealthTrend[] {
    const trends = this.calculateTrends();
    return Array.from(trends.values());
  }
  
  getAnomalyHistory(): HealthAnomaly[] {
    const anomalies: HealthAnomaly[] = [];
    this.healthHistory.forEach(history => {
      anomalies.push(...history.anomalies);
    });
    return anomalies;
  }
  
  getPredictiveHealthReport(): any {
    const latestPrediction = this.getLatestPrediction();
    const trends = this.getHealthTrends();
    const anomalies = this.getAnomalyHistory();
    
    return {
      timestamp: new Date(),
      prediction: latestPrediction,
      trends: trends.filter(t => t.direction !== 'stable'),
      recentAnomalies: anomalies.slice(-10),
      baselines: Object.fromEntries(this.baselineMetrics),
      healthHistory: {
        count: this.healthHistory.length,
        window: this.config.predictionWindow,
        oldestEntry: this.healthHistory[0]?.timestamp
      },
      configuration: this.config
    };
  }
  
  reset(): void {
    console.log('🔄 Resetting Predictive Health Monitor');
    this.healthHistory = [];
    this.predictions = [];
    this.baselineMetrics.clear();
    this.seasonalPatterns.clear();
    this.initializeBaselines();
  }
  
  destroy(): void {
    console.log('🗑️ Destroying Predictive Health Monitor');
    if (this.trendAnalysisInterval) {
      clearInterval(this.trendAnalysisInterval);
    }
    this.removeAllListeners();
    this.reset();
  }
}

// Helper function to create predictive health monitor with presets
export function createPredictiveHealthMonitor(
  healthChecker: HealthChecker,
  preset: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
): PredictiveHealthMonitor {
  const presets = {
    conservative: {
      trendAnalysisInterval: 120000,      // 2 minutes
      anomalyDetectionSensitivity: 0.6,
      predictiveAlertThreshold: 0.8,
      minDataPoints: 20
    },
    balanced: {
      trendAnalysisInterval: 60000,       // 1 minute
      anomalyDetectionSensitivity: 0.8,
      predictiveAlertThreshold: 0.7,
      minDataPoints: 10
    },
    aggressive: {
      trendAnalysisInterval: 30000,       // 30 seconds
      anomalyDetectionSensitivity: 0.9,
      predictiveAlertThreshold: 0.6,
      minDataPoints: 5
    }
  };
  
  return new PredictiveHealthMonitor(healthChecker, presets[preset]);
}