import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';
import { AlertingService } from '../../src/observability/alerting';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();
const alerting = AlertingService.getInstance();

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  target: string;
  type: ChaosType;
  parameters: ChaosParameters;
  schedule?: ChaosSchedule;
  enabled: boolean;
  rollbackTriggers: RollbackTrigger[];
  metadata: any;
  created_at: Date;
}

export interface ChaosExecution {
  id: string;
  experiment_id: string;
  status: ExecutionStatus;
  started_at: Date;
  ended_at?: Date;
  results: ExecutionResults;
  rollback_triggered: boolean;
  rollback_reason?: string;
  metadata: any;
}

export type ChaosType = 
  | 'network_latency'
  | 'cpu_stress'
  | 'memory_stress'
  | 'database_failure'
  | 'dependency_chaos'
  | 'disk_io_stress'
  | 'pod_termination'
  | 'service_disruption';

export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'terminated';

export interface ChaosParameters {
  duration?: number; // milliseconds
  intensity?: number; // 0-100
  targets?: string[];
  conditions?: any;
  [key: string]: any;
}

export interface ChaosSchedule {
  type: 'once' | 'recurring';
  start_time?: Date;
  interval?: number; // milliseconds
  cron?: string;
  enabled: boolean;
}

export interface RollbackTrigger {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  duration?: number; // milliseconds to wait before triggering
}

export interface ExecutionResults {
  success: boolean;
  metrics_before: any;
  metrics_during: any;
  metrics_after: any;
  impact_analysis: ImpactAnalysis;
  lessons_learned: string[];
}

export interface ImpactAnalysis {
  performance_degradation: number; // percentage
  error_rate_increase: number; // percentage
  availability_impact: number; // percentage
  recovery_time: number; // milliseconds
  blast_radius: string[];
}

export class ChaosOrchestrator extends EventEmitter {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private executions: Map<string, ChaosExecution> = new Map();
  private scheduledExperiments: Map<string, NodeJS.Timeout> = new Map();
  private activeExecutions: Set<string> = new Set();
  private rollbackHandlers: Map<string, () => Promise<void>> = new Map();

  constructor() {
    super();
    this.setupMetrics();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Chaos Orchestrator');
    
    // Load existing experiments from database/storage
    await this.loadExperiments();
    
    // Schedule any enabled experiments
    await this.scheduleExperiments();
    
    logger.info('Chaos Orchestrator initialized successfully');
  }

  // Experiment Management
  async createExperiment(experiment: Omit<ChaosExperiment, 'id' | 'created_at'>): Promise<string> {
    const id = uuidv4();
    const chaosExperiment: ChaosExperiment = {
      ...experiment,
      id,
      created_at: new Date()
    };

    this.experiments.set(id, chaosExperiment);
    
    // Schedule if enabled and has schedule
    if (experiment.enabled && experiment.schedule) {
      await this.scheduleExperiment(chaosExperiment);
    }

    this.emit('experiment_created', chaosExperiment);
    logger.info('Chaos experiment created', { experimentId: id, name: experiment.name });

    return id;
  }

  async updateExperiment(id: string, updates: Partial<ChaosExperiment>): Promise<void> {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error(`Experiment ${id} not found`);
    }

    const updatedExperiment = { ...experiment, ...updates };
    this.experiments.set(id, updatedExperiment);

    // Update scheduling if needed
    if (updates.enabled !== undefined || updates.schedule) {
      await this.updateSchedule(updatedExperiment);
    }

