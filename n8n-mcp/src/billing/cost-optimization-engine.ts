import { Database } from '../database/connection-pool-manager';
import { PricingOracle } from './pricing-oracle';

export interface OptimizationSuggestion {
  id: string;
  type: 'model_switch' | 'provider_switch' | 'caching' | 'batching' | 'scheduling';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  savingsAmount: number;
  savingsPercentage: number;
  implementation: ImplementationDetails;
  confidence: number;
  automatable: boolean;
}

export interface ImplementationDetails {
  steps: string[];
  estimatedTime: string;
  requiredChanges: CodeChange[];
  risks: Risk[];
  rollbackPlan: string[];
}

export interface CodeChange {
  file: string;
  type: 'config' | 'code' | 'infrastructure';
  description: string;
  before: string;
  after: string;
}

export interface Risk {
  type: 'performance' | 'reliability' | 'compatibility' | 'cost';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface UsagePattern {
  timeframe: string;
  totalRequests: number;
  totalCost: number;
  providerDistribution: Record<string, number>;
  modelDistribution: Record<string, number>;
  featureUsage: Record<string, number>;
  peakHours: number[];
  averageTokensPerRequest: number;
  commonOperations: Operation[];
}

export interface Operation {
  type: string;
  frequency: number;
  averageCost: number;
  averageLatency: number;
  successRate: number;
}

export interface OptimizationPlan {
  userId: string;
  currentMonthlyCost: number;
  optimizedMonthlyCost: number;
  totalSavings: number;
  savingsPercentage: number;
  suggestions: OptimizationSuggestion[];
  implementationTimeline: Timeline;
  riskAssessment: RiskAssessment;
  confidenceScore: number;
}

export interface Timeline {
  immediate: OptimizationSuggestion[];
  shortTerm: OptimizationSuggestion[];
  longTerm: OptimizationSuggestion[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: Risk[];
  mitigationStrategies: string[];
}

export class CostOptimizationEngine {
  private database: Database;
  private pricingOracle: PricingOracle;
  private optimizationCache: Map<string, OptimizationPlan>;

  constructor(database: Database, pricingOracle: PricingOracle) {
    this.database = database;
    this.pricingOracle = pricingOracle;
    this.optimizationCache = new Map();
  }

  async analyzeOptimizationOpportunities(
    userId: string,
    usagePattern: UsagePattern
  ): Promise<OptimizationPlan> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze different optimization strategies
    const modelOptimizations = await this.analyzeModelOptimizations(userId, usagePattern);
    const providerOptimizations = await this.analyzeProviderOptimizations(userId, usagePattern);
    const cachingOptimizations = await this.analyzeCachingOpportunities(userId, usagePattern);
    const batchingOptimizations = await this.analyzeBatchingOpportunities(userId, usagePattern);
    const schedulingOptimizations = await this.analyzeSchedulingOpportunities(userId, usagePattern);

    suggestions.push(
      ...modelOptimizations,
      ...providerOptimizations,
      ...cachingOptimizations,
      ...batchingOptimizations,
      ...schedulingOptimizations
    );

    // Sort by savings potential
    suggestions.sort((a, b) => b.savingsAmount - a.savingsAmount);

    // Calculate total savings
    const totalSavings = suggestions.reduce((sum, s) => sum + s.savingsAmount, 0);
    const savingsPercentage = (totalSavings / usagePattern.totalCost) * 100;

    // Categorize by implementation timeline
    const timeline = this.categorizeByTimeline(suggestions);

    // Assess risks
    const riskAssessment = this.assessRisks(suggestions);

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(suggestions, usagePattern);

    const plan: OptimizationPlan = {
      userId,
      currentMonthlyCost: usagePattern.totalCost,
      optimizedMonthlyCost: usagePattern.totalCost - totalSavings,
      totalSavings,
      savingsPercentage,
      suggestions,
      implementationTimeline: timeline,
      riskAssessment,
      confidenceScore
    };

    // Cache the plan
    this.optimizationCache.set(userId, plan);

    return plan;
  }

