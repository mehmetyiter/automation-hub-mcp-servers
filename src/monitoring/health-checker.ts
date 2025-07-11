import { Request, Response } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: any;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: HealthCheck[];
}

export class HealthChecker {
  private dbPool: Pool;
  private redisClient: Redis;
  private startTime: Date;

  constructor(dbPool: Pool, redisClient: Redis) {
    this.dbPool = dbPool;
    this.redisClient = redisClient;
    this.startTime = new Date();
  }

  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const result = await this.dbPool.query('SELECT 1 as health_check');
      const responseTime = Date.now() - start;
      
      return {
        service: 'database',
        status: 'healthy',
        responseTime,
        details: {
          totalConnections: this.dbPool.totalCount,
          idleConnections: this.dbPool.idleCount,
          waitingClients: this.dbPool.waitingCount
        }
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown database error',
        responseTime: Date.now() - start
      };
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.redisClient.ping();
      const info = await this.redisClient.info('server');
      const responseTime = Date.now() - start;
      
      return {
        service: 'redis',
        status: 'healthy',
        responseTime,
        details: {
          connected: this.redisClient.status === 'ready',
          info: this.parseRedisInfo(info)
        }
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown Redis error',
        responseTime: Date.now() - start
      };
    }
  }

  async checkExternalServices(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    
    const externalServices = [
      { name: 'openai', url: 'https://api.openai.com/v1/models' },
      { name: 'anthropic', url: 'https://api.anthropic.com/v1/messages' }
    ];

    for (const service of externalServices) {
      const start = Date.now();
      try {
        const response = await fetch(service.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        
        const responseTime = Date.now() - start;
        
        checks.push({
          service: service.name,
          status: response.ok ? 'healthy' : 'degraded',
          responseTime,
          details: {
            statusCode: response.status,
            statusText: response.statusText
          }
        });
      } catch (error) {
        checks.push({
          service: service.name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - start
        });
      }
    }

    return checks;
  }

  checkMemory(): HealthCheck {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
    }

    return {
      service: 'memory',
      status,
      details: {
        heapUsed: Math.round(usedMemory / 1024 / 1024),
        heapTotal: Math.round(totalMemory / 1024 / 1024),
        usagePercent: Math.round(memoryUsagePercent),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      }
    };
  }

  async performHealthCheck(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      ...await this.checkExternalServices()
    ]);

    checks.push(this.checkMemory());

    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      services: checks
    };
  }

  async healthCheckHandler(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.performHealthCheck();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Health check failed',
        services: []
      });
    }
  }

  async readinessHandler(req: Request, res: Response): Promise<void> {
    try {
      const dbCheck = await this.checkDatabase();
      const redisCheck = await this.checkRedis();
      
      const isReady = dbCheck.status === 'healthy' && redisCheck.status === 'healthy';
      
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        timestamp: new Date().toISOString(),
        checks: [dbCheck, redisCheck]
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Readiness check failed'
      });
    }
  }

  livenessHandler(req: Request, res: Response): void {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000)
    });
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const parsed: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = value;
      }
    }
    
    return {
      version: parsed.redis_version,
      uptime_in_seconds: parseInt(parsed.uptime_in_seconds || '0'),
      connected_clients: parseInt(parsed.connected_clients || '0'),
      used_memory_human: parsed.used_memory_human,
      total_commands_processed: parseInt(parsed.total_commands_processed || '0')
    };
  }
}