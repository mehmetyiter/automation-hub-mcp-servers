import { EventEmitter } from 'events';

export interface APIUsageEvent {
  userId: string;
  provider: string;
  model: string;
  operation: 'generation' | 'analysis' | 'validation' | 'optimization';
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  executionTime: number;
  requestId: string;
  timestamp: Date;
  metadata: {
    feature: string;
    complexity: 'simple' | 'moderate' | 'complex';
    cacheHit: boolean;
  };
}

export interface UsagePeriod {
  start: Date;
  end: Date;
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export interface UsageStats {
  period: UsagePeriod;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  providerBreakdown: ProviderUsage[];
  featureBreakdown: FeatureUsage[];
  trends: UsageTrend[];
  projectedMonthlyUsage: ProjectedUsage;
}

export interface ProviderUsage {
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
  models: ModelUsage[];
  averageResponseTime: number;
}

export interface ModelUsage {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  averageResponseTime: number;
}

export interface FeatureUsage {
  feature: string;
  requests: number;
  cost: number;
  successRate: number;
  averageComplexity: string;
}

export interface UsageTrend {
  metric: 'requests' | 'tokens' | 'cost' | 'response_time';
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  period: string;
}

export interface ProjectedUsage {
  requests: number;
  tokens: number;
  cost: number;
  confidence: number;
  basedOnDays: number;
}

export interface UsageAnomaly {
  type: 'spike' | 'drop' | 'unusual_pattern';
  metric: string;
  value: number;
  expectedValue: number;
  deviationPercentage: number;
  timestamp: Date;
  confidence: number;
}

export interface LimitEnforcement {
  enforced: boolean;
  limitType: 'daily' | 'monthly' | 'rate';
  currentUsage: number;
  limit: number;
  remainingQuota: number;
  resetTime?: Date;
}

export interface Database {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: any }>;
}

export interface AlertingService {
  sendAlert(type: string, message: string, metadata?: any): Promise<void>;
}

export interface AnalyticsService {
  track(event: string, properties: any): Promise<void>;
  identify(userId: string, traits: any): Promise<void>;
}

export class UsageTracker extends EventEmitter {
  private realtimeUsage = new Map<string, UsageStats>();
  private usageBuffer: APIUsageEvent[] = [];
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  
  constructor(
    private database: Database,
    private analytics: AnalyticsService,
    private alerting: AlertingService
  ) {
    super();
    this.startPeriodicFlush();
  }
  
  async trackAPIUsage(usage: APIUsageEvent): Promise<void> {
    console.log(`📊 Tracking API usage: ${usage.provider}/${usage.model} for user ${usage.userId}`);
    
    try {
      // Add to buffer for batch processing
      this.usageBuffer.push(usage);
      
      // Update real-time usage
      await this.updateRealtimeUsage(usage);
      
      // Check for anomalies
      const anomalies = await this.detectAnomalousUsage(usage.userId);
      if (anomalies.length > 0) {
        this.handleAnomalies(usage.userId, anomalies);
      }
      
      // Enforce usage limits
      const limitStatus = await this.enforceUsageLimits(usage.userId, usage.provider);
      if (limitStatus.enforced) {
        console.warn(`⚠️ Usage limit enforced for user ${usage.userId}`);
        this.emit('limit-enforced', { userId: usage.userId, limitStatus });
      }
      
      // Send analytics event
      await this.analytics.track('api_usage', {
        userId: usage.userId,
        provider: usage.provider,
        model: usage.model,
        operation: usage.operation,
        tokens: usage.inputTokens + usage.outputTokens,
        cost: usage.estimatedCost,
        feature: usage.metadata.feature
      });
      
      // Flush buffer if full
      if (this.usageBuffer.length >= this.bufferSize) {
        await this.flushUsageBuffer();
      }
      
      this.emit('usage-tracked', usage);
    } catch (error) {
      console.error('Failed to track API usage:', error);
      this.emit('tracking-error', { usage, error });
    }
  }
  
