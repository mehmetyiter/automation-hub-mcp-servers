import { EventEmitter } from 'events';
import { 
  VisualFlow, 
  VisualBlock, 
  BlockType,
  FlowConnection 
} from './visual-code-builder.js';
import { MLFlowOptimizer, FlowFeatures } from './ml-flow-optimizer.js';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';
import { PerformanceProfiler } from '../performance/performance-profiler.js';

export interface PerformancePrediction {
  flowId: string;
  timestamp: Date;
  predictions: {
    executionTime: TimePrediction;
    memoryUsage: MemoryPrediction;
    cpuUsage: CPUPrediction;
    throughput: ThroughputPrediction;
    bottlenecks: BottleneckPrediction[];
    scalability: ScalabilityPrediction;
  };
  confidence: number;
  factors: PerformanceFactor[];
  recommendations: PerformanceRecommendation[];
  comparisonWithHistorical?: HistoricalComparison;
}

export interface TimePrediction {
  estimated: number; // milliseconds
  confidence: number;
  breakdown: {
    blockId: string;
    estimatedTime: number;
    isBottleneck: boolean;
  }[];
  worstCase: number;
  bestCase: number;
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface MemoryPrediction {
  peakUsage: number; // bytes
  averageUsage: number;
  confidence: number;
  hotspots: {
    blockId: string;
    estimatedMemory: number;
    reason: string;
  }[];
  leakRisk: {
    probability: number;
    potentialBlocks: string[];
  };
}

export interface CPUPrediction {
  averageUtilization: number; // percentage
  peakUtilization: number;
  confidence: number;
  intensiveOperations: {
    blockId: string;
    cpuIntensity: 'low' | 'medium' | 'high' | 'critical';
    estimatedCycles: number;
  }[];
}

export interface ThroughputPrediction {
  itemsPerSecond: number;
  confidence: number;
  bottleneckFactor: number; // 0-1, where 1 means no bottleneck
  limitingFactors: string[];
}

export interface BottleneckPrediction {
  blockId: string;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'algorithmic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number; // percentage of total execution time
  suggestion: string;
}

export interface ScalabilityPrediction {
  linearScalability: number; // 0-1, where 1 is perfectly linear
  maxEffectiveParallelism: number;
  scalingBottlenecks: string[];
  recommendedInstanceCount: number;
}

export interface PerformanceFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number; // -100 to 100
  description: string;
}

export interface PerformanceRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'optimization' | 'architecture' | 'configuration' | 'monitoring';
  title: string;
  description: string;
  expectedImprovement: number; // percentage
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

export interface HistoricalComparison {
  similarFlows: {
    flowId: string;
    similarity: number;
    actualPerformance: {
      executionTime: number;
      memoryUsage: number;
      cpuUsage: number;
    };
  }[];
  performanceRank: number; // percentile among similar flows
  trend: 'improving' | 'stable' | 'degrading';
}

export interface PredictionModel {
  type: 'regression' | 'neural-network' | 'ensemble';
  accuracy: number;
  trainingDataSize: number;
  lastUpdated: Date;
  features: string[];
}

interface BlockPerformanceProfile {
  type: BlockType;
  averageExecutionTime: number;
  memoryFootprint: number;
  cpuIntensity: number;
  ioOperations: number;
  networkCalls: number;
  complexityFactor: number;
}

export class FlowPerformancePredictor extends EventEmitter {
  private optimizer: MLFlowOptimizer;
  private database: CodeGenerationDatabase;
  private profiler: PerformanceProfiler;
  private blockProfiles: Map<BlockType, BlockPerformanceProfile>;
  private predictionModels: Map<string, PredictionModel>;
  private historicalData: Map<string, any[]>;
  private readonly PREDICTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private predictionCache: Map<string, { prediction: PerformancePrediction; timestamp: number }>;

  constructor() {
    super();
    this.optimizer = new MLFlowOptimizer();
    this.database = new CodeGenerationDatabase();
    this.profiler = new PerformanceProfiler();
    this.blockProfiles = new Map();
    this.predictionModels = new Map();
    this.historicalData = new Map();
    this.predictionCache = new Map();
    
    this.initializeBlockProfiles();
    this.loadHistoricalData();
    
    console.log('🔮 Flow Performance Predictor initialized');
  }

