import { EventEmitter } from 'events';
import { CostManager, CostSummary, BudgetLimits, BudgetStatus } from './cost-manager.js';
import { UsageTracker, APIUsageEvent, UsageStats } from './usage-tracker.js';
import { Redis } from 'ioredis';

export interface PricingOracle {
  getProviderPricing(provider: string, model: string): Promise<ModelPricing>;
  getRealtimePricing(provider: string): Promise<ProviderPricing>;
  updatePricingData(): Promise<void>;
  comparePricing(providers: string[], model: string): Promise<PricingComparison>;
}

export interface ModelPricing {
  provider: string;
  model: string;
  pricing: {
    inputTokenPrice: number;    // Price per 1000 input tokens
    outputTokenPrice: number;   // Price per 1000 output tokens
    requestPrice?: number;      // Fixed price per request
    minimumCharge?: number;     // Minimum charge per request
  };
  lastUpdated: Date;
  currency: string;
  tier: 'free' | 'pay-per-use' | 'subscription' | 'enterprise';
}

export interface ProviderPricing {
  provider: string;
  models: ModelPricing[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
  };
  discounts: {
    volumeDiscounts: VolumeDiscount[];
    loyaltyDiscount?: number;
    subscriptionDiscount?: number;
  };
  lastUpdated: Date;
}

export interface VolumeDiscount {
  minimumSpend: number;
  discountPercentage: number;
  description: string;
}

export interface PricingComparison {
  models: Array<{
    provider: string;
    model: string;
    pricing: ModelPricing['pricing'];
    estimatedMonthlyCost: number;
    costRank: number;
  }>;
  recommendations: string[];
  potentialSavings: number;
}

export interface OptimizationEngine {
  analyzeUsagePatterns(userId: string): Promise<UsageAnalysis>;
  generateOptimizationPlan(userId: string): Promise<OptimizationPlan>;
  implementAutomaticOptimizations(userId: string, plan: OptimizationPlan): Promise<OptimizationResult>;
  predictOptimalProviderMix(usagePattern: UsagePattern): Promise<ProviderMix>;
}

export interface UsageAnalysis {
  userId: string;
  analysisPeriod: {
    startDate: Date;
    endDate: Date;
  };
  patterns: {
    peakHours: number[];
    averageRequestsPerDay: number;
    modelUsageDistribution: Record<string, number>;
    providerUsageDistribution: Record<string, number>;
    costDistribution: Record<string, number>;
  };
  inefficiencies: {
    overusedModels: Array<{
      model: string;
      provider: string;
      overusePercentage: number;
      alternativeRecommendation: string;
    }>;
    expensiveOperations: Array<{
      operation: string;
      averageCost: number;
      optimizationPotential: number;
    }>;
    unusedCapacity: Array<{
      provider: string;
      quotaUtilization: number;
      wastedBudget: number;
    }>;
  };
  opportunities: OptimizationOpportunity[];
}

export interface OptimizationOpportunity {
  type: 'model_switch' | 'provider_switch' | 'batching' | 'caching' | 'timing' | 'preprocessing';
  title: string;
  description: string;
  potentialMonthlySavings: number;
  savingsPercentage: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTimeToImplement: string;
  prerequisites: string[];
  automatable: boolean;
}

export interface OptimizationPlan {
  userId: string;
  generatedAt: Date;
  currentMonthlyCost: number;
  optimizedMonthlyCost: number;
  totalPotentialSavings: number;
  savingsPercentage: number;
  optimizations: OptimizationAction[];
  timeline: {
    immediate: OptimizationAction[];     // 0-1 days
    shortTerm: OptimizationAction[];     // 1-7 days
    mediumTerm: OptimizationAction[];    // 1-4 weeks
    longTerm: OptimizationAction[];      // 1+ months
  };
  riskAssessment: OptimizationRisk;
}

export interface OptimizationAction {
  id: string;
  type: OptimizationOpportunity['type'];
  title: string;
  description: string;
  currentState: string;
  targetState: string;
  potentialSavings: number;
  implementationSteps: string[];
  automatable: boolean;
  autoImplemented: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  metrics: {
    successCriteria: string[];
    kpis: string[];
    rollbackTriggers: string[];
  };
}

export interface OptimizationRisk {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  risks: Array<{
    category: 'performance' | 'cost' | 'reliability' | 'compliance';
    description: string;
    probability: number; // 0-1
    impact: number;      // 0-1
    mitigation: string;
  }>;
  recommendations: string[];
}