  private async updateRealtimeUsage(usage: APIUsageEvent): Promise<void> {
    const cacheKey = `${usage.userId}:${this.getCurrentHour()}`;
    
    let stats = this.realtimeUsage.get(cacheKey);
    if (!stats) {
      stats = {
        period: {
          start: new Date(),
          end: new Date(Date.now() + 3600000), // 1 hour
          period: 'hour'
        },
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        providerBreakdown: [],
        featureBreakdown: [],
        trends: [],
        projectedMonthlyUsage: {
          requests: 0,
          tokens: 0,
          cost: 0,
          confidence: 0,
          basedOnDays: 0
        }
      };
    }
    
    // Update stats
    stats.totalRequests++;
    stats.totalTokens += usage.inputTokens + usage.outputTokens;
    stats.totalCost += usage.estimatedCost;
    
    // Update provider breakdown
    this.updateProviderBreakdown(stats, usage);
    
    // Update feature breakdown
    this.updateFeatureBreakdown(stats, usage);
    
    this.realtimeUsage.set(cacheKey, stats);
  }
  
  private updateProviderBreakdown(stats: UsageStats, usage: APIUsageEvent): void {
    let providerUsage = stats.providerBreakdown.find(p => p.provider === usage.provider);
    
    if (!providerUsage) {
      providerUsage = {
        provider: usage.provider,
        requests: 0,
        tokens: 0,
        cost: 0,
        models: [],
        averageResponseTime: 0
      };
      stats.providerBreakdown.push(providerUsage);
    }
    
    providerUsage.requests++;
    providerUsage.tokens += usage.inputTokens + usage.outputTokens;
    providerUsage.cost += usage.estimatedCost;
    providerUsage.averageResponseTime = 
      (providerUsage.averageResponseTime * (providerUsage.requests - 1) + usage.executionTime) / 
      providerUsage.requests;
    
    // Update model usage
    let modelUsage = providerUsage.models.find(m => m.model === usage.model);
    if (!modelUsage) {
      modelUsage = {
        model: usage.model,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        averageResponseTime: 0
      };
      providerUsage.models.push(modelUsage);
    }
    
    modelUsage.requests++;
    modelUsage.inputTokens += usage.inputTokens;
    modelUsage.outputTokens += usage.outputTokens;
    modelUsage.cost += usage.estimatedCost;
    modelUsage.averageResponseTime = 
      (modelUsage.averageResponseTime * (modelUsage.requests - 1) + usage.executionTime) / 
      modelUsage.requests;
  }
  
  private updateFeatureBreakdown(stats: UsageStats, usage: APIUsageEvent): void {
    let featureUsage = stats.featureBreakdown.find(f => f.feature === usage.metadata.feature);
    
    if (!featureUsage) {
      featureUsage = {
        feature: usage.metadata.feature,
        requests: 0,
        cost: 0,
        successRate: 1.0,
        averageComplexity: usage.metadata.complexity
      };
      stats.featureBreakdown.push(featureUsage);
    }
    
    featureUsage.requests++;
    featureUsage.cost += usage.estimatedCost;
    
    // Update average complexity (simplified)
    const complexityWeights = { simple: 1, moderate: 2, complex: 3 };
    const currentWeight = complexityWeights[featureUsage.averageComplexity as keyof typeof complexityWeights] || 2;
    const newWeight = complexityWeights[usage.metadata.complexity];
    const avgWeight = (currentWeight * (featureUsage.requests - 1) + newWeight) / featureUsage.requests;
    
    if (avgWeight <= 1.5) featureUsage.averageComplexity = 'simple';
    else if (avgWeight <= 2.5) featureUsage.averageComplexity = 'moderate';
    else featureUsage.averageComplexity = 'complex';
  }
  