  private async analyzeModelOptimizations(
    userId: string,
    pattern: UsagePattern
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    for (const [modelKey, usage] of Object.entries(pattern.modelDistribution)) {
      const [provider, model] = modelKey.split('/');
      const modelCost = (usage / 100) * pattern.totalCost;

      // Find cheaper alternatives
      const alternatives = await this.findCheaperAlternatives(provider, model, pattern);

      for (const alternative of alternatives) {
        if (alternative.savings > modelCost * 0.1) { // At least 10% savings
          suggestions.push({
            id: `model_opt_${Date.now()}_${Math.random()}`,
            type: 'model_switch',
            priority: this.calculatePriority(alternative.savings, modelCost),
            title: `Switch from ${model} to ${alternative.model}`,
            description: `${alternative.provider}/${alternative.model} offers similar capabilities at lower cost`,
            currentCost: modelCost,
            optimizedCost: modelCost - alternative.savings,
            savingsAmount: alternative.savings,
            savingsPercentage: (alternative.savings / modelCost) * 100,
            implementation: {
              steps: [
                `Update AI provider configuration to use ${alternative.model}`,
                'Test with sample requests to verify compatibility',
                'Monitor performance metrics during transition',
                'Gradually migrate traffic to new model'
              ],
              estimatedTime: '2-4 hours',
              requiredChanges: [
                {
                  file: 'config/ai-providers.json',
                  type: 'config',
                  description: 'Update default model',
                  before: `"model": "${model}"`,
                  after: `"model": "${alternative.model}"`
                }
              ],
              risks: [
                {
                  type: 'performance',
                  severity: 'low',
                  description: 'Slight differences in output quality',
                  mitigation: 'A/B test with production traffic'
                }
              ],
              rollbackPlan: [
                'Revert configuration changes',
                'Switch traffic back to original model',
                'Review logs for any issues'
              ]
            },
            confidence: alternative.confidence,
            automatable: true
          });
        }
      }
    }

    return suggestions;
  }

  private async analyzeProviderOptimizations(
    userId: string,
    pattern: UsagePattern
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze if consolidating providers could save money
    const providerCount = Object.keys(pattern.providerDistribution).length;
    
    if (providerCount > 2) {
      const consolidationSavings = await this.calculateConsolidationSavings(pattern);
      
      if (consolidationSavings.savings > pattern.totalCost * 0.15) {
        suggestions.push({
          id: `provider_opt_${Date.now()}`,
          type: 'provider_switch',
          priority: 'high',
          title: 'Consolidate AI providers',
          description: `Reduce from ${providerCount} to ${consolidationSavings.targetProviders} providers`,
          currentCost: pattern.totalCost,
          optimizedCost: pattern.totalCost - consolidationSavings.savings,
          savingsAmount: consolidationSavings.savings,
          savingsPercentage: (consolidationSavings.savings / pattern.totalCost) * 100,
          implementation: {
            steps: consolidationSavings.migrationSteps,
            estimatedTime: '1-2 weeks',
            requiredChanges: consolidationSavings.changes,
            risks: consolidationSavings.risks,
            rollbackPlan: [
              'Maintain original provider credentials',
              'Keep migration mapping documented',
              'Implement provider fallback logic'
            ]
          },
          confidence: 0.75,
          automatable: false
        });
      }
    }

    return suggestions;
  }

  private async analyzeCachingOpportunities(
    userId: string,
    pattern: UsagePattern
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze repeated operations
    const cacheableOps = pattern.commonOperations.filter(op => 
      op.frequency > 100 && op.successRate > 0.95
    );

    if (cacheableOps.length > 0) {
      const cacheSavings = this.calculateCachingSavings(cacheableOps, pattern);
      
      if (cacheSavings > pattern.totalCost * 0.05) {
        suggestions.push({
          id: `cache_opt_${Date.now()}`,
          type: 'caching',
          priority: 'medium',
          title: 'Implement intelligent response caching',
          description: 'Cache frequently repeated AI responses',
          currentCost: pattern.totalCost,
          optimizedCost: pattern.totalCost - cacheSavings,
          savingsAmount: cacheSavings,
          savingsPercentage: (cacheSavings / pattern.totalCost) * 100,
          implementation: {
            steps: [
              'Implement Redis-based caching layer',
              'Create cache key generation logic',
              'Set appropriate TTL values',
              'Monitor cache hit rates'
            ],
            estimatedTime: '1 week',
            requiredChanges: [
              {
                file: 'src/middleware/cache.ts',
                type: 'code',
                description: 'Add caching middleware',
                before: '// No caching',
                after: 'export const cacheMiddleware = ...'
              }
            ],
            risks: [
              {
                type: 'reliability',
                severity: 'medium',
                description: 'Stale cache responses',
                mitigation: 'Implement cache invalidation strategy'
              }
            ],
            rollbackPlan: [
              'Disable cache middleware',
              'Clear cache storage',
              'Monitor for issues'
            ]
          },
          confidence: 0.85,
          automatable: true
        });
      }
    }

    return suggestions;
  }

