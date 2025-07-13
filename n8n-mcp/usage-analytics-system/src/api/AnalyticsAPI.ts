import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { logger, addRequestId, logRequest, logError, logAnalytics } from '../utils/logger';
import { UsageTracker } from '../core/UsageTracker';
import { ReportGenerator } from '../reporting/ReportGenerator';

export interface APIConfig {
  port: number;
  corsOrigin: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  enableWebSocket: boolean;
  enableRealTimeAnalytics: boolean;
}

export class AnalyticsAPI {
  private app: express.Application;
  private server: any;
  private io?: SocketIOServer;
  private usageTracker: UsageTracker;
  private reportGenerator: ReportGenerator;

  constructor(
    usageTracker: UsageTracker,
    reportGenerator: ReportGenerator,
    private config: APIConfig
  ) {
    this.usageTracker = usageTracker;
    this.reportGenerator = reportGenerator;
    this.app = express();
    this.server = createServer(this.app);
    
    if (config.enableWebSocket) {
      this.setupWebSocket();
    }
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID'],
      credentials: true
    }));
    
    // Compression
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMax,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || 
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });
    
    // Session ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const sessionId = req.headers['x-session-id'] as string;
      req.sessionId = sessionId;
      next();
    });
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logRequest(req.method, req.url, res.statusCode, duration, {
          requestId: req.requestId,
          sessionId: req.sessionId,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        });
      });
      
      next();
    });
  }

  private setupWebSocket(): void {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.corsOrigin,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      logger.info('Analytics WebSocket client connected', { socketId: socket.id });

      socket.on('subscribe_analytics', (data) => {
        const { type, filters } = data || {};
        socket.join(`analytics:${type || 'all'}`);
        if (filters?.userId) {
          socket.join(`user:${filters.userId}`);
        }
        logger.debug('Client subscribed to analytics updates', { 
          socketId: socket.id, 
          type, 
          filters 
        });
      });

      socket.on('subscribe_reports', (data) => {
        const { reportId } = data || {};
        socket.join('reports:all');
        if (reportId) {
          socket.join(`report:${reportId}`);
        }
        logger.debug('Client subscribed to report updates', { 
          socketId: socket.id, 
          reportId 
        });
      });

      socket.on('disconnect', () => {
        logger.info('Analytics WebSocket client disconnected', { socketId: socket.id });
      });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Event tracking routes
    this.app.post('/api/events/track', this.trackEvent.bind(this));
    this.app.post('/api/events/page', this.trackPageView.bind(this));
    this.app.post('/api/events/api', this.trackAPICall.bind(this));
    this.app.post('/api/events/workflow', this.trackWorkflowExecution.bind(this));
    this.app.post('/api/events/user-action', this.trackUserAction.bind(this));
    this.app.post('/api/events/batch', this.trackBatchEvents.bind(this));

    // Session management routes
    this.app.post('/api/sessions/create', this.createSession.bind(this));
    this.app.post('/api/sessions/:sessionId/end', this.endSession.bind(this));

    // Analytics routes
    this.app.get('/api/analytics/metrics', this.getUsageMetrics.bind(this));
    this.app.get('/api/analytics/real-time', this.getRealTimeAnalytics.bind(this));
    this.app.get('/api/analytics/funnel', this.getFunnelAnalysis.bind(this));
    this.app.get('/api/analytics/cohort', this.getCohortAnalysis.bind(this));
    this.app.get('/api/analytics/user-journey/:userId', this.getUserJourney.bind(this));

    // Search and query routes
    this.app.get('/api/events/search', this.searchEvents.bind(this));
    this.app.post('/api/analytics/query', this.customQuery.bind(this));

    // Reporting routes
    this.app.get('/api/reports/definitions', this.getReportDefinitions.bind(this));
    this.app.post('/api/reports/definitions', this.createReportDefinition.bind(this));
    this.app.get('/api/reports/generated', this.getGeneratedReports.bind(this));
    this.app.post('/api/reports/generate/:definitionId', this.generateReport.bind(this));
    this.app.post('/api/reports/dashboard', this.generateDashboardReport.bind(this));
    this.app.get('/api/reports/download/:reportId', this.downloadReport.bind(this));

    // Dashboard data routes
    this.app.get('/api/dashboard/overview', this.getDashboardOverview.bind(this));
    this.app.get('/api/dashboard/charts', this.getDashboardCharts.bind(this));

    // Error handler
    this.app.use(this.errorHandler.bind(this));
  }

  private setupEventListeners(): void {
    // Listen for real-time analytics and broadcast via WebSocket
    if (this.config.enableRealTimeAnalytics) {
      this.usageTracker.on('event_tracked', (event) => {
        if (this.io) {
          this.io.to('analytics:all').emit('event_tracked', event);
          if (event.userId) {
            this.io.to(`user:${event.userId}`).emit('event_tracked', event);
          }
        }
      });

      this.usageTracker.on('real_time_analytics', (analytics) => {
        if (this.io) {
          this.io.to('analytics:all').emit('real_time_analytics', analytics);
        }
      });

      this.usageTracker.on('session_created', (session) => {
        if (this.io) {
          this.io.to('analytics:all').emit('session_created', session);
        }
      });

      this.usageTracker.on('session_ended', (session) => {
        if (this.io) {
          this.io.to('analytics:all').emit('session_ended', session);
        }
      });
    }

    // Listen for report events
    this.reportGenerator.on('report_generated', (report) => {
      if (this.io) {
        this.io.to('reports:all').emit('report_generated', report);
        this.io.to(`report:${report.id}`).emit('report_status', {
          reportId: report.id,
          status: 'completed'
        });
      }
    });

    this.reportGenerator.on('report_generation_failed', (data) => {
      if (this.io) {
        this.io.to('reports:all').emit('report_generation_failed', data);
        this.io.to(`report:${data.reportId}`).emit('report_status', {
          reportId: data.reportId,
          status: 'failed',
          error: data.error
        });
      }
    });
  }

  // API Route Handlers

  private async trackEvent(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, event, category, properties, context, metadata } = req.body;

      if (!sessionId || !event || !category) {
        res.status(400).json({ error: 'sessionId, event, and category are required' });
        return;
      }

      const eventId = await this.usageTracker.trackEvent(
        sessionId,
        event,
        category,
        properties || {},
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          ...context
        },
        {
          requestId: req.requestId,
          ...metadata
        }
      );

      logAnalytics('event_tracked', {
        eventId,
        sessionId,
        event,
        category
      });

      res.status(201).json({ eventId, message: 'Event tracked successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async trackPageView(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, page, referrer, metadata } = req.body;

      if (!sessionId || !page) {
        res.status(400).json({ error: 'sessionId and page are required' });
        return;
      }

      const eventId = await this.usageTracker.trackPageView(
        sessionId,
        page,
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          referrer
        },
        {
          requestId: req.requestId,
          ...metadata
        }
      );

      res.status(201).json({ eventId, message: 'Page view tracked successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async trackAPICall(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, endpoint, method, statusCode, responseTime, metadata } = req.body;

      if (!sessionId || !endpoint || !method || statusCode === undefined || responseTime === undefined) {
        res.status(400).json({ error: 'sessionId, endpoint, method, statusCode, and responseTime are required' });
        return;
      }

      const eventId = await this.usageTracker.trackAPICall(
        sessionId,
        endpoint,
        method,
        statusCode,
        responseTime,
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        },
        {
          requestId: req.requestId,
          ...metadata
        }
      );

      res.status(201).json({ eventId, message: 'API call tracked successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async trackWorkflowExecution(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, workflowId, workflowName, executionId, duration, success, metadata } = req.body;

      if (!sessionId || !workflowId || !workflowName || !executionId || duration === undefined || success === undefined) {
        res.status(400).json({ error: 'sessionId, workflowId, workflowName, executionId, duration, and success are required' });
        return;
      }

      const eventId = await this.usageTracker.trackWorkflowExecution(
        sessionId,
        workflowId,
        workflowName,
        executionId,
        duration,
        success,
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        },
        {
          requestId: req.requestId,
          ...metadata
        }
      );

      res.status(201).json({ eventId, message: 'Workflow execution tracked successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async trackUserAction(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, action, target, value, metadata } = req.body;

      if (!sessionId || !action || !target) {
        res.status(400).json({ error: 'sessionId, action, and target are required' });
        return;
      }

      const eventId = await this.usageTracker.trackUserAction(
        sessionId,
        action,
        target,
        value,
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        },
        {
          requestId: req.requestId,
          ...metadata
        }
      );

      res.status(201).json({ eventId, message: 'User action tracked successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async trackBatchEvents(req: Request, res: Response): Promise<void> {
    try {
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: 'events array is required and must not be empty' });
        return;
      }

      const eventIds: string[] = [];

      for (const eventData of events) {
        const { sessionId, event, category, properties, context, metadata } = eventData;
        
        if (!sessionId || !event || !category) {
          continue; // Skip invalid events
        }

        const eventId = await this.usageTracker.trackEvent(
          sessionId,
          event,
          category,
          properties || {},
          {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            ...context
          },
          {
            requestId: req.requestId,
            ...metadata
          }
        );

        eventIds.push(eventId);
      }

      res.status(201).json({ 
        eventIds, 
        processed: eventIds.length,
        total: events.length,
        message: 'Batch events tracked successfully' 
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async createSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId, context, metadata } = req.body;

      const sessionId = await this.usageTracker.createSession(
        userId,
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          ...context
        },
        {
          requestId: req.requestId,
          ...metadata
        }
      );

      res.status(201).json({ sessionId, message: 'Session created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async endSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      await this.usageTracker.endSession(sessionId);

      res.json({ message: 'Session ended successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getUsageMetrics(req: Request, res: Response): Promise<void> {
    try {
      const {
        startTime,
        endTime,
        userId,
        country,
        platform,
        version
      } = req.query;

      if (!startTime || !endTime) {
        res.status(400).json({ error: 'startTime and endTime are required' });
        return;
      }

      const metrics = await this.usageTracker.getUsageMetrics(
        parseInt(startTime as string),
        parseInt(endTime as string),
        {
          userId: userId as string,
          country: country as string,
          platform: platform as string,
          version: version as string
        }
      );

      res.json(metrics);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getRealTimeAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = this.usageTracker.getRealTimeAnalytics();
      res.json(analytics);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getFunnelAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { name, steps, startTime, endTime, filters } = req.query;

      if (!name || !steps || !startTime || !endTime) {
        res.status(400).json({ error: 'name, steps, startTime, and endTime are required' });
        return;
      }

      let parsedSteps;
      try {
        parsedSteps = JSON.parse(steps as string);
      } catch {
        res.status(400).json({ error: 'steps must be valid JSON' });
        return;
      }

      const funnelDefinition = {
        name: name as string,
        steps: parsedSteps
      };

      const funnelAnalysis = await this.usageTracker.getFunnelAnalysis(
        funnelDefinition,
        parseInt(startTime as string),
        parseInt(endTime as string),
        filters ? JSON.parse(filters as string) : {}
      );

      res.json(funnelAnalysis);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getCohortAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { period, startTime, endTime, filters } = req.query;

      if (!period || !startTime || !endTime) {
        res.status(400).json({ error: 'period, startTime, and endTime are required' });
        return;
      }

      const cohortAnalysis = await this.usageTracker.getCohortAnalysis(
        period as 'daily' | 'weekly' | 'monthly',
        parseInt(startTime as string),
        parseInt(endTime as string),
        filters ? JSON.parse(filters as string) : {}
      );

      res.json(cohortAnalysis);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getUserJourney(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { startTime, endTime, limit } = req.query;

      const journey = await this.usageTracker.getUserJourney(
        userId,
        startTime ? parseInt(startTime as string) : undefined,
        endTime ? parseInt(endTime as string) : undefined,
        limit ? parseInt(limit as string) : 100
      );

      res.json(journey);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async searchEvents(req: Request, res: Response): Promise<void> {
    try {
      const query = { ...req.query };
      
      // Convert string numbers to numbers
      if (query.startTime) query.startTime = parseInt(query.startTime as string);
      if (query.endTime) query.endTime = parseInt(query.endTime as string);
      if (query.limit) query.limit = parseInt(query.limit as string);
      if (query.offset) query.offset = parseInt(query.offset as string);

      const result = await this.usageTracker.searchEvents(query as any);
      res.json(result);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async customQuery(req: Request, res: Response): Promise<void> {
    try {
      // Custom analytics queries would be implemented here
      // For security reasons, this should be heavily restricted
      res.status(501).json({ error: 'Custom queries not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getReportDefinitions(req: Request, res: Response): Promise<void> {
    try {
      const definitions = this.reportGenerator.getReportDefinitions();
      res.json(definitions);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async createReportDefinition(req: Request, res: Response): Promise<void> {
    try {
      const definition = req.body;
      const reportId = await this.reportGenerator.createReportDefinition(definition);
      res.status(201).json({ reportId, message: 'Report definition created successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getGeneratedReports(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.query;
      const reports = this.reportGenerator.getGeneratedReports(
        limit ? parseInt(limit as string) : 50
      );
      res.json(reports);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const { definitionId } = req.params;
      const { generatedBy, filters } = req.body;

      if (!generatedBy) {
        res.status(400).json({ error: 'generatedBy is required' });
        return;
      }

      const reportId = await this.reportGenerator.generateReport(
        definitionId,
        generatedBy,
        filters
      );

      res.status(201).json({ reportId, message: 'Report generation started' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async generateDashboardReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, generatedBy } = req.body;

      if (!startDate || !endDate || !generatedBy) {
        res.status(400).json({ error: 'startDate, endDate, and generatedBy are required' });
        return;
      }

      const reportId = await this.reportGenerator.generateDashboardReport(
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        },
        generatedBy
      );

      res.status(201).json({ reportId, message: 'Dashboard report generation started' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      const reportFile = this.reportGenerator.getReportFile(reportId);
      if (!reportFile) {
        res.status(404).json({ error: 'Report not found or file not available' });
        return;
      }

      res.download(reportFile.filePath, reportFile.filename);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getDashboardOverview(req: Request, res: Response): Promise<void> {
    try {
      const {
        startTime = Date.now() - 24 * 60 * 60 * 1000, // Default to last 24 hours
        endTime = Date.now()
      } = req.query;

      const [metrics, realTimeAnalytics] = await Promise.all([
        this.usageTracker.getUsageMetrics(
          parseInt(startTime as string),
          parseInt(endTime as string)
        ),
        this.usageTracker.getRealTimeAnalytics()
      ]);

      res.json({
        metrics,
        realTime: realTimeAnalytics,
        timeRange: {
          startTime: parseInt(startTime as string),
          endTime: parseInt(endTime as string)
        }
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getDashboardCharts(req: Request, res: Response): Promise<void> {
    try {
      const {
        startTime = Date.now() - 7 * 24 * 60 * 60 * 1000, // Default to last 7 days
        endTime = Date.now(),
        chartTypes = 'pageViews,apiCalls,workflows'
      } = req.query;

      const charts: any = {};
      const requestedCharts = (chartTypes as string).split(',');

      const metrics = await this.usageTracker.getUsageMetrics(
        parseInt(startTime as string),
        parseInt(endTime as string)
      );

      if (requestedCharts.includes('pageViews')) {
        charts.pageViews = {
          type: 'bar',
          title: 'Top Pages',
          data: metrics.pageViews.topPages.slice(0, 10)
        };
      }

      if (requestedCharts.includes('apiCalls')) {
        charts.apiCalls = {
          type: 'line',
          title: 'API Usage',
          data: {
            totalCalls: metrics.apiUsage.totalCalls,
            avgResponseTime: metrics.apiUsage.averageResponseTime,
            errorRate: metrics.apiUsage.errorRate
          }
        };
      }

      if (requestedCharts.includes('workflows')) {
        charts.workflows = {
          type: 'pie',
          title: 'Top Workflows',
          data: metrics.workflows.topWorkflows.slice(0, 10)
        };
      }

      if (requestedCharts.includes('geography')) {
        charts.geography = {
          type: 'map',
          title: 'Users by Country',
          data: metrics.geography.countries.slice(0, 20)
        };
      }

      if (requestedCharts.includes('technology')) {
        charts.technology = {
          type: 'doughnut',
          title: 'Technology Breakdown',
          data: {
            browsers: metrics.technology.browsers.slice(0, 5),
            operatingSystems: metrics.technology.operatingSystems.slice(0, 5),
            devices: metrics.technology.devices.slice(0, 5)
          }
        };
      }

      res.json(charts);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private handleError(error: any, req: Request, res: Response): void {
    logError('Analytics API error', error, { 
      requestId: req.requestId,
      sessionId: req.sessionId,
      method: req.method,
      url: req.url 
    });

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : error.message;

    res.status(statusCode).json({
      error: message,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  private errorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
    this.handleError(error, req, res);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        logger.info('Analytics API server started', {
          port: this.config.port,
          environment: process.env.NODE_ENV || 'development'
        });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Analytics API server stopped');
        resolve();
      });
    });
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      sessionId?: string;
    }
  }
}