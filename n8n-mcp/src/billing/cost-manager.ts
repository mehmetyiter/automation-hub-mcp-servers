import { EventEmitter } from 'events';

export interface CostPeriod {
  start: Date;
  end: Date;
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export interface CostSummary {
  period: CostPeriod;
  totalCost: number;
  providerCosts: ProviderCost[];
  featureCosts: FeatureCost[];
  modelCosts: ModelCost[];
  trends: CostTrend[];
  projections: CostProjection;
  budgetStatus: BudgetStatus;
}

export interface ProviderCost {
  provider: string;
  totalCost: number;
  requests: number;
  tokens: number;
  averageCostPerRequest: number;
  averageCostPerToken: number;
  models: ModelCost[];
}

export interface ModelCost {
  model: string;
  provider: string;
  totalCost: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
}

export interface FeatureCost {
  feature: string;
  totalCost: number;
  requests: number;
  averageCostPerRequest: number;
  percentageOfTotal: number;
}

export interface CostTrend {
  metric: 'total_cost' | 'cost_per_request' | 'cost_per_token';
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  period: string;
}

export interface CostProjection {
  dailyProjection: number;
  weeklyProjection: number;
  monthlyProjection: number;
  yearlyProjection: number;
  confidence: number;
  basedOnDays: number;
}

export interface BudgetLimits {
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  yearlyLimit?: number;
  providerLimits?: Map<string, BudgetLimits>;
  featureLimits?: Map<string, BudgetLimits>;
}

export interface BudgetStatus {
  isWithinBudget: boolean;
  dailyStatus: BudgetStatusDetail;
  weeklyStatus: BudgetStatusDetail;
  monthlyStatus: BudgetStatusDetail;
  yearlyStatus: BudgetStatusDetail;
  alerts: BudgetAlert[];
}

export interface BudgetStatusDetail {
  limit?: number;
  currentSpend: number;
  remainingBudget: number;
  percentageUsed: number;
  projectedSpend: number;
  willExceedBudget: boolean;
  daysUntilReset: number;
}

export interface BudgetAlert {
  type: 'approaching_limit' | 'limit_exceeded' | 'projection_warning';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentSpend: number;
  limit: number;
  timeframe: string;
}

export interface CostOptimization {
  currentCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercentage: number;
  recommendations: CostRecommendation[];
  implementationPlan: OptimizationPlan;
}

export interface CostRecommendation {
  type: 'model_switch' | 'caching' | 'batching' | 'provider_switch' | 'feature_optimization';
  title: string;
  description: string;
  potentialSavings: number;
  savingsPercentage: number;
  effortLevel: 'low' | 'medium' | 'high';
  implementationSteps: string[];
  riskLevel: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

export interface OptimizationPlan {
  quickWins: CostRecommendation[];
  mediumTermActions: CostRecommendation[];
  longTermStrategies: CostRecommendation[];
  totalPotentialSavings: number;
  implementationTimeline: string;
}

export interface Database {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: any }>;
}

export class CostManager extends EventEmitter {
  private modelPricing = new Map<string, ModelPricing>();
  private costCache = new Map<string, CostSummary>();
  private cacheTimeout = 300000; // 5 minutes
  
  constructor(private database: Database) {
    super();
    this.initializeModelPricing();
  }
  
