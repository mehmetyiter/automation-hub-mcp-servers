import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { logger } from '../utils/logger';
import { UsageStorage } from '../storage/UsageStorage';

export interface UsageEvent {
  id: string;
  sessionId: string;
  userId?: string;
  event: string;
  category: 'page_view' | 'api_call' | 'workflow_action' | 'user_action' | 'system_event';
  timestamp: number;
  duration?: number;
  properties: {
    // Page view properties
    page?: string;
    referrer?: string;
    
    // API call properties
    endpoint?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
    
    // Workflow properties
    workflowId?: string;
    workflowName?: string;
    nodeId?: string;
    nodeName?: string;
    nodeType?: string;
    executionId?: string;
    
    // User action properties
    action?: string;
    target?: string;
    value?: any;
    
    // System properties
    component?: string;
    service?: string;
    
    // Custom properties
    [key: string]: any;
  };
  context: {
    userAgent?: string;
    ip?: string;
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    device?: string;
    screenResolution?: string;
    viewportSize?: string;
    sessionStartTime?: number;
    previousEvent?: string;
  };
  metadata: {
    version?: string;
    environment?: string;
    buildId?: string;
    feature?: string;
    experiment?: string;
    cohort?: string;
    tags?: string[];
    source?: string;
  };
}

export interface UsageSession {
  id: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  eventCount: number;
  pageViews: number;
  apiCalls: number;
  workflowActions: number;
  userActions: number;
  bounceRate: number;
  exitPage?: string;
  entryPage?: string;
  conversionEvents: string[];
  context: UsageEvent['context'];
  metadata: UsageEvent['metadata'];
}

export interface UsageMetrics {
  totalEvents: number;
  totalSessions: number;
  totalUsers: number;
  activeUsers: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  sessions: {
    averageDuration: number;
    averagePageViews: number;
    bounceRate: number;
    conversionRate: number;
  };
  pageViews: {
    total: number;
    unique: number;
    topPages: Array<{ page: string; views: number; uniqueViews: number }>;
  };
  apiUsage: {
    totalCalls: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; calls: number; avgResponseTime: number }>;
  };
  workflows: {
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
    topWorkflows: Array<{ workflowId: string; name: string; executions: number; avgTime: number }>;
  };
  geography: {
    countries: Array<{ country: string; users: number; sessions: number }>;
    regions: Array<{ region: string; users: number; sessions: number }>;
  };
  technology: {
    browsers: Array<{ browser: string; users: number; percentage: number }>;
    operatingSystems: Array<{ os: string; users: number; percentage: number }>;
    devices: Array<{ device: string; users: number; percentage: number }>;
  };
}

export interface FunnelAnalysis {
  funnelId: string;
  name: string;
  steps: Array<{
    step: string;
    event: string;
    users: number;
    conversionRate: number;
    dropOffRate: number;
    averageTime: number;
  }>;
  totalUsers: number;
  overallConversionRate: number;
  bottleneck?: string;
}

export interface CohortAnalysis {
  cohortId: string;
  name: string;
  period: 'daily' | 'weekly' | 'monthly';
  cohorts: Array<{
    cohort: string;
    size: number;
    retention: Array<{
      period: number;
      users: number;
      retentionRate: number;
    }>;
  }>;
}

export class UsageTracker extends EventEmitter {
  private usageStorage: UsageStorage;
  private activeSessions = new Map<string, UsageSession>();
  private eventBuffer: UsageEvent[] = [];
  private maxBufferSize = 1000;
  private flushInterval = 30000; // 30 seconds
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(
    usageStorage: UsageStorage,
    private options: {
      enableRealTimeProcessing?: boolean;
      enableGeolocation?: boolean;
      enableUserAgentParsing?: boolean;
      bufferSize?: number;
      flushInterval?: number;
      sessionTimeout?: number;
      enableConversionTracking?: boolean;
      enableCohortAnalysis?: boolean;
    } = {}
  ) {
    super();
    
    this.usageStorage = usageStorage;
    
    this.options = {
      enableRealTimeProcessing: true,
      enableGeolocation: true,
      enableUserAgentParsing: true,
      bufferSize: 1000,
      flushInterval: 30000,
      sessionTimeout: 30 * 60 * 1000,
      enableConversionTracking: true,
      enableCohortAnalysis: true,
      ...options
    };

    this.maxBufferSize = this.options.bufferSize!;
    this.flushInterval = this.options.flushInterval!;
    this.sessionTimeout = this.options.sessionTimeout!;

    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Flush events buffer
    setInterval(() => this.flushEvents(), this.flushInterval);
    
    // Clean up expired sessions
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // Every 5 minutes
    
    // Generate periodic analytics
    if (this.options.enableRealTimeProcessing) {
      setInterval(() => this.generateRealTimeAnalytics(), 60 * 1000); // Every minute
    }
  }