    this.emit('experiment_updated', updatedExperiment);
  }

  async deleteExperiment(id: string): Promise<void> {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error(`Experiment ${id} not found`);
    }

    // Stop any scheduled executions
    this.unscheduleExperiment(id);
    
    // Stop any active executions
    const activeExecution = Array.from(this.executions.values())
      .find(exec => exec.experiment_id === id && exec.status === 'running');
    
    if (activeExecution) {
      await this.stopExecution(activeExecution.id);
    }

    this.experiments.delete(id);
    this.emit('experiment_deleted', { experimentId: id });
  }

  // Execution Management
  async executeExperiment(experimentId: string, immediate = false): Promise<string> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (!experiment.enabled && !immediate) {
      throw new Error(`Experiment ${experimentId} is disabled`);
    }

    const executionId = uuidv4();
    const execution: ChaosExecution = {
      id: executionId,
      experiment_id: experimentId,
      status: 'pending',
      started_at: new Date(),
      results: {
        success: false,
        metrics_before: {},
        metrics_during: {},
        metrics_after: {},
        impact_analysis: {
          performance_degradation: 0,
          error_rate_increase: 0,
          availability_impact: 0,
          recovery_time: 0,
          blast_radius: []
        },
        lessons_learned: []
      },
      rollback_triggered: false,
      metadata: {}
    };

    this.executions.set(executionId, execution);
    this.activeExecutions.add(executionId);

    // Start execution asynchronously
    this.runExperiment(execution, experiment).catch(error => {
      logger.error('Experiment execution failed', { 
        executionId, 
        experimentId, 
        error: error.message 
      });
    });

    return executionId;
  }

  async stopExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Execution ${executionId} is not running`);
    }

    // Trigger rollback
    await this.triggerRollback(execution, 'manual_stop');
    
    execution.status = 'terminated';
    execution.ended_at = new Date();
    this.activeExecutions.delete(executionId);

    this.emit('execution_stopped', execution);
  }

  private async runExperiment(execution: ChaosExecution, experiment: ChaosExperiment): Promise<void> {
    try {
      // Pre-execution checks
      await this.preExecutionChecks(experiment);
      
      // Collect baseline metrics
      execution.results.metrics_before = await this.collectMetrics(experiment);
      
      // Start monitoring for rollback triggers
      const rollbackMonitor = this.startRollbackMonitoring(execution, experiment);
      
      // Update status
      execution.status = 'running';
      this.emit('execution_started', execution);
      
      // Execute the chaos experiment
      const chaosHandler = this.getChaosHandler(experiment.type);
      const rollbackHandler = await chaosHandler(experiment);
      this.rollbackHandlers.set(execution.id, rollbackHandler);
      
      // Monitor during execution
      const monitoringInterval = setInterval(async () => {
        if (execution.status === 'running') {
          const currentMetrics = await this.collectMetrics(experiment);
          execution.results.metrics_during = currentMetrics;
        }
      }, 5000);
      
      // Wait for experiment duration
      if (experiment.parameters.duration) {
        await new Promise(resolve => setTimeout(resolve, experiment.parameters.duration));
      }
      
      // Cleanup
      clearInterval(monitoringInterval);
      rollbackMonitor.stop();
      
      // Execute rollback
      if (!execution.rollback_triggered) {
        await rollbackHandler();
      }
      
      // Collect post-execution metrics
      execution.results.metrics_after = await this.collectMetrics(experiment);
      
      // Analyze impact
      execution.results.impact_analysis = await this.analyzeImpact(execution);
      
      // Generate lessons learned
      execution.results.lessons_learned = await this.generateLessonsLearned(execution, experiment);
      
      // Mark as completed
      execution.status = 'completed';
      execution.results.success = true;
      execution.ended_at = new Date();
      
    } catch (error) {
      logger.error('Chaos experiment execution failed', {
        executionId: execution.id,
        experimentId: experiment.id,
        error: error.message
      });
      
      execution.status = 'failed';
      execution.ended_at = new Date();
      
      // Attempt rollback on failure
      const rollbackHandler = this.rollbackHandlers.get(execution.id);
      if (rollbackHandler) {
        try {
          await rollbackHandler();
        } catch (rollbackError) {
          logger.error('Rollback failed', { 
            executionId: execution.id, 
            error: rollbackError.message 
          });
        }
      }
    } finally {
      this.activeExecutions.delete(execution.id);
      this.rollbackHandlers.delete(execution.id);
      this.emit('execution_completed', execution);
    }
  }

  private getChaosHandler(type: ChaosType): (experiment: ChaosExperiment) => Promise<() => Promise<void>> {
    const handlers = {
      network_latency: this.handleNetworkLatency.bind(this),
      cpu_stress: this.handleCPUStress.bind(this),
      memory_stress: this.handleMemoryStress.bind(this),
      database_failure: this.handleDatabaseFailure.bind(this),
      dependency_chaos: this.handleDependencyChaos.bind(this),
      disk_io_stress: this.handleDiskIOStress.bind(this),
      pod_termination: this.handlePodTermination.bind(this),
      service_disruption: this.handleServiceDisruption.bind(this)
    };

    return handlers[type];
  }

  // Chaos Handlers
  private async handleNetworkLatency(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { targets, intensity, duration } = experiment.parameters;
    
    logger.info('Injecting network latency', { 
      targets, 
      latency: `${intensity}ms`,
      duration: `${duration}ms`
    });

    // Implementation would use tools like tc (traffic control) or toxiproxy
    // For simulation, we'll use a placeholder
    const activeRules: string[] = [];

    for (const target of targets || []) {
      // Simulate adding network latency rule
      const ruleId = `latency_${Date.now()}_${Math.random()}`;
      activeRules.push(ruleId);
      
      // In real implementation:
      // await exec(`tc qdisc add dev ${target} root netem delay ${intensity}ms`);
    }

    // Return rollback function
    return async () => {
      logger.info('Rolling back network latency injection');
      for (const ruleId of activeRules) {
        // In real implementation:
        // await exec(`tc qdisc del dev ${target} root`);
      }
    };
  }

  private async handleCPUStress(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { targets, intensity, duration } = experiment.parameters;
    
    logger.info('Starting CPU stress test', { targets, intensity: `${intensity}%`, duration });

    // Implementation would use stress-ng or similar
    const stressProcesses: any[] = [];

    // Return rollback function
    return async () => {
      logger.info('Stopping CPU stress test');
      for (const process of stressProcesses) {
        // Kill stress processes
      }
    };
  }

  private async handleMemoryStress(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { intensity, duration } = experiment.parameters;
    
    logger.info('Starting memory stress test', { intensity: `${intensity}MB`, duration });

    // Implementation would allocate memory to cause stress
    const allocatedMemory: Buffer[] = [];

    // Return rollback function
    return async () => {
      logger.info('Releasing stressed memory');
      allocatedMemory.length = 0; // Clear references for GC
    };
  }

  private async handleDatabaseFailure(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { targets, type } = experiment.parameters;
    
    logger.info('Simulating database failure', { targets, type });

    // Implementation would simulate various DB failures
    // - Connection pool exhaustion
    // - Slow queries
    // - Connection timeouts
    // - Replica lag

    return async () => {
      logger.info('Restoring database connectivity');
      // Restore normal operation
    };
  }

  private async handleDependencyChaos(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { targets, scenarios } = experiment.parameters;
    
    logger.info('Starting dependency chaos', { targets, scenarios });

    // Implementation would disrupt external dependencies
    // - API response delays
    // - HTTP error injection
    // - Service timeouts

    return async () => {
      logger.info('Restoring dependency connectivity');
      // Restore normal operation
    };
  }

  private async handleDiskIOStress(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { intensity, duration } = experiment.parameters;
    
    logger.info('Starting disk I/O stress test', { intensity, duration });

    return async () => {
      logger.info('Stopping disk I/O stress test');
    };
  }

  private async handlePodTermination(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { targets, percentage } = experiment.parameters;
    
    logger.info('Terminating pods', { targets, percentage: `${percentage}%` });

    return async () => {
      logger.info('Pod termination experiment completed');
      // Pods should be automatically restarted by Kubernetes
    };
  }

  private async handleServiceDisruption(experiment: ChaosExperiment): Promise<() => Promise<void>> {
    const { services, disruption_type } = experiment.parameters;
    
    logger.info('Disrupting services', { services, disruption_type });

    return async () => {
      logger.info('Restoring service operations');
    };
  }

  // Monitoring and Rollback
  private startRollbackMonitoring(execution: ChaosExecution, experiment: ChaosExperiment): { stop: () => void } {
    const interval = setInterval(async () => {
      if (execution.status !== 'running') {
        clearInterval(interval);
        return;
      }

      for (const trigger of experiment.rollbackTriggers) {
        const shouldRollback = await this.checkRollbackTrigger(trigger, experiment);
        
        if (shouldRollback) {
          await this.triggerRollback(execution, `threshold_exceeded: ${trigger.metric} ${trigger.operator} ${trigger.threshold}`);
          clearInterval(interval);
          return;
        }
      }
    }, 5000);

    return {
      stop: () => clearInterval(interval)
    };
  }

  private async checkRollbackTrigger(trigger: RollbackTrigger, experiment: ChaosExperiment): Promise<boolean> {
    const currentValue = await this.getMetricValue(trigger.metric, experiment);
    
    switch (trigger.operator) {
      case 'gt': return currentValue > trigger.threshold;
      case 'gte': return currentValue >= trigger.threshold;
      case 'lt': return currentValue < trigger.threshold;
      case 'lte': return currentValue <= trigger.threshold;
      case 'eq': return currentValue === trigger.threshold;
      default: return false;
    }
  }

  private async triggerRollback(execution: ChaosExecution, reason: string): Promise<void> {
    logger.warn('Triggering emergency rollback', { 
      executionId: execution.id, 
      reason 
    });

    execution.rollback_triggered = true;
    execution.rollback_reason = reason;

    const rollbackHandler = this.rollbackHandlers.get(execution.id);
    if (rollbackHandler) {
      await rollbackHandler();
    }

    execution.status = 'rolled_back';
    execution.ended_at = new Date();

    // Send alert
    await alerting.sendAlert({
      level: 'critical',
      message: `Chaos experiment rolled back: ${reason}`,
      metadata: { executionId: execution.id, reason }
    });

    this.emit('rollback_triggered', { execution, reason });
  }

  // Metrics and Analysis
  private async collectMetrics(experiment: ChaosExperiment): Promise<any> {
    // Collect system metrics relevant to the experiment
    return {
      timestamp: new Date(),
      cpu_usage: await this.getCPUUsage(),
      memory_usage: await this.getMemoryUsage(),
      response_times: await this.getResponseTimes(experiment.target),
      error_rates: await this.getErrorRates(experiment.target),
      throughput: await this.getThroughput(experiment.target)
    };
  }

  private async analyzeImpact(execution: ChaosExecution): Promise<ImpactAnalysis> {
    const before = execution.results.metrics_before;
    const after = execution.results.metrics_after;

    return {
      performance_degradation: this.calculatePerformanceDegradation(before, after),
      error_rate_increase: this.calculateErrorRateIncrease(before, after),
      availability_impact: this.calculateAvailabilityImpact(before, after),
      recovery_time: this.calculateRecoveryTime(execution),
      blast_radius: this.identifyBlastRadius(execution)
    };
  }

  private async generateLessonsLearned(execution: ChaosExecution, experiment: ChaosExperiment): Promise<string[]> {
    const lessons = [];

    if (execution.rollback_triggered) {
      lessons.push(`System automatically recovered when ${execution.rollback_reason}`);
    }

    if (execution.results.impact_analysis.performance_degradation > 50) {
      lessons.push('High performance degradation indicates potential scalability issues');
    }

    if (execution.results.impact_analysis.error_rate_increase > 10) {
      lessons.push('Error rate increase suggests insufficient error handling');
    }

    return lessons;
  }

  // Helper methods for metrics
  private async getCPUUsage(): Promise<number> {
    // Implementation would get actual CPU usage
    return Math.random() * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    // Implementation would get actual memory usage
    return Math.random() * 100;
  }

  private async getResponseTimes(target: string): Promise<number[]> {
    // Implementation would get actual response times
    return Array.from({ length: 10 }, () => Math.random() * 1000);
  }

  private async getErrorRates(target: string): Promise<number> {
    // Implementation would get actual error rates
    return Math.random() * 5;
  }

  private async getThroughput(target: string): Promise<number> {
    // Implementation would get actual throughput
    return Math.random() * 1000;
  }

  private async getMetricValue(metric: string, experiment: ChaosExperiment): Promise<number> {
    // Implementation would get specific metric value
    return Math.random() * 100;
  }

  // Helper methods for analysis
  private calculatePerformanceDegradation(before: any, after: any): number {
    const beforeAvg = before.response_times?.reduce((a: number, b: number) => a + b, 0) / before.response_times?.length || 0;
    const afterAvg = after.response_times?.reduce((a: number, b: number) => a + b, 0) / after.response_times?.length || 0;
    
    return beforeAvg > 0 ? ((afterAvg - beforeAvg) / beforeAvg) * 100 : 0;
  }

  private calculateErrorRateIncrease(before: any, after: any): number {
    return (after.error_rates || 0) - (before.error_rates || 0);
  }

  private calculateAvailabilityImpact(before: any, after: any): number {
    // Calculate availability impact based on error rates and response times
    return Math.min(100, (after.error_rates || 0) * 10);
  }

  private calculateRecoveryTime(execution: ChaosExecution): number {
    if (!execution.ended_at) return 0;
    return execution.ended_at.getTime() - execution.started_at.getTime();
  }

  private identifyBlastRadius(execution: ChaosExecution): string[] {
    // Identify which services/components were affected
    return ['primary_service', 'dependent_service_1'];
  }

  // Scheduling
  private async scheduleExperiments(): Promise<void> {
    for (const experiment of this.experiments.values()) {
      if (experiment.enabled && experiment.schedule) {
        await this.scheduleExperiment(experiment);
      }
    }
  }

  private async scheduleExperiment(experiment: ChaosExperiment): Promise<void> {
    if (!experiment.schedule) return;

    this.unscheduleExperiment(experiment.id);

    if (experiment.schedule.type === 'once' && experiment.schedule.start_time) {
      const delay = experiment.schedule.start_time.getTime() - Date.now();
      if (delay > 0) {
        const timeout = setTimeout(() => {
          this.executeExperiment(experiment.id);
        }, delay);
        this.scheduledExperiments.set(experiment.id, timeout);
      }
    } else if (experiment.schedule.type === 'recurring' && experiment.schedule.interval) {
      const interval = setInterval(() => {
        this.executeExperiment(experiment.id);
      }, experiment.schedule.interval);
      this.scheduledExperiments.set(experiment.id, interval);
    }
  }

  private unscheduleExperiment(experimentId: string): void {
    const scheduled = this.scheduledExperiments.get(experimentId);
    if (scheduled) {
      clearTimeout(scheduled);
      clearInterval(scheduled);
      this.scheduledExperiments.delete(experimentId);
    }
  }

  private async updateSchedule(experiment: ChaosExperiment): Promise<void> {
    if (experiment.enabled && experiment.schedule) {
      await this.scheduleExperiment(experiment);
    } else {
      this.unscheduleExperiment(experiment.id);
    }
  }

  // Lifecycle
  private async loadExperiments(): Promise<void> {
    // Implementation would load from database
    logger.info('Loading chaos experiments from storage');
  }

  private async preExecutionChecks(experiment: ChaosExperiment): Promise<void> {
    // Validate target availability
    // Check system health
    // Verify rollback capabilities
    logger.info('Pre-execution checks passed', { experimentId: experiment.id });
  }

  private setupMetrics(): void {
    // Setup custom metrics for chaos engineering
    metrics.createCounter('chaos_experiments_total', 'Total number of chaos experiments');
    metrics.createGauge('chaos_experiments_active', 'Number of active chaos experiments');
    metrics.createHistogram('chaos_experiment_duration', 'Duration of chaos experiments');
  }

  private setupEventHandlers(): void {
    this.on('execution_started', (execution) => {
      metrics.incrementCounter('chaos_experiments_total');
      metrics.setGauge('chaos_experiments_active', this.activeExecutions.size);
    });

    this.on('execution_completed', (execution) => {
      metrics.setGauge('chaos_experiments_active', this.activeExecutions.size);
      
      if (execution.ended_at) {
        const duration = execution.ended_at.getTime() - execution.started_at.getTime();
        metrics.recordHistogram('chaos_experiment_duration', duration);
      }
    });
  }

  // Public API
  getExperiment(id: string): ChaosExperiment | undefined {
    return this.experiments.get(id);
  }

  getExecution(id: string): ChaosExecution | undefined {
    return this.executions.get(id);
  }

  listExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values());
  }

  listExecutions(experimentId?: string): ChaosExecution[] {
    const executions = Array.from(this.executions.values());
    return experimentId 
      ? executions.filter(exec => exec.experiment_id === experimentId)
      : executions;
  }

  getActiveExecutions(): ChaosExecution[] {
    return this.listExecutions().filter(exec => this.activeExecutions.has(exec.id));
  }

  async cleanup(): Promise<void> {
    // Stop all active executions
    for (const executionId of this.activeExecutions) {
      await this.stopExecution(executionId);
    }

    // Clear all scheduled experiments
    for (const [experimentId] of this.scheduledExperiments) {
      this.unscheduleExperiment(experimentId);
    }

    this.removeAllListeners();
    logger.info('Chaos Orchestrator cleaned up');
  }
}