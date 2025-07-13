import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { Client as SlackClient } from '@slack/web-api';
import Twilio from 'twilio';
import axios from 'axios';
import { logger } from '../utils/logger';
import { HealthCheck, HealthCheckResult, SystemMetrics, IncidentDefinition } from '../core/HealthMonitor';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  filters: {
    checkIds?: string[];
    checkTypes?: string[];
    tags?: string[];
    severity?: string[];
  };
  throttling: {
    enabled: boolean;
    windowMinutes: number;
    maxAlerts: number;
  };
  schedule?: {
    enabled: boolean;
    timeZone: string;
    allowedHours: {
      start: string; // HH:MM
      end: string;   // HH:MM
    };
    allowedDays: number[]; // 0=Sunday, 1=Monday, etc.
  };
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface AlertCondition {
  type: 'health_check_failed' | 'response_time_threshold' | 'uptime_threshold' | 'system_metric' | 'incident_created';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number | string;
  field?: string; // For system metrics: 'cpu.usage', 'memory.usagePercent', etc.
  timeWindow?: number; // milliseconds
  consecutiveFailures?: number;
}

export interface AlertAction {
  type: 'email' | 'slack' | 'sms' | 'webhook' | 'pagerduty' | 'create_incident';
  config: {
    // Email
    recipients?: string[];
    subject?: string;
    template?: string;
    
    // Slack
    channel?: string;
    username?: string;
    iconEmoji?: string;
    
    // SMS
    phoneNumbers?: string[];
    
    // Webhook
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    
    // PagerDuty
    integrationKey?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    
    // Incident
    incidentTitle?: string;
    incidentSeverity?: 'low' | 'medium' | 'high' | 'critical';
    assignedTo?: string;
  };
  delay?: number; // milliseconds
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: number;
  resolvedAt?: number;
  status: 'firing' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: {
    type: 'health_check' | 'system_metric' | 'incident';
    id: string;
    name: string;
  };
  context: {
    checkId?: string;
    checkResult?: HealthCheckResult;
    systemMetrics?: SystemMetrics;
    incidentId?: string;
    values?: Record<string, any>;
  };
  actions: Array<{
    type: string;
    status: 'pending' | 'sent' | 'failed';
    sentAt?: number;
    error?: string;
  }>;
  metadata: Record<string, any>;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'sms' | 'webhook' | 'pagerduty';
  name: string;
  enabled: boolean;
  config: {
    // Email
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    fromEmail?: string;
    
    // Slack
    token?: string;
    defaultChannel?: string;
    
    // SMS
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    
    // Webhook
    defaultUrl?: string;
    defaultHeaders?: Record<string, string>;
    
    // PagerDuty
    integrationKey?: string;
  };
  testConfig?: {
    lastTested?: number;
    testResult?: boolean;
    testError?: string;
  };
}

export class HealthAlerting extends EventEmitter {
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private notificationChannels = new Map<string, NotificationChannel>();
  private alertThrottleCache = new Map<string, Array<{ timestamp: number; alertId: string }>>();
  
  private emailTransporter?: nodemailer.Transporter;
  private slackClient?: SlackClient;
  private twilioClient?: Twilio.Twilio;

  constructor(
    private options: {
      enableThrottling?: boolean;
      defaultThrottleWindow?: number;
      maxActiveAlerts?: number;
      enableScheduling?: boolean;
    } = {}
  ) {
    super();
    
    this.options = {
      enableThrottling: true,
      defaultThrottleWindow: 15 * 60 * 1000, // 15 minutes
      maxActiveAlerts: 1000,
      enableScheduling: true,
      ...options
    };

    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Clean up resolved alerts and throttle cache
    setInterval(() => this.cleanupAlerts(), 60 * 60 * 1000); // Every hour
    
    // Clean up throttle cache
    setInterval(() => this.cleanupThrottleCache(), 30 * 60 * 1000); // Every 30 minutes
  }

  // Alert Rules Management

  async addAlertRule(ruleData: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ruleId = uuidv4();
    const now = Date.now();

    const alertRule: AlertRule = {
      id: ruleId,
      createdAt: now,
      updatedAt: now,
      throttling: {
        enabled: true,
        windowMinutes: 15,
        maxAlerts: 3
      },
      ...ruleData
    };

    this.alertRules.set(ruleId, alertRule);

    this.emit('alert_rule_added', alertRule);

    logger.info('Alert rule added', {
      ruleId,
      name: alertRule.name,
      enabled: alertRule.enabled
    });

    return ruleId;
  }

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

    this.alertRules.set(ruleId, updatedRule);

    this.emit('alert_rule_updated', updatedRule);

