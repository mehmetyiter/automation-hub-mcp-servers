import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotificationService } from '../notifications/NotificationService';
import { EscalationEngine } from './EscalationEngine';
import { AlertStorage } from '../storage/AlertStorage';

export interface Alert {
  id: string;
  type: 'error' | 'performance' | 'security' | 'infrastructure' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  title: string;
  message: string;
  source: string;
  fingerprint: string;
  timestamp: number;
  metadata: {
    errorId?: string;
    workflowId?: string;
    nodeId?: string;
    userId?: string;
    executionId?: string;
    stackTrace?: string;
    [key: string]: any;
  };
  context: {
    environment: string;
    service: string;
    version: string;
    tags: string[];
  };
  recipients: {
    users: string[];
    channels: string[];
    integrations: string[];
  };
  escalation: {
    level: number;
    maxLevel: number;
    escalatedAt?: number;
    escalatedTo?: string[];
    suppressUntil?: number;
  };
  acknowledgment?: {
    acknowledgedBy: string;
    acknowledgedAt: number;
    note?: string;
  };
  resolution?: {
    resolvedBy: string;
    resolvedAt: number;
    resolution: string;
    rootCause?: string;
  };
  notifications: NotificationRecord[];
}

export interface NotificationRecord {
  id: string;
  channel: string;
  recipient: string;
  sentAt: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  error?: string;
  retryCount: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  throttle: {
    window: number; // Time window in milliseconds
    maxAlerts: number; // Max alerts per window
  };
  schedule?: {
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
    timezone: string;
    days: number[];    // 0=Sunday, 1=Monday, etc.
  };
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'frequency' | 'pattern' | 'custom';
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'contains' | 'matches';
  value: any;
  timeWindow?: number;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'p95' | 'p99';
}

export interface AlertAction {
  type: 'notify' | 'escalate' | 'suppress' | 'webhook' | 'script';
  config: {
    channels?: string[];
    users?: string[];
    delay?: number;
    suppressFor?: number;
    webhookUrl?: string;
    scriptPath?: string;
    [key: string]: any;
  };
}

export interface AlertingMetrics {
  totalAlerts: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  alertsByStatus: Record<string, number>;
  avgResolutionTime: number;
  avgAcknowledgmentTime: number;
  alertFrequency: Array<{ timestamp: number; count: number }>;
  topAlertSources: Array<{ source: string; count: number }>;
  escalationRate: number;
  suppressionRate: number;
  notificationStats: {
    sent: number;
    delivered: number;
    failed: number;
    byChannel: Record<string, { sent: number; delivered: number; failed: number }>;
  };
}

export class AlertManager extends EventEmitter {
  private alerts = new Map<string, Alert>();
  private alertRules = new Map<string, AlertRule>();
  private alertStorage: AlertStorage;
  private notificationService: NotificationService;
  private escalationEngine: EscalationEngine;
  
  private readonly SUPPRESSION_CACHE = new Map<string, number>();
  private readonly THROTTLE_CACHE = new Map<string, { count: number; windowStart: number }>();
  private readonly MAX_ALERTS_IN_MEMORY = 10000;

  constructor(
    alertStorage: AlertStorage,
    notificationService: NotificationService,
    escalationEngine: EscalationEngine,
    private options: {
      enableRealTimeProcessing?: boolean;
      defaultSeverityLevels?: string[];
      maxRetentionDays?: number;
      enableMetrics?: boolean;
    } = {}
  ) {
    super();
    
    this.alertStorage = alertStorage;
    this.notificationService = notificationService;
    this.escalationEngine = escalationEngine;
    
    this.options = {
      enableRealTimeProcessing: true,
      defaultSeverityLevels: ['low', 'medium', 'high', 'critical'],
      maxRetentionDays: 90,
      enableMetrics: true,
      ...options
    };

    this.setupEventListeners();
    this.startPeriodicTasks();
  }

