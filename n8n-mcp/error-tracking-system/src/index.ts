import dotenv from 'dotenv';
import { logger, logError } from './utils/logger';
import { ErrorTrackingIntegration, IntegrationConfig } from './integration/ErrorTrackingIntegration';
import { ErrorTracker } from './core/ErrorTracker';
import { AlertManager } from './alerts/AlertManager';
import { NotificationService } from './notifications/NotificationService';
import { EscalationEngine } from './alerts/EscalationEngine';
import { ErrorStorage } from './storage/ErrorStorage';
import { AlertStorage } from './storage/AlertStorage';
import { ErrorTrackingAPI, APIConfig } from './api/ErrorTrackingAPI';

// Load environment variables
dotenv.config();

class ErrorTrackingSystem {
  private errorTrackingIntegration?: ErrorTrackingIntegration;
  private api?: ErrorTrackingAPI;
  private isShuttingDown = false;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Error Tracking System...');

      // Database configuration
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'error_tracking',
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
      };

      // Initialize storage layers
      const errorStorage = new ErrorStorage(dbConfig);
      const alertStorage = new AlertStorage(dbConfig);
      
      await errorStorage.initialize();
      await alertStorage.initialize();

      // Initialize core components
      const escalationEngine = new EscalationEngine({
        defaultEscalationDelay: parseInt(process.env.ESCALATION_DELAY || '1800000'), // 30 minutes
        maxEscalationLevel: parseInt(process.env.MAX_ESCALATION_LEVEL || '5'),
        enableAutoEscalation: process.env.ENABLE_AUTO_ESCALATION !== 'false',
        enableScheduledCheck: process.env.ENABLE_SCHEDULED_CHECK !== 'false'
      });

      const notificationService = new NotificationService({
        enableRetries: process.env.ENABLE_NOTIFICATION_RETRIES !== 'false',
        maxRetentionDays: parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '30'),
        enableMetrics: process.env.ENABLE_NOTIFICATION_METRICS !== 'false'
      });

      const alertManager = new AlertManager(
        alertStorage,
        notificationService,
        escalationEngine,
        {
          enableRealTimeProcessing: process.env.ENABLE_REALTIME_ALERTS !== 'false',
          defaultSeverityLevels: ['low', 'medium', 'high', 'critical'],
          maxRetentionDays: parseInt(process.env.ALERT_RETENTION_DAYS || '90'),
          enableMetrics: process.env.ENABLE_ALERT_METRICS !== 'false'
        }
      );

      const errorTracker = new ErrorTracker(
        errorStorage,
        alertManager,
        {
          enableRealTimeAlerts: process.env.ENABLE_REALTIME_ALERTS !== 'false',
          enableErrorGrouping: process.env.ENABLE_ERROR_GROUPING !== 'false',
          enableBreadcrumbs: process.env.ENABLE_BREADCRUMBS !== 'false',
          maxRetentionDays: parseInt(process.env.ERROR_RETENTION_DAYS || '30'),
          enableSourceMaps: process.env.ENABLE_SOURCE_MAPS === 'true'
        }
      );

      // Initialize integration configuration
      const integrationConfig: IntegrationConfig = {
        errorTracking: {
          enableRealTimeAlerts: process.env.ENABLE_REALTIME_ALERTS !== 'false',
          enableErrorGrouping: process.env.ENABLE_ERROR_GROUPING !== 'false',
          enableBreadcrumbs: process.env.ENABLE_BREADCRUMBS !== 'false',
          maxRetentionDays: parseInt(process.env.ERROR_RETENTION_DAYS || '30'),
          enableSourceMaps: process.env.ENABLE_SOURCE_MAPS === 'true',
          samplingRate: parseFloat(process.env.ERROR_SAMPLING_RATE || '1.0')
        },
        alerting: {
          enableRealTimeProcessing: process.env.ENABLE_REALTIME_ALERTS !== 'false',
          maxRetentionDays: parseInt(process.env.ALERT_RETENTION_DAYS || '90'),
          enableMetrics: process.env.ENABLE_ALERT_METRICS !== 'false',
          defaultSeverityLevels: ['low', 'medium', 'high', 'critical']
        },
        notifications: {
          enableRetries: process.env.ENABLE_NOTIFICATION_RETRIES !== 'false',
          maxRetentionDays: parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '30'),
          enableMetrics: process.env.ENABLE_NOTIFICATION_METRICS !== 'false',
          channels: {
            email: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
            slack: process.env.ENABLE_SLACK_NOTIFICATIONS !== 'false',
            discord: process.env.ENABLE_DISCORD_NOTIFICATIONS !== 'false',
            sms: process.env.ENABLE_SMS_NOTIFICATIONS !== 'false',
            webhook: process.env.ENABLE_WEBHOOK_NOTIFICATIONS !== 'false',
            push: process.env.ENABLE_PUSH_NOTIFICATIONS !== 'false'
          }
        },
        integrations: {
          ...(process.env.SENTRY_DSN && {
            sentry: {
              dsn: process.env.SENTRY_DSN,
              environment: process.env.NODE_ENV || 'development',
              release: process.env.npm_package_version
            }
          }),
          ...(process.env.DATADOG_API_KEY && {
            datadog: {
              apiKey: process.env.DATADOG_API_KEY,
              appKey: process.env.DATADOG_APP_KEY || '',
              site: process.env.DATADOG_SITE || 'datadoghq.com'
            }
          }),
          ...(process.env.NEWRELIC_LICENSE_KEY && {
            newrelic: {
              licenseKey: process.env.NEWRELIC_LICENSE_KEY,
              appName: process.env.NEWRELIC_APP_NAME || 'n8n-error-tracking'
            }
          }),
          ...(process.env.ELASTICSEARCH_HOST && {
            elasticsearch: {
              host: process.env.ELASTICSEARCH_HOST,
              index: process.env.ELASTICSEARCH_INDEX || 'error-tracking',
              ...(process.env.ELASTICSEARCH_USERNAME && {
                auth: {
                  username: process.env.ELASTICSEARCH_USERNAME,
                  password: process.env.ELASTICSEARCH_PASSWORD || ''
                }
              })
            }
          })
        }
      };

      // Initialize main integration
      this.errorTrackingIntegration = new ErrorTrackingIntegration(
        errorTracker,
        alertManager,
        notificationService,
        integrationConfig
      );

      // Configure default notification channels
      await this.configureDefaultNotificationChannels();

      // Initialize API server
      const apiConfig: APIConfig = {
        port: parseInt(process.env.API_PORT || '3007'),
        corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
        enableMetrics: process.env.ENABLE_API_METRICS !== 'false'
      };

      this.api = new ErrorTrackingAPI(this.errorTrackingIntegration, apiConfig);
      await this.api.start();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Error Tracking System initialized successfully', {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        apiPort: apiConfig.port
      });

    } catch (error) {
      logError('Failed to initialize Error Tracking System', error as Error);
      throw error;
    }
  }

  private async configureDefaultNotificationChannels(): Promise<void> {
    if (!this.errorTrackingIntegration) return;

    try {
      // Configure email channel if SMTP settings are provided
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        await this.errorTrackingIntegration.configureNotificationChannel({
          id: 'default-email',
          type: 'email',
          name: 'Default Email',
          enabled: true,
          config: {
            smtp: {
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: process.env.SMTP_SECURE === 'true',
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
              }
            },
            fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER
          },
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 60000,
            backoffMultiplier: 2
          },
          rateLimits: {
            requestsPerMinute: 10,
            requestsPerHour: 100
          }
        });
      }

      // Configure Slack channel if token is provided
      if (process.env.SLACK_TOKEN) {
        await this.errorTrackingIntegration.configureNotificationChannel({
          id: 'default-slack',
          type: 'slack',
          name: 'Default Slack',
          enabled: true,
          config: {
            slackToken: process.env.SLACK_TOKEN,
            slackChannel: process.env.SLACK_CHANNEL || '#alerts'
          },
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 30000,
            backoffMultiplier: 2
          },
          rateLimits: {
            requestsPerMinute: 20,
            requestsPerHour: 200
          }
        });
      }

      // Configure Discord channel if token is provided
      if (process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL) {
        await this.errorTrackingIntegration.configureNotificationChannel({
          id: 'default-discord',
          type: 'discord',
          name: 'Default Discord',
          enabled: true,
          config: {
            discordToken: process.env.DISCORD_TOKEN,
            discordChannelId: process.env.DISCORD_CHANNEL
          },
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 30000,
            backoffMultiplier: 2
          },
          rateLimits: {
            requestsPerMinute: 15,
            requestsPerHour: 150
          }
        });
      }

      // Configure SMS channel if Twilio credentials are provided
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        await this.errorTrackingIntegration.configureNotificationChannel({
          id: 'default-sms',
          type: 'sms',
          name: 'Default SMS',
          enabled: true,
          config: {
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
            twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
            twilioFromNumber: process.env.TWILIO_FROM_NUMBER
          },
          retryPolicy: {
            maxRetries: 2,
            retryDelay: 60000,
            backoffMultiplier: 2
          },
          rateLimits: {
            requestsPerMinute: 5,
            requestsPerHour: 50
          }
        });
      }

      logger.info('Default notification channels configured');
    } catch (error) {
      logError('Failed to configure default notification channels', error as Error);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop API server
        if (this.api) {
          await this.api.stop();
        }

        // Cleanup integration
        if (this.errorTrackingIntegration) {
          this.errorTrackingIntegration.destroy();
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logError('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      logError('Uncaught exception', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }
}

// Main application entry point
async function main() {
  const system = new ErrorTrackingSystem();
  await system.initialize();
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logError('Failed to start Error Tracking System', error);
    process.exit(1);
  });
}

export { ErrorTrackingSystem };