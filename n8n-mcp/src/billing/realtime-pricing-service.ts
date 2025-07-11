import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { ModelPricing, ProviderPricing, PricingComparison } from './intelligent-cost-manager.js';

export interface PricingProvider {
  name: string;
  apiEndpoint: string;
  apiKey?: string;
  updateFrequency: number; // milliseconds
  rateLimits: {
    requestsPerHour: number;
    requestsPerDay: number;
  };
  enabled: boolean;
}

export interface PricingAlert {
  id: string;
  type: 'price_increase' | 'price_decrease' | 'new_model' | 'model_discontinued' | 'rate_limit_change';
  provider: string;
  model?: string;
  oldValue?: number;
  newValue?: number;
  changePercentage?: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  affectedUsers: string[];
  recommendations: string[];
}

export interface PricingHistory {
  provider: string;
  model: string;
  pricePoints: Array<{
    timestamp: Date;
    inputTokenPrice: number;
    outputTokenPrice: number;
    requestPrice?: number;
    source: string;
  }>;
  trends: {
    shortTerm: 'increasing' | 'decreasing' | 'stable'; // Last 7 days
    mediumTerm: 'increasing' | 'decreasing' | 'stable'; // Last 30 days
    longTerm: 'increasing' | 'decreasing' | 'stable';   // Last 90 days
  };
  volatility: number; // 0-1, higher = more volatile
  prediction: {
    nextWeekEstimate: number;
    nextMonthEstimate: number;
    confidence: number;
  };
}

export interface MarketAnalysis {
  timestamp: Date;
  marketTrends: {
    averageInputTokenPrice: number;
    averageOutputTokenPrice: number;
    priceRange: { min: number; max: number };
    marketLeader: { provider: string; marketShare: number };
    growthRate: number; // Monthly percentage
  };
  competitiveAnalysis: Array<{
    provider: string;
    competitivePosition: 'leader' | 'challenger' | 'follower';
    priceCompetitiveness: number; // 0-1, 1 = most competitive
    uniqueAdvantages: string[];
    marketShare: number;
  }>;
  recommendations: {
    costOptimization: string[];
    marketOpportunities: string[];
    riskFactors: string[];
  };
}

export interface PricingSubscription {
  userId: string;
  subscriptionType: 'price_changes' | 'market_analysis' | 'cost_alerts' | 'new_models';
  providers: string[];
  models?: string[];
  thresholds: {
    priceChangeThreshold: number; // Percentage change to trigger alert
    costIncreaseThreshold: number; // Dollar amount increase
    marketVolatilityThreshold: number; // Volatility level
  };
  notificationChannels: {
    email: boolean;
    webhook?: string;
    inApp: boolean;
    sms?: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  lastNotified?: Date;
}

export class RealtimePricingService extends EventEmitter {
  private redis: Redis;
  private pricingProviders: Map<string, PricingProvider> = new Map();
  private pricingHistory = new Map<string, PricingHistory>();
  private userSubscriptions = new Map<string, PricingSubscription[]>();
  private marketCache = new Map<string, any>();
  
  // Update intervals
  private updateIntervals = new Map<string, NodeJS.Timeout>();
  private marketAnalysisInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;

  // Configuration
  private config = {
    defaultUpdateFrequency: 300000,      // 5 minutes
    historyRetentionDays: 90,           // 90 days of pricing history
    marketAnalysisFrequency: 3600000,   // 1 hour
    alertCheckFrequency: 60000,         // 1 minute
    volatilityWindow: 7,                // 7 days for volatility calculation
    predictionWindow: 30,               // 30 days for price prediction
    maxCacheAge: 300,                   // 5 minutes cache TTL
  };

  constructor(redisUrl?: string) {
    super();
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.initializePricingProviders();
    this.startRealtimeMonitoring();
  }