export interface OptimizationResult {
  planId: string;
  executedActions: Array<{
    action: OptimizationAction;
    result: 'success' | 'partial' | 'failed';
    actualSavings: number;
    metrics: Record<string, number>;
    notes: string;
  }>;
  totalActualSavings: number;
  actualSavingsPercentage: number;
  performanceImpact: {
    latencyChange: number;
    reliabilityChange: number;
    qualityChange: number;
  };
  nextRecommendations: OptimizationOpportunity[];
}

export interface UsagePattern {
  requestVolume: number;
  tokenVolume: number;
  modelMix: Record<string, number>;
  timeDistribution: Record<string, number>;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ProviderMix {
  primary: string;
  secondary?: string;
  fallback?: string;
  distribution: Record<string, number>;
  estimatedMonthlyCost: number;
  confidenceScore: number;
  reasoning: string[];
}

export interface SwitchingRules {
  costThreshold: number;        // Switch if cost difference > threshold
  latencyThreshold: number;     // Max acceptable latency increase
  qualityThreshold: number;     // Min acceptable quality score
  reliabilityThreshold: number; // Min acceptable reliability
  autoSwitchEnabled: boolean;
  switchingCooldown: number;    // Seconds between switches
  preferredProviders: string[];
  blockedProviders: string[];
}

export interface ModelRecommendation {
  task: string;
  recommendations: Array<{
    provider: string;
    model: string;
    score: number;
    reasoning: string[];
    estimatedCost: number;
    estimatedLatency: number;
    qualityScore: number;
  }>;
  confidence: number;
}

export class IntelligentCostManager extends CostManager {
  private pricingOracle: PricingOracle;
  private optimizationEngine: OptimizationEngine;
  private redis: Redis;
  private eventEmitter: EventEmitter;
  
  // Cached data
  private providerPricing = new Map<string, ProviderPricing>();
  private userOptimizationPlans = new Map<string, OptimizationPlan>();
  private realtimeUsageData = new Map<string, UsagePattern>();

  // Configuration
  private config = {
    pricingUpdateInterval: 3600000,      // 1 hour
    optimizationCheckInterval: 86400000, // 24 hours  
    autoOptimizationEnabled: true,
    maxAutoOptimizationRisk: 'medium' as const,
    cacheTTL: 1800, // 30 minutes
  };

  constructor(redisUrl?: string) {
    // Create a mock database for now
    const mockDatabase = {
      query: async (sql: string, params?: any[]) => [],
      execute: async (sql: string, params?: any[]) => ({ affectedRows: 0 })
    };
    super(mockDatabase);
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.eventEmitter = new EventEmitter();
    this.pricingOracle = this.createPricingOracle();
    this.optimizationEngine = this.createOptimizationEngine();
    this.initializeIntelligentCostManager();
  }

  private initializeIntelligentCostManager(): void {
    console.log('🧠 Initializing Intelligent Cost Manager...');

    // Periodic pricing updates
    setInterval(async () => {
      await this.updateProviderPricing();
    }, this.config.pricingUpdateInterval);

    // Periodic optimization checks
    setInterval(async () => {
      await this.runOptimizationChecks();
    }, this.config.optimizationCheckInterval);

    // Load initial pricing data
    this.updateProviderPricing();

    console.log('✅ Intelligent Cost Manager initialized');
  }

  async analyzeUsagePatterns(userId: string): Promise<UsageAnalysis> {
    console.log(`📊 Analyzing usage patterns for user ${userId}...`);

    try {
      // Get usage data from the last 30 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const usageStats = await this.getUsageStats(userId, { startDate, endDate });
      const recentEvents = await this.getRecentUsageEvents(userId, 1000);

      // Analyze patterns
      const patterns = this.analyzeUsagePatterns_Internal(recentEvents);
      const inefficiencies = await this.identifyInefficiencies(userId, patterns, recentEvents);
      const opportunities = await this.identifyOptimizationOpportunities(userId, patterns, inefficiencies);

      const analysis: UsageAnalysis = {
        userId,
        analysisPeriod: { startDate, endDate },
        patterns,
        inefficiencies,
        opportunities
      };

      // Cache the analysis
      await this.redis.setex(
        `usage_analysis:${userId}`,
        this.config.cacheTTL,
        JSON.stringify(analysis)
      );

      console.log(`✅ Usage analysis completed for user ${userId}`);
      console.log(`   - ${opportunities.length} optimization opportunities found`);
      console.log(`   - Potential monthly savings: $${opportunities.reduce((sum, opp) => sum + opp.potentialMonthlySavings, 0).toFixed(2)}`);

      return analysis;

    } catch (error) {
      console.error(`❌ Error analyzing usage patterns for user ${userId}:`, error);
      throw error;
    }
  }