  private async analyzeBatchingOpportunities(
    userId: string,
    pattern: UsagePattern
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for high-frequency, small requests
    const avgTokens = pattern.averageTokensPerRequest;
    const requestRate = pattern.totalRequests / 30; // Daily average

    if (avgTokens < 100 && requestRate > 1000) {
      const batchSavings = this.calculateBatchingSavings(pattern);
      
      suggestions.push({
        id: `batch_opt_${Date.now()}`,
        type: 'batching',
        priority: 'medium',
        title: 'Implement request batching',
        description: 'Batch multiple small requests together',
        currentCost: pattern.totalCost,
        optimizedCost: pattern.totalCost - batchSavings,
        savingsAmount: batchSavings,
        savingsPercentage: (batchSavings / pattern.totalCost) * 100,
        implementation: {
          steps: [
            'Implement request queue system',
            'Create batching logic with timeouts',
            'Handle batch response distribution',
            'Add error handling for partial failures'
          ],
          estimatedTime: '3-5 days',
          requiredChanges: [
            {
              file: 'src/services/batch-processor.ts',
              type: 'code',
              description: 'Add batch processing service',
              before: '// Direct API calls',
              after: 'export class BatchProcessor { ... }'
            }
          ],
          risks: [
            {
              type: 'performance',
              severity: 'medium',
              description: 'Increased latency for batched requests',
              mitigation: 'Implement smart batching with timeouts'
            }
          ],
          rollbackPlan: [
            'Disable batching flag',
            'Process queued requests individually',
            'Monitor performance metrics'
          ]
        },
        confidence: 0.7,
        automatable: true
      });
    }

    return suggestions;
  }

  private async analyzeSchedulingOpportunities(
    userId: string,
    pattern: UsagePattern
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check if there are clear peak/off-peak patterns
    const peakHourCost = this.calculatePeakHourCost(pattern);
    const offPeakSavings = peakHourCost * 0.2; // Assume 20% savings for off-peak

    if (peakHourCost > pattern.totalCost * 0.3) {
      suggestions.push({
        id: `schedule_opt_${Date.now()}`,
        type: 'scheduling',
        priority: 'low',
        title: 'Schedule non-urgent requests during off-peak hours',
        description: 'Defer non-critical AI requests to cheaper time slots',
        currentCost: peakHourCost,
        optimizedCost: peakHourCost - offPeakSavings,
        savingsAmount: offPeakSavings,
        savingsPercentage: (offPeakSavings / peakHourCost) * 100,
        implementation: {
          steps: [
            'Implement request priority classification',
            'Create scheduling queue system',
            'Configure off-peak time windows',
            'Monitor SLA compliance'
          ],
          estimatedTime: '1-2 weeks',
          requiredChanges: [
            {
              file: 'src/services/request-scheduler.ts',
              type: 'code',
              description: 'Add request scheduling service',
              before: '// Immediate processing',
              after: 'export class RequestScheduler { ... }'
            }
          ],
          risks: [
            {
              type: 'performance',
              severity: 'high',
              description: 'Delayed response times for scheduled requests',
              mitigation: 'Only schedule truly non-urgent requests'
            }
          ],
          rollbackPlan: [
            'Process all queued requests immediately',
            'Disable scheduling logic',
            'Revert to direct processing'
          ]
        },
        confidence: 0.6,
        automatable: true
      });
    }

    return suggestions;
  }

