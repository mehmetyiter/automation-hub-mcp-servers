import { EventEmitter } from 'events';
import { Database } from '../database/connection-pool-manager.js';

export interface BudgetConfig {
  id: string;
  userId: string;
  provider?: string; // null for global budget
  budgetType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  budgetAmount: number;
  alertThresholds: number[]; // percentages [50, 75, 90, 95]
  autoStopAtLimit: boolean;
  rolloverUnused: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetUsage {
  id: string;
  budgetConfigId: string;
  periodStart: Date;
  periodEnd: Date;
  currentSpend: number;
  requestCount: number;
  lastUpdated: Date;
}

export interface BudgetAlert {
  id: string;
  budgetConfigId: string;
  alertType: string;
  thresholdPercentage: number;
  currentSpend: number;
  budgetAmount: number;
  message: string;
  sentAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

export interface BudgetStatus {
  configId: string;
  userId: string;
  provider?: string;
  budgetType: string;
  budgetAmount: number;
  currentSpend: number;
  requestCount: number;
  utilizationPercentage: number;
  status: 'low' | 'moderate' | 'warning' | 'critical';
  remainingBudget: number;
  projectedOverspend?: number;
  timeRemaining: string;
}

export interface BudgetRecommendation {
  type: 'increase' | 'decrease' | 'optimize' | 'redistribute';
  title: string;
  description: string;
  currentBudget: number;
  recommendedBudget: number;
  reasoning: string[];
  confidence: number;
}

export class BudgetManager extends EventEmitter {
  private database: Database;
  private alertQueue: Map<string, Date>;
  private budgetCache: Map<string, BudgetConfig>;

  constructor(database: Database) {
    super();
    this.database = database;
    this.alertQueue = new Map();
    this.budgetCache = new Map();
    this.initializeBudgetManager();
  }

  private initializeBudgetManager(): void {
    // Set up periodic budget checks
    setInterval(() => this.checkAllBudgets(), 60000); // Every minute
    
    // Set up budget period rollovers
    setInterval(() => this.rolloverBudgetPeriods(), 3600000); // Every hour
  }

