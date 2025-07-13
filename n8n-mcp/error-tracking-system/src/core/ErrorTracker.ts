import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { parse as parseStackTrace } from 'stacktrace-parser';
import * as ss from 'simple-statistics';
import { logger } from '../utils/logger';
import { ErrorStorage } from '../storage/ErrorStorage';
import { AlertManager } from '../alerts/AlertManager';

export interface ErrorEvent {
  id: string;
  fingerprint: string;
  timestamp: number;
  level: 'error' | 'warning' | 'critical' | 'fatal';
  message: string;
  type: string;
  stackTrace?: string;
  context: {
    workflowId?: string;
    workflowName?: string;
    nodeId?: string;
    nodeName?: string;
    executionId?: string;
    userId?: string;
    environment: string;
    version: string;
    platform: string;
  };
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
    sessionId?: string;
    tags: string[];
    extra: Record<string, any>;
  };
  breadcrumbs: Breadcrumb[];
  performance: {
    cpuUsage?: number;
    memoryUsage?: number;
    responseTime?: number;
    queueSize?: number;
  };
  resolution?: {
    status: 'open' | 'resolved' | 'ignored' | 'muted';
    resolvedAt?: number;
    resolvedBy?: string;
    resolution?: string;
    fixVersion?: string;
  };
}