  // Helper methods
  private async findCheaperAlternatives(
    provider: string,
    model: string,
    pattern: UsagePattern
  ): Promise<any[]> {
    const alternatives = [];
    const currentPricing = await this.pricingOracle.getCurrentPricing(provider);
    const currentModel = currentPricing.models.find(m => m.model === model);
    
    if (!currentModel) return alternatives;

    // Check all providers for similar models
    const providers = ['openai', 'anthropic', 'google', 'cohere'];
    
    for (const altProvider of providers) {
      const altPricing = await this.pricingOracle.getCurrentPricing(altProvider);
      
      for (const altModel of altPricing.models) {
        // Skip if same model
        if (altProvider === provider && altModel.model === model) continue;
        
        // Check if model meets requirements
        if (this.isCompatibleModel(currentModel, altModel)) {
          const currentCost = this.estimateModelCost(currentModel, pattern);
          const altCost = this.estimateModelCost(altModel, pattern);
          
          if (altCost < currentCost * 0.9) { // At least 10% cheaper
            alternatives.push({
              provider: altProvider,
              model: altModel.model,
              savings: currentCost - altCost,
              confidence: this.calculateAlternativeConfidence(currentModel, altModel)
            });
          }
        }
      }
    }

    return alternatives.sort((a, b) => b.savings - a.savings).slice(0, 3);
  }

  private isCompatibleModel(current: any, alternative: any): boolean {
    // Check if alternative has required features
    for (const feature of current.features) {
      if (!alternative.features.includes(feature)) {
        return false;
      }
    }

    // Check context window
    if (alternative.contextWindow < current.contextWindow * 0.8) {
      return false;
    }

    return true;
  }

  private estimateModelCost(model: any, pattern: UsagePattern): number {
    const avgInputTokens = pattern.averageTokensPerRequest * 0.7;
    const avgOutputTokens = pattern.averageTokensPerRequest * 0.3;
    
    const costPerRequest = 
      (avgInputTokens / 1000) * model.inputTokenPrice +
      (avgOutputTokens / 1000) * model.outputTokenPrice;
    
    return costPerRequest * pattern.totalRequests;
  }

  private calculateAlternativeConfidence(current: any, alternative: any): number {
    let confidence = 0.5;

    // Similar context window
    const contextRatio = alternative.contextWindow / current.contextWindow;
    if (contextRatio >= 1) confidence += 0.2;
    else if (contextRatio >= 0.8) confidence += 0.1;

    // Feature parity
    const featureMatch = alternative.features.filter((f: string) => 
      current.features.includes(f)
    ).length / current.features.length;
    confidence += featureMatch * 0.2;

    // Rate limits
    if (alternative.rateLimits.requestsPerMinute >= current.rateLimits.requestsPerMinute) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95);
  }

  private async calculateConsolidationSavings(pattern: UsagePattern): Promise<any> {
    // Find the most cost-effective provider
    let bestProvider = '';
    let lowestCost = Infinity;

    for (const [provider, percentage] of Object.entries(pattern.providerDistribution)) {
      const providerCost = (percentage / 100) * pattern.totalCost;
      const efficiency = providerCost / percentage; // Cost per percentage point
      
      if (efficiency < lowestCost) {
        lowestCost = efficiency;
        bestProvider = provider;
      }
    }

    // Calculate savings from consolidation
    const currentCost = pattern.totalCost;
    const consolidatedCost = currentCost * 0.85; // Assume 15% savings from consolidation
    
    return {
      savings: currentCost - consolidatedCost,
      targetProviders: 2,
      primaryProvider: bestProvider,
      migrationSteps: [
        `Analyze feature requirements across all use cases`,
        `Map current models to ${bestProvider} equivalents`,
        `Update configuration to use consolidated providers`,
        `Implement fallback logic for edge cases`,
        `Monitor performance and cost metrics`
      ],
      changes: [
        {
          file: 'config/providers.json',
          type: 'config',
          description: 'Consolidate provider configuration',
          before: 'Multiple provider configs',
          after: `Primary: ${bestProvider}, Fallback: secondary`
        }
      ],
      risks: [
        {
          type: 'reliability',
          severity: 'medium',
          description: 'Single point of failure',
          mitigation: 'Implement robust fallback provider'
        }
      ]
    };
  }

