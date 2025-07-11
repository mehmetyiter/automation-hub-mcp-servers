import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock,
  RefreshCw,
  Download
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UsageStatsSectionProps {
  usageSummary: any;
  onRefresh: () => void;
}

interface UsageData {
  period: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  providerBreakdown: Array<{
    provider: string;
    requests: number;
    tokens: number;
    cost: number;
    averageResponseTime: number;
  }>;
  featureBreakdown: Array<{
    feature: string;
    requests: number;
    cost: number;
    successRate: number;
  }>;
  trends: Array<{
    metric: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercentage: number;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export const UsageStatsSection: React.FC<UsageStatsSectionProps> = ({
  usageSummary,
  onRefresh
}) => {
  const [timePeriod, setTimePeriod] = useState('7d');
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUsageData();
  }, [timePeriod]);

  const loadUsageData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/usage/detailed?period=${timePeriod}`);
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/usage/export?period=${timePeriod}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usage-report-${timePeriod}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const getTrendIcon = (trend: string, changePercentage: number) => {
    if (trend === 'increasing') {
      return <TrendingUp className={`h-4 w-4 ${changePercentage > 20 ? 'text-red-500' : 'text-yellow-500'}`} />;
    } else if (trend === 'decreasing') {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    }
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading usage statistics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Analytics</h2>
          <p className="text-muted-foreground">
            Monitor your AI usage patterns and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {usageData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{usageData.totalRequests.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
              {usageData.trends.find(t => t.metric === 'requests') && (
                <div className="flex items-center mt-2 text-sm">
                  {getTrendIcon(
                    usageData.trends.find(t => t.metric === 'requests')!.trend,
                    usageData.trends.find(t => t.metric === 'requests')!.changePercentage
                  )}
                  <span className="ml-1">
                    {usageData.trends.find(t => t.metric === 'requests')!.changePercentage.toFixed(1)}% 
                    vs previous period
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold">{(usageData.totalTokens / 1000).toFixed(1)}K</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
              {usageData.trends.find(t => t.metric === 'tokens') && (
                <div className="flex items-center mt-2 text-sm">
                  {getTrendIcon(
                    usageData.trends.find(t => t.metric === 'tokens')!.trend,
                    usageData.trends.find(t => t.metric === 'tokens')!.changePercentage
                  )}
                  <span className="ml-1">
                    {usageData.trends.find(t => t.metric === 'tokens')!.changePercentage.toFixed(1)}% 
                    vs previous period
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold">
                    {usageData.providerBreakdown.length > 0 
                      ? (usageData.providerBreakdown.reduce((sum, p) => sum + p.averageResponseTime, 0) / usageData.providerBreakdown.length / 1000).toFixed(1)
                      : '0'}s
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
              {usageData.trends.find(t => t.metric === 'response_time') && (
                <div className="flex items-center mt-2 text-sm">
                  {getTrendIcon(
                    usageData.trends.find(t => t.metric === 'response_time')!.trend,
                    usageData.trends.find(t => t.metric === 'response_time')!.changePercentage
                  )}
                  <span className="ml-1">
                    {usageData.trends.find(t => t.metric === 'response_time')!.changePercentage.toFixed(1)}% 
                    vs previous period
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {usageData.featureBreakdown.length > 0
                      ? (usageData.featureBreakdown.reduce((sum, f) => sum + f.successRate, 0) / usageData.featureBreakdown.length * 100).toFixed(1)
                      : '100'}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
              <div className="flex items-center mt-2 text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>Excellent performance</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Over Time Chart */}
      {usageData?.dailyUsage && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageData.dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Requests"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tokens" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Tokens (÷1000)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider and Feature Breakdown */}
      {usageData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Usage by Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageData.providerBreakdown.map((provider, index) => (
                  <div key={provider.provider} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium capitalize">{provider.provider}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {provider.requests.toLocaleString()} requests
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(provider.averageResponseTime / 1000).toFixed(1)}s avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {usageData.providerBreakdown.length > 0 && (
                <div className="mt-6 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={usageData.providerBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="requests"
                        label={({ provider, percent }) => `${provider} ${(percent * 100).toFixed(0)}%`}
                      >
                        {usageData.providerBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Usage by Feature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageData.featureBreakdown.map((feature, index) => (
                  <div key={feature.feature} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{feature.feature.replace('-', ' ')}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {feature.requests.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(feature.successRate * 100).toFixed(1)}% success
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ 
                          width: `${Math.min(100, (feature.requests / Math.max(...usageData.featureBreakdown.map(f => f.requests))) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!usageData && !isLoading && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Usage Data</h3>
            <p className="text-muted-foreground">
              Start using AI features to see your usage analytics here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};