import { EventEmitter } from 'events';
import { ErrorTracker } from '../core/ErrorTracker';
import { AlertManager } from '../alerts/AlertManager';
import { NotificationService } from '../notifications/NotificationService';
import { logger } from '../utils/logger';

export interface IntegrationConfig {
  errorTracking: {
    enableRealTimeAlerts: boolean;
    enableErrorGrouping: boolean;
    enableBreadcrumbs: boolean;
    maxRetentionDays: number;
    enableSourceMaps: boolean;
    samplingRate: number;
  };
  alerting: {
    enableRealTimeProcessing: boolean;
    maxRetentionDays: number;
    enableMetrics: boolean;
    defaultSeverityLevels: string[];
  };
  notifications: {
    enableRetries: boolean;
    maxRetentionDays: number;
    enableMetrics: boolean;
    channels: {
      email: boolean;
      slack: boolean;
      discord: boolean;
      sms: boolean;
      webhook: boolean;
      push: boolean;
    };
  };
  integrations: {
    sentry?: {
      dsn: string;
      environment: string;
      release?: string;
    };
    datadog?: {
      apiKey: string;
      appKey: string;
      site: string;
    };
    newrelic?: {
      licenseKey: string;
      appName: string;
    };
    elasticsearch?: {
      host: string;
      index: string;
      auth?: {
        username: string;
        password: string;
      };
    };
  };
}

export interface ErrorTrackingStats {
  errorTracking: {
    totalErrors: number;
    errorRate: number;
    errorGroups: number;
    resolvedErrors: number;
    criticalErrors: number;
    healthScore: number;
  };
  alerting: {
    totalAlerts: number;
    openAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    avgResolutionTime: number;
    escalationRate: number;
  };
  notifications: {
    totalSent: number;
    deliveryRate: number;
    failedNotifications: number;
    avgDeliveryTime: number;
  };
  performance: {
    avgProcessingTime: number;
    memoryUsage: number;
    cpuUsage: number;
    queueSize: number;
  };
}

export class ErrorTrackingIntegration extends EventEmitter {
  private errorTracker: ErrorTracker;
  private alertManager: AlertManager;
  private notificationService: NotificationService;
  private config: IntegrationConfig;
  
  private readonly performanceMetrics = {
    processingTimes: [] as number[],
    lastMemoryCheck: 0,
    lastCpuCheck: { user: 0, system: 0 }
  };

  constructor(
    errorTracker: ErrorTracker,
    alertManager: AlertManager,
    notificationService: NotificationService,
    config: IntegrationConfig
  ) {
    super();
    
    this.errorTracker = errorTracker;
    this.alertManager = alertManager;
    this.notificationService = notificationService;
    this.config = config;
    
    this.setupEventHandlers();
    this.setupPeriodicTasks();
    this.initializeIntegrations();
  }

