import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ProviderConfigSection } from './ProviderConfigSection';
import { UsageStatsSection } from './UsageStatsSection';
import { CostManagementSection } from './CostManagementSection';
import { SecuritySettingsSection } from './SecuritySettingsSection';
import { Alert, AlertDescription } from '../ui/alert';
import { RefreshCw, Shield, DollarSign, Settings, BarChart3 } from 'lucide-react';

export interface CredentialStatus {
  [provider: string]: {
    status: 'valid' | 'invalid' | 'pending' | 'expired';
    lastValidated?: Date;
    isActive: boolean;
  };
}

export interface UsageSummary {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byDomain: Record<string, number>;
}

export interface CostSummary {
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  topProviders: Array<{
    provider: string;
    cost: number;
    percentage: number;
  }>;
}

export const CredentialManagementPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('providers');
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus>({});
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load credential status
      const statusResponse = await fetch('/api/credentials/status');
      if (!statusResponse.ok) throw new Error('Failed to load credential status');
      const status = await statusResponse.json();
      setCredentialStatus(status);

      // Load usage summary
      const usageResponse = await fetch('/api/usage/summary');
      if (!usageResponse.ok) throw new Error('Failed to load usage summary');
      const usage = await usageResponse.json();
      setUsageSummary(usage);

      // Load cost summary
      const costResponse = await fetch('/api/costs/summary');
      if (!costResponse.ok) throw new Error('Failed to load cost summary');
      const costs = await costResponse.json();
      setCostSummary(costs);

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const getOverallHealthStatus = () => {
    const statuses = Object.values(credentialStatus);
    if (statuses.length === 0) return { status: 'none', message: 'No credentials configured' };
    
    const validCount = statuses.filter(s => s.status === 'valid' && s.isActive).length;
    const totalCount = statuses.filter(s => s.isActive).length;
    
    if (validCount === 0) return { status: 'error', message: 'No valid credentials' };
    if (validCount < totalCount) return { status: 'warning', message: `${validCount}/${totalCount} credentials valid` };
    return { status: 'success', message: 'All credentials valid' };
  };

  const healthStatus = getOverallHealthStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Management</h1>
          <p className="text-muted-foreground">
            Manage your AI provider credentials, monitor usage, and optimize costs
          </p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className={`h-5 w-5 ${
                healthStatus.status === 'success' ? 'text-green-500' :
                healthStatus.status === 'warning' ? 'text-yellow-500' :
                healthStatus.status === 'error' ? 'text-red-500' : 'text-gray-500'
              }`} />
              <div>
                <p className="text-sm font-medium">Credential Health</p>
                <p className="text-xs text-muted-foreground">{healthStatus.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Requests</p>
                <p className="text-lg font-bold">{usageSummary?.total?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Monthly Cost</p>
                <p className="text-lg font-bold">${costSummary?.monthlyCost?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Active Providers</p>
                <p className="text-lg font-bold">{Object.keys(credentialStatus).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Costs
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <ProviderConfigSection 
            credentialStatus={credentialStatus}
            onCredentialUpdate={loadDashboardData}
          />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageStatsSection 
            usageSummary={usageSummary}
            onRefresh={loadDashboardData}
          />
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <CostManagementSection 
            costSummary={costSummary}
            onRefresh={loadDashboardData}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecuritySettingsSection 
            onRefresh={loadDashboardData}
          />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {lastRefresh.toLocaleString()}
      </div>
    </div>
  );
};