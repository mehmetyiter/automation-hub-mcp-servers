import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import * as ss from 'simple-statistics';
import { logger } from '../utils/logger';
import { MetricsStorage } from '../storage/MetricsStorage';
import { AlertManager } from '../alerts/AlertManager';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  duration?: number;
  nodeExecutions: NodeExecution[];
  metadata: {
    triggerType: 'manual' | 'webhook' | 'cron' | 'event';
    inputSize: number;
    outputSize: number;
    memoryUsage: MemoryUsage;
    cpuUsage: number;
    errorCount: number;
    retryCount: number;
  };
  performance: {
    totalTime: number;
    queueTime: number;
    executionTime: number;
    networkTime: number;
    dbTime: number;
    throughput: number;
    efficiency: number;
  };
}

export interface NodeExecution {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  inputCount: number;
  outputCount: number;
  errorMessage?: string;
  retryCount: number;
  performance: {
    cpuTime: number;
    memoryPeak: number;
    networkCalls: number;
    dbQueries: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface PerformanceMetrics {
  avgExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  queueDepth: number;
  activeExecutions: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
    disk: number;
  };
}

export class PerformanceCollector extends EventEmitter {
  private executions = new Map<string, WorkflowExecution>();
  private nodeExecutions = new Map<string, NodeExecution>();
  private metrics: PerformanceMetrics;
  private collectionInterval: NodeJS.Timeout;
  private metricsStorage: MetricsStorage;
  private alertManager: AlertManager;
  private samplingRate: number = 1.0; // Sample 100% by default
  private maxExecutionsInMemory: number = 10000;