  private calculateCachingSavings(operations: Operation[], pattern: UsagePattern): number {
    let savings = 0;

    for (const op of operations) {
      // Estimate cache hit rate based on operation frequency
      const cacheHitRate = Math.min(0.8, op.frequency / 1000);
      const opCost = op.averageCost * op.frequency;
      savings += opCost * cacheHitRate;
    }

    return savings;
  }

  private calculateBatchingSavings(pattern: UsagePattern): number {
    // Estimate savings from reduced per-request overhead
    const overheadPerRequest = 0.001; // $0.001 per request overhead
    const batchableRequests = pattern.totalRequests * 0.6; // 60% can be batched
    const batchSize = 10;
    
    const currentOverhead = pattern.totalRequests * overheadPerRequest;
    const batchedOverhead = (batchableRequests / batchSize) * overheadPerRequest;
    
    return currentOverhead - batchedOverhead;
  }

  private calculatePeakHourCost(pattern: UsagePattern): number {
    // Estimate that peak hours account for 40% of traffic but 60% of cost
    return pattern.totalCost * 0.6;
  }

  private calculatePriority(
    savings: number, 
    totalCost: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = (savings / totalCost) * 100;
    
    if (percentage > 30) return 'critical';
    if (percentage > 20) return 'high';
    if (percentage > 10) return 'medium';
    return 'low';
  }

  private categorizeByTimeline(suggestions: OptimizationSuggestion[]): Timeline {
    const immediate = suggestions.filter(s => 
      s.implementation.estimatedTime.includes('hour') || 
      s.implementation.estimatedTime.includes('day')
    );
    
    const shortTerm = suggestions.filter(s => 
      s.implementation.estimatedTime.includes('week') &&
      !s.implementation.estimatedTime.includes('weeks')
    );
    
    const longTerm = suggestions.filter(s => 
      s.implementation.estimatedTime.includes('weeks') ||
      s.implementation.estimatedTime.includes('month')
    );

    return { immediate, shortTerm, longTerm };
  }

  private assessRisks(suggestions: OptimizationSuggestion[]): RiskAssessment {
    const allRisks: Risk[] = [];
    
    for (const suggestion of suggestions) {
      allRisks.push(...suggestion.implementation.risks);
    }

    // Determine overall risk level
    const highRiskCount = allRisks.filter(r => r.severity === 'high').length;
    const mediumRiskCount = allRisks.filter(r => r.severity === 'medium').length;
    
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    if (highRiskCount > 2) overallRisk = 'high';
    else if (highRiskCount > 0 || mediumRiskCount > 3) overallRisk = 'medium';

    // Generate mitigation strategies
    const mitigationStrategies = [
      'Implement changes gradually with monitoring',
      'Maintain rollback capabilities for all changes',
      'Test thoroughly in staging environment',
      'Monitor key metrics during and after implementation'
    ];

    return {
      overallRisk,
      riskFactors: allRisks,
      mitigationStrategies
    };
  }

  private calculateConfidenceScore(
    suggestions: OptimizationSuggestion[],
    pattern: UsagePattern
  ): number {
    if (suggestions.length === 0) return 0;

    // Average confidence of suggestions
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    
    // Adjust based on data quality
    let dataQualityMultiplier = 1;
    if (pattern.totalRequests < 1000) dataQualityMultiplier = 0.8;
    if (pattern.totalRequests < 100) dataQualityMultiplier = 0.6;
    
    return avgConfidence * dataQualityMultiplier;
  }

  async implementOptimization(
    userId: string,
    suggestionId: string
  ): Promise<ImplementationResult> {
    const plan = this.optimizationCache.get(userId);
    if (!plan) {
      throw new Error('No optimization plan found for user');
    }

    const suggestion = plan.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Implementation logic would go here
    // This is a placeholder for the actual implementation
    console.log(`Implementing optimization ${suggestionId} for user ${userId}`);

    return {
      success: true,
      suggestionId,
      actualSavings: suggestion.savingsAmount * 0.9, // 90% of estimated
      implementedAt: new Date(),
      notes: 'Successfully implemented optimization'
    };
  }
}

interface ImplementationResult {
  success: boolean;
  suggestionId: string;
  actualSavings: number;
  implementedAt: Date;
  notes: string;
}