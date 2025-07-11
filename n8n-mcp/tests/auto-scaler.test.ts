import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AutoScaler, createAutoScaler, ScalingConfig, ScalingMetrics, ScalingDecision } from '../src/code-generation/scaling/auto-scaler';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../src/code-generation/performance/performance-profiler');
jest.mock('../src/code-generation/health/health-checker');
jest.mock('../src/code-generation/resilience/circuit-breaker');
jest.mock('../src/code-generation/database/code-generation-db');

describe('AutoScaler', () => {
  let autoScaler: AutoScaler;
  let config: ScalingConfig;
  let mockMetricsEmitter: EventEmitter;

  beforeEach(() => {
    jest.useFakeTimers();
    
    config = {
      minInstances: 2,
      maxInstances: 10,
      targetCPU: 60,
      targetMemory: 70,
      targetResponseTime: 300,
      targetThroughput: 100,
      scaleUpThreshold: 20,
      scaleDownThreshold: 30,
      cooldownPeriod: 180000, // 3 minutes
      evaluationPeriod: 30000, // 30 seconds
      predictiveScaling: false,
      costOptimization: true
    };
    
    autoScaler = new AutoScaler(config);
    mockMetricsEmitter = new EventEmitter();
  });

  afterEach(() => {
    autoScaler.shutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with minimum instances', () => {
      const status = autoScaler.getStatus();
      expect(status.instances).toBe(config.minInstances);
    });

    it('should start metrics collection interval', () => {
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should accept custom configuration', () => {
      const customConfig: ScalingConfig = {
        minInstances: 5,
        maxInstances: 20,
        scaleUpThreshold: 10,
        scaleDownThreshold: 20,
        cooldownPeriod: 60000,
        evaluationPeriod: 10000
      };
      
      const customScaler = new AutoScaler(customConfig);
      const status = customScaler.getStatus();
      
      expect(status.instances).toBe(5);
      expect(status.config.maxInstances).toBe(20);
      
      customScaler.shutdown();
    });
  });

  describe('Metrics Collection', () => {
    it('should update metrics from real-time events', () => {
      const realTimeMetrics = {
        cpu: { total: 800 }, // 80% when converted
        memory: { heapUsed: 800, heapTotal: 1000 },
        eventLoop: 50,
        timestamp: Date.now()
      };
      
      // Simulate metrics event
      (autoScaler as any).updateMetrics(realTimeMetrics);
      
      // Advance time to trigger evaluation
      jest.advanceTimersByTime(config.evaluationPeriod);
      
      const status = autoScaler.getStatus();
      expect(status.metrics.cpu).toBeGreaterThan(0);
      expect(status.metrics.memory).toBeGreaterThan(0);
    });

    it('should buffer metrics for averaging', () => {
      // Send multiple metrics
      for (let i = 0; i < 5; i++) {
        (autoScaler as any).updateMetrics({
          cpu: { total: 500 + i * 100 },
          memory: { heapUsed: 700, heapTotal: 1000 },
          eventLoop: 30 + i * 10,
          timestamp: Date.now() + i * 1000
        });
      }
      
      const metrics = (autoScaler as any).getCurrentMetrics();
      expect(metrics.cpu).toBeGreaterThan(0);
      expect(metrics.responseTime).toBeGreaterThan(0);
    });
  });

  describe('Scaling Decisions', () => {
    it('should scale up when CPU exceeds threshold', async () => {
      const highCpuMetrics: ScalingMetrics = {
        cpu: 80, // target is 60%, threshold is 20%, so 72% triggers scale up
        memory: 50,
        responseTime: 200,
        throughput: 80,
        errorRate: 0,
        queueDepth: 0,
        activeConnections: 100
      };
      
      const decision = await (autoScaler as any).makeScalingDecision(highCpuMetrics);
      
      expect(decision.action).toBe('scale-up');
      expect(decision.targetInstances).toBeGreaterThan(decision.currentInstances);
      expect(decision.reason).toContain('CPU');
    });

    it('should scale down when metrics are below threshold', async () => {
      // First, force scale to have more instances
      await autoScaler.forceScale(5);
      
      const lowMetrics: ScalingMetrics = {
        cpu: 30, // target is 60%, threshold is 30%, so 42% triggers scale down
        memory: 40,
        responseTime: 100,
        throughput: 50,
        errorRate: 0,
        queueDepth: 0,
        activeConnections: 50
      };
      
      const decision = await (autoScaler as any).makeScalingDecision(lowMetrics);
      
      expect(decision.action).toBe('scale-down');
      expect(decision.targetInstances).toBeLessThan(decision.currentInstances);
    });

    it('should maintain instances when metrics are within range', async () => {
      const normalMetrics: ScalingMetrics = {
        cpu: 60,
        memory: 70,
        responseTime: 300,
        throughput: 100,
        errorRate: 0,
        queueDepth: 0,
        activeConnections: 100
      };
      
      const decision = await (autoScaler as any).makeScalingDecision(normalMetrics);
      
      expect(decision.action).toBe('maintain');
      expect(decision.targetInstances).toBe(decision.currentInstances);
    });

    it('should respect min and max instance limits', async () => {
      // Test max limit
      await autoScaler.forceScale(config.maxInstances);
      
      const highMetrics: ScalingMetrics = {
        cpu: 90,
        memory: 90,
        responseTime: 500,
        throughput: 200,
        errorRate: 0,
        queueDepth: 100,
        activeConnections: 500
      };
      
      const scaleUpDecision = await (autoScaler as any).makeScalingDecision(highMetrics);
      expect(scaleUpDecision.targetInstances).toBe(config.maxInstances);
      
      // Test min limit
      await autoScaler.forceScale(config.minInstances);
      
      const lowMetrics: ScalingMetrics = {
        cpu: 10,
        memory: 10,
        responseTime: 50,
        throughput: 10,
        errorRate: 0,
        queueDepth: 0,
        activeConnections: 10
      };
      
      const scaleDownDecision = await (autoScaler as any).makeScalingDecision(lowMetrics);
      expect(scaleDownDecision.targetInstances).toBe(config.minInstances);
    });
  });

  describe('Cooldown Period', () => {
    it('should respect cooldown period after scaling', async () => {
      // Trigger initial scale up
      const highMetrics: ScalingMetrics = {
        cpu: 80,
        memory: 80,
        responseTime: 400,
        throughput: 150,
        errorRate: 0,
        queueDepth: 50,
        activeConnections: 200
      };
      
      // Set metrics
      (autoScaler as any).metricsBuffer.set('global', [highMetrics]);
      
      // Trigger evaluation
      await (autoScaler as any).evaluateScaling();
      
      // Verify scaling happened
      expect((autoScaler as any).lastScaleAction).toBeDefined();
      
      // Try to scale again immediately
      const initialInstances = autoScaler.getStatus().instances;
      await (autoScaler as any).evaluateScaling();
      
      // Should not scale due to cooldown
      expect(autoScaler.getStatus().instances).toBe(initialInstances);
      
      // Advance past cooldown period
      jest.advanceTimersByTime(config.cooldownPeriod + 1000);
      
      // Now it should be able to scale again
      await (autoScaler as any).evaluateScaling();
      // Will scale based on metrics
    });
  });

  describe('Constraints Checking', () => {
    it('should check cost constraints when cost optimization is enabled', async () => {
      const decision: ScalingDecision = {
        action: 'scale-up',
        currentInstances: 5,
        targetInstances: 10,
        reason: 'High load',
        confidence: 0.9,
        predictedImpact: {
          performanceImprovement: 80,
          costIncrease: 100,
          resourceUtilization: 60,
          riskLevel: 'medium'
        },
        constraints: []
      };
      
      const constraints = await (autoScaler as any).checkConstraints('scale-up', 10);
      
      const costConstraint = constraints.find(c => c.type === 'cost');
      expect(costConstraint).toBeDefined();
      expect(costConstraint?.impact).toBe('warning');
    });

    it('should block scaling when health checks fail', async () => {
      // Mock unhealthy status
      const mockHealthChecker = (autoScaler as any).healthChecker;
      mockHealthChecker.getOverallHealth = jest.fn().mockResolvedValue({
        status: 'unhealthy',
        message: 'System unhealthy'
      });
      
      const constraints = await (autoScaler as any).checkConstraints('scale-up', 5);
      
      const healthConstraint = constraints.find(c => c.type === 'dependency');
      expect(healthConstraint).toBeDefined();
      expect(healthConstraint?.impact).toBe('blocking');
    });
  });

  describe('Predictive Scaling', () => {
    it('should use predictive scaling when enabled', async () => {
      const predictiveConfig = { ...config, predictiveScaling: true };
      const predictiveScaler = new AutoScaler(predictiveConfig);
      
      // Add historical data
      const history = [
        { metrics: { cpu: 50, memory: 50 } },
        { metrics: { cpu: 55, memory: 55 } },
        { metrics: { cpu: 60, memory: 60 } },
        { metrics: { cpu: 65, memory: 65 } },
        { metrics: { cpu: 70, memory: 70 } }
      ];
      
      (predictiveScaler as any).scalingHistory = history as any;
      
      const currentMetrics: ScalingMetrics = {
        cpu: 70,
        memory: 70,
        responseTime: 300,
        throughput: 100,
        errorRate: 0,
        queueDepth: 20,
        activeConnections: 150
      };
      
      const decision = await (predictiveScaler as any).makeScalingDecision(currentMetrics);
      
      expect(decision.reason).toContain('Predictive');
      
      predictiveScaler.shutdown();
    });

    it('should calculate predicted load based on trends', async () => {
      const predictiveConfig = { ...config, predictiveScaling: true };
      const predictiveScaler = new AutoScaler(predictiveConfig);
      
      // Create ascending trend
      const history = Array(10).fill(null).map((_, i) => ({
        timestamp: new Date(Date.now() - (10 - i) * 60000),
        metrics: { 
          cpu: 40 + i * 5, // 40, 45, 50, 55, 60, 65, 70, 75, 80, 85
          memory: 50 
        },
        decision: {} as any,
        success: true,
        duration: 100
      }));
      
      (predictiveScaler as any).scalingHistory = history;
      
      const prediction = await (predictiveScaler as any).getPrediction({ cpu: 85 });
      
      expect(prediction).toBeDefined();
      expect(prediction.predictedLoad).toBeGreaterThan(85);
      expect(prediction.confidence).toBeGreaterThan(0);
      
      predictiveScaler.shutdown();
    });
  });

  describe('Instance Management', () => {
    it('should create instances with proper initialization', () => {
      const instance = (autoScaler as any).createInstance();
      
      expect(instance.id).toMatch(/^instance-/);
      expect(instance.status).toBe('starting');
      expect(instance.capacity).toBeDefined();
      expect(instance.capacity.cpu).toBe(100);
      expect(instance.capacity.memory).toBe(4096);
      
      // Wait for startup
      jest.advanceTimersByTime(5000);
      expect(instance.status).toBe('running');
    });

    it('should terminate instances gracefully', async () => {
      const instance = (autoScaler as any).createInstance();
      jest.advanceTimersByTime(5000); // Let it start
      
      // Add active connections
      instance.metrics.activeConnections = 5;
      
      const terminatePromise = (autoScaler as any).terminateInstance(instance);
      
      // Should wait for connections
      expect(instance.status).toBe('stopping');
      
      // Clear connections
      instance.metrics.activeConnections = 0;
      
      await terminatePromise;
      
      expect(instance.status).toBe('stopped');
      expect((autoScaler as any).instances.has(instance.id)).toBe(false);
    });

    it('should force close connections after timeout', async () => {
      const instance = (autoScaler as any).createInstance();
      instance.metrics.activeConnections = 10;
      
      // Mock graceful shutdown to simulate timeout
      (autoScaler as any).gracefulShutdown = jest.fn().mockImplementation(async () => {
        instance.metrics.activeConnections = 5; // Some connections remain
      });
      
      await (autoScaler as any).terminateInstance(instance);
      
      expect((autoScaler as any).gracefulShutdown).toHaveBeenCalled();
    });
  });

  describe('Scaling Execution', () => {
    it('should execute scale up decisions', async () => {
      const initialCount = autoScaler.getStatus().instances;
      
      const decision: ScalingDecision = {
        action: 'scale-up',
        currentInstances: initialCount,
        targetInstances: initialCount + 2,
        reason: 'High load',
        confidence: 0.9,
        predictedImpact: {
          performanceImprovement: 50,
          costIncrease: 40,
          resourceUtilization: 70,
          riskLevel: 'low'
        },
        constraints: []
      };
      
      await (autoScaler as any).executeScalingDecision(decision, {} as any);
      
      // Wait for instances to start
      jest.advanceTimersByTime(5000);
      
      expect(autoScaler.getStatus().instances).toBe(initialCount + 2);
    });

    it('should execute scale down decisions', async () => {
      // First scale up
      await autoScaler.forceScale(5);
      jest.advanceTimersByTime(5000);
      
      const decision: ScalingDecision = {
        action: 'scale-down',
        currentInstances: 5,
        targetInstances: 3,
        reason: 'Low load',
        confidence: 0.8,
        predictedImpact: {
          performanceImprovement: -20,
          costIncrease: -40,
          resourceUtilization: 80,
          riskLevel: 'low'
        },
        constraints: []
      };
      
      await (autoScaler as any).executeScalingDecision(decision, {} as any);
      
      expect(autoScaler.getStatus().instances).toBe(3);
    });

    it('should block scaling with blocking constraints', async () => {
      const decision: ScalingDecision = {
        action: 'scale-up',
        currentInstances: 2,
        targetInstances: 4,
        reason: 'High load',
        confidence: 0.9,
        predictedImpact: {
          performanceImprovement: 50,
          costIncrease: 40,
          resourceUtilization: 70,
          riskLevel: 'low'
        },
        constraints: [{
          type: 'resource',
          description: 'Insufficient resources',
          impact: 'blocking'
        }]
      };
      
      await expect(
        (autoScaler as any).executeScalingDecision(decision, {} as any)
      ).rejects.toThrow('Scaling blocked');
    });
  });

  describe('Force Scaling', () => {
    it('should allow manual scaling override', async () => {
      await autoScaler.forceScale(7);
      jest.advanceTimersByTime(5000);
      
      expect(autoScaler.getStatus().instances).toBe(7);
    });

    it('should respect limits even in force scaling', async () => {
      await autoScaler.forceScale(20); // Above max
      jest.advanceTimersByTime(5000);
      
      expect(autoScaler.getStatus().instances).toBe(config.maxInstances);
      
      await autoScaler.forceScale(0); // Below min
      jest.advanceTimersByTime(5000);
      
      expect(autoScaler.getStatus().instances).toBe(config.minInstances);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', async () => {
      const newConfig: Partial<ScalingConfig> = {
        targetCPU: 70,
        maxInstances: 15,
        cooldownPeriod: 60000
      };
      
      await autoScaler.updateConfig(newConfig);
      
      const status = autoScaler.getStatus();
      expect(status.config.targetCPU).toBe(70);
      expect(status.config.maxInstances).toBe(15);
      expect(status.config.cooldownPeriod).toBe(60000);
    });
  });

  describe('Scaling History', () => {
    it('should track scaling events', async () => {
      // Trigger a scaling event
      await autoScaler.forceScale(4);
      
      const history = autoScaler.getScalingHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const lastEvent = history[history.length - 1];
      expect(lastEvent.decision.action).toBe('scale-up');
      expect(lastEvent.success).toBe(true);
      expect(lastEvent.duration).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      // Add many events
      for (let i = 0; i < 1500; i++) {
        (autoScaler as any).scalingHistory.push({
          timestamp: new Date(),
          decision: {} as any,
          metrics: {} as any,
          success: true,
          duration: 100
        });
      }
      
      // Should trim to last 500
      expect((autoScaler as any).scalingHistory.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive scaling report', async () => {
      // Add some history
      await autoScaler.forceScale(4);
      await autoScaler.forceScale(3);
      
      const report = await autoScaler.generateScalingReport();
      
      expect(report).toContain('Auto-Scaling Report');
      expect(report).toContain('Current Status');
      expect(report).toContain('Configuration');
      expect(report).toContain('Scaling History');
      expect(report).toContain('Recommendations');
    });

    it('should include performance metrics in report', async () => {
      // Set some metrics
      (autoScaler as any).metricsBuffer.set('global', [{
        cpu: 65,
        memory: 75,
        responseTime: 250,
        throughput: 120,
        errorRate: 0.02,
        queueDepth: 10,
        activeConnections: 150
      }]);
      
      const report = await autoScaler.generateScalingReport();
      
      expect(report).toContain('CPU Usage:');
      expect(report).toContain('Memory Usage:');
      expect(report).toContain('Response Time:');
      expect(report).toContain('Throughput:');
    });
  });

  describe('Factory Function', () => {
    it('should create conservative scaler', () => {
      const scaler = createAutoScaler('conservative');
      const config = scaler.getStatus().config;
      
      expect(config.scaleUpThreshold).toBe(20);
      expect(config.scaleDownThreshold).toBe(30);
      expect(config.cooldownPeriod).toBe(300000);
      
      scaler.shutdown();
    });

    it('should create balanced scaler', () => {
      const scaler = createAutoScaler('balanced');
      const config = scaler.getStatus().config;
      
      expect(config.predictiveScaling).toBe(true);
      expect(config.maxInstances).toBe(20);
      
      scaler.shutdown();
    });

    it('should create aggressive scaler', () => {
      const scaler = createAutoScaler('aggressive');
      const config = scaler.getStatus().config;
      
      expect(config.scaleUpThreshold).toBe(10);
      expect(config.evaluationPeriod).toBe(15000);
      expect(config.costOptimization).toBe(false);
      
      scaler.shutdown();
    });

    it('should create custom scaler with overrides', () => {
      const scaler = createAutoScaler('custom', {
        minInstances: 5,
        maxInstances: 25,
        targetCPU: 75
      });
      
      const config = scaler.getStatus().config;
      
      expect(config.minInstances).toBe(5);
      expect(config.maxInstances).toBe(25);
      expect(config.targetCPU).toBe(75);
      
      scaler.shutdown();
    });
  });

  describe('Event Emissions', () => {
    it('should emit events for instance lifecycle', async () => {
      const events: any[] = [];
      
      autoScaler.on('instance-created', (instance) => {
        events.push({ type: 'created', instance });
      });
      
      autoScaler.on('instance-started', (instance) => {
        events.push({ type: 'started', instance });
      });
      
      autoScaler.on('instance-terminated', (instance) => {
        events.push({ type: 'terminated', instance });
      });
      
      // Scale up
      await autoScaler.forceScale(3);
      jest.advanceTimersByTime(5000);
      
      // Scale down
      await autoScaler.forceScale(2);
      
      expect(events.some(e => e.type === 'created')).toBe(true);
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'terminated')).toBe(true);
    });

    it('should emit scaling events', async () => {
      const events: any[] = [];
      
      autoScaler.on('scaling-evaluation', (data) => {
        events.push({ type: 'evaluation', data });
      });
      
      autoScaler.on('scaling-complete', (event) => {
        events.push({ type: 'complete', event });
      });
      
      await autoScaler.forceScale(3);
      
      expect(events.some(e => e.type === 'complete')).toBe(true);
    });
  });
});