  async createBudgetConfig(config: Omit<BudgetConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<BudgetConfig> {
    const query = `
      INSERT INTO user_budget_configs (
        user_id, provider, budget_type, budget_amount, 
        alert_thresholds, auto_stop_at_limit, rollover_unused, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await this.database.query(query, [
      config.userId,
      config.provider,
      config.budgetType,
      config.budgetAmount,
      JSON.stringify(config.alertThresholds),
      config.autoStopAtLimit,
      config.rolloverUnused,
      config.isActive
    ]);

    const budgetConfig = this.mapToBudgetConfig(result[0]);
    this.budgetCache.set(budgetConfig.id, budgetConfig);
    
    // Create initial budget usage record
    await this.createBudgetUsageRecord(budgetConfig);
    
    this.emit('budget-created', budgetConfig);
    return budgetConfig;
  }

  async updateBudgetConfig(
    configId: string, 
    updates: Partial<BudgetConfig>
  ): Promise<BudgetConfig> {
    const allowedUpdates = ['budget_amount', 'alert_thresholds', 'auto_stop_at_limit', 'rollover_unused', 'is_active'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = this.camelToSnake(key);
      if (allowedUpdates.includes(dbKey)) {
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(key === 'alertThresholds' ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    values.push(configId);

    const query = `
      UPDATE user_budget_configs 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.database.query(query, values);
    const budgetConfig = this.mapToBudgetConfig(result[0]);
    this.budgetCache.set(budgetConfig.id, budgetConfig);
    
    this.emit('budget-updated', budgetConfig);
    return budgetConfig;
  }

  async getBudgetStatus(userId: string, provider?: string): Promise<BudgetStatus[]> {
    const query = `
      SELECT * FROM v_budget_status
      WHERE user_id = $1 ${provider ? 'AND provider = $2' : ''}
    `;

    const params = provider ? [userId, provider] : [userId];
    const results = await this.database.query(query, params);

    return results.map(row => ({
      configId: row.budget_config_id,
      userId: row.user_id,
      provider: row.provider,
      budgetType: row.budget_type,
      budgetAmount: parseFloat(row.budget_amount),
      currentSpend: parseFloat(row.current_spend),
      requestCount: parseInt(row.request_count),
      utilizationPercentage: parseFloat(row.utilization_percentage),
      status: row.status,
      remainingBudget: parseFloat(row.budget_amount) - parseFloat(row.current_spend),
      projectedOverspend: this.calculateProjectedOverspend(row),
      timeRemaining: this.calculateTimeRemaining(row.budget_type)
    }));
  }

  async trackUsage(
    userId: string, 
    provider: string, 
    cost: number
  ): Promise<void> {
    // Get all active budget configs for this user
    const configs = await this.getUserBudgetConfigs(userId, provider);
    
    for (const config of configs) {
      await this.updateBudgetUsage(config.id, cost);
      
      // Check if we need to send alerts
      const status = await this.getBudgetStatusByConfigId(config.id);
      await this.checkAndSendAlerts(config, status);
      
      // Check auto-stop
      if (config.autoStopAtLimit && status.utilizationPercentage >= 100) {
        await this.handleBudgetExceeded(userId, config, status);
      }
    }
  }

  async checkAndSendAlerts(
    config: BudgetConfig, 
    status: BudgetStatus
  ): Promise<void> {
    for (const threshold of config.alertThresholds) {
      if (status.utilizationPercentage >= threshold) {
        const alertKey = `${config.id}_${threshold}`;
        const lastAlert = this.alertQueue.get(alertKey);
        
        // Don't send duplicate alerts within 24 hours
        if (!lastAlert || Date.now() - lastAlert.getTime() > 86400000) {
          await this.sendBudgetAlert(config, status, threshold);
          this.alertQueue.set(alertKey, new Date());
        }
      }
    }
  }

  private async sendBudgetAlert(
    config: BudgetConfig,
    status: BudgetStatus,
    threshold: number
  ): Promise<void> {
    const alert: Omit<BudgetAlert, 'id' | 'sentAt'> = {
      budgetConfigId: config.id,
      alertType: this.getAlertType(threshold),
      thresholdPercentage: threshold,
      currentSpend: status.currentSpend,
      budgetAmount: status.budgetAmount,
      message: this.generateAlertMessage(config, status, threshold),
      acknowledged: false
    };

    const query = `
      INSERT INTO budget_alerts (
        budget_config_id, alert_type, threshold_percentage,
        current_spend, budget_amount, message
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    await this.database.query(query, [
      alert.budgetConfigId,
      alert.alertType,
      alert.thresholdPercentage,
      alert.currentSpend,
      alert.budgetAmount,
      alert.message
    ]);

    this.emit('budget-alert', {
      userId: config.userId,
      alert,
      status
    });
  }

  async generateBudgetRecommendations(userId: string): Promise<BudgetRecommendation[]> {
    const recommendations: BudgetRecommendation[] = [];
    
    // Get historical usage data
    const usageHistory = await this.getUserUsageHistory(userId, 90); // Last 90 days
    const budgetConfigs = await this.getAllUserBudgetConfigs(userId);
    
    for (const config of budgetConfigs) {
      const analysis = this.analyzeBudgetEfficiency(config, usageHistory);
      
      if (analysis.recommendation) {
        recommendations.push(analysis.recommendation);
      }
    }

    // Global recommendations
    const globalRecommendation = this.analyzeGlobalBudgetNeeds(usageHistory, budgetConfigs);
    if (globalRecommendation) {
      recommendations.push(globalRecommendation);
    }

    return recommendations;
  }

  private analyzeBudgetEfficiency(
    config: BudgetConfig,
    history: any[]
  ): { efficiency: number; recommendation?: BudgetRecommendation } {
    const relevantHistory = history.filter(h => 
      !config.provider || h.provider === config.provider
    );

    const avgSpend = this.calculateAverageSpend(relevantHistory, config.budgetType);
    const efficiency = avgSpend / config.budgetAmount;

    let recommendation: BudgetRecommendation | undefined;

    if (efficiency < 0.5) {
      // Underutilized budget
      recommendation = {
        type: 'decrease',
        title: `Optimize ${config.budgetType} budget${config.provider ? ` for ${config.provider}` : ''}`,
        description: `Your average spend is only ${(efficiency * 100).toFixed(1)}% of your budget`,
        currentBudget: config.budgetAmount,
        recommendedBudget: Math.ceil(avgSpend * 1.2), // 20% buffer
        reasoning: [
          'Historical usage shows consistent underspending',
          'Reducing budget can help with better allocation',
          'Maintains 20% safety buffer above average usage'
        ],
        confidence: 0.85
      };
    } else if (efficiency > 0.9) {
      // Near or over budget
      recommendation = {
        type: 'increase',
        title: `Increase ${config.budgetType} budget${config.provider ? ` for ${config.provider}` : ''}`,
        description: `You're consistently using ${(efficiency * 100).toFixed(1)}% of your budget`,
        currentBudget: config.budgetAmount,
        recommendedBudget: Math.ceil(avgSpend * 1.3), // 30% buffer
        reasoning: [
          'Current budget is too restrictive',
          'Risk of hitting limits and service interruption',
          'Increased budget provides operational flexibility'
        ],
        confidence: 0.9
      };
    }

