import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { PerformanceCollector, WorkflowExecution } from '../core/PerformanceCollector';
import { PerformanceAnalyzer } from '../analyzer/PerformanceAnalyzer';
import { MetricsExporter } from '../metrics/MetricsExporter';
import { AlertManager } from '../alerts/AlertManager';
import { logger } from '../utils/logger';

export interface MonitoringConfiguration {
  enableRealTimeMonitoring: boolean;
  samplingRate: number;
  alertThresholds: {
    executionTimeMs: number;
    errorRatePercent: number;
    memoryUsageMB: number;
    queueDepthLimit: number;
  };
  retentionPeriodDays: number;
  exportMetrics: boolean;
  enablePredictiveAnalysis: boolean;
}

export interface WorkflowMetrics {
  workflowId: string;
  workflowName: string;
  metrics: {
    executionCount: number;
    avgExecutionTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
    lastExecution: number;
    resourceUsage: {
      avgCpu: number;
      avgMemory: number;
      peakMemory: number;
    };
    performance: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  status: 'healthy' | 'warning' | 'critical';
  trends: {
    executionTime: 'improving' | 'stable' | 'degrading';
    reliability: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
  };
  lastUpdated: number;
}

export interface SystemHealthMetrics {
  overall: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number;
  };
  workflowEngine: {
    status: 'healthy' | 'warning' | 'error';
    activeExecutions: number;
    queueDepth: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'error';
    connectionPool: number;
    queryTime: number;
    lockWaits: number;
  };
  messageQueue: {
    status: 'healthy' | 'warning' | 'error';
    depth: number;
    processingRate: number;
    deadLetters: number;
  };
  externalServices: {
    status: 'healthy' | 'warning' | 'error';
    responseTime: number;
    availability: number;
    errorRate: number;
  };
}

export class WorkflowMonitor extends EventEmitter {
  private performanceCollector: PerformanceCollector;
  private performanceAnalyzer: PerformanceAnalyzer;
  private metricsExporter: MetricsExporter;
  private alertManager: AlertManager;
  private config: MonitoringConfiguration;
  
  private workflowMetrics = new Map<string, WorkflowMetrics>();
  private systemHealth: SystemHealthMetrics;
  private monitoringInterval: NodeJS.Timeout;
  private healthCheckInterval: NodeJS.Timeout;
  
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly METRICS_UPDATE_INTERVAL = 60000; // 1 minute

  constructor(
    performanceCollector: PerformanceCollector,
    performanceAnalyzer: PerformanceAnalyzer,
    metricsExporter: MetricsExporter,
    alertManager: AlertManager,
    config: MonitoringConfiguration
  ) {
    super();
    
    this.performanceCollector = performanceCollector;
    this.performanceAnalyzer = performanceAnalyzer;
    this.metricsExporter = metricsExporter;
    this.alertManager = alertManager;
    this.config = config;
    
    this.systemHealth = this.initializeSystemHealth();
    
    this.setupEventListeners();
    this.startMonitoring();
  }

  private initializeSystemHealth(): SystemHealthMetrics {
    return {
      overall: {
        status: 'healthy',
        score: 100
      },
      workflowEngine: {
        status: 'healthy',
        activeExecutions: 0,
        queueDepth: 0,
        cpuUsage: 0,
        memoryUsage: 0
      },
      database: {
        status: 'healthy',
        connectionPool: 0,
        queryTime: 0,
        lockWaits: 0
      },
      messageQueue: {
        status: 'healthy',
        depth: 0,
        processingRate: 0,
        deadLetters: 0
      },
      externalServices: {
        status: 'healthy',
        responseTime: 0,
        availability: 100,
        errorRate: 0
      }
    };
  }

  private setupEventListeners(): void {
    // Listen to performance collector events
    this.performanceCollector.on('execution_completed', (execution: WorkflowExecution) => {
      this.updateWorkflowMetrics(execution);
      this.checkAlerts(execution);
      
      if (this.config.enableRealTimeMonitoring) {
        this.emit('workflow_execution_completed', execution);
      }
    });

    this.performanceCollector.on('execution_started', (execution: WorkflowExecution) => {
      if (this.config.enableRealTimeMonitoring) {
        this.emit('workflow_execution_started', execution);
      }
    });

    // Listen to analyzer insights
    this.performanceAnalyzer.on('insight_generated', (insight) => {
      this.emit('performance_insight', insight);
      
      if (insight.severity === 'critical' || insight.severity === 'high') {
        this.alertManager.createAlert({
          type: 'performance',
          severity: insight.severity === 'critical' ? 'critical' : 'warning',
          title: insight.title,
          message: insight.description,
          metadata: {
            insightId: insight.id,
            workflowIds: insight.affectedWorkflows
          }
        });
      }
    });
  }

