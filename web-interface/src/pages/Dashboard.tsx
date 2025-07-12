import React, { useState } from 'react';
import { Dashboard as DashboardComponent } from '../components/features/Dashboard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MetricCard, SimpleLineChart, SimpleBarChart } from '../components/ui/Charts';
import { 
  DollarSign,
  Activity,
  Shield,
  TrendingUp,
  Users,
  Clock,
  Settings,
  RefreshCw,
  Calendar,
  Filter
} from 'lucide-react';

// Mock data for demonstration
const quickStats = [
  {
    title: 'Total Workflows',
    value: '127',
    change: { value: 12, type: 'increase' as const, period: 'last month' },
    icon: <Activity className="w-6 h-6" />,
    color: 'blue' as const
  },
  {
    title: 'Monthly Cost',
    value: '$234.50',
    change: { value: 8, type: 'decrease' as const, period: 'last month' },
    icon: <DollarSign className="w-6 h-6" />,
    color: 'green' as const
  },
  {
    title: 'Security Score',
    value: '98%',
    change: { value: 2, type: 'increase' as const, period: 'last week' },
    icon: <Shield className="w-6 h-6" />,
    color: 'purple' as const
  },
  {
    title: 'Active Users',
    value: '45',
    change: { value: 15, type: 'increase' as const, period: 'last month' },
    icon: <Users className="w-6 h-6" />,
    color: 'yellow' as const
  }
];

const mockTimeSeriesData = [
  { timestamp: '2024-01-01T00:00:00Z', value: 120 },
  { timestamp: '2024-01-02T00:00:00Z', value: 135 },
  { timestamp: '2024-01-03T00:00:00Z', value: 148 },
  { timestamp: '2024-01-04T00:00:00Z', value: 142 },
  { timestamp: '2024-01-05T00:00:00Z', value: 155 },
  { timestamp: '2024-01-06T00:00:00Z', value: 168 },
  { timestamp: '2024-01-07T00:00:00Z', value: 171 }
];

const mockProviderData = [
  { label: 'OpenAI', value: 45, color: '#10B981' },
  { label: 'Anthropic', value: 32, color: '#3B82F6' },
  { label: 'Google', value: 28, color: '#F59E0B' },
  { label: 'Azure', value: 22, color: '#8B5CF6' }
];

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<'realtime' | '24h' | '7d' | '30d'>('24h');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleTimeRangeChange = (range: '24h' | '7d' | '30d') => {
    setTimeRange(range);
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time insights and system monitoring
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            leftIcon={RefreshCw}
            className={refreshing ? 'animate-spin' : ''}
          >
            Refresh
          </Button>

          <Button
            variant="outline" 
            size="sm"
            leftIcon={Settings}
          >
            Configure
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <MetricCard
            key={index}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Main Dashboard Component */}
      <DashboardComponent
        userId="user-123"
        timeRange={timeRange}
      />

      {/* Additional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Analysis */}
        <Card>
          <CardHeader
            title="Usage Trends"
            subtitle="API calls over time"
            actions={
              <Button variant="ghost" size="sm" leftIcon={Filter}>
                Filter
              </Button>
            }
          />
          <CardBody>
            <SimpleLineChart
              data={mockTimeSeriesData}
              height={200}
              color="#3B82F6"
              showGrid
              showPoints
            />
          </CardBody>
        </Card>

        {/* Provider Distribution */}
        <Card>
          <CardHeader
            title="Provider Usage"
            subtitle="Distribution by AI provider"
          />
          <CardBody>
            <SimpleBarChart
              data={mockProviderData}
              height={200}
              showValues
            />
          </CardBody>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader
          title="System Status"
          subtitle="Current operational status"
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  API Services
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  All systems operational
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Database
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Response time: 45ms
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Background Jobs
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Processing queue: 12 items
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}