export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  title: string;
  message: string;
  type: string;
  level: 'error' | 'warning' | 'critical' | 'fatal';
  firstSeen: number;
  lastSeen: number;
  count: number;
  userCount: number;
  status: 'open' | 'resolved' | 'ignored' | 'muted';
  assignedTo?: string;
  tags: string[];
  environments: string[];
  platforms: string[];
  affectedWorkflows: string[];
  statistics: {
    occurrencesByDay: Array<{ date: string; count: number }>;
    occurrencesByHour: Array<{ hour: number; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
    topWorkflows: Array<{ workflowId: string; workflowName: string; count: number }>;
    trend: 'increasing' | 'decreasing' | 'stable';
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  samples: ErrorEvent[];
  metadata: Record<string, any>;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorRate: number;
  newErrors: number;
  resolvedErrors: number;
  topErrorGroups: ErrorGroup[];
  errorsByLevel: Record<string, number>;
  errorsByType: Record<string, number>;
  errorsByWorkflow: Record<string, number>;
  errorsByTime: Array<{ timestamp: number; count: number }>;
  mttr: number; // Mean Time To Resolution
  mtbf: number; // Mean Time Between Failures
  healthScore: number;
}

export class ErrorTracker extends EventEmitter {
  private errorStorage: ErrorStorage;
  private alertManager: AlertManager;
  private errorGroups = new Map<string, ErrorGroup>();
  private recentErrors: ErrorEvent[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 100;
  private maxRecentErrors = 1000;
  private fingerprintCache = new Map<string, string>();
  
  private readonly ERROR_CLUSTERING_THRESHOLD = 0.8;
  private readonly ALERT_THRESHOLDS = {
    errorRate: 0.05, // 5% error rate
    errorSpike: 10, // 10x increase in error rate
    newErrorGroup: true,
    criticalError: true
  };

  constructor(
    errorStorage: ErrorStorage,
    alertManager: AlertManager,
    private options: {
      enableRealTimeAlerts?: boolean;
      enableErrorGrouping?: boolean;
      enableBreadcrumbs?: boolean;
      maxRetentionDays?: number;
      enableSourceMaps?: boolean;
    } = {}
  ) {
    super();
    
    this.errorStorage = errorStorage;
    this.alertManager = alertManager;
    
    this.options = {
      enableRealTimeAlerts: true,
      enableErrorGrouping: true,
      enableBreadcrumbs: true,
      maxRetentionDays: 30,
      enableSourceMaps: false,
      ...options
    };

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
    
    // Periodic analytics update
    setInterval(() => this.updateAnalytics(), 5 * 60 * 1000); // Every 5 minutes
  }

  // Capture an error event
  async captureError(
    error: Error | string,
    context: Partial<ErrorEvent['context']> = {},
    metadata: Partial<ErrorEvent['metadata']> = {},
    level: ErrorEvent['level'] = 'error'
  ): Promise<string> {
    const errorEvent = this.createErrorEvent(error, context, metadata, level);
    
    try {
      // Store the error
      await this.errorStorage.storeError(errorEvent);
      
      // Add to recent errors
      this.recentErrors.unshift(errorEvent);
      if (this.recentErrors.length > this.maxRecentErrors) {
        this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
      }
      
      // Group the error
      if (this.options.enableErrorGrouping) {
        await this.groupError(errorEvent);
      }
      
      // Check for alerts
      if (this.options.enableRealTimeAlerts) {
        await this.checkAlerts(errorEvent);
      }
      
      // Emit event
      this.emit('error_captured', errorEvent);
      
      logger.debug('Error captured', {
        errorId: errorEvent.id,
        fingerprint: errorEvent.fingerprint,
        level: errorEvent.level,
        type: errorEvent.type
      });
      
      return errorEvent.id;
      
    } catch (captureError) {
      logger.error('Failed to capture error', {
        originalError: error,
        captureError: captureError.message
      });
      throw captureError;
    }
  }

  // Capture a breadcrumb
  addBreadcrumb(
    category: string,
    message: string,
    level: Breadcrumb['level'] = 'info',
    data?: Record<string, any>
  ): void {
    if (!this.options.enableBreadcrumbs) return;
    
    const breadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      category,
      message,
      level,
      data
    };
    
    this.breadcrumbs.unshift(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(0, this.maxBreadcrumbs);
    }
    
    this.emit('breadcrumb_added', breadcrumb);
  }

  // Get error analytics
  async getAnalytics(timeRangeMs: number = 24 * 60 * 60 * 1000): Promise<ErrorAnalytics> {
    const endTime = Date.now();
    const startTime = endTime - timeRangeMs;
    
    const errors = await this.errorStorage.getErrorsInRange(startTime, endTime);
    const errorGroups = await this.errorStorage.getErrorGroups();
    
    return this.calculateAnalytics(errors, errorGroups, timeRangeMs);
  }

  // Get error group details
  async getErrorGroup(fingerprint: string): Promise<ErrorGroup | null> {
    return this.errorStorage.getErrorGroup(fingerprint);
  }

  // Get recent errors
  getRecentErrors(limit: number = 50): ErrorEvent[] {
    return this.recentErrors.slice(0, limit);
  }

  // Update error group status
  async updateErrorGroupStatus(
    fingerprint: string,
    status: ErrorGroup['status'],
    resolvedBy?: string,
    resolution?: string
  ): Promise<void> {
    const errorGroup = await this.errorStorage.getErrorGroup(fingerprint);
    if (!errorGroup) {
      throw new Error(`Error group not found: ${fingerprint}`);
    }
    
    errorGroup.status = status;
    
    if (status === 'resolved') {
      errorGroup.samples.forEach(sample => {
        if (sample.resolution) {
          sample.resolution.status = 'resolved';
          sample.resolution.resolvedAt = Date.now();
          sample.resolution.resolvedBy = resolvedBy;
          sample.resolution.resolution = resolution;
        }
      });
    }
    
    await this.errorStorage.updateErrorGroup(errorGroup);
    
    this.emit('error_group_updated', {
      fingerprint,
      status,
      resolvedBy,
      resolution
    });
    
    logger.info('Error group status updated', {
      fingerprint,
      status,
      resolvedBy
    });
  }

  // Assign error group to user
  async assignErrorGroup(fingerprint: string, assignedTo: string): Promise<void> {
    const errorGroup = await this.errorStorage.getErrorGroup(fingerprint);
    if (!errorGroup) {
      throw new Error(`Error group not found: ${fingerprint}`);
    }
    
    errorGroup.assignedTo = assignedTo;
    await this.errorStorage.updateErrorGroup(errorGroup);
    
    this.emit('error_group_assigned', {
      fingerprint,
      assignedTo
    });
  }

  // Search errors
  async searchErrors(query: {
    text?: string;
    level?: string;
    type?: string;
    workflowId?: string;
    userId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ errors: ErrorEvent[]; total: number }> {
    return this.errorStorage.searchErrors(query);
  }

  // Get error trends
  async getErrorTrends(
    timeRangeMs: number = 7 * 24 * 60 * 60 * 1000,
    granularity: 'hour' | 'day' = 'hour'
  ): Promise<Array<{ timestamp: number; count: number; level: Record<string, number> }>> {
    const endTime = Date.now();
    const startTime = endTime - timeRangeMs;
    
    return this.errorStorage.getErrorTrends(startTime, endTime, granularity);
  }

  private createErrorEvent(
    error: Error | string,
    context: Partial<ErrorEvent['context']>,
    metadata: Partial<ErrorEvent['metadata']>,
    level: ErrorEvent['level']
  ): ErrorEvent {
    const timestamp = Date.now();
    const message = typeof error === 'string' ? error : error.message;
    const stackTrace = typeof error === 'object' && error.stack ? error.stack : undefined;
    const type = typeof error === 'object' ? error.constructor.name : 'GenericError';
    
    // Generate fingerprint for error grouping
    const fingerprint = this.generateFingerprint(message, type, stackTrace);
    
    // Parse stack trace
    let parsedStack;
    if (stackTrace) {
      try {
        parsedStack = parseStackTrace(stackTrace);
      } catch (parseError) {
        logger.warn('Failed to parse stack trace', { parseError: parseError.message });
      }
    }
    
    // Get current performance metrics
    const performance = this.getCurrentPerformance();
    
    const errorEvent: ErrorEvent = {
      id: uuidv4(),
      fingerprint,
      timestamp,
      level,
      message,
      type,
      stackTrace,
      context: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        platform: process.platform,
        ...context
      },
      metadata: {
        tags: [],
        extra: {},
        ...metadata
      },
      breadcrumbs: [...this.breadcrumbs].slice(0, 20), // Last 20 breadcrumbs
      performance,
      resolution: {
        status: 'open'
      }
    };
    
    return errorEvent;
  }

  private generateFingerprint(
    message: string,
    type: string,
    stackTrace?: string
  ): string {
    // Create a stable fingerprint for error grouping
    const key = `${type}:${message}`;
    
    if (this.fingerprintCache.has(key)) {
      return this.fingerprintCache.get(key)!;
    }
    
    let fingerprintInput = `${type}:${message}`;
    
    if (stackTrace) {
      // Use first few lines of stack trace for fingerprinting
      const stackLines = stackTrace.split('\n').slice(0, 3);
      const normalizedStack = stackLines
        .map(line => line.replace(/:\d+:\d+/g, ':0:0')) // Remove line numbers
        .join('\n');
      fingerprintInput += `:${normalizedStack}`;
    }
    
    const hash = crypto.createHash('md5').update(fingerprintInput).digest('hex');
    const fingerprint = hash.substring(0, 16);
    
    this.fingerprintCache.set(key, fingerprint);
    return fingerprint;
  }

  private async groupError(errorEvent: ErrorEvent): Promise<void> {
    let errorGroup = this.errorGroups.get(errorEvent.fingerprint);
    
    if (!errorGroup) {
      // Try to load from storage
      errorGroup = await this.errorStorage.getErrorGroup(errorEvent.fingerprint);
    }
    
    if (!errorGroup) {
      // Create new error group
      errorGroup = {
        id: uuidv4(),
        fingerprint: errorEvent.fingerprint,
        title: this.generateErrorTitle(errorEvent),
        message: errorEvent.message,
        type: errorEvent.type,
        level: errorEvent.level,
        firstSeen: errorEvent.timestamp,
        lastSeen: errorEvent.timestamp,
        count: 1,
        userCount: errorEvent.context.userId ? 1 : 0,
        status: 'open',
        tags: [...errorEvent.metadata.tags],
        environments: [errorEvent.context.environment],
        platforms: [errorEvent.context.platform],
        affectedWorkflows: errorEvent.context.workflowId ? [errorEvent.context.workflowId] : [],
        statistics: {
          occurrencesByDay: [],
          occurrencesByHour: [],
          topUsers: [],
          topWorkflows: [],
          trend: 'stable',
          severity: this.calculateSeverity(errorEvent)
        },
        samples: [errorEvent],
        metadata: {}
      };
      
      this.emit('new_error_group', errorGroup);
    } else {
      // Update existing error group
      errorGroup.lastSeen = errorEvent.timestamp;
      errorGroup.count++;
      
      if (errorEvent.context.userId && 
          !errorGroup.samples.some(s => s.context.userId === errorEvent.context.userId)) {
        errorGroup.userCount++;
      }
      
      // Update level if this error is more severe
      if (this.getSeverityOrder(errorEvent.level) > this.getSeverityOrder(errorGroup.level)) {
        errorGroup.level = errorEvent.level;
      }
      
      // Add to environments and platforms
      if (!errorGroup.environments.includes(errorEvent.context.environment)) {
        errorGroup.environments.push(errorEvent.context.environment);
      }
      
      if (!errorGroup.platforms.includes(errorEvent.context.platform)) {
        errorGroup.platforms.push(errorEvent.context.platform);
      }
      
      // Add to affected workflows
      if (errorEvent.context.workflowId && 
          !errorGroup.affectedWorkflows.includes(errorEvent.context.workflowId)) {
        errorGroup.affectedWorkflows.push(errorEvent.context.workflowId);
      }
      
      // Update tags
      errorEvent.metadata.tags.forEach(tag => {
        if (!errorGroup!.tags.includes(tag)) {
          errorGroup!.tags.push(tag);
        }
      });
      
      // Add sample (keep last 10 samples)
      errorGroup.samples.unshift(errorEvent);
      if (errorGroup.samples.length > 10) {
        errorGroup.samples = errorGroup.samples.slice(0, 10);
      }
      
      // Update statistics
      this.updateErrorGroupStatistics(errorGroup);
    }
    
    this.errorGroups.set(errorEvent.fingerprint, errorGroup);
    await this.errorStorage.updateErrorGroup(errorGroup);
  }

  private generateErrorTitle(errorEvent: ErrorEvent): string {
    // Generate a human-readable title for the error group
    let title = errorEvent.type;
    
    if (errorEvent.context.workflowName) {
      title += ` in ${errorEvent.context.workflowName}`;
    } else if (errorEvent.context.nodeName) {
      title += ` in ${errorEvent.context.nodeName}`;
    }
    
    // Add location info from stack trace if available
    if (errorEvent.stackTrace) {
      const firstLine = errorEvent.stackTrace.split('\n')[1];
      if (firstLine) {
        const match = firstLine.match(/at\s+(.+?)(?:\s+\(|$)/);
        if (match) {
          title += ` at ${match[1]}`;
        }
      }
    }
    
    return title;
  }

  private calculateSeverity(errorEvent: ErrorEvent): ErrorGroup['statistics']['severity'] {
    // Calculate severity based on error level, context, and frequency
    if (errorEvent.level === 'fatal' || errorEvent.level === 'critical') {
      return 'critical';
    }
    
    if (errorEvent.level === 'error') {
      // Check context for severity indicators
      if (errorEvent.context.workflowId || errorEvent.context.nodeId) {
        return 'high'; // Workflow/node errors are important
      }
      return 'medium';
    }
    
    return 'low';
  }

  private getSeverityOrder(level: string): number {
    const order = { warning: 1, error: 2, critical: 3, fatal: 4 };
    return order[level as keyof typeof order] || 0;
  }

  private updateErrorGroupStatistics(errorGroup: ErrorGroup): void {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();
    
    // Update occurrences by day
    let dayEntry = errorGroup.statistics.occurrencesByDay.find(d => d.date === today);
    if (!dayEntry) {
      dayEntry = { date: today, count: 0 };
      errorGroup.statistics.occurrencesByDay.unshift(dayEntry);
    }
    dayEntry.count++;
    
    // Keep last 30 days
    if (errorGroup.statistics.occurrencesByDay.length > 30) {
      errorGroup.statistics.occurrencesByDay = errorGroup.statistics.occurrencesByDay.slice(0, 30);
    }
    
    // Update occurrences by hour
    let hourEntry = errorGroup.statistics.occurrencesByHour.find(h => h.hour === hour);
    if (!hourEntry) {
      hourEntry = { hour, count: 0 };
      errorGroup.statistics.occurrencesByHour.push(hourEntry);
    }
    hourEntry.count++;
    
    // Calculate trend
    if (errorGroup.statistics.occurrencesByDay.length >= 2) {
      const recent = errorGroup.statistics.occurrencesByDay.slice(0, 3);
      const older = errorGroup.statistics.occurrencesByDay.slice(3, 6);
      
      const recentAvg = recent.reduce((sum, d) => sum + d.count, 0) / recent.length;
      const olderAvg = older.length > 0 ? older.reduce((sum, d) => sum + d.count, 0) / older.length : 0;
      
      if (recentAvg > olderAvg * 1.5) {
        errorGroup.statistics.trend = 'increasing';
      } else if (recentAvg < olderAvg * 0.5) {
        errorGroup.statistics.trend = 'decreasing';
      } else {
        errorGroup.statistics.trend = 'stable';
      }
    }
  }

  private async checkAlerts(errorEvent: ErrorEvent): Promise<void> {
    // Check for critical/fatal errors
    if (this.ALERT_THRESHOLDS.criticalError && 
        (errorEvent.level === 'critical' || errorEvent.level === 'fatal')) {
      await this.alertManager.createAlert({
        type: 'error',
        severity: 'critical',
        title: `${errorEvent.level.toUpperCase()}: ${errorEvent.type}`,
        message: errorEvent.message,
        metadata: {
          errorId: errorEvent.id,
          fingerprint: errorEvent.fingerprint,
          workflowId: errorEvent.context.workflowId,
          nodeId: errorEvent.context.nodeId,
          stackTrace: errorEvent.stackTrace
        }
      });
    }
    
    // Check for new error groups
    const errorGroup = this.errorGroups.get(errorEvent.fingerprint);
    if (this.ALERT_THRESHOLDS.newErrorGroup && errorGroup && errorGroup.count === 1) {
      await this.alertManager.createAlert({
        type: 'error',
        severity: 'warning',
        title: 'New Error Type Detected',
        message: `New error type "${errorEvent.type}" detected in ${errorEvent.context.environment}`,
        metadata: {
          fingerprint: errorEvent.fingerprint,
          errorType: errorEvent.type,
          environment: errorEvent.context.environment
        }
      });
    }
    
    // Check for error rate spikes
    await this.checkErrorRateSpike(errorEvent);
  }

  private async checkErrorRateSpike(errorEvent: ErrorEvent): Promise<void> {
    // Get recent error rate
    const now = Date.now();
    const recentErrors = this.recentErrors.filter(e => 
      now - e.timestamp <= 5 * 60 * 1000 // Last 5 minutes
    );
    
    const olderErrors = this.recentErrors.filter(e => 
      e.timestamp <= now - 5 * 60 * 1000 && 
      e.timestamp >= now - 10 * 60 * 1000 // 5-10 minutes ago
    );
    
    if (olderErrors.length > 0) {
      const recentRate = recentErrors.length / 5; // errors per minute
      const olderRate = olderErrors.length / 5;
      
      if (recentRate > olderRate * this.ALERT_THRESHOLDS.errorSpike) {
        await this.alertManager.createAlert({
          type: 'error',
          severity: 'warning',
          title: 'Error Rate Spike Detected',
          message: `Error rate increased from ${olderRate.toFixed(1)}/min to ${recentRate.toFixed(1)}/min`,
          metadata: {
            recentRate,
            olderRate,
            spikeRatio: recentRate / olderRate
          }
        });
      }
    }
  }

  private calculateAnalytics(
    errors: ErrorEvent[],
    errorGroups: ErrorGroup[],
    timeRangeMs: number
  ): ErrorAnalytics {
    const totalErrors = errors.length;
    const newErrors = errorGroups.filter(g => 
      Date.now() - g.firstSeen <= timeRangeMs
    ).length;
    const resolvedErrors = errorGroups.filter(g => g.status === 'resolved').length;
    
    // Calculate error rate (assuming total requests - would need actual request count)
    const errorRate = totalErrors > 0 ? totalErrors / (totalErrors * 10) : 0; // Simplified
    
    // Group errors by level
    const errorsByLevel = errors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Group errors by type
    const errorsByType = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Group errors by workflow
    const errorsByWorkflow = errors.reduce((acc, error) => {
      if (error.context.workflowId) {
        acc[error.context.workflowId] = (acc[error.context.workflowId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate MTTR (Mean Time To Resolution)
    const resolvedGroups = errorGroups.filter(g => 
      g.status === 'resolved' && 
      g.samples.some(s => s.resolution?.resolvedAt)
    );
    
    const mttr = resolvedGroups.length > 0 ? 
      resolvedGroups.reduce((sum, group) => {
        const resolvedSample = group.samples.find(s => s.resolution?.resolvedAt);
        if (resolvedSample?.resolution?.resolvedAt) {
          return sum + (resolvedSample.resolution.resolvedAt - group.firstSeen);
        }
        return sum;
      }, 0) / resolvedGroups.length : 0;
    
    // Calculate health score
    const healthScore = this.calculateHealthScore(errorGroups, totalErrors);
    
    return {
      totalErrors,
      errorRate,
      newErrors,
      resolvedErrors,
      topErrorGroups: errorGroups
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      errorsByLevel,
      errorsByType,
      errorsByWorkflow,
      errorsByTime: this.groupErrorsByTime(errors, timeRangeMs),
      mttr,
      mtbf: 0, // Would need failure data to calculate
      healthScore
    };
  }

  private groupErrorsByTime(
    errors: ErrorEvent[],
    timeRangeMs: number
  ): Array<{ timestamp: number; count: number }> {
    const bucketSize = timeRangeMs > 24 * 60 * 60 * 1000 ? 
      60 * 60 * 1000 : // 1 hour buckets for > 1 day
      5 * 60 * 1000;   // 5 minute buckets for <= 1 day
    
    const buckets = new Map<number, number>();
    const now = Date.now();
    const startTime = now - timeRangeMs;
    
    // Initialize buckets
    for (let time = startTime; time <= now; time += bucketSize) {
      buckets.set(Math.floor(time / bucketSize) * bucketSize, 0);
    }
    
    // Fill buckets with error counts
    errors.forEach(error => {
      const bucket = Math.floor(error.timestamp / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });
    
    return Array.from(buckets.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateHealthScore(errorGroups: ErrorGroup[], totalErrors: number): number {
    // Calculate health score based on error frequency, severity, and resolution rate
    let score = 100;
    
    // Penalty for total errors
    score -= Math.min(30, totalErrors * 0.1);
    
    // Penalty for critical errors
    const criticalGroups = errorGroups.filter(g => 
      g.statistics.severity === 'critical' && g.status === 'open'
    );
    score -= criticalGroups.length * 10;
    
    // Penalty for unresolved errors
    const unresolvedGroups = errorGroups.filter(g => g.status === 'open');
    score -= Math.min(20, unresolvedGroups.length * 2);
    
    // Penalty for increasing trends
    const increasingGroups = errorGroups.filter(g => 
      g.statistics.trend === 'increasing' && g.status === 'open'
    );
    score -= increasingGroups.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private getCurrentPerformance(): ErrorEvent['performance'] {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      cpuUsage: cpuUsage.user / 1000000, // Convert to seconds
      memoryUsage: memUsage.heapUsed / (1024 * 1024), // Convert to MB
      queueSize: this.recentErrors.length
    };
  }

  private async updateAnalytics(): Promise<void> {
    try {
      const analytics = await this.getAnalytics();
      this.emit('analytics_updated', analytics);
    } catch (error) {
      logger.error('Failed to update analytics', { error: error.message });
    }
  }

  private cleanup(): void {
    const maxAge = (this.options.maxRetentionDays || 30) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    
    // Clean up recent errors
    this.recentErrors = this.recentErrors.filter(error => 
      error.timestamp > cutoff
    );
    
    // Clean up breadcrumbs
    this.breadcrumbs = this.breadcrumbs.filter(breadcrumb => 
      breadcrumb.timestamp > cutoff
    );
    
    // Clean up fingerprint cache
    if (this.fingerprintCache.size > 10000) {
      this.fingerprintCache.clear();
    }
    
    logger.debug('Error tracker cleanup completed', {
      recentErrors: this.recentErrors.length,
      breadcrumbs: this.breadcrumbs.length
    });
  }

  destroy(): void {
    this.removeAllListeners();
    this.recentErrors = [];
    this.breadcrumbs = [];
    this.errorGroups.clear();
    this.fingerprintCache.clear();
  }
}