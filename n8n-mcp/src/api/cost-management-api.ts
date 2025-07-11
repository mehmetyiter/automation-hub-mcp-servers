import { Router, Request, Response } from 'express';
import { IntelligentCostManager } from '../billing/intelligent-cost-manager';
import { PricingOracle } from '../billing/pricing-oracle';
import { BudgetManager } from '../billing/budget-manager';
import { Database } from '../database/connection-pool-manager';

export class CostManagementAPI {
  private router: Router;
  private costManager: IntelligentCostManager;
  private pricingOracle: PricingOracle;
  private budgetManager: BudgetManager;
  private database: Database;

  constructor(database: Database) {
    this.router = Router();
    this.database = database;
    this.pricingOracle = new PricingOracle();
    this.budgetManager = new BudgetManager(database);
    this.costManager = new IntelligentCostManager(
      database,
      this.pricingOracle,
      this.budgetManager
    );
    
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Cost Analytics
    this.router.get('/analytics', this.getCostAnalytics.bind(this));
    this.router.get('/analytics/export', this.exportCostData.bind(this));
    
    // Budget Management
    this.router.get('/budgets', this.getBudgets.bind(this));
    this.router.post('/budgets', this.createBudget.bind(this));
    this.router.put('/budgets/:id', this.updateBudget.bind(this));
    this.router.delete('/budgets/:id', this.deleteBudget.bind(this));
    this.router.get('/budgets/status', this.getBudgetStatus.bind(this));
    this.router.get('/budgets/recommendations', this.getBudgetRecommendations.bind(this));
    
    // Cost Optimization
    this.router.get('/optimizations', this.getOptimizations.bind(this));
    this.router.post('/optimizations/:id/implement', this.implementOptimization.bind(this));
    this.router.get('/optimizations/analysis', this.getOptimizationAnalysis.bind(this));
    
    // Pricing Information
    this.router.get('/pricing', this.getPricing.bind(this));
    this.router.get('/pricing/compare', this.comparePricing.bind(this));
    this.router.get('/pricing/cheapest', this.getCheapestOption.bind(this));
    
    // Usage Tracking
    this.router.get('/usage', this.getUsageStats.bind(this));
    this.router.get('/usage/patterns', this.getUsagePatterns.bind(this));
    
    // Alerts
    this.router.get('/alerts', this.getAlerts.bind(this));
    this.router.put('/alerts/:id/acknowledge', this.acknowledgeAlert.bind(this));
  }

  private async getCostAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { period = '30d' } = req.query;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const analytics = await this.costManager.analyzeCostOptimizationOpportunities(
        userId,
        period as '7d' | '30d' | '90d'
      );

      // Get additional metrics
      const budgetStatus = await this.budgetManager.getBudgetStatus(userId);
      const usageStats = await this.getDetailedUsageStats(userId, period as string);

      const response = {
        totalCost: analytics.currentCost,
        dailyCost: analytics.currentCost / 30,
        weeklyCost: analytics.currentCost / 4,
        monthlyCost: analytics.currentCost,
        costChange: this.calculateCostChange(usageStats),
        avgCostPerRequest: usageStats.avgCostPerRequest,
        avgCostChange: this.calculateAvgCostChange(usageStats),
        budgetUtilization: this.calculateBudgetUtilization(budgetStatus),
        trends: usageStats.trends,
        providerBreakdown: this.calculateProviderBreakdown(usageStats),
        modelBreakdown: this.calculateModelBreakdown(usageStats),
        featureBreakdown: this.calculateFeatureBreakdown(usageStats),
        optimizationOpportunities: analytics.recommendations,
        projections: {
          daily: analytics.currentCost / 30,
          weekly: analytics.currentCost / 4,
          monthly: analytics.currentCost,
          confidence: analytics.confidence
        }
      };

