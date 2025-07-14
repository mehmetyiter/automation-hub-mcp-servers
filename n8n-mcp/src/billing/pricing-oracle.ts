import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface ProviderPricing {
  provider: string;
  models: ModelPricing[];
  lastUpdated: Date;
  currency: 'USD';
  source: 'official' | 'scraped' | 'estimated';
  reliability: number;
}

export interface ModelPricing {
  model: string;
  inputTokenPrice: number;  // Price per 1000 tokens
  outputTokenPrice: number;
  minimumCharge?: number;
  freeTokens?: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
  };
  features: string[];
  contextWindow: number;
  maxOutputTokens: number;
}

export interface CostCalculation {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
  calculatedAt: Date;
  breakdown: CostBreakdown;
}

export interface CostBreakdown {
  baseInputCost: number;
  baseOutputCost: number;
  minimumCharge: number;
  discounts: Discount[];
  surcharges: Surcharge[];
  finalCost: number;
}

export interface Discount {
  type: 'volume' | 'loyalty' | 'promotion';
  description: string;
  amount: number;
  percentage?: number;
}

export interface Surcharge {
  type: 'peak_hours' | 'high_demand' | 'premium_feature';
  description: string;
  amount: number;
  percentage?: number;
}

export interface TaskRequirements {
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  qualityRequirement: 'basic' | 'high' | 'premium';
  latencyRequirement: 'standard' | 'fast' | 'real-time';
  features: string[];
  contextNeeded: number;
}

export interface CheapestOptionResult {
  bestOption: ProviderOption;
  alternatives: ProviderOption[];
  savings: number;
  analysis: CostAnalysis;
}

export interface ProviderOption {
  provider: string;
  model: string;
  estimatedCost: number;
  qualityScore: number;
  reliabilityScore: number;
  latencyScore: number;
  overallScore: number;
  pros: string[];
  cons: string[];
  suitabilityReason: string;
}

export interface CostAnalysis {
  totalOptionsEvaluated: number;
  priceRange: { min: number; max: number };
  averagePrice: number;
  qualityVsPrice: QualityPriceAnalysis[];
  recommendations: string[];
}

export interface QualityPriceAnalysis {
  provider: string;
  model: string;
  qualityScore: number;
  priceScore: number;
  valueScore: number;
}

export interface PricingComparison {
  models: Array<{
    provider: string;
    model: string;
    inputTokenPrice: number;
    outputTokenPrice: number;
    features: string[];
    score: number;
  }>;
  lowestCostProvider: string;
  potentialSavings: number;
  recommendations: string[];
}

export class PricingOracle extends EventEmitter {
  private cache: Map<string, ProviderPricing>;
  private redis: Redis;
  private updateScheduler: Map<string, NodeJS.Timeout>;
  private pricingHistory: Map<string, PriceHistoryEntry[]>;

  constructor(redisUrl?: string) {
    super();
    this.cache = new Map();
    this.updateScheduler = new Map();
    this.pricingHistory = new Map();
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.initializePricingData();
    this.setupPricingUpdates();
  }

  async getCurrentPricing(provider: string): Promise<ProviderPricing> {
    const cached = this.cache.get(provider);
    
    if (cached && this.isRecentlyUpdated(cached.lastUpdated)) {
      return cached;
    }

    // Try to get from Redis cache
    const redisCached = await this.redis.get(`pricing:${provider}`);
    if (redisCached) {
      const parsed = JSON.parse(redisCached);
      parsed.lastUpdated = new Date(parsed.lastUpdated);
      
      if (this.isRecentlyUpdated(parsed.lastUpdated)) {
        this.cache.set(provider, parsed);
        return parsed;
      }
    }

    // Fetch latest pricing
    return await this.fetchLatestPricing(provider);
  }