  private initializePricingProviders(): void {
    console.log('💰 Initializing real-time pricing providers...');

    // OpenAI pricing provider
    this.pricingProviders.set('openai', {
      name: 'OpenAI',
      apiEndpoint: 'https://api.openai.com/v1/models',
      updateFrequency: 300000, // 5 minutes
      rateLimits: {
        requestsPerHour: 1000,
        requestsPerDay: 20000
      },
      enabled: true
    });

    // Anthropic pricing provider
    this.pricingProviders.set('anthropic', {
      name: 'Anthropic',
      apiEndpoint: 'https://api.anthropic.com/v1/pricing',
      updateFrequency: 600000, // 10 minutes
      rateLimits: {
        requestsPerHour: 500,
        requestsPerDay: 10000
      },
      enabled: true
    });

    // Google pricing provider
    this.pricingProviders.set('google', {
      name: 'Google',
      apiEndpoint: 'https://generativelanguage.googleapis.com/v1/pricing',
      updateFrequency: 900000, // 15 minutes
      rateLimits: {
        requestsPerHour: 300,
        requestsPerDay: 5000
      },
      enabled: true
    });

    // Add other providers...
    this.pricingProviders.set('cohere', {
      name: 'Cohere',
      apiEndpoint: 'https://api.cohere.ai/v1/pricing',
      updateFrequency: 600000,
      rateLimits: { requestsPerHour: 400, requestsPerDay: 8000 },
      enabled: true
    });

    console.log(`✅ Initialized ${this.pricingProviders.size} pricing providers`);
  }

  private startRealtimeMonitoring(): void {
    console.log('📊 Starting real-time pricing monitoring...');

    // Start monitoring for each provider
    for (const [providerId, provider] of this.pricingProviders.entries()) {
      if (provider.enabled) {
        this.startProviderMonitoring(providerId, provider);
      }
    }

    // Start market analysis
    this.marketAnalysisInterval = setInterval(async () => {
      await this.performMarketAnalysis();
    }, this.config.marketAnalysisFrequency);

    // Start alert checking
    this.alertCheckInterval = setInterval(async () => {
      await this.checkPricingAlerts();
    }, this.config.alertCheckFrequency);

    console.log('✅ Real-time pricing monitoring started');
  }

  private startProviderMonitoring(providerId: string, provider: PricingProvider): void {
    const interval = setInterval(async () => {
      try {
        await this.updateProviderPricing(providerId);
      } catch (error) {
        console.error(`❌ Error updating pricing for ${providerId}:`, error);
        this.emit('pricing-update-error', { provider: providerId, error });
      }
    }, provider.updateFrequency);

    this.updateIntervals.set(providerId, interval);
    
    // Initial update
    this.updateProviderPricing(providerId);
  }

  private async updateProviderPricing(providerId: string): Promise<void> {
    const provider = this.pricingProviders.get(providerId);
    if (!provider || !provider.enabled) return;

    console.log(`📈 Updating pricing for ${provider.name}...`);

    try {
      const newPricing = await this.fetchProviderPricing(providerId);
      const oldPricing = await this.getCurrentPricing(providerId);

      // Store new pricing
      await this.storePricing(providerId, newPricing);

      // Update pricing history
      await this.updatePricingHistory(providerId, newPricing);

      // Check for significant changes
      if (oldPricing) {
        await this.detectPricingChanges(providerId, oldPricing, newPricing);
      }

      // Emit update event
      this.emit('pricing-updated', {
        provider: providerId,
        pricing: newPricing,
        timestamp: new Date()
      });

      console.log(`✅ Updated pricing for ${provider.name}`);

    } catch (error) {
      console.error(`❌ Failed to update pricing for ${provider.name}:`, error);
      this.emit('pricing-update-failed', { provider: providerId, error });
    }
  }