  private startMonitoring(): void {
    // Start periodic metrics updates
    this.monitoringInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, this.METRICS_UPDATE_INTERVAL);

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    logger.info('Workflow monitoring started', {
      samplingRate: this.config.samplingRate,
      realTimeEnabled: this.config.enableRealTimeMonitoring
    });
  }

  // Monitor a specific workflow execution
  async monitorWorkflowExecution(
    workflowId: string,
    workflowName: string,
    userId: string,
    triggerType: 'manual' | 'webhook' | 'cron' | 'event',
    inputData?: any
  ): Promise<string> {
    const inputSize = inputData ? JSON.stringify(inputData).length : 0;
    
    const executionId = this.performanceCollector.startWorkflowExecution(
      workflowId,
      workflowName,
      userId,
      triggerType,
      inputSize
    );

    if (executionId) {
      logger.debug('Started monitoring workflow execution', {
        executionId,
        workflowId,
        workflowName
      });
    }

    return executionId;
  }

  // Complete workflow execution monitoring
  async completeWorkflowExecution(
    executionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    outputData?: any,
    errorMessage?: string
  ): Promise<void> {
    const outputSize = outputData ? JSON.stringify(outputData).length : 0;
    
    this.performanceCollector.endWorkflowExecution(
      executionId,
      status,
      outputSize,
      errorMessage
    );

    logger.debug('Completed monitoring workflow execution', {
      executionId,
      status
    });
  }

  // Monitor node execution within a workflow
  async monitorNodeExecution(
    executionId: string,
    nodeId: string,
    nodeName: string,
    nodeType: string,
    inputCount: number = 0
  ): Promise<string> {
    const nodeExecutionId = this.performanceCollector.startNodeExecution(
      executionId,
      nodeId,
      nodeName,
      nodeType,
      inputCount
    );

    return nodeExecutionId;
  }

  // Complete node execution monitoring
  async completeNodeExecution(
    nodeExecutionId: string,
    status: 'completed' | 'failed' | 'skipped',
    outputCount: number = 0,
    errorMessage?: string,
    performanceData?: any
  ): Promise<void> {
    this.performanceCollector.endNodeExecution(
      nodeExecutionId,
      status,
      outputCount,
      errorMessage,
      performanceData
    );
  }

  // Record performance events
  recordPerformanceEvent(
    executionId: string,
    eventType: 'network_call' | 'db_query' | 'cache_hit' | 'cache_miss' | 'retry',
    duration?: number,
    metadata?: any
  ): void {
    this.performanceCollector.recordPerformanceEvent(
      executionId,
      eventType,
      duration,
      metadata
    );
  }

  // Get current workflow metrics
  getWorkflowMetrics(workflowId?: string): WorkflowMetrics | WorkflowMetrics[] {
    if (workflowId) {
      const metrics = this.workflowMetrics.get(workflowId);
      if (!metrics) {
        throw new Error(`No metrics found for workflow ${workflowId}`);
      }
      return metrics;
    }
    
    return Array.from(this.workflowMetrics.values());
  }

  // Get system health status
  getSystemHealth(): SystemHealthMetrics {
    return { ...this.systemHealth };
  }

  // Get performance insights
  getPerformanceInsights(): any[] {
    return this.performanceAnalyzer.getInsights();
  }

  // Generate performance report
  async generatePerformanceReport(timeRangeMs: number = 24 * 60 * 60 * 1000): Promise<any> {
    const report = this.performanceAnalyzer.generateReport(timeRangeMs);
    
    // Add current system state
    report.systemHealth = this.systemHealth;
    report.monitoringConfig = this.config;
    report.generatedAt = Date.now();
    
    if (this.config.exportMetrics) {
      await this.metricsExporter.exportReport(report);
    }
    
    return report;
  }

  // Get workflow bottlenecks
  getWorkflowBottlenecks(workflowId: string, limit: number = 10): any[] {
    return this.performanceCollector.getWorkflowBottlenecks(workflowId, limit);
  }

  // Get optimization recommendations
  getOptimizationRecommendations(workflowId: string): any[] {
    return this.performanceAnalyzer.getOptimizationRecommendations(workflowId);
  }

  // Predict performance trends
  predictPerformanceTrends(workflowId: string, forecastDays: number = 7): any {
    return this.performanceAnalyzer.predictPerformanceTrends(workflowId, forecastDays);
  }

  // Update monitoring configuration
  updateConfiguration(newConfig: Partial<MonitoringConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Monitoring configuration updated', {
      config: this.config
    });
    
    this.emit('configuration_updated', this.config);
  }

  private updateWorkflowMetrics(execution: WorkflowExecution): void {
    let metrics = this.workflowMetrics.get(execution.workflowId);
    
    if (!metrics) {
      metrics = {
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        metrics: {
          executionCount: 0,
          avgExecutionTime: 0,
          successRate: 0,
          errorRate: 0,
          throughput: 0,
          lastExecution: 0,
          resourceUsage: {
            avgCpu: 0,
            avgMemory: 0,
            peakMemory: 0
          },
          performance: {
            p50: 0,
            p95: 0,
            p99: 0
          }
        },
        status: 'healthy',
        trends: {
          executionTime: 'stable',
          reliability: 'stable',
          throughput: 'stable'
        },
        lastUpdated: Date.now()
      };
    }

    // Update metrics with exponential moving average
    const alpha = 0.1; // Learning rate
    const isSuccess = execution.status === 'completed';
    
    metrics.metrics.executionCount++;
    metrics.metrics.lastExecution = Date.now();
    
    if (execution.duration) {
      metrics.metrics.avgExecutionTime = 
        alpha * execution.duration + (1 - alpha) * metrics.metrics.avgExecutionTime;
    }
    
    metrics.metrics.successRate = 
      alpha * (isSuccess ? 100 : 0) + (1 - alpha) * metrics.metrics.successRate;
    
    metrics.metrics.errorRate = 100 - metrics.metrics.successRate;
    
    metrics.metrics.throughput = 
      alpha * execution.performance.throughput + (1 - alpha) * metrics.metrics.throughput;

    // Update resource usage
    const memUsage = execution.metadata.memoryUsage.heapUsed / (1024 * 1024); // MB
    metrics.metrics.resourceUsage.avgMemory = 
      alpha * memUsage + (1 - alpha) * metrics.metrics.resourceUsage.avgMemory;
    
    metrics.metrics.resourceUsage.peakMemory = 
      Math.max(metrics.metrics.resourceUsage.peakMemory, memUsage);

    // Determine status
    metrics.status = this.calculateWorkflowStatus(metrics);
    
    // Update trends (simplified)
    metrics.trends = this.calculateTrends(execution.workflowId);
    
    metrics.lastUpdated = Date.now();
    
    this.workflowMetrics.set(execution.workflowId, metrics);
    
    if (this.config.exportMetrics) {
      this.metricsExporter.exportWorkflowMetrics(metrics);
    }
  }

  private calculateWorkflowStatus(metrics: WorkflowMetrics): 'healthy' | 'warning' | 'critical' {
    const { errorRate, avgExecutionTime } = metrics.metrics;
    const { errorRatePercent, executionTimeMs } = this.config.alertThresholds;
    
    if (errorRate > errorRatePercent * 2 || avgExecutionTime > executionTimeMs * 2) {
      return 'critical';
    }
    
    if (errorRate > errorRatePercent || avgExecutionTime > executionTimeMs) {
      return 'warning';
    }
    
    return 'healthy';
  }

  private calculateTrends(workflowId: string): WorkflowMetrics['trends'] {
    // This would analyze historical data to determine trends
    // For now, return stable trends
    return {
      executionTime: 'stable',
      reliability: 'stable',
      throughput: 'stable'
    };
  }

  private checkAlerts(execution: WorkflowExecution): void {
    const { alertThresholds } = this.config;
    
    // Check execution time alert
    if (execution.duration && execution.duration > alertThresholds.executionTimeMs) {
      this.alertManager.createAlert({
        type: 'performance',
        severity: execution.duration > alertThresholds.executionTimeMs * 2 ? 'critical' : 'warning',
        title: 'Slow Workflow Execution',
        message: `Workflow ${execution.workflowName} took ${Math.round(execution.duration / 1000)}s to complete`,
        metadata: {
          executionId: execution.id,
          workflowId: execution.workflowId,
          duration: execution.duration,
          threshold: alertThresholds.executionTimeMs
        }
      });
    }
    
    // Check error rate alert
    const errorRate = (execution.metadata.errorCount / execution.nodeExecutions.length) * 100;
    if (errorRate > alertThresholds.errorRatePercent) {
      this.alertManager.createAlert({
        type: 'reliability',
        severity: errorRate > alertThresholds.errorRatePercent * 2 ? 'critical' : 'warning',
        title: 'High Error Rate',
        message: `Workflow ${execution.workflowName} had ${errorRate.toFixed(1)}% error rate`,
        metadata: {
          executionId: execution.id,
          workflowId: execution.workflowId,
          errorRate,
          threshold: alertThresholds.errorRatePercent
        }
      });
    }
    
    // Check memory usage alert
    const memoryUsageMB = execution.metadata.memoryUsage.heapUsed / (1024 * 1024);
    if (memoryUsageMB > alertThresholds.memoryUsageMB) {
      this.alertManager.createAlert({
        type: 'resource',
        severity: memoryUsageMB > alertThresholds.memoryUsageMB * 2 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        message: `Workflow ${execution.workflowName} used ${memoryUsageMB.toFixed(1)}MB of memory`,
        metadata: {
          executionId: execution.id,
          workflowId: execution.workflowId,
          memoryUsage: memoryUsageMB,
          threshold: alertThresholds.memoryUsageMB
        }
      });
    }
  }

  private updateSystemMetrics(): void {
    // Update workflow engine metrics
    this.systemHealth.workflowEngine.activeExecutions = 
      this.performanceCollector.getMetrics().activeExecutions;
    
    this.systemHealth.workflowEngine.queueDepth = 
      this.performanceCollector.getMetrics().queueDepth;
    
    // Update resource usage
    const cpuUsage = process.cpuUsage();
    this.systemHealth.workflowEngine.cpuUsage = cpuUsage.user / 1000000; // Convert to seconds
    
    const memUsage = process.memoryUsage();
    this.systemHealth.workflowEngine.memoryUsage = 
      (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Calculate overall health score
    this.systemHealth.overall.score = this.calculateOverallHealthScore();
    this.systemHealth.overall.status = this.determineOverallStatus();
    
    if (this.config.exportMetrics) {
      this.metricsExporter.exportSystemHealth(this.systemHealth);
    }
    
    this.emit('system_metrics_updated', this.systemHealth);
  }

  private performHealthCheck(): void {
    // Perform various health checks
    this.checkWorkflowEngineHealth();
    this.checkDatabaseHealth();
    this.checkMessageQueueHealth();
    this.checkExternalServicesHealth();
    
    this.emit('health_check_completed', this.systemHealth);
  }

  private checkWorkflowEngineHealth(): void {
    const { workflowEngine } = this.systemHealth;
    
    // Check if engine is responsive
    if (workflowEngine.cpuUsage > 90) {
      workflowEngine.status = 'error';
    } else if (workflowEngine.cpuUsage > 70 || workflowEngine.memoryUsage > 80) {
      workflowEngine.status = 'warning';
    } else {
      workflowEngine.status = 'healthy';
    }
  }

  private checkDatabaseHealth(): void {
    // Mock database health check
    this.systemHealth.database.status = 'healthy';
    this.systemHealth.database.queryTime = Math.random() * 100;
  }

  private checkMessageQueueHealth(): void {
    // Mock message queue health check
    this.systemHealth.messageQueue.status = 'healthy';
    this.systemHealth.messageQueue.depth = Math.floor(Math.random() * 10);
  }

  private checkExternalServicesHealth(): void {
    // Mock external services health check
    this.systemHealth.externalServices.status = 'healthy';
    this.systemHealth.externalServices.responseTime = Math.random() * 1000;
    this.systemHealth.externalServices.availability = 99.5 + Math.random() * 0.5;
  }

  private calculateOverallHealthScore(): number {
    const scores = {
      workflowEngine: this.getComponentScore(this.systemHealth.workflowEngine.status),
      database: this.getComponentScore(this.systemHealth.database.status),
      messageQueue: this.getComponentScore(this.systemHealth.messageQueue.status),
      externalServices: this.getComponentScore(this.systemHealth.externalServices.status)
    };
    
    // Weighted average
    return (
      scores.workflowEngine * 0.4 +
      scores.database * 0.3 +
      scores.messageQueue * 0.2 +
      scores.externalServices * 0.1
    );
  }

  private getComponentScore(status: string): number {
    switch (status) {
      case 'healthy': return 100;
      case 'warning': return 70;
      case 'error': return 30;
      default: return 0;
    }
  }

  private determineOverallStatus(): 'healthy' | 'degraded' | 'critical' {
    const score = this.systemHealth.overall.score;
    
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'degraded';
    return 'critical';
  }

  // Cleanup and shutdown
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.removeAllListeners();
    
    logger.info('Workflow monitoring stopped');
  }
}