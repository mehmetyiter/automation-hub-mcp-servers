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
          const latencyScore = this.calculateLatencyScore(model, taskRequirements);
          
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
    const historyKey = `${provider}:${model}`;
    const history = this.pricingHistory.get(historyKey) || [];

    if (history.length < 2) {
      return {
        provider,
        model,
        changeDetected: false,
        analysis: 'Insufficient historical data'
      };
    }

    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    const inputPriceChange = ((current.inputTokenPrice - previous.inputTokenPrice) / previous.inputTokenPrice) * 100;
    const outputPriceChange = ((current.outputTokenPrice - previous.outputTokenPrice) / previous.outputTokenPrice) * 100;

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
      this.storePricingHistory(pricing);

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
    if (model.features.includes('json-mode')) score += 0.05;

    // Adjust based on requirements match
    if (requirements.qualityRequirement === 'premium' && model.model.includes('gpt-4')) {
      score += 0.3;
    } else if (requirements.qualityRequirement === 'basic' && model.model.includes('3.5')) {
      score += 0.2;
    }

    return Math.min(1.0, score);
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
}

// Additional interfaces...
interface CostCalculationContext {
  userId?: string;
  timeOfDay?: 'peak' | 'off-peak';
  priority?: 'low' | 'normal' | 'high';
  volume?: 'low' | 'medium' | 'high';
}

interface PriceHistoryEntry {
  date: Date;
  inputTokenPrice: number;
  outputTokenPrice: number;
  rateLimits: any;
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