  private async fetchProviderPricing(providerId: string): Promise<ProviderPricing> {
    const provider = this.pricingProviders.get(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found`);

    // In production, this would make actual API calls to providers
    // For now, return mock data with realistic pricing
    const mockPricing = await this.generateMockPricing(providerId);
    
    // Add some realistic price variations
    const variationFactor = 0.95 + Math.random() * 0.1; // ±5% variation
    mockPricing.models.forEach(model => {
      model.pricing.inputTokenPrice *= variationFactor;
      model.pricing.outputTokenPrice *= variationFactor;
    });

    return mockPricing;
  }

  private async generateMockPricing(providerId: string): Promise<ProviderPricing> {
    const baseRate = this.getBaseRateForProvider(providerId);
    const models = await this.getProviderModels(providerId);

    const modelPricing: ModelPricing[] = models.map(model => ({
      provider: providerId,
      model,
      pricing: {
        inputTokenPrice: baseRate.input * this.getModelMultiplier(model),
        outputTokenPrice: baseRate.output * this.getModelMultiplier(model),
        requestPrice: baseRate.request,
        minimumCharge: 0.001
      },
      lastUpdated: new Date(),
      currency: 'USD',
      tier: this.getModelTier(model)
    }));

    return {
      provider: providerId,
      models: modelPricing,
      rateLimits: this.getProviderRateLimits(providerId),
      discounts: {
        volumeDiscounts: this.getVolumeDiscounts(providerId)
      },
      lastUpdated: new Date()
    };
  }

  private getBaseRateForProvider(providerId: string): { input: number; output: number; request: number } {
    const baseRates: Record<string, { input: number; output: number; request: number }> = {
      'openai': { input: 0.003, output: 0.006, request: 0.001 },
      'anthropic': { input: 0.008, output: 0.024, request: 0.002 },
      'google': { input: 0.0025, output: 0.005, request: 0.001 },
      'cohere': { input: 0.002, output: 0.004, request: 0.001 },
      'azure': { input: 0.003, output: 0.006, request: 0.001 },
      'aws': { input: 0.004, output: 0.008, request: 0.002 }
    };
    return baseRates[providerId] || { input: 0.005, output: 0.01, request: 0.001 };
  }

  private getModelMultiplier(model: string): number {
    // Different models have different pricing multipliers
    if (model.includes('gpt-4') || model.includes('opus')) return 2.0;
    if (model.includes('sonnet') || model.includes('pro')) return 1.5;
    if (model.includes('haiku') || model.includes('lite')) return 0.5;
    return 1.0;
  }

  private getModelTier(model: string): ModelPricing['tier'] {
    if (model.includes('lite') || model.includes('free')) return 'free';
    if (model.includes('enterprise')) return 'enterprise';
    if (model.includes('premium')) return 'subscription';
    return 'pay-per-use';
  }

  private async getProviderModels(providerId: string): Promise<string[]> {
    const modelMaps: Record<string, string[]> = {
      'openai': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'text-davinci-003'],
      'anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-instant'],
      'google': ['gemini-pro', 'gemini-pro-vision', 'text-bison', 'chat-bison'],
      'cohere': ['command', 'command-light', 'command-nightly', 'embed-multilingual'],
      'azure': ['gpt-4', 'gpt-35-turbo', 'text-davinci-003'],
      'aws': ['titan-text-express', 'titan-text-lite', 'jurassic-2-ultra']
    };
    return modelMaps[providerId] || [];
  }

  private getProviderRateLimits(providerId: string): ProviderPricing['rateLimits'] {
    const rateLimits: Record<string, ProviderPricing['rateLimits']> = {
      'openai': { requestsPerMinute: 3500, tokensPerMinute: 90000, requestsPerDay: 5000000 },
      'anthropic': { requestsPerMinute: 1000, tokensPerMinute: 40000, requestsPerDay: 1440000 },
      'google': { requestsPerMinute: 600, tokensPerMinute: 32000, requestsPerDay: 864000 },
      'cohere': { requestsPerMinute: 1000, tokensPerMinute: 50000, requestsPerDay: 1440000 }
    };
    return rateLimits[providerId] || { requestsPerMinute: 500, tokensPerMinute: 20000, requestsPerDay: 720000 };
  }

  private getVolumeDiscounts(providerId: string): ProviderPricing['discounts']['volumeDiscounts'] {
    return [
      { minimumSpend: 100, discountPercentage: 5, description: '5% off for $100+ monthly spend' },
      { minimumSpend: 500, discountPercentage: 10, description: '10% off for $500+ monthly spend' },
      { minimumSpend: 1000, discountPercentage: 15, description: '15% off for $1000+ monthly spend' },
      { minimumSpend: 5000, discountPercentage: 20, description: '20% off for $5000+ monthly spend' }
    ];
  }

  private async getCurrentPricing(providerId: string): Promise<ProviderPricing | null> {
    try {
      const cached = await this.redis.get(`current_pricing:${providerId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`Error getting current pricing for ${providerId}:`, error);
      return null;
    }
  }