  private setupEventHandlers(): void {
    // Error Tracker Events
    this.errorTracker.on('error_captured', async (errorEvent) => {
      const startTime = process.hrtime.bigint();
      
      try {
        // Create alert for critical errors
        if (errorEvent.level === 'critical' || errorEvent.level === 'fatal') {
          await this.alertManager.createAlert({
            type: 'error',
            severity: errorEvent.level === 'fatal' ? 'critical' : 'high',
            title: `${errorEvent.level.toUpperCase()}: ${errorEvent.type}`,
            message: errorEvent.message,
            source: 'error-tracker',
            metadata: {
              errorId: errorEvent.id,
              fingerprint: errorEvent.fingerprint,
              workflowId: errorEvent.context.workflowId,
              nodeId: errorEvent.context.nodeId,
              stackTrace: errorEvent.stackTrace,
              environment: errorEvent.context.environment
            },
            context: {
              environment: errorEvent.context.environment,
              service: 'n8n-mcp',
              version: errorEvent.context.version,
              tags: errorEvent.metadata.tags
            }
          });
        }
        
        // Forward to external integrations
        await this.forwardErrorToIntegrations(errorEvent);
        
        this.emit('error_processed', {
          errorId: errorEvent.id,
          level: errorEvent.level,
          processingTime: this.calculateProcessingTime(startTime)
        });
        
      } catch (error) {
        logger.error('Failed to process error event', {
          errorId: errorEvent.id,
          error: error.message
        });
      }
    });

    this.errorTracker.on('new_error_group', async (errorGroup) => {
      // Create alert for new error types
      await this.alertManager.createAlert({
        type: 'error',
        severity: 'warning',
        title: 'New Error Type Detected',
        message: `New error type "${errorGroup.type}" detected: ${errorGroup.message}`,
        source: 'error-tracker',
        metadata: {
          fingerprint: errorGroup.fingerprint,
          errorType: errorGroup.type,
          affectedWorkflows: errorGroup.affectedWorkflows,
          environment: errorGroup.environments[0]
        }
      });
    });

    // Alert Manager Events
    this.alertManager.on('alert_created', async (alert) => {
      // Send notifications for high priority alerts
      if (alert.severity === 'high' || alert.severity === 'critical') {
        await this.sendCriticalAlertNotifications(alert);
      }
      
      this.emit('alert_created', alert);
    });

    this.alertManager.on('alert_escalated', async (escalation) => {
      // Send escalation notifications
      await this.sendEscalationNotifications(escalation);
      
      this.emit('alert_escalated', escalation);
    });

    // Notification Service Events
    this.notificationService.on('notification_failed', (notification) => {
      logger.warn('Notification delivery failed', {
        notificationId: notification.id,
        alertId: notification.alertId,
        channel: notification.channel,
        error: notification.error
      });
    });

    this.notificationService.on('metrics_updated', (metrics) => {
      this.emit('notification_metrics_updated', metrics);
    });
  }

  private setupPeriodicTasks(): void {
    // Update performance metrics
    setInterval(() => this.updatePerformanceMetrics(), 30000); // Every 30 seconds
    
    // Generate health reports
    setInterval(() => this.generateHealthReport(), 5 * 60 * 1000); // Every 5 minutes
    
    // Sync with external integrations
    setInterval(() => this.syncWithIntegrations(), 10 * 60 * 1000); // Every 10 minutes
  }

  private async initializeIntegrations(): Promise<void> {
    // Initialize external integrations based on config
    if (this.config.integrations.sentry) {
      await this.initializeSentry();
    }
    
    if (this.config.integrations.datadog) {
      await this.initializeDatadog();
    }
    
    if (this.config.integrations.newrelic) {
      await this.initializeNewRelic();
    }
    
    if (this.config.integrations.elasticsearch) {
      await this.initializeElasticsearch();
    }
  }

  // Public API Methods

  // Capture an error (main entry point)
  async captureError(
    error: Error | string,
    context?: {
      workflowId?: string;
      workflowName?: string;
      nodeId?: string;
      nodeName?: string;
      executionId?: string;
      userId?: string;
    },
    metadata?: {
      tags?: string[];
      extra?: Record<string, any>;
      level?: 'error' | 'warning' | 'critical' | 'fatal';
    }
  ): Promise<string> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Add breadcrumb for error capture
      this.errorTracker.addBreadcrumb(
        'error',
        `Error captured: ${typeof error === 'string' ? error : error.message}`,
        'error',
        { context, metadata }
      );
      
      const errorId = await this.errorTracker.captureError(
        error,
        {
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0',
          platform: process.platform,
          ...context
        },
        {
          tags: [],
          extra: {},
          ...metadata
        },
        metadata?.level || 'error'
      );
      
