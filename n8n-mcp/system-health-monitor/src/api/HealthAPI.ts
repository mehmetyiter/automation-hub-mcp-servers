import express, { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import { HealthMonitor, HealthCheck, HealthCheckResult, SystemMetrics, IncidentDefinition } from '../core/HealthMonitor';
import { HealthAlerting, AlertRule, NotificationChannel } from '../alerting/HealthAlerting';

export class HealthAPI {
  private app: express.Application;
  private io: SocketIOServer;
  private rateLimiter: RateLimiterMemory;

  constructor(
    private healthMonitor: HealthMonitor,
    private healthAlerting: HealthAlerting,
    private options: {
      port?: number;
      enableCors?: boolean;
      enableRateLimit?: boolean;
      maxRequestsPerMinute?: number;
    } = {}
  ) {
    this.app = express();
    this.setupRateLimit();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupEventListeners();
  }

  private setupRateLimit(): void {
    if (this.options.enableRateLimit !== false) {
      this.rateLimiter = new RateLimiterMemory({
        keyGen: (req) => req.ip,
        points: this.options.maxRequestsPerMinute || 100,
        duration: 60, // 1 minute
      });
    }
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    this.app.use(compression());
    
    // CORS
    if (this.options.enableCors !== false) {
      this.app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    if (this.rateLimiter) {
      this.app.use(async (req, res, next) => {
        try {
          await this.rateLimiter.consume(req.ip);
          next();
        } catch (rejRes) {
          res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1
          });
        }
      });
    }
  }

  private setupRoutes(): void {
    // Health endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime()
      });
    });

    // Health Checks Management
    this.app.get('/api/health-checks', this.handleGetHealthChecks.bind(this));
    this.app.post('/api/health-checks', this.handleCreateHealthCheck.bind(this));
    this.app.put('/api/health-checks/:id', this.handleUpdateHealthCheck.bind(this));
    this.app.delete('/api/health-checks/:id', this.handleDeleteHealthCheck.bind(this));
    this.app.post('/api/health-checks/:id/execute', this.handleExecuteHealthCheck.bind(this));

    // Health Check Results
    this.app.get('/api/health-checks/:id/results', this.handleGetHealthCheckResults.bind(this));
    this.app.get('/api/health-check-results', this.handleGetAllResults.bind(this));

    // System Metrics
    this.app.get('/api/system-metrics', this.handleGetSystemMetrics.bind(this));
    this.app.get('/api/system-metrics/current', this.handleGetCurrentSystemMetrics.bind(this));

    // Health Summary
    this.app.get('/api/health-summary', this.handleGetHealthSummary.bind(this));
    this.app.get('/api/health-status', this.handleGetHealthStatus.bind(this));

    // Incidents Management
    this.app.get('/api/incidents', this.handleGetIncidents.bind(this));
    this.app.post('/api/incidents', this.handleCreateIncident.bind(this));
    this.app.put('/api/incidents/:id', this.handleUpdateIncident.bind(this));

    // Alert Rules Management
    this.app.get('/api/alert-rules', this.handleGetAlertRules.bind(this));
    this.app.post('/api/alert-rules', this.handleCreateAlertRule.bind(this));
    this.app.put('/api/alert-rules/:id', this.handleUpdateAlertRule.bind(this));
    this.app.delete('/api/alert-rules/:id', this.handleDeleteAlertRule.bind(this));

    // Notification Channels
    this.app.get('/api/notification-channels', this.handleGetNotificationChannels.bind(this));
    this.app.post('/api/notification-channels', this.handleCreateNotificationChannel.bind(this));
    this.app.post('/api/notification-channels/:id/test', this.handleTestNotificationChannel.bind(this));

    // Alerts
    this.app.get('/api/alerts', this.handleGetAlerts.bind(this));
    this.app.post('/api/alerts/:id/resolve', this.handleResolveAlert.bind(this));

    // Dashboard Data
    this.app.get('/api/dashboard/overview', this.handleGetDashboardOverview.bind(this));
    this.app.get('/api/dashboard/charts', this.handleGetDashboardCharts.bind(this));

    // Error handling
    this.app.use(this.handleError.bind(this));
  }

  // Health Checks handlers
  private async handleGetHealthChecks(req: Request, res: Response): Promise<void> {
    try {
      const healthChecks = this.healthMonitor.getHealthChecks();
      res.json(healthChecks);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleCreateHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const checkData = req.body;
      const checkId = await this.healthMonitor.addHealthCheck(checkData);
      res.status(201).json({ checkId, message: 'Health check created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleUpdateHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      await this.healthMonitor.updateHealthCheck(id, updates);
      res.json({ message: 'Health check updated successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleDeleteHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.healthMonitor.removeHealthCheck(id);
      res.json({ message: 'Health check deleted successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleExecuteHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.healthMonitor.executeHealthCheck(id);
      res.json(result);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Results handlers
  private async handleGetHealthCheckResults(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { startTime, endTime, limit } = req.query;
      
      const results = await this.healthMonitor.getHealthCheckResults(
        id,
        startTime ? parseInt(startTime as string) : undefined,
        endTime ? parseInt(endTime as string) : undefined,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(results);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetAllResults(req: Request, res: Response): Promise<void> {
    try {
      const { startTime, endTime, limit } = req.query;
      
      const results = await this.healthMonitor.getHealthCheckResults(
        undefined,
        startTime ? parseInt(startTime as string) : undefined,
        endTime ? parseInt(endTime as string) : undefined,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(results);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // System metrics handlers
  private async handleGetSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.healthMonitor.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetCurrentSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.healthMonitor.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Health summary handlers
  private async handleGetHealthSummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await this.healthMonitor.getHealthSummary();
      res.json(summary);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const summary = await this.healthMonitor.getHealthSummary();
      res.json({
        status: summary.overall,
        timestamp: summary.lastUpdated,
        details: {
          checks: summary.checks,
          infrastructure: summary.infrastructure,
          incidents: summary.incidents
        }
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Incidents handlers
  private async handleGetIncidents(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const incidents = this.healthMonitor.getIncidents(status as any);
      res.json(incidents);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleCreateIncident(req: Request, res: Response): Promise<void> {
    try {
      const incidentData = req.body;
      const incidentId = await this.healthMonitor.createIncident(incidentData);
      res.status(201).json({ incidentId, message: 'Incident created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleUpdateIncident(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const update = req.body;
      await this.healthMonitor.updateIncident(id, update);
      res.json({ message: 'Incident updated successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Alert rules handlers
  private async handleGetAlertRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = this.healthAlerting.getAlertRules();
      res.json(rules);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleCreateAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const ruleData = req.body;
      const ruleId = await this.healthAlerting.addAlertRule(ruleData);
      res.status(201).json({ ruleId, message: 'Alert rule created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleUpdateAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      await this.healthAlerting.updateAlertRule(id, updates);
      res.json({ message: 'Alert rule updated successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleDeleteAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.healthAlerting.removeAlertRule(id);
      res.json({ message: 'Alert rule deleted successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Notification channels handlers
  private async handleGetNotificationChannels(req: Request, res: Response): Promise<void> {
    try {
      // This would be implemented in HealthAlerting
      res.json([]);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleCreateNotificationChannel(req: Request, res: Response): Promise<void> {
    try {
      const channelData = req.body;
      const channelId = await this.healthAlerting.addNotificationChannel(channelData);
      res.status(201).json({ channelId, message: 'Notification channel created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleTestNotificationChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.healthAlerting.testNotificationChannel(id);
      res.json(result);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Alerts handlers
  private async handleGetAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const alerts = status === 'active' ? 
        this.healthAlerting.getActiveAlerts() : 
        this.healthAlerting.getAllAlerts();
      res.json(alerts);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleResolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolvedBy } = req.body;
      await this.healthAlerting.resolveAlert(id, resolvedBy || 'api');
      res.json({ message: 'Alert resolved successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  // Dashboard handlers
  private async handleGetDashboardOverview(req: Request, res: Response): Promise<void> {
    try {
      const summary = await this.healthMonitor.getHealthSummary();
      const systemMetrics = this.healthMonitor.getSystemMetrics();
      const activeAlerts = this.healthAlerting.getActiveAlerts();

      res.json({
        healthSummary: summary,
        systemMetrics,
        activeAlerts: activeAlerts.length,
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async handleGetDashboardCharts(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = '24h' } = req.query;
      const endTime = Date.now();
      const startTime = endTime - this.parseTimeRange(timeRange as string);

      const results = await this.healthMonitor.getHealthCheckResults(
        undefined, startTime, endTime, 1000
      );

      // Process results into chart data
      const charts = this.processResultsForCharts(results);
      
      res.json(charts);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private parseTimeRange(range: string): number {
    const units = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return units[range as keyof typeof units] || units['24h'];
  }

  private processResultsForCharts(results: HealthCheckResult[]): any {
    // Group results by time intervals and status
    const timeInterval = 60 * 60 * 1000; // 1 hour intervals
    const chartData: any = {
      responseTime: [],
      successRate: [],
      checkStatus: {}
    };

    // Process results into time series data
    const groupedByTime = new Map<number, HealthCheckResult[]>();
    
    results.forEach(result => {
      const timeSlot = Math.floor(result.timestamp / timeInterval) * timeInterval;
      if (!groupedByTime.has(timeSlot)) {
        groupedByTime.set(timeSlot, []);
      }
      groupedByTime.get(timeSlot)!.push(result);
    });

    // Calculate metrics for each time slot
    for (const [timeSlot, slotResults] of groupedByTime.entries()) {
      const avgResponseTime = slotResults.reduce((sum, r) => sum + r.responseTime, 0) / slotResults.length;
      const successRate = (slotResults.filter(r => r.success).length / slotResults.length) * 100;

      chartData.responseTime.push({
        timestamp: timeSlot,
        value: Math.round(avgResponseTime)
      });

      chartData.successRate.push({
        timestamp: timeSlot,
        value: Math.round(successRate * 100) / 100
      });
    }

    return chartData;
  }

  private setupWebSocket(): void {
    // WebSocket will be initialized when server starts
  }

  private setupEventListeners(): void {
    // Health check events
    this.healthMonitor.on('health_check_completed', (result: HealthCheckResult) => {
      this.broadcastToClients('health_check_completed', result);
    });

    this.healthMonitor.on('health_check_failed', (result: HealthCheckResult) => {
      this.broadcastToClients('health_check_failed', result);
    });

    this.healthMonitor.on('system_metrics_collected', (metrics: SystemMetrics) => {
      this.broadcastToClients('system_metrics_updated', metrics);
    });

    this.healthMonitor.on('incident_created', (incident: IncidentDefinition) => {
      this.broadcastToClients('incident_created', incident);
    });

    // Alert events
    this.healthAlerting.on('alert_created', (alert: any) => {
      this.broadcastToClients('alert_created', alert);
    });

    this.healthAlerting.on('alert_resolved', (alert: any) => {
      this.broadcastToClients('alert_resolved', alert);
    });
  }

  private broadcastToClients(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  setSocketIO(io: SocketIOServer): void {
    this.io = io;

    this.io.on('connection', (socket) => {
      logger.info('Client connected to health monitoring', { socketId: socket.id });

      socket.on('subscribe_health_updates', () => {
        socket.join('health_updates');
      });

      socket.on('subscribe_alerts', () => {
        socket.join('alerts');
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from health monitoring', { socketId: socket.id });
      });
    });
  }

  private handleError(error: any, req?: Request, res?: Response, next?: Function): void {
    logger.error('API Error', {
      error: error.message,
      stack: error.stack,
      url: req?.url,
      method: req?.method
    });

    if (res && !res.headersSent) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  async start(port: number = 3009): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Health monitoring API server started on port ${port}`);
        resolve();
      });
    });
  }
}