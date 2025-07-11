import { EventEmitter } from 'events';
import { PerformanceProfiler, RealTimeMetrics } from '../performance/performance-profiler.js';
import { HealthChecker, HealthStatus } from '../health/health-checker.js';
import { CircuitBreakerManager } from '../resilience/circuit-breaker.js';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';

export interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCPU?: number; // percentage
  targetMemory?: number; // percentage
  targetResponseTime?: number; // milliseconds
  targetThroughput?: number; // requests per second
  scaleUpThreshold: number; // percentage over target
  scaleDownThreshold: number; // percentage under target
  cooldownPeriod: number; // milliseconds
  evaluationPeriod: number; // milliseconds
  predictiveScaling?: boolean;
  costOptimization?: boolean;
}

export interface ScalingMetrics {
  cpu: number;
  memory: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  queueDepth: number;
  activeConnections: number;
}

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'maintain';
  currentInstances: number;
  targetInstances: number;
  reason: string;
  confidence: number;
  predictedImpact: ScalingImpact;
  constraints: ScalingConstraint[];
}

export interface ScalingImpact {
  performanceImprovement: number;
  costIncrease: number;
  resourceUtilization: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ScalingConstraint {
  type: 'cost' | 'resource' | 'dependency' | 'policy';
  description: string;
  impact: 'blocking' | 'warning';
}

export interface ScalingEvent {
  timestamp: Date;
  decision: ScalingDecision;
  metrics: ScalingMetrics;
  success: boolean;
  duration: number;
  error?: string;
}

export interface PredictiveModel {
  type: 'timeseries' | 'ml' | 'hybrid';
  accuracy: number;
  lastUpdated: Date;
  predictions: ScalingPrediction[];
}

export interface ScalingPrediction {
  timestamp: Date;
  predictedLoad: number;
  confidence: number;
  recommendedInstances: number;
}

export interface ResourcePool {
  id: string;
  type: 'compute' | 'memory' | 'storage' | 'network';
  available: number;
  allocated: number;
  reserved: number;
  cost: number;
}

export interface Instance {
  id: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  startTime: Date;
  lastHealthCheck: Date;
  metrics: ScalingMetrics;
  capacity: {
    cpu: number;
    memory: number;
    connections: number;
  };
  cost: number;
}

export class AutoScaler extends EventEmitter {
  private config: ScalingConfig;
  private instances: Map<string, Instance> = new Map();
  private scalingHistory: ScalingEvent[] = [];
  private metricsBuffer: Map<string, ScalingMetrics[]> = new Map();
  private lastScaleAction: Date | null = null;
  private profiler: PerformanceProfiler;
  private healthChecker: HealthChecker;
  private circuitBreaker: CircuitBreakerManager;
  private database: CodeGenerationDatabase;
  private predictiveModel?: PredictiveModel;
  private resourcePools: Map<string, ResourcePool> = new Map();
  private scalingInterval?: NodeJS.Timeout;
  private isScaling: boolean = false;

  constructor(config: ScalingConfig) {
    super();
    this.config = config;
    this.profiler = new PerformanceProfiler();
    this.healthChecker = new HealthChecker();
    this.circuitBreaker = new CircuitBreakerManager();
    this.database = new CodeGenerationDatabase();
    
    console.log('🚀 Auto-scaler initialized with config:', config);
    this.initializeInstances();
    this.setupMetricsCollection();
  }

  private initializeInstances(): void {
    // Start with minimum instances
    for (let i = 0; i < this.config.minInstances; i++) {
      this.createInstance();
    }
  }

  private createInstance(): Instance {
    const instance: Instance = {
      id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'starting',
      startTime: new Date(),
      lastHealthCheck: new Date(),
      metrics: {
        cpu: 0,
        memory: 0,
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        queueDepth: 0,
        activeConnections: 0
      },
      capacity: {
        cpu: 100,
        memory: 4096, // MB
        connections: 1000
      },
      cost: 0.1 // per hour
    };
    
    this.instances.set(instance.id, instance);
    this.emit('instance-created', instance);
    
    // Simulate instance startup
    setTimeout(() => {
      instance.status = 'running';
      this.emit('instance-started', instance);
    }, 5000);
    
    return instance;
  }

