import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';

export interface MetricsData {
  overview: {
    totalWorkflows: number;
    workflowsChange: number;
    workflowsTrend: 'up' | 'down' | 'neutral';
    executionsToday: number;
    executionsChange: number;
    executionsTrend: 'up' | 'down' | 'neutral';
    successRate: number;
    successRateChange: number;
    successRateTrend: 'up' | 'down' | 'neutral';
    avgExecutionTime: number;
    executionTimeChange: number;
    executionTimeTrend: 'up' | 'down' | 'neutral';
    failedExecutions: number;
    failedExecutionsChange: number;
    failedExecutionsTrend: 'up' | 'down' | 'neutral';
    apiRequests: number;
    dataProcessed: number;
  };
  workflows: {
    created: number;
    modified: number;
    deleted: number;
    active: number;
    inactive: number;
  };
  performance: {
    peakExecutionsPerMinute: number;
    avgQueueTime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkTraffic: number;
  };
  system: {
    cpuUsage: number;
    cpuUsageChange: number;
    cpuUsageTrend: 'up' | 'down' | 'neutral';
    memoryUsage: number;
    memoryUsageChange: number;
    memoryUsageTrend: 'up' | 'down' | 'neutral';
    workflowEngineStatus: 'healthy' | 'warning' | 'error';
    workflowEngineUptime: number;
    databaseStatus: 'healthy' | 'warning' | 'error';
    databaseUptime: number;
    queueStatus: 'healthy' | 'warning' | 'error';
    queueUptime: number;
  };
  users: {
    activeUsers: number;
    activeUsersChange: number;
    activeUsersTrend: 'up' | 'down' | 'neutral';
    totalUsers: number;
    newUsers: number;
    returningUsers: number;
  };
  trends: {
    [metric: string]: Array<{
      timestamp: string;
      value: number;
      additionalInfo?: string;
    }>;
  };
  timestamp: string;
}

export interface UseMetricsOptions {
  timeRange: '1h' | '24h' | '7d' | '30d';
  refreshInterval?: number;
  enableRealTime?: boolean;
}

export interface UseMetricsReturn {
  metrics: MetricsData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
}

const METRICS_API_BASE = process.env.REACT_APP_ANALYTICS_API_URL || 'http://localhost:3007';
const WEBSOCKET_URL = process.env.REACT_APP_ANALYTICS_WS_URL || 'ws://localhost:3007';

export const useMetrics = (options: UseMetricsOptions): UseMetricsReturn => {
  const { timeRange, refreshInterval = 30000, enableRealTime = true } = options;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [realTimeMetrics, setRealTimeMetrics] = useState<MetricsData | null>(null);
  
  const queryClient = useQueryClient();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Fetch metrics from API
  const fetchMetrics = useCallback(async (): Promise<MetricsData> => {
    const response = await fetch(`${METRICS_API_BASE}/api/metrics?timeRange=${timeRange}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('analytics_token') || ''}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }, [timeRange]);

  // React Query for metrics
  const {
    data: apiMetrics,
    isLoading,
    error,
    refetch: refetchQuery
  } = useQuery(
    ['metrics', timeRange],
    fetchMetrics,
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      staleTime: 10000, // 10 seconds
      cacheTime: 60000, // 1 minute
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error: Error) => {
        console.error('Metrics fetch error:', error);
        toast.error(`Failed to load metrics: ${error.message}`);
      }
    }
  );

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!enableRealTime) return;

    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      
      const newSocket = io(WEBSOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        auth: {
          token: localStorage.getItem('analytics_token') || ''
        }
      });

      newSocket.on('connect', () => {
        console.log('Connected to analytics WebSocket');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        // Subscribe to metrics updates
        newSocket.emit('subscribe', { timeRange });
        
        toast.success('Real-time analytics connected');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from analytics WebSocket:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          setTimeout(() => {
            if (reconnectAttempts.current < maxReconnectAttempts) {
              reconnectAttempts.current++;
              connectWebSocket();
            }
          }, 2000);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionStatus('error');
        toast.error('Failed to connect to real-time analytics');
      });

      // Listen for metrics updates
      newSocket.on('metrics_update', (data: MetricsData) => {
        setRealTimeMetrics(data);
        
        // Update React Query cache
        queryClient.setQueryData(['metrics', timeRange], data);
      });

      // Listen for specific metric alerts
      newSocket.on('metric_alert', (alert: {
        metric: string;
        value: number;
        threshold: number;
        severity: 'warning' | 'error';
        message: string;
      }) => {
        const toastMethod = alert.severity === 'error' ? toast.error : toast.warning;
        toastMethod(`Alert: ${alert.message}`);
      });

      setSocket(newSocket);
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    };
  }, [enableRealTime, timeRange, queryClient]);

  // Update subscription when timeRange changes
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('subscribe', { timeRange });
    }
  }, [socket, isConnected, timeRange]);

  // Refetch function
  const refetch = useCallback(async () => {
    await refetchQuery();
    
    // Also request fresh data from WebSocket if connected
    if (socket && isConnected) {
      socket.emit('request_metrics', { timeRange });
    }
  }, [refetchQuery, socket, isConnected, timeRange]);

  // Determine which metrics to use (real-time takes precedence)
  const metrics = realTimeMetrics || apiMetrics || null;

  return {
    metrics,
    isLoading: isLoading && !metrics,
    error: error as Error | null,
    refetch,
    isConnected,
    connectionStatus
  };
};

// Hook for specific metric trends
export const useMetricTrend = (metric: string, timeRange: string) => {
  return useQuery(
    ['metric-trend', metric, timeRange],
    async () => {
      const response = await fetch(
        `${METRICS_API_BASE}/api/metrics/trend/${metric}?timeRange=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('analytics_token') || ''}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trend for ${metric}`);
      }

      return response.json();
    },
    {
      staleTime: 30000,
      cacheTime: 300000,
      retry: 2
    }
  );
};

// Hook for comparing metrics across time periods
export const useMetricsComparison = (
  timeRanges: string[],
  metrics: string[]
) => {
  return useQuery(
    ['metrics-comparison', timeRanges, metrics],
    async () => {
      const response = await fetch(
        `${METRICS_API_BASE}/api/metrics/compare`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('analytics_token') || ''}`
          },
          body: JSON.stringify({ timeRanges, metrics })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics comparison');
      }

      return response.json();
    },
    {
      staleTime: 60000,
      cacheTime: 300000,
      enabled: timeRanges.length > 0 && metrics.length > 0
    }
  );
};

// Hook for metric alerts and thresholds
export const useMetricAlerts = () => {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'error';
    message: string;
    timestamp: string;
    acknowledged: boolean;
  }>>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`${METRICS_API_BASE}/api/alerts`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('analytics_token') || ''}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`${METRICS_API_BASE}/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('analytics_token') || ''}`
        }
      });

      if (response.ok) {
        setAlerts(prev => 
          prev.map(alert => 
            alert.id === alertId 
              ? { ...alert, acknowledged: true }
              : alert
          )
        );
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      toast.error('Failed to acknowledge alert');
    }
  }, []);

  return {
    alerts,
    acknowledgeAlert,
    unacknowledgedCount: alerts.filter(alert => !alert.acknowledged).length
  };
};