  async implementDynamicSwitching(userId: string, rules: SwitchingRules): Promise<any> {
    console.log(`🔄 Implementing dynamic switching for user ${userId}...`);

    try {
      // Store switching rules
      await this.redis.setex(
        `switching_rules:${userId}`,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify(rules)
      );

      // Get current usage patterns
      const usagePattern = await this.getUserUsagePattern(userId);
      
      // Calculate optimal provider mix
      const optimalMix = await this.optimizationEngine.predictOptimalProviderMix(usagePattern);

      // Implement switching strategy
      const strategy = {
        userId,
        currentMix: usagePattern.modelMix,
        targetMix: optimalMix.distribution,
        rules,
        implementedAt: new Date(),
        estimatedMonthlySavings: optimalMix.estimatedMonthlyCost - await this.getCurrentMonthlyCost(userId),
        monitoring: {
          costTracking: true,
          performanceTracking: true,
          qualityTracking: true,
          alertsEnabled: true
        }
      };

      // Store strategy
      await this.redis.setex(
        `switching_strategy:${userId}`,
        30 * 24 * 60 * 60,
        JSON.stringify(strategy)
      );

      // Set up monitoring
      this.monitorSwitchingStrategy(userId, strategy);

      console.log(`✅ Dynamic switching implemented for user ${userId}`);
      console.log(`   - Primary provider: ${optimalMix.primary}`);
      console.log(`   - Estimated monthly savings: $${strategy.estimatedMonthlySavings.toFixed(2)}`);

      this.eventEmitter.emit('switching-strategy-implemented', strategy);

      return strategy;

    } catch (error) {
      console.error(`❌ Error implementing dynamic switching for user ${userId}:`, error);
      throw error;
    }
  }

  async generateCostProjections(usage: UsagePattern): Promise<any> {
    console.log('📈 Generating cost projections...');

    try {
      const projections = {
        baseProjection: await this.calculateBaseProjection(usage),
        optimizedProjection: await this.calculateOptimizedProjection(usage),
        scenarios: await this.generateScenarios(usage),
        confidence: this.calculateProjectionConfidence(usage),
        generatedAt: new Date()
      };

      console.log(`✅ Cost projections generated`);
      console.log(`   - Base monthly cost: $${projections.baseProjection.monthlyCost.toFixed(2)}`);
      console.log(`   - Optimized monthly cost: $${projections.optimizedProjection.monthlyCost.toFixed(2)}`);
      console.log(`   - Potential savings: $${(projections.baseProjection.monthlyCost - projections.optimizedProjection.monthlyCost).toFixed(2)}`);

      return projections;

    } catch (error) {
      console.error('❌ Error generating cost projections:', error);
      throw error;
    }
  }

  async optimizeModelSelection(task: any): Promise<ModelRecommendation> {
    console.log(`🎯 Optimizing model selection for task: ${task.type}...`);

    try {
      const recommendations = [];
      const allProviders = await this.getAvailableProviders();

      for (const provider of allProviders) {
        const providerPricing = this.providerPricing.get(provider);
        if (!providerPricing) continue;

        for (const modelPricing of providerPricing.models) {
          const suitabilityScore = await this.calculateModelSuitability(modelPricing.model, task);
          const estimatedCost = await this.estimateTaskCost(modelPricing, task);
          const qualityScore = await this.getModelQualityScore(provider, modelPricing.model, task.type);
          const latency = await this.getModelLatency(provider, modelPricing.model);

          const overallScore = this.calculateOverallScore({
            suitability: suitabilityScore,
            cost: estimatedCost,
            quality: qualityScore,
            latency: latency
          }, task.preferences);

          recommendations.push({
            provider,
            model: modelPricing.model,
            score: overallScore,
            reasoning: this.generateRecommendationReasoning(suitabilityScore, estimatedCost, qualityScore, latency),
            estimatedCost,
            estimatedLatency: latency,
            qualityScore
          });
        }
      }

      // Sort by score (highest first)
      recommendations.sort((a, b) => b.score - a.score);

      const result: ModelRecommendation = {
        task: task.type,
        recommendations: recommendations.slice(0, 5), // Top 5 recommendations
        confidence: this.calculateRecommendationConfidence(recommendations, task)
      };

      console.log(`✅ Model selection optimized for ${task.type}`);
      console.log(`   - Top recommendation: ${result.recommendations[0]?.provider}/${result.recommendations[0]?.model}`);
      console.log(`   - Estimated cost: $${result.recommendations[0]?.estimatedCost.toFixed(4)}`);

      return result;

    } catch (error) {
      console.error(`❌ Error optimizing model selection:`, error);
      throw error;
    }
  }

