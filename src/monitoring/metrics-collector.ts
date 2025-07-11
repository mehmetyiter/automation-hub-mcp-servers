import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import express from 'express';
import { Request, Response } from 'express';

export class MetricsCollector {
  private apiRequestsTotal: Counter<string>;
  private apiRequestDuration: Histogram<string>;
  private apiCostTotal: Counter<string>;
  private apiUsageCurrent: Gauge<string>;
  private apiUsageLimit: Gauge<string>;
  private credentialValidationFailures: Counter<string>;
  private activeConnections: Gauge<string>;
  private databaseConnections: Gauge<string>;
  private redisConnections: Gauge<string>;

  constructor() {
    collectDefaultMetrics({ prefix: 'n8n_mcp_' });

    this.apiRequestsTotal = new Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'route', 'status_code', 'user_id']
    });

    this.apiRequestDuration = new Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.apiCostTotal = new Counter({
      name: 'api_cost_total',
      help: 'Total API costs in USD',
      labelNames: ['user_id', 'service', 'operation']
    });

    this.apiUsageCurrent = new Gauge({
      name: 'api_usage_current',
      help: 'Current API usage for users',
      labelNames: ['user_id', 'period']
    });

    this.apiUsageLimit = new Gauge({
      name: 'api_usage_limit',
      help: 'API usage limits for users',
      labelNames: ['user_id', 'period']
    });

    this.credentialValidationFailures = new Counter({
      name: 'credential_validation_failures_total',
      help: 'Total credential validation failures',
      labelNames: ['service', 'error_type']
    });

    this.activeConnections = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      labelNames: ['user_id']
    });

    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections'
    });

    this.redisConnections = new Gauge({
      name: 'redis_connections_active',
      help: 'Number of active Redis connections'
    });

    register.registerMetric(this.apiRequestsTotal);
    register.registerMetric(this.apiRequestDuration);
    register.registerMetric(this.apiCostTotal);
    register.registerMetric(this.apiUsageCurrent);
    register.registerMetric(this.apiUsageLimit);
    register.registerMetric(this.credentialValidationFailures);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.databaseConnections);
    register.registerMetric(this.redisConnections);
  }

  recordApiRequest(
    method: string,
    route: string,
    statusCode: number,
    userId?: string,
    duration?: number
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      user_id: userId || 'anonymous'
    };

    this.apiRequestsTotal.inc(labels);

    if (duration !== undefined) {
      this.apiRequestDuration
        .labels({ method, route })
        .observe(duration);
    }
  }

  recordApiCost(
    userId: string,
    service: string,
    operation: string,
    cost: number
  ): void {
    this.apiCostTotal
      .labels({ user_id: userId, service, operation })
      .inc(cost);
  }

  updateUsageMetrics(
    userId: string,
    period: string,
    current: number,
    limit: number
  ): void {
    this.apiUsageCurrent
      .labels({ user_id: userId, period })
      .set(current);

    this.apiUsageLimit
      .labels({ user_id: userId, period })
      .set(limit);
  }

  recordCredentialFailure(
    service: string,
    errorType: string
  ): void {
    this.credentialValidationFailures
      .labels({ service, error_type: errorType })
      .inc();
  }

  setActiveConnections(userId: string, count: number): void {
    this.activeConnections
      .labels({ user_id: userId })
      .set(count);
  }

  setDatabaseConnections(count: number): void {
    this.databaseConnections.set(count);
  }

  setRedisConnections(count: number): void {
    this.redisConnections.set(count);
  }

  getMetricsMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        const userId = (req as any).user?.id;
        
        this.recordApiRequest(
          req.method,
          route,
          res.statusCode,
          userId,
          duration
        );
      });
      
      next();
    };
  }

  setupMetricsEndpoint(app: express.Application): void {
    app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
      } catch (error) {
        res.status(500).end(error);
      }
    });

    app.get('/api/metrics/custom', async (req: Request, res: Response) => {
      try {
        const customMetrics = {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        };
        
        res.json(customMetrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to collect custom metrics' });
      }
    });
  }

  async collectSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      console.log('System Metrics:', {
        timestamp: new Date().toISOString(),
        memory: {
          rss: memUsage.rss / 1024 / 1024,
          heapUsed: memUsage.heapUsed / 1024 / 1024,
          heapTotal: memUsage.heapTotal / 1024 / 1024,
          external: memUsage.external / 1024 / 1024
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime()
      });
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  startMetricsCollection(intervalMs: number = 30000): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }
}