  async getUserUsageStats(userId: string, period: UsagePeriod): Promise<UsageStats> {
    console.log(`📈 Getting usage stats for user: ${userId}, period: ${period.period}`);
    
    try {
      // Query database for historical data
      const usageData = await this.database.query(`
        SELECT 
          provider,
          model,
          operation,
          feature,
          complexity,
          COUNT(*) as requests,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(estimated_cost) as cost,
          AVG(execution_time) as avg_response_time
        FROM api_usage_events 
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY provider, model, operation, feature, complexity
      `, [userId, period.start, period.end]);
      
      const stats: UsageStats = {
        period,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        providerBreakdown: [],
        featureBreakdown: [],
        trends: [],
        projectedMonthlyUsage: {
          requests: 0,
          tokens: 0,
          cost: 0,
          confidence: 0,
          basedOnDays: 0
        }
      };
      
      // Process usage data
      const providerMap = new Map<string, ProviderUsage>();
      const featureMap = new Map<string, FeatureUsage>();
      
      for (const row of usageData) {
        stats.totalRequests += row.requests;
        stats.totalTokens += row.input_tokens + row.output_tokens;
        stats.totalCost += row.cost;
        
        // Provider breakdown
        if (!providerMap.has(row.provider)) {
          providerMap.set(row.provider, {
            provider: row.provider,
            requests: 0,
            tokens: 0,
            cost: 0,
            models: [],
            averageResponseTime: 0
          });
        }
        
        const providerUsage = providerMap.get(row.provider)!;
        providerUsage.requests += row.requests;
        providerUsage.tokens += row.input_tokens + row.output_tokens;
        providerUsage.cost += row.cost;
        
        // Feature breakdown
        if (!featureMap.has(row.feature)) {
          featureMap.set(row.feature, {
            feature: row.feature,
            requests: 0,
            cost: 0,
            successRate: 1.0,
            averageComplexity: row.complexity
          });
        }
        
        const featureUsage = featureMap.get(row.feature)!;
        featureUsage.requests += row.requests;
        featureUsage.cost += row.cost;
      }
      
      stats.providerBreakdown = Array.from(providerMap.values());
      stats.featureBreakdown = Array.from(featureMap.values());
      
      // Calculate trends
      stats.trends = await this.calculateUsageTrends(userId, period);
      
      // Calculate monthly projection
      stats.projectedMonthlyUsage = this.calculateMonthlyProjection(stats, period);
      
      return stats;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }
  
  async getProviderUsageBreakdown(userId: string, provider: string): Promise<ProviderUsage> {
    const results = await this.database.query(`
      SELECT 
        model,
        COUNT(*) as requests,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(estimated_cost) as cost,
        AVG(execution_time) as avg_response_time
      FROM api_usage_events 
      WHERE user_id = ? AND provider = ? AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY model
    `, [userId, provider]);
    
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalResponseTime = 0;
    
    const models: ModelUsage[] = results.map(row => {
      totalRequests += row.requests;
      totalTokens += row.input_tokens + row.output_tokens;
      totalCost += row.cost;
      totalResponseTime += row.avg_response_time * row.requests;
      
      return {
        model: row.model,
        requests: row.requests,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cost: row.cost,
        averageResponseTime: row.avg_response_time
      };
    });
    
    return {
      provider,
      requests: totalRequests,
      tokens: totalTokens,
      cost: totalCost,
      models,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0
    };
  }
  
  async detectAnomalousUsage(userId: string): Promise<UsageAnomaly[]> {
    const anomalies: UsageAnomaly[] = [];
    
    try {
      // Get recent usage patterns
      const recentUsage = await this.database.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as requests,
          SUM(estimated_cost) as cost,
          AVG(execution_time) as avg_response_time
        FROM api_usage_events 
        WHERE user_id = ? AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [userId]);
      
      if (recentUsage.length < 7) {
        return anomalies; // Need at least a week of data
      }
      
      // Calculate baselines
      const requestBaseline = this.calculateBaseline(recentUsage, 'requests');
      const costBaseline = this.calculateBaseline(recentUsage, 'cost');
      const responseTimeBaseline = this.calculateBaseline(recentUsage, 'avg_response_time');
      
      // Check today's usage
      const today = recentUsage[0];
      
      // Check for request spike
      if (today.requests > requestBaseline.mean + 2 * requestBaseline.stdDev) {
        anomalies.push({
          type: 'spike',
          metric: 'requests',
          value: today.requests,
          expectedValue: requestBaseline.mean,
          deviationPercentage: ((today.requests - requestBaseline.mean) / requestBaseline.mean) * 100,
          timestamp: new Date(),
          confidence: 0.8
        });
      }
      
      // Check for cost spike
      if (today.cost > costBaseline.mean + 2 * costBaseline.stdDev) {
        anomalies.push({
          type: 'spike',
          metric: 'cost',
          value: today.cost,
          expectedValue: costBaseline.mean,
          deviationPercentage: ((today.cost - costBaseline.mean) / costBaseline.mean) * 100,
          timestamp: new Date(),
          confidence: 0.85
        });
      }
      
      // Check for response time anomaly
      if (today.avg_response_time > responseTimeBaseline.mean + 2 * responseTimeBaseline.stdDev) {
        anomalies.push({
          type: 'spike',
          metric: 'response_time',
          value: today.avg_response_time,
          expectedValue: responseTimeBaseline.mean,
          deviationPercentage: ((today.avg_response_time - responseTimeBaseline.mean) / responseTimeBaseline.mean) * 100,
          timestamp: new Date(),
          confidence: 0.75
        });
      }
      
    } catch (error) {
      console.error('Error detecting anomalous usage:', error);
    }
    
    return anomalies;
  }
  
