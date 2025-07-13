import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ActivityIcon, 
  TrendingUpIcon, 
  ClockIcon, 
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UsersIcon,
  ServerIcon
} from 'lucide-react';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricCard } from '../Charts/MetricCard';
import { TrendChart } from '../Charts/TrendChart';
import { formatNumber, formatDuration, formatPercentage } from '../../utils/formatters';

export interface MetricsOverviewProps {
  timeRange: '1h' | '24h' | '7d' | '30d';
  refreshInterval?: number;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ 
  timeRange,
  refreshInterval = 30000 
}) => {
  const { 
    metrics, 
    isLoading, 
    error, 
    refetch 
  } = useMetrics({ timeRange, refreshInterval });

  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Auto-refresh metrics
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refetch, refreshInterval]);

  if (isLoading && !metrics) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">Failed to load metrics: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const {
    overview,
    workflows,
    performance,
    system,
    users,
    trends
  } = metrics;

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <MetricCard
          title="Total Workflows"
          value={formatNumber(overview.totalWorkflows)}
          change={overview.workflowsChange}
          trend={overview.workflowsTrend}
          icon={ActivityIcon}
          color="blue"
          onClick={() => setSelectedMetric('workflows')}
          loading={isLoading}
        />

        <MetricCard
          title="Executions Today"
          value={formatNumber(overview.executionsToday)}
          change={overview.executionsChange}
          trend={overview.executionsTrend}
          icon={TrendingUpIcon}
          color="green"
          onClick={() => setSelectedMetric('executions')}
          loading={isLoading}
        />

        <MetricCard
          title="Success Rate"
          value={formatPercentage(overview.successRate)}
          change={overview.successRateChange}
          trend={overview.successRateTrend}
          icon={CheckCircleIcon}
          color="emerald"
          onClick={() => setSelectedMetric('success')}
          loading={isLoading}
        />

        <MetricCard
          title="Avg Execution Time"
          value={formatDuration(overview.avgExecutionTime)}
          change={overview.executionTimeChange}
          trend={overview.executionTimeTrend}
          icon={ClockIcon}
          color="amber"
          onClick={() => setSelectedMetric('performance')}
          loading={isLoading}
        />
      </motion.div>

      {/* Secondary Metrics */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <MetricCard
          title="Active Users"
          value={formatNumber(users.activeUsers)}
          change={users.activeUsersChange}
          trend={users.activeUsersTrend}
          icon={UsersIcon}
          color="purple"
          onClick={() => setSelectedMetric('users')}
          loading={isLoading}
        />

        <MetricCard
          title="Failed Executions"
          value={formatNumber(overview.failedExecutions)}
          change={overview.failedExecutionsChange}
          trend={overview.failedExecutionsTrend}
          icon={XCircleIcon}
          color="red"
          onClick={() => setSelectedMetric('errors')}
          loading={isLoading}
        />

        <MetricCard
          title="System CPU"
          value={formatPercentage(system.cpuUsage)}
          change={system.cpuUsageChange}
          trend={system.cpuUsageTrend}
          icon={ServerIcon}
          color="indigo"
          onClick={() => setSelectedMetric('system')}
          loading={isLoading}
        />

        <MetricCard
          title="Memory Usage"
          value={formatPercentage(system.memoryUsage)}
          change={system.memoryUsageChange}
          trend={system.memoryUsageTrend}
          icon={ServerIcon}
          color="pink"
          onClick={() => setSelectedMetric('memory')}
          loading={isLoading}
        />
      </motion.div>

      {/* Trend Charts */}
      {selectedMetric && (
        <motion.div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Trend
            </h3>
            <button
              onClick={() => setSelectedMetric(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <TrendChart
            data={trends[selectedMetric] || []}
            metric={selectedMetric}
            timeRange={timeRange}
            height={300}
          />
        </motion.div>
      )}

      {/* Real-time Status Indicators */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <StatusIndicator
          title="Workflow Engine"
          status={system.workflowEngineStatus}
          uptime={system.workflowEngineUptime}
          loading={isLoading}
        />
        
        <StatusIndicator
          title="Database"
          status={system.databaseStatus}
          uptime={system.databaseUptime}
          loading={isLoading}
        />
        
        <StatusIndicator
          title="Message Queue"
          status={system.queueStatus}
          uptime={system.queueUptime}
          loading={isLoading}
        />
      </motion.div>

      {/* Quick Stats Grid */}
      <motion.div
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Statistics</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <QuickStat
            label="Workflows Created"
            value={formatNumber(workflows.created)}
            timeRange={timeRange}
          />
          
          <QuickStat
            label="Workflows Modified"
            value={formatNumber(workflows.modified)}
            timeRange={timeRange}
          />
          
          <QuickStat
            label="Peak Executions/min"
            value={formatNumber(performance.peakExecutionsPerMinute)}
            timeRange={timeRange}
          />
          
          <QuickStat
            label="Avg Queue Time"
            value={formatDuration(performance.avgQueueTime)}
            timeRange={timeRange}
          />
          
          <QuickStat
            label="API Requests"
            value={formatNumber(overview.apiRequests)}
            timeRange={timeRange}
          />
          
          <QuickStat
            label="Data Processed"
            value={formatNumber(overview.dataProcessed, 'bytes')}
            timeRange={timeRange}
          />
        </div>
      </motion.div>
    </div>
  );
};

interface StatusIndicatorProps {
  title: string;
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  loading?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  title, 
  status, 
  uptime, 
  loading 
}) => {
  const statusConfig = {
    healthy: { color: 'text-green-600', bg: 'bg-green-100', dot: 'bg-green-500' },
    warning: { color: 'text-yellow-600', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
    error: { color: 'text-red-600', bg: 'bg-red-100', dot: 'bg-red-500' }
  };

  const config = statusConfig[status];

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-6 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div className={`w-3 h-3 rounded-full ${config.dot} animate-pulse`}></div>
      </div>
      
      <div className={`text-lg font-semibold ${config.color} mb-1`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
      
      <div className="text-sm text-gray-500">
        Uptime: {formatPercentage(uptime)}
      </div>
    </div>
  );
};

interface QuickStatProps {
  label: string;
  value: string;
  timeRange: string;
}

const QuickStat: React.FC<QuickStatProps> = ({ label, value, timeRange }) => (
  <div className="text-center p-3 bg-gray-50 rounded-lg">
    <div className="text-lg font-semibold text-gray-900">{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
    <div className="text-xs text-gray-400">Last {timeRange}</div>
  </div>
);