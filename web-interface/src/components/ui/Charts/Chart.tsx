import React from 'react';
import { clsx } from 'clsx';

export interface ChartProps {
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  className?: string;
}

export interface SimpleLineChartProps {
  data: TimeSeriesDataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  showPoints?: boolean;
  className?: string;
}

export interface SimpleBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  showValues?: boolean;
  className?: string;
}

export const Chart: React.FC<ChartProps> = ({
  title,
  subtitle,
  height = 300,
  className,
  children
}) => {
  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </div>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  color = 'blue',
  className
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    purple: 'text-purple-600 bg-purple-50'
  };

  const changeColorClasses = {
    increase: 'text-green-600',
    decrease: 'text-red-600'
  };

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={clsx('text-sm mt-1', changeColorClasses[change.type])}>
              {change.type === 'increase' ? '+' : '-'}{Math.abs(change.value)}% from {change.period}
            </p>
          )}
        </div>
        {icon && (
          <div className={clsx('p-3 rounded-lg', colorClasses[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  height = 200,
  color = '#3B82F6',
  showGrid = true,
  showPoints = false,
  className
}) => {
  if (data.length === 0) {
    return (
      <div 
        className={clsx('flex items-center justify-center text-gray-500', className)}
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = ((maxValue - point.value) / range) * 100;
    return { x, y, ...point };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className={clsx('relative', className)} style={{ height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
        {showGrid && (
          <g className="opacity-20">
            {[0, 25, 50, 75, 100].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#6B7280"
                strokeWidth="0.5"
              />
            ))}
          </g>
        )}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          className="drop-shadow-sm"
        />
        {showPoints && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="2"
            fill={color}
            className="drop-shadow-sm"
          />
        ))}
      </svg>
    </div>
  );
};

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  height = 200,
  showValues = true,
  className
}) => {
  if (data.length === 0) {
    return (
      <div 
        className={clsx('flex items-center justify-center text-gray-500', className)}
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = 80 / data.length;

  return (
    <div className={clsx('relative', className)} style={{ height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100">
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * 70;
          const x = 10 + (index * barWidth);
          const y = 80 - barHeight;
          
          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={barWidth * 0.8}
                height={barHeight}
                fill={item.color || '#3B82F6'}
                className="drop-shadow-sm"
              />
              {showValues && (
                <text
                  x={x + (barWidth * 0.4)}
                  y={y - 2}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                  fontSize="3"
                >
                  {item.value}
                </text>
              )}
              <text
                x={x + (barWidth * 0.4)}
                y="95"
                textAnchor="middle"
                className="text-xs fill-gray-600"
                fontSize="3"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};