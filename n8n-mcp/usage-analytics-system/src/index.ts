import dotenv from 'dotenv';
import { logger, logError } from './utils/logger';
import { UsageTracker } from './core/UsageTracker';
import { UsageStorage } from './storage/UsageStorage';
import { ReportGenerator } from './reporting/ReportGenerator';
import { AnalyticsAPI, APIConfig } from './api/AnalyticsAPI';

// Load environment variables
dotenv.config();

class UsageAnalyticsSystem {
  private usageTracker?: UsageTracker;
  private reportGenerator?: ReportGenerator;
  private api?: AnalyticsAPI;
  private isShuttingDown = false;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Usage Analytics System...');

      // Database configuration
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'usage_analytics',
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '30')
      };

      // Initialize storage layer
      const usageStorage = new UsageStorage(dbConfig);
      await usageStorage.initialize();

      // Initialize usage tracker
      this.usageTracker = new UsageTracker(usageStorage, {
        enableRealTimeProcessing: process.env.ENABLE_REALTIME_PROCESSING !== 'false',
        enableGeolocation: process.env.ENABLE_GEOLOCATION !== 'false',
        enableUserAgentParsing: process.env.ENABLE_USER_AGENT_PARSING !== 'false',
        bufferSize: parseInt(process.env.BUFFER_SIZE || '1000'),
        flushInterval: parseInt(process.env.FLUSH_INTERVAL || '30000'),
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '1800000'), // 30 minutes
        enableConversionTracking: process.env.ENABLE_CONVERSION_TRACKING !== 'false',
        enableCohortAnalysis: process.env.ENABLE_COHORT_ANALYSIS !== 'false'
      });

      // Initialize report generator
      this.reportGenerator = new ReportGenerator(usageStorage, {
        reportsDirectory: process.env.REPORTS_DIRECTORY || './reports',
        maxReportAge: parseInt(process.env.MAX_REPORT_AGE || '30'),
        enableScheduledReports: process.env.ENABLE_SCHEDULED_REPORTS !== 'false',
        chartWidth: parseInt(process.env.CHART_WIDTH || '800'),
        chartHeight: parseInt(process.env.CHART_HEIGHT || '600')
      });

      // Initialize API server
      const apiConfig: APIConfig = {
        port: parseInt(process.env.API_PORT || '3008'),
        corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
        enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
        enableRealTimeAnalytics: process.env.ENABLE_REALTIME_ANALYTICS !== 'false'
      };

      this.api = new AnalyticsAPI(this.usageTracker, this.reportGenerator, apiConfig);
      await this.api.start();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Initialize default report definitions
      await this.createDefaultReportDefinitions();

      logger.info('Usage Analytics System initialized successfully', {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        apiPort: apiConfig.port
      });

    } catch (error) {
      logError('Failed to initialize Usage Analytics System', error as Error);
      throw error;
    }
  }

  private async createDefaultReportDefinitions(): Promise<void> {
    if (!this.reportGenerator) return;

    try {
      // Usage Summary Report
      await this.reportGenerator.createReportDefinition({
        name: 'Weekly Usage Summary',
        description: 'Weekly overview of platform usage metrics',
        type: 'usage_summary',
        format: 'pdf',
        schedule: {
          frequency: 'weekly',
          time: '09:00',
          timezone: 'UTC',
          recipients: ['admin@company.com']
        },
        filters: {
          dateRange: {
            type: 'relative',
            value: '7d'
          }
        },
        metrics: [
          'totalEvents',
          'totalSessions',
          'totalUsers',
          'activeUsers',
          'pageViews',
          'apiUsage',
          'workflows'
        ],
        visualizations: [
          {
            type: 'line',
            title: 'Daily Active Users',
            metric: 'activeUsers',
            config: {}
          },
          {
            type: 'bar',
            title: 'Top Pages',
            metric: 'topPages',
            config: {}
          },
          {
            type: 'pie',
            title: 'Traffic Sources',
            metric: 'trafficSources',
            config: {}
          }
        ],
        createdBy: 'system'
      });

      // User Behavior Report
      await this.reportGenerator.createReportDefinition({
        name: 'Monthly User Behavior Analysis',
        description: 'Deep dive into user behavior patterns and journey analysis',
        type: 'user_behavior',
        format: 'excel',
        schedule: {
          frequency: 'monthly',
          time: '08:00',
          timezone: 'UTC',
          recipients: ['product@company.com', 'analytics@company.com']
        },
        filters: {
          dateRange: {
            type: 'relative',
            value: '30d'
          }
        },
        metrics: [
          'userJourneys',
          'pageFlows',
          'sessionDuration',
          'bounceRate',
          'conversionPaths'
        ],
        visualizations: [
          {
            type: 'funnel',
            title: 'User Conversion Funnel',
            metric: 'conversionFunnel',
            config: {}
          },
          {
            type: 'heatmap',
            title: 'Page Interaction Heatmap',
            metric: 'pageInteractions',
            config: {}
          }
        ],
        createdBy: 'system'
      });

      // Performance Report
      await this.reportGenerator.createReportDefinition({
        name: 'API Performance Report',
        description: 'API performance metrics and error analysis',
        type: 'performance',
        format: 'html',
        schedule: {
          frequency: 'daily',
          time: '06:00',
          timezone: 'UTC',
          recipients: ['engineering@company.com']
        },
        filters: {
          dateRange: {
            type: 'relative',
            value: '1d'
          }
        },
        metrics: [
          'responseTime',
          'errorRate',
          'throughput',
          'endpointPerformance'
        ],
        visualizations: [
          {
            type: 'line',
            title: 'Response Time Trends',
            metric: 'responseTimeTrends',
            config: {}
          },
          {
            type: 'bar',
            title: 'Error Distribution',
            metric: 'errorDistribution',
            config: {}
          }
        ],
        createdBy: 'system'
      });

      // Conversion Report
      await this.reportGenerator.createReportDefinition({
        name: 'Conversion Analysis Report',
        description: 'User conversion funnel and optimization insights',
        type: 'conversion',
        format: 'pdf',
        filters: {
          dateRange: {
            type: 'relative',
            value: '30d'
          }
        },
        metrics: [
          'conversionRate',
          'funnelAnalysis',
          'cohortAnalysis',
          'retentionRate'
        ],
        visualizations: [
          {
            type: 'funnel',
            title: 'Registration to First Workflow',
            metric: 'registrationFunnel',
            config: {}
          },
          {
            type: 'line',
            title: 'Cohort Retention',
            metric: 'cohortRetention',
            config: {}
          }
        ],
        createdBy: 'system'
      });

      logger.info('Default report definitions created successfully');
    } catch (error) {
      logError('Failed to create default report definitions', error as Error);
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

        // Cleanup components
        if (this.usageTracker) {
          this.usageTracker.destroy();
        }

        if (this.reportGenerator) {
          this.reportGenerator.destroy();
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
  const system = new UsageAnalyticsSystem();
  await system.initialize();
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logError('Failed to start Usage Analytics System', error);
    process.exit(1);
  });
}

export { UsageAnalyticsSystem };