  private initializeBlockProfiles(): void {
    // Initialize with baseline performance profiles for each block type
    const profiles: Array<[BlockType, BlockPerformanceProfile]> = [
      [BlockType.INPUT, {
        type: BlockType.INPUT,
        averageExecutionTime: 5,
        memoryFootprint: 1024,
        cpuIntensity: 0.1,
        ioOperations: 1,
        networkCalls: 0,
        complexityFactor: 1
      }],
      [BlockType.TRANSFORM, {
        type: BlockType.TRANSFORM,
        averageExecutionTime: 20,
        memoryFootprint: 2048,
        cpuIntensity: 0.3,
        ioOperations: 0,
        networkCalls: 0,
        complexityFactor: 2
      }],
      [BlockType.FILTER, {
        type: BlockType.FILTER,
        averageExecutionTime: 15,
        memoryFootprint: 1536,
        cpuIntensity: 0.2,
        ioOperations: 0,
        networkCalls: 0,
        complexityFactor: 1.5
      }],
      [BlockType.AGGREGATE, {
        type: BlockType.AGGREGATE,
        averageExecutionTime: 30,
        memoryFootprint: 4096,
        cpuIntensity: 0.4,
        ioOperations: 0,
        networkCalls: 0,
        complexityFactor: 3
      }],
      [BlockType.API_CALL, {
        type: BlockType.API_CALL,
        averageExecutionTime: 200,
        memoryFootprint: 2048,
        cpuIntensity: 0.1,
        ioOperations: 0,
        networkCalls: 1,
        complexityFactor: 2
      }],
      [BlockType.DATABASE, {
        type: BlockType.DATABASE,
        averageExecutionTime: 100,
        memoryFootprint: 3072,
        cpuIntensity: 0.2,
        ioOperations: 1,
        networkCalls: 0,
        complexityFactor: 2.5
      }],
      [BlockType.LOOP, {
        type: BlockType.LOOP,
        averageExecutionTime: 50,
        memoryFootprint: 2048,
        cpuIntensity: 0.5,
        ioOperations: 0,
        networkCalls: 0,
        complexityFactor: 5
      }],
      [BlockType.CONDITION, {
        type: BlockType.CONDITION,
        averageExecutionTime: 10,
        memoryFootprint: 1024,
        cpuIntensity: 0.1,
        ioOperations: 0,
        networkCalls: 0,
        complexityFactor: 1.5
      }],
      [BlockType.OUTPUT, {
        type: BlockType.OUTPUT,
        averageExecutionTime: 5,
        memoryFootprint: 1024,
        cpuIntensity: 0.1,
        ioOperations: 1,
        networkCalls: 0,
        complexityFactor: 1
      }],
      [BlockType.CUSTOM, {
        type: BlockType.CUSTOM,
        averageExecutionTime: 50,
        memoryFootprint: 2048,
        cpuIntensity: 0.3,
        ioOperations: 0,
        networkCalls: 0,
        complexityFactor: 3
      }]
    ];
    
    profiles.forEach(([type, profile]) => {
      this.blockProfiles.set(type, profile);
    });
  }

  private async loadHistoricalData(): Promise<void> {
    try {
      // Load historical performance data from database
      const recentFlows = await this.database.getRecentWorkflows(100);
      
      for (const flow of recentFlows) {
        if (flow.performanceMetrics) {
          const flowId = flow.id;
          if (!this.historicalData.has(flowId)) {
            this.historicalData.set(flowId, []);
          }
          this.historicalData.get(flowId)!.push(flow.performanceMetrics);
        }
      }
      
      console.log(`📊 Loaded historical data for ${this.historicalData.size} flows`);
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }

  async predictFlowPerformance(flow: VisualFlow): Promise<PerformancePrediction> {
    console.log(`🔮 Predicting performance for flow: ${flow.id}`);
    
    // Check cache first
    const cached = this.predictionCache.get(flow.id);
    if (cached && Date.now() - cached.timestamp < this.PREDICTION_CACHE_TTL) {
      console.log('📦 Returning cached prediction');
      return cached.prediction;
    }
    
    try {
      // Extract flow features
      const features = await this.optimizer.extractFlowFeatures(flow);
      
      // Predict individual components
      const executionTime = await this.predictExecutionTime(flow, features);
      const memoryUsage = await this.predictMemoryUsage(flow, features);
      const cpuUsage = await this.predictCPUUsage(flow, features);
      const throughput = await this.predictThroughput(flow, features);
      const bottlenecks = await this.predictBottlenecks(flow, features);
      const scalability = await this.predictScalability(flow, features);
      
      // Analyze performance factors
      const factors = this.analyzePerformanceFactors(flow, features);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        flow,
        { executionTime, memoryUsage, cpuUsage, throughput, bottlenecks, scalability }
      );
      
      // Compare with historical data
      const historicalComparison = await this.compareWithHistorical(flow, features);
      
      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(
        executionTime.confidence,
        memoryUsage.confidence,
        cpuUsage.confidence,
        throughput.confidence
      );
      
      const prediction: PerformancePrediction = {
        flowId: flow.id,
        timestamp: new Date(),
        predictions: {
          executionTime,
          memoryUsage,
          cpuUsage,
          throughput,
          bottlenecks,
          scalability
        },
        confidence,
        factors,
        recommendations,
        comparisonWithHistorical: historicalComparison
      };
      
      // Cache the prediction
      this.predictionCache.set(flow.id, {
        prediction,
        timestamp: Date.now()
      });
      
      // Emit prediction event
      this.emit('prediction-complete', prediction);
      
      return prediction;
    } catch (error) {
      console.error('Performance prediction failed:', error);
      throw error;
    }
  }