    return { efficiency, recommendation };
  }

  private async createBudgetUsageRecord(config: BudgetConfig): Promise<void> {
    const { periodStart, periodEnd } = this.getBudgetPeriod(config.budgetType);
    
    const query = `
      INSERT INTO budget_usage (
        budget_config_id, period_start, period_end, 
        current_spend, request_count
      ) VALUES ($1, $2, $3, 0, 0)
      ON CONFLICT (budget_config_id, period_start) DO NOTHING
    `;

    await this.database.query(query, [config.id, periodStart, periodEnd]);
  }

  private async updateBudgetUsage(configId: string, cost: number): Promise<void> {
    const query = `
      UPDATE budget_usage
      SET current_spend = current_spend + $1,
          request_count = request_count + 1,
          last_updated = NOW()
      WHERE budget_config_id = $2
        AND period_start <= CURRENT_DATE
        AND period_end >= CURRENT_DATE
    `;

    await this.database.query(query, [cost, configId]);
  }

  private async checkAllBudgets(): Promise<void> {
    try {
      const activeConfigs = await this.getAllActiveBudgetConfigs();
      
      for (const config of activeConfigs) {
        const status = await this.getBudgetStatusByConfigId(config.id);
        await this.checkAndSendAlerts(config, status);
      }
    } catch (error) {
      console.error('Error checking budgets:', error);
    }
  }

  private async rolloverBudgetPeriods(): Promise<void> {
    try {
      const configs = await this.getConfigsNeedingRollover();
      
      for (const config of configs) {
        await this.performBudgetRollover(config);
      }
    } catch (error) {
      console.error('Error rolling over budget periods:', error);
    }
  }

  private getBudgetPeriod(budgetType: string): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (budgetType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);
        periodEnd.setMilliseconds(periodEnd.getMilliseconds() - 1);
        break;
      