  private setupMetricsCollection(): void {
    // Start periodic evaluation
    this.scalingInterval = setInterval(() => {
      this.evaluateScaling();
    }, this.config.evaluationPeriod);
    
    // Subscribe to real-time metrics
    this.profiler.on('metrics', (metrics: RealTimeMetrics) => {
      this.updateMetrics(metrics);
    });
    
    // Subscribe to health events
    this.healthChecker.on('health-change', (status: HealthStatus) => {
      this.handleHealthChange(status);
    });
  }

  private updateMetrics(realTimeMetrics: RealTimeMetrics): void {
    // Convert real-time metrics to scaling metrics
    const scalingMetrics: ScalingMetrics = {
      cpu: (realTimeMetrics.cpu.total / 1000) * 100, // Convert to percentage
      memory: (realTimeMetrics.memory.heapUsed / realTimeMetrics.memory.heapTotal) * 100,
      responseTime: realTimeMetrics.eventLoop,
      throughput: 100, // Would need actual request tracking
      errorRate: 0, // Would need error tracking
      queueDepth: 0, // Would need queue monitoring
      activeConnections: this.instances.size * 50 // Estimate
    };
    
    // Buffer metrics for averaging
    const buffer = this.metricsBuffer.get('global') || [];
    buffer.push(scalingMetrics);
    
    // Keep only recent metrics
    const maxBufferSize = Math.floor(this.config.evaluationPeriod / 1000);
    if (buffer.length > maxBufferSize) {
      buffer.shift();
    }
    
    this.metricsBuffer.set('global', buffer);
  }

  private async evaluateScaling(): Promise<void> {
    if (this.isScaling) {
      console.log('⏳ Scaling evaluation skipped - scaling in progress');
      return;
    }
    
    // Check cooldown period
    if (this.lastScaleAction && 
        Date.now() - this.lastScaleAction.getTime() < this.config.cooldownPeriod) {
      console.log('❄️ Scaling evaluation skipped - in cooldown period');
      return;
    }
    
    try {
      const currentMetrics = this.getCurrentMetrics();
      const decision = await this.makeScalingDecision(currentMetrics);
      
      if (decision.action !== 'maintain') {
        await this.executeScalingDecision(decision, currentMetrics);
      }
      
      // Emit metrics for monitoring
      this.emit('scaling-evaluation', {
        metrics: currentMetrics,
        decision,
        instances: this.instances.size
      });
    } catch (error) {
      console.error('Scaling evaluation error:', error);
      this.emit('scaling-error', error);
    }
  }

  private getCurrentMetrics(): ScalingMetrics {
    const buffer = this.metricsBuffer.get('global') || [];
    
    if (buffer.length === 0) {
      return {
        cpu: 0,
        memory: 0,
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        queueDepth: 0,
        activeConnections: 0
      };
    }
    
    // Calculate averages
    const sum = buffer.reduce((acc, metrics) => ({
      cpu: acc.cpu + metrics.cpu,
      memory: acc.memory + metrics.memory,
      responseTime: acc.responseTime + metrics.responseTime,
      throughput: acc.throughput + metrics.throughput,
      errorRate: acc.errorRate + metrics.errorRate,
      queueDepth: acc.queueDepth + metrics.queueDepth,
      activeConnections: acc.activeConnections + metrics.activeConnections
    }), {
      cpu: 0,
      memory: 0,
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      queueDepth: 0,
      activeConnections: 0
    });
    
    const count = buffer.length;
    
    return {
      cpu: sum.cpu / count,
      memory: sum.memory / count,
      responseTime: sum.responseTime / count,
      throughput: sum.throughput / count,
      errorRate: sum.errorRate / count,
      queueDepth: sum.queueDepth / count,
      activeConnections: sum.activeConnections / count
    };
  }