  private calculateBaseline(data: any[], metric: string): { mean: number; stdDev: number } {
    const values = data.map(item => item[metric]);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return { mean, stdDev };
  }
  
  async enforceUsageLimits(userId: string, provider: string): Promise<LimitEnforcement> {
    try {
      // Get user's limits
      const limits = await this.database.query(`
        SELECT daily_limit, monthly_limit, requests_per_minute, requests_per_day
        FROM user_budget_limits 
        WHERE user_id = ? AND (provider = ? OR provider IS NULL) AND is_active = true
        ORDER BY provider NULLS LAST
        LIMIT 1
      `, [userId, provider]);
      
      if (limits.length === 0) {
        return { enforced: false, limitType: 'daily', currentUsage: 0, limit: 0, remainingQuota: 0 };
      }
      
      const limit = limits[0];
      
      // Check daily spending limit
      if (limit.daily_limit) {
        const todayUsage = await this.database.query(`
          SELECT COALESCE(SUM(estimated_cost), 0) as cost
          FROM api_usage_events 
          WHERE user_id = ? AND provider = ? AND DATE(created_at) = CURDATE()
        `, [userId, provider]);
        
        const currentCost = todayUsage[0].cost;
        if (currentCost >= limit.daily_limit) {
          return {
            enforced: true,
            limitType: 'daily',
            currentUsage: currentCost,
            limit: limit.daily_limit,
            remainingQuota: 0,
            resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
          };
        }
      }
      
      // Check monthly spending limit
      if (limit.monthly_limit) {
        const monthUsage = await this.database.query(`
          SELECT COALESCE(SUM(estimated_cost), 0) as cost
          FROM api_usage_events 
          WHERE user_id = ? AND provider = ? 
            AND YEAR(created_at) = YEAR(NOW()) 
            AND MONTH(created_at) = MONTH(NOW())
        `, [userId, provider]);
        
        const currentCost = monthUsage[0].cost;
        if (currentCost >= limit.monthly_limit) {
          return {
            enforced: true,
            limitType: 'monthly',
            currentUsage: currentCost,
            limit: limit.monthly_limit,
            remainingQuota: 0,
            resetTime: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // Next month
          };
        }
      }
      
      return { enforced: false, limitType: 'daily', currentUsage: 0, limit: 0, remainingQuota: 0 };
    } catch (error) {
      console.error('Error enforcing usage limits:', error);
      return { enforced: false, limitType: 'daily', currentUsage: 0, limit: 0, remainingQuota: 0 };
    }
  }
  
  private async calculateUsageTrends(userId: string, period: UsagePeriod): Promise<UsageTrend[]> {
    const trends: UsageTrend[] = [];
    
    try {
      // Compare with previous period
      const periodDuration = period.end.getTime() - period.start.getTime();
      const previousStart = new Date(period.start.getTime() - periodDuration);
      const previousEnd = period.start;
      
      const [currentPeriod, previousPeriod] = await Promise.all([
        this.database.query(`
          SELECT 
            COUNT(*) as requests,
            SUM(input_tokens + output_tokens) as tokens,
            SUM(estimated_cost) as cost,
            AVG(execution_time) as avg_response_time
          FROM api_usage_events 
          WHERE user_id = ? AND created_at BETWEEN ? AND ?
        `, [userId, period.start, period.end]),
        
        this.database.query(`
          SELECT 
            COUNT(*) as requests,
            SUM(input_tokens + output_tokens) as tokens,
            SUM(estimated_cost) as cost,
            AVG(execution_time) as avg_response_time
          FROM api_usage_events 
          WHERE user_id = ? AND created_at BETWEEN ? AND ?
        `, [userId, previousStart, previousEnd])
      ]);
      
      if (currentPeriod[0] && previousPeriod[0]) {
        const current = currentPeriod[0];
        const previous = previousPeriod[0];
        
        // Calculate trends
        const metrics = ['requests', 'tokens', 'cost', 'response_time'];
        const mappings = {
          requests: 'requests',
          tokens: 'tokens', 
          cost: 'cost',
          response_time: 'avg_response_time'
        };
        
        for (const metric of metrics) {
          const currentValue = current[mappings[metric as keyof typeof mappings]] || 0;
          const previousValue = previous[mappings[metric as keyof typeof mappings]] || 0;
          
          if (previousValue > 0) {
            const changePercentage = ((currentValue - previousValue) / previousValue) * 100;
            let trend: 'increasing' | 'decreasing' | 'stable';
            
            if (Math.abs(changePercentage) < 5) {
              trend = 'stable';
            } else if (changePercentage > 0) {
              trend = 'increasing';
            } else {
              trend = 'decreasing';
            }
            
            trends.push({
              metric: metric as any,
              trend,
              changePercentage: Math.abs(changePercentage),
              period: period.period
            });
          }
        }
      }
    } catch (error) {
      console.error('Error calculating usage trends:', error);
    }
    
    return trends;
  }
  
