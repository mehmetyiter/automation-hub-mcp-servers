import express from 'express';
import { Request, Response } from 'express';
import Joi from 'joi';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';

import { WorkflowMonitor } from '../monitoring/WorkflowMonitor';
import { PerformanceAnalyzer } from '../analyzer/PerformanceAnalyzer';
import { logger } from '../utils/logger';
import { validateAuth } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

export interface PerformanceAPIOptions {
  port: number;
  enableRealTime: boolean;
  rateLimit: {
    windowMs: number;
    max: number;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
}

export class PerformanceAPI {
  private app: express.Application;
  private server: any;
  private io?: SocketIOServer;
  private workflowMonitor: WorkflowMonitor;
  private performanceAnalyzer: PerformanceAnalyzer;
  private rateLimiter?: RateLimiterRedis;
  private redis?: Redis;

  constructor(
    workflowMonitor: WorkflowMonitor,
    performanceAnalyzer: PerformanceAnalyzer,
    private options: PerformanceAPIOptions
  ) {
    this.workflowMonitor = workflowMonitor;
    this.performanceAnalyzer = performanceAnalyzer;
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupRealTimeConnections();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: this.options.cors.origin,
      credentials: this.options.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    if (this.options.redis) {
      this.redis = new Redis(this.options.redis);
      this.rateLimiter = new RateLimiterRedis({
        storeClient: this.redis,
        keyGenerator: (req) => req.ip,
        points: this.options.rateLimit.max,
        duration: this.options.rateLimit.windowMs / 1000,
        blockDuration: 60 // Block for 1 minute
      });

      this.app.use(async (req, res, next) => {
        try {
          await this.rateLimiter!.consume(req.ip);
          next();
        } catch (rejRes) {
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000)
          });
        }
      });
    }

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    const router = express.Router();

    // Health check
    router.get('/health', this.getHealth.bind(this));

    // Workflow metrics endpoints
    router.get('/workflows/:workflowId/metrics', validateAuth, this.getWorkflowMetrics.bind(this));
    router.get('/workflows/:workflowId/bottlenecks', validateAuth, this.getWorkflowBottlenecks.bind(this));
    router.get('/workflows/:workflowId/recommendations', validateAuth, this.getOptimizationRecommendations.bind(this));
    router.get('/workflows/:workflowId/trends', validateAuth, this.getPerformanceTrends.bind(this));
    router.get('/workflows/:workflowId/profile', validateAuth, this.getWorkflowProfile.bind(this));

    // System-wide metrics
    router.get('/metrics/system', validateAuth, this.getSystemMetrics.bind(this));
    router.get('/metrics/overview', validateAuth, this.getMetricsOverview.bind(this));
    router.get('/metrics/workflows', validateAuth, this.getAllWorkflowMetrics.bind(this));

    // Performance analysis
    router.get('/analysis/insights', validateAuth, this.getPerformanceInsights.bind(this));
    router.get('/analysis/report', validateAuth, this.getPerformanceReport.bind(this));
    router.post('/analysis/compare', validateAuth, this.compareWorkflows.bind(this));

    // Real-time monitoring
    router.post('/monitoring/start', validateAuth, this.startMonitoring.bind(this));
    router.post('/monitoring/stop', validateAuth, this.stopMonitoring.bind(this));
    router.put('/monitoring/config', validateAuth, this.updateMonitoringConfig.bind(this));

    // Performance events
    router.post('/events/execution', validateAuth, this.recordExecutionEvent.bind(this));
    router.post('/events/performance', validateAuth, this.recordPerformanceEvent.bind(this));

    // Data export
    router.get('/export/metrics', validateAuth, this.exportMetrics.bind(this));
    router.get('/export/report', validateAuth, this.exportReport.bind(this));

    this.app.use('/api/performance', router);
    this.app.use(errorHandler);

    // Serve OpenAPI documentation
    this.app.get('/docs', (req, res) => {
      res.json(this.generateOpenAPISpec());
    });
  }

  private setupRealTimeConnections(): void {
    if (!this.options.enableRealTime) return;

    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.options.cors.origin,
        credentials: this.options.cors.credentials
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(async (socket, next) => {
      try {
        // Validate authentication for WebSocket connections
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('Authentication required');
        }
        // Add your token validation logic here
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      logger.info('Real-time client connected', { socketId: socket.id });

      socket.on('subscribe_workflow', (workflowId: string) => {
        socket.join(`workflow:${workflowId}`);
        logger.debug('Client subscribed to workflow', { socketId: socket.id, workflowId });
      });

      socket.on('unsubscribe_workflow', (workflowId: string) => {
        socket.leave(`workflow:${workflowId}`);
        logger.debug('Client unsubscribed from workflow', { socketId: socket.id, workflowId });
      });

      socket.on('subscribe_system', () => {
        socket.join('system');
        logger.debug('Client subscribed to system metrics', { socketId: socket.id });
      });

      socket.on('disconnect', () => {
        logger.info('Real-time client disconnected', { socketId: socket.id });
      });
    });

    // Listen to monitoring events
    this.workflowMonitor.on('workflow_execution_completed', (execution) => {
      this.io!.to(`workflow:${execution.workflowId}`).emit('execution_completed', execution);
    });

    this.workflowMonitor.on('workflow_execution_started', (execution) => {
      this.io!.to(`workflow:${execution.workflowId}`).emit('execution_started', execution);
    });

    this.workflowMonitor.on('system_metrics_updated', (metrics) => {
      this.io!.to('system').emit('system_metrics', metrics);
    });

    this.workflowMonitor.on('performance_insight', (insight) => {
      insight.affectedWorkflows.forEach(workflowId => {
        this.io!.to(`workflow:${workflowId}`).emit('performance_insight', insight);
      });
    });
  }

  // API Route Handlers

  private async getHealth(req: Request, res: Response): Promise<void> {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json(health);
  }

  private async getWorkflowMetrics(req: Request, res: Response): Promise<void> {
    const { workflowId } = req.params;
    const { timeRange } = req.query;

    try {
      const metrics = this.workflowMonitor.getWorkflowMetrics(workflowId);
      res.json({
        success: true,
        data: metrics,
        timeRange: timeRange || '24h'
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: error.message
      });
    }
  }

  private async getWorkflowBottlenecks(req: Request, res: Response): Promise<void> {
    const { workflowId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
      const bottlenecks = this.workflowMonitor.getWorkflowBottlenecks(workflowId, limit);
      res.json({
        success: true,
        data: bottlenecks,
        count: bottlenecks.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get bottlenecks',
        message: error.message
      });
    }
  }

  private async getOptimizationRecommendations(req: Request, res: Response): Promise<void> {
    const { workflowId } = req.params;

    try {
      const recommendations = this.workflowMonitor.getOptimizationRecommendations(workflowId);
      res.json({
        success: true,
        data: recommendations,
        count: recommendations.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations',
        message: error.message
      });
    }
  }

  private async getPerformanceTrends(req: Request, res: Response): Promise<void> {
    const { workflowId } = req.params;
    const forecastDays = parseInt(req.query.forecastDays as string) || 7;

    try {
      const trends = this.workflowMonitor.predictPerformanceTrends(workflowId, forecastDays);
      res.json({
        success: true,
        data: trends,
        forecastDays
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get trends',
        message: error.message
      });
    }
  }

  private async getWorkflowProfile(req: Request, res: Response): Promise<void> {
    const { workflowId } = req.params;

    try {
      const profile = this.performanceAnalyzer.getWorkflowProfile(workflowId);
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
          message: `No profile found for workflow ${workflowId}`
        });
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
        message: error.message
      });
    }
  }

  private async getSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const systemHealth = this.workflowMonitor.getSystemHealth();
      res.json({
        success: true,
        data: systemHealth,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get system metrics',
        message: error.message
      });
    }
  }

  private async getMetricsOverview(req: Request, res: Response): Promise<void> {
    try {
      const allMetrics = this.workflowMonitor.getWorkflowMetrics() as any[];
      const systemHealth = this.workflowMonitor.getSystemHealth();
      
      const overview = {
        totalWorkflows: allMetrics.length,
        activeWorkflows: allMetrics.filter(m => 
          Date.now() - m.metrics.lastExecution < 24 * 60 * 60 * 1000
        ).length,
        healthyWorkflows: allMetrics.filter(m => m.status === 'healthy').length,
        warningWorkflows: allMetrics.filter(m => m.status === 'warning').length,
        criticalWorkflows: allMetrics.filter(m => m.status === 'critical').length,
        avgExecutionTime: allMetrics.length > 0 ? 
          allMetrics.reduce((sum, m) => sum + m.metrics.avgExecutionTime, 0) / allMetrics.length : 0,
        avgSuccessRate: allMetrics.length > 0 ? 
          allMetrics.reduce((sum, m) => sum + m.metrics.successRate, 0) / allMetrics.length : 0,
        systemHealth: systemHealth.overall
      };

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get overview',
        message: error.message
      });
    }
  }

  private async getAllWorkflowMetrics(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const sortBy = req.query.sortBy as string || 'lastUpdated';
    const sortOrder = req.query.sortOrder as string || 'desc';

    try {
      let allMetrics = this.workflowMonitor.getWorkflowMetrics() as any[];

      // Filter by status
      if (status) {
        allMetrics = allMetrics.filter(m => m.status === status);
      }

      // Sort
      allMetrics.sort((a, b) => {
        const aVal = a.metrics[sortBy] || a[sortBy];
        const bVal = b.metrics[sortBy] || b[sortBy];
        
        if (sortOrder === 'desc') {
          return bVal - aVal;
        }
        return aVal - bVal;
      });

      // Paginate
      const total = allMetrics.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMetrics = allMetrics.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedMetrics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: startIndex > 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow metrics',
        message: error.message
      });
    }
  }

  private async getPerformanceInsights(req: Request, res: Response): Promise<void> {
    const severity = req.query.severity as string;
    const type = req.query.type as string;
    const limit = parseInt(req.query.limit as string) || 100;

    try {
      let insights = this.workflowMonitor.getPerformanceInsights();

      // Filter by severity
      if (severity) {
        insights = insights.filter(i => i.severity === severity);
      }

      // Filter by type
      if (type) {
        insights = insights.filter(i => i.type === type);
      }

      // Limit results
      insights = insights.slice(0, limit);

      res.json({
        success: true,
        data: insights,
        count: insights.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get insights',
        message: error.message
      });
    }
  }

  private async getPerformanceReport(req: Request, res: Response): Promise<void> {
    const timeRangeMs = parseInt(req.query.timeRange as string) || 24 * 60 * 60 * 1000;

    try {
      const report = await this.workflowMonitor.generatePerformanceReport(timeRangeMs);
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        message: error.message
      });
    }
  }

  private async compareWorkflows(req: Request, res: Response): Promise<void> {
    const schema = Joi.object({
      workflowIds: Joi.array().items(Joi.string().required()).min(2).max(10).required(),
      metrics: Joi.array().items(Joi.string()).default(['avgExecutionTime', 'successRate', 'throughput']),
      timeRange: Joi.number().default(24 * 60 * 60 * 1000)
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    try {
      const { workflowIds, metrics: requestedMetrics } = value;
      const comparison: any = {
        workflowIds,
        metrics: {},
        comparison: {}
      };

      // Get metrics for each workflow
      for (const workflowId of workflowIds) {
        try {
          const workflowMetrics = this.workflowMonitor.getWorkflowMetrics(workflowId) as any;
          comparison.metrics[workflowId] = workflowMetrics;
        } catch (error) {
          comparison.metrics[workflowId] = null;
        }
      }

      // Generate comparison insights
      for (const metric of requestedMetrics) {
        const values = workflowIds.map((id: string) => 
          comparison.metrics[id]?.metrics?.[metric] || 0
        );
        
        comparison.comparison[metric] = {
          best: Math.max(...values),
          worst: Math.min(...values),
          average: values.reduce((a: number, b: number) => a + b, 0) / values.length,
          ranking: workflowIds.map((id: string, index: number) => ({
            workflowId: id,
            value: values[index],
            rank: values.filter((v: number) => v > values[index]).length + 1
          })).sort((a: any, b: any) => a.rank - b.rank)
        };
      }

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to compare workflows',
        message: error.message
      });
    }
  }

  private async startMonitoring(req: Request, res: Response): Promise<void> {
    const schema = Joi.object({
      workflowId: Joi.string().required(),
      workflowName: Joi.string().required(),
      userId: Joi.string().required(),
      triggerType: Joi.string().valid('manual', 'webhook', 'cron', 'event').required(),
      inputData: Joi.any().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    try {
      const executionId = await this.workflowMonitor.monitorWorkflowExecution(
        value.workflowId,
        value.workflowName,
        value.userId,
        value.triggerType,
        value.inputData
      );

      res.json({
        success: true,
        data: { executionId },
        message: 'Monitoring started'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to start monitoring',
        message: error.message
      });
    }
  }

  private async stopMonitoring(req: Request, res: Response): Promise<void> {
    const schema = Joi.object({
      executionId: Joi.string().required(),
      status: Joi.string().valid('completed', 'failed', 'cancelled').required(),
      outputData: Joi.any().optional(),
      errorMessage: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    try {
      await this.workflowMonitor.completeWorkflowExecution(
        value.executionId,
        value.status,
        value.outputData,
        value.errorMessage
      );

      res.json({
        success: true,
        message: 'Monitoring completed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to stop monitoring',
        message: error.message
      });
    }
  }

  private async updateMonitoringConfig(req: Request, res: Response): Promise<void> {
    const schema = Joi.object({
      enableRealTimeMonitoring: Joi.boolean().optional(),
      samplingRate: Joi.number().min(0).max(1).optional(),
      alertThresholds: Joi.object({
        executionTimeMs: Joi.number().positive().optional(),
        errorRatePercent: Joi.number().min(0).max(100).optional(),
        memoryUsageMB: Joi.number().positive().optional(),
        queueDepthLimit: Joi.number().positive().optional()
      }).optional(),
      retentionPeriodDays: Joi.number().positive().optional(),
      exportMetrics: Joi.boolean().optional(),
      enablePredictiveAnalysis: Joi.boolean().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    try {
      this.workflowMonitor.updateConfiguration(value);
      res.json({
        success: true,
        message: 'Configuration updated'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration',
        message: error.message
      });
    }
  }

  private async recordExecutionEvent(req: Request, res: Response): Promise<void> {
    const schema = Joi.object({
      executionId: Joi.string().required(),
      nodeId: Joi.string().required(),
      nodeName: Joi.string().required(),
      nodeType: Joi.string().required(),
      event: Joi.string().valid('start', 'complete', 'error').required(),
      data: Joi.any().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    try {
      // Handle the execution event based on type
      if (value.event === 'start') {
        await this.workflowMonitor.monitorNodeExecution(
          value.executionId,
          value.nodeId,
          value.nodeName,
          value.nodeType,
          value.data?.inputCount || 0
        );
      } else {
        // This would need the node execution ID, which should be stored
        // For now, we'll just acknowledge the event
      }

      res.json({
        success: true,
        message: 'Event recorded'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to record event',
        message: error.message
      });
    }
  }

  private async recordPerformanceEvent(req: Request, res: Response): Promise<void> {
    const schema = Joi.object({
      executionId: Joi.string().required(),
      eventType: Joi.string().valid('network_call', 'db_query', 'cache_hit', 'cache_miss', 'retry').required(),
      duration: Joi.number().optional(),
      metadata: Joi.any().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    try {
      this.workflowMonitor.recordPerformanceEvent(
        value.executionId,
        value.eventType,
        value.duration,
        value.metadata
      );

      res.json({
        success: true,
        message: 'Performance event recorded'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to record performance event',
        message: error.message
      });
    }
  }

  private async exportMetrics(req: Request, res: Response): Promise<void> {
    const format = req.query.format as string || 'json';
    const workflowId = req.query.workflowId as string;
    const timeRange = parseInt(req.query.timeRange as string) || 24 * 60 * 60 * 1000;

    try {
      let data;
      
      if (workflowId) {
        data = this.workflowMonitor.getWorkflowMetrics(workflowId);
      } else {
        data = this.workflowMonitor.getWorkflowMetrics();
      }

      if (format === 'csv') {
        // Convert to CSV format
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
        // Add CSV conversion logic here
        res.send('CSV export not implemented yet');
      } else {
        res.json({
          success: true,
          data,
          format,
          exportedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to export metrics',
        message: error.message
      });
    }
  }

  private async exportReport(req: Request, res: Response): Promise<void> {
    const format = req.query.format as string || 'json';
    const timeRange = parseInt(req.query.timeRange as string) || 24 * 60 * 60 * 1000;

    try {
      const report = await this.workflowMonitor.generatePerformanceReport(timeRange);

      if (format === 'pdf') {
        // Generate PDF report
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=performance-report.pdf');
        // Add PDF generation logic here
        res.send('PDF export not implemented yet');
      } else {
        res.json({
          success: true,
          data: report,
          format,
          exportedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to export report',
        message: error.message
      });
    }
  }

  private generateOpenAPISpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'n8n-MCP Performance Monitoring API',
        version: '1.0.0',
        description: 'API for monitoring and analyzing workflow performance'
      },
      servers: [
        {
          url: `http://localhost:${this.options.port}/api/performance`,
          description: 'Performance Monitoring API'
        }
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'Service is healthy'
              }
            }
          }
        },
        '/workflows/{workflowId}/metrics': {
          get: {
            summary: 'Get workflow metrics',
            parameters: [
              {
                name: 'workflowId',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              }
            ],
            responses: {
              '200': {
                description: 'Workflow metrics retrieved successfully'
              }
            }
          }
        }
        // Add more API endpoints as needed
      }
    };
  }

  async start(): Promise<void> {
    const server = this.server || this.app;
    
    return new Promise((resolve, reject) => {
      server.listen(this.options.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          logger.info('Performance API started', {
            port: this.options.port,
            realTime: this.options.enableRealTime
          });
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.server || this.app;
      server.close(() => {
        if (this.redis) {
          this.redis.disconnect();
        }
        logger.info('Performance API stopped');
        resolve();
      });
    });
  }
}