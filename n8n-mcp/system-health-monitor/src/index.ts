import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { appConfig, validateConfig } from './utils/config';
import { HealthStorage } from './storage/HealthStorage';
import { HealthMonitor } from './core/HealthMonitor';
import { HealthAlerting } from './alerting/HealthAlerting';
import { HealthAPI } from './api/HealthAPI';

class HealthMonitorApplication {
  private healthStorage: HealthStorage;
  private healthMonitor: HealthMonitor;
  private healthAlerting: HealthAlerting;
  private healthAPI: HealthAPI;
  private io: SocketIOServer;
  private server: any;

  constructor() {
    this.validateEnvironment();
    this.initializeComponents();
    this.setupGracefulShutdown();
  }

  private validateEnvironment(): void {
    try {
      validateConfig();
      logger.info('Configuration validated successfully');
    } catch (error) {
      logger.error('Configuration validation failed', { error: error.message });
      process.exit(1);
    }
  }

  private initializeComponents(): void {
    // Initialize storage layer
    this.healthStorage = new HealthStorage(appConfig.database);

    // Initialize health monitoring
    this.healthMonitor = new HealthMonitor(this.healthStorage, {
      enableSystemMetrics: appConfig.monitoring.enableSystemMetrics,
      enableDockerMetrics: appConfig.monitoring.enableDockerMetrics,
      enableKubernetesMetrics: appConfig.monitoring.enableKubernetesMetrics,
      systemMetricsInterval: appConfig.monitoring.systemMetricsInterval,
      defaultCheckInterval: appConfig.monitoring.defaultCheckInterval,
      maxIncidentHistory: appConfig.monitoring.maxIncidentHistory
    });

    // Initialize alerting system
    this.healthAlerting = new HealthAlerting({
      enableThrottling: appConfig.alerting.enableThrottling,
      defaultThrottleWindow: appConfig.alerting.defaultThrottleWindow,
      maxActiveAlerts: appConfig.alerting.maxActiveAlerts,
      enableScheduling: appConfig.alerting.enableScheduling
    });

    // Initialize API layer
    this.healthAPI = new HealthAPI(this.healthMonitor, this.healthAlerting, {
      port: appConfig.server.port,
      enableCors: appConfig.server.enableCors,
      enableRateLimit: appConfig.server.enableRateLimit,
      maxRequestsPerMinute: appConfig.server.maxRequestsPerMinute
    });

    // Setup WebSocket server
    this.setupWebSocketServer();

    // Connect health monitor to alerting system
    this.connectHealthMonitorToAlerting();

    // Setup notification channels if configured
    this.setupNotificationChannels();

    logger.info('Health monitoring components initialized');
  }

  private setupWebSocketServer(): void {
    const app = this.healthAPI.getApp();
    this.server = createServer(app);
    
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    // Connect WebSocket to API
    this.healthAPI.setSocketIO(this.io);

    logger.info('WebSocket server configured');
  }

  private connectHealthMonitorToAlerting(): void {
    // Connect health check events to alerting
    this.healthMonitor.on('health_check_completed', (result) => {
      if (result.status === 'critical' || result.status === 'warning') {
        const healthCheck = this.healthMonitor.getHealthChecks()
          .find(check => check.id === result.checkId);
        
        if (healthCheck) {
          this.healthAlerting.processHealthCheckResult(healthCheck, result);
        }
      }
    });

    // Connect system metrics to alerting
    this.healthMonitor.on('system_metrics_collected', (metrics) => {
      this.healthAlerting.processSystemMetrics(metrics);
    });

    // Connect incidents to alerting
    this.healthMonitor.on('incident_created', (incident) => {
      this.healthAlerting.processIncident(incident);
    });

    logger.info('Health monitor connected to alerting system');
  }