  private async makeScalingDecision(metrics: ScalingMetrics): Promise<ScalingDecision> {
    const currentInstances = this.instances.size;
    let targetInstances = currentInstances;
    let reason = 'Metrics within target range';
    let confidence = 0.8;
    
    // Check if we need to scale up
    const scaleUpReasons: string[] = [];
    
    if (this.config.targetCPU && metrics.cpu > this.config.targetCPU * (1 + this.config.scaleUpThreshold / 100)) {
      scaleUpReasons.push(`CPU usage (${metrics.cpu.toFixed(1)}%) exceeds target`);
    }
    
    if (this.config.targetMemory && metrics.memory > this.config.targetMemory * (1 + this.config.scaleUpThreshold / 100)) {
      scaleUpReasons.push(`Memory usage (${metrics.memory.toFixed(1)}%) exceeds target`);
    }
    
    if (this.config.targetResponseTime && metrics.responseTime > this.config.targetResponseTime * (1 + this.config.scaleUpThreshold / 100)) {
      scaleUpReasons.push(`Response time (${metrics.responseTime.toFixed(1)}ms) exceeds target`);
    }
    
    if (this.config.targetThroughput && metrics.throughput > this.config.targetThroughput * (1 + this.config.scaleUpThreshold / 100)) {
      scaleUpReasons.push(`Throughput (${metrics.throughput.toFixed(1)} req/s) exceeds capacity`);
    }
    
    // Check if we need to scale down
    const scaleDownReasons: string[] = [];
    
    if (this.config.targetCPU && metrics.cpu < this.config.targetCPU * (1 - this.config.scaleDownThreshold / 100)) {
      scaleDownReasons.push(`CPU usage (${metrics.cpu.toFixed(1)}%) below target`);
    }
    
    if (this.config.targetMemory && metrics.memory < this.config.targetMemory * (1 - this.config.scaleDownThreshold / 100)) {
      scaleDownReasons.push(`Memory usage (${metrics.memory.toFixed(1)}%) below target`);
    }
    
    // Apply predictive scaling if enabled
    if (this.config.predictiveScaling) {
      const prediction = await this.getPrediction(metrics);
      if (prediction) {
        targetInstances = prediction.recommendedInstances;
        reason = `Predictive scaling: ${prediction.predictedLoad.toFixed(1)}% load expected`;
        confidence = prediction.confidence;
      }
    } else if (scaleUpReasons.length > 0 && currentInstances < this.config.maxInstances) {
      targetInstances = Math.min(currentInstances + 1, this.config.maxInstances);
      reason = scaleUpReasons.join(', ');
    } else if (scaleDownReasons.length > 0 && currentInstances > this.config.minInstances) {
      targetInstances = Math.max(currentInstances - 1, this.config.minInstances);
      reason = scaleDownReasons.join(', ');
    }
    
    // Determine action
    let action: 'scale-up' | 'scale-down' | 'maintain' = 'maintain';
    if (targetInstances > currentInstances) {
      action = 'scale-up';
    } else if (targetInstances < currentInstances) {
      action = 'scale-down';
    }
    
    // Check constraints
    const constraints = await this.checkConstraints(action, targetInstances);
    
    // Calculate predicted impact
    const predictedImpact = this.calculateImpact(currentInstances, targetInstances, metrics);
    
    return {
      action,
      currentInstances,
      targetInstances,
      reason,
      confidence,
      predictedImpact,
      constraints
    };
  }

  private async getPrediction(currentMetrics: ScalingMetrics): Promise<ScalingPrediction | null> {
    if (!this.predictiveModel) {
      // Initialize simple time-series prediction
      this.predictiveModel = {
        type: 'timeseries',
        accuracy: 0.7,
        lastUpdated: new Date(),
        predictions: []
      };
    }
    
    // Simple prediction based on historical trends
    const history = this.scalingHistory.slice(-10);
    if (history.length < 5) {
      return null;
    }
    
    // Calculate trend
    const recentLoads = history.map(e => (e.metrics.cpu + e.metrics.memory) / 2);
    const avgLoad = recentLoads.reduce((a, b) => a + b) / recentLoads.length;
    const trend = (recentLoads[recentLoads.length - 1] - recentLoads[0]) / recentLoads.length;
    
    const predictedLoad = avgLoad + trend * 5; // Predict 5 periods ahead
    const recommendedInstances = Math.ceil(predictedLoad / this.config.targetCPU! * this.instances.size);
    
    return {
      timestamp: new Date(),
      predictedLoad,
      confidence: 0.7,
      recommendedInstances: Math.max(this.config.minInstances, Math.min(this.config.maxInstances, recommendedInstances))
    };
  }

  private async checkConstraints(action: string, targetInstances: number): Promise<ScalingConstraint[]> {
    const constraints: ScalingConstraint[] = [];
    
    // Check cost constraints
    if (this.config.costOptimization) {
      const currentCost = this.calculateCost(this.instances.size);
      const targetCost = this.calculateCost(targetInstances);
      
      if (targetCost > currentCost * 1.5) {
        constraints.push({
          type: 'cost',
          description: `Cost would increase by ${((targetCost - currentCost) / currentCost * 100).toFixed(1)}%`,
          impact: 'warning'
        });
      }
    }
    
    // Check resource availability
    const availableResources = this.checkResourceAvailability();
    if (action === 'scale-up' && !availableResources) {
      constraints.push({
        type: 'resource',
        description: 'Insufficient resources available',
        impact: 'blocking'
      });
    }
    
    // Check dependencies
    const healthStatus = await this.healthChecker.getOverallHealth();
    if (healthStatus.status === 'unhealthy' && action === 'scale-up') {
      constraints.push({
        type: 'dependency',
        description: 'System health check failed',
        impact: 'blocking'
      });
    }
    
    return constraints;
  }