  private async predictExecutionTime(flow: VisualFlow, features: FlowFeatures): Promise<TimePrediction> {
    const breakdown: TimePrediction['breakdown'] = [];
    let totalTime = 0;
    
    // Calculate execution time for each block
    const blockTimes = new Map<string, number>();
    
    for (const block of flow.blocks) {
      const profile = this.blockProfiles.get(block.type);
      if (!profile) continue;
      
      let blockTime = profile.averageExecutionTime;
      
      // Adjust based on parameters and connections
      blockTime *= this.getComplexityMultiplier(block, flow);
      
      // Special handling for loops
      if (block.type === BlockType.LOOP) {
        const iterations = this.estimateLoopIterations(block);
        blockTime *= iterations;
      }
      
      blockTimes.set(block.id, blockTime);
      totalTime += blockTime;
      
      breakdown.push({
        blockId: block.id,
        estimatedTime: blockTime,
        isBottleneck: false // Will be determined later
      });
    }
    
    // Account for parallel execution
    const parallelReduction = this.calculateParallelExecutionReduction(flow, blockTimes);
    totalTime -= parallelReduction;
    
    // Identify bottlenecks
    const avgBlockTime = totalTime / flow.blocks.length;
    breakdown.forEach(item => {
      item.isBottleneck = item.estimatedTime > avgBlockTime * 2;
    });
    
    // Calculate percentiles based on variability
    const variability = 0.2; // 20% variability
    const percentiles = {
      p50: totalTime,
      p95: totalTime * (1 + variability),
      p99: totalTime * (1 + variability * 2)
    };
    
    return {
      estimated: totalTime,
      confidence: this.calculateTimeConfidence(features),
      breakdown,
      worstCase: totalTime * 1.5,
      bestCase: totalTime * 0.8,
      percentiles
    };
  }

  private async predictMemoryUsage(flow: VisualFlow, features: FlowFeatures): Promise<MemoryPrediction> {
    const hotspots: MemoryPrediction['hotspots'] = [];
    let totalMemory = 0;
    let peakMemory = 0;
    
    // Calculate memory for each block
    for (const block of flow.blocks) {
      const profile = this.blockProfiles.get(block.type);
      if (!profile) continue;
      
      let blockMemory = profile.memoryFootprint;
      
      // Adjust based on data size estimates
      const dataMultiplier = this.estimateDataSizeMultiplier(block, flow);
      blockMemory *= dataMultiplier;
      
      totalMemory += blockMemory;
      peakMemory = Math.max(peakMemory, blockMemory);
      
      // Identify memory hotspots
      if (blockMemory > profile.memoryFootprint * 2) {
        hotspots.push({
          blockId: block.id,
          estimatedMemory: blockMemory,
          reason: this.getMemoryHotspotReason(block)
        });
      }
    }
    
    // Check for memory leak risks
    const leakRisk = this.assessMemoryLeakRisk(flow);
    
    return {
      peakUsage: peakMemory * 1.2, // Add 20% buffer
      averageUsage: totalMemory / flow.blocks.length,
      confidence: this.calculateMemoryConfidence(features),
      hotspots,
      leakRisk
    };
  }