      case 'weekly':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - dayOfWeek);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 7);
        periodEnd.setMilliseconds(periodEnd.getMilliseconds() - 1);
        break;
      
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      
      default:
        throw new Error(`Invalid budget type: ${budgetType}`);
    }

    return { periodStart, periodEnd };
  }

  // Helper methods
  private mapToBudgetConfig(row: any): BudgetConfig {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      budgetType: row.budget_type,
      budgetAmount: parseFloat(row.budget_amount),
      alertThresholds: row.alert_thresholds,
      autoStopAtLimit: row.auto_stop_at_limit,
      rolloverUnused: row.rollover_unused,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private calculateProjectedOverspend(row: any): number | undefined {
    // Simplified projection - would be more sophisticated in production
    const utilizationRate = parseFloat(row.utilization_percentage) / 100;
    if (utilizationRate <= 1) return undefined;
    
    return parseFloat(row.current_spend) - parseFloat(row.budget_amount);
  }

  private calculateTimeRemaining(budgetType: string): string {
    const { periodEnd } = this.getBudgetPeriod(budgetType);
    const now = new Date();
    const msRemaining = periodEnd.getTime() - now.getTime();
    
    const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  private getAlertType(threshold: number): string {
    if (threshold >= 95) return 'critical';
    if (threshold >= 90) return 'high';
    if (threshold >= 75) return 'medium';
    return 'low';
  }

  private generateAlertMessage(
    config: BudgetConfig,
    status: BudgetStatus,
    threshold: number
  ): string {
    const provider = config.provider ? ` for ${config.provider}` : '';
    return `Your ${config.budgetType} budget${provider} has reached ${threshold}% utilization. ` +
           `Current spend: $${status.currentSpend.toFixed(2)} of $${status.budgetAmount.toFixed(2)}. ` +
           `${status.remainingBudget > 0 ? `$${status.remainingBudget.toFixed(2)} remaining.` : 'Budget exceeded!'}`;
  }

  // Stub implementations for methods referenced but not fully implemented
  private async getUserBudgetConfigs(userId: string, provider: string): Promise<BudgetConfig[]> {
    const query = `
      SELECT * FROM user_budget_configs
      WHERE user_id = $1 AND (provider = $2 OR provider IS NULL)
      AND is_active = true
    `;
    
    const results = await this.database.query(query, [userId, provider]);
    return results.map(row => this.mapToBudgetConfig(row));
  }

  private async getBudgetStatusByConfigId(configId: string): Promise<BudgetStatus> {
    const query = `SELECT * FROM v_budget_status WHERE budget_config_id = $1`;
    const result = await this.database.query(query, [configId]);
    
    if (result.length === 0) {
      throw new Error(`Budget config ${configId} not found`);
    }

    const row = result[0];
    return {
      configId: row.budget_config_id,
      userId: row.user_id,
      provider: row.provider,
      budgetType: row.budget_type,
      budgetAmount: parseFloat(row.budget_amount),
      currentSpend: parseFloat(row.current_spend),
      requestCount: parseInt(row.request_count),
      utilizationPercentage: parseFloat(row.utilization_percentage),
      status: row.status,
      remainingBudget: parseFloat(row.budget_amount) - parseFloat(row.current_spend),
      timeRemaining: this.calculateTimeRemaining(row.budget_type)
    };
  }

  private async handleBudgetExceeded(
    userId: string,
    config: BudgetConfig,
    status: BudgetStatus
  ): Promise<void> {
    this.emit('budget-exceeded', {
      userId,
      config,
      status
    });
  }

  private async getAllUserBudgetConfigs(userId: string): Promise<BudgetConfig[]> {
    const query = `SELECT * FROM user_budget_configs WHERE user_id = $1`;
    const results = await this.database.query(query, [userId]);
    return results.map(row => this.mapToBudgetConfig(row));
  }

  private async getUserUsageHistory(userId: string, days: number): Promise<any[]> {
    const query = `
      SELECT * FROM api_usage_events
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `;
    
    return await this.database.query(query, [userId]);
  }

  private calculateAverageSpend(history: any[], budgetType: string): number {
    // Group by period and calculate average
    const periods = this.groupByBudgetPeriod(history, budgetType);
    const totalSpend = Object.values(periods).reduce((sum: number, period: any) => 
      sum + period.reduce((pSum: number, event: any) => pSum + parseFloat(event.estimated_cost), 0), 0
    );
    
    return totalSpend / Math.max(1, Object.keys(periods).length);
  }

  private groupByBudgetPeriod(history: any[], budgetType: string): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    history.forEach(event => {
      const period = this.getPeriodKey(new Date(event.created_at), budgetType);
      if (!groups[period]) groups[period] = [];
      groups[period].push(event);
    });
    
    return groups;
  }

  private getPeriodKey(date: Date, budgetType: string): string {
    switch (budgetType) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        const week = Math.floor(date.getDate() / 7);
        return `${date.getFullYear()}-W${week}`;
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return String(date.getFullYear());
      default:
        return date.toISOString();
    }
  }

  private analyzeGlobalBudgetNeeds(history: any[], configs: BudgetConfig[]): BudgetRecommendation | null {
    // Check if user needs provider-specific budgets
    const providerSpending = this.calculateProviderSpending(history);
    const hasGlobalBudget = configs.some(c => !c.provider);
    
    if (!hasGlobalBudget && Object.keys(providerSpending).length > 2) {
      const totalMonthlySpend = Object.values(providerSpending).reduce((sum, spend) => sum + spend, 0);
      
      return {
        type: 'optimize',
        title: 'Consider provider-specific budgets',
        description: 'You use multiple providers with varying costs',
        currentBudget: totalMonthlySpend,
        recommendedBudget: totalMonthlySpend * 1.2,
        reasoning: [
          'Better control over individual provider spending',
          'Prevent one provider from consuming entire budget',
          'Optimize costs by provider characteristics'
        ],
        confidence: 0.75
      };
    }
    
    return null;
  }

  private calculateProviderSpending(history: any[]): Record<string, number> {
    const spending: Record<string, number> = {};
    
    history.forEach(event => {
      if (!spending[event.provider]) spending[event.provider] = 0;
      spending[event.provider] += parseFloat(event.estimated_cost);
    });
    
    return spending;
  }

  private async getAllActiveBudgetConfigs(): Promise<BudgetConfig[]> {
    const query = `SELECT * FROM user_budget_configs WHERE is_active = true`;
    const results = await this.database.query(query, []);
    return results.map(row => this.mapToBudgetConfig(row));
  }

  private async getConfigsNeedingRollover(): Promise<BudgetConfig[]> {
    // Get configs where the current period has ended
    const query = `
      SELECT bc.* FROM user_budget_configs bc
      LEFT JOIN budget_usage bu ON bc.id = bu.budget_config_id
      WHERE bc.is_active = true
        AND bc.rollover_unused = true
        AND (bu.period_end < CURRENT_DATE OR bu.id IS NULL)
    `;
    
    const results = await this.database.query(query, []);
    return results.map(row => this.mapToBudgetConfig(row));
  }

  private async performBudgetRollover(config: BudgetConfig): Promise<void> {
    // Get previous period usage
    const previousUsage = await this.getPreviousPeriodUsage(config.id);
    const unusedAmount = previousUsage ? 
      Math.max(0, config.budgetAmount - previousUsage.currentSpend) : 0;
    
    // Create new period with rollover
    const { periodStart, periodEnd } = this.getBudgetPeriod(config.budgetType);
    
    const query = `
      INSERT INTO budget_usage (
        budget_config_id, period_start, period_end,
        current_spend, request_count
      ) VALUES ($1, $2, $3, $4, 0)
      ON CONFLICT (budget_config_id, period_start) 
      DO UPDATE SET current_spend = budget_usage.current_spend + $4
    `;
    
    await this.database.query(query, [
      config.id,
      periodStart,
      periodEnd,
      -unusedAmount // Negative to give credit
    ]);
    
    this.emit('budget-rollover', {
      config,
      unusedAmount,
      newPeriod: { periodStart, periodEnd }
    });
  }

  private async getPreviousPeriodUsage(configId: string): Promise<BudgetUsage | null> {
    const query = `
      SELECT * FROM budget_usage
      WHERE budget_config_id = $1
        AND period_end < CURRENT_DATE
      ORDER BY period_end DESC
      LIMIT 1
    `;
    
    const results = await this.database.query(query, [configId]);
    if (results.length === 0) return null;
    
    const row = results[0];
    return {
      id: row.id,
      budgetConfigId: row.budget_config_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      currentSpend: parseFloat(row.current_spend),
      requestCount: parseInt(row.request_count),
      lastUpdated: row.last_updated
    };
  }
}