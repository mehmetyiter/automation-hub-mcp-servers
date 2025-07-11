import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Target,
  Lightbulb,
  Zap,
  RefreshCw,
  Settings
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';

interface CostManagementSectionProps {
  costSummary: any;
  onRefresh: () => void;
}

interface CostData {
  totalCost: number;
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  projections: {
    dailyProjection: number;
    weeklyProjection: number;
    monthlyProjection: number;
    confidence: number;
  };
  budgetStatus: {
    isWithinBudget: boolean;
    dailyStatus: BudgetStatus;
    monthlyStatus: BudgetStatus;
    alerts: BudgetAlert[];
  };
  optimization: {
    currentCost: number;
    optimizedCost: number;
    savings: number;
    savingsPercentage: number;
    recommendations: CostRecommendation[];
  };
  providerCosts: Array<{
    provider: string;
    cost: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

interface BudgetStatus {
  limit?: number;
  currentSpend: number;
  remainingBudget: number;
  percentageUsed: number;
  projectedSpend: number;
  willExceedBudget: boolean;
}

interface BudgetAlert {
  type: 'approaching_limit' | 'limit_exceeded' | 'projection_warning';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timeframe: string;
}

interface CostRecommendation {
  type: string;
  title: string;
  description: string;
  potentialSavings: number;
  savingsPercentage: number;
  effortLevel: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
}

export const CostManagementSection: React.FC<CostManagementSectionProps> = ({
  costSummary,
  onRefresh
}) => {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [budgetLimits, setBudgetLimits] = useState({
    daily: '',
    monthly: ''
  });
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  useEffect(() => {
    loadCostData();
  }, []);

  const loadCostData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/costs/detailed');
      if (response.ok) {
        const data = await response.json();
        setCostData(data);
        
        // Load existing budget limits
        if (data.budgetStatus?.dailyStatus?.limit) {
          setBudgetLimits(prev => ({
            ...prev,
            daily: data.budgetStatus.dailyStatus.limit.toString()
          }));
        }
        if (data.budgetStatus?.monthlyStatus?.limit) {
          setBudgetLimits(prev => ({
            ...prev,
            monthly: data.budgetStatus.monthlyStatus.limit.toString()
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load cost data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBudgetLimits = async () => {
    setIsSavingBudget(true);
    try {
      const response = await fetch('/api/costs/budget-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dailyLimit: budgetLimits.daily ? parseFloat(budgetLimits.daily) : null,
          monthlyLimit: budgetLimits.monthly ? parseFloat(budgetLimits.monthly) : null
        })
      });

      if (response.ok) {
        await loadCostData();
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to save budget limits:', error);
    } finally {
      setIsSavingBudget(false);
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50 text-red-800';
      case 'warning': return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      default: return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  const getEffortLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading cost data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cost Management</h2>
          <p className="text-muted-foreground">
            Monitor spending, set budgets, and optimize AI costs
          </p>
        </div>
        <Button onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Budget Alerts */}
      {costData?.budgetStatus?.alerts && costData.budgetStatus.alerts.length > 0 && (
        <div className="space-y-2">
          {costData.budgetStatus.alerts.map((alert, index) => (
            <Alert key={index} className={getAlertColor(alert.severity)}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{alert.type.replace('_', ' ').toUpperCase()}:</strong> {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Cost Overview */}
      {costData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">${costData.dailyCost.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Projected: ${costData.projections.dailyProjection.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold">${costData.weeklyCost.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Projected: ${costData.projections.weeklyProjection.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">${costData.monthlyCost.toFixed(2)}</p>
                </div>
                <Target className="h-8 w-8 text-purple-500" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Projected: ${costData.projections.monthlyProjection.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Potential Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${costData.optimization.savings.toFixed(2)}
                  </p>
                </div>
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="mt-2 text-sm text-green-600">
                {costData.optimization.savingsPercentage.toFixed(1)}% optimization
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Status */}
      {costData?.budgetStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Budget Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {costData.budgetStatus.dailyStatus.limit ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Spent: ${costData.budgetStatus.dailyStatus.currentSpend.toFixed(2)}</span>
                      <span>Limit: ${costData.budgetStatus.dailyStatus.limit.toFixed(2)}</span>
                    </div>
                    <Progress 
                      value={costData.budgetStatus.dailyStatus.percentageUsed} 
                      className={costData.budgetStatus.dailyStatus.percentageUsed > 80 ? 'bg-red-100' : 'bg-green-100'}
                    />
                    <div className="text-xs text-muted-foreground">
                      {costData.budgetStatus.dailyStatus.percentageUsed.toFixed(1)}% of daily budget used
                    </div>
                  </div>
                  {costData.budgetStatus.dailyStatus.willExceedBudget && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-red-800">
                        Projected to exceed daily budget by ${(costData.budgetStatus.dailyStatus.projectedSpend - costData.budgetStatus.dailyStatus.limit!).toFixed(2)}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No daily budget set</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Budget Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {costData.budgetStatus.monthlyStatus.limit ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Spent: ${costData.budgetStatus.monthlyStatus.currentSpend.toFixed(2)}</span>
                      <span>Limit: ${costData.budgetStatus.monthlyStatus.limit.toFixed(2)}</span>
                    </div>
                    <Progress 
                      value={costData.budgetStatus.monthlyStatus.percentageUsed} 
                      className={costData.budgetStatus.monthlyStatus.percentageUsed > 80 ? 'bg-red-100' : 'bg-green-100'}
                    />
                    <div className="text-xs text-muted-foreground">
                      {costData.budgetStatus.monthlyStatus.percentageUsed.toFixed(1)}% of monthly budget used
                    </div>
                  </div>
                  {costData.budgetStatus.monthlyStatus.willExceedBudget && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-red-800">
                        Projected to exceed monthly budget by ${(costData.budgetStatus.monthlyStatus.projectedSpend - costData.budgetStatus.monthlyStatus.limit!).toFixed(2)}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No monthly budget set</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Budget Limits</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily-limit">Daily Spending Limit ($)</Label>
              <Input
                id="daily-limit"
                type="number"
                value={budgetLimits.daily}
                onChange={(e) => setBudgetLimits(prev => ({ ...prev, daily: e.target.value }))}
                placeholder="e.g. 10.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-limit">Monthly Spending Limit ($)</Label>
              <Input
                id="monthly-limit"
                type="number"
                value={budgetLimits.monthly}
                onChange={(e) => setBudgetLimits(prev => ({ ...prev, monthly: e.target.value }))}
                placeholder="e.g. 100.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <Button 
            onClick={handleSaveBudgetLimits}
            disabled={isSavingBudget}
            className="w-full md:w-auto"
          >
            {isSavingBudget ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Budget Limits'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Provider Costs */}
      {costData?.providerCosts && (
        <Card>
          <CardHeader>
            <CardTitle>Cost by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costData.providerCosts.map((provider) => (
                <div key={provider.provider} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium capitalize">{provider.provider}</span>
                    {provider.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : provider.trend === 'down' ? (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${provider.cost.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      {provider.percentage.toFixed(1)}% of total
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Optimization Recommendations */}
      {costData?.optimization?.recommendations && costData.optimization.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5" />
              <span>Cost Optimization Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {costData.optimization.recommendations.map((recommendation, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{recommendation.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {recommendation.description}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-green-600 font-medium">
                      ${recommendation.potentialSavings.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {recommendation.savingsPercentage.toFixed(1)}% savings
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-1 rounded ${getEffortLevelColor(recommendation.effortLevel)}`}>
                    {recommendation.effortLevel} effort
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${getEffortLevelColor(recommendation.riskLevel)}`}>
                    {recommendation.riskLevel} risk
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!costData && !isLoading && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Cost Data</h3>
            <p className="text-muted-foreground">
              Start using AI features to see your cost analytics here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};