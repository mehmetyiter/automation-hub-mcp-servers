import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCwIcon, 
  SettingsIcon, 
  FullscreenIcon, 
  MinimizeIcon,
  WifiIcon,
  WifiOffIcon,
  AlertCircleIcon,
  InfoIcon
} from 'lucide-react';
import { MetricsOverview } from './MetricsOverview';
import { useMetrics, useMetricAlerts } from '../../hooks/useMetrics';
import { AlertPanel } from '../Alerts/AlertPanel';
import { TimeRangeSelector } from '../Controls/TimeRangeSelector';
import { FilterPanel } from '../Controls/FilterPanel';
import { FullscreenModal } from '../Modals/FullscreenModal';
import { DashboardSettings } from '../Settings/DashboardSettings';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';

export interface RealTimeDashboardProps {
  defaultTimeRange?: '1h' | '24h' | '7d' | '30d';
  autoRefresh?: boolean;
  refreshInterval?: number;
  showAlerts?: boolean;
  customizable?: boolean;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  defaultTimeRange = '24h',
  autoRefresh = true,
  refreshInterval = 30000,
  showAlerts = true,
  customizable = true
}) => {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>(defaultTimeRange);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Custom refresh interval when paused
  const effectiveRefreshInterval = isPaused ? 0 : refreshInterval;

  // Metrics hook
  const {
    metrics,
    isLoading,
    error,
    refetch,
    isConnected,
    connectionStatus
  } = useMetrics({ 
    timeRange, 
    refreshInterval: effectiveRefreshInterval,
    enableRealTime: autoRefresh && !isPaused
  });

  // Alerts hook
  const { alerts, acknowledgeAlert, unacknowledgedCount } = useMetricAlerts();

  // Update last refresh time when metrics change
  useEffect(() => {
    if (metrics) {
      setLastUpdate(new Date());
    }
  }, [metrics]);

  // Connection status monitoring
  useEffect(() => {
    if (connectionStatus === 'error') {
      toast.error('Lost connection to analytics server');
    } else if (connectionStatus === 'connected' && isConnected) {
      toast.success('Connected to real-time analytics');
    }
  }, [connectionStatus, isConnected]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            handleRefresh();
            break;
          case 'f':
            event.preventDefault();
            setIsFullscreen(!isFullscreen);
            break;
          case ',':
            event.preventDefault();
            if (customizable) {
              setShowSettings(!showSettings);
            }
            break;
          case 'p':
            event.preventDefault();
            setIsPaused(!isPaused);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showSettings, isPaused, customizable]);

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Metrics refreshed');
    } catch (error) {
      toast.error('Failed to refresh metrics');
    }
  };

  const handleTimeRangeChange = (newTimeRange: '1h' | '24h' | '7d' | '30d') => {
    setTimeRange(newTimeRange);
    toast.success(`Time range changed to ${newTimeRange}`);
  };

  const connectionIndicator = useMemo(() => {
    const configs = {
      connected: { icon: WifiIcon, color: 'text-green-500', label: 'Connected' },
      connecting: { icon: WifiIcon, color: 'text-yellow-500', label: 'Connecting...' },
      disconnected: { icon: WifiOffIcon, color: 'text-gray-400', label: 'Disconnected' },
      error: { icon: WifiOffIcon, color: 'text-red-500', label: 'Connection Error' }
    };
    
    return configs[connectionStatus];
  }, [connectionStatus]);

  const dashboardContent = (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Real-Time Analytics Dashboard
          </h1>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-1">
              <connectionIndicator.icon 
                className={clsx('w-4 h-4', connectionIndicator.color)} 
              />
              <span className={clsx('text-xs', connectionIndicator.color)}>
                {connectionIndicator.label}
              </span>
            </div>

            {/* Pause Indicator */}
            {isPaused && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <InfoIcon className="w-4 h-4" />
                <span className="text-xs">Updates Paused</span>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Controls */}
        <div className="flex items-center space-x-2">
          {/* Alerts Badge */}
          {showAlerts && unacknowledgedCount > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              <AlertCircleIcon className="w-4 h-4 mr-1" />
              {unacknowledgedCount} Alert{unacknowledgedCount !== 1 ? 's' : ''}
            </button>
          )}

          {/* Time Range Selector */}
          <TimeRangeSelector
            value={timeRange}
            onChange={handleTimeRangeChange}
            disabled={isLoading}
          />

          {/* Pause/Resume Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={clsx(
              'px-3 py-2 text-sm font-medium rounded-lg border',
              isPaused
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
            )}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCwIcon 
              className={clsx('w-4 h-4 mr-1', isLoading && 'animate-spin')} 
            />
            Refresh
          </button>

          {/* Settings Button */}
          {customizable && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {isFullscreen ? (
              <MinimizeIcon className="w-4 h-4" />
            ) : (
              <FullscreenIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <AlertCircleIcon className="w-5 h-5 text-red-500 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Failed to load analytics data
              </h3>
              <p className="text-sm text-red-600 mt-1">
                {error.message}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="ml-auto px-3 py-1 text-sm font-medium text-red-800 bg-red-100 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </motion.div>
      )}

      {/* Alerts Panel */}
      <AnimatePresence>
        {showAlerts && showFilters && (
          <AlertPanel
            alerts={alerts}
            onAcknowledge={acknowledgeAlert}
            onClose={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Metrics Overview */}
      <MetricsOverview
        timeRange={timeRange}
        refreshInterval={effectiveRefreshInterval}
      />

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && customizable && (
          <DashboardSettings
            onClose={() => setShowSettings(false)}
            currentSettings={{
              timeRange,
              autoRefresh: !isPaused,
              refreshInterval,
              showAlerts
            }}
            onSettingsChange={(settings) => {
              if (settings.timeRange !== timeRange) {
                handleTimeRangeChange(settings.timeRange);
              }
              if (settings.autoRefresh !== !isPaused) {
                setIsPaused(!settings.autoRefresh);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );

  // Render in fullscreen modal if needed
  if (isFullscreen) {
    return (
      <FullscreenModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title="Analytics Dashboard"
      >
        {dashboardContent}
      </FullscreenModal>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {dashboardContent}
      </div>
    </div>
  );
};

export default RealTimeDashboard;