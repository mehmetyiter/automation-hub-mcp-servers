import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { clsx } from 'clsx';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'pink' | 'emerald' | 'amber';
  onClick?: () => void;
  loading?: boolean;
  description?: string;
  target?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  onClick,
  loading = false,
  description,
  target
}) => {
  const colorConfig = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      border: 'border-blue-200',
      hover: 'hover:bg-blue-100'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      border: 'border-green-200',
      hover: 'hover:bg-green-100'
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      border: 'border-red-200',
      hover: 'hover:bg-red-100'
    },
    yellow: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      border: 'border-yellow-200',
      hover: 'hover:bg-yellow-100'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      border: 'border-purple-200',
      hover: 'hover:bg-purple-100'
    },
    indigo: {
      bg: 'bg-indigo-50',
      icon: 'text-indigo-600',
      border: 'border-indigo-200',
      hover: 'hover:bg-indigo-100'
    },
    pink: {
      bg: 'bg-pink-50',
      icon: 'text-pink-600',
      border: 'border-pink-200',
      hover: 'hover:bg-pink-100'
    },
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      border: 'border-emerald-200',
      hover: 'hover:bg-emerald-100'
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      border: 'border-amber-200',
      hover: 'hover:bg-amber-100'
    }
  };

  const config = colorConfig[color];

  const getTrendIcon = () => {
    if (trend === 'up') return TrendingUpIcon;
    if (trend === 'down') return TrendingDownIcon;
    return null;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-400';
  };

  const TrendIcon = getTrendIcon();

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  return (
    <motion.div
      className={clsx(
        'bg-white rounded-lg border shadow-sm p-6 transition-all duration-200',
        config.border,
        onClick && 'cursor-pointer',
        onClick && config.hover
      )}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={clsx('p-2 rounded-lg', config.bg)}>
          <Icon className={clsx('w-5 h-5', config.icon)} />
        </div>
      </div>

      {/* Main Value */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>

        {/* Trend Indicator */}
        {(change !== undefined || TrendIcon) && (
          <div className="flex items-center">
            {TrendIcon && (
              <TrendIcon className={clsx('w-4 h-4 mr-1', getTrendColor())} />
            )}
            {change !== undefined && (
              <span className={clsx('text-sm font-medium', getTrendColor())}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Target Progress Bar */}
      {target !== undefined && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress to target</span>
            <span>{((parseFloat(value.toString()) / target) * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className={clsx('h-2 rounded-full', 
                parseFloat(value.toString()) >= target ? 'bg-green-500' : config.icon.replace('text-', 'bg-')
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((parseFloat(value.toString()) / target) * 100, 100)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Click Indicator */}
      {onClick && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        </div>
      )}
    </motion.div>
  );
};

export default MetricCard;