  private async predictCPUUsage(flow: VisualFlow, features: FlowFeatures): Promise<CPUPrediction> {
    const intensiveOperations: CPUPrediction['intensiveOperations'] = [];
    let totalCPU = 0;
    let peakCPU = 0;
    
    for (const block of flow.blocks) {
      const profile = this.blockProfiles.get(block.type);
      if (!profile) continue;
      
      const cpuUsage = profile.cpuIntensity * 100; // Convert to percentage
      totalCPU += cpuUsage;
      peakCPU = Math.max(peakCPU, cpuUsage);
      
      // Determine CPU intensity
      let intensity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (cpuUsage > 80) intensity = 'critical';
      else if (cpuUsage > 60) intensity = 'high';
      else if (cpuUsage > 30) intensity = 'medium';
      
      intensiveOperations.push({
        blockId: block.id,
        cpuIntensity: intensity,
        estimatedCycles: cpuUsage * 1000000 // Rough estimate
      });
    }
    
    return {
      averageUtilization: totalCPU / flow.blocks.length,
      peakUtilization: peakCPU,
      confidence: this.calculateCPUConfidence(features),
      intensiveOperations
    };
  }

  private async predictThroughput(flow: VisualFlow, features: FlowFeatures): Promise<ThroughputPrediction> {
    // Estimate based on execution time and parallelization
    const executionTime = await this.predictExecutionTime(flow, features);
    const baseThoughput = 1000 / executionTime.estimated; // items per second
    
    // Identify limiting factors
    const limitingFactors: string[] = [];
    
    // Check for API rate limits
    const apiBlocks = flow.blocks.filter(b => b.type === BlockType.API_CALL);
    if (apiBlocks.length > 0) {
      limitingFactors.push('API rate limits');
    }
    
    // Check for database constraints
    const dbBlocks = flow.blocks.filter(b => b.type === BlockType.DATABASE);
    if (dbBlocks.length > 0) {
      limitingFactors.push('Database connection pool');
    }
    
    // Check for sequential bottlenecks
    if (features.parallelizableBlocks < flow.blocks.length * 0.3) {
      limitingFactors.push('Sequential processing');
    }
    
    const bottleneckFactor = 1 - (limitingFactors.length * 0.2);
    
    return {
      itemsPerSecond: baseThoughput * bottleneckFactor,
      confidence: this.calculateThroughputConfidence(features),
      bottleneckFactor,
      limitingFactors
    };
  }