  private setupEventListeners(): void {
    // Listen to escalation events
    this.escalationEngine.on('escalation_triggered', async (escalation) => {
      await this.handleEscalation(escalation);
    });

    // Listen to notification events
    this.notificationService.on('notification_sent', (notification) => {
      this.updateNotificationStatus(notification.alertId, notification.id, 'sent');
    });

    this.notificationService.on('notification_delivered', (notification) => {
      this.updateNotificationStatus(notification.alertId, notification.id, 'delivered');
    });

    this.notificationService.on('notification_failed', (notification) => {
      this.updateNotificationStatus(notification.alertId, notification.id, 'failed', notification.error);
    });
  }

  private startPeriodicTasks(): void {
    // Clean up old alerts
    setInterval(() => this.cleanupOldAlerts(), 60 * 60 * 1000); // Every hour
    
    // Process escalations
    setInterval(() => this.processEscalations(), 60 * 1000); // Every minute
    
    // Update metrics
    if (this.options.enableMetrics) {
      setInterval(() => this.updateMetrics(), 5 * 60 * 1000); // Every 5 minutes
    }
    
    // Clean up caches
    setInterval(() => this.cleanupCaches(), 30 * 60 * 1000); // Every 30 minutes
  }

  // Create a new alert
  async createAlert(alertData: {
    type: Alert['type'];
    severity: Alert['severity'];
    title: string;
    message: string;
    source?: string;
    metadata?: Record<string, any>;
    context?: Partial<Alert['context']>;
    recipients?: Partial<Alert['recipients']>;
  }): Promise<string> {
    const alert: Alert = {
      id: uuidv4(),
      type: alertData.type,
      severity: alertData.severity,
      status: 'open',
      title: alertData.title,
      message: alertData.message,
      source: alertData.source || 'system',
      fingerprint: this.generateFingerprint(alertData),
      timestamp: Date.now(),
      metadata: alertData.metadata || {},
      context: {
        environment: process.env.NODE_ENV || 'development',
        service: 'n8n-mcp',
        version: process.env.npm_package_version || '1.0.0',
        tags: [],
        ...alertData.context
      },
      recipients: {
        users: [],
        channels: [],
        integrations: [],
        ...alertData.recipients
      },
      escalation: {
        level: 0,
        maxLevel: this.getMaxEscalationLevel(alertData.severity)
      },
      notifications: []
    };

    try {
      // Check if alert should be suppressed
      if (await this.shouldSuppressAlert(alert)) {
        logger.debug('Alert suppressed', {
          alertId: alert.id,
          fingerprint: alert.fingerprint
        });
        return alert.id;
      }

      // Apply alert rules
      await this.applyAlertRules(alert);

      // Check throttling
      if (await this.shouldThrottleAlert(alert)) {
        logger.debug('Alert throttled', {
          alertId: alert.id,
          fingerprint: alert.fingerprint
        });
        return alert.id;
      }

      // Store the alert
      await this.alertStorage.storeAlert(alert);
      this.alerts.set(alert.id, alert);

      // Process the alert
      await this.processAlert(alert);

      // Emit event
      this.emit('alert_created', alert);

      logger.info('Alert created', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });

      return alert.id;

    } catch (error) {
      logger.error('Failed to create alert', {
        error: error.message,
        alertData
      });
      throw error;
    }
  }

  // Acknowledge an alert
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    note?: string
  ): Promise<void> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.status !== 'open') {
      throw new Error(`Alert ${alertId} is not in open status`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgment = {
      acknowledgedBy,
      acknowledgedAt: Date.now(),
      note
    };

    await this.alertStorage.updateAlert(alert);
    this.alerts.set(alertId, alert);

    // Stop escalation
    this.escalationEngine.stopEscalation(alertId);

    this.emit('alert_acknowledged', {
      alertId,
      acknowledgedBy,
      note
    });

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy,
      note
    });
  }

  // Resolve an alert
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string,
    rootCause?: string
  ): Promise<void> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolution = {
      resolvedBy,
      resolvedAt: Date.now(),
      resolution,
      rootCause
    };

    await this.alertStorage.updateAlert(alert);
    this.alerts.set(alertId, alert);

    // Stop escalation
    this.escalationEngine.stopEscalation(alertId);

    this.emit('alert_resolved', {
      alertId,
      resolvedBy,
      resolution,
      rootCause
    });

    logger.info('Alert resolved', {
      alertId,
      resolvedBy,
      resolution
    });
  }

  // Suppress an alert
  async suppressAlert(
    alertId: string,
    suppressedBy: string,
    suppressFor: number,
    reason?: string
  ): Promise<void> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'suppressed';
    alert.escalation.suppressUntil = Date.now() + suppressFor;

    await this.alertStorage.updateAlert(alert);
    this.alerts.set(alertId, alert);

    // Add to suppression cache
    this.SUPPRESSION_CACHE.set(alert.fingerprint, alert.escalation.suppressUntil!);

    // Stop escalation
    this.escalationEngine.stopEscalation(alertId);

    this.emit('alert_suppressed', {
      alertId,
      suppressedBy,
      suppressFor,
      reason
    });

    logger.info('Alert suppressed', {
      alertId,
      suppressedBy,
      suppressFor,
      reason
    });
  }

  // Create or update alert rule
  async createAlertRule(ruleData: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const rule: AlertRule = {
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...ruleData
    };

    await this.alertStorage.storeAlertRule(rule);
    this.alertRules.set(rule.id, rule);

    this.emit('alert_rule_created', rule);

    logger.info('Alert rule created', {
      ruleId: rule.id,
      name: rule.name
    });

    return rule.id;
  }

  // Update alert rule
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: Date.now()
    };

    await this.alertStorage.updateAlertRule(updatedRule);
    this.alertRules.set(ruleId, updatedRule);

    this.emit('alert_rule_updated', updatedRule);

    logger.info('Alert rule updated', {
      ruleId,
      name: updatedRule.name
    });
  }

  // Get alert by ID
  async getAlert(alertId: string): Promise<Alert | null> {
    let alert = this.alerts.get(alertId);
    if (!alert) {
      alert = await this.alertStorage.getAlert(alertId);
      if (alert) {
        this.alerts.set(alertId, alert);
      }
    }
    return alert;
  }

  // Search alerts
  async searchAlerts(query: {
    type?: string;
    severity?: string;
    status?: string;
    source?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: Alert[]; total: number }> {
    return this.alertStorage.searchAlerts(query);
  }

  // Get alerting metrics
  async getMetrics(timeRangeMs: number = 24 * 60 * 60 * 1000): Promise<AlertingMetrics> {
    const endTime = Date.now();
    const startTime = endTime - timeRangeMs;
    
    const alerts = await this.alertStorage.getAlertsInRange(startTime, endTime);
    
    return this.calculateMetrics(alerts);
  }

  // Get alert rules
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  private generateFingerprint(alertData: {
    type: string;
    title: string;
    source?: string;
    metadata?: Record<string, any>;
  }): string {
    // Generate a fingerprint for alert deduplication
    const components = [
      alertData.type,
      alertData.title,
      alertData.source || 'system'
    ];
    
    // Add relevant metadata for fingerprinting
    if (alertData.metadata?.workflowId) {
      components.push(alertData.metadata.workflowId);
    }
    if (alertData.metadata?.nodeId) {
      components.push(alertData.metadata.nodeId);
    }
    
    return Buffer.from(components.join('|')).toString('base64').substring(0, 16);
  }

  private async shouldSuppressAlert(alert: Alert): Promise<boolean> {
    // Check global suppression
    const suppressUntil = this.SUPPRESSION_CACHE.get(alert.fingerprint);
    if (suppressUntil && Date.now() < suppressUntil) {
      return true;
    }

    // Check rule-based suppression
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      if (await this.alertMatchesRule(alert, rule)) {
        const suppressAction = rule.actions.find(action => action.type === 'suppress');
        if (suppressAction && suppressAction.config.suppressFor) {
          return true;
        }
      }
    }

    return false;
  }

  private async shouldThrottleAlert(alert: Alert): Promise<boolean> {
    // Find applicable throttling rules
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      if (await this.alertMatchesRule(alert, rule)) {
        const throttleKey = `${rule.id}:${alert.fingerprint}`;
        const now = Date.now();
        
        let throttleData = this.THROTTLE_CACHE.get(throttleKey);
        
        if (!throttleData || now - throttleData.windowStart > rule.throttle.window) {
          // Start new window
          throttleData = { count: 0, windowStart: now };
        }
        
        throttleData.count++;
        this.THROTTLE_CACHE.set(throttleKey, throttleData);
        
        if (throttleData.count > rule.throttle.maxAlerts) {
          return true;
        }
      }
    }

    return false;
  }

  private async applyAlertRules(alert: Alert): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check schedule
      if (rule.schedule && !this.isWithinSchedule(rule.schedule)) {
        continue;
      }
      
      if (await this.alertMatchesRule(alert, rule)) {
        await this.executeRuleActions(alert, rule);
      }
    }
  }

  private async alertMatchesRule(alert: Alert, rule: AlertRule): Promise<boolean> {
    // Check if alert matches all conditions in the rule
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(alert, condition)) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(alert: Alert, condition: AlertCondition): Promise<boolean> {
    let value: any;
    
    // Get the field value from alert
    if (condition.field.includes('.')) {
      const parts = condition.field.split('.');
      value = parts.reduce((obj, part) => obj?.[part], alert as any);
    } else {
      value = (alert as any)[condition.field];
    }
    
    // Apply operator
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      case 'matches': return new RegExp(condition.value).test(String(value));
      default: return false;
    }
  }

  private async executeRuleActions(alert: Alert, rule: AlertRule): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAction(alert, action);
      } catch (error) {
        logger.error('Failed to execute rule action', {
          ruleId: rule.id,
          actionType: action.type,
          alertId: alert.id,
          error: error.message
        });
      }
    }
  }

  private async executeAction(alert: Alert, action: AlertAction): Promise<void> {
    switch (action.type) {
      case 'notify':
        await this.executeNotifyAction(alert, action);
        break;
      case 'escalate':
        await this.executeEscalateAction(alert, action);
        break;
      case 'suppress':
        await this.executeSuppressAction(alert, action);
        break;
      case 'webhook':
        await this.executeWebhookAction(alert, action);
        break;
      case 'script':
        await this.executeScriptAction(alert, action);
        break;
    }
  }

  private async executeNotifyAction(alert: Alert, action: AlertAction): Promise<void> {
    const { channels = [], users = [], delay = 0 } = action.config;
    
    if (delay > 0) {
      setTimeout(async () => {
        await this.sendNotifications(alert, users, channels);
      }, delay);
    } else {
      await this.sendNotifications(alert, users, channels);
    }
  }

  private async executeEscalateAction(alert: Alert, action: AlertAction): Promise<void> {
    const { delay = 0 } = action.config;
    
    this.escalationEngine.scheduleEscalation(alert.id, delay);
  }

  private async executeSuppressAction(alert: Alert, action: AlertAction): Promise<void> {
    const { suppressFor = 60 * 60 * 1000 } = action.config; // Default 1 hour
    
    this.SUPPRESSION_CACHE.set(alert.fingerprint, Date.now() + suppressFor);
  }

  private async executeWebhookAction(alert: Alert, action: AlertAction): Promise<void> {
    const { webhookUrl } = action.config;
    
    if (!webhookUrl) return;
    
    // This would be implemented with your HTTP client
    logger.info('Webhook action executed', {
      alertId: alert.id,
      webhookUrl
    });
  }

  private async executeScriptAction(alert: Alert, action: AlertAction): Promise<void> {
    const { scriptPath } = action.config;
    
    if (!scriptPath) return;
    
    // This would execute a custom script
    logger.info('Script action executed', {
      alertId: alert.id,
      scriptPath
    });
  }

  private isWithinSchedule(schedule: AlertRule['schedule']): boolean {
    if (!schedule) return true;
    
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Check day of week
    if (!schedule.days.includes(day)) {
      return false;
    }
    
    // Check time range
    const startTime = this.parseTime(schedule.startTime);
    const endTime = this.parseTime(schedule.endTime);
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight schedule
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getMaxEscalationLevel(severity: string): number {
    const levels = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    return levels[severity as keyof typeof levels] || 1;
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Send initial notifications
    await this.sendNotifications(
      alert,
      alert.recipients.users,
      alert.recipients.channels
    );

    // Start escalation if needed
    if (alert.escalation.maxLevel > 0) {
      this.escalationEngine.startEscalation(alert);
    }
  }

  private async sendNotifications(
    alert: Alert,
    users: string[],
    channels: string[]
  ): Promise<void> {
    const notifications: NotificationRecord[] = [];
    
    // Send to users
    for (const userId of users) {
      const notificationId = await this.notificationService.sendNotification({
        alertId: alert.id,
        recipient: userId,
        channel: 'email', // Default channel
        subject: alert.title,
        message: alert.message,
        priority: alert.severity,
        metadata: alert.metadata
      });
      
      notifications.push({
        id: notificationId,
        channel: 'email',
        recipient: userId,
        sentAt: Date.now(),
        status: 'pending',
        retryCount: 0
      });
    }
    
    // Send to channels
    for (const channel of channels) {
      const notificationId = await this.notificationService.sendNotification({
        alertId: alert.id,
        recipient: channel,
        channel: 'slack', // Determine channel type
        subject: alert.title,
        message: alert.message,
        priority: alert.severity,
        metadata: alert.metadata
      });
      
      notifications.push({
        id: notificationId,
        channel: 'slack',
        recipient: channel,
        sentAt: Date.now(),
        status: 'pending',
        retryCount: 0
      });
    }
    
    alert.notifications.push(...notifications);
    await this.alertStorage.updateAlert(alert);
  }

  private async handleEscalation(escalation: any): Promise<void> {
    const alert = await this.getAlert(escalation.alertId);
    if (!alert) return;
    
    alert.escalation.level = escalation.level;
    alert.escalation.escalatedAt = escalation.timestamp;
    alert.escalation.escalatedTo = escalation.recipients;
    
    await this.alertStorage.updateAlert(alert);
    
    // Send escalation notifications
    await this.sendNotifications(alert, escalation.recipients, []);
    
    this.emit('alert_escalated', {
      alertId: alert.id,
      level: escalation.level,
      recipients: escalation.recipients
    });
  }

  private updateNotificationStatus(
    alertId: string,
    notificationId: string,
    status: NotificationRecord['status'],
    error?: string
  ): void {
    const alert = this.alerts.get(alertId);
    if (!alert) return;
    
    const notification = alert.notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    notification.status = status;
    if (error) {
      notification.error = error;
    }
    
    // Update in storage (async, don't wait)
    this.alertStorage.updateAlert(alert).catch(err => {
      logger.error('Failed to update notification status', {
        alertId,
        notificationId,
        error: err.message
      });
    });
  }

  private async processEscalations(): Promise<void> {
    // This would check for alerts that need escalation
    const openAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === 'open');
    
    for (const alert of openAlerts) {
      this.escalationEngine.checkEscalation(alert);
    }
  }

  private calculateMetrics(alerts: Alert[]): AlertingMetrics {
    const totalAlerts = alerts.length;
    
    const alertsByType = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const alertsBySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const alertsByStatus = alerts.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate resolution times
    const resolvedAlerts = alerts.filter(a => a.resolution?.resolvedAt);
    const avgResolutionTime = resolvedAlerts.length > 0 ?
      resolvedAlerts.reduce((sum, alert) => 
        sum + (alert.resolution!.resolvedAt - alert.timestamp), 0
      ) / resolvedAlerts.length : 0;
    
    // Calculate acknowledgment times
    const acknowledgedAlerts = alerts.filter(a => a.acknowledgment?.acknowledgedAt);
    const avgAcknowledgmentTime = acknowledgedAlerts.length > 0 ?
      acknowledgedAlerts.reduce((sum, alert) => 
        sum + (alert.acknowledgment!.acknowledgedAt - alert.timestamp), 0
      ) / acknowledgedAlerts.length : 0;
    
    // Calculate notification stats
    const allNotifications = alerts.flatMap(a => a.notifications);
    const notificationStats = {
      sent: allNotifications.filter(n => n.status === 'sent').length,
      delivered: allNotifications.filter(n => n.status === 'delivered').length,
      failed: allNotifications.filter(n => n.status === 'failed').length,
      byChannel: {} as Record<string, { sent: number; delivered: number; failed: number }>
    };
    
    // Group by channel
    for (const notification of allNotifications) {
      if (!notificationStats.byChannel[notification.channel]) {
        notificationStats.byChannel[notification.channel] = { sent: 0, delivered: 0, failed: 0 };
      }
      
      if (notification.status === 'sent') notificationStats.byChannel[notification.channel].sent++;
      if (notification.status === 'delivered') notificationStats.byChannel[notification.channel].delivered++;
      if (notification.status === 'failed') notificationStats.byChannel[notification.channel].failed++;
    }
    
    return {
      totalAlerts,
      alertsByType,
      alertsBySeverity,
      alertsByStatus,
      avgResolutionTime,
      avgAcknowledgmentTime,
      alertFrequency: this.calculateAlertFrequency(alerts),
      topAlertSources: this.calculateTopSources(alerts),
      escalationRate: alerts.filter(a => a.escalation.level > 0).length / totalAlerts,
      suppressionRate: alerts.filter(a => a.status === 'suppressed').length / totalAlerts,
      notificationStats
    };
  }

  private calculateAlertFrequency(alerts: Alert[]): Array<{ timestamp: number; count: number }> {
    const bucketSize = 60 * 60 * 1000; // 1 hour buckets
    const buckets = new Map<number, number>();
    
    alerts.forEach(alert => {
      const bucket = Math.floor(alert.timestamp / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });
    
    return Array.from(buckets.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateTopSources(alerts: Alert[]): Array<{ source: string; count: number }> {
    const sources = alerts.reduce((acc, alert) => {
      acc[alert.source] = (acc[alert.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(sources)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private async updateMetrics(): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      this.emit('metrics_updated', metrics);
    } catch (error) {
      logger.error('Failed to update metrics', { error: error.message });
    }
  }

  private cleanupOldAlerts(): void {
    const maxAge = (this.options.maxRetentionDays || 90) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    
    let cleanedCount = 0;
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoff) {
        this.alerts.delete(id);
        cleanedCount++;
      }
    }
    
    // Also maintain memory limit
    if (this.alerts.size > this.MAX_ALERTS_IN_MEMORY) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort(([, a], [, b]) => b.timestamp - a.timestamp);
      
      this.alerts.clear();
      sortedAlerts.slice(0, this.MAX_ALERTS_IN_MEMORY).forEach(([id, alert]) => {
        this.alerts.set(id, alert);
      });
    }
    
    if (cleanedCount > 0) {
      logger.debug('Cleaned up old alerts', { cleanedCount });
    }
  }

  private cleanupCaches(): void {
    const now = Date.now();
    
    // Clean suppression cache
    for (const [fingerprint, suppressUntil] of this.SUPPRESSION_CACHE.entries()) {
      if (now > suppressUntil) {
        this.SUPPRESSION_CACHE.delete(fingerprint);
      }
    }
    
    // Clean throttle cache
    for (const [key, data] of this.THROTTLE_CACHE.entries()) {
      if (now - data.windowStart > 24 * 60 * 60 * 1000) { // 24 hours
        this.THROTTLE_CACHE.delete(key);
      }
    }
  }

  destroy(): void {
    this.removeAllListeners();
    this.alerts.clear();
    this.alertRules.clear();
    this.SUPPRESSION_CACHE.clear();
    this.THROTTLE_CACHE.clear();
  }
}