/**
 * Utility functions for formatting numbers, durations, and other data types
 * Used throughout the analytics dashboard for consistent data presentation
 */

export type NumberFormat = 'default' | 'bytes' | 'percentage' | 'currency' | 'compact';

/**
 * Format numbers with appropriate units and precision
 */
export function formatNumber(
  value: number, 
  format: NumberFormat = 'default',
  options: {
    decimals?: number;
    currency?: string;
    locale?: string;
  } = {}
): string {
  const { decimals = 1, currency = 'USD', locale = 'en-US' } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  switch (format) {
    case 'bytes':
      return formatBytes(value, decimals);
    
    case 'percentage':
      return formatPercentage(value, decimals);
    
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value);
    
    case 'compact':
      return formatCompactNumber(value, decimals);
    
    default:
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      }).format(value);
  }
}

/**
 * Format byte values with appropriate units (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format percentage values with proper symbol
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers in compact form (1K, 1M, 1B)
 */
export function formatCompactNumber(value: number, decimals: number = 1): string {
  if (Math.abs(value) < 1000) {
    return value.toString();
  }
  
  const units = [
    { value: 1e12, symbol: 'T' },
    { value: 1e9, symbol: 'B' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'K' }
  ];
  
  for (const unit of units) {
    if (Math.abs(value) >= unit.value) {
      const formatted = (value / unit.value).toFixed(decimals);
      return `${formatted}${unit.symbol}`;
    }
  }
  
  return value.toString();
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(
  milliseconds: number,
  options: {
    format?: 'short' | 'long' | 'compact';
    maxUnits?: number;
    hideZero?: boolean;
  } = {}
): string {
  const { format = 'short', maxUnits = 2, hideZero = true } = options;
  
  if (milliseconds === 0) {
    return format === 'compact' ? '0ms' : '0 milliseconds';
  }

  const units = [
    { value: 24 * 60 * 60 * 1000, singular: 'day', plural: 'days', short: 'd' },
    { value: 60 * 60 * 1000, singular: 'hour', plural: 'hours', short: 'h' },
    { value: 60 * 1000, singular: 'minute', plural: 'minutes', short: 'm' },
    { value: 1000, singular: 'second', plural: 'seconds', short: 's' },
    { value: 1, singular: 'millisecond', plural: 'milliseconds', short: 'ms' }
  ];

  const parts: string[] = [];
  let remaining = Math.abs(milliseconds);

  for (const unit of units) {
    const count = Math.floor(remaining / unit.value);
    
    if (count > 0 || (!hideZero && parts.length === 0)) {
      if (format === 'compact') {
        parts.push(`${count}${unit.short}`);
      } else if (format === 'short') {
        parts.push(`${count}${unit.short}`);
      } else {
        const label = count === 1 ? unit.singular : unit.plural;
        parts.push(`${count} ${label}`);
      }
      
      remaining -= count * unit.value;
      
      if (parts.length >= maxUnits) {
        break;
      }
    }
  }

  if (parts.length === 0) {
    return format === 'compact' ? '0ms' : '0 milliseconds';
  }

  const result = format === 'compact' ? parts.join('') : parts.join(', ');
  return milliseconds < 0 ? `-${result}` : result;
}

/**
 * Format relative time (e.g., "2 minutes ago", "in 5 hours")
 */
export function formatRelativeTime(
  date: Date | string | number,
  options: {
    locale?: string;
    style?: 'long' | 'short' | 'narrow';
  } = {}
): string {
  const { locale = 'en-US', style = 'long' } = options;
  
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  
  const rtf = new Intl.RelativeTimeFormat(locale, { 
    numeric: 'auto',
    style 
  });

  const units: Array<[string, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
    ['second', 1000]
  ];

  for (const [unit, ms] of units) {
    const diff = Math.round(diffMs / ms);
    if (Math.abs(diff) >= 1) {
      return rtf.format(diff, unit as Intl.RelativeTimeFormatUnit);
    }
  }

  return rtf.format(0, 'second');
}

/**
 * Format date and time with various options
 */
export function formatDateTime(
  date: Date | string | number,
  options: {
    format?: 'short' | 'medium' | 'long' | 'full' | 'time' | 'date';
    locale?: string;
    timeZone?: string;
  } = {}
): string {
  const { format = 'medium', locale = 'en-US', timeZone } = options;
  
  const target = new Date(date);
  
  const formatOptions: Intl.DateTimeFormatOptions = { timeZone };
  
  switch (format) {
    case 'short':
      formatOptions.dateStyle = 'short';
      formatOptions.timeStyle = 'short';
      break;
    case 'medium':
      formatOptions.dateStyle = 'medium';
      formatOptions.timeStyle = 'short';
      break;
    case 'long':
      formatOptions.dateStyle = 'long';
      formatOptions.timeStyle = 'medium';
      break;
    case 'full':
      formatOptions.dateStyle = 'full';
      formatOptions.timeStyle = 'long';
      break;
    case 'time':
      formatOptions.timeStyle = 'medium';
      break;
    case 'date':
      formatOptions.dateStyle = 'medium';
      break;
  }
  
  return new Intl.DateTimeFormat(locale, formatOptions).format(target);
}

/**
 * Format rate values (e.g., requests per second)
 */
export function formatRate(
  value: number,
  unit: string = 'second',
  decimals: number = 1
): string {
  if (value === 0) return `0/${unit}`;
  
  const formatted = formatCompactNumber(value, decimals);
  return `${formatted}/${unit}`;
}

/**
 * Format latency/response time values
 */
export function formatLatency(milliseconds: number): string {
  if (milliseconds < 1) {
    return `${(milliseconds * 1000).toFixed(0)}μs`;
  }
  
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(0)}ms`;
  }
  
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

/**
 * Format error rate with color coding
 */
export function formatErrorRate(
  errorCount: number,
  totalCount: number
): {
  rate: string;
  percentage: number;
  severity: 'low' | 'medium' | 'high';
} {
  if (totalCount === 0) {
    return { rate: '0%', percentage: 0, severity: 'low' };
  }
  
  const percentage = (errorCount / totalCount) * 100;
  const rate = formatPercentage(percentage, 2);
  
  let severity: 'low' | 'medium' | 'high';
  if (percentage < 1) {
    severity = 'low';
  } else if (percentage < 5) {
    severity = 'medium';
  } else {
    severity = 'high';
  }
  
  return { rate, percentage, severity };
}

/**
 * Format uptime percentage with status
 */
export function formatUptime(
  uptimeMs: number,
  totalMs: number
): {
  percentage: string;
  status: 'excellent' | 'good' | 'fair' | 'poor';
} {
  if (totalMs === 0) {
    return { percentage: '0%', status: 'poor' };
  }
  
  const percentage = (uptimeMs / totalMs) * 100;
  const formattedPercentage = formatPercentage(percentage, 3);
  
  let status: 'excellent' | 'good' | 'fair' | 'poor';
  if (percentage >= 99.9) {
    status = 'excellent';
  } else if (percentage >= 99.5) {
    status = 'good';
  } else if (percentage >= 99) {
    status = 'fair';
  } else {
    status = 'poor';
  }
  
  return { percentage: formattedPercentage, status };
}

/**
 * Format data transfer rate (bandwidth)
 */
export function formatBandwidth(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
  const factor = 1024;
  
  let value = bytesPerSecond;
  let unitIndex = 0;
  
  while (value >= factor && unitIndex < units.length - 1) {
    value /= factor;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format status with appropriate styling
 */
export function formatStatus(
  status: string
): {
  label: string;
  color: string;
  bgColor: string;
} {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    healthy: { label: 'Healthy', color: 'text-green-600', bgColor: 'bg-green-100' },
    warning: { label: 'Warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    error: { label: 'Error', color: 'text-red-600', bgColor: 'bg-red-100' },
    unknown: { label: 'Unknown', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    maintenance: { label: 'Maintenance', color: 'text-blue-600', bgColor: 'bg-blue-100' }
  };
  
  return statusMap[status.toLowerCase()] || statusMap.unknown;
}