  private calculateImpact(
    currentInstances: number,
    targetInstances: number,
    metrics: ScalingMetrics
  ): ScalingImpact {
    const instanceDiff = targetInstances - currentInstances;
    const capacityIncrease = instanceDiff / currentInstances;
    
    return {
      performanceImprovement: capacityIncrease * 0.8 * 100, // 80% linear scaling
      costIncrease: capacityIncrease * 100,
      resourceUtilization: metrics.cpu / targetInstances,
      riskLevel: Math.abs(instanceDiff) > 2 ? 'high' : Math.abs(instanceDiff) > 1 ? 'medium' : 'low'
    };
  }

  private async executeScalingDecision(decision: ScalingDecision, metrics: ScalingMetrics): Promise<void> {
    const startTime = Date.now();
    this.isScaling = true;
    
    const event: ScalingEvent = {
      timestamp: new Date(),
      decision,
      metrics,
      success: false,
      duration: 0
    };
    
    try {
      // Check for blocking constraints
      const blockingConstraints = decision.constraints.filter(c => c.impact === 'blocking');
      if (blockingConstraints.length > 0) {
        throw new Error(`Scaling blocked: ${blockingConstraints[0].description}`);
      }
      
      console.log(`🔄 Executing scaling decision: ${decision.action} from ${decision.currentInstances} to ${decision.targetInstances}`);
      
      if (decision.action === 'scale-up') {
        await this.scaleUp(decision.targetInstances - decision.currentInstances);
      } else if (decision.action === 'scale-down') {
        await this.scaleDown(decision.currentInstances - decision.targetInstances);
      }
      
      event.success = true;
      this.lastScaleAction = new Date();
      
      console.log(`✅ Scaling completed successfully`);
    } catch (error) {
      event.error = error instanceof Error ? error.message : String(error);
      console.error('Scaling execution failed:', error);
      throw error;
    } finally {
      event.duration = Date.now() - startTime;
      this.scalingHistory.push(event);
      this.isScaling = false;
      
      // Keep history size manageable
      if (this.scalingHistory.length > 1000) {
        this.scalingHistory = this.scalingHistory.slice(-500);
      }
      
      this.emit('scaling-complete', event);
    }
  }

  private async scaleUp(count: number): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < count; i++) {
      promises.push(this.startNewInstance());
    }
    