      this.recordProcessingTime(startTime);
      return errorId;
      
    } catch (captureError) {
      logger.error('Failed to capture error via integration', {
        originalError: error,
        captureError: captureError.message
      });
      throw captureError;
    }
  }

  // Add breadcrumb
  addBreadcrumb(
    category: string,
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    this.errorTracker.addBreadcrumb(category, message, level, data);
  }

  // Get comprehensive stats
  async getStats(): Promise<ErrorTrackingStats> {
    const [errorAnalytics, alertMetrics, notificationMetrics] = await Promise.all([
      this.errorTracker.getAnalytics(),
      this.alertManager.getMetrics(),
      this.notificationService.getMetrics()
    ]);

    const performanceStats = this.getPerformanceStats();

    return {
      errorTracking: {
        totalErrors: errorAnalytics.totalErrors,
        errorRate: errorAnalytics.errorRate,
        errorGroups: errorAnalytics.topErrorGroups.length,
        resolvedErrors: errorAnalytics.resolvedErrors,
        criticalErrors: errorAnalytics.topErrorGroups.filter(g => 
          g.statistics.severity === 'critical'
        ).length,
        healthScore: errorAnalytics.healthScore
      },
      alerting: {
        totalAlerts: alertMetrics.totalAlerts,
        openAlerts: alertMetrics.alertsByStatus.open || 0,
        acknowledgedAlerts: alertMetrics.alertsByStatus.acknowledged || 0,
        resolvedAlerts: alertMetrics.alertsByStatus.resolved || 0,
        avgResolutionTime: alertMetrics.avgResolutionTime,
        escalationRate: alertMetrics.escalationRate
      },
      notifications: {
        totalSent: notificationMetrics.totalSent,
        deliveryRate: notificationMetrics.deliveryRate,
        failedNotifications: notificationMetrics.totalFailed,
        avgDeliveryTime: notificationMetrics.avgDeliveryTime
      },
      performance: performanceStats
    };
  }

  // Search errors across the system
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
  }): Promise<{ errors: any[]; total: number }> {
    return this.errorTracker.searchErrors(query);
  }

  // Get error trends
  async getErrorTrends(
    timeRangeMs: number = 7 * 24 * 60 * 60 * 1000,
    granularity: 'hour' | 'day' = 'hour'
  ): Promise<Array<{ timestamp: number; count: number; level: Record<string, number> }>> {
    return this.errorTracker.getErrorTrends(timeRangeMs, granularity);
  }

  // Resolve error group
  async resolveErrorGroup(
    fingerprint: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    await this.errorTracker.updateErrorGroupStatus(
      fingerprint,
      'resolved',
      resolvedBy,
      resolution
    );
    
    // Create success alert
    await this.alertManager.createAlert({
      type: 'error',
      severity: 'low',
      title: 'Error Group Resolved',
      message: `Error group ${fingerprint} has been resolved: ${resolution}`,
      source: 'error-tracker',
      metadata: {
        fingerprint,
        resolvedBy,
        resolution
      }
    });
  }

  // Configure notification channels
  async configureNotificationChannel(channel: any): Promise<void> {
    await this.notificationService.configureChannel(channel);
  }

  // Test notification channel
  async testNotificationChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    return this.notificationService.testChannel(channelId);
  }

  // Private Helper Methods

  private async forwardErrorToIntegrations(errorEvent: any): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.config.integrations.sentry) {
      promises.push(this.sendToSentry(errorEvent));
    }
    
    if (this.config.integrations.datadog) {
      promises.push(this.sendToDatadog(errorEvent));
    }
    
    if (this.config.integrations.newrelic) {
      promises.push(this.sendToNewRelic(errorEvent));
    }
    
    if (this.config.integrations.elasticsearch) {
      promises.push(this.sendToElasticsearch(errorEvent));
    }
    
    // Execute all integrations in parallel
    await Promise.allSettled(promises);
  }

  private async sendCriticalAlertNotifications(alert: any): Promise<void> {
    // Determine recipients based on alert context
    const recipients = this.determineAlertRecipients(alert);
    
    // Send notifications via configured channels
    const notifications = [];
    
    if (this.config.notifications.channels.email && recipients.email.length > 0) {
      for (const email of recipients.email) {
        notifications.push(this.notificationService.sendNotification({
          alertId: alert.id,
          recipient: email,
          channel: 'email',
          subject: alert.title,
          message: this.formatAlertMessage(alert),
          priority: alert.severity,
          metadata: alert.metadata
        }));
      }
    }
    
    if (this.config.notifications.channels.slack && recipients.slack.length > 0) {
      for (const channel of recipients.slack) {
        notifications.push(this.notificationService.sendNotification({
          alertId: alert.id,
          recipient: channel,
          channel: 'slack',
          subject: alert.title,
          message: this.formatAlertMessage(alert),
          priority: alert.severity,
          metadata: alert.metadata
        }));
      }
    }
    
    await Promise.allSettled(notifications);
  }

  private async sendEscalationNotifications(escalation: any): Promise<void> {
    // Send escalation notifications to higher-level recipients
    const escalationRecipients = this.getEscalationRecipients(escalation.level);
    
    for (const recipient of escalationRecipients) {
      await this.notificationService.sendNotification({
        alertId: escalation.alertId,
        recipient: recipient.address,
        channel: recipient.channel,
        subject: `ESCALATED: Alert ${escalation.alertId}`,
        message: `This alert has been escalated to level ${escalation.level} due to lack of response.`,
        priority: 'critical'
      });
    }
  }

  private determineAlertRecipients(alert: any): {
    email: string[];
    slack: string[];
    sms: string[];
  } {
    // Logic to determine recipients based on alert context
    const recipients = {
      email: [] as string[],
      slack: [] as string[],
      sms: [] as string[]
    };
    
    // Add default recipients for critical alerts
    if (alert.severity === 'critical') {
      recipients.email.push('oncall@company.com');
      recipients.slack.push('#critical-alerts');
      recipients.sms.push('+1234567890');
    }
    
    // Add workflow-specific recipients
    if (alert.metadata.workflowId) {
      // Logic to find workflow owners/maintainers
      recipients.email.push('workflow-team@company.com');
    }
    
    return recipients;
  }

  private getEscalationRecipients(level: number): Array<{ address: string; channel: string }> {
    const escalationMatrix = [
      { address: 'team-lead@company.com', channel: 'email' },
      { address: 'engineering-manager@company.com', channel: 'email' },
      { address: 'director@company.com', channel: 'email' },
      { address: '+1234567890', channel: 'sms' }
    ];
    
    return escalationMatrix.slice(0, level);
  }

  private formatAlertMessage(alert: any): string {
    let message = `${alert.message}\n\n`;
    
    message += `**Details:**\n`;
    message += `- Severity: ${alert.severity.toUpperCase()}\n`;
    message += `- Type: ${alert.type}\n`;
    message += `- Source: ${alert.source}\n`;
    message += `- Time: ${new Date(alert.timestamp).toISOString()}\n`;
    
    if (alert.metadata.workflowId) {
      message += `- Workflow: ${alert.metadata.workflowId}\n`;
    }
    
    if (alert.metadata.nodeId) {
      message += `- Node: ${alert.metadata.nodeId}\n`;
    }
    
    if (alert.metadata.stackTrace) {
      message += `\n**Stack Trace:**\n\`\`\`\n${alert.metadata.stackTrace.split('\n').slice(0, 10).join('\n')}\n\`\`\``;
    }
    
    return message;
  }

  private updatePerformanceMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.performanceMetrics.lastMemoryCheck = memUsage.heapUsed / (1024 * 1024); // MB
    this.performanceMetrics.lastCpuCheck = cpuUsage;
    
    // Keep only last 100 processing times
    if (this.performanceMetrics.processingTimes.length > 100) {
      this.performanceMetrics.processingTimes = this.performanceMetrics.processingTimes.slice(-100);
    }
  }

  private getPerformanceStats(): ErrorTrackingStats['performance'] {
    const processingTimes = this.performanceMetrics.processingTimes;
    const avgProcessingTime = processingTimes.length > 0 ?
      processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0;
    
    return {
      avgProcessingTime,
      memoryUsage: this.performanceMetrics.lastMemoryCheck,
      cpuUsage: this.performanceMetrics.lastCpuCheck.user / 1000000, // Convert to seconds
      queueSize: 0 // Would need to implement queue monitoring
    };
  }

  private recordProcessingTime(startTime: bigint): void {
    const endTime = process.hrtime.bigint();
    const processingTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    this.performanceMetrics.processingTimes.push(processingTime);
  }

  private calculateProcessingTime(startTime: bigint): number {
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1000000; // Convert to milliseconds
  }

  private async generateHealthReport(): Promise<void> {
    try {
      const stats = await this.getStats();
      
      this.emit('health_report', {
        timestamp: Date.now(),
        stats,
        status: this.calculateOverallHealth(stats)
      });
      
    } catch (error) {
      logger.error('Failed to generate health report', { error: error.message });
    }
  }

  private calculateOverallHealth(stats: ErrorTrackingStats): 'healthy' | 'degraded' | 'critical' {
    let score = 100;
    
    // Penalize based on error rate
    if (stats.errorTracking.errorRate > 0.1) score -= 30; // >10% error rate
    else if (stats.errorTracking.errorRate > 0.05) score -= 15; // >5% error rate
    
    // Penalize based on critical errors
    if (stats.errorTracking.criticalErrors > 5) score -= 25;
    else if (stats.errorTracking.criticalErrors > 0) score -= 10;
    
    // Penalize based on notification delivery rate
    if (stats.notifications.deliveryRate < 0.9) score -= 20; // <90% delivery rate
    else if (stats.notifications.deliveryRate < 0.95) score -= 10; // <95% delivery rate
    
    // Penalize based on alert escalation rate
    if (stats.alerting.escalationRate > 0.2) score -= 15; // >20% escalation rate
    
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'degraded';
    return 'critical';
  }

  private async syncWithIntegrations(): Promise<void> {
    // Sync data with external integrations
    try {
      // This would implement periodic sync with external services
      logger.debug('Syncing with external integrations');
    } catch (error) {
      logger.error('Failed to sync with integrations', { error: error.message });
    }
  }

  // External Integration Methods (stubs - would need actual implementation)
  
  private async initializeSentry(): Promise<void> {
    logger.info('Initializing Sentry integration');
    // Implementation would go here
  }

  private async initializeDatadog(): Promise<void> {
    logger.info('Initializing Datadog integration');
    // Implementation would go here
  }

  private async initializeNewRelic(): Promise<void> {
    logger.info('Initializing New Relic integration');
    // Implementation would go here
  }

  private async initializeElasticsearch(): Promise<void> {
    logger.info('Initializing Elasticsearch integration');
    // Implementation would go here
  }

  private async sendToSentry(errorEvent: any): Promise<void> {
    // Send error to Sentry
    logger.debug('Forwarding error to Sentry', { errorId: errorEvent.id });
  }

  private async sendToDatadog(errorEvent: any): Promise<void> {
    // Send error to Datadog
    logger.debug('Forwarding error to Datadog', { errorId: errorEvent.id });
  }

  private async sendToNewRelic(errorEvent: any): Promise<void> {
    // Send error to New Relic
    logger.debug('Forwarding error to New Relic', { errorId: errorEvent.id });
  }

  private async sendToElasticsearch(errorEvent: any): Promise<void> {
    // Send error to Elasticsearch
    logger.debug('Forwarding error to Elasticsearch', { errorId: errorEvent.id });
  }

  destroy(): void {
    this.removeAllListeners();
    this.errorTracker.destroy();
    this.alertManager.destroy();
    this.notificationService.destroy();
  }
}