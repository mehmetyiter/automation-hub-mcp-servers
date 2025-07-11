import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MLFlowOptimizer } from '../src/code-generation/visual-builder/ml-flow-optimizer';
import { 
  VisualFlow, 
  VisualBlock, 
  BlockType, 
  FlowConnection 
} from '../src/code-generation/visual-builder/visual-code-builder';
import * as crypto from 'crypto';

// Mock AI Service
jest.mock('../../src/ai-service');

describe('MLFlowOptimizer', () => {
  let optimizer: MLFlowOptimizer;
  let mockFlow: VisualFlow;

  beforeEach(() => {
    jest.useFakeTimers();
    optimizer = new MLFlowOptimizer();
    
    // Create a mock flow
    mockFlow = createMockFlow();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function createMockFlow(): VisualFlow {
    const blocks: VisualBlock[] = [
      {
        id: 'input-1',
        type: BlockType.INPUT,
        label: 'Data Input',
        parameters: [],
        position: { x: 100, y: 100 },
        connections: { inputs: [], outputs: ['transform-1'] }
      },
      {
        id: 'transform-1',
        type: BlockType.TRANSFORM,
        label: 'Transform Data',
        parameters: [],
        position: { x: 300, y: 100 },
        connections: { inputs: ['input-1'], outputs: ['filter-1', 'filter-2'] }
      },
      {
        id: 'filter-1',
        type: BlockType.FILTER,
        label: 'Filter Active',
        parameters: [],
        position: { x: 500, y: 50 },
        connections: { inputs: ['transform-1'], outputs: ['aggregate-1'] }
      },
      {
        id: 'filter-2',
        type: BlockType.FILTER,
        label: 'Filter Inactive',
        parameters: [],
        position: { x: 500, y: 150 },
        connections: { inputs: ['transform-1'], outputs: ['aggregate-1'] }
      },
      {
        id: 'aggregate-1',
        type: BlockType.AGGREGATE,
        label: 'Aggregate Results',
        parameters: [],
        position: { x: 700, y: 100 },
        connections: { inputs: ['filter-1', 'filter-2'], outputs: ['output-1'] }
      },
      {
        id: 'output-1',
        type: BlockType.OUTPUT,
        label: 'Output',
        parameters: [],
        position: { x: 900, y: 100 },
        connections: { inputs: ['aggregate-1'], outputs: [] }
      }
    ];

    const connections: FlowConnection[] = [
      { id: 'conn-1', from: { blockId: 'input-1', output: 'data' }, to: { blockId: 'transform-1', input: 'input' } },
      { id: 'conn-2', from: { blockId: 'transform-1', output: 'result' }, to: { blockId: 'filter-1', input: 'input' } },
      { id: 'conn-3', from: { blockId: 'transform-1', output: 'result' }, to: { blockId: 'filter-2', input: 'input' } },
      { id: 'conn-4', from: { blockId: 'filter-1', output: 'filtered' }, to: { blockId: 'aggregate-1', input: 'input1' } },
      { id: 'conn-5', from: { blockId: 'filter-2', output: 'filtered' }, to: { blockId: 'aggregate-1', input: 'input2' } },
      { id: 'conn-6', from: { blockId: 'aggregate-1', output: 'result' }, to: { blockId: 'output-1', input: 'data' } }
    ];

    return {
      id: 'test-flow',
      name: 'Test Flow',
      description: 'A test visual flow',
      blocks,
      connections,
      metadata: {
        language: 'javascript',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      }
    };
  }

  describe('Flow Feature Extraction', () => {
    it('should extract basic flow features', async () => {
      const features = await optimizer.extractFlowFeatures(mockFlow);
      
      expect(features.nodeCount).toBe(6);
      expect(features.connectionCount).toBe(6);
      expect(features.blockTypes).toHaveProperty(BlockType.INPUT, 1);
      expect(features.blockTypes).toHaveProperty(BlockType.FILTER, 2);
      expect(features.blockTypes).toHaveProperty(BlockType.OUTPUT, 1);
    });

    it('should calculate complexity metrics', async () => {
      const features = await optimizer.extractFlowFeatures(mockFlow);
      
      expect(features.complexity).toBeGreaterThan(0);
      expect(features.cyclomaticComplexity).toBeGreaterThan(0);
      expect(features.maxDepth).toBe(4); // input -> transform -> filter -> aggregate -> output
      expect(features.branchingFactor).toBeGreaterThan(0);
    });

    it('should detect data flow patterns', async () => {
      const features = await optimizer.extractFlowFeatures(mockFlow);
      
      expect(features.dataFlowPatterns).toBeDefined();
      expect(features.dataFlowPatterns.length).toBeGreaterThan(0);
      
      const patterns = features.dataFlowPatterns.map(p => p.pattern);
      expect(patterns).toContain('branching'); // transform splits to two filters
      expect(patterns).toContain('merging'); // filters merge at aggregate
    });

    it('should identify parallelizable blocks', async () => {
      const features = await optimizer.extractFlowFeatures(mockFlow);
      
      expect(features.parallelizableBlocks).toBe(2); // filter-1 and filter-2 can run in parallel
    });
  });

  describe('ML-based Optimization', () => {
    it('should optimize flow using ML predictions', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      expect(optimized).toBeDefined();
      expect(optimized.original).toBe(mockFlow);
      expect(optimized.optimized).toBeDefined();
      expect(optimized.mlPredictions).toBeDefined();
      expect(optimized.expectedImprovement).toBeGreaterThanOrEqual(0);
      expect(optimized.confidence).toBeGreaterThan(0);
      expect(optimized.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide optimization opportunities', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      expect(optimized.mlPredictions.optimizationOpportunities).toBeDefined();
      expect(Array.isArray(optimized.mlPredictions.optimizationOpportunities)).toBe(true);
      
      if (optimized.mlPredictions.optimizationOpportunities.length > 0) {
        const opportunity = optimized.mlPredictions.optimizationOpportunities[0];
        expect(opportunity.type).toBeDefined();
        expect(opportunity.target).toBeDefined();
        expect(opportunity.expectedGain).toBeGreaterThanOrEqual(0);
        expect(opportunity.confidence).toBeGreaterThan(0);
      }
    });

    it('should assess optimization risks', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      expect(optimized.mlPredictions.riskAssessment).toBeDefined();
      expect(optimized.mlPredictions.riskAssessment.overall).toMatch(/low|medium|high/);
      expect(optimized.mlPredictions.riskAssessment.factors).toBeDefined();
      expect(optimized.mlPredictions.riskAssessment.mitigation).toBeDefined();
    });

    it('should provide ML recommendations', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      expect(optimized.mlPredictions.recommendations).toBeDefined();
      expect(Array.isArray(optimized.mlPredictions.recommendations)).toBe(true);
      
      if (optimized.mlPredictions.recommendations.length > 0) {
        const recommendation = optimized.mlPredictions.recommendations[0];
        expect(recommendation.category).toMatch(/performance|maintainability|scalability|reliability/);
        expect(recommendation.priority).toBeGreaterThanOrEqual(1);
        expect(recommendation.priority).toBeLessThanOrEqual(10);
        expect(recommendation.description).toBeDefined();
      }
    });
  });

  describe('Model Caching', () => {
    it('should cache optimization results', async () => {
      // First optimization
      const result1 = await optimizer.optimizeFlowWithCaching(mockFlow);
      
      // Second optimization with same flow
      const result2 = await optimizer.optimizeFlowWithCaching(mockFlow);
      
      // Should use cached result
      expect(result2).toEqual(result1);
    });

    it('should generate consistent flow signatures', () => {
      const signature1 = (optimizer as any).generateFlowSignature(mockFlow);
      const signature2 = (optimizer as any).generateFlowSignature(mockFlow);
      
      expect(signature1).toBe(signature2);
      expect(signature1).toMatch(/^[a-f0-9]{32}$/); // MD5 hash
    });

    it('should invalidate stale cache entries', async () => {
      // Optimize and cache
      await optimizer.optimizeFlowWithCaching(mockFlow);
      
      // Get cached model
      const signature = (optimizer as any).generateFlowSignature(mockFlow);
      const cachedModel = (optimizer as any).modelCache.get(signature);
      
      // Make it stale
      if (cachedModel) {
        cachedModel.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }
      
      // Should return null for stale cache
      const result = await optimizer.optimizeFlowWithCaching(mockFlow);
      expect(result).toBeNull();
    });

    it('should update cache metadata on use', async () => {
      // Optimize and cache
      await optimizer.optimizeFlowWithCaching(mockFlow);
      
      const signature = (optimizer as any).generateFlowSignature(mockFlow);
      const initialCache = (optimizer as any).modelCache.get(signature);
      const initialUsageCount = initialCache?.metadata.usageCount || 0;
      
      // Use cached version
      await optimizer.optimizeFlowWithCaching(mockFlow);
      
      const updatedCache = (optimizer as any).modelCache.get(signature);
      expect(updatedCache?.metadata.usageCount).toBe(initialUsageCount + 1);
      expect(updatedCache?.lastUsed.getTime()).toBeGreaterThan(initialCache?.lastUsed.getTime() || 0);
    });

    it('should implement cache eviction for memory management', () => {
      // Fill cache
      for (let i = 0; i < 150; i++) {
        const testFlow = { ...mockFlow, id: `flow-${i}` };
        const signature = (optimizer as any).generateFlowSignature(testFlow);
        (optimizer as any).modelCache.set(signature, {
          signature,
          version: 1,
          createdAt: new Date(),
          lastUsed: new Date(),
          features: {} as any,
          predictions: {} as any,
          optimizations: [],
          metadata: { accuracy: 0.8, confidence: 0.8, usageCount: 1 }
        });
      }
      
      // Trigger eviction
      (optimizer as any).evictStaleCache();
      
      // Cache should be reduced
      expect((optimizer as any).modelCache.size).toBeLessThanOrEqual(100);
    });
  });

  describe('Pattern Analysis', () => {
    it('should detect anti-patterns in flow', async () => {
      // Create flow with anti-pattern (unnecessary complexity)
      const complexFlow = createMockFlow();
      
      // Add redundant transformations
      complexFlow.blocks.push(
        {
          id: 'transform-2',
          type: BlockType.TRANSFORM,
          label: 'Redundant Transform',
          parameters: [],
          position: { x: 400, y: 200 },
          connections: { inputs: ['transform-1'], outputs: ['transform-3'] }
        },
        {
          id: 'transform-3',
          type: BlockType.TRANSFORM,
          label: 'Another Transform',
          parameters: [],
          position: { x: 500, y: 200 },
          connections: { inputs: ['transform-2'], outputs: [] }
        }
      );
      
      const antiPatterns = await (optimizer as any).detectAntiPatterns(complexFlow);
      
      expect(antiPatterns).toBeDefined();
      expect(antiPatterns.length).toBeGreaterThan(0);
      expect(antiPatterns.some((p: any) => p.type === 'redundant-transformation')).toBe(true);
    });

    it('should identify optimization patterns', async () => {
      const patterns = await (optimizer as any).identifyOptimizationPatterns(mockFlow);
      
      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
      
      // Should identify parallel execution opportunity
      expect(patterns.some((p: any) => p.type === 'parallelizable-branches')).toBe(true);
    });

    it('should analyze scalability patterns', async () => {
      const scalabilityAnalysis = await (optimizer as any).analyzeScalabilityPatterns(mockFlow);
      
      expect(scalabilityAnalysis).toBeDefined();
      expect(scalabilityAnalysis.bottlenecks).toBeDefined();
      expect(scalabilityAnalysis.scalabilityScore).toBeGreaterThanOrEqual(0);
      expect(scalabilityAnalysis.scalabilityScore).toBeLessThanOrEqual(100);
    });

    it('should check security patterns', async () => {
      // Add potentially insecure block
      const insecureFlow = createMockFlow();
      insecureFlow.blocks.push({
        id: 'api-call-1',
        type: BlockType.API_CALL,
        label: 'External API',
        parameters: [
          { name: 'url', type: 'string', value: 'http://api.example.com' }, // HTTP instead of HTTPS
          { name: 'auth', type: 'string', value: 'plaintext-token' }
        ],
        position: { x: 600, y: 200 },
        connections: { inputs: ['transform-1'], outputs: [] }
      });
      
      const securityPatterns = await (optimizer as any).checkSecurityPatterns(insecureFlow);
      
      expect(securityPatterns).toBeDefined();
      expect(securityPatterns.length).toBeGreaterThan(0);
      expect(securityPatterns.some((p: any) => p.issue === 'insecure-protocol')).toBe(true);
    });
  });

  describe('Deep Pattern Analysis', () => {
    it('should perform comprehensive pattern analysis', async () => {
      const analysis = await optimizer.analyzeComplexPatterns(mockFlow);
      
      expect(analysis).toBeDefined();
      expect(analysis.antiPatterns).toBeDefined();
      expect(analysis.optimizationPatterns).toBeDefined();
      expect(analysis.scalabilityPatterns).toBeDefined();
      expect(analysis.securityPatterns).toBeDefined();
    });

    it('should detect N+1 query patterns', async () => {
      // Create flow with potential N+1 pattern
      const n1Flow = createMockFlow();
      
      // Add loop with database query inside
      n1Flow.blocks.push(
        {
          id: 'loop-1',
          type: BlockType.LOOP,
          label: 'For Each Item',
          parameters: [],
          position: { x: 400, y: 300 },
          connections: { inputs: ['transform-1'], outputs: ['db-1'] }
        },
        {
          id: 'db-1',
          type: BlockType.DATABASE,
          label: 'Query Database',
          parameters: [{ name: 'query', type: 'string', value: 'SELECT * FROM users WHERE id = ?' }],
          position: { x: 600, y: 300 },
          connections: { inputs: ['loop-1'], outputs: [] }
        }
      );
      
      const antiPatterns = await (optimizer as any).detectAntiPatterns(n1Flow);
      
      expect(antiPatterns.some((p: any) => p.type === 'n-plus-one-query')).toBe(true);
    });

    it('should detect synchronous operations that could be async', async () => {
      // Create flow with sequential API calls
      const syncFlow = createMockFlow();
      
      syncFlow.blocks.push(
        {
          id: 'api-1',
          type: BlockType.API_CALL,
          label: 'API Call 1',
          parameters: [],
          position: { x: 400, y: 400 },
          connections: { inputs: ['input-1'], outputs: ['api-2'] }
        },
        {
          id: 'api-2',
          type: BlockType.API_CALL,
          label: 'API Call 2',
          parameters: [],
          position: { x: 600, y: 400 },
          connections: { inputs: ['api-1'], outputs: ['api-3'] }
        },
        {
          id: 'api-3',
          type: BlockType.API_CALL,
          label: 'API Call 3',
          parameters: [],
          position: { x: 800, y: 400 },
          connections: { inputs: ['api-2'], outputs: [] }
        }
      );
      
      const patterns = await (optimizer as any).identifyOptimizationPatterns(syncFlow);
      
      expect(patterns.some((p: any) => p.type === 'sequential-async-operations')).toBe(true);
    });
  });

  describe('Flow Optimization Application', () => {
    it('should apply parallelization optimization', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      if (optimized.appliedOptimizations.some(o => o.type === 'parallelization')) {
        // Check that parallel blocks are properly connected
        const parallelBlocks = optimized.optimized.blocks.filter(b => 
          b.id === 'filter-1' || b.id === 'filter-2'
        );
        
        expect(parallelBlocks.length).toBe(2);
        
        // Both should have same input
        expect(parallelBlocks[0].connections.inputs).toEqual(parallelBlocks[1].connections.inputs);
      }
    });

    it('should apply caching optimization where beneficial', async () => {
      // Create flow with repeated expensive operations
      const expensiveFlow = createMockFlow();
      
      // Add same API call multiple times
      for (let i = 0; i < 3; i++) {
        expensiveFlow.blocks.push({
          id: `api-expensive-${i}`,
          type: BlockType.API_CALL,
          label: 'Expensive API',
          parameters: [{ name: 'endpoint', type: 'string', value: '/expensive-operation' }],
          position: { x: 400 + i * 100, y: 500 },
          connections: { inputs: ['transform-1'], outputs: [] }
        });
      }
      
      const optimized = await optimizer.optimizeFlow(expensiveFlow);
      
      const cachingOptimization = optimized.appliedOptimizations.find(o => o.type === 'caching');
      if (cachingOptimization) {
        expect(cachingOptimization.blocks.length).toBeGreaterThan(0);
        expect(cachingOptimization.estimatedGain).toBeGreaterThan(0);
      }
    });

    it('should merge compatible operations', async () => {
      // Create flow with mergeable filters
      const mergeableFlow = createMockFlow();
      
      // Replace two filters with compatible conditions
      const filter1 = mergeableFlow.blocks.find(b => b.id === 'filter-1');
      const filter2 = mergeableFlow.blocks.find(b => b.id === 'filter-2');
      
      if (filter1 && filter2) {
        filter1.parameters = [{ name: 'condition', type: 'string', value: 'status === "active"' }];
        filter2.parameters = [{ name: 'condition', type: 'string', value: 'type === "user"' }];
      }
      
      const optimized = await optimizer.optimizeFlow(mergeableFlow);
      
      const mergingOptimization = optimized.appliedOptimizations.find(o => o.type === 'merging');
      if (mergingOptimization) {
        expect(mergingOptimization.description).toContain('Merged');
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate expected performance gain', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      expect(optimized.mlPredictions.expectedPerformanceGain).toBeGreaterThanOrEqual(0);
      expect(optimized.mlPredictions.expectedPerformanceGain).toBeLessThanOrEqual(100);
    });

    it('should provide confidence scores', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      expect(optimized.confidence).toBeGreaterThan(0);
      expect(optimized.confidence).toBeLessThanOrEqual(1);
      
      // Individual optimization confidence
      optimized.appliedOptimizations.forEach(opt => {
        expect(opt.confidence).toBeGreaterThan(0);
        expect(opt.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should estimate optimization difficulty', async () => {
      const optimized = await optimizer.optimizeFlow(mockFlow);
      
      optimized.mlPredictions.optimizationOpportunities.forEach(opp => {
        expect(opp.difficulty).toMatch(/low|medium|high/);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty flows', async () => {
      const emptyFlow: VisualFlow = {
        id: 'empty',
        name: 'Empty Flow',
        description: 'Empty',
        blocks: [],
        connections: [],
        metadata: {
          language: 'javascript',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        }
      };
      
      const result = await optimizer.optimizeFlow(emptyFlow);
      
      expect(result.optimized.blocks).toHaveLength(0);
      expect(result.appliedOptimizations).toHaveLength(0);
    });

    it('should handle disconnected blocks', async () => {
      const disconnectedFlow = createMockFlow();
      
      // Add disconnected block
      disconnectedFlow.blocks.push({
        id: 'disconnected-1',
        type: BlockType.CUSTOM,
        label: 'Disconnected Block',
        parameters: [],
        position: { x: 1000, y: 500 },
        connections: { inputs: [], outputs: [] }
      });
      
      const result = await optimizer.optimizeFlow(disconnectedFlow);
      
      // Should still optimize the connected parts
      expect(result).toBeDefined();
      expect(result.optimized).toBeDefined();
    });

    it('should handle circular dependencies', async () => {
      const circularFlow = createMockFlow();
      
      // Create circular connection
      const transformBlock = circularFlow.blocks.find(b => b.id === 'transform-1');
      const aggregateBlock = circularFlow.blocks.find(b => b.id === 'aggregate-1');
      
      if (transformBlock && aggregateBlock) {
        // Add connection from aggregate back to transform
        aggregateBlock.connections.outputs.push('transform-1');
        transformBlock.connections.inputs.push('aggregate-1');
        
        circularFlow.connections.push({
          id: 'circular-conn',
          from: { blockId: 'aggregate-1', output: 'feedback' },
          to: { blockId: 'transform-1', input: 'feedback' }
        });
      }
      
      const antiPatterns = await (optimizer as any).detectAntiPatterns(circularFlow);
      
      expect(antiPatterns.some((p: any) => p.type === 'circular-dependency')).toBe(true);
    });

    it('should handle very large flows', async () => {
      const largeFlow = createMockFlow();
      
      // Add many blocks
      for (let i = 0; i < 100; i++) {
        largeFlow.blocks.push({
          id: `block-${i}`,
          type: BlockType.TRANSFORM,
          label: `Transform ${i}`,
          parameters: [],
          position: { x: 100 + (i % 10) * 100, y: 100 + Math.floor(i / 10) * 100 },
          connections: { inputs: [], outputs: [] }
        });
      }
      
      const startTime = Date.now();
      const result = await optimizer.optimizeFlow(largeFlow);
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Model Versioning', () => {
    it('should track model versions', () => {
      const version1 = { version: 1, createdAt: new Date(), accuracy: 0.8, changesSince: [] };
      const version2 = { 
        version: 2, 
        createdAt: new Date(), 
        accuracy: 0.85, 
        changesSince: ['Improved pattern detection', 'Added anti-pattern analysis'] 
      };
      
      (optimizer as any).modelVersions.set('v1', version1);
      (optimizer as any).modelVersions.set('v2', version2);
      
      expect((optimizer as any).modelVersions.get('v2').accuracy).toBeGreaterThan(
        (optimizer as any).modelVersions.get('v1').accuracy
      );
    });
  });
});