      res.json({ success: true, data: response });
    } catch (error) {
      console.error('Error getting cost analytics:', error);
      res.status(500).json({ error: 'Failed to get cost analytics' });
    }
  }

  private async exportCostData(req: Request, res: Response): Promise<void> {
    try {
      const { period = '30d', format = 'csv' } = req.query;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const data = await this.getExportData(userId, period as string);
      
      if (format === 'csv') {
        const csv = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=cost-data-${period}.csv`);
        res.send(csv);
      } else {
        res.json({ success: true, data });
      }
    } catch (error) {
      console.error('Error exporting cost data:', error);
      res.status(500).json({ error: 'Failed to export cost data' });
    }
  }

  private async getBudgets(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const query = `
        SELECT * FROM user_budget_configs
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const budgets = await this.database.query(query, [userId]);
      res.json({ success: true, data: budgets });
    } catch (error) {
      console.error('Error getting budgets:', error);
      res.status(500).json({ error: 'Failed to get budgets' });
    }
  }

  private async createBudget(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const budgetConfig = req.body;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const budget = await this.budgetManager.createBudgetConfig({
        ...budgetConfig,
        userId
      });

      res.json({ success: true, data: budget });
    } catch (error) {
      console.error('Error creating budget:', error);
      res.status(500).json({ error: 'Failed to create budget' });
    }
  }

  private async updateBudget(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const budget = await this.budgetManager.updateBudgetConfig(id, updates);
      res.json({ success: true, data: budget });
    } catch (error) {
      console.error('Error updating budget:', error);
      res.status(500).json({ error: 'Failed to update budget' });
    }
  }

  private async deleteBudget(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const query = `
        UPDATE user_budget_configs
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `;

      await this.database.query(query, [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting budget:', error);
      res.status(500).json({ error: 'Failed to delete budget' });
    }
  }

  private async getBudgetStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { provider } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const status = await this.budgetManager.getBudgetStatus(
        userId,
        provider as string | undefined
      );

      res.json({ success: true, data: status });
    } catch (error) {
      console.error('Error getting budget status:', error);
      res.status(500).json({ error: 'Failed to get budget status' });
    }
  }

  private async getBudgetRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const recommendations = await this.budgetManager.generateBudgetRecommendations(userId);
      res.json({ success: true, data: recommendations });
    } catch (error) {
      console.error('Error getting budget recommendations:', error);
      res.status(500).json({ error: 'Failed to get budget recommendations' });
    }
  }

  private async getOptimizations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const optimizations = await this.costManager.getCostOptimizationRecommendations(userId);
      res.json({ success: true, data: optimizations });
    } catch (error) {
      console.error('Error getting optimizations:', error);
      res.status(500).json({ error: 'Failed to get optimizations' });
    }
  }

  private async implementOptimization(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      const { mode = 'test' } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const result = await this.costManager.implementOptimizationRecommendation(
        userId,
        id,
        mode as 'test' | 'gradual' | 'full'
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error implementing optimization:', error);
      res.status(500).json({ error: 'Failed to implement optimization' });
    }
  }

  private async getOptimizationAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { timeframe = '30d' } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const analysis = await this.costManager.analyzeUsagePatterns(userId);
      res.json({ success: true, data: analysis });
    } catch (error) {
      console.error('Error getting optimization analysis:', error);
      res.status(500).json({ error: 'Failed to get optimization analysis' });
    }
  }

  private async getPricing(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.query;

      if (!provider) {
        res.status(400).json({ error: 'Provider required' });
        return;
      }

      const pricing = await this.pricingOracle.getCurrentPricing(provider as string);
      res.json({ success: true, data: pricing });
    } catch (error) {
      console.error('Error getting pricing:', error);
      res.status(500).json({ error: 'Failed to get pricing' });
    }
  }

  private async comparePricing(req: Request, res: Response): Promise<void> {
    try {
      const { providers, model } = req.query;

      if (!providers || !model) {
        res.status(400).json({ error: 'Providers and model required' });
        return;
      }

      const providerList = (providers as string).split(',');
      const comparison = await this.pricingOracle.comparePricing(
        providerList,
        model as string
      );

      res.json({ success: true, data: comparison });
    } catch (error) {
      console.error('Error comparing pricing:', error);
      res.status(500).json({ error: 'Failed to compare pricing' });
    }
  }

  private async getCheapestOption(req: Request, res: Response): Promise<void> {
    try {
      const requirements = req.body;

      const result = await this.pricingOracle.findCheapestOption(requirements);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error finding cheapest option:', error);
      res.status(500).json({ error: 'Failed to find cheapest option' });
    }
  }

  private async getUsageStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const stats = await this.costManager.getUsageStats(userId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({ error: 'Failed to get usage stats' });
    }
  }

  private async getUsagePatterns(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const patterns = await this.costManager.analyzeUsagePatterns(userId);
      res.json({ success: true, data: patterns });
    } catch (error) {
      console.error('Error getting usage patterns:', error);
      res.status(500).json({ error: 'Failed to get usage patterns' });
    }
  }

  private async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { acknowledged } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const query = `
        SELECT ba.* FROM budget_alerts ba
        JOIN user_budget_configs bc ON ba.budget_config_id = bc.id
        WHERE bc.user_id = $1
        ${acknowledged !== undefined ? 'AND ba.acknowledged = $2' : ''}
        ORDER BY ba.sent_at DESC
        LIMIT 100
      `;

      const params = acknowledged !== undefined ? [userId, acknowledged === 'true'] : [userId];
      const alerts = await this.database.query(query, params);

      res.json({ success: true, data: alerts });
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({ error: 'Failed to get alerts' });
    }
  }

  private async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const query = `
        UPDATE budget_alerts
        SET acknowledged = true, acknowledged_at = NOW()
        WHERE id = $1
      `;

      await this.database.query(query, [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }

  // Helper methods
  private async getDetailedUsageStats(userId: string, period: string): Promise<any> {
    // Implementation for getting detailed usage statistics
    return {
      avgCostPerRequest: 0.05,
      trends: [],
      providers: {},
      models: {},
      features: {}
    };
  }

  private calculateCostChange(stats: any): number {
    // Calculate percentage change in cost
    return 0;
  }

  private calculateAvgCostChange(stats: any): number {
    // Calculate percentage change in average cost per request
    return 0;
  }

  private calculateBudgetUtilization(budgetStatus: any[]): number {
    // Calculate overall budget utilization percentage
    if (budgetStatus.length === 0) return 0;
    
    const totalBudget = budgetStatus.reduce((sum, b) => sum + b.budgetAmount, 0);
    const totalSpend = budgetStatus.reduce((sum, b) => sum + b.currentSpend, 0);
    
    return (totalSpend / totalBudget) * 100;
  }

  private calculateProviderBreakdown(stats: any): any[] {
    // Calculate provider cost breakdown
    return [];
  }

  private calculateModelBreakdown(stats: any): any[] {
    // Calculate model cost breakdown
    return [];
  }

  private calculateFeatureBreakdown(stats: any): any[] {
    // Calculate feature cost breakdown
    return [];
  }

  private async getExportData(userId: string, period: string): Promise<any[]> {
    // Get data for export
    return [];
  }

  private convertToCSV(data: any[]): string {
    // Convert data to CSV format
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => row[header]).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  getRouter(): Router {
    return this.router;
  }
}