  private async predictBottlenecks(flow: VisualFlow, features: FlowFeatures): Promise<BottleneckPrediction[]> {
    const bottlenecks: BottleneckPrediction[] = [];
    
    // Analyze each block for potential bottlenecks
    for (const block of flow.blocks) {
      const profile = this.blockProfiles.get(block.type);
      if (!profile) continue;
      
      // Network bottlenecks
      if (profile.networkCalls > 0) {
        bottlenecks.push({
          blockId: block.id,
          type: 'network',
          severity: profile.averageExecutionTime > 100 ? 'high' : 'medium',
          impact: (profile.averageExecutionTime / 1000) * 100, // Rough percentage
          suggestion: 'Consider caching, batching, or parallel requests'
        });
      }
      
      // I/O bottlenecks
      if (profile.ioOperations > 0) {
        bottlenecks.push({
          blockId: block.id,
          type: 'io',
          severity: 'medium',
          impact: 10,
          suggestion: 'Optimize I/O operations with buffering or async processing'
        });
      }
      
      // CPU bottlenecks
      if (profile.cpuIntensity > 0.6) {
        bottlenecks.push({
          blockId: block.id,
          type: 'cpu',
          severity: profile.cpuIntensity > 0.8 ? 'critical' : 'high',
          impact: profile.cpuIntensity * 50,
          suggestion: 'Optimize algorithm or consider distributed processing'
        });
      }
      
      // Algorithmic bottlenecks (loops, complex conditions)
      if (block.type === BlockType.LOOP && features.maxDepth > 3) {
        bottlenecks.push({
          blockId: block.id,
          type: 'algorithmic',
          severity: 'high',
          impact: 30,
          suggestion: 'Consider batch processing or reducing nested iterations'
        });
      }
    }
    
    // Sort by impact
    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private async predictScalability(flow: VisualFlow, features: FlowFeatures): Promise<ScalabilityPrediction> {
    // Calculate linear scalability based on parallelizable components
    const linearScalability = features.parallelizableBlocks / flow.blocks.length;
    
    // Estimate max effective parallelism
    const maxEffectiveParallelism = Math.min(
      features.parallelizableBlocks,
      Math.ceil(flow.blocks.length / 2)
    );
    
    // Identify scaling bottlenecks
    const scalingBottlenecks: string[] = [];
    
    if (features.dataFlowPatterns.some(p => p.pattern === 'linear')) {
      scalingBottlenecks.push('Sequential data dependencies');
    }
    
    const hasSharedState = flow.blocks.some(b => 
      b.type === BlockType.DATABASE || b.type === BlockType.AGGREGATE
    );
    if (hasSharedState) {
      scalingBottlenecks.push('Shared state management');
    }
    
    // Recommend instance count based on workload
    const recommendedInstanceCount = Math.max(
      1,
      Math.min(maxEffectiveParallelism, 10)
    );
    
    return {
      linearScalability,
      maxEffectiveParallelism,
      scalingBottlenecks,
      recommendedInstanceCount
    };
  }

  private analyzePerformanceFactors(flow: VisualFlow, features: FlowFeatures): PerformanceFactor[] {
    const factors: PerformanceFactor[] = [];
    
    // Complexity factor
    factors.push({
      name: 'Flow Complexity',
      impact: features.complexity > 50 ? 'negative' : 'neutral',
      magnitude: Math.min(features.complexity, 100),
      description: `Cyclomatic complexity: ${features.cyclomaticComplexity}`
    });
    
    // Parallelization factor
    factors.push({
      name: 'Parallelization Potential',
      impact: 'positive',
      magnitude: (features.parallelizableBlocks / flow.blocks.length) * 100,
      description: `${features.parallelizableBlocks} blocks can run in parallel`
    });
    
    // Data flow patterns
    features.dataFlowPatterns.forEach(pattern => {
      factors.push({
        name: `Data Flow Pattern: ${pattern.pattern}`,
        impact: pattern.pattern === 'parallel' ? 'positive' : 
                pattern.pattern === 'linear' ? 'negative' : 'neutral',
        magnitude: pattern.frequency * 20,
        description: `Occurs ${pattern.frequency} times in the flow`
      });
    });
    
    // Block type distribution
    const apiCallRatio = flow.blocks.filter(b => b.type === BlockType.API_CALL).length / flow.blocks.length;
    if (apiCallRatio > 0.3) {
      factors.push({
        name: 'High API Call Ratio',
        impact: 'negative',
        magnitude: apiCallRatio * 100,
        description: 'Network latency may impact performance'
      });
    }
    
    return factors;
  }

  private async generateRecommendations(
    flow: VisualFlow,
    predictions: any
  ): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    
    // Execution time recommendations
    if (predictions.executionTime.estimated > 5000) {
      recommendations.push({
        priority: 'high',
        type: 'optimization',
        title: 'Reduce Execution Time',
        description: 'Flow execution time exceeds 5 seconds',
        expectedImprovement: 30,
        implementation: 'Parallelize independent operations and optimize bottleneck blocks',
        effort: 'medium'
      });
    }
    
    // Memory recommendations
    if (predictions.memoryUsage.peakUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push({
        priority: 'medium',
        type: 'optimization',
        title: 'Optimize Memory Usage',
        description: 'Peak memory usage exceeds 100MB',
        expectedImprovement: 20,
        implementation: 'Stream data processing and reduce in-memory buffering',
        effort: 'medium'
      });
    }
    
    // Bottleneck recommendations
    predictions.bottlenecks.forEach(bottleneck => {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        recommendations.push({
          priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
          type: 'architecture',
          title: `Address ${bottleneck.type} bottleneck in ${bottleneck.blockId}`,
          description: bottleneck.suggestion,
          expectedImprovement: bottleneck.impact / 2,
          implementation: this.getBottleneckImplementation(bottleneck),
          effort: 'high'
        });
      }
    });
    
    // Scalability recommendations
    if (predictions.scalability.linearScalability < 0.5) {
      recommendations.push({
        priority: 'medium',
        type: 'architecture',
        title: 'Improve Scalability',
        description: 'Flow has limited parallelization potential',
        expectedImprovement: 40,
        implementation: 'Refactor to reduce dependencies and enable parallel execution',
        effort: 'high'
      });
    }
    
    // Monitoring recommendations
    if (predictions.confidence < 0.7) {
      recommendations.push({
        priority: 'low',
        type: 'monitoring',
        title: 'Add Performance Monitoring',
        description: 'Low prediction confidence due to limited historical data',
        expectedImprovement: 0,
        implementation: 'Implement APM monitoring to collect actual performance metrics',
        effort: 'low'
      });
    }
    