  private initializeModelPricing(): void {
    // OpenAI Pricing (as of 2024)
    this.modelPricing.set('openai:gpt-4', {
      provider: 'openai',
      model: 'gpt-4',
      inputCostPer1kTokens: 0.03,
      outputCostPer1kTokens: 0.06,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    this.modelPricing.set('openai:gpt-4-turbo', {
      provider: 'openai',
      model: 'gpt-4-turbo',
      inputCostPer1kTokens: 0.01,
      outputCostPer1kTokens: 0.03,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    this.modelPricing.set('openai:gpt-3.5-turbo', {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      inputCostPer1kTokens: 0.0005,
      outputCostPer1kTokens: 0.0015,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    // Anthropic Pricing
    this.modelPricing.set('anthropic:claude-3-opus', {
      provider: 'anthropic',
      model: 'claude-3-opus',
      inputCostPer1kTokens: 0.015,
      outputCostPer1kTokens: 0.075,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    this.modelPricing.set('anthropic:claude-3-sonnet', {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    this.modelPricing.set('anthropic:claude-3-haiku', {
      provider: 'anthropic',
      model: 'claude-3-haiku',
      inputCostPer1kTokens: 0.00025,
      outputCostPer1kTokens: 0.00125,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    // Google Pricing
    this.modelPricing.set('google:gemini-pro', {
      provider: 'google',
      model: 'gemini-pro',
      inputCostPer1kTokens: 0.0005,
      outputCostPer1kTokens: 0.0015,
      requestCost: 0,
      lastUpdated: new Date()
    });
    
    // Cohere Pricing
    this.modelPricing.set('cohere:command', {
      provider: 'cohere',
      model: 'command',
      inputCostPer1kTokens: 0.0015,
      outputCostPer1kTokens: 0.002,
      requestCost: 0,
      lastUpdated: new Date()
    });
  }
  
  async calculateRequestCost(provider: string, model: string, inputTokens: number, outputTokens: number): Promise<number> {
    const pricingKey = `${provider}:${model}`;
    const pricing = this.modelPricing.get(pricingKey);
    
    if (!pricing) {
      console.warn(`No pricing data for ${pricingKey}, using default`);
      return this.calculateDefaultCost(inputTokens, outputTokens);
    }
    
    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1kTokens;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1kTokens;
    const requestCost = pricing.requestCost || 0;
    
    return inputCost + outputCost + requestCost;
  }
  
  private calculateDefaultCost(inputTokens: number, outputTokens: number): number {
    // Default pricing when specific model pricing is not available
    const defaultInputCost = 0.002; // $2 per 1k tokens
    const defaultOutputCost = 0.004; // $4 per 1k tokens
    
    return ((inputTokens / 1000) * defaultInputCost) + ((outputTokens / 1000) * defaultOutputCost);
  }
  
  async getUserCostSummary(userId: string, period: CostPeriod): Promise<CostSummary> {
    console.log(`💰 Getting cost summary for user: ${userId}, period: ${period.period}`);
    
    try {
      // Check cache first
      const cacheKey = `cost_summary:${userId}:${period.start.getTime()}:${period.end.getTime()}`;
      const cached = this.costCache.get(cacheKey);
      
      if (cached && Date.now() - cached.period.start.getTime() < this.cacheTimeout) {
        return cached;
      }
      
      // Query usage data
      const usageData = await this.database.query(`
        SELECT 
          provider,
          model,
          feature,
          operation,
          COUNT(*) as requests,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(estimated_cost) as total_cost
        FROM api_usage_events 
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY provider, model, feature, operation
      `, [userId, period.start, period.end]);
      
      // Calculate costs
      const summary = await this.buildCostSummary(userId, period, usageData);
      
      // Cache the result
      this.costCache.set(cacheKey, summary);
      
      return summary;
    } catch (error) {
      console.error('Failed to get user cost summary:', error);
      throw error;
    }
  }
  
  private async buildCostSummary(userId: string, period: CostPeriod, usageData: any[]): Promise<CostSummary> {
    let totalCost = 0;
    const providerCostMap = new Map<string, ProviderCost>();
    const featureCostMap = new Map<string, FeatureCost>();
    const modelCostMap = new Map<string, ModelCost>();
    
    for (const row of usageData) {
      const cost = row.total_cost;
      totalCost += cost;
      
      // Provider costs
      const providerKey = row.provider;
      if (!providerCostMap.has(providerKey)) {
        providerCostMap.set(providerKey, {
          provider: row.provider,
          totalCost: 0,
          requests: 0,
          tokens: 0,
          averageCostPerRequest: 0,
          averageCostPerToken: 0,
          models: []
        });
      }
      
      const providerCost = providerCostMap.get(providerKey)!;
      providerCost.totalCost += cost;
      providerCost.requests += row.requests;
      providerCost.tokens += row.input_tokens + row.output_tokens;
      
      // Model costs
      const modelKey = `${row.provider}:${row.model}`;
      if (!modelCostMap.has(modelKey)) {
        const pricing = this.modelPricing.get(modelKey);
        modelCostMap.set(modelKey, {
          model: row.model,
          provider: row.provider,
          totalCost: 0,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          inputCostPerToken: pricing?.inputCostPer1kTokens || 0,
          outputCostPerToken: pricing?.outputCostPer1kTokens || 0
        });
      }
      
      const modelCost = modelCostMap.get(modelKey)!;
      modelCost.totalCost += cost;
      modelCost.requests += row.requests;
      modelCost.inputTokens += row.input_tokens;
      modelCost.outputTokens += row.output_tokens;
      
      // Feature costs
      const featureKey = row.feature;
      if (!featureCostMap.has(featureKey)) {
        featureCostMap.set(featureKey, {
          feature: row.feature,
          totalCost: 0,
          requests: 0,
          averageCostPerRequest: 0,
          percentageOfTotal: 0
        });
      }
      
      const featureCost = featureCostMap.get(featureKey)!;
      featureCost.totalCost += cost;
      featureCost.requests += row.requests;
    }
    
    // Calculate averages and percentages
    const providerCosts = Array.from(providerCostMap.values()).map(provider => {
      provider.averageCostPerRequest = provider.requests > 0 ? provider.totalCost / provider.requests : 0;
      provider.averageCostPerToken = provider.tokens > 0 ? provider.totalCost / provider.tokens : 0;
      provider.models = Array.from(modelCostMap.values()).filter(model => model.provider === provider.provider);
      return provider;
    });
    
    const featureCosts = Array.from(featureCostMap.values()).map(feature => {
      feature.averageCostPerRequest = feature.requests > 0 ? feature.totalCost / feature.requests : 0;
      feature.percentageOfTotal = totalCost > 0 ? (feature.totalCost / totalCost) * 100 : 0;
      return feature;
    });
    
    const modelCosts = Array.from(modelCostMap.values());
    
    // Calculate trends
    const trends = await this.calculateCostTrends(userId, period);
    
    // Calculate projections
    const projections = this.calculateCostProjections(totalCost, period);
    
    // Get budget status
    const budgetStatus = await this.checkBudgetCompliance(userId, totalCost, period);
    
    return {
      period,
      totalCost,
      providerCosts,
      featureCosts,
      modelCosts,
      trends,
      projections,
      budgetStatus
    };
  }
  
  async optimizeCostForUser(userId: string): Promise<CostOptimization> {
    console.log(`⚡ Analyzing cost optimization opportunities for user: ${userId}`);
    
    try {
      // Get recent usage data for analysis
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      const period: CostPeriod = {
        start: thirtyDaysAgo,
        end: now,
        period: 'month'
      };
      
      const costSummary = await this.getUserCostSummary(userId, period);
      const recommendations: CostRecommendation[] = [];
      
      // Analyze model usage for optimization opportunities
      const modelOptimizations = await this.analyzeModelOptimizations(costSummary);
      recommendations.push(...modelOptimizations);
      
      // Analyze feature usage patterns
      const featureOptimizations = await this.analyzeFeatureOptimizations(costSummary);
      recommendations.push(...featureOptimizations);
      
      // Analyze provider costs
      const providerOptimizations = await this.analyzeProviderOptimizations(costSummary);
      recommendations.push(...providerOptimizations);
      
      // Analyze caching opportunities
      const cachingOptimizations = await this.analyzeCachingOptimizations(userId);
      recommendations.push(...cachingOptimizations);
      
      // Calculate total potential savings
      const totalSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
      const optimizedCost = Math.max(0, costSummary.totalCost - totalSavings);
      
      // Create implementation plan
      const implementationPlan = this.createOptimizationPlan(recommendations);
      
      return {
        currentCost: costSummary.totalCost,
        optimizedCost,
        savings: totalSavings,
        savingsPercentage: costSummary.totalCost > 0 ? (totalSavings / costSummary.totalCost) * 100 : 0,
        recommendations,
        implementationPlan
      };
    } catch (error) {
      console.error('Cost optimization analysis failed:', error);
      throw error;
    }
  }
  
  private async analyzeModelOptimizations(costSummary: CostSummary): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];
    
    // Check for expensive model usage that could be optimized
    const expensiveModels = costSummary.modelCosts
      .filter(model => model.totalCost > 10) // Models costing more than $10
      .sort((a, b) => b.totalCost - a.totalCost);
    
    for (const model of expensiveModels) {
      // Suggest cheaper alternatives
      const alternatives = this.findCheaperAlternatives(model);
      
      if (alternatives.length > 0) {
        const bestAlternative = alternatives[0];
        const potentialSavings = model.totalCost * 0.3; // Assume 30% savings
        
        recommendations.push({
          type: 'model_switch',
          title: `Switch from ${model.model} to ${bestAlternative.model}`,
          description: `Replace ${model.model} (${model.provider}) with ${bestAlternative.model} for similar performance at lower cost`,
          potentialSavings,
          savingsPercentage: 30,
          effortLevel: 'low',
          riskLevel: 'low',
          expectedImpact: 'Reduced costs with minimal performance impact',
          implementationSteps: [
            `Update model configuration to use ${bestAlternative.model}`,
            'Test performance with new model',
            'Monitor cost reduction',
            'Gradually migrate all requests'
          ]
        });
      }
    }
    
    return recommendations;
  }
  
  private findCheaperAlternatives(model: ModelCost): Array<{model: string; provider: string; cost: number}> {
    const alternatives: Array<{model: string; provider: string; cost: number}> = [];
    
    // Model replacement suggestions based on cost and capability
    const replacements = {
      'gpt-4': ['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-sonnet'],
      'claude-3-opus': ['claude-3-sonnet', 'claude-3-haiku', 'gpt-4-turbo'],
      'gpt-4-turbo': ['gpt-3.5-turbo', 'claude-3-sonnet'],
      'claude-3-sonnet': ['claude-3-haiku', 'gpt-3.5-turbo']
    };
    
    const suggestions = replacements[model.model as keyof typeof replacements] || [];
    
    suggestions.forEach(suggestedModel => {
      const pricing = Array.from(this.modelPricing.values())
        .find(p => p.model === suggestedModel);
      
      if (pricing && pricing.inputCostPer1kTokens < (model.inputCostPerToken * 1000)) {
        alternatives.push({
          model: suggestedModel,
          provider: pricing.provider,
          cost: pricing.inputCostPer1kTokens
        });
      }
    });
    
    return alternatives.sort((a, b) => a.cost - b.cost);
  }
  
  private async analyzeFeatureOptimizations(costSummary: CostSummary): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];
    
    // Find expensive features that could be optimized
    const expensiveFeatures = costSummary.featureCosts
      .filter(feature => feature.percentageOfTotal > 20) // Features using >20% of budget
      .sort((a, b) => b.totalCost - a.totalCost);
    
    for (const feature of expensiveFeatures) {
      if (feature.averageCostPerRequest > 0.01) { // Expensive per-request cost
        recommendations.push({
          type: 'feature_optimization',
          title: `Optimize ${feature.feature} feature`,
          description: `Feature accounts for ${feature.percentageOfTotal.toFixed(1)}% of total costs with high per-request cost`,
          potentialSavings: feature.totalCost * 0.25, // 25% potential savings
          savingsPercentage: 25,
          effortLevel: 'medium',
          riskLevel: 'low',
          expectedImpact: 'Reduced feature costs through optimization',
          implementationSteps: [
            'Analyze feature usage patterns',
            'Implement caching for repeated requests',
            'Optimize prompt engineering',
            'Consider batching similar requests'
          ]
        });
      }
    }
    
    return recommendations;
  }
  
  private async analyzeProviderOptimizations(costSummary: CostSummary): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];
    
    // Find if user is heavily dependent on expensive providers
    const mostExpensiveProvider = costSummary.providerCosts
      .sort((a, b) => b.averageCostPerToken - a.averageCostPerToken)[0];
    
    if (mostExpensiveProvider && mostExpensiveProvider.averageCostPerToken > 0.00003) {
      const cheaperProviders = costSummary.providerCosts
        .filter(p => p.provider !== mostExpensiveProvider.provider && 
                     p.averageCostPerToken < mostExpensiveProvider.averageCostPerToken)
        .sort((a, b) => a.averageCostPerToken - b.averageCostPerToken);
      
      if (cheaperProviders.length > 0) {
        const savings = mostExpensiveProvider.totalCost * 0.4; // 40% potential savings
        
        recommendations.push({
          type: 'provider_switch',
          title: `Diversify from ${mostExpensiveProvider.provider}`,
          description: `Consider using ${cheaperProviders[0].provider} for cost-sensitive operations`,
          potentialSavings: savings,
          savingsPercentage: 40,
          effortLevel: 'medium',
          riskLevel: 'medium',
          expectedImpact: 'Significant cost reduction through provider diversification',
          implementationSteps: [
            `Set up API keys for ${cheaperProviders[0].provider}`,
            'Test performance and quality',
            'Implement intelligent routing',
            'Monitor cost and quality metrics'
          ]
        });
      }
    }
    
    return recommendations;
  }
  
  private async analyzeCachingOptimizations(userId: string): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];
    
    // Analyze for repeated requests that could benefit from caching
    const duplicateRequests = await this.database.query(`
      SELECT 
        COUNT(*) as duplicate_count,
        SUM(estimated_cost) as wasted_cost,
        feature
      FROM api_usage_events 
      WHERE user_id = ? 
        AND created_at >= NOW() - INTERVAL '7 days'
        AND cache_hit = false
      GROUP BY feature, input_tokens, output_tokens
      HAVING COUNT(*) > 3
      ORDER BY wasted_cost DESC
      LIMIT 5
    `, [userId]);
    
    if (duplicateRequests.length > 0) {
      const totalWastedCost = duplicateRequests.reduce((sum, req) => sum + req.wasted_cost, 0);
      
      recommendations.push({
        type: 'caching',
        title: 'Implement intelligent caching',
        description: `Detected ${duplicateRequests.length} features with repeated similar requests`,
        potentialSavings: totalWastedCost * 0.8, // 80% of wasted cost could be saved
        savingsPercentage: 80,
        effortLevel: 'low',
        riskLevel: 'low',
        expectedImpact: 'Immediate cost reduction through caching',
        implementationSteps: [
          'Enable intelligent caching for repeated requests',
          'Set appropriate cache TTL based on request type',
          'Monitor cache hit rates',
          'Fine-tune caching strategies'
        ]
      });
    }
    
    return recommendations;
  }
  
  private createOptimizationPlan(recommendations: CostRecommendation[]): OptimizationPlan {
    const quickWins = recommendations.filter(r => r.effortLevel === 'low' && r.riskLevel === 'low');
    const mediumTermActions = recommendations.filter(r => r.effortLevel === 'medium' || r.riskLevel === 'medium');
    const longTermStrategies = recommendations.filter(r => r.effortLevel === 'high' || r.riskLevel === 'high');
    
    const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
    
    return {
      quickWins,
      mediumTermActions,
      longTermStrategies,
      totalPotentialSavings,
      implementationTimeline: this.generateImplementationTimeline(quickWins, mediumTermActions, longTermStrategies)
    };
  }
  
  private generateImplementationTimeline(quickWins: CostRecommendation[], mediumTerm: CostRecommendation[], longTerm: CostRecommendation[]): string {
    const phases = [];
    
    if (quickWins.length > 0) {
      phases.push(`Week 1-2: Implement ${quickWins.length} quick wins`);
    }
    
    if (mediumTerm.length > 0) {
      phases.push(`Week 3-6: Execute ${mediumTerm.length} medium-term optimizations`);
    }
    
    if (longTerm.length > 0) {
      phases.push(`Month 2-3: Plan and implement ${longTerm.length} strategic changes`);
    }
    
    return phases.join('; ');
  }
  
  async setUserBudgetLimits(userId: string, limits: BudgetLimits): Promise<void> {
    console.log(`💳 Setting budget limits for user: ${userId}`);
    
    try {
      // Set general limits
      await this.database.execute(`
        INSERT INTO user_budget_limits 
        (user_id, provider, daily_limit, monthly_limit, is_active, created_at, updated_at)
        VALUES (?, NULL, ?, ?, true, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        daily_limit = VALUES(daily_limit),
        monthly_limit = VALUES(monthly_limit),
        updated_at = NOW()
      `, [userId, limits.dailyLimit || null, limits.monthlyLimit || null]);
      
      // Set provider-specific limits
      if (limits.providerLimits) {
        for (const [provider, providerLimits] of limits.providerLimits) {
          await this.database.execute(`
            INSERT INTO user_budget_limits 
            (user_id, provider, daily_limit, monthly_limit, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, true, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
            daily_limit = VALUES(daily_limit),
            monthly_limit = VALUES(monthly_limit),
            updated_at = NOW()
          `, [userId, provider, providerLimits.dailyLimit || null, providerLimits.monthlyLimit || null]);
        }
      }
      
      this.emit('budget-limits-updated', { userId, limits });
    } catch (error) {
      console.error('Failed to set budget limits:', error);
      throw error;
    }
  }
  
  async checkBudgetCompliance(userId: string, currentCost?: number, period?: CostPeriod): Promise<BudgetStatus> {
    try {
      // Get user's budget limits
      const limits = await this.database.query(`
        SELECT daily_limit, monthly_limit 
        FROM user_budget_limits 
        WHERE user_id = ? AND provider IS NULL AND is_active = true
      `, [userId]);
      
      const userLimits = limits[0] || {};
      
      // Calculate current spending for different periods
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      
      const [dailySpend, weeklySpend, monthlySpend, yearlySpend] = await Promise.all([
        this.getCurrentSpend(userId, startOfDay, today),
        this.getCurrentSpend(userId, startOfWeek, today),
        this.getCurrentSpend(userId, startOfMonth, today),
        this.getCurrentSpend(userId, startOfYear, today)
      ]);
      
      const alerts: BudgetAlert[] = [];
      
      // Check daily limits
      const dailyStatus = this.calculateBudgetStatus(
        userLimits.daily_limit,
        dailySpend,
        dailySpend, // For daily projection, use current day's spend
        1
      );
      
      if (dailyStatus.willExceedBudget && userLimits.daily_limit) {
        alerts.push({
          type: 'projection_warning',
          severity: 'warning',
          message: `Daily spending projection (${dailyStatus.projectedSpend.toFixed(2)}) will exceed limit ($${userLimits.daily_limit})`,
          currentSpend: dailySpend,
          limit: userLimits.daily_limit,
          timeframe: 'daily'
        });
      }
      
      // Check monthly limits
      const monthlyStatus = this.calculateBudgetStatus(
        userLimits.monthly_limit,
        monthlySpend,
        this.projectMonthlySpend(monthlySpend, today),
        this.getDaysUntilEndOfMonth(today)
      );
      
      if (monthlyStatus.percentageUsed > 80 && userLimits.monthly_limit) {
        alerts.push({
          type: 'approaching_limit',
          severity: monthlyStatus.percentageUsed > 95 ? 'critical' : 'warning',
          message: `Monthly budget ${monthlyStatus.percentageUsed.toFixed(1)}% used`,
          currentSpend: monthlySpend,
          limit: userLimits.monthly_limit,
          timeframe: 'monthly'
        });
      }
      
      return {
        isWithinBudget: alerts.filter(a => a.severity === 'critical').length === 0,
        dailyStatus,
        weeklyStatus: this.calculateBudgetStatus(undefined, weeklySpend, weeklySpend * 7, 7),
        monthlyStatus,
        yearlyStatus: this.calculateBudgetStatus(undefined, yearlySpend, yearlySpend * 365, 365),
        alerts
      };
    } catch (error) {
      console.error('Budget compliance check failed:', error);
      return this.getDefaultBudgetStatus();
    }
  }
  
  private async getCurrentSpend(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.database.query(`
      SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
      FROM api_usage_events 
      WHERE user_id = ? AND created_at BETWEEN ? AND ?
    `, [userId, startDate, endDate]);
    
    return result[0]?.total_cost || 0;
  }
  
  private calculateBudgetStatus(
    limit: number | undefined,
    currentSpend: number,
    projectedSpend: number,
    daysUntilReset: number
  ): BudgetStatusDetail {
    return {
      limit,
      currentSpend,
      remainingBudget: limit ? Math.max(0, limit - currentSpend) : Infinity,
      percentageUsed: limit ? Math.min(100, (currentSpend / limit) * 100) : 0,
      projectedSpend,
      willExceedBudget: limit ? projectedSpend > limit : false,
      daysUntilReset
    };
  }
  
  private projectMonthlySpend(currentSpend: number, today: Date): number {
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyAverage = currentSpend / dayOfMonth;
    return dailyAverage * daysInMonth;
  }
  
  private getDaysUntilEndOfMonth(date: Date): number {
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return Math.ceil((endOfMonth.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  }
  
  private async calculateCostTrends(userId: string, period: CostPeriod): Promise<CostTrend[]> {
    const trends: CostTrend[] = [];
    
    try {
      // Compare with previous period
      const periodDuration = period.end.getTime() - period.start.getTime();
      const previousStart = new Date(period.start.getTime() - periodDuration);
      
      const [currentData, previousData] = await Promise.all([
        this.database.query(`
          SELECT 
            COUNT(*) as requests,
            SUM(estimated_cost) as total_cost,
            SUM(input_tokens + output_tokens) as total_tokens
          FROM api_usage_events 
          WHERE user_id = ? AND created_at BETWEEN ? AND ?
        `, [userId, period.start, period.end]),
        
        this.database.query(`
          SELECT 
            COUNT(*) as requests,
            SUM(estimated_cost) as total_cost,
            SUM(input_tokens + output_tokens) as total_tokens
          FROM api_usage_events 
          WHERE user_id = ? AND created_at BETWEEN ? AND ?
        `, [userId, previousStart, period.start])
      ]);
      
      if (currentData[0] && previousData[0]) {
        const current = currentData[0];
        const previous = previousData[0];
        
        // Calculate cost trends
        const totalCostChange = this.calculateTrendChange(current.total_cost, previous.total_cost);
        trends.push({
          metric: 'total_cost',
          trend: totalCostChange.trend,
          changePercentage: totalCostChange.percentage,
          period: period.period
        });
        
        const costPerRequestChange = this.calculateTrendChange(
          current.requests > 0 ? current.total_cost / current.requests : 0,
          previous.requests > 0 ? previous.total_cost / previous.requests : 0
        );
        trends.push({
          metric: 'cost_per_request',
          trend: costPerRequestChange.trend,
          changePercentage: costPerRequestChange.percentage,
          period: period.period
        });
        
        const costPerTokenChange = this.calculateTrendChange(
          current.total_tokens > 0 ? current.total_cost / current.total_tokens : 0,
          previous.total_tokens > 0 ? previous.total_cost / previous.total_tokens : 0
        );
        trends.push({
          metric: 'cost_per_token',
          trend: costPerTokenChange.trend,
          changePercentage: costPerTokenChange.percentage,
          period: period.period
        });
      }
    } catch (error) {
      console.error('Error calculating cost trends:', error);
    }
    
    return trends;
  }
  
  private calculateTrendChange(current: number, previous: number): { trend: 'increasing' | 'decreasing' | 'stable'; percentage: number } {
    if (previous === 0) {
      return { trend: 'stable', percentage: 0 };
    }
    
    const changePercentage = ((current - previous) / previous) * 100;
    
    if (Math.abs(changePercentage) < 5) {
      return { trend: 'stable', percentage: Math.abs(changePercentage) };
    } else if (changePercentage > 0) {
      return { trend: 'increasing', percentage: changePercentage };
    } else {
      return { trend: 'decreasing', percentage: Math.abs(changePercentage) };
    }
  }
  
  private calculateCostProjections(totalCost: number, period: CostPeriod): CostProjection {
    const periodDays = (period.end.getTime() - period.start.getTime()) / (24 * 60 * 60 * 1000);
    const dailyAverage = totalCost / periodDays;
    
    const confidence = Math.min(periodDays / 7, 1); // Full confidence with 7+ days of data
    
    return {
      dailyProjection: dailyAverage,
      weeklyProjection: dailyAverage * 7,
      monthlyProjection: dailyAverage * 30,
      yearlyProjection: dailyAverage * 365,
      confidence,
      basedOnDays: periodDays
    };
  }
  
  private getDefaultBudgetStatus(): BudgetStatus {
    const defaultStatus: BudgetStatusDetail = {
      currentSpend: 0,
      remainingBudget: Infinity,
      percentageUsed: 0,
      projectedSpend: 0,
      willExceedBudget: false,
      daysUntilReset: 1
    };
    
    return {
      isWithinBudget: true,
      dailyStatus: defaultStatus,
      weeklyStatus: defaultStatus,
      monthlyStatus: defaultStatus,
      yearlyStatus: defaultStatus,
      alerts: []
    };
  }
  
  // Public utility methods
  
  async updateModelPricing(provider: string, model: string, pricing: Partial<ModelPricing>): Promise<void> {
    const key = `${provider}:${model}`;
    const existing = this.modelPricing.get(key) || {
      provider,
      model,
      inputCostPer1kTokens: 0,
      outputCostPer1kTokens: 0,
      requestCost: 0,
      lastUpdated: new Date()
    };
    
    this.modelPricing.set(key, {
      ...existing,
      ...pricing,
      lastUpdated: new Date()
    });
    
    console.log(`💰 Updated pricing for ${key}`);
  }
  
  getModelPricing(provider: string, model: string): ModelPricing | undefined {
    return this.modelPricing.get(`${provider}:${model}`);
  }
  
  getAllModelPricing(): Map<string, ModelPricing> {
    return new Map(this.modelPricing);
  }
  
  clearCostCache(): void {
    this.costCache.clear();
  }
}

interface ModelPricing {
  provider: string;
  model: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  requestCost: number;
  lastUpdated: Date;
}

// Export convenience function
export function createCostManager(database: Database): CostManager {
  return new CostManager(database);
}