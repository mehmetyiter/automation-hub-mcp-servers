import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { Client as SlackClient } from '@slack/web-api';
import { Client as DiscordClient, TextChannel } from 'discord.js';
import Twilio from 'twilio';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface NotificationRequest {
  alertId: string;
  recipient: string;
  channel: 'email' | 'slack' | 'discord' | 'sms' | 'webhook' | 'push';
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  template?: string;
  attachments?: NotificationAttachment[];
}

export interface NotificationAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string;
  bodyTemplate: string;
  variables: string[];
  formatting: {
    html?: boolean;
    markdown?: boolean;
    rich?: boolean;
  };
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'discord' | 'sms' | 'webhook' | 'push';
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
    slackToken?: string;
    slackChannel?: string;
    
    // Discord
    discordToken?: string;
    discordChannelId?: string;
    
    // SMS
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    
    // Webhook
    webhookUrl?: string;
    webhookHeaders?: Record<string, string>;
    
    // Push
    pushServiceUrl?: string;
    pushApiKey?: string;
  };
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export interface NotificationResult {
  id: string;
  alertId: string;
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt: number;
  deliveredAt?: number;
  error?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  avgDeliveryTime: number;
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    avgDeliveryTime: number;
  }>;
  byPriority: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  errorReasons: Record<string, number>;
  rateLimitHits: number;
}

export class NotificationService extends EventEmitter {
  private channels = new Map<string, NotificationChannel>();
  private templates = new Map<string, NotificationTemplate>();
  private notifications = new Map<string, NotificationResult>();
  
  private emailTransporter?: nodemailer.Transporter;
  private slackClient?: SlackClient;
  private discordClient?: DiscordClient;
  private twilioClient?: Twilio.Twilio;
  
  private readonly RETRY_QUEUE: Array<{
    notificationId: string;
    retryAt: number;
    retryCount: number;
  }> = [];
  
  private readonly RATE_LIMIT_CACHE = new Map<string, {
    minute: { count: number; resetTime: number };
    hour: { count: number; resetTime: number };
  }>();

  constructor(
    private options: {
      enableRetries?: boolean;
      maxRetentionDays?: number;
      enableMetrics?: boolean;
      defaultRetryPolicy?: NotificationChannel['retryPolicy'];
    } = {}
  ) {
    super();
    
    this.options = {
      enableRetries: true,
      maxRetentionDays: 30,
      enableMetrics: true,
      defaultRetryPolicy: {
        maxRetries: 3,
        retryDelay: 60000, // 1 minute
        backoffMultiplier: 2
      },
      ...options
    };

    this.setupPeriodicTasks();
  }

  private setupPeriodicTasks(): void {
    // Process retry queue
    if (this.options.enableRetries) {
      setInterval(() => this.processRetryQueue(), 30000); // Every 30 seconds
    }
    
    // Clean up old notifications
    setInterval(() => this.cleanupOldNotifications(), 60 * 60 * 1000); // Every hour
    
    // Reset rate limits
    setInterval(() => this.resetRateLimits(), 60 * 1000); // Every minute
    
    // Update metrics
    if (this.options.enableMetrics) {
      setInterval(() => this.updateMetrics(), 5 * 60 * 1000); // Every 5 minutes
    }
  }

  // Configure notification channel
  async configureChannel(channel: NotificationChannel): Promise<void> {
    this.channels.set(channel.id, channel);
    
    // Initialize channel-specific clients
    await this.initializeChannelClient(channel);
    
    this.emit('channel_configured', channel);
    
    logger.info('Notification channel configured', {
      channelId: channel.id,
      type: channel.type,
      name: channel.name
    });
  }

  // Add notification template
  addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    
    this.emit('template_added', template);
    