    logger.info('Alert rule updated', { ruleId, name: updatedRule.name });
  }

  async removeAlertRule(ruleId: string): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return;
    }

    this.alertRules.delete(ruleId);

    this.emit('alert_rule_removed', { ruleId, name: rule.name });

    logger.info('Alert rule removed', { ruleId, name: rule.name });
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  // Notification Channels Management

  async addNotificationChannel(channelData: Omit<NotificationChannel, 'id'>): Promise<string> {
    const channelId = uuidv4();

    const channel: NotificationChannel = {
      id: channelId,
      ...channelData
    };

    this.notificationChannels.set(channelId, channel);

    // Initialize channel-specific clients
    await this.initializeChannel(channel);

    this.emit('notification_channel_added', channel);

    logger.info('Notification channel added', {
      channelId,
      type: channel.type,
      name: channel.name
    });

    return channelId;
  }

  async testNotificationChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    const channel = this.notificationChannels.get(channelId);
    if (!channel) {
      throw new Error(`Notification channel not found: ${channelId}`);
    }

    try {
      const testAlert: Alert = {
        id: 'test-alert',
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        triggeredAt: Date.now(),
        status: 'firing',
        severity: 'low',
        title: 'Test Alert',
        message: 'This is a test alert to verify channel configuration.',
        source: {
          type: 'health_check',
          id: 'test-check',
          name: 'Test Check'
        },
        context: {},
        actions: [],
        metadata: {}
      };

      const action: AlertAction = {
        type: channel.type,
        config: this.getChannelActionConfig(channel)
      };

      await this.executeAction(testAlert, action);

      // Update test result
      channel.testConfig = {
        lastTested: Date.now(),
        testResult: true
      };

      return { success: true };

    } catch (error) {
      // Update test result
      channel.testConfig = {
        lastTested: Date.now(),
        testResult: false,
        testError: error.message
      };

      return { success: false, error: error.message };
    }
  }

  // Alert Processing

  async processHealthCheckResult(healthCheck: HealthCheck, result: HealthCheckResult): Promise<void> {
    const applicableRules = this.getApplicableRules('health_check_failed', {
      checkId: healthCheck.id,
      checkType: healthCheck.type,
      tags: healthCheck.tags
    });

    for (const rule of applicableRules) {
      await this.evaluateRule(rule, {
        type: 'health_check',
        healthCheck,
        result
      });
    }
  }

  async processSystemMetrics(metrics: SystemMetrics): Promise<void> {
    const applicableRules = this.getApplicableRules('system_metric');

    for (const rule of applicableRules) {
      await this.evaluateRule(rule, {
        type: 'system_metric',
        metrics
      });
    }
  }

  async processIncident(incident: IncidentDefinition): Promise<void> {
    const applicableRules = this.getApplicableRules('incident_created');

    for (const rule of applicableRules) {
      await this.evaluateRule(rule, {
        type: 'incident',
        incident
      });
    }
  }

  // Alert Management

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    alert.metadata.resolvedBy = resolvedBy;

    this.emit('alert_resolved', alert);

    logger.info('Alert resolved', {
      alertId,
      ruleName: alert.ruleName,
      resolvedBy
    });
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'firing');
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  private getApplicableRules(conditionType: string, filters?: any): AlertRule[] {
    return Array.from(this.alertRules.values()).filter(rule => {
      if (!rule.enabled) return false;

      // Check if rule has the condition type
      const hasCondition = rule.conditions.some(condition => condition.type === conditionType);
      if (!hasCondition) return false;

      // Check filters
      if (filters && rule.filters) {
        if (filters.checkId && rule.filters.checkIds && !rule.filters.checkIds.includes(filters.checkId)) {
          return false;
        }
        if (filters.checkType && rule.filters.checkTypes && !rule.filters.checkTypes.includes(filters.checkType)) {
          return false;
        }
        if (filters.tags && rule.filters.tags) {
          const hasMatchingTag = filters.tags.some((tag: string) => rule.filters.tags!.includes(tag));
          if (!hasMatchingTag) return false;
        }
      }

      // Check schedule
      if (this.options.enableScheduling && rule.schedule?.enabled) {
        if (!this.isWithinSchedule(rule.schedule)) {
          return false;
        }
      }

      return true;
    });
  }

  private async evaluateRule(rule: AlertRule, context: any): Promise<void> {
    for (const condition of rule.conditions) {
      const conditionMet = await this.evaluateCondition(condition, context);
      
      if (conditionMet) {
        // Check throttling
        if (this.options.enableThrottling && rule.throttling.enabled) {
          if (this.isThrottled(rule)) {
            logger.debug('Alert throttled', { ruleId: rule.id, ruleName: rule.name });
            continue;
          }
        }

        // Create alert
        const alert = await this.createAlert(rule, condition, context);
        
        // Execute actions
        await this.executeAlertActions(alert, rule.actions);
        
        // Add to throttle cache
        if (this.options.enableThrottling && rule.throttling.enabled) {
          this.addToThrottleCache(rule, alert);
        }

        break; // Only trigger once per rule evaluation
      }
    }
  }

  private async evaluateCondition(condition: AlertCondition, context: any): Promise<boolean> {
    switch (condition.type) {
      case 'health_check_failed':
        return this.evaluateHealthCheckCondition(condition, context);
      
      case 'response_time_threshold':
        return this.evaluateResponseTimeCondition(condition, context);
      
      case 'uptime_threshold':
        return this.evaluateUptimeCondition(condition, context);
      
      case 'system_metric':
        return this.evaluateSystemMetricCondition(condition, context);
      
      case 'incident_created':
        return this.evaluateIncidentCondition(condition, context);
      
      default:
        return false;
    }
  }

  private evaluateHealthCheckCondition(condition: AlertCondition, context: any): boolean {
    if (context.type !== 'health_check') return false;
    
    const result = context.result as HealthCheckResult;
    return !result.success || result.status === 'critical' || result.status === 'warning';
  }

  private evaluateResponseTimeCondition(condition: AlertCondition, context: any): boolean {
    if (context.type !== 'health_check') return false;
    
    const result = context.result as HealthCheckResult;
    const value = result.responseTime;
    
    return this.compareValues(value, condition.operator, condition.value as number);
  }

  private evaluateUptimeCondition(condition: AlertCondition, context: any): boolean {
    // This would require historical data analysis
    // For now, return false as placeholder
    return false;
  }

  private evaluateSystemMetricCondition(condition: AlertCondition, context: any): boolean {
    if (context.type !== 'system_metric') return false;
    
    const metrics = context.metrics as SystemMetrics;
    const value = this.getMetricValue(metrics, condition.field!);
    
    if (value === undefined) return false;
    
    return this.compareValues(value, condition.operator, condition.value as number);
  }

  private evaluateIncidentCondition(condition: AlertCondition, context: any): boolean {
    if (context.type !== 'incident') return false;
    
    const incident = context.incident as IncidentDefinition;
    
    // Check if incident matches condition criteria
    if (condition.value && incident.severity !== condition.value) {
      return false;
    }
    
    return true;
  }

  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      default: return false;
    }
  }

  private getMetricValue(metrics: SystemMetrics, field: string): number | undefined {
    const parts = field.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return typeof value === 'number' ? value : undefined;
  }

  private async createAlert(rule: AlertRule, condition: AlertCondition, context: any): Promise<Alert> {
    const alertId = uuidv4();
    const now = Date.now();

    let title = `Alert: ${rule.name}`;
    let message = `Alert triggered by rule: ${rule.name}`;
    let severity: Alert['severity'] = 'medium';
    let source: Alert['source'];

    // Customize based on context
    switch (context.type) {
      case 'health_check':
        const healthCheck = context.healthCheck as HealthCheck;
        const result = context.result as HealthCheckResult;
        title = `Health Check Failed: ${healthCheck.name}`;
        message = `Health check "${healthCheck.name}" failed: ${result.message}`;
        severity = result.status === 'critical' ? 'critical' : 'warning';
        source = {
          type: 'health_check',
          id: healthCheck.id,
          name: healthCheck.name
        };
        break;

      case 'system_metric':
        const metrics = context.metrics as SystemMetrics;
        title = `System Metric Alert: ${condition.field}`;
        message = `System metric "${condition.field}" exceeded threshold`;
        severity = 'warning';
        source = {
          type: 'system_metric',
          id: 'system',
          name: 'System Metrics'
        };
        break;

      case 'incident':
        const incident = context.incident as IncidentDefinition;
        title = `Incident Created: ${incident.title}`;
        message = `New incident: ${incident.description}`;
        severity = incident.severity as Alert['severity'];
        source = {
          type: 'incident',
          id: incident.id,
          name: incident.title
        };
        break;

      default:
        source = {
          type: 'health_check',
          id: 'unknown',
          name: 'Unknown'
        };
    }

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      triggeredAt: now,
      status: 'firing',
      severity,
      title,
      message,
      source,
      context: {
        checkId: context.healthCheck?.id,
        checkResult: context.result,
        systemMetrics: context.metrics,
        incidentId: context.incident?.id
      },
      actions: [],
      metadata: {}
    };

    this.activeAlerts.set(alertId, alert);

    this.emit('alert_created', alert);

    logger.warn('Alert created', {
      alertId,
      ruleName: rule.name,
      severity,
      title
    });

    return alert;
  }

  private async executeAlertActions(alert: Alert, actions: AlertAction[]): Promise<void> {
    for (const action of actions) {
      try {
        // Add delay if specified
        if (action.delay && action.delay > 0) {
          setTimeout(() => this.executeAction(alert, action), action.delay);
        } else {
          await this.executeAction(alert, action);
        }
      } catch (error) {
        logger.error('Failed to execute alert action', {
          alertId: alert.id,
          actionType: action.type,
          error: error.message
        });

        alert.actions.push({
          type: action.type,
          status: 'failed',
          sentAt: Date.now(),
          error: error.message
        });
      }
    }
  }

  private async executeAction(alert: Alert, action: AlertAction): Promise<void> {
    logger.debug('Executing alert action', {
      alertId: alert.id,
      actionType: action.type
    });

    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(alert, action);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, action);
        break;
      case 'sms':
        await this.sendSMSAlert(alert, action);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, action);
        break;
      case 'pagerduty':
        await this.sendPagerDutyAlert(alert, action);
        break;
      case 'create_incident':
        await this.createIncidentFromAlert(alert, action);
        break;
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }

    alert.actions.push({
      type: action.type,
      status: 'sent',
      sentAt: Date.now()
    });
  }

  private async sendEmailAlert(alert: Alert, action: AlertAction): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const emailChannel = Array.from(this.notificationChannels.values())
      .find(c => c.type === 'email' && c.enabled);

    if (!emailChannel) {
      throw new Error('No email channel configured');
    }

    const subject = action.config.subject || alert.title;
    const recipients = action.config.recipients || [];

    const mailOptions = {
      from: emailChannel.config.fromEmail,
      to: recipients.join(', '),
      subject,
      html: this.formatEmailAlert(alert),
      text: alert.message
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  private async sendSlackAlert(alert: Alert, action: AlertAction): Promise<void> {
    if (!this.slackClient) {
      throw new Error('Slack client not configured');
    }

    const channel = action.config.channel || '#alerts';
    const blocks = this.formatSlackAlert(alert);

    await this.slackClient.chat.postMessage({
      channel,
      text: alert.title,
      blocks,
      username: action.config.username || 'Health Monitor',
      icon_emoji: action.config.iconEmoji || ':warning:'
    });
  }

  private async sendSMSAlert(alert: Alert, action: AlertAction): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    const smsChannel = Array.from(this.notificationChannels.values())
      .find(c => c.type === 'sms' && c.enabled);

    if (!smsChannel) {
      throw new Error('No SMS channel configured');
    }

    const phoneNumbers = action.config.phoneNumbers || [];
    const message = `${alert.title}\n\n${alert.message}`;

    for (const phoneNumber of phoneNumbers) {
      await this.twilioClient.messages.create({
        body: message,
        from: smsChannel.config.twilioFromNumber!,
        to: phoneNumber
      });
    }
  }

  private async sendWebhookAlert(alert: Alert, action: AlertAction): Promise<void> {
    const url = action.config.url;
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert,
      timestamp: Date.now(),
      type: 'alert'
    };

    await axios({
      method: action.config.method || 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
        ...action.config.headers
      },
      data: action.config.body ? JSON.parse(action.config.body) : payload,
      timeout: 30000
    });
  }

  private async sendPagerDutyAlert(alert: Alert, action: AlertAction): Promise<void> {
    const integrationKey = action.config.integrationKey;
    if (!integrationKey) {
      throw new Error('PagerDuty integration key not configured');
    }

    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        source: alert.source.name,
        severity: action.config.severity || 'error',
        component: alert.source.type,
        group: 'health-monitoring',
        class: alert.severity,
        custom_details: {
          alert_id: alert.id,
          rule_name: alert.ruleName,
          message: alert.message,
          triggered_at: new Date(alert.triggeredAt).toISOString()
        }
      }
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  private async createIncidentFromAlert(alert: Alert, action: AlertAction): Promise<void> {
    // This would integrate with the incident management system
    const incidentData = {
      title: action.config.incidentTitle || alert.title,
      description: alert.message,
      severity: action.config.incidentSeverity || alert.severity,
      source: 'alert',
      alertId: alert.id,
      assignedTo: action.config.assignedTo
    };

    this.emit('incident_creation_requested', incidentData);
  }

  private formatEmailAlert(alert: Alert): string {
    return `
      <html>
        <body>
          <h2 style="color: ${this.getSeverityColor(alert.severity)};">
            ${alert.title}
          </h2>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Triggered:</strong> ${new Date(alert.triggeredAt).toISOString()}</p>
          <p><strong>Source:</strong> ${alert.source.name}</p>
          <p><strong>Message:</strong></p>
          <p>${alert.message}</p>
          
          ${alert.context.checkResult ? `
            <h3>Health Check Details</h3>
            <ul>
              <li><strong>Response Time:</strong> ${alert.context.checkResult.responseTime}ms</li>
              <li><strong>Status:</strong> ${alert.context.checkResult.status}</li>
              <li><strong>Success:</strong> ${alert.context.checkResult.success}</li>
            </ul>
          ` : ''}
          
          <hr>
          <p><small>Generated by n8n-MCP Health Monitor</small></p>
        </body>
      </html>
    `;
  }

  private formatSlackAlert(alert: Alert): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${alert.title}*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:* ${alert.severity.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Source:* ${alert.source.name}`
          },
          {
            type: 'mrkdwn',
            text: `*Triggered:* <!date^${Math.floor(alert.triggeredAt / 1000)}^{date_short} {time}|${new Date(alert.triggeredAt).toISOString()}>`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: alert.message
        }
      }
    ];
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      low: '#36a64f',
      medium: '#ffcc00',
      high: '#ff6b35',
      critical: '#ff0000'
    };
    return colors[severity as keyof typeof colors] || '#808080';
  }

  private getChannelActionConfig(channel: NotificationChannel): any {
    switch (channel.type) {
      case 'email':
        return {
          recipients: ['test@example.com']
        };
      case 'slack':
        return {
          channel: channel.config.defaultChannel || '#test'
        };
      case 'sms':
        return {
          phoneNumbers: ['+1234567890']
        };
      case 'webhook':
        return {
          url: channel.config.defaultUrl
        };
      case 'pagerduty':
        return {
          integrationKey: channel.config.integrationKey
        };
      default:
        return {};
    }
  }

  private async initializeChannel(channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        if (channel.config.smtp) {
          this.emailTransporter = nodemailer.createTransporter(channel.config.smtp);
        }
        break;
      case 'slack':
        if (channel.config.token) {
          this.slackClient = new SlackClient(channel.config.token);
        }
        break;
      case 'sms':
        if (channel.config.twilioAccountSid && channel.config.twilioAuthToken) {
          this.twilioClient = Twilio(
            channel.config.twilioAccountSid,
            channel.config.twilioAuthToken
          );
        }
        break;
    }
  }

  private isThrottled(rule: AlertRule): boolean {
    const throttleKey = rule.id;
    const now = Date.now();
    const windowMs = rule.throttling.windowMinutes * 60 * 1000;
    
    const recentAlerts = this.alertThrottleCache.get(throttleKey) || [];
    const alertsInWindow = recentAlerts.filter(entry => now - entry.timestamp <= windowMs);
    
    return alertsInWindow.length >= rule.throttling.maxAlerts;
  }

  private addToThrottleCache(rule: AlertRule, alert: Alert): void {
    const throttleKey = rule.id;
    const entry = { timestamp: Date.now(), alertId: alert.id };
    
    if (!this.alertThrottleCache.has(throttleKey)) {
      this.alertThrottleCache.set(throttleKey, []);
    }
    
    this.alertThrottleCache.get(throttleKey)!.push(entry);
  }

  private isWithinSchedule(schedule: AlertRule['schedule']): boolean {
    if (!schedule) return true;
    
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Check day of week
    if (!schedule.allowedDays.includes(day)) {
      return false;
    }
    
    // Check time range
    const startTime = this.parseTime(schedule.allowedHours.start);
    const endTime = this.parseTime(schedule.allowedHours.end);
    
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

  private cleanupAlerts(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - maxAge;
    
    let cleanedCount = 0;
    
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.status === 'resolved' && 
          alert.resolvedAt && 
          alert.resolvedAt < cutoff) {
        this.activeAlerts.delete(alertId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Cleaned up old alerts', { cleanedCount });
    }
  }

  private cleanupThrottleCache(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const cutoff = Date.now() - maxAge;
    
    for (const [key, entries] of this.alertThrottleCache.entries()) {
      const filteredEntries = entries.filter(entry => entry.timestamp > cutoff);
      
      if (filteredEntries.length === 0) {
        this.alertThrottleCache.delete(key);
      } else {
        this.alertThrottleCache.set(key, filteredEntries);
      }
    }
  }

  destroy(): void {
    this.removeAllListeners();
    this.alertRules.clear();
    this.activeAlerts.clear();
    this.notificationChannels.clear();
    this.alertThrottleCache.clear();
  }
}