  private calculateMonthlyProjection(stats: UsageStats, period: UsagePeriod): ProjectedUsage {
    const periodDays = (period.end.getTime() - period.start.getTime()) / (24 * 60 * 60 * 1000);
    const daysInMonth = 30;
    
    if (periodDays < 1) {
      return {
        requests: 0,
        tokens: 0,
        cost: 0,
        confidence: 0,
        basedOnDays: 0
      };
    }
    
    const dailyAverage = {
      requests: stats.totalRequests / periodDays,
      tokens: stats.totalTokens / periodDays,
      cost: stats.totalCost / periodDays
    };
    
    // Confidence decreases with shorter periods
    const confidence = Math.min(periodDays / 7, 1); // Full confidence with 7+ days
    
    return {
      requests: Math.round(dailyAverage.requests * daysInMonth),
      tokens: Math.round(dailyAverage.tokens * daysInMonth),
      cost: Math.round(dailyAverage.cost * daysInMonth * 100) / 100,
      confidence,
      basedOnDays: periodDays
    };
  }
  
  private handleAnomalies(userId: string, anomalies: UsageAnomaly[]): void {
    for (const anomaly of anomalies) {
      if (anomaly.confidence > 0.8) {
        this.alerting.sendAlert('usage_anomaly', 
          `Usage ${anomaly.type} detected for user ${userId}: ${anomaly.metric} = ${anomaly.value} (expected: ${anomaly.expectedValue})`,
          { userId, anomaly }
        );
      }
    }
    
    this.emit('anomalies-detected', { userId, anomalies });
  }
  
  private async flushUsageBuffer(): Promise<void> {
    if (this.usageBuffer.length === 0) return;
    
    console.log(`💾 Flushing ${this.usageBuffer.length} usage events to database`);
    
    try {
      // Batch insert to database
      const values = this.usageBuffer.map(usage => [
        usage.userId,
        usage.provider,
        usage.model,
        usage.operation,
        usage.inputTokens,
        usage.outputTokens,
        usage.estimatedCost,
        usage.executionTime,
        usage.requestId,
        usage.metadata.feature,
        usage.metadata.complexity,
        usage.metadata.cacheHit,
        usage.timestamp
      ]);
      
      await this.database.execute(`
        INSERT INTO api_usage_events 
        (user_id, provider, model, operation, input_tokens, output_tokens, estimated_cost, 
         execution_time, request_id, feature, complexity, cache_hit, created_at)
        VALUES ${values.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(', ')}
      `, values.flat());
      
      // Clear buffer
      this.usageBuffer = [];
      
      this.emit('buffer-flushed', { eventsCount: values.length });
    } catch (error) {
      console.error('Failed to flush usage buffer:', error);
      this.emit('flush-error', error);
    }
  }
  
  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flushUsageBuffer();
    }, this.flushInterval);
  }
  
  private getCurrentHour(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  }
  
  // Public utility methods
  
  async getUserDailyUsage(userId: string): Promise<any> {
    const results = await this.database.query(`
      SELECT 
        provider,
        COUNT(*) as requests,
        SUM(estimated_cost) as cost
      FROM api_usage_events 
      WHERE user_id = ? AND DATE(created_at) = CURDATE()
      GROUP BY provider
    `, [userId]);
    
    return results;
  }
  
  async getTopUsersToday(limit: number = 10): Promise<any[]> {
    const results = await this.database.query(`
      SELECT 
        user_id,
        COUNT(*) as requests,
        SUM(estimated_cost) as cost
      FROM api_usage_events 
      WHERE DATE(created_at) = CURDATE()
      GROUP BY user_id
      ORDER BY cost DESC
      LIMIT ?
    `, [limit]);
    
    return results;
  }
  
  async cleanup(): Promise<void> {
    await this.flushUsageBuffer();
  }
}

// Export convenience function
export function createUsageTracker(
  database: Database,
  analytics: AnalyticsService,
  alerting: AlertingService
): UsageTracker {
  return new UsageTracker(database, analytics, alerting);
}