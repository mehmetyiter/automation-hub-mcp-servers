import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { Card, CardHeader, CardBody } from '../../ui/Card';
import { MetricCard, Chart, SimpleLineChart } from '../../ui/Charts';
import { 
  DollarSign, 
  Activity, 
  Shield, 
  TrendingUp, 
  Users, 
  Server,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

export interface DashboardProps {
  userId: string;
  timeRange: 'realtime' | '24h' | '7d' | '30d';
}

interface MetricsData {
  costs: {
    total: number;
    change: number;
    providers: Array<{ name: string; cost: number }>;
  };
  usage: {
    requests: number;
    change: number;
    timeSeries: Array<{ timestamp: string; value: number }>;
  };
  securityAlerts: {
    total: number;
    critical: number;
    resolved: number;
  };
  performance: {
    avgResponseTime: number;
    uptime: number;
    errorRate: number;
  };
  providers: Array<{
    name: string;
    cost: number;
    requests: number;
    errorRate: number;
  }>;
  timeSeries: {
    costs: Array<{ timestamp: string; value: number }>;
    requests: Array<{ timestamp: string; value: number }>;
    errors: Array<{ timestamp: string; value: number }>;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ userId, timeRange }) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['costs', 'requests']);
  const [loading, setLoading] = useState(true);

  const { data, connectionStatus, isConnected } = useWebSocket(
    `ws://localhost:3001/api/metrics/stream?userId=${userId}&timeRange=${timeRange}`,
    {
      onOpen: () => {
        console.log('Dashboard WebSocket connected');
        setLoading(false);
      },
      onError: (error) => {
        console.error('Dashboard WebSocket error:', error);
        setLoading(false);
      },
      reconnectAttempts: 5,
      reconnectInterval: 2000
    }
  );

  const metricsData: MetricsData = data || {
    costs: { total: 0, change: 0, providers: [] },
    usage: { requests: 0, change: 0, timeSeries: [] },
    securityAlerts: { total: 0, critical: 0, resolved: 0 },
    performance: { avgResponseTime: 0, uptime: 0, errorRate: 0 },
    providers: [],
    timeSeries: { costs: [], requests: [], errors: [] }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'connecting': return <Activity className="w-4 h-4 animate-pulse" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Real-time Dashboard</h1>
        <div className={`flex items-center space-x-2 ${getConnectionStatusColor()}`}>
          {getConnectionStatusIcon()}
          <span className="text-sm font-medium capitalize">{connectionStatus}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Cost"
          value={`$${metricsData.costs.total.toFixed(2)}`}
          change={{
            value: metricsData.costs.change,
            type: metricsData.costs.change >= 0 ? 'increase' : 'decrease',
            period: 'last 24h'
          }}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
        />

        <MetricCard
          title="API Requests"
          value={metricsData.usage.requests.toLocaleString()}
          change={{
            value: metricsData.usage.change,
            type: metricsData.usage.change >= 0 ? 'increase' : 'decrease',
            period: 'last 24h'
          }}
          icon={<Activity className="w-6 h-6" />}
          color="green"
        />

        <MetricCard
          title="Security Alerts"
          value={metricsData.securityAlerts.total.toString()}
          icon={<Shield className="w-6 h-6" />}
          color={metricsData.securityAlerts.critical > 0 ? 'red' : 'yellow'}
        />

        <MetricCard
          title="Uptime"
          value={`${metricsData.performance.uptime.toFixed(1)}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          color={metricsData.performance.uptime >= 99 ? 'green' : 'yellow'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Series Chart */}
        <Card>
          <CardHeader
            title="Metrics Over Time"
            subtitle="Real-time data visualization"
          />
          <CardBody>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'costs', label: 'Costs', color: '#3B82F6' },
                  { key: 'requests', label: 'Requests', color: '#10B981' },
                  { key: 'errors', label: 'Errors', color: '#EF4444' }
                ].map(metric => (
                  <button
                    key={metric.key}
                    onClick={() => {
                      setSelectedMetrics(prev => 
                        prev.includes(metric.key)
                          ? prev.filter(m => m !== metric.key)
                          : [...prev, metric.key]
                      );
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      selectedMetrics.includes(metric.key)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: metric.color }}
                      />
                      <span>{metric.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              {selectedMetrics.map(metricKey => {
                const metricData = metricsData.timeSeries[metricKey as keyof typeof metricsData.timeSeries];
                const colors = {
                  costs: '#3B82F6',
                  requests: '#10B981',
                  errors: '#EF4444'
                };
                
                return (
                  <div key={metricKey}>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                      {metricKey}
                    </h4>
                    <SimpleLineChart
                      data={metricData}
                      height={120}
                      color={colors[metricKey as keyof typeof colors]}
                      showGrid
                      showPoints
                    />
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Provider Comparison */}
        <Card>
          <CardHeader
            title="Provider Performance"
            subtitle="Cost and reliability metrics"
          />
          <CardBody>
            <div className="space-y-4">
              {metricsData.providers.map((provider, index) => (
                <div key={provider.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{provider.name}</h4>
                    <p className="text-sm text-gray-500">
                      {provider.requests.toLocaleString()} requests
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      ${provider.cost.toFixed(2)}
                    </p>
                    <p className={`text-sm ${
                      provider.errorRate < 1 ? 'text-green-600' : 
                      provider.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {provider.errorRate.toFixed(1)}% errors
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader
          title="System Performance"
          subtitle="Real-time system health indicators"
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {metricsData.performance.avgResponseTime.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {metricsData.performance.uptime.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {metricsData.performance.errorRate.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">Error Rate</div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};