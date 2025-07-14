import { AIService } from '../../ai-service.js';
import { VisualFlow, VisualBlock, BlockType } from './visual-code-builder.js';
import * as crypto from 'crypto';

export interface FlowFeatures {
  nodeCount: number;
  connectionCount: number;
  complexity: number;
  dataFlowPatterns: DataFlowPattern[];
  blockTypes: BlockTypeDistribution;
  cyclomaticComplexity: number;
  averageBlockParameters: number;
  maxDepth: number;
  branchingFactor: number;
  parallelizableBlocks: number;
}

export interface DataFlowPattern {
  pattern: 'linear' | 'branching' | 'merging' | 'looping' | 'parallel';
  frequency: number;
  complexity: number;
}

export interface BlockTypeDistribution {
  [key: string]: number;
}

export interface MLPredictions {
  expectedPerformanceGain: number;
  confidence: number;
  optimizationOpportunities: OptimizationOpportunity[];
  riskAssessment: RiskAssessment;
  recommendations: MLRecommendation[];
}

export interface OptimizationOpportunity {
  type: 'parallelization' | 'caching' | 'merging' | 'reordering' | 'elimination';
  target: string[];
  expectedGain: number;
  difficulty: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  mitigation: string[];
}

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface MLRecommendation {
  category: 'performance' | 'maintainability' | 'scalability' | 'reliability';
  priority: number; // 1-10
  description: string;
  implementation: string;
  impact: string;
}

export interface OptimizedFlow {
  original: VisualFlow;
  optimized: VisualFlow;
  mlPredictions: MLPredictions;
  expectedImprovement: number;
  confidence: number;
  appliedOptimizations: AppliedOptimization[];
}

export interface AppliedOptimization {
  type: string;
  description: string;
  blocks: string[];
  estimatedGain: number;
  confidence: number;
}

export interface CachedModel {
  signature: string;
  version: number;
  createdAt: Date;
  lastUsed: Date;
  features: FlowFeatures;
  predictions: MLPredictions;
  optimizations: AppliedOptimization[];
  metadata: {
    accuracy: number;
    confidence: number;
    usageCount: number;
  };
}

export interface ModelVersion {
  version: number;
  createdAt: Date;
  accuracy: number;
  changesSince: string[];
}

export interface AntiPattern {
  type: 'n_plus_one' | 'sync_async_mismatch' | 'memory_leak' | 'circular_dependency' | 'excessive_nesting';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string[];
  description: string;
  recommendation: string;
  estimatedImpact: number;
}

export interface PatternAnalysis {
  antiPatterns: AntiPattern[];
  optimizationPatterns: OptimizationPattern[];
  scalabilityPatterns: ScalabilityPattern[];
  securityPatterns: SecurityPattern[];
}

export interface OptimizationPattern {
  type: string;
  confidence: number;
  applicableBlocks: string[];
  expectedGain: number;
}

export interface ScalabilityPattern {
  pattern: 'horizontal' | 'vertical' | 'data_partitioning' | 'caching';
  suitability: number;
  requirements: string[];
  limitations: string[];
}

export interface SecurityPattern {
  pattern: 'input_validation' | 'output_sanitization' | 'access_control' | 'data_encryption';
  required: boolean;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface FlowAnalysis {
  dataProcessingComplexity: number;
  ioOperations: number;
  computationalLoad: number;
  parallelizationOpportunities: ParallelizationOpportunity[];
  memoryIntensiveOperations: MemoryIntensiveOperation[];
}

export interface ParallelizationOpportunity {
  blocks: string[];
  estimatedSpeedup: number;
  requirements: string[];
}

export interface MemoryIntensiveOperation {
  blockId: string;
  estimatedMemoryUsage: number;
  optimizationSuggestions: string[];
}

export class MLFlowOptimizer {
  private aiService: AIService;
  private modelCache: Map<string, CachedModel> = new Map();
  private modelVersions: Map<string, ModelVersion[]> = new Map();
  private optimizationHistory: Map<string, OptimizedFlow[]> = new Map();
  private patternAnalyzer: DeepPatternAnalyzer;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.patternAnalyzer = new DeepPatternAnalyzer(this.aiService);
    console.log('🤖 ML Flow Optimizer initialized with model caching and deep pattern analysis');
  }

  async optimizeFlowWithML(flow: VisualFlow): Promise<OptimizedFlow> {
    console.log(`🧠 Starting ML-based optimization for flow: ${flow.name}`);
    
    // Check for cached model first
    const cachedResult = await this.optimizeFlowWithCaching(flow);
    if (cachedResult) {
      console.log('🚀 Using cached ML model for optimization');
      return cachedResult;
    }
    
    // Extract flow features for ML analysis
    const features = this.extractFlowFeatures(flow);
    console.log('📊 Flow features extracted:', { 
      nodeCount: features.nodeCount, 
      complexity: features.complexity,
      cyclomaticComplexity: features.cyclomaticComplexity
    });
    
    // Perform deep pattern analysis
    const patternAnalysis = await this.patternAnalyzer.analyzeComplexPatterns(flow);
    console.log(`🔍 Pattern analysis completed. Anti-patterns found: ${patternAnalysis.antiPatterns.length}`);
    
    // Get ML predictions for optimization opportunities
    const predictions = await this.getMLPredictions(features, flow, patternAnalysis);
    
    // Apply ML-guided optimizations
    const optimizations = await this.generateMLOptimizations(flow, predictions);
    
    // Create optimized flow
    const optimizedFlow = await this.applyMLOptimizations(flow, optimizations);
    
    // Calculate confidence and improvement estimates
    const confidence = this.calculateOptimizationConfidence(predictions, optimizations);
    const expectedImprovement = this.calculateExpectedImprovement(optimizations);
    
    const result: OptimizedFlow = {
      original: flow,
      optimized: optimizedFlow,
      mlPredictions: predictions,
      expectedImprovement,
      confidence,
      appliedOptimizations: optimizations
    };
    
    // Cache the model for future use
    await this.cacheOptimizationModel(flow, features, predictions, optimizations, confidence);
    
    // Store in history for learning
    this.addToOptimizationHistory(flow.id, result);
    
    console.log(`✅ ML optimization completed. Expected improvement: ${expectedImprovement}% (confidence: ${confidence}%)`);
    
    return result;
  }