    // Sort by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return recommendations.sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    );
  }

  private async compareWithHistorical(
    flow: VisualFlow,
    features: FlowFeatures
  ): Promise<HistoricalComparison | undefined> {
    // Find similar flows
    const similarFlows: HistoricalComparison['similarFlows'] = [];
    
    for (const [flowId, historicalMetrics] of this.historicalData) {
      if (flowId === flow.id) continue;
      
      // Calculate similarity (simplified)
      const similarity = this.calculateFlowSimilarity(features, flowId);
      
      if (similarity > 0.7) {
        const latestMetrics = historicalMetrics[historicalMetrics.length - 1];
        similarFlows.push({
          flowId,
          similarity,
          actualPerformance: {
            executionTime: latestMetrics.executionTime || 0,
            memoryUsage: latestMetrics.memoryUsage || 0,
            cpuUsage: latestMetrics.cpuUsage || 0
          }
        });
      }
    }
    
    if (similarFlows.length === 0) {
      return undefined;
    }
    
    // Sort by similarity
    similarFlows.sort((a, b) => b.similarity - a.similarity);
    
    // Calculate performance rank
    const performanceRank = this.calculatePerformanceRank(flow, similarFlows);
    
    // Determine trend
    const trend = this.determinePerformanceTrend(flow.id);
    
    return {
      similarFlows: similarFlows.slice(0, 5), // Top 5 similar flows
      performanceRank,
      trend
    };
  }

  // Helper methods

  private getComplexityMultiplier(block: VisualBlock, flow: VisualFlow): number {
    let multiplier = 1;
    
    // More connections mean more complexity
    const connectionCount = block.connections.inputs.length + block.connections.outputs.length;
    multiplier *= 1 + (connectionCount * 0.1);
    
    // Parameters add complexity
    multiplier *= 1 + (block.parameters.length * 0.05);
    
    // Custom blocks are more complex
    if (block.type === BlockType.CUSTOM) {
      multiplier *= 1.5;
    }
    
    return multiplier;
  }

  private estimateLoopIterations(block: VisualBlock): number {
    // Look for iteration count in parameters
    const iterParam = block.parameters.find(p => 
      p.name.toLowerCase().includes('iter') || 
      p.name.toLowerCase().includes('count')
    );
    
    if (iterParam && typeof iterParam.value === 'number') {
      return iterParam.value;
    }
    
    // Default estimate
    return 10;
  }

  private calculateParallelExecutionReduction(
    flow: VisualFlow,
    blockTimes: Map<string, number>
  ): number {
    let reduction = 0;
    
    // Find parallel branches
    const parallelGroups = this.identifyParallelGroups(flow);
    
    parallelGroups.forEach(group => {
      const times = group.map(blockId => blockTimes.get(blockId) || 0);
      const maxTime = Math.max(...times);
      const totalTime = times.reduce((a, b) => a + b, 0);
      reduction += totalTime - maxTime;
    });
    
    return reduction;
  }

  private identifyParallelGroups(flow: VisualFlow): string[][] {
    const groups: string[][] = [];
    const visited = new Set<string>();
    
    // Simple parallel detection - blocks with same inputs
    const inputGroups = new Map<string, string[]>();
    
    flow.blocks.forEach(block => {
      const inputsKey = block.connections.inputs.sort().join(',');
      if (!inputGroups.has(inputsKey)) {
        inputGroups.set(inputsKey, []);
      }
      inputGroups.get(inputsKey)!.push(block.id);
    });
    
    inputGroups.forEach(group => {
      if (group.length > 1) {
        groups.push(group);
      }
    });
    
    return groups;
  }

  private calculateTimeConfidence(features: FlowFeatures): number {
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence for complex flows
    if (features.complexity > 100) confidence *= 0.8;
    if (features.cyclomaticComplexity > 20) confidence *= 0.9;
    
    // Reduce confidence for flows with many external calls
    const externalBlocks = features.blockTypes[BlockType.API_CALL] || 0;
    if (externalBlocks > 5) confidence *= 0.7;
    
    return Math.max(0.5, confidence);
  }

  private calculateMemoryConfidence(features: FlowFeatures): number {
    return 0.75; // Simplified for now
  }

  private calculateCPUConfidence(features: FlowFeatures): number {
    return 0.8; // Simplified for now
  }

  private calculateThroughputConfidence(features: FlowFeatures): number {
    return 0.7; // Simplified for now
  }

  private calculateOverallConfidence(...confidences: number[]): number {
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  private estimateDataSizeMultiplier(block: VisualBlock, flow: VisualFlow): number {
    // Estimate based on connections and block type
    if (block.type === BlockType.AGGREGATE) return 2;
    if (block.type === BlockType.LOOP) return 3;
    return 1;
  }

  private getMemoryHotspotReason(block: VisualBlock): string {
    if (block.type === BlockType.AGGREGATE) return 'Data aggregation requires buffering';
    if (block.type === BlockType.LOOP) return 'Loop iterations accumulate memory';
    if (block.type === BlockType.DATABASE) return 'Database result set buffering';
    return 'Large data processing';
  }

  private assessMemoryLeakRisk(flow: VisualFlow): MemoryPrediction['leakRisk'] {
    const riskBlocks: string[] = [];
    let probability = 0;
    
    // Loops with accumulation
    flow.blocks.forEach(block => {
      if (block.type === BlockType.LOOP) {
        const hasAccumulation = block.connections.outputs.some(output => {
          const target = flow.blocks.find(b => b.connections.inputs.includes(block.id));
          return target?.type === BlockType.AGGREGATE;
        });
        
        if (hasAccumulation) {
          riskBlocks.push(block.id);
          probability += 0.2;
        }
      }
      
      // Unclosed resources
      if (block.type === BlockType.DATABASE || block.type === BlockType.API_CALL) {
        riskBlocks.push(block.id);
        probability += 0.1;
      }
    });
    
    return {
      probability: Math.min(probability, 1),
      potentialBlocks: riskBlocks
    };
  }

  private getBottleneckImplementation(bottleneck: BottleneckPrediction): string {
    switch (bottleneck.type) {
      case 'network':
        return 'Implement request batching, caching, or use CDN for static resources';
      case 'cpu':
        return 'Optimize algorithm complexity, use web workers, or distribute processing';
      case 'memory':
        return 'Implement streaming, pagination, or memory pooling';
      case 'io':
        return 'Use async I/O, implement buffering, or optimize file access patterns';
      case 'algorithmic':
        return 'Refactor algorithm, reduce complexity, or implement memoization';
      default:
        return 'Analyze and optimize the specific operation';
    }
  }

  private calculateFlowSimilarity(features: FlowFeatures, otherFlowId: string): number {
    // Simplified similarity calculation
    // In real implementation, would compare actual flow features
    return Math.random() * 0.5 + 0.5; // 0.5 to 1.0
  }

  private calculatePerformanceRank(
    flow: VisualFlow,
    similarFlows: HistoricalComparison['similarFlows']
  ): number {
    // Simplified ranking
    return Math.floor(Math.random() * 100);
  }

  private determinePerformanceTrend(flowId: string): 'improving' | 'stable' | 'degrading' {
    const history = this.historicalData.get(flowId);
    if (!history || history.length < 3) return 'stable';
    
    // Simplified trend analysis
    const recent = history.slice(-3);
    const times = recent.map(h => h.executionTime || 0);
    
    const improving = times[0] > times[1] && times[1] > times[2];
    const degrading = times[0] < times[1] && times[1] < times[2];
    
    return improving ? 'improving' : degrading ? 'degrading' : 'stable';
  }

  // Public methods for updating predictions with actual data

  async updatePredictionAccuracy(
    flowId: string,
    actualMetrics: {
      executionTime: number;
      memoryUsage: number;
      cpuUsage: number;
      throughput: number;
    }
  ): Promise<void> {
    const cached = this.predictionCache.get(flowId);
    if (!cached) return;
    
    const prediction = cached.prediction;
    
    // Calculate accuracy
    const timeAccuracy = 1 - Math.abs(prediction.predictions.executionTime.estimated - actualMetrics.executionTime) / actualMetrics.executionTime;
    const memoryAccuracy = 1 - Math.abs(prediction.predictions.memoryUsage.peakUsage - actualMetrics.memoryUsage) / actualMetrics.memoryUsage;
    
    console.log(`📊 Prediction accuracy for ${flowId}:`);
    console.log(`  Time: ${(timeAccuracy * 100).toFixed(1)}%`);
    console.log(`  Memory: ${(memoryAccuracy * 100).toFixed(1)}%`);
    
    // Update historical data
    if (!this.historicalData.has(flowId)) {
      this.historicalData.set(flowId, []);
    }
    this.historicalData.get(flowId)!.push(actualMetrics);
    
    // Update model if accuracy is low
    if (timeAccuracy < 0.7 || memoryAccuracy < 0.7) {
      this.emit('model-update-needed', { flowId, accuracy: { timeAccuracy, memoryAccuracy } });
    }
  }

  clearCache(flowId?: string): void {
    if (flowId) {
      this.predictionCache.delete(flowId);
    } else {
      this.predictionCache.clear();
    }
  }

  async generatePerformanceReport(prediction: PerformancePrediction): Promise<string> {
    const { predictions, confidence, factors, recommendations } = prediction;
    
    return `
# Flow Performance Prediction Report
## Flow ID: ${prediction.flowId}
## Generated: ${prediction.timestamp.toISOString()}
## Confidence: ${(confidence * 100).toFixed(1)}%

### Execution Time Prediction
- **Estimated Time**: ${predictions.executionTime.estimated.toFixed(0)}ms
- **Best Case**: ${predictions.executionTime.bestCase.toFixed(0)}ms
- **Worst Case**: ${predictions.executionTime.worstCase.toFixed(0)}ms
- **P95**: ${predictions.executionTime.percentiles.p95.toFixed(0)}ms

#### Time Breakdown by Block:
${predictions.executionTime.breakdown
  .sort((a, b) => b.estimatedTime - a.estimatedTime)
  .slice(0, 5)
  .map(item => `- ${item.blockId}: ${item.estimatedTime.toFixed(0)}ms ${item.isBottleneck ? '⚠️ BOTTLENECK' : ''}`)
  .join('\n')}

### Memory Usage Prediction
- **Peak Usage**: ${(predictions.memoryUsage.peakUsage / 1024 / 1024).toFixed(1)}MB
- **Average Usage**: ${(predictions.memoryUsage.averageUsage / 1024 / 1024).toFixed(1)}MB
- **Memory Leak Risk**: ${(predictions.memoryUsage.leakRisk.probability * 100).toFixed(0)}%

${predictions.memoryUsage.hotspots.length > 0 ? `
#### Memory Hotspots:
${predictions.memoryUsage.hotspots
  .map(h => `- ${h.blockId}: ${(h.estimatedMemory / 1024 / 1024).toFixed(1)}MB - ${h.reason}`)
  .join('\n')}
` : ''}

### CPU Usage Prediction
- **Average Utilization**: ${predictions.cpuUsage.averageUtilization.toFixed(1)}%
- **Peak Utilization**: ${predictions.cpuUsage.peakUtilization.toFixed(1)}%

### Throughput Prediction
- **Estimated**: ${predictions.throughput.itemsPerSecond.toFixed(1)} items/second
- **Bottleneck Factor**: ${(predictions.throughput.bottleneckFactor * 100).toFixed(0)}%
${predictions.throughput.limitingFactors.length > 0 ? `
- **Limiting Factors**: ${predictions.throughput.limitingFactors.join(', ')}` : ''}

### Scalability Analysis
- **Linear Scalability**: ${(predictions.scalability.linearScalability * 100).toFixed(0)}%
- **Max Effective Parallelism**: ${predictions.scalability.maxEffectiveParallelism}
- **Recommended Instances**: ${predictions.scalability.recommendedInstanceCount}
${predictions.scalability.scalingBottlenecks.length > 0 ? `
- **Scaling Bottlenecks**: ${predictions.scalability.scalingBottlenecks.join(', ')}` : ''}

### Identified Bottlenecks
${predictions.bottlenecks.length > 0 ? predictions.bottlenecks
  .map(b => `
#### ${b.blockId} (${b.type} - ${b.severity})
- Impact: ${b.impact.toFixed(1)}% of execution time
- Suggestion: ${b.suggestion}`)
  .join('\n') : 'No significant bottlenecks identified'}

### Performance Factors
${factors
  .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude))
  .map(f => `- **${f.name}**: ${f.impact === 'positive' ? '✅' : f.impact === 'negative' ? '❌' : '➖'} ${f.magnitude.toFixed(0)}% - ${f.description}`)
  .join('\n')}

### Recommendations
${recommendations
  .map((r, i) => `
${i + 1}. **${r.title}** (${r.priority.toUpperCase()})
   - ${r.description}
   - Expected Improvement: ${r.expectedImprovement}%
   - Implementation: ${r.implementation}
   - Effort: ${r.effort}`)
  .join('\n')}

${prediction.comparisonWithHistorical ? `
### Historical Comparison
- **Performance Rank**: ${prediction.comparisonWithHistorical.performanceRank}th percentile
- **Trend**: ${prediction.comparisonWithHistorical.trend}
- **Similar Flows**: ${prediction.comparisonWithHistorical.similarFlows.length} found
` : ''}
`;
  }
}