    logger.info('Notification template added', {
      templateId: template.id,
      name: template.name,
      channel: template.channel
    });
  }

  // Send notification
  async sendNotification(request: NotificationRequest): Promise<string> {
    const notificationId = uuidv4();
    
    const notification: NotificationResult = {
      id: notificationId,
      alertId: request.alertId,
      channel: request.channel,
      recipient: request.recipient,
      status: 'pending',
      sentAt: Date.now(),
      retryCount: 0,
      metadata: request.metadata
    };

    this.notifications.set(notificationId, notification);

    try {
      // Check rate limits
      if (await this.isRateLimited(request.channel)) {
        throw new Error('Rate limit exceeded for channel');
      }

      // Process template if specified
      const processedRequest = request.template ? 
        await this.processTemplate(request) : request;

      // Send notification based on channel type
      await this.sendToChannel(processedRequest, notification);

      notification.status = 'sent';
      this.incrementRateLimit(request.channel);
      
      this.emit('notification_sent', notification);

      logger.info('Notification sent', {
        notificationId,
        alertId: request.alertId,
        channel: request.channel,
        recipient: request.recipient
      });

    } catch (error) {
      notification.status = 'failed';
      notification.error = error.message;
      
      // Schedule retry if enabled
      if (this.options.enableRetries) {
        await this.scheduleRetry(notification);
      }
      
      this.emit('notification_failed', notification);

      logger.error('Notification failed', {
        notificationId,
        alertId: request.alertId,
        channel: request.channel,
        error: error.message
      });
    }

    this.notifications.set(notificationId, notification);
    return notificationId;
  }

  // Send bulk notifications
  async sendBulkNotifications(requests: NotificationRequest[]): Promise<string[]> {
    const results = await Promise.allSettled(
      requests.map(request => this.sendNotification(request))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error('Bulk notification failed', {
          index,
          error: result.reason.message
        });
        return '';
      }
    });
  }

  // Get notification status
  getNotification(notificationId: string): NotificationResult | null {
    return this.notifications.get(notificationId) || null;
  }

  // Get metrics
  getMetrics(): NotificationMetrics {
    const notifications = Array.from(this.notifications.values());
    
    return this.calculateMetrics(notifications);
  }

  // Test channel configuration
  async testChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    try {
      const testRequest: NotificationRequest = {
        alertId: 'test',
        recipient: this.getTestRecipient(channel),
        channel: channel.type,
        subject: 'Test Notification',
        message: 'This is a test notification to verify channel configuration.',
        priority: 'low'
      };

      await this.sendToChannel(testRequest, {
        id: 'test',
        alertId: 'test',
        channel: channel.type,
        recipient: testRequest.recipient,
        status: 'pending',
        sentAt: Date.now(),
        retryCount: 0
      });

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async initializeChannelClient(channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        if (channel.config.smtp) {
          this.emailTransporter = nodemailer.createTransporter({
            host: channel.config.smtp.host,
            port: channel.config.smtp.port,
            secure: channel.config.smtp.secure,
            auth: channel.config.smtp.auth
          });
        }
        break;

      case 'slack':
        if (channel.config.slackToken) {
          this.slackClient = new SlackClient(channel.config.slackToken);
        }
        break;

      case 'discord':
        if (channel.config.discordToken) {
          this.discordClient = new DiscordClient({ 
            intents: ['GUILDS', 'GUILD_MESSAGES'] 
          });
          await this.discordClient.login(channel.config.discordToken);
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

  private async processTemplate(request: NotificationRequest): Promise<NotificationRequest> {
    const template = this.templates.get(request.template!);
    if (!template) {
      throw new Error(`Template not found: ${request.template}`);
    }

    // Process template variables
    let subject = template.subject;
    let body = template.bodyTemplate;

    // Replace variables with values from metadata
    if (request.metadata) {
      for (const variable of template.variables) {
        const value = request.metadata[variable] || '';
        const placeholder = `{{${variable}}}`;
        subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
        body = body.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    return {
      ...request,
      subject,
      message: body
    };
  }

  private async sendToChannel(
    request: NotificationRequest,
    notification: NotificationResult
  ): Promise<void> {
    switch (request.channel) {
      case 'email':
        await this.sendEmail(request);
        break;
      case 'slack':
        await this.sendSlack(request);
        break;
      case 'discord':
        await this.sendDiscord(request);
        break;
      case 'sms':
        await this.sendSMS(request);
        break;
      case 'webhook':
        await this.sendWebhook(request);
        break;
      case 'push':
        await this.sendPush(request);
        break;
      default:
        throw new Error(`Unsupported channel type: ${request.channel}`);
    }
  }

  private async sendEmail(request: NotificationRequest): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const channel = Array.from(this.channels.values())
      .find(c => c.type === 'email');

    if (!channel) {
      throw new Error('Email channel not configured');
    }

    const mailOptions = {
      from: channel.config.fromEmail,
      to: request.recipient,
      subject: request.subject,
      text: request.message,
      html: this.formatMessageAsHTML(request.message),
      attachments: request.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }))
    };

    const result = await this.emailTransporter.sendMail(mailOptions);
    
    if (result.rejected && result.rejected.length > 0) {
      throw new Error(`Email rejected: ${result.rejected.join(', ')}`);
    }
  }

  private async sendSlack(request: NotificationRequest): Promise<void> {
    if (!this.slackClient) {
      throw new Error('Slack client not configured');
    }

    const channel = Array.from(this.channels.values())
      .find(c => c.type === 'slack');

    if (!channel) {
      throw new Error('Slack channel not configured');
    }

    const blocks = this.formatSlackMessage(request);

    const result = await this.slackClient.chat.postMessage({
      channel: request.recipient || channel.config.slackChannel!,
      text: request.subject,
      blocks: blocks,
      username: 'n8n-MCP Alerts'
    });

    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
  }

  private async sendDiscord(request: NotificationRequest): Promise<void> {
    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    const channel = this.discordClient.channels.cache.get(request.recipient) as TextChannel;
    if (!channel) {
      throw new Error(`Discord channel not found: ${request.recipient}`);
    }

    const embed = this.formatDiscordEmbed(request);
    await channel.send({ embeds: [embed] });
  }

  private async sendSMS(request: NotificationRequest): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    const channel = Array.from(this.channels.values())
      .find(c => c.type === 'sms');

    if (!channel) {
      throw new Error('SMS channel not configured');
    }

    const message = await this.twilioClient.messages.create({
      body: `${request.subject}\n\n${request.message}`,
      from: channel.config.twilioFromNumber!,
      to: request.recipient
    });

    if (message.errorCode) {
      throw new Error(`SMS error: ${message.errorMessage}`);
    }
  }

  private async sendWebhook(request: NotificationRequest): Promise<void> {
    const channel = Array.from(this.channels.values())
      .find(c => c.type === 'webhook');

    if (!channel) {
      throw new Error('Webhook channel not configured');
    }

    const payload = {
      alertId: request.alertId,
      subject: request.subject,
      message: request.message,
      priority: request.priority,
      recipient: request.recipient,
      timestamp: Date.now(),
      metadata: request.metadata
    };

    const response = await axios.post(channel.config.webhookUrl!, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.webhookHeaders
      },
      timeout: 30000
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Webhook returned status ${response.status}`);
    }
  }

  private async sendPush(request: NotificationRequest): Promise<void> {
    const channel = Array.from(this.channels.values())
      .find(c => c.type === 'push');

    if (!channel) {
      throw new Error('Push channel not configured');
    }

    const payload = {
      recipient: request.recipient,
      title: request.subject,
      body: request.message,
      priority: request.priority,
      data: request.metadata
    };

    const response = await axios.post(channel.config.pushServiceUrl!, payload, {
      headers: {
        'Authorization': `Bearer ${channel.config.pushApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Push service returned status ${response.status}`);
    }
  }

  private formatMessageAsHTML(message: string): string {
    return message
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  private formatSlackMessage(request: NotificationRequest): any[] {
    const color = this.getSeverityColor(request.priority);
    
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${request.subject}*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: request.message
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Priority: ${request.priority.toUpperCase()} | Alert ID: ${request.alertId}`
          }
        ]
      }
    ];
  }

  private formatDiscordEmbed(request: NotificationRequest): any {
    const color = this.getSeverityColorHex(request.priority);
    
    return {
      title: request.subject,
      description: request.message,
      color: parseInt(color.substring(1), 16),
      fields: [
        {
          name: 'Priority',
          value: request.priority.toUpperCase(),
          inline: true
        },
        {
          name: 'Alert ID',
          value: request.alertId,
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'n8n-MCP Alert System'
      }
    };
  }

  private getSeverityColor(priority: string): string {
    const colors = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    };
    return colors[priority as keyof typeof colors] || 'good';
  }

  private getSeverityColorHex(priority: string): string {
    const colors = {
      low: '#36a64f',
      medium: '#ffcc00',
      high: '#ff6b6b',
      critical: '#ff0000'
    };
    return colors[priority as keyof typeof colors] || '#36a64f';
  }

  private getTestRecipient(channel: NotificationChannel): string {
    switch (channel.type) {
      case 'email':
        return 'test@example.com';
      case 'slack':
        return channel.config.slackChannel || '#general';
      case 'discord':
        return channel.config.discordChannelId || 'test-channel';
      case 'sms':
        return '+1234567890';
      case 'webhook':
        return 'webhook-test';
      case 'push':
        return 'test-device-token';
      default:
        return 'test-recipient';
    }
  }

  private async scheduleRetry(notification: NotificationResult): Promise<void> {
    const channel = this.channels.get(notification.channel);
    const retryPolicy = channel?.retryPolicy || this.options.defaultRetryPolicy!;

    if (notification.retryCount >= retryPolicy.maxRetries) {
      logger.warn('Max retries exceeded for notification', {
        notificationId: notification.id,
        retryCount: notification.retryCount
      });
      return;
    }

    const retryDelay = retryPolicy.retryDelay * 
      Math.pow(retryPolicy.backoffMultiplier, notification.retryCount);

    this.RETRY_QUEUE.push({
      notificationId: notification.id,
      retryAt: Date.now() + retryDelay,
      retryCount: notification.retryCount + 1
    });

    logger.info('Notification scheduled for retry', {
      notificationId: notification.id,
      retryCount: notification.retryCount + 1,
      retryDelay
    });
  }

  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const readyRetries = this.RETRY_QUEUE.filter(retry => retry.retryAt <= now);

    for (const retry of readyRetries) {
      const notification = this.notifications.get(retry.notificationId);
      if (!notification) continue;

      try {
        // Find original request (would need to store this)
        // For now, create a minimal request for retry
        const retryRequest: NotificationRequest = {
          alertId: notification.alertId,
          recipient: notification.recipient,
          channel: notification.channel as any,
          subject: 'Retry Notification',
          message: 'This is a retry of a previously failed notification.',
          priority: 'medium'
        };

        await this.sendToChannel(retryRequest, notification);
        
        notification.status = 'sent';
        notification.retryCount = retry.retryCount;
        
        this.emit('notification_sent', notification);

        logger.info('Notification retry successful', {
          notificationId: notification.id,
          retryCount: retry.retryCount
        });

      } catch (error) {
        notification.retryCount = retry.retryCount;
        notification.error = error.message;

        // Schedule another retry if not at max
        await this.scheduleRetry(notification);

        logger.error('Notification retry failed', {
          notificationId: notification.id,
          retryCount: retry.retryCount,
          error: error.message
        });
      }

      // Remove from retry queue
      const index = this.RETRY_QUEUE.indexOf(retry);
      if (index > -1) {
        this.RETRY_QUEUE.splice(index, 1);
      }
    }
  }

  private async isRateLimited(channel: string): Promise<boolean> {
    const channelConfig = Array.from(this.channels.values())
      .find(c => c.type === channel);

    if (!channelConfig) return false;

    const now = Date.now();
    const rateLimitData = this.RATE_LIMIT_CACHE.get(channel);

    if (!rateLimitData) {
      this.RATE_LIMIT_CACHE.set(channel, {
        minute: { count: 0, resetTime: now + 60000 },
        hour: { count: 0, resetTime: now + 3600000 }
      });
      return false;
    }

    // Check minute limit
    if (now > rateLimitData.minute.resetTime) {
      rateLimitData.minute = { count: 0, resetTime: now + 60000 };
    }

    // Check hour limit
    if (now > rateLimitData.hour.resetTime) {
      rateLimitData.hour = { count: 0, resetTime: now + 3600000 };
    }

    return rateLimitData.minute.count >= channelConfig.rateLimits.requestsPerMinute ||
           rateLimitData.hour.count >= channelConfig.rateLimits.requestsPerHour;
  }

  private incrementRateLimit(channel: string): void {
    const rateLimitData = this.RATE_LIMIT_CACHE.get(channel);
    if (rateLimitData) {
      rateLimitData.minute.count++;
      rateLimitData.hour.count++;
    }
  }

  private resetRateLimits(): void {
    const now = Date.now();
    
    for (const [channel, data] of this.RATE_LIMIT_CACHE.entries()) {
      if (now > data.minute.resetTime) {
        data.minute = { count: 0, resetTime: now + 60000 };
      }
      if (now > data.hour.resetTime) {
        data.hour = { count: 0, resetTime: now + 3600000 };
      }
    }
  }

  private calculateMetrics(notifications: NotificationResult[]): NotificationMetrics {
    const totalSent = notifications.filter(n => n.status === 'sent' || n.status === 'delivered').length;
    const totalDelivered = notifications.filter(n => n.status === 'delivered').length;
    const totalFailed = notifications.filter(n => n.status === 'failed').length;
    
    const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;
    
    const deliveredNotifications = notifications.filter(n => n.deliveredAt);
    const avgDeliveryTime = deliveredNotifications.length > 0 ?
      deliveredNotifications.reduce((sum, n) => sum + (n.deliveredAt! - n.sentAt), 0) / deliveredNotifications.length : 0;

    // Group by channel
    const byChannel: NotificationMetrics['byChannel'] = {};
    const channels = [...new Set(notifications.map(n => n.channel))];
    
    for (const channel of channels) {
      const channelNotifications = notifications.filter(n => n.channel === channel);
      const channelSent = channelNotifications.filter(n => n.status === 'sent' || n.status === 'delivered').length;
      const channelDelivered = channelNotifications.filter(n => n.status === 'delivered').length;
      const channelFailed = channelNotifications.filter(n => n.status === 'failed').length;
      
      byChannel[channel] = {
        sent: channelSent,
        delivered: channelDelivered,
        failed: channelFailed,
        deliveryRate: channelSent > 0 ? channelDelivered / channelSent : 0,
        avgDeliveryTime: channelNotifications.filter(n => n.deliveredAt).length > 0 ?
          channelNotifications.filter(n => n.deliveredAt)
            .reduce((sum, n) => sum + (n.deliveredAt! - n.sentAt), 0) /
          channelNotifications.filter(n => n.deliveredAt).length : 0
      };
    }

    // Group by priority
    const byPriority: NotificationMetrics['byPriority'] = {};
    const priorities = ['low', 'medium', 'high', 'critical'];
    
    for (const priority of priorities) {
      const priorityNotifications = notifications.filter(n => 
        n.metadata?.priority === priority
      );
      
      byPriority[priority] = {
        sent: priorityNotifications.filter(n => n.status === 'sent' || n.status === 'delivered').length,
        delivered: priorityNotifications.filter(n => n.status === 'delivered').length,
        failed: priorityNotifications.filter(n => n.status === 'failed').length
      };
    }

    // Error reasons
    const errorReasons: Record<string, number> = {};
    notifications.filter(n => n.error).forEach(n => {
      const reason = n.error!.split(':')[0]; // Get first part of error message
      errorReasons[reason] = (errorReasons[reason] || 0) + 1;
    });

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      deliveryRate,
      avgDeliveryTime,
      byChannel,
      byPriority,
      errorReasons,
      rateLimitHits: 0 // Would need to track this separately
    };
  }

  private updateMetrics(): void {
    try {
      const metrics = this.getMetrics();
      this.emit('metrics_updated', metrics);
    } catch (error) {
      logger.error('Failed to update notification metrics', { error: error.message });
    }
  }

  private cleanupOldNotifications(): void {
    const maxAge = (this.options.maxRetentionDays || 30) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    
    let cleanedCount = 0;
    
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.sentAt < cutoff) {
        this.notifications.delete(id);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Cleaned up old notifications', { cleanedCount });
    }
  }

  destroy(): void {
    this.removeAllListeners();
    
    // Clean up clients
    if (this.discordClient) {
      this.discordClient.destroy();
    }
    
    this.notifications.clear();
    this.channels.clear();
    this.templates.clear();
    this.RATE_LIMIT_CACHE.clear();
  }
}