  private async setupNotificationChannels(): Promise<void> {
    try {
      // Setup email notification channel
      if (appConfig.notifications.enableEmail && appConfig.notifications.smtpHost) {
        await this.healthAlerting.addNotificationChannel({
          type: 'email',
          name: 'Default Email',
          enabled: true,
          config: {
            smtp: {
              host: appConfig.notifications.smtpHost!,
              port: appConfig.notifications.smtpPort!,
              secure: appConfig.notifications.smtpSecure!,
              auth: {
                user: appConfig.notifications.smtpUser!,
                pass: appConfig.notifications.smtpPass!
              }
            },
            fromEmail: appConfig.notifications.defaultFromEmail!
          }
        });
        logger.info('Email notification channel configured');
      }

      // Setup Slack notification channel
      if (appConfig.notifications.enableSlack && appConfig.notifications.slackToken) {
        await this.healthAlerting.addNotificationChannel({
          type: 'slack',
          name: 'Default Slack',
          enabled: true,
          config: {
            token: appConfig.notifications.slackToken!,
            defaultChannel: '#alerts'
          }
        });
        logger.info('Slack notification channel configured');
      }

      // Setup SMS notification channel
      if (appConfig.notifications.enableSMS && appConfig.notifications.twilioAccountSid) {
        await this.healthAlerting.addNotificationChannel({
          type: 'sms',
          name: 'Default SMS',
          enabled: true,
          config: {
            twilioAccountSid: appConfig.notifications.twilioAccountSid!,
            twilioAuthToken: appConfig.notifications.twilioAuthToken!,
            twilioFromNumber: appConfig.notifications.twilioFromNumber!
          }
        });
        logger.info('SMS notification channel configured');
      }

    } catch (error) {
      logger.warn('Failed to setup some notification channels', { error: error.message });
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        // Stop accepting new connections
        if (this.server) {
          await new Promise<void>((resolve) => {
            this.server.close(() => {
              logger.info('HTTP server closed');
              resolve();
            });
          });
        }

        // Close WebSocket connections
        if (this.io) {
          this.io.close();
          logger.info('WebSocket server closed');
        }

        // Cleanup health monitor
        if (this.healthMonitor) {
          this.healthMonitor.destroy();
          logger.info('Health monitor cleaned up');
        }

        // Cleanup alerting
        if (this.healthAlerting) {
          this.healthAlerting.destroy();
          logger.info('Alerting system cleaned up');
        }

        // Close database connections
        if (this.healthStorage) {
          await this.healthStorage.destroy();
          logger.info('Database connections closed');
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);

      } catch (error) {
        logger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize database
      logger.info('Initializing database...');
      await this.healthStorage.initialize();

      // Start the server
      logger.info(`Starting health monitoring server on port ${appConfig.server.port}...`);
      
      await new Promise<void>((resolve) => {
        this.server.listen(appConfig.server.port, appConfig.server.host, () => {
          logger.info(`Health monitoring server started successfully`, {
            port: appConfig.server.port,
            host: appConfig.server.host,
            environment: appConfig.environment,
            pid: process.pid
          });
          resolve();
        });
      });

      // Setup some default health checks for demonstration
      await this.setupDefaultHealthChecks();

      // Setup default alert rules
      await this.setupDefaultAlertRules();

      logger.info('Health monitoring application startup completed');

    } catch (error) {
      logger.error('Failed to start health monitoring application', { 
        error: error.message,
        stack: error.stack 
      });
      process.exit(1);
    }
  }

  private async setupDefaultHealthChecks(): Promise<void> {
    try {
      // Add a self-health check
      await this.healthMonitor.addHealthCheck({
        name: 'Health Monitor API',
        type: 'http',
        target: `http://localhost:${appConfig.server.port}/health`,
        config: {
          timeout: 5000,
          interval: 60000,
          retries: 3,
          expectedStatus: 200
        },
        thresholds: {
          responseTime: {
            warning: 1000,
            critical: 5000
          },
          availability: {
            warning: 95,
            critical: 90
          }
        },
        enabled: true,
        tags: ['self-monitoring', 'api'],
        metadata: {
          description: 'Self-monitoring health check for the health monitor API'
        }
      });

      logger.info('Default health checks configured');
    } catch (error) {
      logger.warn('Failed to setup default health checks', { error: error.message });
    }
  }

  private async setupDefaultAlertRules(): Promise<void> {
    try {
      // Add default alert rule for critical health check failures
      await this.healthAlerting.addAlertRule({
        name: 'Critical Health Check Failure',
        description: 'Alert when any health check fails with critical status',
        enabled: true,
        conditions: [
          {
            type: 'health_check_failed',
            operator: 'eq',
            value: 'critical'
          }
        ],
        actions: [
          {
            type: 'webhook',
            config: {
              url: process.env.WEBHOOK_URL || 'https://httpbin.org/post',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          }
        ],
        filters: {},
        throttling: {
          enabled: true,
          windowMinutes: 15,
          maxAlerts: 3
        },
        metadata: {
          description: 'Default alert rule for critical failures'
        }
      });

      // Add alert rule for high system resource usage
      await this.healthAlerting.addAlertRule({
        name: 'High System Resource Usage',
        description: 'Alert when system resources exceed thresholds',
        enabled: true,
        conditions: [
          {
            type: 'system_metric',
            field: 'cpu.usage',
            operator: 'gt',
            value: 80
          },
          {
            type: 'system_metric',
            field: 'memory.usagePercent',
            operator: 'gt',
            value: 85
          }
        ],
        actions: [
          {
            type: 'webhook',
            config: {
              url: process.env.WEBHOOK_URL || 'https://httpbin.org/post',
              method: 'POST'
            }
          }
        ],
        filters: {},
        throttling: {
          enabled: true,
          windowMinutes: 30,
          maxAlerts: 2
        },
        metadata: {
          description: 'Alert for high resource usage'
        }
      });

      logger.info('Default alert rules configured');
    } catch (error) {
      logger.warn('Failed to setup default alert rules', { error: error.message });
    }
  }
}

// Start the application
const app = new HealthMonitorApplication();
app.start().catch((error) => {
  logger.error('Application startup failed', { error: error.message });
  process.exit(1);
});