  private async storePricing(providerId: string, pricing: ProviderPricing): Promise<void> {
    // Store current pricing
    await this.redis.setex(
      `current_pricing:${providerId}`,
      this.config.maxCacheAge,
      JSON.stringify(pricing)
    );

    // Store in pricing history
    const timestamp = Date.now();
    await this.redis.zadd(
      `pricing_history:${providerId}`,
      timestamp,
      JSON.stringify(pricing)
    );

    // Clean old history (keep only last 90 days)
    const cutoffTime = timestamp - (this.config.historyRetentionDays * 24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore(`pricing_history:${providerId}`, 0, cutoffTime);
  }

  private async updatePricingHistory(providerId: string, newPricing: ProviderPricing): Promise<void> {
    for (const model of newPricing.models) {
      const historyKey = `${providerId}:${model.model}`;
      let history = this.pricingHistory.get(historyKey);

      if (!history) {
        history = {
          provider: providerId,
          model: model.model,
          pricePoints: [],
          trends: { shortTerm: 'stable', mediumTerm: 'stable', longTerm: 'stable' },
          volatility: 0,
          prediction: { nextWeekEstimate: 0, nextMonthEstimate: 0, confidence: 0 }
        };
      }

      // Add new price point
      history.pricePoints.push({
        timestamp: new Date(),
        inputTokenPrice: model.pricing.inputTokenPrice,
        outputTokenPrice: model.pricing.outputTokenPrice,
        requestPrice: model.pricing.requestPrice || 0,
        source: 'api'
      });

      // Keep only recent history for analysis
      const cutoffDate = new Date(Date.now() - this.config.historyRetentionDays * 24 * 60 * 60 * 1000);
      history.pricePoints = history.pricePoints.filter(point => point.timestamp > cutoffDate);

      // Update trends and predictions
      this.calculatePricingTrends(history);
      this.calculateVolatility(history);
      this.generatePricePredictions(history);

      this.pricingHistory.set(historyKey, history);

      // Store in Redis
      await this.redis.setex(
        `pricing_history_analysis:${historyKey}`,
        86400, // 24 hours
        JSON.stringify(history)
      );
    }
  }

  private calculatePricingTrends(history: PricingHistory): void {
    if (history.pricePoints.length < 2) return;

    const now = new Date();
    const prices = history.pricePoints.map(p => p.inputTokenPrice);

    // Short-term trend (7 days)
    const shortTermPrices = history.pricePoints
      .filter(p => (now.getTime() - p.timestamp.getTime()) <= 7 * 24 * 60 * 60 * 1000)
      .map(p => p.inputTokenPrice);
    
    if (shortTermPrices.length >= 2) {
      const trend = this.calculateTrend(shortTermPrices);
      history.trends.shortTerm = trend;
    }

    // Medium-term trend (30 days)
    const mediumTermPrices = history.pricePoints
      .filter(p => (now.getTime() - p.timestamp.getTime()) <= 30 * 24 * 60 * 60 * 1000)
      .map(p => p.inputTokenPrice);
    
    if (mediumTermPrices.length >= 2) {
      const trend = this.calculateTrend(mediumTermPrices);
      history.trends.mediumTerm = trend;
    }

    // Long-term trend (90 days)
    const longTermPrices = prices;
    if (longTermPrices.length >= 2) {
      const trend = this.calculateTrend(longTermPrices);
      history.trends.longTerm = trend;
    }
  }

  private calculateTrend(prices: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (prices.length < 2) return 'stable';

    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = (last - first) / first;

    if (change > 0.05) return 'increasing';     // >5% increase
    if (change < -0.05) return 'decreasing';   // >5% decrease
    return 'stable';
  }

  private calculateVolatility(history: PricingHistory): void {
    if (history.pricePoints.length < 7) {
      history.volatility = 0;
      return;
    }

    const prices = history.pricePoints
      .slice(-this.config.volatilityWindow)
      .map(p => p.inputTokenPrice);

    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);

    // Volatility as coefficient of variation (normalized)
    history.volatility = Math.min(standardDeviation / mean, 1);
  }

  private generatePricePredictions(history: PricingHistory): void {
    if (history.pricePoints.length < 7) {
      history.prediction = { nextWeekEstimate: 0, nextMonthEstimate: 0, confidence: 0 };
      return;
    }

    const recentPrices = history.pricePoints.slice(-14); // Last 14 data points
    const currentPrice = recentPrices[recentPrices.length - 1].inputTokenPrice;
    
    // Simple linear regression for prediction
    const { slope, confidence } = this.performLinearRegression(recentPrices);
    
    // Predict future prices based on trend
    const weeklyChange = slope * 7;   // 7 days ahead
    const monthlyChange = slope * 30; // 30 days ahead

    history.prediction = {
      nextWeekEstimate: Math.max(0, currentPrice + weeklyChange),
      nextMonthEstimate: Math.max(0, currentPrice + monthlyChange),
      confidence: Math.min(confidence, 0.95) // Cap confidence at 95%
    };
  }