  async calculateRequestCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    context: CostCalculationContext = {}
  ): Promise<CostCalculation> {
    const pricing = await this.getCurrentPricing(provider);
    const modelPricing = pricing.models.find(m => m.model === model);

    if (!modelPricing) {
      throw new Error(`Model ${model} not found for provider ${provider}`);
    }

    // Base costs
    const baseInputCost = (inputTokens / 1000) * modelPricing.inputTokenPrice;
    const baseOutputCost = (outputTokens / 1000) * modelPricing.outputTokenPrice;
    let totalCost = baseInputCost + baseOutputCost;

    // Apply minimum charge
    const minimumCharge = modelPricing.minimumCharge || 0;
    const minimumApplied = Math.max(0, minimumCharge - totalCost);
    totalCost = Math.max(totalCost, minimumCharge);

    // Calculate discounts
    const discounts = await this.calculateDiscounts(
      provider, 
      model, 
      totalCost, 
      context
    );
    const totalDiscounts = discounts.reduce((sum, d) => sum + d.amount, 0);

    // Calculate surcharges
    const surcharges = await this.calculateSurcharges(
      provider, 
      model, 
      totalCost, 
      context
    );
    const totalSurcharges = surcharges.reduce((sum, s) => sum + s.amount, 0);

    const finalCost = Math.max(0, totalCost - totalDiscounts + totalSurcharges);

    const breakdown: CostBreakdown = {
      baseInputCost,
      baseOutputCost,
      minimumCharge: minimumApplied,
      discounts,
      surcharges,
      finalCost
    };

    return {
      provider,
      model,
      inputTokens,
      outputTokens,
      inputCost: baseInputCost,
      outputCost: baseOutputCost,
      totalCost: finalCost,
      currency: 'USD',
      calculatedAt: new Date(),
      breakdown
    };
  }

  async findCheapestOption(
    taskRequirements: TaskRequirements
  ): Promise<CheapestOptionResult> {
    console.log('🔍 Finding cheapest option for task requirements');

    const allProviders = await this.getAllProviderPricing();
    const suitableOptions: ProviderOption[] = [];

    for (const provider of allProviders) {
      for (const model of provider.models) {
        if (this.meetsRequirements(model, taskRequirements)) {
          const estimatedCost = await this.estimateCost(
            provider.provider,
            model.model,
            taskRequirements.estimatedInputTokens,
            taskRequirements.estimatedOutputTokens
          );
          
          const qualityScore = this.calculateQualityScore(
            model, 
            taskRequirements
          );
          
          const reliabilityScore = await this.getReliabilityScore(provider.provider);
          // TODO: Implement calculateLatencyScore method
          const latencyScore = 0.8; // Default score
          
          const overallScore = this.calculateOverallScore(
            estimatedCost,
            qualityScore,
            reliabilityScore,
            latencyScore,
            taskRequirements
          );

          suitableOptions.push({
            provider: provider.provider,
            model: model.model,
            estimatedCost,
            qualityScore,
            reliabilityScore,
            latencyScore,
            overallScore,
            pros: this.generatePros(model, taskRequirements),
            cons: this.generateCons(model, taskRequirements),
            suitabilityReason: this.generateSuitabilityReason(model, taskRequirements)
          });
        }
      }
    }

    if (suitableOptions.length === 0) {
      throw new Error('No suitable providers found for the given requirements');
    }

    // Sort by overall score (higher is better)
    suitableOptions.sort((a, b) => b.overallScore - a.overallScore);

    const bestOption = suitableOptions[0];
    const alternatives = suitableOptions.slice(1, 6); // Top 5 alternatives

    // Calculate savings compared to most expensive option
    const mostExpensive = suitableOptions.reduce(
      (max, option) => option.estimatedCost > max.estimatedCost ? option : max
    );
    const savings = mostExpensive.estimatedCost - bestOption.estimatedCost;

    const analysis: CostAnalysis = {
      totalOptionsEvaluated: suitableOptions.length,
      priceRange: {
        min: Math.min(...suitableOptions.map(o => o.estimatedCost)),
        max: Math.max(...suitableOptions.map(o => o.estimatedCost))
      },
      averagePrice: suitableOptions.reduce((sum, o) => sum + o.estimatedCost, 0) / suitableOptions.length,
      qualityVsPrice: suitableOptions.map(option => ({
        provider: option.provider,
        model: option.model,
        qualityScore: option.qualityScore,
        priceScore: this.calculatePriceScore(option.estimatedCost, analysis.priceRange),
        valueScore: option.overallScore
      })),
      recommendations: this.generateRecommendations(suitableOptions, taskRequirements)
    };

    return {
      bestOption,
      alternatives,
      savings,
      analysis
    };
  }

  async trackPriceChanges(provider: string, model: string): Promise<PriceChangeAnalysis> {
    const historyKey = `${provider}:history`;
    const history = this.pricingHistory.get(historyKey) || [];

    if (history.length < 2) {
      return {
        provider,
        model,
        changeDetected: false,
        analysis: 'Insufficient historical data',
        lastChecked: new Date()
      };
    }

    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    // Find the specific model in current and previous pricing
    const currentModel = current.pricing.models.find(m => m.model === model);
    const previousModel = previous.pricing.models.find(m => m.model === model);

    if (!currentModel || !previousModel) {
      return {
        provider,
        model,
        changeDetected: false,
        analysis: 'Model not found in historical data',
        lastChecked: new Date()
      };
    }

    const inputPriceChange = ((currentModel.inputTokenPrice - previousModel.inputTokenPrice) / previousModel.inputTokenPrice) * 100;
    const outputPriceChange = ((currentModel.outputTokenPrice - previousModel.outputTokenPrice) / previousModel.outputTokenPrice) * 100;

    const changeThreshold = 5; // 5% change threshold
    const significantChange = Math.abs(inputPriceChange) > changeThreshold || 
                            Math.abs(outputPriceChange) > changeThreshold;

    return {
      provider,
      model,
      changeDetected: significantChange,
      inputPriceChange,
      outputPriceChange,
      trend: this.calculatePriceTrend(history),
      analysis: this.generatePriceChangeAnalysis(inputPriceChange, outputPriceChange),
      lastChecked: new Date()
    };
  }

  private async fetchLatestPricing(provider: string): Promise<ProviderPricing> {
    console.log(`📡 Fetching latest pricing for ${provider}`);

    try {
      let pricing: ProviderPricing;

      switch (provider.toLowerCase()) {
        case 'openai':
          pricing = await this.fetchOpenAIPricing();
          break;
        case 'anthropic':
          pricing = await this.fetchAnthropicPricing();
          break;
        case 'google':
          pricing = await this.fetchGooglePricing();
          break;
        case 'cohere':
          pricing = await this.fetchCoherePricing();
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Cache the pricing
      this.cache.set(provider, pricing);
      await this.redis.setex(
        `pricing:${provider}`, 
        3600, 
        JSON.stringify(pricing)
      );

      // Store in history
      const historyKey = `${provider}:history`;
      const history = this.pricingHistory.get(historyKey) || [];
      history.push({
        timestamp: new Date(),
        pricing
      });
      this.pricingHistory.set(historyKey, history);

      this.emit('pricing-updated', { provider, pricing });
      return pricing;

    } catch (error) {
      console.error(`Failed to fetch pricing for ${provider}:`, error);
      
      // Return cached pricing if available
      const cached = this.cache.get(provider);
      if (cached) {
        console.log(`Using cached pricing for ${provider}`);
        return cached;
      }

      throw new Error(`Failed to get pricing for ${provider}: ${error.message}`);
    }
  }

  private async fetchOpenAIPricing(): Promise<ProviderPricing> {
    // This would typically fetch from OpenAI's pricing API or scrape their pricing page
    // For now, returning structured data based on known pricing
    
    return {
      provider: 'openai',
      models: [
        {
          model: 'gpt-3.5-turbo',
          inputTokenPrice: 0.0015,
          outputTokenPrice: 0.002,
          rateLimits: {
            requestsPerMinute: 3500,
            tokensPerMinute: 90000,
            requestsPerDay: 10000
          },
          features: ['chat', 'completion', 'function-calling'],
          contextWindow: 4096,
          maxOutputTokens: 4096
        },
        {
          model: 'gpt-4',
          inputTokenPrice: 0.03,
          outputTokenPrice: 0.06,
          rateLimits: {
            requestsPerMinute: 200,
            tokensPerMinute: 10000,
            requestsPerDay: 2000
          },
          features: ['chat', 'completion', 'function-calling', 'vision'],
          contextWindow: 8192,
          maxOutputTokens: 4096
        },
        {
          model: 'gpt-4-turbo',
          inputTokenPrice: 0.01,
          outputTokenPrice: 0.03,
          rateLimits: {
            requestsPerMinute: 500,
            tokensPerMinute: 30000,
            requestsPerDay: 5000
          },
          features: ['chat', 'completion', 'function-calling', 'vision', 'json-mode'],
          contextWindow: 128000,
          maxOutputTokens: 4096
        }
      ],
      lastUpdated: new Date(),
      currency: 'USD',
      source: 'official',
      reliability: 0.95
    };
  }

  private async fetchAnthropicPricing(): Promise<ProviderPricing> {
    return {
      provider: 'anthropic',
      models: [
        {
          model: 'claude-instant-1',
          inputTokenPrice: 0.0008,
          outputTokenPrice: 0.0024,
          rateLimits: {
            requestsPerMinute: 1000,
            tokensPerMinute: 100000,
            requestsPerDay: 50000
          },
          features: ['chat', 'completion'],
          contextWindow: 100000,
          maxOutputTokens: 8192
        },
        {
          model: 'claude-2',
          inputTokenPrice: 0.008,
          outputTokenPrice: 0.024,
          rateLimits: {
            requestsPerMinute: 400,
            tokensPerMinute: 40000,
            requestsPerDay: 10000
          },
          features: ['chat', 'completion', 'long-context'],
          contextWindow: 100000,
          maxOutputTokens: 8192
        },
        {
          model: 'claude-3-sonnet',
          inputTokenPrice: 0.003,
          outputTokenPrice: 0.015,
          rateLimits: {
            requestsPerMinute: 600,
            tokensPerMinute: 60000,
            requestsPerDay: 20000
          },
          features: ['chat', 'completion', 'vision', 'long-context'],
          contextWindow: 200000,
          maxOutputTokens: 8192
        }
      ],
      lastUpdated: new Date(),
      currency: 'USD',
      source: 'official',
      reliability: 0.93
    };
  }

  // Additional pricing fetchers for other providers...
  private async fetchGooglePricing(): Promise<ProviderPricing> {
    // Implementation for Google pricing
    return {
      provider: 'google',
      models: [],
      lastUpdated: new Date(),
      currency: 'USD',
      source: 'official',
      reliability: 0.90
    };
  }

  private async fetchCoherePricing(): Promise<ProviderPricing> {
    // Implementation for Cohere pricing
    return {
      provider: 'cohere',
      models: [],
      lastUpdated: new Date(),
      currency: 'USD',
      source: 'official',
      reliability: 0.88
    };
  }

  private isRecentlyUpdated(lastUpdated: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
    return diffMinutes < 60; // Consider recent if updated within last hour
  }

  private async initializePricingData(): Promise<void> {
    console.log('🔄 Initializing pricing data...');
    
    const providers = ['openai', 'anthropic', 'google', 'cohere'];
    
    for (const provider of providers) {
      try {
        await this.fetchLatestPricing(provider);
      } catch (error) {
        console.error(`Failed to initialize pricing for ${provider}:`, error);
      }
    }
  }

  private setupPricingUpdates(): void {
    // Update pricing every hour
    const updateInterval = 60 * 60 * 1000; // 1 hour
    
    setInterval(async () => {
      const providers = ['openai', 'anthropic', 'google', 'cohere'];
      
      for (const provider of providers) {
        try {
          await this.fetchLatestPricing(provider);
        } catch (error) {
          console.error(`Failed to update pricing for ${provider}:`, error);
        }
      }
    }, updateInterval);
  }

  // Additional helper methods...
  private meetsRequirements(model: ModelPricing, requirements: TaskRequirements): boolean {
    // Check context window requirement
    if (requirements.contextNeeded > model.contextWindow) {
      return false;
    }

    // Check if model supports required features
    for (const feature of requirements.features) {
      if (!model.features.includes(feature)) {
        return false;
      }
    }

    return true;
  }

  private calculateQualityScore(model: ModelPricing, requirements: TaskRequirements): number {
    let score = 0.5; // Base score

    // Adjust based on model capabilities
    if (model.contextWindow >= 32000) score += 0.2;
    if (model.features.includes('function-calling')) score += 0.1;
    if (model.features.includes('vision')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  async comparePricing(providers: string[], model: string): Promise<PricingComparison> {
    const comparison: PricingComparison = {
      models: [],
      lowestCostProvider: '',
      potentialSavings: 0,
      recommendations: []
    };

    let lowestCost = Infinity;
    let highestCost = 0;

    for (const provider of providers) {
      const pricing = await this.getCurrentPricing(provider);
      const modelPricing = pricing.models.find(m => m.model === model);
      
      if (modelPricing) {
        const avgCost = (modelPricing.inputTokenPrice + modelPricing.outputTokenPrice) / 2;
        
        comparison.models.push({
          provider,
          model,
          inputTokenPrice: modelPricing.inputTokenPrice,
          outputTokenPrice: modelPricing.outputTokenPrice,
          features: modelPricing.features,
          score: this.calculateQualityScore(modelPricing, {
            complexity: 'moderate',
            estimatedInputTokens: 1000,
            estimatedOutputTokens: 1000,
            qualityRequirement: 'high',
            latencyRequirement: 'standard',
            features: [],
            contextNeeded: 8000
          } as TaskRequirements)
        });

        if (avgCost < lowestCost) {
          lowestCost = avgCost;
          comparison.lowestCostProvider = provider;
        }
        if (avgCost > highestCost) {
          highestCost = avgCost;
        }
      }
    }

    comparison.potentialSavings = ((highestCost - lowestCost) / highestCost) * 100;
    comparison.recommendations = [
      `Consider using ${comparison.lowestCostProvider} for the best pricing`,
      `Potential savings of ${comparison.potentialSavings.toFixed(2)}% compared to highest cost option`
    ];

    return comparison;
  }

  async destroy(): Promise<void> {
    // Clear all intervals
    for (const timer of this.updateScheduler.values()) {
      clearInterval(timer);
    }
    
    // Close Redis connection
    await this.redis.quit();
    
    console.log('📡 PricingOracle destroyed');
  }

  // Missing method implementations

  private async calculateDiscounts(
    provider: string,
    model: string,
    totalCost: number,
    context: CostCalculationContext
  ): Promise<Discount[]> {
    // TODO: Implement discount calculation logic
    const discounts: Discount[] = [];
    
    // Example volume discount
    if (context.volume === 'high') {
      discounts.push({
        type: 'volume',
        description: 'High volume discount',
        amount: totalCost * 0.1,
        percentage: 10
      });
    }
    
    return discounts;
  }

  private async calculateSurcharges(
    provider: string,
    model: string,
    totalCost: number,
    context: CostCalculationContext
  ): Promise<Surcharge[]> {
    // TODO: Implement surcharge calculation logic
    const surcharges: Surcharge[] = [];
    
    // Example peak hours surcharge
    if (context.timeOfDay === 'peak') {
      surcharges.push({
        type: 'peak_hours',
        description: 'Peak hours surcharge',
        amount: totalCost * 0.2,
        percentage: 20
      });
    }
    
    return surcharges;
  }

  private async getAllProviderPricing(): Promise<ProviderPricing[]> {
    // TODO: Implement fetching all provider pricing
    const providers = ['openai', 'anthropic', 'google', 'cohere'];
    const allPricing: ProviderPricing[] = [];
    
    for (const provider of providers) {
      try {
        const pricing = await this.getCurrentPricing(provider);
        allPricing.push(pricing);
      } catch (error) {
        console.error(`Failed to get pricing for ${provider}:`, error);
      }
    }
    
    return allPricing;
  }

  private async estimateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<number> {
    // TODO: Implement cost estimation
    const pricing = await this.getCurrentPricing(provider);
    const modelPricing = pricing.models.find(m => m.model === model);
    
    if (!modelPricing) {
      throw new Error(`Model ${model} not found for provider ${provider}`);
    }
    
    const inputCost = (inputTokens / 1000) * modelPricing.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * modelPricing.outputTokenPrice;
    
    return inputCost + outputCost;
  }

  private async getReliabilityScore(provider: string): Promise<number> {
    // TODO: Implement reliability score calculation
    const pricing = await this.getCurrentPricing(provider);
    return pricing.reliability || 0.8;
  }

  private calculateOverallScore(
    estimatedCost: number,
    qualityScore: number,
    reliabilityScore: number,
    latencyScore: number,
    taskRequirements: TaskRequirements
  ): number {
    // TODO: Implement overall score calculation
    // Weighted average based on requirements
    const costWeight = 0.4;
    const qualityWeight = 0.3;
    const reliabilityWeight = 0.2;
    const latencyWeight = 0.1;
    
    // Normalize cost score (lower cost = higher score)
    const maxCost = 0.1; // Example max cost per request
    const costScore = Math.max(0, 1 - (estimatedCost / maxCost));
    
    return (
      costScore * costWeight +
      qualityScore * qualityWeight +
      reliabilityScore * reliabilityWeight +
      latencyScore * latencyWeight
    );
  }

  private generatePros(model: ModelPricing, requirements: TaskRequirements): string[] {
    // TODO: Implement pros generation
    const pros: string[] = [];
    
    if (model.contextWindow > requirements.contextNeeded * 2) {
      pros.push('Large context window for complex tasks');
    }
    
    if (model.features.includes('function-calling')) {
      pros.push('Supports function calling');
    }
    
    if (model.features.includes('vision')) {
      pros.push('Multimodal capabilities');
    }
    
    return pros;
  }

  private generateCons(model: ModelPricing, requirements: TaskRequirements): string[] {
    // TODO: Implement cons generation
    const cons: string[] = [];
    
    if (model.rateLimits.requestsPerMinute < 100) {
      cons.push('Lower rate limits');
    }
    
    if (model.maxOutputTokens < 8192) {
      cons.push('Limited output token capacity');
    }
    
    return cons;
  }

  private generateSuitabilityReason(model: ModelPricing, requirements: TaskRequirements): string {
    // TODO: Implement suitability reason generation
    const reasons: string[] = [];
    
    if (model.contextWindow >= requirements.contextNeeded) {
      reasons.push('Sufficient context window');
    }
    
    if (requirements.features.every(f => model.features.includes(f))) {
      reasons.push('Supports all required features');
    }
    
    return reasons.join('; ') || 'Meets basic requirements';
  }

  private calculatePriceScore(
    estimatedCost: number,
    priceRange: { min: number; max: number }
  ): number {
    // TODO: Implement price score calculation
    if (priceRange.max === priceRange.min) {
      return 0.5;
    }
    
    // Normalize to 0-1 scale (lower price = higher score)
    const normalizedScore = 1 - ((estimatedCost - priceRange.min) / (priceRange.max - priceRange.min));
    return Math.max(0, Math.min(1, normalizedScore));
  }

  private generateRecommendations(
    suitableOptions: ProviderOption[],
    requirements: TaskRequirements
  ): string[] {
    // TODO: Implement recommendations generation
    const recommendations: string[] = [];
    
    if (suitableOptions.length > 0) {
      const bestOption = suitableOptions[0];
      recommendations.push(`Best option: ${bestOption.provider} ${bestOption.model}`);
    }
    
    if (requirements.qualityRequirement === 'premium') {
      recommendations.push('Consider premium models for best quality');
    }
    
    if (requirements.latencyRequirement === 'real-time') {
      recommendations.push('Prioritize providers with low latency');
    }
    
    return recommendations;
  }

  private calculatePriceTrend(history: PriceHistoryEntry[]): 'increasing' | 'decreasing' | 'stable' {
    // TODO: Implement price trend calculation
    if (history.length < 3) {
      return 'stable';
    }
    
    // Simple trend detection based on last 3 entries
    const recent = history.slice(-3);
    const priceChanges = recent.slice(1).map((entry, index) => {
      const prev = recent[index];
      // Use the first model's pricing as a reference
      const currentPrice = entry.pricing.models[0]?.inputTokenPrice || 0;
      const prevPrice = prev.pricing.models[0]?.inputTokenPrice || 0;
      return currentPrice - prevPrice;
    });
    
    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    
    if (avgChange > 0.001) return 'increasing';
    if (avgChange < -0.001) return 'decreasing';
    return 'stable';
  }

  private generatePriceChangeAnalysis(
    inputPriceChange: number,
    outputPriceChange: number
  ): string {
    // TODO: Implement price change analysis generation
    const analyses: string[] = [];
    
    if (Math.abs(inputPriceChange) > 10) {
      analyses.push(`Significant input price change: ${inputPriceChange.toFixed(2)}%`);
    }
    
    if (Math.abs(outputPriceChange) > 10) {
      analyses.push(`Significant output price change: ${outputPriceChange.toFixed(2)}%`);
    }
    
    if (analyses.length === 0) {
      analyses.push('Price remains relatively stable');
    }
    
    return analyses.join('. ');
  }
}

// Additional interfaces...
interface CostCalculationContext {
  userId?: string;
  timeOfDay?: 'peak' | 'off-peak';
  priority?: 'low' | 'normal' | 'high';
  volume?: 'low' | 'medium' | 'high';
}

interface PriceHistoryEntry {
  timestamp: Date;
  pricing: ProviderPricing;
  inputTokenPrice?: number;
  outputTokenPrice?: number;
  rateLimits?: any;
}

interface PriceChangeAnalysis {
  provider: string;
  model: string;
  changeDetected: boolean;
  inputPriceChange?: number;
  outputPriceChange?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
  analysis: string;
  lastChecked: Date;
}