  // Track a usage event
  async trackEvent(
    sessionId: string,
    event: string,
    category: UsageEvent['category'],
    properties: UsageEvent['properties'] = {},
    context: Partial<UsageEvent['context']> = {},
    metadata: Partial<UsageEvent['metadata']> = {}
  ): Promise<string> {
    const eventId = uuidv4();
    const timestamp = Date.now();

    // Enhance context with parsed data
    const enhancedContext = await this.enhanceContext(context);

    // Create usage event
    const usageEvent: UsageEvent = {
      id: eventId,
      sessionId,
      userId: context.userId || properties.userId,
      event,
      category,
      timestamp,
      duration: properties.duration,
      properties,
      context: enhancedContext,
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...metadata
      }
    };

    // Update or create session
    await this.updateSession(usageEvent);

    // Add to buffer
    this.eventBuffer.push(usageEvent);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.maxBufferSize) {
      await this.flushEvents();
    }

    // Emit event for real-time processing
    this.emit('event_tracked', usageEvent);

    logger.debug('Usage event tracked', {
      eventId,
      event,
      category,
      sessionId,
      userId: usageEvent.userId
    });

    return eventId;
  }

  // Track page view
  async trackPageView(
    sessionId: string,
    page: string,
    context: Partial<UsageEvent['context']> = {},
    metadata: Partial<UsageEvent['metadata']> = {}
  ): Promise<string> {
    return this.trackEvent(
      sessionId,
      'page_view',
      'page_view',
      { page, referrer: context.referrer },
      context,
      metadata
    );
  }

  // Track API call
  async trackAPICall(
    sessionId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    context: Partial<UsageEvent['context']> = {},
    metadata: Partial<UsageEvent['metadata']> = {}
  ): Promise<string> {
    return this.trackEvent(
      sessionId,
      'api_call',
      'api_call',
      { endpoint, method, statusCode, responseTime },
      context,
      metadata
    );
  }

  // Track workflow execution
  async trackWorkflowExecution(
    sessionId: string,
    workflowId: string,
    workflowName: string,
    executionId: string,
    duration: number,
    success: boolean,
    context: Partial<UsageEvent['context']> = {},
    metadata: Partial<UsageEvent['metadata']> = {}
  ): Promise<string> {
    return this.trackEvent(
      sessionId,
      success ? 'workflow_executed' : 'workflow_failed',
      'workflow_action',
      { workflowId, workflowName, executionId, duration, success },
      context,
      metadata
    );
  }

  // Track user action
  async trackUserAction(
    sessionId: string,
    action: string,
    target: string,
    value?: any,
    context: Partial<UsageEvent['context']> = {},
    metadata: Partial<UsageEvent['metadata']> = {}
  ): Promise<string> {
    return this.trackEvent(
      sessionId,
      action,
      'user_action',
      { action, target, value },
      context,
      metadata
    );
  }

  // Create new session
  async createSession(
    userId?: string,
    context: Partial<UsageEvent['context']> = {},
    metadata: Partial<UsageEvent['metadata']> = {}
  ): Promise<string> {
    const sessionId = uuidv4();
    const enhancedContext = await this.enhanceContext(context);

    const session: UsageSession = {
      id: sessionId,
      userId,
      startTime: Date.now(),
      eventCount: 0,
      pageViews: 0,
      apiCalls: 0,
      workflowActions: 0,
      userActions: 0,
      bounceRate: 0,
      conversionEvents: [],
      context: enhancedContext,
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...metadata
      }
    };

    this.activeSessions.set(sessionId, session);

    this.emit('session_created', session);

    logger.info('New session created', {
      sessionId,
      userId,
      userAgent: context.userAgent,
      ip: context.ip
    });

    return sessionId;
  }

  // End session
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;

    // Calculate bounce rate (session with only one page view)
    session.bounceRate = session.pageViews <= 1 ? 1 : 0;

    // Store session
    await this.usageStorage.storeSession(session);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    this.emit('session_ended', session);

    logger.info('Session ended', {
      sessionId,
      duration: session.duration,
      eventCount: session.eventCount
    });
  }

  // Get usage metrics
  async getUsageMetrics(
    startTime: number,
    endTime: number,
    filters: {
      userId?: string;
      country?: string;
      platform?: string;
      version?: string;
    } = {}
  ): Promise<UsageMetrics> {
    return this.usageStorage.getUsageMetrics(startTime, endTime, filters);
  }

  // Get funnel analysis
  async getFunnelAnalysis(
    funnelDefinition: {
      name: string;
      steps: Array<{ step: string; event: string }>;
    },
    startTime: number,
    endTime: number,
    filters: any = {}
  ): Promise<FunnelAnalysis> {
    return this.usageStorage.getFunnelAnalysis(funnelDefinition, startTime, endTime, filters);
  }

  // Get cohort analysis
  async getCohortAnalysis(
    period: 'daily' | 'weekly' | 'monthly',
    startTime: number,
    endTime: number,
    filters: any = {}
  ): Promise<CohortAnalysis> {
    return this.usageStorage.getCohortAnalysis(period, startTime, endTime, filters);
  }

  // Get real-time analytics
  getRealTimeAnalytics(): {
    activeSessions: number;
    activeUsers: number;
    recentEvents: UsageEvent[];
    topPages: Array<{ page: string; views: number }>;
  } {
    const now = Date.now();
    const last5Minutes = now - 5 * 60 * 1000;

    const recentEvents = this.eventBuffer.filter(event => event.timestamp >= last5Minutes);
    const activeSessions = this.activeSessions.size;
    const activeUsers = new Set(
      Array.from(this.activeSessions.values())
        .map(session => session.userId)
        .filter(Boolean)
    ).size;

    // Calculate top pages from recent events
    const pageViews = recentEvents
      .filter(event => event.category === 'page_view')
      .reduce((acc, event) => {
        const page = event.properties.page || 'unknown';
        acc[page] = (acc[page] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topPages = Object.entries(pageViews)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return {
      activeSessions,
      activeUsers,
      recentEvents: recentEvents.slice(-50), // Last 50 events
      topPages
    };
  }

  // Get user journey
  async getUserJourney(
    userId: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): Promise<UsageEvent[]> {
    return this.usageStorage.getUserJourney(userId, startTime, endTime, limit);
  }

  // Search events
  async searchEvents(
    query: {
      event?: string;
      category?: string;
      userId?: string;
      sessionId?: string;
      startTime?: number;
      endTime?: number;
      properties?: Record<string, any>;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ events: UsageEvent[]; total: number }> {
    return this.usageStorage.searchEvents(query);
  }

  private async enhanceContext(context: Partial<UsageEvent['context']>): Promise<UsageEvent['context']> {
    const enhanced: UsageEvent['context'] = { ...context };

    // Parse User Agent
    if (this.options.enableUserAgentParsing && context.userAgent) {
      const parser = new UAParser(context.userAgent);
      const result = parser.getResult();

      enhanced.browser = result.browser.name;
      enhanced.browserVersion = result.browser.version;
      enhanced.os = result.os.name;
      enhanced.osVersion = result.os.version;
      enhanced.device = result.device.type || 'desktop';
      enhanced.platform = result.os.name;
    }

    // Get geographic information
    if (this.options.enableGeolocation && context.ip) {
      const geo = geoip.lookup(context.ip);
      if (geo) {
        enhanced.country = geo.country;
        enhanced.region = geo.region;
        enhanced.city = geo.city;
        enhanced.timezone = geo.timezone;
      }
    }

    return enhanced;
  }

  private async updateSession(event: UsageEvent): Promise<void> {
    let session = this.activeSessions.get(event.sessionId);

    if (!session) {
      // Create new session if it doesn't exist
      session = {
        id: event.sessionId,
        userId: event.userId,
        startTime: event.timestamp,
        eventCount: 0,
        pageViews: 0,
        apiCalls: 0,
        workflowActions: 0,
        userActions: 0,
        bounceRate: 0,
        conversionEvents: [],
        context: event.context,
        metadata: event.metadata
      };
      this.activeSessions.set(event.sessionId, session);
    }

    // Update session metrics
    session.eventCount++;
    
    switch (event.category) {
      case 'page_view':
        session.pageViews++;
        if (!session.entryPage) {
          session.entryPage = event.properties.page;
        }
        session.exitPage = event.properties.page;
        break;
      case 'api_call':
        session.apiCalls++;
        break;
      case 'workflow_action':
        session.workflowActions++;
        break;
      case 'user_action':
        session.userActions++;
        break;
    }

    // Track conversion events
    if (this.options.enableConversionTracking && this.isConversionEvent(event)) {
      session.conversionEvents.push(event.event);
    }

    // Update last activity time
    session.endTime = event.timestamp;
    if (session.startTime) {
      session.duration = session.endTime - session.startTime;
    }
  }

  private isConversionEvent(event: UsageEvent): boolean {
    // Define conversion events
    const conversionEvents = [
      'workflow_created',
      'workflow_executed',
      'user_registered',
      'subscription_created',
      'payment_completed',
      'integration_connected'
    ];

    return conversionEvents.includes(event.event);
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.usageStorage.storeEvents(eventsToFlush);
      
      this.emit('events_flushed', {
        count: eventsToFlush.length,
        timestamp: Date.now()
      });

      logger.debug('Events flushed to storage', { count: eventsToFlush.length });
    } catch (error) {
      logger.error('Failed to flush events', { 
        error: error.message,
        eventCount: eventsToFlush.length 
      });
      
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...eventsToFlush);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const lastActivity = session.endTime || session.startTime;
      if (now - lastActivity > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    // End expired sessions
    expiredSessions.forEach(sessionId => {
      this.endSession(sessionId);
    });

    if (expiredSessions.length > 0) {
      logger.debug('Cleaned up expired sessions', { count: expiredSessions.length });
    }
  }

  private generateRealTimeAnalytics(): void {
    const analytics = this.getRealTimeAnalytics();
    this.emit('real_time_analytics', analytics);
  }

  destroy(): void {
    this.removeAllListeners();
    this.activeSessions.clear();
    this.eventBuffer = [];
  }
}