    await Promise.all(promises);
  }

  private async startNewInstance(): Promise<void> {
    const instance = this.createInstance();
    
    // Wait for instance to be ready
    await new Promise<void>((resolve) => {
      const checkReady = setInterval(() => {
        if (instance.status === 'running') {
          clearInterval(checkReady);
          resolve();
        }
      }, 1000);
    });
    
    // Register instance with load balancer, service discovery, etc.
    await this.registerInstance(instance);
  }

  private async scaleDown(count: number): Promise<void> {
    // Select instances to terminate (oldest first)
    const instancesToTerminate = Array.from(this.instances.values())
      .filter(i => i.status === 'running')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, count);
    
    const promises: Promise<void>[] = [];
    
    for (const instance of instancesToTerminate) {
      promises.push(this.terminateInstance(instance));
    }
    
    await Promise.all(promises);
  }

  private async terminateInstance(instance: Instance): Promise<void> {
    console.log(`🛑 Terminating instance ${instance.id}`);
    
    instance.status = 'stopping';
    
    // Deregister from load balancer
    await this.deregisterInstance(instance);
    
    // Graceful shutdown
    await this.gracefulShutdown(instance);
    
    instance.status = 'stopped';
    this.instances.delete(instance.id);
    
    this.emit('instance-terminated', instance);
  }

  private async registerInstance(instance: Instance): Promise<void> {
    // Register with load balancer, service discovery, monitoring, etc.
    console.log(`📝 Registering instance ${instance.id}`);
    
    // Add health check
    await this.healthChecker.registerComponent({
      name: `instance-${instance.id}`,
      check: async () => ({
        status: instance.status === 'running' ? 'healthy' : 'unhealthy',
        message: `Instance is ${instance.status}`,
        details: {
          uptime: Date.now() - instance.startTime.getTime(),
          metrics: instance.metrics
        }
      }),
      interval: 30000,
      timeout: 5000,
      retries: 3,
      critical: false
    });
  }

  private async deregisterInstance(instance: Instance): Promise<void> {
    console.log(`📤 Deregistering instance ${instance.id}`);
    
    // Remove from health checker
    // In real implementation, would also remove from load balancer, etc.
  }

  private async gracefulShutdown(instance: Instance): Promise<void> {
    console.log(`🔄 Graceful shutdown of instance ${instance.id}`);
    
    // Wait for active connections to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (instance.metrics.activeConnections > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (instance.metrics.activeConnections > 0) {
      console.warn(`⚠️ Force closing ${instance.metrics.activeConnections} active connections`);
    }
  }

  private checkResourceAvailability(): boolean {
    // Check if we have enough resources to scale up
    // In real implementation, would check actual resource pools
    return true;
  }

  private calculateCost(instances: number): number {
    // Simple cost calculation
    const costPerInstance = 0.1; // per hour
    return instances * costPerInstance;
  }

  private handleHealthChange(status: HealthStatus): void {
    if (status.status === 'unhealthy') {
      console.warn('⚠️ Health check failed - pausing auto-scaling');
      // Could trigger immediate scale-up if critical
    }
  }

  // Public methods

  async updateConfig(newConfig: Partial<ScalingConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    console.log('📝 Auto-scaler configuration updated');
    this.emit('config-updated', this.config);
  }

  async forceScale(targetInstances: number): Promise<void> {
    console.log(`🔧 Force scaling to ${targetInstances} instances`);
    
    const currentInstances = this.instances.size;
    const decision: ScalingDecision = {
      action: targetInstances > currentInstances ? 'scale-up' : 
              targetInstances < currentInstances ? 'scale-down' : 'maintain',
      currentInstances,
      targetInstances,
      reason: 'Manual scaling request',
      confidence: 1.0,
      predictedImpact: this.calculateImpact(currentInstances, targetInstances, this.getCurrentMetrics()),
      constraints: []
    };
    
    await this.executeScalingDecision(decision, this.getCurrentMetrics());
  }

  getStatus(): {
    instances: number;
    runningInstances: number;
    metrics: ScalingMetrics;
    lastScaleAction: Date | null;
    isScaling: boolean;
    config: ScalingConfig;
  } {
    const runningInstances = Array.from(this.instances.values())
      .filter(i => i.status === 'running').length;
    
    return {
      instances: this.instances.size,
      runningInstances,
      metrics: this.getCurrentMetrics(),
      lastScaleAction: this.lastScaleAction,
      isScaling: this.isScaling,
      config: this.config
    };
  }

  getScalingHistory(limit: number = 50): ScalingEvent[] {
    return this.scalingHistory.slice(-limit);
  }

  async generateScalingReport(): Promise<string> {
    const status = this.getStatus();
    const history = this.getScalingHistory(20);
    
    const successfulScalings = history.filter(e => e.success).length;
    const avgScalingTime = history.reduce((sum, e) => sum + e.duration, 0) / history.length;
    
    return `
# Auto-Scaling Report
## Generated: ${new Date().toISOString()}

### Current Status
- Total Instances: ${status.instances}
- Running Instances: ${status.runningInstances}
- Is Scaling: ${status.isScaling ? 'Yes' : 'No'}
- Last Scale Action: ${status.lastScaleAction?.toISOString() || 'Never'}

### Configuration
- Min Instances: ${status.config.minInstances}
- Max Instances: ${status.config.maxInstances}
- Target CPU: ${status.config.targetCPU || 'Not set'}%
- Target Memory: ${status.config.targetMemory || 'Not set'}%
- Target Response Time: ${status.config.targetResponseTime || 'Not set'}ms
- Scale Up Threshold: ${status.config.scaleUpThreshold}%
- Scale Down Threshold: ${status.config.scaleDownThreshold}%
- Cooldown Period: ${status.config.cooldownPeriod / 1000}s

### Current Metrics
- CPU Usage: ${status.metrics.cpu.toFixed(1)}%
- Memory Usage: ${status.metrics.memory.toFixed(1)}%
- Response Time: ${status.metrics.responseTime.toFixed(1)}ms
- Throughput: ${status.metrics.throughput.toFixed(1)} req/s
- Error Rate: ${status.metrics.errorRate.toFixed(2)}%
- Active Connections: ${status.metrics.activeConnections}

### Scaling History (Last 20 Events)
- Total Events: ${history.length}
- Successful: ${successfulScalings} (${(successfulScalings / history.length * 100).toFixed(1)}%)
- Average Scaling Time: ${avgScalingTime.toFixed(0)}ms

${history.slice(-5).map(event => `
#### ${event.timestamp.toISOString()}
- Action: ${event.decision.action}
- Instances: ${event.decision.currentInstances} → ${event.decision.targetInstances}
- Reason: ${event.decision.reason}
- Success: ${event.success ? '✅' : '❌'}
- Duration: ${event.duration}ms
${event.error ? `- Error: ${event.error}` : ''}
`).join('\n')}

### Recommendations
${this.generateRecommendations(status, history).map(r => `- ${r}`).join('\n')}
`;
  }

  private generateRecommendations(status: any, history: ScalingEvent[]): string[] {
    const recommendations: string[] = [];
    
    // Check if scaling is too frequent
    const recentScalings = history.filter(e => 
      Date.now() - e.timestamp.getTime() < 3600000 // Last hour
    );
    
    if (recentScalings.length > 10) {
      recommendations.push('Scaling is happening too frequently. Consider increasing cooldown period or adjusting thresholds.');
    }
    
    // Check if we're hitting limits
    if (status.instances === status.config.maxInstances) {
      recommendations.push('At maximum capacity. Consider increasing max instances if load continues to be high.');
    }
    
    // Check scaling failures
    const failures = history.filter(e => !e.success);
    if (failures.length > history.length * 0.2) {
      recommendations.push('High scaling failure rate. Review error logs and constraints.');
    }
    
    // Check resource utilization
    if (status.metrics.cpu < 30 && status.instances > status.config.minInstances) {
      recommendations.push('Low CPU utilization. Consider more aggressive scale-down thresholds.');
    }
    
    if (status.metrics.memory > 80) {
      recommendations.push('High memory usage. Consider memory-optimized instances or increasing memory limits.');
    }
    
    return recommendations;
  }

  shutdown(): void {
    console.log('🛑 Shutting down auto-scaler');
    
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
    }
    
    // Terminate all instances gracefully
    const promises = Array.from(this.instances.values()).map(instance => 
      this.terminateInstance(instance)
    );
    
    Promise.all(promises).then(() => {
      console.log('✅ Auto-scaler shutdown complete');
    });
  }
}