  private performLinearRegression(pricePoints: PricingHistory['pricePoints']): { slope: number; confidence: number } {
    const n = pricePoints.length;
    if (n < 2) return { slope: 0, confidence: 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    pricePoints.forEach((point, index) => {
      const x = index;
      const y = point.inputTokenPrice;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared for confidence
    const meanY = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    pricePoints.forEach((point, index) => {
      const x = index;
      const y = point.inputTokenPrice;
      const predicted = meanY + slope * (x - sumX / n);
      
      ssTotal += Math.pow(y - meanY, 2);
      ssResidual += Math.pow(y - predicted, 2);
    });

    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, rSquared);

    return { slope, confidence };
  }

  private async detectPricingChanges(
    providerId: string,
    oldPricing: ProviderPricing,
    newPricing: ProviderPricing
  ): Promise<void> {
    const alerts: PricingAlert[] = [];

    // Compare model pricing
    for (const newModel of newPricing.models) {
      const oldModel = oldPricing.models.find(m => m.model === newModel.model);
      
      if (!oldModel) {
        // New model detected
        alerts.push({
          id: `new_model_${Date.now()}`,
          type: 'new_model',
          provider: providerId,
          model: newModel.model,
          severity: 'info',
          message: `New model available: ${newModel.model}`,
          timestamp: new Date(),
          affectedUsers: [],
          recommendations: [`Consider evaluating ${newModel.model} for potential cost savings`]
        });
        continue;
      }

      // Check for price changes
      const inputPriceChange = this.calculatePercentageChange(
        oldModel.pricing.inputTokenPrice,
        newModel.pricing.inputTokenPrice
      );

      const outputPriceChange = this.calculatePercentageChange(
        oldModel.pricing.outputTokenPrice,
        newModel.pricing.outputTokenPrice
      );

      // Significant price change threshold: 5%
      if (Math.abs(inputPriceChange) > 5 || Math.abs(outputPriceChange) > 5) {
        const isIncrease = inputPriceChange > 0 || outputPriceChange > 0;
        const maxChange = Math.max(Math.abs(inputPriceChange), Math.abs(outputPriceChange));

        alerts.push({
          id: `price_change_${Date.now()}`,
          type: isIncrease ? 'price_increase' : 'price_decrease',
          provider: providerId,
          model: newModel.model,
          oldValue: oldModel.pricing.inputTokenPrice,
          newValue: newModel.pricing.inputTokenPrice,
          changePercentage: maxChange,
          severity: maxChange > 20 ? 'critical' : maxChange > 10 ? 'warning' : 'info',
          message: `${newModel.model} price ${isIncrease ? 'increased' : 'decreased'} by ${maxChange.toFixed(1)}%`,
          timestamp: new Date(),
          affectedUsers: await this.getUsersUsingModel(providerId, newModel.model),
          recommendations: this.generatePriceChangeRecommendations(isIncrease, maxChange, providerId, newModel.model)
        });
      }
    }

    // Check for discontinued models
    for (const oldModel of oldPricing.models) {
      const stillExists = newPricing.models.find(m => m.model === oldModel.model);
      if (!stillExists) {
        alerts.push({
          id: `discontinued_model_${Date.now()}`,
          type: 'model_discontinued',
          provider: providerId,
          model: oldModel.model,
          severity: 'warning',
          message: `Model discontinued: ${oldModel.model}`,
          timestamp: new Date(),
          affectedUsers: await this.getUsersUsingModel(providerId, oldModel.model),
          recommendations: [`Migrate from ${oldModel.model} to an alternative model`]
        });
      }
    }

    // Process and send alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  private generatePriceChangeRecommendations(
    isIncrease: boolean,
    changePercentage: number,
    provider: string,
    model: string
  ): string[] {
    const recommendations = [];

    if (isIncrease) {
      recommendations.push(`Consider switching to alternative providers for ${model}`);
      if (changePercentage > 15) {
        recommendations.push('Evaluate usage patterns to optimize costs');
        recommendations.push('Consider implementing more aggressive caching');
      }
      recommendations.push('Review budget allocations and adjust limits if needed');
    } else {
      recommendations.push(`Consider increasing usage of ${model} due to price decrease`);
      recommendations.push('Re-evaluate provider mix to take advantage of lower costs');
    }

    return recommendations;
  }

  private async getUsersUsingModel(provider: string, model: string): Promise<string[]> {
    // In production, this would query the database for users actively using this model
    // For now, return a mock list
    return ['user1', 'user2', 'user3'];
  }

  private async processAlert(alert: PricingAlert): Promise<void> {
    console.log(`🚨 Processing pricing alert: ${alert.message}`);

    // Store alert
    await this.redis.lpush('pricing_alerts', JSON.stringify(alert));
    await this.redis.ltrim('pricing_alerts', 0, 999); // Keep last 1000 alerts

    // Emit alert event
    this.emit('pricing-alert', alert);

    // Send notifications to subscribed users
    await this.sendAlertNotifications(alert);

    // Store alert for affected users
    for (const userId of alert.affectedUsers) {
      await this.redis.lpush(`user_alerts:${userId}`, JSON.stringify(alert));
      await this.redis.ltrim(`user_alerts:${userId}`, 0, 99); // Keep last 100 per user
    }
  }

  private async sendAlertNotifications(alert: PricingAlert): Promise<void> {
    // Get all relevant subscriptions
    const subscriptions = await this.getRelevantSubscriptions(alert);

    for (const subscription of subscriptions) {
      try {
        if (subscription.notificationChannels.email) {
          await this.sendEmailNotification(subscription.userId, alert);
        }

        if (subscription.notificationChannels.webhook) {
          await this.sendWebhookNotification(subscription.notificationChannels.webhook, alert);
        }

        if (subscription.notificationChannels.inApp) {
          await this.createInAppNotification(subscription.userId, alert);
        }

        // Update last notified timestamp
        subscription.lastNotified = new Date();
        await this.updateSubscription(subscription);

      } catch (error) {
        console.error(`❌ Error sending notification to user ${subscription.userId}:`, error);
      }
    }
  }

  private async getRelevantSubscriptions(alert: PricingAlert): Promise<PricingSubscription[]> {
    // Mock implementation - would query database in production
    return [];
  }

  private async sendEmailNotification(userId: string, alert: PricingAlert): Promise<void> {
    console.log(`📧 Sending email notification to user ${userId} for alert: ${alert.message}`);
    // Email sending implementation would go here
  }

  private async sendWebhookNotification(webhookUrl: string, alert: PricingAlert): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'pricing_alert',
          alert,
          timestamp: new Date()
        })
      });

      if (response.ok) {
        console.log(`✅ Webhook notification sent successfully to ${webhookUrl}`);
      } else {
        console.error(`❌ Webhook notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Webhook notification error:`, error);
    }
  }

  private async createInAppNotification(userId: string, alert: PricingAlert): Promise<void> {
    const notification = {
      id: `notif_${Date.now()}`,
      userId,
      type: 'pricing_alert',
      title: `Pricing Alert: ${alert.provider}`,
      message: alert.message,
      severity: alert.severity,
      timestamp: new Date(),
      read: false,
      actionUrl: `/pricing/alerts/${alert.id}`
    };

    await this.redis.lpush(`notifications:${userId}`, JSON.stringify(notification));
    await this.redis.ltrim(`notifications:${userId}`, 0, 99);

    console.log(`🔔 Created in-app notification for user ${userId}`);
  }

  private async updateSubscription(subscription: PricingSubscription): Promise<void> {
    await this.redis.setex(
      `pricing_subscription:${subscription.userId}`,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(subscription)
    );
  }

  private async performMarketAnalysis(): Promise<void> {
    console.log('📊 Performing market analysis...');

    try {
      const providers = Array.from(this.pricingProviders.keys());
      const analysis = await this.generateMarketAnalysis(providers);

      // Store analysis
      await this.redis.setex(
        'market_analysis',
        this.config.maxCacheAge,
        JSON.stringify(analysis)
      );

      // Emit analysis event
      this.emit('market-analysis-updated', analysis);

      console.log('✅ Market analysis completed');

    } catch (error) {
      console.error('❌ Error performing market analysis:', error);
    }
  }

  private async generateMarketAnalysis(providers: string[]): Promise<MarketAnalysis> {
    const allPricing = await Promise.all(
      providers.map(async provider => ({
        provider,
        pricing: await this.getCurrentPricing(provider)
      }))
    );

    const validPricing = allPricing.filter(p => p.pricing !== null);

    // Calculate market trends
    const allInputPrices = validPricing.flatMap(p => 
      p.pricing!.models.map(m => m.pricing.inputTokenPrice)
    );
    const allOutputPrices = validPricing.flatMap(p => 
      p.pricing!.models.map(m => m.pricing.outputTokenPrice)
    );

    const marketTrends = {
      averageInputTokenPrice: allInputPrices.reduce((sum, price) => sum + price, 0) / allInputPrices.length,
      averageOutputTokenPrice: allOutputPrices.reduce((sum, price) => sum + price, 0) / allOutputPrices.length,
      priceRange: {
        min: Math.min(...allInputPrices, ...allOutputPrices),
        max: Math.max(...allInputPrices, ...allOutputPrices)
      },
      marketLeader: { provider: 'openai', marketShare: 0.45 }, // Mock data
      growthRate: 5.2 // Mock growth rate
    };

    // Generate competitive analysis
    const competitiveAnalysis = validPricing.map(p => ({
      provider: p.provider,
      competitivePosition: this.getCompetitivePosition(p.provider),
      priceCompetitiveness: this.calculatePriceCompetitiveness(p.pricing!, allInputPrices),
      uniqueAdvantages: this.getProviderAdvantages(p.provider),
      marketShare: this.getMarketShare(p.provider)
    }));

    return {
      timestamp: new Date(),
      marketTrends,
      competitiveAnalysis,
      recommendations: {
        costOptimization: [
          'Consider multi-provider strategies to minimize costs',
          'Monitor price trends for optimal switching opportunities',
          'Implement usage-based provider selection'
        ],
        marketOpportunities: [
          'New models from emerging providers show cost advantages',
          'Volume discounts become available at higher usage tiers'
        ],
        riskFactors: [
          'Increasing price volatility in premium model segment',
          'Potential supply constraints may affect pricing'
        ]
      }
    };
  }

  private getCompetitivePosition(provider: string): 'leader' | 'challenger' | 'follower' {
    const positions: Record<string, 'leader' | 'challenger' | 'follower'> = {
      'openai': 'leader',
      'anthropic': 'challenger',
      'google': 'challenger',
      'cohere': 'follower',
      'azure': 'challenger',
      'aws': 'challenger'
    };
    return positions[provider] || 'follower';
  }

  private calculatePriceCompetitiveness(pricing: ProviderPricing, marketPrices: number[]): number {
    const avgProviderPrice = pricing.models.reduce((sum, model) => 
      sum + model.pricing.inputTokenPrice, 0) / pricing.models.length;
    
    const marketAverage = marketPrices.reduce((sum, price) => sum + price, 0) / marketPrices.length;
    
    // Higher score for lower prices (more competitive)
    return Math.max(0, 1 - (avgProviderPrice / marketAverage));
  }

  private getProviderAdvantages(provider: string): string[] {
    const advantages: Record<string, string[]> = {
      'openai': ['Largest model selection', 'Highest performance models', 'Best ecosystem integration'],
      'anthropic': ['Constitutional AI safety', 'Long context windows', 'High-quality reasoning'],
      'google': ['Multimodal capabilities', 'Free tier availability', 'Fast inference'],
      'cohere': ['Enterprise focus', 'Multilingual support', 'Embedding specialization'],
      'azure': ['Enterprise security', 'Global availability', 'Microsoft ecosystem'],
      'aws': ['AWS integration', 'Custom models', 'Enterprise support']
    };
    return advantages[provider] || ['Competitive pricing'];
  }

  private getMarketShare(provider: string): number {
    const marketShares: Record<string, number> = {
      'openai': 0.45,
      'anthropic': 0.15,
      'google': 0.20,
      'cohere': 0.08,
      'azure': 0.07,
      'aws': 0.05
    };
    return marketShares[provider] || 0.01;
  }

  private async checkPricingAlerts(): Promise<void> {
    // This would check for conditions that should trigger alerts
    // For example, sudden price spikes, unusual volatility, etc.
    
    // Check for market volatility
    const analysis = await this.getLatestMarketAnalysis();
    if (analysis && this.isMarketVolatile(analysis)) {
      const alert: PricingAlert = {
        id: `market_volatility_${Date.now()}`,
        type: 'price_increase',
        provider: 'market',
        severity: 'warning',
        message: 'High market volatility detected across multiple providers',
        timestamp: new Date(),
        affectedUsers: await this.getAllSubscribedUsers(),
        recommendations: [
          'Consider locking in current rates where possible',
          'Monitor usage closely during volatile periods',
          'Review budget allocations for potential overruns'
        ]
      };

      await this.processAlert(alert);
    }
  }

  private async getLatestMarketAnalysis(): Promise<MarketAnalysis | null> {
    try {
      const cached = await this.redis.get('market_analysis');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  private isMarketVolatile(analysis: MarketAnalysis): boolean {
    // Simple volatility check - could be more sophisticated
    const priceRange = analysis.marketTrends.priceRange;
    const volatilityRatio = (priceRange.max - priceRange.min) / priceRange.min;
    return volatilityRatio > 0.3; // 30% price range indicates high volatility
  }

  private async getAllSubscribedUsers(): Promise<string[]> {
    // Mock implementation - would query database for all users with active subscriptions
    return ['user1', 'user2', 'user3'];
  }

  // Public API methods
  async subscribeToPricingAlerts(userId: string, subscription: Omit<PricingSubscription, 'userId' | 'createdAt'>): Promise<void> {
    const fullSubscription: PricingSubscription = {
      ...subscription,
      userId,
      createdAt: new Date()
    };

    await this.redis.setex(
      `pricing_subscription:${userId}`,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(fullSubscription)
    );

    console.log(`✅ User ${userId} subscribed to pricing alerts`);
  }

  async getPricingHistory(provider: string, model: string): Promise<PricingHistory | null> {
    const historyKey = `${provider}:${model}`;
    const cached = await this.redis.get(`pricing_history_analysis:${historyKey}`);
    return cached ? JSON.parse(cached) : null;
  }

  async getCurrentMarketAnalysis(): Promise<MarketAnalysis | null> {
    return await this.getLatestMarketAnalysis();
  }

  async comparePricing(providers: string[], model: string): Promise<PricingComparison | null> {
    try {
      const comparisons = [];
      
      for (const provider of providers) {
        const pricing = await this.getCurrentPricing(provider);
        if (pricing) {
          const modelPricing = pricing.models.find(m => m.model === model);
          if (modelPricing) {
            comparisons.push({
              provider,
              model,
              pricing: modelPricing.pricing,
              estimatedMonthlyCost: this.estimateMonthlyModelCost(modelPricing),
              costRank: 0
            });
          }
        }
      }

      if (comparisons.length === 0) return null;

      // Sort by estimated cost and assign ranks
      comparisons.sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);
      comparisons.forEach((comp, index) => {
        comp.costRank = index + 1;
      });

      const cheapest = comparisons[0];
      const mostExpensive = comparisons[comparisons.length - 1];
      const potentialSavings = mostExpensive.estimatedMonthlyCost - cheapest.estimatedMonthlyCost;

      return {
        models: comparisons,
        recommendations: [
          `${cheapest.provider} offers the most cost-effective option for ${model}`,
          `Potential monthly savings of $${potentialSavings.toFixed(2)} by switching to ${cheapest.provider}`
        ],
        potentialSavings
      };

    } catch (error) {
      console.error('Error comparing pricing:', error);
      return null;
    }
  }

  private estimateMonthlyModelCost(modelPricing: ModelPricing): number {
    // Estimate based on average usage patterns
    const avgInputTokens = 10000;  // 10k input tokens per month
    const avgOutputTokens = 5000;  // 5k output tokens per month
    const avgRequests = 1000;      // 1k requests per month

    const inputCost = (avgInputTokens / 1000) * modelPricing.pricing.inputTokenPrice;
    const outputCost = (avgOutputTokens / 1000) * modelPricing.pricing.outputTokenPrice;
    const requestCost = avgRequests * (modelPricing.pricing.requestPrice || 0);

    return inputCost + outputCost + requestCost;
  }

  async getPricingMetrics(): Promise<any> {
    const totalProviders = this.pricingProviders.size;
    const activeProviders = Array.from(this.pricingProviders.values()).filter(p => p.enabled).length;
    const totalAlerts = await this.redis.llen('pricing_alerts');
    const lastUpdate = await this.redis.get('last_pricing_update') || 'Never';

    return {
      totalProviders,
      activeProviders,
      totalAlerts,
      lastUpdate,
      monitoringStatus: 'active',
      updateFrequency: 'real-time'
    };
  }

  async destroy(): Promise<void> {
    // Clear intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }
    
    if (this.marketAnalysisInterval) clearInterval(this.marketAnalysisInterval);
    if (this.alertCheckInterval) clearInterval(this.alertCheckInterval);

    await this.redis.quit();
    this.removeAllListeners();
  }
}

// Export convenience function
export function createRealtimePricingService(redisUrl?: string): RealtimePricingService {
  return new RealtimePricingService(redisUrl);
}