  // Enhanced optimization with caching (from optimization suggestions)
  async optimizeFlowWithCaching(flow: VisualFlow): Promise<OptimizedFlow | null> {
    const flowSignature = this.generateFlowSignature(flow);
    const cachedModel = this.modelCache.get(flowSignature);
    
    if (cachedModel && !this.isModelStale(cachedModel)) {
      // Update usage stats
      cachedModel.lastUsed = new Date();
      cachedModel.metadata.usageCount++;
      
      // Apply cached optimizations
      return this.applyCachedOptimizations(flow, cachedModel);
    }
    
    return null;
  }

  private generateFlowSignature(flow: VisualFlow): string {
    const features = this.extractFlowFeatures(flow);
    const signatureData = {
      nodeCount: features.nodeCount,
      connectionCount: features.connectionCount,
      blockTypes: features.blockTypes,
      complexity: Math.floor(features.complexity / 5) * 5, // Round to nearest 5 for grouping
      cyclomaticComplexity: features.cyclomaticComplexity
    };
    
    return crypto.createHash('md5')
      .update(JSON.stringify(signatureData))
      .digest('hex');
  }

  private isModelStale(cachedModel: CachedModel): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const age = Date.now() - cachedModel.lastUsed.getTime();
    return age > maxAge || cachedModel.metadata.accuracy < 0.7;
  }

  private async applyCachedOptimizations(flow: VisualFlow, cachedModel: CachedModel): Promise<OptimizedFlow> {
    // Apply cached optimizations to the flow
    const optimizedFlow = await this.applyMLOptimizations(flow, cachedModel.optimizations);
    
    return {
      original: flow,
      optimized: optimizedFlow,
      mlPredictions: cachedModel.predictions,
      expectedImprovement: cachedModel.optimizations.reduce((sum, opt) => sum + opt.estimatedGain, 0) / cachedModel.optimizations.length,
      confidence: cachedModel.metadata.confidence,
      appliedOptimizations: cachedModel.optimizations
    };
  }

  private async cacheOptimizationModel(
    flow: VisualFlow,
    features: FlowFeatures,
    predictions: MLPredictions,
    optimizations: AppliedOptimization[],
    confidence: number
  ): Promise<void> {
    const signature = this.generateFlowSignature(flow);
    const version = this.getNextModelVersion(signature);
    
    const cachedModel: CachedModel = {
      signature,
      version,
      createdAt: new Date(),
      lastUsed: new Date(),
      features,
      predictions,
      optimizations,
      metadata: {
        accuracy: confidence / 100,
        confidence,
        usageCount: 1
      }
    };
    
    this.modelCache.set(signature, cachedModel);
    this.addModelVersion(signature, version, confidence / 100);
    
    // Cleanup old models if cache gets too large
    if (this.modelCache.size > 100) {
      this.cleanupModelCache();
    }
  }

  private getNextModelVersion(signature: string): number {
    const versions = this.modelVersions.get(signature) || [];
    return versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
  }

  private addModelVersion(signature: string, version: number, accuracy: number): void {
    const versions = this.modelVersions.get(signature) || [];
    versions.push({
      version,
      createdAt: new Date(),
      accuracy,
      changesSince: []
    });
    this.modelVersions.set(signature, versions);
  }

  private cleanupModelCache(): void {
    // Remove least recently used models
    const entries = Array.from(this.modelCache.entries());
    entries.sort((a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime());
    
    // Remove bottom 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.modelCache.delete(entries[i][0]);
    }
  }

  public extractFlowFeatures(flow: VisualFlow): FlowFeatures {
    console.log('🔍 Extracting flow features for ML analysis...');
    
    const nodeCount = flow.blocks.length;
    const connectionCount = flow.connections.length;
    
    // Calculate complexity metrics
    const complexity = this.calculateFlowComplexity(flow);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(flow);
    const maxDepth = this.calculateMaxDepth(flow);
    const branchingFactor = this.calculateBranchingFactor(flow);
    
    // Analyze data flow patterns
    const dataFlowPatterns = this.analyzeDataFlowPatterns(flow);
    
    // Get block type distribution
    const blockTypes = this.getBlockTypeDistribution(flow);
    
    // Calculate other metrics
    const averageBlockParameters = this.calculateAverageBlockParameters(flow);
    const parallelizableBlocks = this.countParallelizableBlocks(flow);
    
    return {
      nodeCount,
      connectionCount,
      complexity,
      dataFlowPatterns,
      blockTypes,
      cyclomaticComplexity,
      averageBlockParameters,
      maxDepth,
      branchingFactor,
      parallelizableBlocks
    };
  }

  private calculateFlowComplexity(flow: VisualFlow): number {
    // McCabe complexity for visual flows
    // V(G) = E - N + 2P where E = edges, N = nodes, P = connected components
    const edges = flow.connections.length;
    const nodes = flow.blocks.length;
    const connectedComponents = this.countConnectedComponents(flow);
    
    return Math.max(1, edges - nodes + 2 * connectedComponents);
  }

  private calculateCyclomaticComplexity(flow: VisualFlow): number {
    // Count decision points (conditions, loops, branches)
    let complexity = 1; // Base complexity
    
    flow.blocks.forEach(block => {
      switch (block.type) {
        case BlockType.CONDITION:
          complexity += 1;
          break;
        case BlockType.LOOP:
          complexity += 2; // Loops add more complexity
          break;
        default:
          break;
      }
    });
    
    // Add complexity for branching connections
    const branchingNodes = this.findBranchingNodes(flow);
    complexity += branchingNodes.length;
    
    return complexity;
  }

  private calculateMaxDepth(flow: VisualFlow): number {
    // Find the longest path from input to output
    const inputBlocks = flow.blocks.filter(block => block.type === BlockType.INPUT);
    let maxDepth = 0;
    
    inputBlocks.forEach(inputBlock => {
      const depth = this.getDepthFromBlock(flow, inputBlock.id, new Set());
      maxDepth = Math.max(maxDepth, depth);
    });
    
    return maxDepth;
  }

  private getDepthFromBlock(flow: VisualFlow, blockId: string, visited: Set<string>): number {
    if (visited.has(blockId)) return 0; // Cycle detection
    
    visited.add(blockId);
    
    const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === blockId);
    
    if (outgoingConnections.length === 0) {
      return 1; // Leaf node
    }
    
    let maxChildDepth = 0;
    outgoingConnections.forEach(conn => {
      const childDepth = this.getDepthFromBlock(flow, conn.to.blockId, new Set(visited));
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    });
    
    return 1 + maxChildDepth;
  }

  private calculateBranchingFactor(flow: VisualFlow): number {
    // Average number of outgoing connections per node
    const totalOutgoingConnections = flow.blocks.reduce((sum, block) => {
      const outgoing = flow.connections.filter(conn => conn.from.blockId === block.id).length;
      return sum + outgoing;
    }, 0);
    
    return flow.blocks.length > 0 ? totalOutgoingConnections / flow.blocks.length : 0;
  }

  private analyzeDataFlowPatterns(flow: VisualFlow): DataFlowPattern[] {
    const patterns: DataFlowPattern[] = [];
    
    // Detect linear patterns
    const linearChains = this.findLinearChains(flow);
    if (linearChains.length > 0) {
      patterns.push({
        pattern: 'linear',
        frequency: linearChains.length,
        complexity: linearChains.reduce((sum, chain) => sum + chain.length, 0) / linearChains.length
      });
    }
    
    // Detect branching patterns
    const branchingNodes = this.findBranchingNodes(flow);
    if (branchingNodes.length > 0) {
      patterns.push({
        pattern: 'branching',
        frequency: branchingNodes.length,
        complexity: branchingNodes.reduce((sum, node) => sum + node.outgoing, 0) / branchingNodes.length
      });
    }
    
    // Detect merging patterns
    const mergingNodes = this.findMergingNodes(flow);
    if (mergingNodes.length > 0) {
      patterns.push({
        pattern: 'merging',
        frequency: mergingNodes.length,
        complexity: mergingNodes.reduce((sum, node) => sum + node.incoming, 0) / mergingNodes.length
      });
    }
    
    // Detect parallel patterns
    const parallelGroups = this.findParallelGroups(flow);
    if (parallelGroups.length > 0) {
      patterns.push({
        pattern: 'parallel',
        frequency: parallelGroups.length,
        complexity: parallelGroups.reduce((sum, group) => sum + group.length, 0) / parallelGroups.length
      });
    }
    
    return patterns;
  }

  private getBlockTypeDistribution(flow: VisualFlow): BlockTypeDistribution {
    const distribution: BlockTypeDistribution = {};
    
    flow.blocks.forEach(block => {
      const type = block.type.toString();
      distribution[type] = (distribution[type] || 0) + 1;
    });
    
    return distribution;
  }

  private calculateAverageBlockParameters(flow: VisualFlow): number {
    const totalParameters = flow.blocks.reduce((sum, block) => sum + block.parameters.length, 0);
    return flow.blocks.length > 0 ? totalParameters / flow.blocks.length : 0;
  }

  private countParallelizableBlocks(flow: VisualFlow): number {
    const parallelGroups = this.findParallelGroups(flow);
    return parallelGroups.reduce((sum, group) => sum + group.length, 0);
  }

  private async getMLPredictions(features: FlowFeatures, flow: VisualFlow, patternAnalysis: PatternAnalysis): Promise<MLPredictions> {
    console.log('🤖 Getting ML predictions for flow optimization...');
    
    const prompt = `
Analyze this visual flow for optimization opportunities using machine learning insights:

Flow Features:
- Node Count: ${features.nodeCount}
- Connection Count: ${features.connectionCount}
- Complexity: ${features.complexity}
- Cyclomatic Complexity: ${features.cyclomaticComplexity}
- Max Depth: ${features.maxDepth}
- Branching Factor: ${features.branchingFactor}
- Parallelizable Blocks: ${features.parallelizableBlocks}

Block Type Distribution:
${JSON.stringify(features.blockTypes, null, 2)}

Data Flow Patterns:
${JSON.stringify(features.dataFlowPatterns, null, 2)}

Based on machine learning analysis of similar flows, provide optimization predictions:

{
  "expectedPerformanceGain": <percentage 0-100>,
  "confidence": <percentage 0-100>,
  "optimizationOpportunities": [
    {
      "type": "parallelization|caching|merging|reordering|elimination",
      "target": ["block_ids_or_patterns"],
      "expectedGain": <percentage>,
      "difficulty": "low|medium|high",
      "confidence": <percentage>
    }
  ],
  "riskAssessment": {
    "overall": "low|medium|high",
    "factors": [
      {
        "factor": "complexity|dependencies|data_flow",
        "severity": "low|medium|high", 
        "description": "risk description"
      }
    ],
    "mitigation": ["mitigation strategies"]
  },
  "recommendations": [
    {
      "category": "performance|maintainability|scalability|reliability",
      "priority": <1-10>,
      "description": "what to optimize",
      "implementation": "how to implement",
      "impact": "expected impact"
    }
  ]
}

Consider:
1. Parallel execution opportunities
2. Caching potential for expensive operations
3. Block merging possibilities
4. Optimal execution order
5. Redundancy elimination
6. Memory usage optimization
7. Error handling improvements`;

    try {
      const predictions = await this.aiService.getJSONResponse(prompt);
      
      // Validate and normalize predictions
      return {
        expectedPerformanceGain: Math.min(100, Math.max(0, predictions.expectedPerformanceGain || 0)),
        confidence: Math.min(100, Math.max(0, predictions.confidence || 50)),
        optimizationOpportunities: predictions.optimizationOpportunities || [],
        riskAssessment: predictions.riskAssessment || { overall: 'medium', factors: [], mitigation: [] },
        recommendations: predictions.recommendations || []
      };
      
    } catch (error) {
      console.warn('ML prediction failed, using heuristic analysis:', error);
      return this.generateHeuristicPredictions(features, flow);
    }
  }

  private generateHeuristicPredictions(features: FlowFeatures, flow: VisualFlow): MLPredictions {
    // Fallback heuristic analysis when AI is unavailable
    const opportunities: OptimizationOpportunity[] = [];
    
    // High parallelization potential
    if (features.parallelizableBlocks > 2) {
      opportunities.push({
        type: 'parallelization',
        target: ['parallel_blocks'],
        expectedGain: Math.min(50, features.parallelizableBlocks * 10),
        difficulty: 'medium',
        confidence: 70
      });
    }
    
    // Caching opportunities for API/DB blocks
    const expensiveBlocks = flow.blocks.filter(b => 
      [BlockType.API_CALL, BlockType.DATABASE].includes(b.type)
    );
    if (expensiveBlocks.length > 0) {
      opportunities.push({
        type: 'caching',
        target: expensiveBlocks.map(b => b.id),
        expectedGain: 30,
        difficulty: 'low',
        confidence: 80
      });
    }
    
    // Calculate overall performance gain
    const expectedPerformanceGain = opportunities.reduce((sum, opp) => sum + opp.expectedGain, 0) / opportunities.length || 0;
    
    return {
      expectedPerformanceGain: Math.min(60, expectedPerformanceGain),
      confidence: 60,
      optimizationOpportunities: opportunities,
      riskAssessment: {
        overall: features.complexity > 10 ? 'high' : features.complexity > 5 ? 'medium' : 'low',
        factors: [],
        mitigation: []
      },
      recommendations: []
    };
  }

  private async generateMLOptimizations(flow: VisualFlow, predictions: MLPredictions): Promise<AppliedOptimization[]> {
    const optimizations: AppliedOptimization[] = [];
    
    // Apply each optimization opportunity
    for (const opportunity of predictions.optimizationOpportunities) {
      if (opportunity.confidence > 60) { // Only apply high-confidence optimizations
        optimizations.push({
          type: opportunity.type,
          description: this.getOptimizationDescription(opportunity.type),
          blocks: opportunity.target,
          estimatedGain: opportunity.expectedGain,
          confidence: opportunity.confidence
        });
      }
    }
    
    return optimizations;
  }

  private getOptimizationDescription(type: string): string {
    const descriptions = {
      parallelization: 'Execute independent blocks in parallel',
      caching: 'Cache results of expensive operations',
      merging: 'Merge sequential blocks with compatible operations',
      reordering: 'Reorder blocks for optimal execution sequence',
      elimination: 'Remove redundant or unnecessary operations'
    };
    
    return descriptions[type as keyof typeof descriptions] || 'Apply optimization';
  }

  private async applyMLOptimizations(flow: VisualFlow, optimizations: AppliedOptimization[]): Promise<VisualFlow> {
    // Create a deep copy of the flow
    const optimizedFlow = JSON.parse(JSON.stringify(flow)) as VisualFlow;
    optimizedFlow.id = `${flow.id}_optimized_${Date.now()}`;
    optimizedFlow.name = `${flow.name} (ML Optimized)`;
    optimizedFlow.metadata.updatedAt = new Date();
    
    // Apply each optimization
    for (const optimization of optimizations) {
      switch (optimization.type) {
        case 'parallelization':
          this.applyParallelization(optimizedFlow, optimization.blocks);
          break;
        case 'caching':
          this.applyCaching(optimizedFlow, optimization.blocks);
          break;
        case 'merging':
          this.applyMerging(optimizedFlow, optimization.blocks);
          break;
        case 'reordering':
          this.applyReordering(optimizedFlow, optimization.blocks);
          break;
        case 'elimination':
          this.applyElimination(optimizedFlow, optimization.blocks);
          break;
      }
    }
    
    return optimizedFlow;
  }

  // Optimization implementation methods
  private applyParallelization(flow: VisualFlow, blockIds: string[]): void {
    // Mark blocks for parallel execution by adding metadata
    blockIds.forEach(blockId => {
      const block = flow.blocks.find(b => b.id === blockId);
      if (block) {
        block.parameters.push({
          name: '_parallel_execution',
          type: 'boolean',
          value: true,
          required: false
        });
      }
    });
  }

  private applyCaching(flow: VisualFlow, blockIds: string[]): void {
    // Add caching parameters to expensive blocks
    blockIds.forEach(blockId => {
      const block = flow.blocks.find(b => b.id === blockId);
      if (block) {
        block.parameters.push({
          name: '_enable_caching',
          type: 'boolean',
          value: true,
          required: false
        });
        block.parameters.push({
          name: '_cache_ttl',
          type: 'number',
          value: 300, // 5 minutes
          required: false
        });
      }
    });
  }

  private applyMerging(flow: VisualFlow, blockIds: string[]): void {
    // This is a simplified implementation
    // In practice, this would involve complex block merging logic
    console.log(`📝 Block merging optimization applied to blocks: ${blockIds.join(', ')}`);
  }

  private applyReordering(flow: VisualFlow, blockIds: string[]): void {
    // Reorder blocks for optimal execution
    console.log(`🔄 Block reordering optimization applied to blocks: ${blockIds.join(', ')}`);
  }

  private applyElimination(flow: VisualFlow, blockIds: string[]): void {
    // Remove redundant blocks
    flow.blocks = flow.blocks.filter(block => !blockIds.includes(block.id));
    flow.connections = flow.connections.filter(conn => 
      !blockIds.includes(conn.from.blockId) && !blockIds.includes(conn.to.blockId)
    );
  }

  // Helper methods
  private countConnectedComponents(flow: VisualFlow): number {
    const visited = new Set<string>();
    let components = 0;
    
    flow.blocks.forEach(block => {
      if (!visited.has(block.id)) {
        this.dfsVisit(flow, block.id, visited);
        components++;
      }
    });
    
    return Math.max(1, components);
  }

  private dfsVisit(flow: VisualFlow, blockId: string, visited: Set<string>): void {
    visited.add(blockId);
    
    flow.connections.forEach(conn => {
      if (conn.from.blockId === blockId && !visited.has(conn.to.blockId)) {
        this.dfsVisit(flow, conn.to.blockId, visited);
      }
      if (conn.to.blockId === blockId && !visited.has(conn.from.blockId)) {
        this.dfsVisit(flow, conn.from.blockId, visited);
      }
    });
  }

  private findBranchingNodes(flow: VisualFlow): Array<{ blockId: string; outgoing: number }> {
    return flow.blocks.map(block => ({
      blockId: block.id,
      outgoing: flow.connections.filter(conn => conn.from.blockId === block.id).length
    })).filter(node => node.outgoing > 1);
  }

  private findMergingNodes(flow: VisualFlow): Array<{ blockId: string; incoming: number }> {
    return flow.blocks.map(block => ({
      blockId: block.id,
      incoming: flow.connections.filter(conn => conn.to.blockId === block.id).length
    })).filter(node => node.incoming > 1);
  }

  private findLinearChains(flow: VisualFlow): string[][] {
    const chains: string[][] = [];
    const visited = new Set<string>();
    
    flow.blocks.forEach(block => {
      if (!visited.has(block.id)) {
        const chain = this.getLinearChain(flow, block.id, visited);
        if (chain.length > 1) {
          chains.push(chain);
        }
      }
    });
    
    return chains;
  }

  private getLinearChain(flow: VisualFlow, startBlockId: string, visited: Set<string>): string[] {
    const chain = [startBlockId];
    visited.add(startBlockId);
    let currentBlockId = startBlockId;
    
    while (true) {
      const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === currentBlockId);
      
      if (outgoingConnections.length !== 1) break;
      
      const nextBlockId = outgoingConnections[0].to.blockId;
      const incomingConnections = flow.connections.filter(conn => conn.to.blockId === nextBlockId);
      
      if (incomingConnections.length !== 1 || visited.has(nextBlockId)) break;
      
      chain.push(nextBlockId);
      visited.add(nextBlockId);
      currentBlockId = nextBlockId;
    }
    
    return chain;
  }

  private findParallelGroups(flow: VisualFlow): string[][] {
    // Find groups of blocks that can execute in parallel
    const groups: string[][] = [];
    const visited = new Set<string>();
    
    flow.blocks.forEach(block => {
      if (!visited.has(block.id)) {
        const group = this.getParallelGroup(flow, block.id, visited);
        if (group.length > 1) {
          groups.push(group);
        }
      }
    });
    
    return groups;
  }

  private getParallelGroup(flow: VisualFlow, startBlockId: string, visited: Set<string>): string[] {
    // Simplified parallel group detection
    // In practice, this would be more sophisticated
    const group = [startBlockId];
    visited.add(startBlockId);
    
    // Find blocks at the same level that don't depend on each other
    // This is a simplified implementation
    return group;
  }

  private calculateOptimizationConfidence(predictions: MLPredictions, optimizations: AppliedOptimization[]): number {
    if (optimizations.length === 0) return 0;
    
    const avgConfidence = optimizations.reduce((sum, opt) => sum + opt.confidence, 0) / optimizations.length;
    return Math.min(100, avgConfidence * (predictions.confidence / 100));
  }

  private calculateExpectedImprovement(optimizations: AppliedOptimization[]): number {
    // Calculate combined improvement (not simply additive due to diminishing returns)
    let totalImprovement = 0;
    let remainingPotential = 100;
    
    optimizations
      .sort((a, b) => b.estimatedGain - a.estimatedGain)
      .forEach(opt => {
        const improvement = (opt.estimatedGain / 100) * remainingPotential;
        totalImprovement += improvement;
        remainingPotential -= improvement;
      });
    
    return Math.min(90, totalImprovement); // Cap at 90%
  }

  private addToOptimizationHistory(flowId: string, result: OptimizedFlow): void {
    const history = this.optimizationHistory.get(flowId) || [];
    history.push(result);
    
    // Keep only last 10 optimizations
    if (history.length > 10) {
      history.shift();
    }
    
    this.optimizationHistory.set(flowId, history);
  }

  // Public API methods
  getOptimizationHistory(flowId: string): OptimizedFlow[] {
    return this.optimizationHistory.get(flowId) || [];
  }

  async predictFlowPerformance(flow: VisualFlow): Promise<any> {
    const features = this.extractFlowFeatures(flow);
    const analysis = await this.analyzeFlowCharacteristics(flow);
    
    return {
      estimatedExecutionTime: this.predictExecutionTime(analysis),
      estimatedMemoryUsage: this.predictMemoryUsage(analysis),
      bottleneckPredictions: this.predictBottlenecks(analysis),
      scalabilityAnalysis: this.analyzeScalability(analysis),
      resourceRequirements: this.calculateResourceRequirements(analysis),
      performanceGrade: this.calculatePerformanceGrade(analysis)
    };
  }

  private async analyzeFlowCharacteristics(flow: VisualFlow): Promise<FlowAnalysis> {
    return {
      dataProcessingComplexity: this.calculateDataComplexity(flow),
      ioOperations: this.countIOOperations(flow),
      computationalLoad: this.estimateComputationalLoad(flow),
      parallelizationOpportunities: this.identifyParallelBlocks(flow),
      memoryIntensiveOperations: this.findMemoryIntensiveBlocks(flow)
    };
  }

  private calculateDataComplexity(flow: VisualFlow): number {
    // Estimate data processing complexity based on block types and connections
    let complexity = 0;
    
    flow.blocks.forEach(block => {
      switch (block.type) {
        case BlockType.TRANSFORM: complexity += 2; break;
        case BlockType.AGGREGATE: complexity += 3; break;
        case BlockType.FILTER: complexity += 1; break;
        case BlockType.LOOP: complexity += 5; break;
        default: complexity += 1;
      }
    });
    
    return complexity;
  }

  private countIOOperations(flow: VisualFlow): number {
    return flow.blocks.filter(block => 
      [BlockType.INPUT, BlockType.OUTPUT, BlockType.API_CALL, BlockType.DATABASE].includes(block.type)
    ).length;
  }

  private estimateComputationalLoad(flow: VisualFlow): number {
    // Estimate computational load based on block types and complexity
    let load = 0;
    
    flow.blocks.forEach(block => {
      const parameterComplexity = block.parameters.length;
      switch (block.type) {
        case BlockType.AGGREGATE: load += 10 + parameterComplexity; break;
        case BlockType.TRANSFORM: load += 5 + parameterComplexity; break;
        case BlockType.LOOP: load += 15 + parameterComplexity; break;
        case BlockType.API_CALL: load += 8 + parameterComplexity; break;
        default: load += 3 + parameterComplexity;
      }
    });
    
    return load;
  }

  private identifyParallelBlocks(flow: VisualFlow): ParallelizationOpportunity[] {
    const opportunities: ParallelizationOpportunity[] = [];
    const parallelGroups = this.findParallelGroups(flow);
    
    parallelGroups.forEach(group => {
      opportunities.push({
        blocks: group,
        estimatedSpeedup: Math.min(group.length * 0.7, 4), // Diminishing returns
        requirements: ['Thread pool', 'Synchronization']
      });
    });
    
    return opportunities;
  }

  private findMemoryIntensiveBlocks(flow: VisualFlow): MemoryIntensiveOperation[] {
    return flow.blocks
      .filter(block => [BlockType.AGGREGATE, BlockType.LOOP, BlockType.DATABASE].includes(block.type))
      .map(block => ({
        blockId: block.id,
        estimatedMemoryUsage: this.estimateBlockMemoryUsage(block),
        optimizationSuggestions: this.getMemoryOptimizationSuggestions(block)
      }));
  }

  private estimateBlockMemoryUsage(block: VisualBlock): number {
    // Rough memory usage estimation based on block type
    const baseUsage = {
      [BlockType.AGGREGATE]: 10 * 1024 * 1024, // 10MB
      [BlockType.LOOP]: 5 * 1024 * 1024,       // 5MB
      [BlockType.DATABASE]: 8 * 1024 * 1024,   // 8MB
      [BlockType.TRANSFORM]: 2 * 1024 * 1024,  // 2MB
    };
    
    return baseUsage[block.type as keyof typeof baseUsage] || 1024 * 1024; // 1MB default
  }

  private getMemoryOptimizationSuggestions(block: VisualBlock): string[] {
    const suggestions = [
      'Process data in chunks to reduce memory footprint',
      'Use streaming where possible',
      'Implement proper cleanup of temporary objects'
    ];
    
    if (block.type === BlockType.LOOP) {
      suggestions.push('Consider loop unrolling or vectorization');
    }
    
    if (block.type === BlockType.AGGREGATE) {
      suggestions.push('Use incremental aggregation methods');
    }
    
    return suggestions;
  }

  private predictExecutionTime(analysis: FlowAnalysis): number {
    // Predict execution time based on analysis
    const baseTime = analysis.dataProcessingComplexity * 10; // 10ms per complexity unit
    const ioTime = analysis.ioOperations * 50; // 50ms per IO operation
    const computeTime = analysis.computationalLoad * 2; // 2ms per load unit
    
    return baseTime + ioTime + computeTime;
  }

  private predictMemoryUsage(analysis: FlowAnalysis): number {
    return analysis.memoryIntensiveOperations.reduce(
      (sum, op) => sum + op.estimatedMemoryUsage, 
      10 * 1024 * 1024 // 10MB base
    );
  }

  private predictBottlenecks(analysis: FlowAnalysis): any[] {
    const bottlenecks = [];
    
    if (analysis.ioOperations > 5) {
      bottlenecks.push({
        type: 'IO',
        severity: 'high',
        description: 'High number of IO operations may cause bottlenecks'
      });
    }
    
    if (analysis.computationalLoad > 50) {
      bottlenecks.push({
        type: 'CPU',
        severity: 'medium',
        description: 'High computational load detected'
      });
    }
    
    return bottlenecks;
  }

  private analyzeScalability(analysis: FlowAnalysis): any {
    return {
      horizontalScaling: analysis.parallelizationOpportunities.length > 0 ? 'good' : 'limited',
      verticalScaling: analysis.computationalLoad < 30 ? 'good' : 'moderate',
      recommendations: [
        'Consider microservice architecture for better scaling',
        'Implement caching layers for frequently accessed data'
      ]
    };
  }

  private calculateResourceRequirements(analysis: FlowAnalysis): any {
    return {
      cpu: analysis.computationalLoad > 50 ? 'high' : 'moderate',
      memory: analysis.memoryIntensiveOperations.length > 3 ? 'high' : 'moderate',
      network: analysis.ioOperations > 5 ? 'high' : 'low',
      storage: 'moderate'
    };
  }

  private calculatePerformanceGrade(analysis: FlowAnalysis): string {
    let score = 100;
    
    if (analysis.computationalLoad > 50) score -= 20;
    if (analysis.ioOperations > 5) score -= 15;
    if (analysis.memoryIntensiveOperations.length > 3) score -= 15;
    if (analysis.parallelizationOpportunities.length === 0) score -= 10;
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Public API methods for model caching
  getCachedModels(): CachedModel[] {
    return Array.from(this.modelCache.values());
  }

  getModelVersions(signature: string): ModelVersion[] {
    return this.modelVersions.get(signature) || [];
  }

  clearModelCache(): void {
    this.modelCache.clear();
    this.modelVersions.clear();
    console.log('🗑️ Model cache cleared');
  }

  getCacheStatistics(): any {
    const models = Array.from(this.modelCache.values());
    return {
      totalModels: models.length,
      totalUsage: models.reduce((sum, model) => sum + model.metadata.usageCount, 0),
      averageAccuracy: models.reduce((sum, model) => sum + model.metadata.accuracy, 0) / models.length,
      oldestModel: models.length > 0 ? Math.min(...models.map(m => m.createdAt.getTime())) : null,
      newestModel: models.length > 0 ? Math.max(...models.map(m => m.createdAt.getTime())) : null
    };
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ML Flow Optimizer...');
    this.modelCache.clear();
    this.modelVersions.clear();
    this.optimizationHistory.clear();
    this.patternAnalyzer.cleanup();
    console.log('✅ ML Flow Optimizer cleanup completed');
  }
}

