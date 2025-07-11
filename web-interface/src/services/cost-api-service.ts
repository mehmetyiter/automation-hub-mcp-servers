import { getAuthHeaders } from './auth-service';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface CostAnalyticsData {
  totalCost: number;
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  costChange: number;
  avgCostPerRequest: number;
  avgCostChange: number;
  budgetUtilization: number;
  trends: Array<{
    date: string;
    cost: number;
    requests: number;
    projected?: number;
  }>;
  providerBreakdown: Array<{
    provider: string;
    cost: number;
    percentage: number;
    requests: number;
    trend: 'up' | 'down' | 'stable';
    efficiency: number;
  }>;
  modelBreakdown: Array<{
    model: string;
    provider: string;
    cost: number;
    percentage: number;
    requests: number;
    avgCostPerRequest: number;
  }>;
  featureBreakdown: Array<{
    feature: string;
    cost: number;
    percentage: number;
    requests: number;
    value: number;
  }>;
  optimizationOpportunities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    potentialSavings: number;
    savingsPercentage: number;
    effort: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  projections: {
    daily: number;
    weekly: number;
    monthly: number;
    confidence: number;
  };
}

export interface BudgetConfig {
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
  implementation: {
    steps: string[];
    estimatedTime: string;
    requiredChanges: Array<{
      file: string;
      type: 'config' | 'code' | 'infrastructure';
      description: string;
      before: string;
      after: string;
    }>;
    risks: Array<{
      type: 'performance' | 'reliability' | 'compatibility' | 'cost';
      severity: 'low' | 'medium' | 'high';
      description: string;
      mitigation: string;
    }>;
    rollbackPlan: string[];
  };
  confidence: number;
  automatable: boolean;
}

class CostAPIService {
  // Cost Analytics
  async getCostAnalytics(period: '7d' | '30d' | '90d' = '30d'): Promise<CostAnalyticsData> {
    const response = await fetch(`${API_BASE_URL}/cost/analytics?period=${period}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch cost analytics');
    }

    const data = await response.json();
    return data.data;
  }

  async exportCostData(period: string, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/cost/export?period=${period}&format=${format}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to export cost data');
    }

    return response.blob();
  }

  // Budget Management
  async getBudgets(): Promise<BudgetConfig[]> {
    const response = await fetch(`${API_BASE_URL}/cost/budgets`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch budgets');
    }

    const data = await response.json();
    return data.data;
  }

  async createBudget(budget: Omit<BudgetConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<BudgetConfig> {
    const response = await fetch(`${API_BASE_URL}/cost/budgets`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(budget)
    });

    if (!response.ok) {
      throw new Error('Failed to create budget');
    }

    const data = await response.json();
    return data.data;
  }

  async updateBudget(id: string, updates: Partial<BudgetConfig>): Promise<BudgetConfig> {
    const response = await fetch(`${API_BASE_URL}/cost/budgets/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update budget');
    }

    const data = await response.json();
    return data.data;
  }

  async deleteBudget(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cost/budgets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to delete budget');
    }
  }

  async getBudgetStatus(provider?: string): Promise<BudgetStatus[]> {
    const url = provider 
      ? `${API_BASE_URL}/cost/budgets/status?provider=${provider}`
      : `${API_BASE_URL}/cost/budgets/status`;

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch budget status');
    }

    const data = await response.json();
    return data.data;
  }

  async getBudgetRecommendations(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/cost/budgets/recommendations`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch budget recommendations');
    }

    const data = await response.json();
    return data.data;
  }

  // Cost Optimization
  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    const response = await fetch(`${API_BASE_URL}/cost/optimizations`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch optimization suggestions');
    }

    const data = await response.json();
    return data.data;
  }

  async implementOptimization(
    id: string, 
    mode: 'test' | 'gradual' | 'full' = 'gradual'
  ): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/cost/optimizations/${id}/implement`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode })
    });

    if (!response.ok) {
      throw new Error('Failed to implement optimization');
    }

    const data = await response.json();
    return data.data;
  }

  async getOptimizationAnalysis(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/cost/optimizations/analysis`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch optimization analysis');
    }

    const data = await response.json();
    return data.data;
  }

  // Pricing Information
  async getProviderPricing(provider: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/cost/pricing?provider=${provider}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch provider pricing');
    }

    const data = await response.json();
    return data.data;
  }

  async comparePricing(providers: string[], model: string): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/cost/pricing/compare?providers=${providers.join(',')}&model=${model}`,
      {
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error('Failed to compare pricing');
    }

    const data = await response.json();
    return data.data;
  }

  async findCheapestOption(requirements: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/cost/pricing/cheapest`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requirements)
    });

    if (!response.ok) {
      throw new Error('Failed to find cheapest option');
    }

    const data = await response.json();
    return data.data;
  }

  // Usage Statistics
  async getUsageStats(startDate?: Date, endDate?: Date): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await fetch(`${API_BASE_URL}/cost/usage?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch usage stats');
    }

    const data = await response.json();
    return data.data;
  }

  async getUsagePatterns(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/cost/usage/patterns`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch usage patterns');
    }

    const data = await response.json();
    return data.data;
  }

  // Alerts
  async getAlerts(acknowledged?: boolean): Promise<any[]> {
    const params = acknowledged !== undefined 
      ? `?acknowledged=${acknowledged}`
      : '';

    const response = await fetch(`${API_BASE_URL}/cost/alerts${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch alerts');
    }

    const data = await response.json();
    return data.data;
  }

  async acknowledgeAlert(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cost/alerts/${id}/acknowledge`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to acknowledge alert');
    }
  }
}

// Export singleton instance
export const costAPIService = new CostAPIService();

// Helper function to get auth headers (should be in auth-service.ts)
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const userId = localStorage.getItem('user_id');
  
  const headers: HeadersInit = {
    'Accept': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (userId) {
    headers['X-User-Id'] = userId;
  }

  return headers;
}