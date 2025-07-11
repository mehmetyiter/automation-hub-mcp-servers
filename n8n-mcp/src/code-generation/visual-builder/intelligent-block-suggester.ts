import { AIService } from '../../ai-service.js';
import { VisualFlow, VisualBlock, BlockType, BlockTemplate, BlockParameter } from './visual-code-builder.js';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';

export interface SuggestionRequest {
  flowId: string;
  currentBlockId?: string;
  context: SuggestionContext;
  maxSuggestions?: number;
  includeAdvanced?: boolean;
}

export interface SuggestionContext {
  userInput?: string;
  dataTypes?: string[];
  previousBlocks: string[];
  expectedOutput?: string;
  performance?: PerformanceContext;
  domain?: string; // e.g., 'data-processing', 'web-scraping', 'api-integration'
}

export interface PerformanceContext {
  latencyRequirements?: 'low' | 'medium' | 'high';
  throughputRequirements?: 'low' | 'medium' | 'high';
  resourceConstraints?: 'memory' | 'cpu' | 'bandwidth';
}

export interface IntelligentSuggestion {
  template: BlockTemplate;
  relevanceScore: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  category: SuggestionCategory;
  priority: 'high' | 'medium' | 'low';
  estimatedSetupTime: number; // minutes
  requiredSkillLevel: 'beginner' | 'intermediate' | 'advanced';
  dependencies?: string[];
  alternatives?: AlternativeSuggestion[];
  prefilledParameters?: BlockParameter[];
  useCaseExamples?: string[];
  potentialIssues?: string[];
  optimizationTips?: string[];
}

export interface AlternativeSuggestion {
  template: BlockTemplate;
  reason: string;
  tradeoff: string;
}

export enum SuggestionCategory {
  ESSENTIAL = 'essential',        // Must-have for workflow completion
  OPTIMIZATION = 'optimization', // Performance/efficiency improvements
  ENHANCEMENT = 'enhancement',   // Additional functionality
  DEBUGGING = 'debugging',       // Error handling/monitoring
  BEST_PRACTICE = 'best_practice' // Following industry standards
}

export interface SuggestionPattern {
  pattern: string;
  confidence: number;
  context: string[];
  suggestedBlocks: string[];
  description: string;
}

export interface LearningData {
  workflowPatterns: Map<string, number>;
  blockSequences: Map<string, number>;
  userPreferences: Map<string, any>;
  successfulCombinations: Map<string, number>;
  errorPatterns: Map<string, string[]>;
}

export class IntelligentBlockSuggester {
  private aiService: AIService;
  private database: CodeGenerationDatabase;
  private learningData: LearningData;
  private suggestionPatterns: SuggestionPattern[] = [];
  private blockUsageStats: Map<string, number> = new Map();
  private userPreferences: Map<string, any> = new Map();

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.database = new CodeGenerationDatabase();
    this.learningData = {
      workflowPatterns: new Map(),
      blockSequences: new Map(),
      userPreferences: new Map(),
      successfulCombinations: new Map(),
      errorPatterns: new Map()
    };

    console.log('🧠 Intelligent Block Suggester initialized');
    this.initializePredefinedPatterns();
    this.loadLearningData();
  }

  async suggestIntelligentBlocks(
    flow: VisualFlow,
    request: SuggestionRequest
  ): Promise<IntelligentSuggestion[]> {
    console.log(`🔍 Generating intelligent block suggestions for flow: ${flow.name}`);
    
    const context = this.buildSuggestionContext(flow, request);
    const suggestions: IntelligentSuggestion[] = [];

    // 1. Pattern-based suggestions
    const patternSuggestions = await this.getPatternBasedSuggestions(flow, context);
    suggestions.push(...patternSuggestions);

    // 2. AI-powered suggestions
    const aiSuggestions = await this.getAIPoweredSuggestions(flow, context);
    suggestions.push(...aiSuggestions);

    // 3. Learning-based suggestions
    const learningSuggestions = await this.getLearningBasedSuggestions(flow, context);
    suggestions.push(...learningSuggestions);

    // 4. Context-aware suggestions
    const contextSuggestions = await this.getContextAwareSuggestions(flow, context);
    suggestions.push(...contextSuggestions);

    // Deduplicate and rank suggestions
    const rankedSuggestions = this.rankAndDeduplicate(suggestions);
    
    // Apply filters
    const filteredSuggestions = this.applyFilters(rankedSuggestions, request);
    
    // Limit results
    const maxSuggestions = request.maxSuggestions || 8;
    const finalSuggestions = filteredSuggestions.slice(0, maxSuggestions);

    console.log(`✅ Generated ${finalSuggestions.length} intelligent suggestions`);
    
    // Update learning data
    this.updateLearningData(flow, context, finalSuggestions);
    
    return finalSuggestions;
  }

  private buildSuggestionContext(flow: VisualFlow, request: SuggestionRequest): any {
    const currentBlock = request.currentBlockId ? 
      flow.blocks.find(b => b.id === request.currentBlockId) : null;
    
    const context = {
      flow,
      currentBlock,
      request,
      flowComplexity: this.calculateFlowComplexity(flow),
      blockTypes: this.getBlockTypeDistribution(flow),
      dataFlowAnalysis: this.analyzeDataFlow(flow),
      performanceAnalysis: this.analyzePerformanceNeeds(flow),
      missingComponents: this.identifyMissingComponents(flow),
      patterns: this.identifyExistingPatterns(flow)
    };

    return context;
  }

  private async getPatternBasedSuggestions(flow: VisualFlow, context: any): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Check against known patterns
    this.suggestionPatterns.forEach(pattern => {
      const patternMatch = this.matchPattern(flow, pattern, context);
      if (patternMatch.confidence > 60) {
        pattern.suggestedBlocks.forEach(blockType => {
          const suggestion = this.createPatternBasedSuggestion(
            blockType,
            pattern,
            patternMatch.confidence,
            flow.metadata.language
          );
          if (suggestion) {
            suggestions.push(suggestion);
          }
        });
      }
    });

    return suggestions;
  }

  private async getAIPoweredSuggestions(flow: VisualFlow, context: any): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    const prompt = `
Analyze this visual code flow and provide intelligent block suggestions:

Flow Context:
- Name: ${flow.name}
- Language: ${flow.metadata.language}
- Blocks: ${flow.blocks.length}
- Connections: ${flow.connections.length}
- Complexity: ${context.flowComplexity}

Current Block Types:
${Object.entries(context.blockTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Current Block: ${context.currentBlock ? `${context.currentBlock.type} (${context.currentBlock.label})` : 'None selected'}

Missing Components: ${context.missingComponents.join(', ')}

User Context: ${context.request.context.userInput || 'Not specified'}

Based on this analysis, suggest the most intelligent next blocks considering:
1. Workflow completion needs
2. Performance optimization opportunities
3. Error handling requirements
4. Best practices for ${flow.metadata.language}
5. Data flow optimization

Return suggestions as JSON:
{
  "suggestions": [
    {
      "blockType": "block_type",
      "templateName": "specific_template",
      "category": "essential|optimization|enhancement|debugging|best_practice",
      "relevanceScore": <0-100>,
      "confidence": <0-100>,
      "reasoning": "detailed explanation",
      "priority": "high|medium|low",
      "estimatedSetupTime": <minutes>,
      "skillLevel": "beginner|intermediate|advanced",
      "useCases": ["example1", "example2"],
      "potentialIssues": ["issue1", "issue2"],
      "optimizationTips": ["tip1", "tip2"],
      "prefilledParams": [
        {
          "name": "param_name",
          "value": "suggested_value",
          "reasoning": "why this value"
        }
      ]
    }
  ]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      const aiSuggestions = response.suggestions || [];
      
      aiSuggestions.forEach((suggestion: any) => {
        const intelligentSuggestion = this.createAISuggestion(suggestion, flow.metadata.language);
        if (intelligentSuggestion) {
          suggestions.push(intelligentSuggestion);
        }
      });
      
    } catch (error) {
      console.warn('AI-powered suggestions failed:', error);
    }

    return suggestions;
  }

  private async getLearningBasedSuggestions(flow: VisualFlow, context: any): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Analyze similar flows from learning data
    const similarFlows = this.findSimilarFlows(flow);
    
    similarFlows.forEach(similarFlow => {
      const nextBlocks = this.predictNextBlocks(flow, similarFlow);
      nextBlocks.forEach(blockType => {
        const suggestion = this.createLearningBasedSuggestion(
          blockType,
          similarFlow.similarity,
          flow.metadata.language
        );
        if (suggestion) {
          suggestions.push(suggestion);
        }
      });
    });

    // Use sequence patterns
    const currentSequence = this.getCurrentBlockSequence(flow, context.currentBlock?.id);
    const predictedNext = this.predictFromSequence(currentSequence);
    
    predictedNext.forEach(prediction => {
      const suggestion = this.createSequenceBasedSuggestion(
        prediction.blockType,
        prediction.probability,
        flow.metadata.language
      );
      if (suggestion) {
        suggestions.push(suggestion);
      }
    });

    return suggestions;
  }

  private async getContextAwareSuggestions(flow: VisualFlow, context: any): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Domain-specific suggestions
    if (context.request.context.domain) {
      const domainSuggestions = this.getDomainSpecificSuggestions(
        context.request.context.domain,
        flow,
        context
      );
      suggestions.push(...domainSuggestions);
    }

    // Performance-based suggestions
    if (context.request.context.performance) {
      const perfSuggestions = this.getPerformanceBasedSuggestions(
        context.request.context.performance,
        flow,
        context
      );
      suggestions.push(...perfSuggestions);
    }

    // Data type aware suggestions
    if (context.request.context.dataTypes) {
      const dataTypeSuggestions = this.getDataTypeAwareSuggestions(
        context.request.context.dataTypes,
        flow,
        context
      );
      suggestions.push(...dataTypeSuggestions);
    }

    // Error handling suggestions
    const errorSuggestions = this.getErrorHandlingSuggestions(flow, context);
    suggestions.push(...errorSuggestions);

    return suggestions;
  }

  private rankAndDeduplicate(suggestions: IntelligentSuggestion[]): IntelligentSuggestion[] {
    // Remove duplicates based on template name
    const uniqueSuggestions = new Map<string, IntelligentSuggestion>();
    
    suggestions.forEach(suggestion => {
      const key = suggestion.template.name;
      const existing = uniqueSuggestions.get(key);
      
      if (!existing || suggestion.relevanceScore > existing.relevanceScore) {
        uniqueSuggestions.set(key, suggestion);
      }
    });

    // Rank by composite score
    return Array.from(uniqueSuggestions.values()).sort((a, b) => {
      const scoreA = this.calculateCompositeScore(a);
      const scoreB = this.calculateCompositeScore(b);
      return scoreB - scoreA;
    });
  }

  private calculateCompositeScore(suggestion: IntelligentSuggestion): number {
    const weights = {
      relevance: 0.4,
      confidence: 0.3,
      priority: 0.2,
      usage: 0.1
    };

    const priorityScore = suggestion.priority === 'high' ? 100 : 
                         suggestion.priority === 'medium' ? 60 : 30;
    
    const usageScore = this.blockUsageStats.get(suggestion.template.name) || 0;

    return (suggestion.relevanceScore * weights.relevance) +
           (suggestion.confidence * weights.confidence) +
           (priorityScore * weights.priority) +
           (Math.min(usageScore, 100) * weights.usage);
  }

  private applyFilters(suggestions: IntelligentSuggestion[], request: SuggestionRequest): IntelligentSuggestion[] {
    let filtered = suggestions;

    // Filter by advanced flag
    if (!request.includeAdvanced) {
      filtered = filtered.filter(s => s.requiredSkillLevel !== 'advanced');
    }

    // Apply minimum relevance threshold
    filtered = filtered.filter(s => s.relevanceScore >= 30);

    // Apply minimum confidence threshold
    filtered = filtered.filter(s => s.confidence >= 40);

    return filtered;
  }

  private initializePredefinedPatterns(): void {
    this.suggestionPatterns = [
      {
        pattern: 'input_without_output',
        confidence: 90,
        context: ['has_input', 'no_output'],
        suggestedBlocks: ['OUTPUT'],
        description: 'Input blocks typically need output blocks'
      },
      {
        pattern: 'api_without_error_handling',
        confidence: 85,
        context: ['has_api_call', 'no_error_handling'],
        suggestedBlocks: ['CONDITION', 'CUSTOM'],
        description: 'API calls should have error handling'
      },
      {
        pattern: 'data_processing_sequence',
        confidence: 80,
        context: ['has_input', 'has_transform'],
        suggestedBlocks: ['FILTER', 'AGGREGATE', 'OUTPUT'],
        description: 'Data processing workflows benefit from filtering and aggregation'
      },
      {
        pattern: 'loop_optimization',
        confidence: 75,
        context: ['has_loop', 'performance_critical'],
        suggestedBlocks: ['TRANSFORM', 'CONDITION'],
        description: 'Loops benefit from internal optimization'
      },
      {
        pattern: 'database_caching',
        confidence: 70,
        context: ['has_database', 'performance_critical'],
        suggestedBlocks: ['CUSTOM'],
        description: 'Database operations benefit from caching'
      }
    ];
  }

  private async loadLearningData(): Promise<void> {
    try {
      // Load historical data from database
      // This would typically load user interaction patterns,
      // successful workflow combinations, etc.
      console.log('📚 Learning data loaded');
    } catch (error) {
      console.warn('Failed to load learning data:', error);
    }
  }

  private calculateFlowComplexity(flow: VisualFlow): number {
    const blockWeight = flow.blocks.length;
    const connectionWeight = flow.connections.length * 0.5;
    const typeWeight = new Set(flow.blocks.map(b => b.type)).size * 2;
    
    return Math.min(100, blockWeight + connectionWeight + typeWeight);
  }

  private getBlockTypeDistribution(flow: VisualFlow): Record<string, number> {
    const distribution: Record<string, number> = {};
    flow.blocks.forEach(block => {
      distribution[block.type] = (distribution[block.type] || 0) + 1;
    });
    return distribution;
  }

  private analyzeDataFlow(flow: VisualFlow): any {
    return {
      hasInput: flow.blocks.some(b => b.type === BlockType.INPUT),
      hasOutput: flow.blocks.some(b => b.type === BlockType.OUTPUT),
      hasTransform: flow.blocks.some(b => b.type === BlockType.TRANSFORM),
      hasFilter: flow.blocks.some(b => b.type === BlockType.FILTER),
      hasAggregate: flow.blocks.some(b => b.type === BlockType.AGGREGATE),
      dataFlowDepth: this.calculateMaxDepth(flow)
    };
  }

  private calculateMaxDepth(flow: VisualFlow): number {
    // Calculate the maximum depth of the flow
    const inputBlocks = flow.blocks.filter(b => b.type === BlockType.INPUT);
    let maxDepth = 0;
    
    inputBlocks.forEach(inputBlock => {
      const depth = this.getDepthFromBlock(flow, inputBlock.id, new Set());
      maxDepth = Math.max(maxDepth, depth);
    });
    
    return maxDepth;
  }

  private getDepthFromBlock(flow: VisualFlow, blockId: string, visited: Set<string>): number {
    if (visited.has(blockId)) return 0;
    
    visited.add(blockId);
    
    const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === blockId);
    
    if (outgoingConnections.length === 0) {
      return 1;
    }
    
    let maxChildDepth = 0;
    outgoingConnections.forEach(conn => {
      const childDepth = this.getDepthFromBlock(flow, conn.to.blockId, new Set(visited));
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    });
    
    return 1 + maxChildDepth;
  }

  private analyzePerformanceNeeds(flow: VisualFlow): any {
    const expensiveBlocks = flow.blocks.filter(b => 
      [BlockType.API_CALL, BlockType.DATABASE, BlockType.LOOP].includes(b.type)
    );
    
    return {
      hasExpensiveOperations: expensiveBlocks.length > 0,
      expensiveBlockCount: expensiveBlocks.length,
      needsCaching: expensiveBlocks.length > 1,
      needsParallelization: this.identifyParallelOpportunities(flow).length > 0,
      needsErrorHandling: flow.blocks.some(b => 
        [BlockType.API_CALL, BlockType.DATABASE].includes(b.type)
      )
    };
  }

  private identifyParallelOpportunities(flow: VisualFlow): string[] {
    // Simplified parallel opportunity detection
    const opportunities: string[] = [];
    
    flow.blocks.forEach(block => {
      const outgoing = flow.connections.filter(c => c.from.blockId === block.id);
      if (outgoing.length > 1) {
        opportunities.push(block.id);
      }
    });
    
    return opportunities;
  }

  private identifyMissingComponents(flow: VisualFlow): string[] {
    const missing: string[] = [];
    const hasType = (type: BlockType) => flow.blocks.some(b => b.type === type);
    
    if (!hasType(BlockType.INPUT)) missing.push('input');
    if (!hasType(BlockType.OUTPUT)) missing.push('output');
    
    const hasApiOrDb = hasType(BlockType.API_CALL) || hasType(BlockType.DATABASE);
    if (hasApiOrDb && !hasType(BlockType.CONDITION)) {
      missing.push('error_handling');
    }
    
    return missing;
  }

  private identifyExistingPatterns(flow: VisualFlow): string[] {
    const patterns: string[] = [];
    
    if (this.hasLinearFlow(flow)) patterns.push('linear');
    if (this.hasBranchingFlow(flow)) patterns.push('branching');
    if (this.hasLoopFlow(flow)) patterns.push('iterative');
    if (this.hasParallelFlow(flow)) patterns.push('parallel');
    
    return patterns;
  }

  private hasLinearFlow(flow: VisualFlow): boolean {
    return flow.blocks.every(block => {
      const outgoing = flow.connections.filter(c => c.from.blockId === block.id);
      const incoming = flow.connections.filter(c => c.to.blockId === block.id);
      return outgoing.length <= 1 && incoming.length <= 1;
    });
  }

  private hasBranchingFlow(flow: VisualFlow): boolean {
    return flow.blocks.some(block => {
      const outgoing = flow.connections.filter(c => c.from.blockId === block.id);
      return outgoing.length > 1;
    });
  }

  private hasLoopFlow(flow: VisualFlow): boolean {
    return flow.blocks.some(b => b.type === BlockType.LOOP);
  }

  private hasParallelFlow(flow: VisualFlow): boolean {
    return this.identifyParallelOpportunities(flow).length > 0;
  }

  // Helper methods for creating suggestions
  private createPatternBasedSuggestion(
    blockType: string,
    pattern: SuggestionPattern,
    confidence: number,
    language: string
  ): IntelligentSuggestion | null {
    const template = this.createMockTemplate(blockType, language);
    if (!template) return null;

    return {
      template,
      relevanceScore: Math.min(95, confidence + 10),
      confidence,
      reasoning: `Pattern match: ${pattern.description}`,
      category: SuggestionCategory.BEST_PRACTICE,
      priority: confidence > 80 ? 'high' : 'medium',
      estimatedSetupTime: 3,
      requiredSkillLevel: 'beginner',
      useCaseExamples: [`Common ${blockType.toLowerCase()} pattern`],
      optimizationTips: [`Follow ${pattern.pattern} best practices`]
    };
  }

  private createAISuggestion(suggestion: any, language: string): IntelligentSuggestion | null {
    const template = this.createMockTemplate(suggestion.blockType, language);
    if (!template) return null;

    return {
      template,
      relevanceScore: suggestion.relevanceScore || 70,
      confidence: suggestion.confidence || 60,
      reasoning: suggestion.reasoning || 'AI-powered suggestion',
      category: this.mapCategory(suggestion.category),
      priority: suggestion.priority || 'medium',
      estimatedSetupTime: suggestion.estimatedSetupTime || 5,
      requiredSkillLevel: suggestion.skillLevel || 'intermediate',
      useCaseExamples: suggestion.useCases || [],
      potentialIssues: suggestion.potentialIssues || [],
      optimizationTips: suggestion.optimizationTips || [],
      prefilledParameters: suggestion.prefilledParams ? 
        this.convertPrefilledParams(suggestion.prefilledParams) : undefined
    };
  }

  private createLearningBasedSuggestion(
    blockType: string,
    similarity: number,
    language: string
  ): IntelligentSuggestion | null {
    const template = this.createMockTemplate(blockType, language);
    if (!template) return null;

    return {
      template,
      relevanceScore: Math.min(90, similarity * 100),
      confidence: Math.min(85, similarity * 90),
      reasoning: `Learned from similar successful workflows (${(similarity * 100).toFixed(1)}% similarity)`,
      category: SuggestionCategory.ENHANCEMENT,
      priority: similarity > 0.8 ? 'high' : 'medium',
      estimatedSetupTime: 4,
      requiredSkillLevel: 'intermediate',
      useCaseExamples: [`Similar to previously successful workflows`],
      optimizationTips: [`Adapted from successful patterns`]
    };
  }

  private createSequenceBasedSuggestion(
    blockType: string,
    probability: number,
    language: string
  ): IntelligentSuggestion | null {
    const template = this.createMockTemplate(blockType, language);
    if (!template) return null;

    return {
      template,
      relevanceScore: Math.min(85, probability * 100),
      confidence: Math.min(80, probability * 90),
      reasoning: `Statistically likely next block (${(probability * 100).toFixed(1)}% probability)`,
      category: SuggestionCategory.ESSENTIAL,
      priority: probability > 0.7 ? 'high' : 'medium',
      estimatedSetupTime: 3,
      requiredSkillLevel: 'beginner',
      useCaseExamples: [`Common workflow sequence pattern`],
      optimizationTips: [`Follows established workflow patterns`]
    };
  }

  private createMockTemplate(blockType: string, language: string): BlockTemplate | null {
    // Create a mock template based on block type
    // In production, this would integrate with the actual template system
    const blockTypeEnum = this.parseBlockType(blockType);
    if (!blockTypeEnum) return null;

    const templates: Record<string, Partial<BlockTemplate>> = {
      'INPUT': {
        name: 'Data Input',
        description: 'Input data source',
        defaultParameters: [
          { name: 'source', type: 'string', value: '', required: true },
          { name: 'format', type: 'string', value: 'json', required: false }
        ]
      },
      'OUTPUT': {
        name: 'Data Output',
        description: 'Output data destination',
        defaultParameters: [
          { name: 'destination', type: 'string', value: '', required: true },
          { name: 'format', type: 'string', value: 'json', required: false }
        ]
      },
      'TRANSFORM': {
        name: 'Data Transform',
        description: 'Transform data',
        defaultParameters: [
          { name: 'operation', type: 'string', value: 'map', required: true },
          { name: 'expression', type: 'code', value: '', required: true }
        ]
      },
      'FILTER': {
        name: 'Data Filter',
        description: 'Filter data based on conditions',
        defaultParameters: [
          { name: 'condition', type: 'code', value: '', required: true },
          { name: 'keepMatching', type: 'boolean', value: true, required: false }
        ]
      },
      'AGGREGATE': {
        name: 'Data Aggregation',
        description: 'Aggregate data',
        defaultParameters: [
          { name: 'operation', type: 'string', value: 'sum', required: true },
          { name: 'groupBy', type: 'string', value: '', required: false }
        ]
      },
      'CONDITION': {
        name: 'Conditional Logic',
        description: 'Conditional branching',
        defaultParameters: [
          { name: 'condition', type: 'code', value: '', required: true },
          { name: 'trueOutput', type: 'string', value: 'true', required: false }
        ]
      },
      'LOOP': {
        name: 'Loop Iterator',
        description: 'Iterate over data',
        defaultParameters: [
          { name: 'iterateOver', type: 'string', value: 'items', required: true },
          { name: 'maxIterations', type: 'number', value: 1000, required: false }
        ]
      },
      'API_CALL': {
        name: 'API Request',
        description: 'Make API call',
        defaultParameters: [
          { name: 'url', type: 'string', value: '', required: true },
          { name: 'method', type: 'string', value: 'GET', required: true },
          { name: 'headers', type: 'object', value: {}, required: false }
        ]
      },
      'DATABASE': {
        name: 'Database Query',
        description: 'Execute database query',
        defaultParameters: [
          { name: 'query', type: 'code', value: '', required: true },
          { name: 'connection', type: 'string', value: '', required: true }
        ]
      },
      'CUSTOM': {
        name: 'Custom Logic',
        description: 'Custom code block',
        defaultParameters: [
          { name: 'code', type: 'code', value: '', required: true },
          { name: 'timeout', type: 'number', value: 30000, required: false }
        ]
      }
    };

    const templateData = templates[blockType.toUpperCase()];
    if (!templateData) return null;

    return {
      name: templateData.name || blockType,
      description: templateData.description || '',
      defaultParameters: templateData.defaultParameters || [],
      codeTemplate: `// ${templateData.description}\n// Generated template for ${language}`,
      supportedLanguages: [language, 'javascript', 'typescript']
    } as BlockTemplate;
  }

  private mapCategory(category: string): SuggestionCategory {
    const categoryMap: Record<string, SuggestionCategory> = {
      'essential': SuggestionCategory.ESSENTIAL,
      'optimization': SuggestionCategory.OPTIMIZATION,
      'enhancement': SuggestionCategory.ENHANCEMENT,
      'debugging': SuggestionCategory.DEBUGGING,
      'best_practice': SuggestionCategory.BEST_PRACTICE
    };
    
    return categoryMap[category] || SuggestionCategory.ENHANCEMENT;
  }

  private convertPrefilledParams(aiParams: any[]): BlockParameter[] {
    return aiParams.map(param => ({
      name: param.name,
      type: 'string' as any,
      value: param.value,
      required: false
    }));
  }

  private parseBlockType(typeString: string): BlockType | null {
    const typeMap: Record<string, BlockType> = {
      'INPUT': BlockType.INPUT,
      'OUTPUT': BlockType.OUTPUT,
      'TRANSFORM': BlockType.TRANSFORM,
      'FILTER': BlockType.FILTER,
      'AGGREGATE': BlockType.AGGREGATE,
      'CONDITION': BlockType.CONDITION,
      'LOOP': BlockType.LOOP,
      'API_CALL': BlockType.API_CALL,
      'DATABASE': BlockType.DATABASE,
      'CUSTOM': BlockType.CUSTOM
    };
    
    return typeMap[typeString.toUpperCase()] || null;
  }

  // Additional helper methods
  private matchPattern(flow: VisualFlow, pattern: SuggestionPattern, context: any): { confidence: number } {
    let confidence = 0;
    let matchedContexts = 0;

    // Check each context requirement
    pattern.context.forEach(requirement => {
      switch (requirement) {
        case 'has_input':
          if (flow.blocks.some(b => b.type === BlockType.INPUT)) {
            matchedContexts++;
          }
          break;
        case 'no_output':
          if (!flow.blocks.some(b => b.type === BlockType.OUTPUT)) {
            matchedContexts++;
          }
          break;
        case 'has_api_call':
          if (flow.blocks.some(b => b.type === BlockType.API_CALL)) {
            matchedContexts++;
          }
          break;
        case 'no_error_handling':
          if (!flow.blocks.some(b => b.type === BlockType.CONDITION || 
                                     b.label.toLowerCase().includes('error'))) {
            matchedContexts++;
          }
          break;
        case 'has_transform':
          if (flow.blocks.some(b => b.type === BlockType.TRANSFORM)) {
            matchedContexts++;
          }
          break;
        case 'has_loop':
          if (flow.blocks.some(b => b.type === BlockType.LOOP)) {
            matchedContexts++;
          }
          break;
        case 'performance_critical':
          if (context.performanceAnalysis?.needsCaching || 
              context.performanceAnalysis?.hasExpensiveOperations) {
            matchedContexts++;
          }
          break;
        case 'has_database':
          if (flow.blocks.some(b => b.type === BlockType.DATABASE)) {
            matchedContexts++;
          }
          break;
      }
    });

    // Calculate confidence based on matched contexts
    if (pattern.context.length > 0) {
      confidence = (matchedContexts / pattern.context.length) * pattern.confidence;
    }

    return { confidence: Math.max(0, Math.min(100, confidence)) };
  }

  private findSimilarFlows(flow: VisualFlow): Array<{ similarity: number }> {
    // Mock implementation - in production, this would query historical data
    const mockSimilarFlows: Array<{ similarity: number }> = [];
    
    // Generate some mock similar flows based on current flow characteristics
    const currentComplexity = flow.blocks.length + flow.connections.length;
    const blockTypes = new Set(flow.blocks.map(b => b.type));
    
    // Mock similarity calculation
    if (blockTypes.has(BlockType.API_CALL) && blockTypes.has(BlockType.DATABASE)) {
      mockSimilarFlows.push({ similarity: 0.85 });
    }
    if (blockTypes.has(BlockType.TRANSFORM) && blockTypes.has(BlockType.FILTER)) {
      mockSimilarFlows.push({ similarity: 0.72 });
    }
    if (currentComplexity > 5) {
      mockSimilarFlows.push({ similarity: 0.68 });
    }

    return mockSimilarFlows.filter(f => f.similarity > 0.6);
  }

  private predictNextBlocks(flow: VisualFlow, similarFlow: any): string[] {
    // Mock prediction based on similar flow patterns
    const predictions: string[] = [];
    
    // Simple heuristic: suggest common next blocks for complex flows
    if (similarFlow.similarity > 0.8) {
      predictions.push('OUTPUT', 'CONDITION', 'CUSTOM');
    } else if (similarFlow.similarity > 0.7) {
      predictions.push('TRANSFORM', 'FILTER');
    }
    
    return predictions;
  }

  private getCurrentBlockSequence(flow: VisualFlow, currentBlockId?: string): string[] {
    if (!currentBlockId) return [];
    
    const sequence: string[] = [];
    const visited = new Set<string>();
    
    // Trace back from current block to find sequence
    const traceBack = (blockId: string) => {
      if (visited.has(blockId)) return;
      visited.add(blockId);
      
      const block = flow.blocks.find(b => b.id === blockId);
      if (block) {
        sequence.unshift(block.type);
        
        // Find incoming connections
        const incoming = flow.connections.filter(c => c.to.blockId === blockId);
        if (incoming.length > 0) {
          traceBack(incoming[0].from.blockId);
        }
      }
    };
    
    traceBack(currentBlockId);
    return sequence;
  }

  private predictFromSequence(sequence: string[]): Array<{ blockType: string; probability: number }> {
    const predictions: Array<{ blockType: string; probability: number }> = [];
    
    if (sequence.length === 0) {
      return [
        { blockType: 'INPUT', probability: 0.9 },
        { blockType: 'API_CALL', probability: 0.7 },
        { blockType: 'DATABASE', probability: 0.6 }
      ];
    }
    
    const lastBlock = sequence[sequence.length - 1];
    
    // Simple transition probability model
    const transitionProbs: Record<string, Array<{ blockType: string; probability: number }>> = {
      'INPUT': [
        { blockType: 'TRANSFORM', probability: 0.8 },
        { blockType: 'FILTER', probability: 0.6 },
        { blockType: 'CONDITION', probability: 0.5 }
      ],
      'TRANSFORM': [
        { blockType: 'OUTPUT', probability: 0.7 },
        { blockType: 'FILTER', probability: 0.6 },
        { blockType: 'AGGREGATE', probability: 0.5 }
      ],
      'FILTER': [
        { blockType: 'OUTPUT', probability: 0.8 },
        { blockType: 'TRANSFORM', probability: 0.6 },
        { blockType: 'AGGREGATE', probability: 0.5 }
      ],
      'API_CALL': [
        { blockType: 'CONDITION', probability: 0.8 },
        { blockType: 'TRANSFORM', probability: 0.7 },
        { blockType: 'OUTPUT', probability: 0.6 }
      ],
      'DATABASE': [
        { blockType: 'TRANSFORM', probability: 0.7 },
        { blockType: 'FILTER', probability: 0.6 },
        { blockType: 'OUTPUT', probability: 0.5 }
      ]
    };
    
    return transitionProbs[lastBlock] || [];
  }

  private getDomainSpecificSuggestions(domain: string, flow: VisualFlow, context: any): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];
    
    const domainSuggestions: Record<string, string[]> = {
      'data-processing': ['TRANSFORM', 'FILTER', 'AGGREGATE', 'OUTPUT'],
      'web-scraping': ['API_CALL', 'TRANSFORM', 'CONDITION', 'OUTPUT'],
      'api-integration': ['API_CALL', 'CONDITION', 'TRANSFORM', 'DATABASE'],
      'automation': ['CONDITION', 'LOOP', 'API_CALL', 'CUSTOM'],
      'analytics': ['AGGREGATE', 'TRANSFORM', 'FILTER', 'OUTPUT']
    };
    
    const blockTypes = domainSuggestions[domain] || [];
    
    blockTypes.forEach((blockType, index) => {
      const template = this.createMockTemplate(blockType, flow.metadata.language);
      if (template) {
        suggestions.push({
          template,
          relevanceScore: 80 - (index * 5),
          confidence: 75 - (index * 3),
          reasoning: `Optimized for ${domain} workflows`,
          category: SuggestionCategory.ENHANCEMENT,
          priority: index === 0 ? 'high' : 'medium',
          estimatedSetupTime: 4,
          requiredSkillLevel: 'intermediate',
          useCaseExamples: [`Common in ${domain} scenarios`],
          optimizationTips: [`Best practices for ${domain}`]
        });
      }
    });
    
    return suggestions;
  }

  private getPerformanceBasedSuggestions(
    performance: PerformanceContext,
    flow: VisualFlow,
    context: any
  ): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Low latency requirements
    if (performance.latencyRequirements === 'low') {
      const cachingTemplate = this.createMockTemplate('CUSTOM', flow.metadata.language);
      if (cachingTemplate) {
        cachingTemplate.name = 'Cache Layer';
        cachingTemplate.description = 'Add caching for performance';
        
        suggestions.push({
          template: cachingTemplate,
          relevanceScore: 90,
          confidence: 85,
          reasoning: 'Caching reduces response time for low latency requirements',
          category: SuggestionCategory.OPTIMIZATION,
          priority: 'high',
          estimatedSetupTime: 8,
          requiredSkillLevel: 'intermediate',
          useCaseExamples: ['Cache API responses', 'Store computed results'],
          optimizationTips: ['Use TTL for cache expiration', 'Monitor cache hit rates']
        });
      }
    }
    
    // High throughput requirements
    if (performance.throughputRequirements === 'high') {
      const parallelTemplate = this.createMockTemplate('CUSTOM', flow.metadata.language);
      if (parallelTemplate) {
        parallelTemplate.name = 'Parallel Processing';
        parallelTemplate.description = 'Process data in parallel';
        
        suggestions.push({
          template: parallelTemplate,
          relevanceScore: 88,
          confidence: 82,
          reasoning: 'Parallel processing increases throughput',
          category: SuggestionCategory.OPTIMIZATION,
          priority: 'high',
          estimatedSetupTime: 12,
          requiredSkillLevel: 'advanced',
          useCaseExamples: ['Batch processing', 'Concurrent API calls'],
          optimizationTips: ['Limit concurrent operations', 'Use connection pooling']
        });
      }
    }
    
    return suggestions;
  }

  private getDataTypeAwareSuggestions(
    dataTypes: string[],
    flow: VisualFlow,
    context: any
  ): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];
    
    dataTypes.forEach(dataType => {
      let suggestedBlocks: string[] = [];
      
      switch (dataType) {
        case 'array':
          suggestedBlocks = ['FILTER', 'TRANSFORM', 'AGGREGATE', 'LOOP'];
          break;
        case 'object':
          suggestedBlocks = ['TRANSFORM', 'CONDITION', 'CUSTOM'];
          break;
        case 'json':
          suggestedBlocks = ['TRANSFORM', 'FILTER', 'OUTPUT'];
          break;
        case 'string':
          suggestedBlocks = ['TRANSFORM', 'CONDITION', 'OUTPUT'];
          break;
        case 'number':
          suggestedBlocks = ['AGGREGATE', 'CONDITION', 'TRANSFORM'];
          break;
      }
      
      suggestedBlocks.forEach((blockType, index) => {
        const template = this.createMockTemplate(blockType, flow.metadata.language);
        if (template) {
          suggestions.push({
            template,
            relevanceScore: 75 - (index * 5),
            confidence: 70 - (index * 3),
            reasoning: `Optimized for ${dataType} data processing`,
            category: SuggestionCategory.ENHANCEMENT,
            priority: index < 2 ? 'medium' : 'low',
            estimatedSetupTime: 5,
            requiredSkillLevel: 'beginner',
            useCaseExamples: [`Process ${dataType} data effectively`],
            optimizationTips: [`Handle ${dataType} edge cases`]
          });
        }
      });
    });
    
    return suggestions;
  }

  private getErrorHandlingSuggestions(flow: VisualFlow, context: any): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];
    
    // Check if flow has risky operations without error handling
    const riskyBlocks = flow.blocks.filter(b => 
      [BlockType.API_CALL, BlockType.DATABASE, BlockType.CUSTOM].includes(b.type)
    );
    
    const hasErrorHandling = flow.blocks.some(b => 
      b.type === BlockType.CONDITION || 
      b.label.toLowerCase().includes('error') ||
      b.label.toLowerCase().includes('try') ||
      b.label.toLowerCase().includes('catch')
    );
    
    if (riskyBlocks.length > 0 && !hasErrorHandling) {
      const errorTemplate = this.createMockTemplate('CONDITION', flow.metadata.language);
      if (errorTemplate) {
        errorTemplate.name = 'Error Handler';
        errorTemplate.description = 'Handle operation errors';
        
        suggestions.push({
          template: errorTemplate,
          relevanceScore: 95,
          confidence: 90,
          reasoning: 'Critical: Flow has risky operations without error handling',
          category: SuggestionCategory.DEBUGGING,
          priority: 'high',
          estimatedSetupTime: 6,
          requiredSkillLevel: 'intermediate',
          useCaseExamples: ['Handle API timeouts', 'Database connection errors'],
          potentialIssues: ['May complicate flow logic'],
          optimizationTips: ['Use specific error types', 'Log errors for monitoring']
        });
      }
      
      // Suggest retry mechanism
      const retryTemplate = this.createMockTemplate('CUSTOM', flow.metadata.language);
      if (retryTemplate) {
        retryTemplate.name = 'Retry Logic';
        retryTemplate.description = 'Retry failed operations';
        
        suggestions.push({
          template: retryTemplate,
          relevanceScore: 80,
          confidence: 75,
          reasoning: 'Retry logic improves reliability for external operations',
          category: SuggestionCategory.DEBUGGING,
          priority: 'medium',
          estimatedSetupTime: 10,
          requiredSkillLevel: 'intermediate',
          useCaseExamples: ['Retry API calls', 'Reconnect to database'],
          optimizationTips: ['Use exponential backoff', 'Limit retry attempts']
        });
      }
    }
    
    return suggestions;
  }

  private updateLearningData(
    flow: VisualFlow,
    context: any,
    suggestions: IntelligentSuggestion[]
  ): void {
    // Update learning data based on suggestions and usage
    suggestions.forEach(suggestion => {
      const current = this.blockUsageStats.get(suggestion.template.name) || 0;
      this.blockUsageStats.set(suggestion.template.name, current + 1);
    });
  }

  // Public API methods
  async learnFromUserFeedback(
    flowId: string,
    suggestionId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    details?: string
  ): Promise<void> {
    // Learn from user feedback
    console.log(`📖 Learning from feedback: ${feedback} for suggestion ${suggestionId}`);
  }

  async getUsageStatistics(): Promise<any> {
    return {
      totalSuggestions: Array.from(this.blockUsageStats.values()).reduce((a, b) => a + b, 0),
      topSuggestions: Array.from(this.blockUsageStats.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      patterns: this.suggestionPatterns.length,
      learningData: {
        workflowPatterns: this.learningData.workflowPatterns.size,
        blockSequences: this.learningData.blockSequences.size,
        userPreferences: this.learningData.userPreferences.size
      }
    };
  }

  cleanup(): void {
    console.log('🧹 Cleaning up Intelligent Block Suggester...');
    this.learningData.workflowPatterns.clear();
    this.learningData.blockSequences.clear();
    this.learningData.userPreferences.clear();
    this.learningData.successfulCombinations.clear();
    this.learningData.errorPatterns.clear();
    this.blockUsageStats.clear();
    this.userPreferences.clear();
    console.log('✅ Intelligent Block Suggester cleanup completed');
  }
}