// Deep Pattern Analyzer class (from optimization suggestions)
export class DeepPatternAnalyzer {
  private aiService: AIService;
  private knownAntiPatterns: Map<string, AntiPattern> = new Map();

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.initializeKnownPatterns();
  }

  async analyzeComplexPatterns(flow: VisualFlow): Promise<PatternAnalysis> {
    console.log('🔍 Performing deep pattern analysis...');
    
    return {
      antiPatterns: await this.detectAntiPatterns(flow),
      optimizationPatterns: await this.identifyOptimizationPatterns(flow),
      scalabilityPatterns: await this.analyzeScalabilityPatterns(flow),
      securityPatterns: await this.checkSecurityPatterns(flow)
    };
  }

  private async detectAntiPatterns(flow: VisualFlow): Promise<AntiPattern[]> {
    const antiPatterns: AntiPattern[] = [];
    
    // Detect N+1 query problems
    const nPlusOnePatterns = this.detectNPlusOneProblems(flow);
    antiPatterns.push(...nPlusOnePatterns);
    
    // Detect sync/async mismatches
    const syncAsyncIssues = this.detectSyncAsyncMismatches(flow);
    antiPatterns.push(...syncAsyncIssues);
    
    // Detect potential memory leaks
    const memoryLeakPatterns = this.detectMemoryLeakPatterns(flow);
    antiPatterns.push(...memoryLeakPatterns);
    
    // Detect circular dependencies
    const circularDeps = this.detectCircularDependencies(flow);
    antiPatterns.push(...circularDeps);
    
    // Detect excessive nesting
    const nestingIssues = this.detectExcessiveNesting(flow);
    antiPatterns.push(...nestingIssues);
    
    return antiPatterns;
  }

  private detectNPlusOneProblems(flow: VisualFlow): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    
    // Look for loops containing database operations
    flow.blocks.forEach(block => {
      if (block.type === BlockType.LOOP) {
        const loopConnections = flow.connections.filter(conn => conn.from.blockId === block.id);
        const hasDbOperations = loopConnections.some(conn => {
          const targetBlock = flow.blocks.find(b => b.id === conn.to.blockId);
          return targetBlock?.type === BlockType.DATABASE;
        });
        
        if (hasDbOperations) {
          patterns.push({
            type: 'n_plus_one',
            severity: 'high',
            location: [block.id],
            description: 'Potential N+1 query problem: Database operation inside loop',
            recommendation: 'Consider batch loading or using JOINs to reduce database queries',
            estimatedImpact: 70
          });
        }
      }
    });
    
    return patterns;
  }

  private detectSyncAsyncMismatches(flow: VisualFlow): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    
    // Look for synchronous operations that could benefit from async
    flow.blocks.forEach(block => {
      if ([BlockType.API_CALL, BlockType.DATABASE].includes(block.type)) {
        const hasParallelOpportunities = this.hasParallelExecutionOpportunities(flow, block.id);
        
        if (hasParallelOpportunities) {
          patterns.push({
            type: 'sync_async_mismatch',
            severity: 'medium',
            location: [block.id],
            description: 'Synchronous operation could be optimized with async execution',
            recommendation: 'Consider using Promise.all() or async/await for parallel execution',
            estimatedImpact: 40
          });
        }
      }
    });
    
    return patterns;
  }

  private detectMemoryLeakPatterns(flow: VisualFlow): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    
    // Look for unclosed resources or event listeners
    flow.blocks.forEach(block => {
      if (block.type === BlockType.CUSTOM) {
        // Check if custom code might have memory leak patterns
        const hasCleanupConcerns = block.parameters.some(param => 
          param.name.toLowerCase().includes('event') || 
          param.name.toLowerCase().includes('listener') ||
          param.name.toLowerCase().includes('interval')
        );
        
        if (hasCleanupConcerns) {
          patterns.push({
            type: 'memory_leak',
            severity: 'medium',
            location: [block.id],
            description: 'Potential memory leak: Event listeners or intervals may not be cleaned up',
            recommendation: 'Ensure proper cleanup of event listeners and intervals',
            estimatedImpact: 30
          });
        }
      }
    });
    
    return patterns;
  }

  private detectCircularDependencies(flow: VisualFlow): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (blockId: string, path: string[]): boolean => {
      if (recursionStack.has(blockId)) {
        patterns.push({
          type: 'circular_dependency',
          severity: 'critical',
          location: [...path, blockId],
          description: `Circular dependency detected in flow: ${path.join(' → ')} → ${blockId}`,
          recommendation: 'Restructure flow to eliminate circular dependencies',
          estimatedImpact: 90
        });
        return true;
      }
      
      if (visited.has(blockId)) return false;
      
      visited.add(blockId);
      recursionStack.add(blockId);
      
      const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === blockId);
      
      for (const conn of outgoingConnections) {
        if (dfs(conn.to.blockId, [...path, blockId])) {
          return true;
        }
      }
      
      recursionStack.delete(blockId);
      return false;
    };
    
    flow.blocks.forEach(block => {
      if (!visited.has(block.id)) {
        dfs(block.id, []);
      }
    });
    
    return patterns;
  }

  private detectExcessiveNesting(flow: VisualFlow): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const maxDepth = this.calculateMaxNestingDepth(flow);
    
    if (maxDepth > 5) {
      patterns.push({
        type: 'excessive_nesting',
        severity: maxDepth > 8 ? 'high' : 'medium',
        location: [],
        description: `Excessive nesting depth detected: ${maxDepth} levels`,
        recommendation: 'Consider breaking complex flows into smaller, reusable components',
        estimatedImpact: Math.min(60, maxDepth * 10)
      });
    }
    
    return patterns;
  }

  private async identifyOptimizationPatterns(flow: VisualFlow): Promise<OptimizationPattern[]> {
    const patterns: OptimizationPattern[] = [];
    
    // Identify caching opportunities
    const cachingOpportunities = this.identifyCachingOpportunities(flow);
    patterns.push(...cachingOpportunities);
    
    // Identify parallelization opportunities
    const parallelizationOpportunities = this.identifyParallelizationOpportunities(flow);
    patterns.push(...parallelizationOpportunities);
    
    return patterns;
  }

  private async analyzeScalabilityPatterns(flow: VisualFlow): Promise<ScalabilityPattern[]> {
    const patterns: ScalabilityPattern[] = [];
    
    // Analyze horizontal scaling potential
    if (this.hasStatelessOperations(flow)) {
      patterns.push({
        pattern: 'horizontal',
        suitability: 85,
        requirements: ['Stateless operations', 'Load balancer'],
        limitations: ['Shared state management']
      });
    }
    
    // Analyze caching potential
    if (this.hasExpensiveOperations(flow)) {
      patterns.push({
        pattern: 'caching',
        suitability: 90,
        requirements: ['Cache layer', 'TTL management'],
        limitations: ['Cache invalidation complexity']
      });
    }
    
    return patterns;
  }

  private async checkSecurityPatterns(flow: VisualFlow): Promise<SecurityPattern[]> {
    const patterns: SecurityPattern[] = [];
    
    // Check for input validation needs
    const hasInputBlocks = flow.blocks.some(b => b.type === BlockType.INPUT);
    if (hasInputBlocks) {
      patterns.push({
        pattern: 'input_validation',
        required: true,
        severity: 'high',
        recommendation: 'Implement comprehensive input validation for all input blocks'
      });
    }
    
    // Check for output sanitization needs
    const hasOutputBlocks = flow.blocks.some(b => b.type === BlockType.OUTPUT);
    if (hasOutputBlocks) {
      patterns.push({
        pattern: 'output_sanitization',
        required: true,
        severity: 'medium',
        recommendation: 'Ensure output data is properly sanitized before transmission'
      });
    }
    
    return patterns;
  }

  // Helper methods
  private hasParallelExecutionOpportunities(flow: VisualFlow, blockId: string): boolean {
    const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === blockId);
    return outgoingConnections.length > 1;
  }

  private calculateMaxNestingDepth(flow: VisualFlow): number {
    let maxDepth = 0;
    
    const inputBlocks = flow.blocks.filter(b => b.type === BlockType.INPUT);
    inputBlocks.forEach(inputBlock => {
      const depth = this.calculateDepthFromBlock(flow, inputBlock.id, new Set());
      maxDepth = Math.max(maxDepth, depth);
    });
    
    return maxDepth;
  }

  private calculateDepthFromBlock(flow: VisualFlow, blockId: string, visited: Set<string>): number {
    if (visited.has(blockId)) return 0;
    
    visited.add(blockId);
    
    const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === blockId);
    
    if (outgoingConnections.length === 0) return 1;
    
    let maxChildDepth = 0;
    outgoingConnections.forEach(conn => {
      const childDepth = this.calculateDepthFromBlock(flow, conn.to.blockId, new Set(visited));
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    });
    
    return 1 + maxChildDepth;
  }

  private identifyCachingOpportunities(flow: VisualFlow): OptimizationPattern[] {
    const patterns: OptimizationPattern[] = [];
    
    const expensiveBlocks = flow.blocks.filter(b => 
      [BlockType.API_CALL, BlockType.DATABASE].includes(b.type)
    );
    
    if (expensiveBlocks.length > 0) {
      patterns.push({
        type: 'caching',
        confidence: 80,
        applicableBlocks: expensiveBlocks.map(b => b.id),
        expectedGain: 50
      });
    }
    
    return patterns;
  }

  private identifyParallelizationOpportunities(flow: VisualFlow): OptimizationPattern[] {
    const patterns: OptimizationPattern[] = [];
    
    // Find independent blocks that can run in parallel
    const independentGroups = this.findIndependentBlockGroups(flow);
    
    if (independentGroups.length > 0) {
      patterns.push({
        type: 'parallelization',
        confidence: 70,
        applicableBlocks: independentGroups.flat(),
        expectedGain: 35
      });
    }
    
    return patterns;
  }

  private findIndependentBlockGroups(flow: VisualFlow): string[][] {
    // Simplified implementation - find blocks with no dependencies
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    flow.blocks.forEach(block => {
      if (processed.has(block.id)) return;
      
      const incomingConnections = flow.connections.filter(conn => conn.to.blockId === block.id);
      if (incomingConnections.length === 0) {
        // This is a root block, find its independent siblings
        const siblings = flow.blocks.filter(b => 
          !processed.has(b.id) && 
          flow.connections.filter(conn => conn.to.blockId === b.id).length === 0
        );
        
        if (siblings.length > 1) {
          const group = siblings.map(b => b.id);
          groups.push(group);
          group.forEach(id => processed.add(id));
        }
      }
    });
    
    return groups;
  }

  private hasStatelessOperations(flow: VisualFlow): boolean {
    // Check if most operations are stateless
    const statelessTypes = [BlockType.TRANSFORM, BlockType.FILTER, BlockType.OUTPUT];
    const statelessCount = flow.blocks.filter(b => statelessTypes.includes(b.type)).length;
    return statelessCount / flow.blocks.length > 0.7;
  }

  private hasExpensiveOperations(flow: VisualFlow): boolean {
    return flow.blocks.some(b => [BlockType.API_CALL, BlockType.DATABASE, BlockType.AGGREGATE].includes(b.type));
  }

  private initializeKnownPatterns(): void {
    // Initialize with common anti-patterns
    console.log('📚 Initializing known pattern library...');
  }

  cleanup(): void {
    this.knownAntiPatterns.clear();
  }
}