// Factory function for creating auto-scalers with presets
export function createAutoScaler(preset: 'conservative' | 'balanced' | 'aggressive' | 'custom', customConfig?: Partial<ScalingConfig>): AutoScaler {
  const presets: Record<string, ScalingConfig> = {
    conservative: {
      minInstances: 2,
      maxInstances: 10,
      targetCPU: 70,
      targetMemory: 80,
      targetResponseTime: 500,
      scaleUpThreshold: 20,
      scaleDownThreshold: 30,
      cooldownPeriod: 300000, // 5 minutes
      evaluationPeriod: 60000, // 1 minute
      predictiveScaling: false,
      costOptimization: true
    },
    balanced: {
      minInstances: 2,
      maxInstances: 20,
      targetCPU: 60,
      targetMemory: 70,
      targetResponseTime: 300,
      scaleUpThreshold: 15,
      scaleDownThreshold: 25,
      cooldownPeriod: 180000, // 3 minutes
      evaluationPeriod: 30000, // 30 seconds
      predictiveScaling: true,
      costOptimization: true
    },
    aggressive: {
      minInstances: 3,
      maxInstances: 50,
      targetCPU: 50,
      targetMemory: 60,
      targetResponseTime: 200,
      scaleUpThreshold: 10,
      scaleDownThreshold: 20,
      cooldownPeriod: 60000, // 1 minute
      evaluationPeriod: 15000, // 15 seconds
      predictiveScaling: true,
      costOptimization: false
    },
    custom: {
      minInstances: 1,
      maxInstances: 10,
      scaleUpThreshold: 20,
      scaleDownThreshold: 30,
      cooldownPeriod: 180000,
      evaluationPeriod: 30000,
      ...customConfig
    }
  };
  
  const config = presets[preset] || presets.custom;
  return new AutoScaler(config);
}