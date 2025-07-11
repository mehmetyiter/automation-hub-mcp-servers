import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface BudgetConfig {
  id: string;
  userId: string;
  provider?: string;
  budgetType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  budgetAmount: number;
  alertThresholds: number[];
  autoStopAtLimit: boolean;
  rolloverUnused: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BudgetStatus {
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

interface BudgetRecommendation {
  type: 'increase' | 'decrease' | 'optimize' | 'redistribute';
  title: string;
  description: string;
  currentBudget: number;
  recommendedBudget: number;
  reasoning: string[];
  confidence: number;
}

export const BudgetManagementPanel: React.FC = () => {
  const [budgets, setBudgets] = useState<BudgetConfig[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetConfig | null>(null);
  const [formData, setFormData] = useState({
    provider: '',
    budgetType: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    budgetAmount: '',
    alertThresholds: [50, 75, 90, 95],
    autoStopAtLimit: false,
    rolloverUnused: false
  });

  useEffect(() => {
    loadBudgetData();
  }, []);

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      const [budgetsRes, statusRes, recommendationsRes] = await Promise.all([
        fetch('/api/v1/cost/budgets'),
        fetch('/api/v1/cost/budgets/status'),
        fetch('/api/v1/cost/budgets/recommendations')
      ]);

      if (budgetsRes.ok) {
        const data = await budgetsRes.json();
        setBudgets(data.data);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setBudgetStatus(data.data);
      }

      if (recommendationsRes.ok) {
        const data = await recommendationsRes.json();
        setRecommendations(data.data);
      }
    } catch (error) {
      console.error('Failed to load budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    try {
      const response = await fetch('/api/v1/cost/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budgetAmount: parseFloat(formData.budgetAmount)
        })
      });

      if (response.ok) {
        setShowCreateDialog(false);
        resetForm();
        loadBudgetData();
      }
    } catch (error) {
      console.error('Failed to create budget:', error);
    }
  };

  const handleUpdateBudget = async () => {
    if (!editingBudget) return;

    try {
      const response = await fetch(`/api/v1/cost/budgets/${editingBudget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetAmount: parseFloat(formData.budgetAmount),
          alertThresholds: formData.alertThresholds,
          autoStopAtLimit: formData.autoStopAtLimit,
          rolloverUnused: formData.rolloverUnused
        })
      });

      if (response.ok) {
        setEditingBudget(null);
        resetForm();
        loadBudgetData();
      }
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const response = await fetch(`/api/v1/cost/budgets/${budgetId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadBudgetData();
      }
    } catch (error) {
      console.error('Failed to delete budget:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      provider: '',
      budgetType: 'monthly',
      budgetAmount: '',
      alertThresholds: [50, 75, 90, 95],
      autoStopAtLimit: false,
      rolloverUnused: false
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'warning':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Budget Management</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Budget
        </Button>
      </div>

      {/* Budget Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgetStatus.map((status) => {
          const budget = budgets.find(b => b.id === status.configId);
          if (!budget) return null;

          return (
            <Card key={status.configId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {status.provider || 'Global'} Budget
                    </CardTitle>
                    <CardDescription>
                      {status.budgetType.charAt(0).toUpperCase() + status.budgetType.slice(1)}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(status.status)}>
                    {status.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Usage</span>
                      <span className="text-sm font-medium">
                        ${status.currentSpend.toFixed(2)} / ${status.budgetAmount.toFixed(2)}
                      </span>
                    </div>
                    <Progress 
                      value={status.utilizationPercentage} 
                      className={`h-2 ${getUtilizationColor(status.utilizationPercentage)}`}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {status.utilizationPercentage.toFixed(1)}% used
                      </span>
                      <span className="text-xs text-gray-500">
                        {status.timeRemaining} remaining
                      </span>
                    </div>
                  </div>

                  {status.projectedOverspend && (
                    <Alert className="p-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Projected overspend: ${status.projectedOverspend.toFixed(2)}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center space-x-2">
                      {budget.autoStopAtLimit && (
                        <Badge variant="outline" className="text-xs">
                          Auto-stop
                        </Badge>
                      )}
                      {budget.rolloverUnused && (
                        <Badge variant="outline" className="text-xs">
                          Rollover
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingBudget(budget);
                          setFormData({
                            provider: budget.provider || '',
                            budgetType: budget.budgetType,
                            budgetAmount: budget.budgetAmount.toString(),
                            alertThresholds: budget.alertThresholds,
                            autoStopAtLimit: budget.autoStopAtLimit,
                            rolloverUnused: budget.rolloverUnused
                          });
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBudget(budget.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budget Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Budget Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span>
                          Current: <strong>${rec.currentBudget.toFixed(2)}</strong>
                        </span>
                        <span>→</span>
                        <span>
                          Recommended: <strong className="text-green-600">${rec.recommendedBudget.toFixed(2)}</strong>
                        </span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Reasoning:</p>
                        <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                          {rec.reasoning.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-right">
                        <Badge variant="outline">
                          {(rec.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <Button size="sm" className="mt-2">
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Budget Dialog */}
      <Dialog open={showCreateDialog || !!editingBudget} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingBudget(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? 'Edit Budget' : 'Create New Budget'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {!editingBudget && (
              <>
                <div>
                  <Label>Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) => setFormData({ ...formData, provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider (or leave empty for global)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Global (All Providers)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="cohere">Cohere</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Budget Type</Label>
                  <Select
                    value={formData.budgetType}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') => 
                      setFormData({ ...formData, budgetType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label>Budget Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.budgetAmount}
                onChange={(e) => setFormData({ ...formData, budgetAmount: e.target.value })}
                placeholder="Enter budget amount"
              />
            </div>

            <div>
              <Label>Alert Thresholds (%)</Label>
              <div className="flex items-center space-x-2 mt-2">
                {formData.alertThresholds.map((threshold, index) => (
                  <Badge key={index} variant="secondary">
                    {threshold}%
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-stop">Auto-stop at limit</Label>
                <Switch
                  id="auto-stop"
                  checked={formData.autoStopAtLimit}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, autoStopAtLimit: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="rollover">Rollover unused budget</Label>
                <Switch
                  id="rollover"
                  checked={formData.rolloverUnused}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, rolloverUnused: checked })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingBudget(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={editingBudget ? handleUpdateBudget : handleCreateBudget}>
              {editingBudget ? 'Update' : 'Create'} Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetManagementPanel;