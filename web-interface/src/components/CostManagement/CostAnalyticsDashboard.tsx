import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Target,
  Lightbulb,
  Zap,
  RefreshCw,
  Settings,
  Download,
  Calendar,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface CostAnalyticsData {
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

interface CostMetricCardProps {
  title: string;
  value: number;
  change?: number;
  format: 'currency' | 'percentage' | 'number';
  positive?: boolean;
  icon: React.ElementType;
  color?: string;
}

const CostMetricCard: React.FC<CostMetricCardProps> = ({
  title,
  value,
  change,
  format,
  positive = false,
  icon: Icon,
  color = 'blue'
}) => {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `$${val.toFixed(2)}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
        return val.toLocaleString();
      default:
        return val.toString();
    }
  };

  const getChangeColor = () => {
    if (change === undefined) return '';
    if (positive) {
      return change > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    }
  };

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'text-blue-600 bg-blue-100',
      green: 'text-green-600 bg-green-100',
      red: 'text-red-600 bg-red-100',
      yellow: 'text-yellow-600 bg-yellow-100',
      purple: 'text-purple-600 bg-purple-100'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`rounded-lg p-3 ${getColorClasses(color)}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{title}</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold text-gray-900">
                  {formatValue(value)}
                </p>
                {change !== undefined && (
                  <div className={`flex items-center ${getChangeColor()}`}>
                    {change > 0 ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    <span className="text-sm font-medium">
                      {Math.abs(change).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const CostAnalyticsDashboard: React.FC = () => {
  const [costData, setCostData] = useState<CostAnalyticsData | null>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCostAnalytics();
  }, [timeframe]);

  const loadCostAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/cost/analytics?period=${timeframe}`);
      if (!response.ok) {
        throw new Error('Failed to load cost analytics');
      }
      
      const data = await response.json();
      setCostData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadCostAnalytics();
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/v1/cost/export?period=${timeframe}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost-analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImplementOptimization = async (opportunityId: string) => {
    try {
      const response = await fetch(`/api/v1/cost/optimize/${opportunityId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Refresh data to show updated costs
        loadCostAnalytics();
      }
    } catch (err) {
      console.error('Failed to implement optimization:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-red-800">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!costData) {
    return <div>No cost data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">Cost Analytics</h2>
          <Select value={timeframe} onValueChange={(value: '7d' | '30d' | '90d') => setTimeframe(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CostMetricCard
          title="Total Cost"
          value={costData.totalCost}
          change={costData.costChange}
          format="currency"
          icon={DollarSign}
          color="blue"
        />
        <CostMetricCard
          title="Avg Cost/Request"
          value={costData.avgCostPerRequest}
          change={costData.avgCostChange}
          format="currency"
          icon={BarChart3}
          color="green"
        />
        <CostMetricCard
          title="Potential Savings"
          value={costData.optimizationOpportunities.reduce((sum, op) => sum + op.potentialSavings, 0)}
          format="currency"
          icon={Target}
          color="purple"
          positive
        />
        <CostMetricCard
          title="Budget Utilization"
          value={costData.budgetUtilization}
          format="percentage"
          icon={TrendingUp}
          color={costData.budgetUtilization > 80 ? 'red' : costData.budgetUtilization > 60 ? 'yellow' : 'green'}
        />
      </div>

      {/* Cost Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Cost Trends & Projections</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={costData.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip 
                formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name === 'cost' ? 'Actual Cost' : 'Projected Cost']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="cost" 
                stackId="1"
                stroke="#8884d8" 
                fill="#8884d8"
                fillOpacity={0.6}
                name="Actual Cost"
              />
              <Area 
                type="monotone" 
                dataKey="projected" 
                stackId="2"
                stroke="#82ca9d" 
                fill="#82ca9d"
                fillOpacity={0.4}
                strokeDasharray="5 5"
                name="Projected Cost"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Provider and Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={costData.providerBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {costData.providerBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="space-y-2">
                {costData.providerBreakdown.map((provider, index) => (
                  <div key={provider.provider} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{provider.provider}</span>
                      {provider.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
                      {provider.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${provider.cost.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">{provider.requests} requests</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Model Cost Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costData.modelBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Avg Cost/Request']}
                />
                <Bar dataKey="avgCostPerRequest" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5" />
            <span>Cost Optimization Opportunities</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {costData.optimizationOpportunities.map((opportunity) => (
              <div 
                key={opportunity.id}
                className="p-4 border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-semibold">{opportunity.title}</h4>
                      <Badge 
                        variant={
                          opportunity.priority === 'critical' ? 'destructive' :
                          opportunity.priority === 'high' ? 'default' :
                          'secondary'
                        }
                      >
                        {opportunity.priority}
                      </Badge>
                      <Badge variant="outline">
                        {opportunity.effort} effort
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{opportunity.description}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-green-600 font-medium">
                        Save ${opportunity.potentialSavings.toFixed(2)} ({opportunity.savingsPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleImplementOptimization(opportunity.id)}
                    className="ml-4"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Implement
                  </Button>
                </div>
              </div>
            ))}
            
            {costData.optimizationOpportunities.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No optimization opportunities found</p>
                <p className="text-sm">Your current setup is already well-optimized!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Projections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                ${costData.projections.daily.toFixed(2)}
              </div>
              <div className="text-sm text-blue-500">Daily Projection</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${costData.projections.weekly.toFixed(2)}
              </div>
              <div className="text-sm text-green-500">Weekly Projection</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                ${costData.projections.monthly.toFixed(2)}
              </div>
              <div className="text-sm text-purple-500">Monthly Projection</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Confidence:</span>
              <Progress 
                value={costData.projections.confidence * 100} 
                className="w-20"
              />
              <span>{(costData.projections.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CostAnalyticsDashboard;