  // Internal implementation methods
  private analyzeUsagePatterns_Internal(events: APIUsageEvent[]): UsageAnalysis['patterns'] {
    const hourCounts = new Array(24).fill(0);
    const modelDistribution: Record<string, number> = {};
    const providerDistribution: Record<string, number> = {};
    const costDistribution: Record<string, number> = {};

    let totalRequests = 0;
    let totalCost = 0;

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour]++;
      totalRequests++;
      totalCost += event.estimatedCost;

      // Model distribution
      const modelKey = `${event.provider}/${event.model}`;
      modelDistribution[modelKey] = (modelDistribution[modelKey] || 0) + 1;

      // Provider distribution  
      providerDistribution[event.provider] = (providerDistribution[event.provider] || 0) + event.estimatedCost;

      // Cost distribution by operation
      costDistribution[event.operation] = (costDistribution[event.operation] || 0) + event.estimatedCost;
    }

    // Find peak hours (top 25% of usage)
    const sortedHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count);
    const peakHours = sortedHours.slice(0, 6).map(h => h.hour);

    return {
      peakHours,
      averageRequestsPerDay: totalRequests / 30, // Assuming 30-day period
      modelUsageDistribution: modelDistribution,
      providerUsageDistribution: providerDistribution,
      costDistribution
    };
  }

  private async identifyInefficiencies(
    userId: string, 
    patterns: UsageAnalysis['patterns'], 
    events: APIUsageEvent[]
  ): Promise<UsageAnalysis['inefficiencies']> {
    const overusedModels = [];
    const expensiveOperations = [];
    const unusedCapacity = [];

    // Identify overused expensive models
    for (const [modelKey, usage] of Object.entries(patterns.modelUsageDistribution)) {
      const [provider, model] = modelKey.split('/');
      const modelPricing = await this.getModelPricing(provider, model);
      
      if (modelPricing && usage > patterns.averageRequestsPerDay * 0.3) { // >30% of daily usage
        const alternatives = await this.findCheaperAlternativesInternal({ provider, model });
        if (alternatives.length > 0) {
          overusedModels.push({
            model: modelKey,
            provider,
            overusePercentage: (usage / patterns.averageRequestsPerDay) * 100,
            alternativeRecommendation: alternatives[0].model
          });
        }
      }
    }

    // Identify expensive operations
    for (const [operation, totalCost] of Object.entries(patterns.costDistribution)) {
      const operationEvents = events.filter(e => e.operation === operation);
      const averageCost = totalCost / operationEvents.length;
      
      if (averageCost > 0.01) { // Operations costing more than $0.01 on average
        const optimizationPotential = await this.calculateOptimizationPotential(operation, operationEvents);
        expensiveOperations.push({
          operation,
          averageCost,
          optimizationPotential
        });
      }
    }

    // Identify unused capacity (simplified)
    for (const provider of Object.keys(patterns.providerUsageDistribution)) {
      const quotaUtilization = await this.getQuotaUtilization(userId, provider);
      if (quotaUtilization < 0.5) { // Using less than 50% of quota
        unusedCapacity.push({
          provider,
          quotaUtilization,
          wastedBudget: 0 // Would calculate based on minimum commitments
        });
      }
    }

    return {
      overusedModels,
      expensiveOperations,
      unusedCapacity
    };
  }

  private async identifyOptimizationOpportunities(
    userId: string,
    patterns: UsageAnalysis['patterns'],
    inefficiencies: UsageAnalysis['inefficiencies']
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = [];

    // Model switching opportunities
    for (const overused of inefficiencies.overusedModels) {
      opportunities.push({
        type: 'model_switch',
        title: `Switch from ${overused.model} to cheaper alternative`,
        description: `Replace ${overused.model} with ${overused.alternativeRecommendation} for similar performance at lower cost`,
        potentialMonthlySavings: await this.calculateModelSwitchSavings(overused),
        savingsPercentage: 15,
        implementationComplexity: 'low',
        riskLevel: 'low',
        estimatedTimeToImplement: '1-2 hours',
        prerequisites: ['API key validation', 'Performance testing'],
        automatable: true
      });
    }

    // Caching opportunities
    const cachingPotential = await this.analyzeCachingPotential(patterns);
    if (cachingPotential.potential > 0.1) {
      opportunities.push({
        type: 'caching',
        title: 'Implement intelligent response caching',
        description: 'Cache frequently requested similar responses to reduce API calls',
        potentialMonthlySavings: cachingPotential.monthlySavings,
        savingsPercentage: cachingPotential.savingsPercentage,
        implementationComplexity: 'medium',
        riskLevel: 'low',
        estimatedTimeToImplement: '3-5 days',
        prerequisites: ['Cache infrastructure', 'Similarity algorithms'],
        automatable: true
      });
    }

    // Batching opportunities
    const batchingPotential = await this.analyzeBatchingPotential(patterns);
    if (batchingPotential.potential > 0.05) {
      opportunities.push({
        type: 'batching',
        title: 'Implement request batching',
        description: 'Batch similar requests to reduce per-request overhead costs',
        potentialMonthlySavings: batchingPotential.monthlySavings,
        savingsPercentage: batchingPotential.savingsPercentage,
        implementationComplexity: 'medium',
        riskLevel: 'medium',
        estimatedTimeToImplement: '1-2 weeks',
        prerequisites: ['Queue system', 'Batch processing logic'],
        automatable: true
      });
    }

    // Timing optimization
    if (patterns.peakHours.length > 0) {
      opportunities.push({
        type: 'timing',
        title: 'Optimize request timing',
        description: 'Schedule non-urgent requests during off-peak hours for better rates',
        potentialMonthlySavings: await this.calculateTimingOptimizationSavings(patterns),
        savingsPercentage: 8,
        implementationComplexity: 'low',
        riskLevel: 'low',
        estimatedTimeToImplement: '2-3 days',
        prerequisites: ['Request prioritization', 'Scheduling system'],
        automatable: true
      });
    }

    return opportunities;
  }

  private createPricingOracle(): PricingOracle {
    return {
      async getProviderPricing(provider: string, model: string): Promise<ModelPricing> {
        // Mock implementation - in production would fetch from external APIs
        const mockPricing: ModelPricing = {
          provider,
          model,
          pricing: {
            inputTokenPrice: this.getMockInputPrice(provider, model),
            outputTokenPrice: this.getMockOutputPrice(provider, model),
            requestPrice: this.getMockRequestPrice(provider, model)
          },
          lastUpdated: new Date(),
          currency: 'USD',
          tier: 'pay-per-use'
        };
        return mockPricing;
      },

      async getRealtimePricing(provider: string): Promise<ProviderPricing> {
        // Mock implementation
        const models = await this.getProviderModels(provider);
        const modelPricing = await Promise.all(
          models.map(model => this.getProviderPricing(provider, model))
        );

        return {
          provider,
          models: modelPricing,
          rateLimits: this.getMockRateLimits(provider),
          discounts: {
            volumeDiscounts: this.getMockVolumeDiscounts(provider)
          },
          lastUpdated: new Date()
        };
      },

      async updatePricingData(): Promise<void> {
        console.log('📊 Updating pricing data from external sources...');
        // Implementation would fetch latest pricing from provider APIs
      },

      async comparePricing(providers: string[], model: string): Promise<PricingComparison> {
        const modelComparisons = [];
        for (const provider of providers) {
          try {
            const pricing = await this.getProviderPricing(provider, model);
            modelComparisons.push({
              provider,
              model,
              pricing: pricing.pricing,
              estimatedMonthlyCost: this.estimateMonthlyModelCost(pricing),
              costRank: 0 // Will be calculated after sorting
            });
          } catch (error) {
            console.warn(`Could not get pricing for ${provider}/${model}`);
          }
        }

        // Sort by estimated monthly cost and assign ranks
        modelComparisons.sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);
        modelComparisons.forEach((comparison, index) => {
          comparison.costRank = index + 1;
        });

        const cheapest = modelComparisons[0];
        const mostExpensive = modelComparisons[modelComparisons.length - 1];
        const potentialSavings = mostExpensive.estimatedMonthlyCost - cheapest.estimatedMonthlyCost;

        return {
          models: modelComparisons,
          recommendations: [
            `${cheapest.provider} offers the most cost-effective option for ${model}`,
            `Switching to ${cheapest.provider} could save up to $${potentialSavings.toFixed(2)} monthly`
          ],
          potentialSavings
        };
      }
    };
  }

  private createOptimizationEngine(): OptimizationEngine {
    return {
      analyzeUsagePatterns: async (userId: string) => {
        return await this.analyzeUsagePatterns(userId);
      },

      generateOptimizationPlan: async (userId: string) => {
        const analysis = await this.analyzeUsagePatterns(userId);
        const currentMonthlyCost = await this.getCurrentMonthlyCost(userId);
        
        const optimizations: OptimizationAction[] = analysis.opportunities.map((opp, index) => ({
          id: `opt_${index + 1}`,
          type: opp.type,
          title: opp.title,
          description: opp.description,
          currentState: 'not_implemented',
          targetState: 'implemented',
          potentialSavings: opp.potentialMonthlySavings,
          implementationSteps: this.generateImplementationSteps(opp),
          automatable: opp.automatable,
          autoImplemented: false,
          status: 'pending',
          priority: this.calculateOptimizationPriority(opp),
          dependencies: [],
          metrics: {
            successCriteria: [`Achieve ${opp.savingsPercentage}% cost reduction`],
            kpis: ['cost_reduction', 'performance_maintained'],
            rollbackTriggers: ['performance_degradation', 'error_rate_increase']
          }
        }));

        const totalPotentialSavings = optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0);
        const optimizedMonthlyCost = currentMonthlyCost - totalPotentialSavings;

        const plan: OptimizationPlan = {
          userId,
          generatedAt: new Date(),
          currentMonthlyCost,
          optimizedMonthlyCost,
          totalPotentialSavings,
          savingsPercentage: (totalPotentialSavings / currentMonthlyCost) * 100,
          optimizations,
          timeline: this.categorizeOptimizationsByTimeline(optimizations),
          riskAssessment: this.assessOptimizationRisks(optimizations)
        };

        return plan;
      },

      implementAutomaticOptimizations: async (userId: string, plan: OptimizationPlan) => {
        const results = [];
        
        for (const optimization of plan.optimizations) {
          if (optimization.automatable && optimization.priority !== 'low') {
            try {
              const result = await this.executeOptimization(userId, optimization);
              results.push(result);
            } catch (error) {
              results.push({
                action: optimization,
                result: 'failed' as const,
                actualSavings: 0,
                metrics: {},
                notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              });
            }
          }
        }

        const totalActualSavings = results.reduce((sum, result) => sum + result.actualSavings, 0);

        return {
          planId: plan.userId + '_' + Date.now(),
          executedActions: results,
          totalActualSavings,
          actualSavingsPercentage: (totalActualSavings / plan.currentMonthlyCost) * 100,
          performanceImpact: {
            latencyChange: 0, // Would be measured
            reliabilityChange: 0,
            qualityChange: 0
          },
          nextRecommendations: []
        };
      },

      predictOptimalProviderMix: async (usagePattern: UsagePattern) => {
        // Analyze current usage and recommend optimal provider distribution
        const providers = await this.getAvailableProviders();
        const costAnalysis = await Promise.all(
          providers.map(async provider => ({
            provider,
            estimatedCost: await this.estimateProviderCost(provider, usagePattern),
            reliability: await this.getProviderReliability(provider),
            performance: await this.getProviderPerformance(provider)
          }))
        );

        // Sort by combined score (cost, reliability, performance)
        costAnalysis.sort((a, b) => {
          const scoreA = this.calculateProviderScore(a);
          const scoreB = this.calculateProviderScore(b);
          return scoreB - scoreA;
        });

        const optimal = costAnalysis[0];
        const secondary = costAnalysis[1];

        return {
          primary: optimal.provider,
          secondary: secondary?.provider,
          fallback: costAnalysis[2]?.provider,
          distribution: {
            [optimal.provider]: 0.7,
            [secondary?.provider || 'fallback']: 0.2,
            [costAnalysis[2]?.provider || 'fallback2']: 0.1
          },
          estimatedMonthlyCost: optimal.estimatedCost,
          confidenceScore: 0.85,
          reasoning: [
            `${optimal.provider} offers the best cost-performance ratio`,
            `${secondary?.provider} provides reliable fallback capacity`,
            `Distribution reduces single-provider risk`
          ]
        };
      }
    };
  }

  // Helper methods for pricing oracle
  private getMockInputPrice(provider: string, model: string): number {
    const basePrices: Record<string, number> = {
      'openai': 0.003,
      'anthropic': 0.008,
      'google': 0.0025,
      'cohere': 0.002,
      'azure': 0.003,
      'aws': 0.004
    };
    return basePrices[provider] || 0.005;
  }

  private getMockOutputPrice(provider: string, model: string): number {
    const basePrices: Record<string, number> = {
      'openai': 0.006,
      'anthropic': 0.024,
      'google': 0.005,
      'cohere': 0.004,
      'azure': 0.006,
      'aws': 0.008
    };
    return basePrices[provider] || 0.01;
  }

  private getMockRequestPrice(provider: string, model: string): number {
    return 0.001; // $0.001 per request
  }

  private async getProviderModels(provider: string): Promise<string[]> {
    const modelMaps: Record<string, string[]> = {
      'openai': ['gpt-4', 'gpt-3.5-turbo', 'text-davinci-003'],
      'anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      'google': ['gemini-pro', 'gemini-pro-vision', 'text-bison'],
      'cohere': ['command', 'command-light', 'command-nightly'],
      'azure': ['gpt-4', 'gpt-35-turbo'],
      'aws': ['titan-text-express', 'titan-text-lite']
    };
    return modelMaps[provider] || [];
  }

  private getMockRateLimits(provider: string): ProviderPricing['rateLimits'] {
    const rateLimits: Record<string, ProviderPricing['rateLimits']> = {
      'openai': { requestsPerMinute: 3500, tokensPerMinute: 90000, requestsPerDay: 5000000 },
      'anthropic': { requestsPerMinute: 1000, tokensPerMinute: 40000, requestsPerDay: 1440000 },
      'google': { requestsPerMinute: 600, tokensPerMinute: 32000, requestsPerDay: 864000 }
    };
    return rateLimits[provider] || { requestsPerMinute: 1000, tokensPerMinute: 20000, requestsPerDay: 1440000 };
  }

  private getMockVolumeDiscounts(provider: string): VolumeDiscount[] {
    return [
      { minimumSpend: 100, discountPercentage: 5, description: '5% off for $100+ monthly spend' },
      { minimumSpend: 500, discountPercentage: 10, description: '10% off for $500+ monthly spend' },
      { minimumSpend: 1000, discountPercentage: 15, description: '15% off for $1000+ monthly spend' }
    ];
  }

  // Helper methods for optimization engine
  private async updateProviderPricing(): Promise<void> {
    console.log('📊 Updating provider pricing data...');
    
    const providers = ['openai', 'anthropic', 'google', 'cohere', 'azure', 'aws'];
    
    for (const provider of providers) {
      try {
        const pricing = await this.pricingOracle.getRealtimePricing(provider);
        this.providerPricing.set(provider, pricing);
        
        // Cache in Redis
        await this.redis.setex(
          `provider_pricing:${provider}`,
          this.config.cacheTTL,
          JSON.stringify(pricing)
        );
      } catch (error) {
        console.error(`❌ Error updating pricing for ${provider}:`, error);
      }
    }
    
    console.log(`✅ Updated pricing for ${providers.length} providers`);
  }

  private async runOptimizationChecks(): Promise<void> {
    console.log('🔍 Running optimization checks for all users...');
    
    // This would typically get a list of active users from the database
    const activeUsers = await this.getActiveUsers();
    
    for (const userId of activeUsers) {
      try {
        if (this.config.autoOptimizationEnabled) {
          const plan = await this.optimizationEngine.generateOptimizationPlan(userId);
          
          // Only auto-implement low-risk optimizations
          const lowRiskOptimizations = plan.optimizations.filter(opt => 
            opt.automatable && 
            this.getOptimizationRiskLevel(opt) <= this.config.maxAutoOptimizationRisk
          );
          
          if (lowRiskOptimizations.length > 0) {
            await this.optimizationEngine.implementAutomaticOptimizations(userId, {
              ...plan,
              optimizations: lowRiskOptimizations
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error running optimization check for user ${userId}:`, error);
      }
    }
  }

  // Additional helper methods would be implemented here...

  private async getActiveUsers(): Promise<string[]> {
    // Mock implementation - would query database for active users
    return ['user1', 'user2', 'user3'];
  }

  private getOptimizationRiskLevel(optimization: OptimizationAction): string {
    // Simple risk assessment based on type and complexity
    if (optimization.type === 'model_switch' && optimization.priority === 'low') return 'low';
    if (optimization.type === 'caching') return 'low';
    if (optimization.type === 'timing') return 'low';
    return 'medium';
  }

  // Public API methods
  async getCostOptimizationRecommendations(userId: string): Promise<OptimizationOpportunity[]> {
    const analysis = await this.analyzeUsagePatterns(userId);
    return analysis.opportunities;
  }

  async getIntelligentCostMetrics(): Promise<any> {
    return {
      totalUsersOptimized: await this.redis.get('metrics:users_optimized') || '0',
      totalMonthlySavings: await this.redis.get('metrics:monthly_savings') || '0',
      averageSavingsPercentage: await this.redis.get('metrics:avg_savings_pct') || '0',
      optimizationsImplemented: await this.redis.get('metrics:optimizations_count') || '0',
      lastOptimizationRun: await this.redis.get('metrics:last_optimization_run') || new Date().toISOString()
    };
  }

  async destroy(): Promise<void> {
    await this.redis.quit();
    this.eventEmitter.removeAllListeners();
  }

  // Placeholder implementations for missing methods
  private async getRecentUsageEvents(userId: string, limit: number): Promise<APIUsageEvent[]> { return []; }
  private async getUsageStats(userId: string, period: any): Promise<any> { return {}; }
  private async getUserUsagePattern(userId: string): Promise<UsagePattern> { 
    return {
      requestVolume: 1000,
      tokenVolume: 50000,
      modelMix: {},
      timeDistribution: {},
      complexity: 'moderate'
    };
  }
  private async getCurrentMonthlyCost(userId: string): Promise<number> { return 100; }
  getModelPricing(provider: string, model: string): any { 
    const basePricing = super.getModelPricing(provider, model);
    if (!basePricing) return undefined;
    
    // Convert from base ModelPricing to our ModelPricing
    return {
      model: basePricing.model,
      inputTokenPrice: basePricing.inputCostPer1kTokens,
      outputTokenPrice: basePricing.outputCostPer1kTokens,
      pricing: {
        input: basePricing.inputCostPer1kTokens,
        output: basePricing.outputCostPer1kTokens
      },
      currency: 'USD',
      tier: 'standard'
    };
  }
  private findCheaperAlternativesInternal(model: any): Array<{model: string; provider: string; cost: number}> { 
    // Call parent's private method using bracket notation
    return super['findCheaperAlternatives'](model);
  }
  private async calculateOptimizationPotential(operation: string, events: APIUsageEvent[]): Promise<number> { return 0; }
  private async getQuotaUtilization(userId: string, provider: string): Promise<number> { return 0.7; }
  private async calculateModelSwitchSavings(overused: any): Promise<number> { return 10; }
  private async analyzeCachingPotential(patterns: any): Promise<any> { return { potential: 0.2, monthlySavings: 15, savingsPercentage: 12 }; }
  private async analyzeBatchingPotential(patterns: any): Promise<any> { return { potential: 0.1, monthlySavings: 8, savingsPercentage: 6 }; }
  private async calculateTimingOptimizationSavings(patterns: any): Promise<number> { return 5; }
  private estimateMonthlyModelCost(pricing: ModelPricing): number { return 50; }
  private async getAvailableProviders(): Promise<string[]> { return ['openai', 'anthropic', 'google']; }
  private async calculateModelSuitability(model: string, task: any): Promise<number> { return 0.8; }
  private async estimateTaskCost(pricing: ModelPricing, task: any): Promise<number> { return 0.05; }
  private async getModelQualityScore(provider: string, model: string, taskType: string): Promise<number> { return 0.9; }
  private async getModelLatency(provider: string, model: string): Promise<number> { return 200; }
  private calculateOverallScore(metrics: any, preferences: any): number { return 0.85; }
  private generateRecommendationReasoning(suitability: number, cost: number, quality: number, latency: number): string[] { return ['High quality', 'Low cost']; }
  private calculateRecommendationConfidence(recommendations: any[], task: any): number { return 0.9; }
  private generateImplementationSteps(opportunity: OptimizationOpportunity): string[] { return ['Step 1', 'Step 2']; }
  private calculateOptimizationPriority(opportunity: OptimizationOpportunity): 'low' | 'medium' | 'high' | 'critical' { return 'medium'; }
  private categorizeOptimizationsByTimeline(optimizations: OptimizationAction[]): OptimizationPlan['timeline'] { return { immediate: [], shortTerm: [], mediumTerm: [], longTerm: [] }; }
  private assessOptimizationRisks(optimizations: OptimizationAction[]): OptimizationRisk { return { overallRisk: 'low', risks: [], recommendations: [] }; }
  private async executeOptimization(userId: string, optimization: OptimizationAction): Promise<any> { return { action: optimization, result: 'success', actualSavings: 5, metrics: {}, notes: 'Completed' }; }
  private async estimateProviderCost(provider: string, pattern: UsagePattern): Promise<number> { return 50; }
  private async getProviderReliability(provider: string): Promise<number> { return 0.99; }
  private async getProviderPerformance(provider: string): Promise<number> { return 0.95; }
  private calculateProviderScore(analysis: any): number { return 0.8; }
  private async calculateBaseProjection(usage: UsagePattern): Promise<any> { return { monthlyCost: 100 }; }
  private async calculateOptimizedProjection(usage: UsagePattern): Promise<any> { return { monthlyCost: 75 }; }
  private async generateScenarios(usage: UsagePattern): Promise<any[]> { return []; }
  private calculateProjectionConfidence(usage: UsagePattern): number { return 0.85; }
  private monitorSwitchingStrategy(userId: string, strategy: any): void { }

  async analyzeCostOptimizationOpportunities(userId: string): Promise<OptimizationOpportunity[]> {
    const analysis = await this.analyzeUsagePatterns(userId);
    return analysis.opportunities;
  }
}

// Export convenience function
export function createIntelligentCostManager(redisUrl?: string): IntelligentCostManager {
  return new IntelligentCostManager(redisUrl);
}