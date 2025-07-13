import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { logger, addRequestId, logRequest, logError } from '../utils/logger';
import { ErrorTrackingIntegration } from '../integration/ErrorTrackingIntegration';

export interface APIConfig {
  port: number;
  corsOrigin: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  enableWebSocket: boolean;
  enableMetrics: boolean;
}

export class ErrorTrackingAPI {
  private app: express.Application;
  private server: any;
  private io?: SocketIOServer;
  private errorTrackingIntegration: ErrorTrackingIntegration;

  constructor(
    errorTrackingIntegration: ErrorTrackingIntegration,
    private config: APIConfig
  ) {
    this.errorTrackingIntegration = errorTrackingIntegration;
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
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
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
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logRequest(req.method, req.url, res.statusCode, duration, {
          requestId: req.requestId,
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
      logger.info('WebSocket client connected', { socketId: socket.id });

      socket.on('subscribe_errors', (data) => {
        const { workflowId, userId } = data || {};
        socket.join(`errors:${workflowId || 'all'}`);
        if (userId) {
          socket.join(`user:${userId}`);
        }
        logger.debug('Client subscribed to error updates', { socketId: socket.id, workflowId, userId });
      });

      socket.on('subscribe_alerts', (data) => {
        const { severity, type } = data || {};
        socket.join(`alerts:${severity || 'all'}`);
        if (type) {
          socket.join(`alerts_type:${type}`);
        }
        logger.debug('Client subscribed to alert updates', { socketId: socket.id, severity, type });
      });

      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { socketId: socket.id });
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

    // Error tracking routes
    this.app.post('/api/errors', this.captureError.bind(this));
    this.app.get('/api/errors', this.getErrors.bind(this));
    this.app.get('/api/errors/:errorId', this.getError.bind(this));
    this.app.get('/api/errors/search', this.searchErrors.bind(this));
    this.app.get('/api/errors/trends', this.getErrorTrends.bind(this));

    // Error groups routes
    this.app.get('/api/error-groups', this.getErrorGroups.bind(this));
    this.app.get('/api/error-groups/:fingerprint', this.getErrorGroup.bind(this));
    this.app.patch('/api/error-groups/:fingerprint', this.updateErrorGroup.bind(this));
    this.app.post('/api/error-groups/:fingerprint/resolve', this.resolveErrorGroup.bind(this));

    // Analytics routes
    this.app.get('/api/analytics', this.getAnalytics.bind(this));
    this.app.get('/api/analytics/stats', this.getStats.bind(this));

    // Alert routes
    this.app.get('/api/alerts', this.getAlerts.bind(this));
    this.app.post('/api/alerts/:alertId/acknowledge', this.acknowledgeAlert.bind(this));
    this.app.post('/api/alerts/:alertId/resolve', this.resolveAlert.bind(this));

    // Notification routes
    this.app.post('/api/notifications/channels', this.configureNotificationChannel.bind(this));
    this.post('/api/notifications/channels/:channelId/test', this.testNotificationChannel.bind(this));

    // Breadcrumbs route
    this.app.post('/api/breadcrumbs', this.addBreadcrumb.bind(this));

    // Error handler
    this.app.use(this.errorHandler.bind(this));
  }

  private setupEventListeners(): void {
    // Listen for error events and broadcast via WebSocket
    this.errorTrackingIntegration.on('error_processed', (data) => {
      if (this.io) {
        this.io.to('errors:all').emit('error_captured', data);
        if (data.workflowId) {
          this.io.to(`errors:${data.workflowId}`).emit('error_captured', data);
        }
      }
    });

    // Listen for alert events
    this.errorTrackingIntegration.on('alert_created', (alert) => {
      if (this.io) {
        this.io.to('alerts:all').emit('alert_created', alert);
        this.io.to(`alerts:${alert.severity}`).emit('alert_created', alert);
        this.io.to(`alerts_type:${alert.type}`).emit('alert_created', alert);
      }
    });

    // Listen for escalation events
    this.errorTrackingIntegration.on('alert_escalated', (escalation) => {
      if (this.io) {
        this.io.to('alerts:all').emit('alert_escalated', escalation);
        this.io.to('alerts:critical').emit('alert_escalated', escalation);
      }
    });
  }

  // API Route Handlers

  private async captureError(req: Request, res: Response): Promise<void> {
    try {
      const { error, context, metadata, level } = req.body;

      if (!error) {
        res.status(400).json({ error: 'Error data is required' });
        return;
      }

      const errorId = await this.errorTrackingIntegration.captureError(
        error,
        context,
        { ...metadata, requestId: req.requestId },
        level
      );

      res.status(201).json({ errorId, message: 'Error captured successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getErrors(req: Request, res: Response): Promise<void> {
    try {
      const {
        limit = 50,
        offset = 0,
        level,
        type,
        workflowId,
        userId,
        startTime,
        endTime
      } = req.query;

      const result = await this.errorTrackingIntegration.searchErrors({
        level: level as string,
        type: type as string,
        workflowId: workflowId as string,
        userId: userId as string,
        startTime: startTime ? parseInt(startTime as string) : undefined,
        endTime: endTime ? parseInt(endTime as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json(result);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getError(req: Request, res: Response): Promise<void> {
    try {
      const { errorId } = req.params;
      
      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async searchErrors(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.errorTrackingIntegration.searchErrors(req.query as any);
      res.json(result);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getErrorTrends(req: Request, res: Response): Promise<void> {
    try {
      const {
        timeRange = 7 * 24 * 60 * 60 * 1000,
        granularity = 'hour'
      } = req.query;

      const trends = await this.errorTrackingIntegration.getErrorTrends(
        parseInt(timeRange as string),
        granularity as 'hour' | 'day'
      );

      res.json(trends);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getErrorGroups(req: Request, res: Response): Promise<void> {
    try {
      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getErrorGroup(req: Request, res: Response): Promise<void> {
    try {
      const { fingerprint } = req.params;
      
      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async updateErrorGroup(req: Request, res: Response): Promise<void> {
    try {
      const { fingerprint } = req.params;
      const updates = req.body;
      
      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async resolveErrorGroup(req: Request, res: Response): Promise<void> {
    try {
      const { fingerprint } = req.params;
      const { resolvedBy, resolution } = req.body;

      await this.errorTrackingIntegration.resolveErrorGroup(fingerprint, resolvedBy, resolution);
      res.json({ message: 'Error group resolved successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const {
        timeRange = 24 * 60 * 60 * 1000
      } = req.query;

      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.errorTrackingIntegration.getStats();
      res.json(stats);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { acknowledgedBy, note } = req.body;

      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { resolvedBy, resolution, rootCause } = req.body;

      // This would need to be implemented in the integration
      res.status(501).json({ error: 'Not implemented' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async configureNotificationChannel(req: Request, res: Response): Promise<void> {
    try {
      const channel = req.body;
      await this.errorTrackingIntegration.configureNotificationChannel(channel);
      res.json({ message: 'Notification channel configured successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async testNotificationChannel(req: Request, res: Response): Promise<void> {
    try {
      const { channelId } = req.params;
      const result = await this.errorTrackingIntegration.testNotificationChannel(channelId);
      res.json(result);
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private async addBreadcrumb(req: Request, res: Response): Promise<void> {
    try {
      const { category, message, level, data } = req.body;

      if (!category || !message) {
        res.status(400).json({ error: 'Category and message are required' });
        return;
      }

      this.errorTrackingIntegration.addBreadcrumb(category, message, level, data);
      res.json({ message: 'Breadcrumb added successfully' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private handleError(error: any, req: Request, res: Response): void {
    logError('API error', error, { 
      requestId: req.requestId,
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
        logger.info('Error Tracking API server started', {
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
        logger.info('Error Tracking API server stopped');
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
    }
  }
}