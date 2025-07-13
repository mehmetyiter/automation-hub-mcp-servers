import React, { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';

export interface TrendChartProps {
  data: Array<{
    timestamp: string;
    value: number;
    [key: string]: any;
  }>;
  metric: string;
  timeRange: string;
  height?: number;
  type?: 'line' | 'area' | 'bar';
  color?: string;
  showAverage?: boolean;
  showTrend?: boolean;
  animate?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  metric,
  timeRange,
  height = 300,
  type = 'line',
  color = '#3B82F6',
  showAverage = false,
  showTrend = false,
  animate = true
}) => {
  // Process data for chart
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      timestamp: format(parseISO(point.timestamp), getTimeFormat(timeRange)),
      formattedValue: formatValue(point.value, metric)
    }));
  }, [data, timeRange, metric]);

  // Calculate average for reference line
  const average = useMemo(() => {
    if (!showAverage || data.length === 0) return 0;
    const sum = data.reduce((acc, point) => acc + point.value, 0);
    return sum / data.length;
  }, [data, showAverage]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.formattedValue}
          </p>
          {data.additionalInfo && (
            <p className="text-xs text-gray-500 mt-1">
              {data.additionalInfo}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Render different chart types
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => formatValue(value, metric)}
            />
            <Tooltip content={<CustomTooltip />} />
            {showAverage && (
              <ReferenceLine 
                y={average} 
                stroke="#EF4444" 
                strokeDasharray="5 5" 
                label="Avg"
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${metric})`}
              animationDuration={animate ? 1000 : 0}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => formatValue(value, metric)}
            />
            <Tooltip content={<CustomTooltip />} />
            {showAverage && (
              <ReferenceLine 
                y={average} 
                stroke="#EF4444" 
                strokeDasharray="5 5" 
                label="Avg"
              />
            )}
            <Bar
              dataKey="value"
              fill={color}
              radius={[2, 2, 0, 0]}
              animationDuration={animate ? 1000 : 0}
            />
          </BarChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => formatValue(value, metric)}
            />
            <Tooltip content={<CustomTooltip />} />
            {showAverage && (
              <ReferenceLine 
                y={average} 
                stroke="#EF4444" 
                strokeDasharray="5 5" 
                label="Avg"
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              animationDuration={animate ? 1000 : 0}
            />
          </LineChart>
        );
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No data available</div>
          <div className="text-sm">Check back later for metrics</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={animate ? { opacity: 0, scale: 0.95 } : {}}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 capitalize">
            {metric.replace(/([A-Z])/g, ' $1').trim()} Trend
          </h4>
          <p className="text-sm text-gray-500">
            Last {timeRange} • {data.length} data points
          </p>
        </div>
        
        {/* Chart Controls */}
        <div className="flex items-center space-x-2">
          {showAverage && (
            <div className="flex items-center text-xs text-gray-500">
              <div className="w-3 h-0.5 bg-red-400 mr-1"></div>
              Average: {formatValue(average, metric)}
            </div>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>

      {/* Chart Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <div>
          Min: {formatValue(Math.min(...data.map(d => d.value)), metric)}
        </div>
        <div>
          Max: {formatValue(Math.max(...data.map(d => d.value)), metric)}
        </div>
        <div>
          Latest: {formatValue(data[data.length - 1]?.value || 0, metric)}
        </div>
      </div>
    </motion.div>
  );
};

// Helper functions
function getTimeFormat(timeRange: string): string {
  switch (timeRange) {
    case '1h':
      return 'HH:mm';
    case '24h':
      return 'HH:mm';
    case '7d':
      return 'MMM dd';
    case '30d':
      return 'MMM dd';
    default:
      return 'MMM dd HH:mm';
  }
}

function formatValue(value: number, metric: string): string {
  if (metric.toLowerCase().includes('time') || metric.toLowerCase().includes('duration')) {
    return formatDuration(value);
  }
  
  if (metric.toLowerCase().includes('rate') || metric.toLowerCase().includes('percentage')) {
    return `${value.toFixed(1)}%`;
  }
  
  if (metric.toLowerCase().includes('bytes') || metric.toLowerCase().includes('size')) {
    return formatBytes(value);
  }
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  
  return value.toFixed(0);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default TrendChart;