  constructor(
    metricsStorage: MetricsStorage,
    alertManager: AlertManager,
    options: {
      collectionIntervalMs?: number;
      samplingRate?: number;
      maxExecutionsInMemory?: number;
    } = {}
  ) {
    super();
    
    this.metricsStorage = metricsStorage;
    this.alertManager = alertManager;
    this.samplingRate = options.samplingRate || 1.0;
    this.maxExecutionsInMemory = options.maxExecutionsInMemory || 10000;
    
    this.metrics = this.initializeMetrics();
    
    // Start metrics collection
    this.collectionInterval = setInterval(
      () => this.collectMetrics(),
      options.collectionIntervalMs || 30000
    );
    
    // Clean up old executions periodically
    setInterval(() => this.cleanupOldExecutions(), 300000); // Every 5 minutes
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      avgExecutionTime: 0,
      p50ExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      throughput: 0,
      errorRate: 0,
      successRate: 0,
      queueDepth: 0,
      activeExecutions: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        network: 0,
        disk: 0
      }
    };
  }

  // Start tracking a workflow execution
  startWorkflowExecution(
    workflowId: string,
    workflowName: string,
    userId: string,
    triggerType: 'manual' | 'webhook' | 'cron' | 'event',
    inputSize: number = 0
  ): string {
    // Apply sampling
    if (Math.random() > this.samplingRate) {
      return ''; // Return empty ID to indicate not tracked
    }

    const executionId = uuidv4();
    const startTime = performance.now();
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowName,
      userId,
      startTime,
      status: 'running',
      nodeExecutions: [],
      metadata: {
        triggerType,
        inputSize,
        outputSize: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: 0,
        errorCount: 0,
        retryCount: 0
      },
      performance: {
        totalTime: 0,
        queueTime: 0,
        executionTime: 0,
        networkTime: 0,
        dbTime: 0,
        throughput: 0,
        efficiency: 0
      }
    };

    this.executions.set(executionId, execution);
    
    logger.debug('Started tracking workflow execution', {
      executionId,
      workflowId,
      workflowName
    });

    this.emit('execution_started', execution);
    return executionId;
  }

  // End tracking a workflow execution
  endWorkflowExecution(
    executionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    outputSize: number = 0,
    errorMessage?: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      logger.warn('Attempted to end unknown execution', { executionId });
      return;
    }

    const endTime = performance.now();
    execution.endTime = endTime;
    execution.duration = endTime - execution.startTime;
    execution.status = status;
    execution.metadata.outputSize = outputSize;
    execution.metadata.memoryUsage = process.memoryUsage();

    // Calculate performance metrics
    this.calculateExecutionPerformance(execution);

    // Store metrics
    this.storeExecutionMetrics(execution);

    // Check for performance alerts
    this.checkPerformanceAlerts(execution);

    logger.debug('Ended tracking workflow execution', {
      executionId,
      duration: execution.duration,
      status
    });

    this.emit('execution_completed', execution);
  }

  // Start tracking a node execution
  startNodeExecution(
    executionId: string,
    nodeId: string,
    nodeName: string,
    nodeType: string,
    inputCount: number = 0
  ): string {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return ''; // Parent execution not tracked
    }

    const nodeExecutionId = uuidv4();
    const startTime = performance.now();

    const nodeExecution: NodeExecution = {
      id: nodeExecutionId,
      nodeId,
      nodeName,
      nodeType,
      executionId,
      startTime,
      status: 'running',
      inputCount,
      outputCount: 0,
      retryCount: 0,
      performance: {
        cpuTime: 0,
        memoryPeak: 0,
        networkCalls: 0,
        dbQueries: 0,
        cacheHits: 0,
        cacheMisses: 0
      }
    };

    this.nodeExecutions.set(nodeExecutionId, nodeExecution);
    execution.nodeExecutions.push(nodeExecution);

    this.emit('node_execution_started', nodeExecution);
    return nodeExecutionId;
  }

  // End tracking a node execution
  endNodeExecution(
    nodeExecutionId: string,
    status: 'completed' | 'failed' | 'skipped',
    outputCount: number = 0,
    errorMessage?: string,
    performanceData?: Partial<NodeExecution['performance']>
  ): void {
    const nodeExecution = this.nodeExecutions.get(nodeExecutionId);
    if (!nodeExecution) {
      return;
    }

    const endTime = performance.now();
    nodeExecution.endTime = endTime;
    nodeExecution.duration = endTime - nodeExecution.startTime;
    nodeExecution.status = status;
    nodeExecution.outputCount = outputCount;
    nodeExecution.errorMessage = errorMessage;

    // Update performance data
    if (performanceData) {
      Object.assign(nodeExecution.performance, performanceData);
    }

    // Update parent execution
    const execution = this.executions.get(nodeExecution.executionId);
    if (execution) {
      if (status === 'failed') {
        execution.metadata.errorCount++;
      }
    }

    this.emit('node_execution_completed', nodeExecution);
  }

  // Record performance event
  recordPerformanceEvent(
    executionId: string,
    eventType: 'network_call' | 'db_query' | 'cache_hit' | 'cache_miss' | 'retry',
    duration?: number,
    metadata?: any
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    switch (eventType) {
      case 'network_call':
        execution.performance.networkTime += duration || 0;
        break;
      case 'db_query':
        execution.performance.dbTime += duration || 0;
        break;
      case 'retry':
        execution.metadata.retryCount++;
        break;
    }

    this.emit('performance_event', {
      executionId,
      eventType,
      duration,
      metadata,
      timestamp: Date.now()
    });
  }

  // Get current performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get detailed execution statistics
  getExecutionStatistics(timeRangeMs: number = 3600000): {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    avgDuration: number;
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: number;
    errorRate: number;
    nodeStatistics: Map<string, {
      count: number;
      avgDuration: number;
      errorRate: number;
    }>;
  } {
    const now = Date.now();
    const cutoff = now - timeRangeMs;

    const recentExecutions = Array.from(this.executions.values())
      .filter(ex => ex.startTime >= cutoff && ex.endTime);

    const durations = recentExecutions
      .filter(ex => ex.duration)
      .map(ex => ex.duration!);

    const completedExecutions = recentExecutions.filter(ex => ex.status === 'completed');
    const failedExecutions = recentExecutions.filter(ex => ex.status === 'failed');

    const nodeStats = new Map<string, { count: number; avgDuration: number; errorRate: number }>();
    
    // Calculate node statistics
    recentExecutions.forEach(execution => {
      execution.nodeExecutions.forEach(node => {
        if (!node.duration) return;
        
        const key = `${node.nodeType}:${node.nodeName}`;
        const existing = nodeStats.get(key) || { count: 0, avgDuration: 0, errorRate: 0 };
        
        existing.count++;
        existing.avgDuration = ((existing.avgDuration * (existing.count - 1)) + node.duration) / existing.count;
        if (node.status === 'failed') {
          existing.errorRate = (existing.errorRate * (existing.count - 1) + 1) / existing.count;
        }
        
        nodeStats.set(key, existing);
      });
    });

    return {
      totalExecutions: recentExecutions.length,
      completedExecutions: completedExecutions.length,
      failedExecutions: failedExecutions.length,
      avgDuration: durations.length > 0 ? ss.mean(durations) : 0,
      percentiles: {
        p50: durations.length > 0 ? ss.quantile(durations, 0.5) : 0,
        p95: durations.length > 0 ? ss.quantile(durations, 0.95) : 0,
        p99: durations.length > 0 ? ss.quantile(durations, 0.99) : 0
      },
      throughput: recentExecutions.length / (timeRangeMs / 1000 / 60), // executions per minute
      errorRate: recentExecutions.length > 0 ? failedExecutions.length / recentExecutions.length : 0,
      nodeStatistics: nodeStats
    };
  }

  // Get workflow bottlenecks
  getWorkflowBottlenecks(workflowId: string, limit: number = 10): Array<{
    nodeType: string;
    nodeName: string;
    avgDuration: number;
    p95Duration: number;
    executionCount: number;
    bottleneckScore: number;
  }> {
    const workflowExecutions = Array.from(this.executions.values())
      .filter(ex => ex.workflowId === workflowId && ex.endTime);

    const nodePerformance = new Map<string, number[]>();

    workflowExecutions.forEach(execution => {
      execution.nodeExecutions.forEach(node => {
        if (node.duration) {
          const key = `${node.nodeType}:${node.nodeName}`;
          if (!nodePerformance.has(key)) {
            nodePerformance.set(key, []);
          }
          nodePerformance.get(key)!.push(node.duration);
        }
      });
    });

    const bottlenecks = Array.from(nodePerformance.entries())
      .map(([key, durations]) => {
        const [nodeType, nodeName] = key.split(':');
        const avgDuration = ss.mean(durations);
        const p95Duration = ss.quantile(durations, 0.95);
        
        // Calculate bottleneck score based on average duration and frequency
        const bottleneckScore = avgDuration * Math.log(durations.length + 1);
        
        return {
          nodeType,
          nodeName,
          avgDuration,
          p95Duration,
          executionCount: durations.length,
          bottleneckScore
        };
      })
      .sort((a, b) => b.bottleneckScore - a.bottleneckScore)
      .slice(0, limit);

    return bottlenecks;
  }

  private calculateExecutionPerformance(execution: WorkflowExecution): void {
    execution.performance.totalTime = execution.duration || 0;
    execution.performance.executionTime = execution.nodeExecutions
      .reduce((sum, node) => sum + (node.duration || 0), 0);
    
    // Calculate throughput (items per second)
    const totalItems = execution.metadata.inputSize + execution.metadata.outputSize;
    execution.performance.throughput = execution.duration ? 
      (totalItems / (execution.duration / 1000)) : 0;
    
    // Calculate efficiency (output/input ratio)
    execution.performance.efficiency = execution.metadata.inputSize > 0 ?
      execution.metadata.outputSize / execution.metadata.inputSize : 0;
  }

  private async storeExecutionMetrics(execution: WorkflowExecution): Promise<void> {
    try {
      await this.metricsStorage.storeWorkflowExecution(execution);
    } catch (error) {
      logger.error('Failed to store execution metrics', { 
        executionId: execution.id, 
        error 
      });
    }
  }

  private checkPerformanceAlerts(execution: WorkflowExecution): void {
    // Check for slow execution
    if (execution.duration && execution.duration > 300000) { // 5 minutes
      this.alertManager.createAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Workflow Execution',
        message: `Workflow ${execution.workflowName} took ${Math.round(execution.duration / 1000)}s to complete`,
        metadata: {
          executionId: execution.id,
          workflowId: execution.workflowId,
          duration: execution.duration
        }
      });
    }

    // Check for high error rate
    if (execution.metadata.errorCount > 5) {
      this.alertManager.createAlert({
        type: 'performance',
        severity: 'error',
        title: 'High Error Count',
        message: `Workflow ${execution.workflowName} had ${execution.metadata.errorCount} errors`,
        metadata: {
          executionId: execution.id,
          workflowId: execution.workflowId,
          errorCount: execution.metadata.errorCount
        }
      });
    }
  }

  private collectMetrics(): void {
    const stats = this.getExecutionStatistics();
    
    this.metrics = {
      avgExecutionTime: stats.avgDuration,
      p50ExecutionTime: stats.percentiles.p50,
      p95ExecutionTime: stats.percentiles.p95,
      p99ExecutionTime: stats.percentiles.p99,
      throughput: stats.throughput,
      errorRate: stats.errorRate * 100,
      successRate: (1 - stats.errorRate) * 100,
      queueDepth: this.getQueueDepth(),
      activeExecutions: Array.from(this.executions.values())
        .filter(ex => ex.status === 'running').length,
      resourceUtilization: this.getResourceUtilization()
    };

    this.emit('metrics_updated', this.metrics);
  }

  private getQueueDepth(): number {
    // This would integrate with your queue system
    return 0;
  }

  private getResourceUtilization(): PerformanceMetrics['resourceUtilization'] {
    const memUsage = process.memoryUsage();
    
    return {
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      memory: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      network: 0, // Would be calculated from network monitoring
      disk: 0 // Would be calculated from disk monitoring
    };
  }

  private cleanupOldExecutions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let cleanedCount = 0;
    
    for (const [id, execution] of this.executions.entries()) {
      if (execution.endTime && (now - execution.endTime > maxAge)) {
        this.executions.delete(id);
        cleanedCount++;
      }
    }

    // Also clean up if we have too many executions in memory
    if (this.executions.size > this.maxExecutionsInMemory) {
      const sortedExecutions = Array.from(this.executions.entries())
        .sort(([, a], [, b]) => (b.endTime || b.startTime) - (a.endTime || a.startTime));
      
      const toKeep = sortedExecutions.slice(0, this.maxExecutionsInMemory);
      this.executions.clear();
      
      toKeep.forEach(([id, execution]) => {
        this.executions.set(id, execution);
      });
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old executions', { cleanedCount });
    }
  }

  destroy(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    this.removeAllListeners();
  }
}