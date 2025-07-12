import { useCallback, useRef, useEffect } from 'react';

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

export interface UseAnalyticsOptions {
  userId?: string;
  sessionId?: string;
  enableDebug?: boolean;
  batchSize?: number;
  flushInterval?: number;
}

export interface UseAnalyticsReturn {
  track: (event: string, properties?: Record<string, any>) => void;
  page: (pageName: string, properties?: Record<string, any>) => void;
  identify: (userId: string, traits?: Record<string, any>) => void;
  flush: () => void;
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics-session-id');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics-session-id', sessionId);
  }
  return sessionId;
};

const getUserId = (): string | undefined => {
  return localStorage.getItem('user-id') || undefined;
};

export const useAnalytics = (options: UseAnalyticsOptions = {}): UseAnalyticsReturn => {
  const {
    userId: initialUserId,
    sessionId: initialSessionId,
    enableDebug = false,
    batchSize = 10,
    flushInterval = 30000 // 30 seconds
  } = options;

  const analyticsQueue = useRef<AnalyticsEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionId = useRef(initialSessionId || getSessionId());
  const currentUserId = useRef(initialUserId || getUserId());

  const flushAnalytics = useCallback(async () => {
    if (analyticsQueue.current.length === 0) return;

    const events = [...analyticsQueue.current];
    analyticsQueue.current = [];

    try {
      // Send to internal analytics API
      const response = await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        console.warn('Failed to send analytics events:', response.statusText);
        // Re-queue events on failure
        analyticsQueue.current.unshift(...events);
      }
    } catch (error) {
      console.warn('Analytics error:', error);
      // Re-queue events on failure
      analyticsQueue.current.unshift(...events);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    
    flushTimeoutRef.current = setTimeout(() => {
      flushAnalytics();
    }, flushInterval);
  }, [flushAnalytics, flushInterval]);

  const addEvent = useCallback((event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>) => {
    const analyticsEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: sessionId.current,
      userId: currentUserId.current
    };

    analyticsQueue.current.push(analyticsEvent);

    if (enableDebug) {
      console.log('Analytics Event:', analyticsEvent);
    }

    // Flush immediately if batch size reached
    if (analyticsQueue.current.length >= batchSize) {
      flushAnalytics();
    } else {
      scheduleFlush();
    }
  }, [enableDebug, batchSize, flushAnalytics, scheduleFlush]);

  const track = useCallback((event: string, properties?: Record<string, any>) => {
    // Send to Google Analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, {
        ...properties,
        event_category: properties?.category || 'User Action',
        event_label: properties?.label,
        value: properties?.value
      });
    }

    // Add to internal analytics queue
    addEvent({
      event,
      properties
    });
  }, [addEvent]);

  const page = useCallback((pageName: string, properties?: Record<string, any>) => {
    // Send to Google Analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_title: pageName,
        page_location: window.location.href,
        ...properties
      });
    }

    // Track as internal event
    track('page_view', {
      page_name: pageName,
      page_url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...properties
    });
  }, [track]);

  const identify = useCallback((userId: string, traits?: Record<string, any>) => {
    currentUserId.current = userId;
    localStorage.setItem('user-id', userId);

    // Send to Google Analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        user_id: userId,
        custom_map: traits
      });
    }

    // Track as internal event
    track('identify', {
      user_id: userId,
      traits
    });
  }, [track]);

  const flush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    flushAnalytics();
  }, [flushAnalytics]);

  // Auto-flush on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery on page unload
      if (analyticsQueue.current.length > 0 && navigator.sendBeacon) {
        const events = [...analyticsQueue.current];
        navigator.sendBeacon(
          '/api/analytics/events',
          JSON.stringify({ events })
        );
        analyticsQueue.current = [];
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flush();
    };
  }, [flush]);

  return {
    track,
    page,
    identify,
    flush
  };
};