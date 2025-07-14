import { EventEmitter } from 'events';
import { circuitBreakerManager } from './circuit-breaker.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version?: string;
  environment?: string;
  components: ComponentHealth;
  metrics: SystemMetrics;
  alerts?: HealthAlert[];
}

export interface ComponentHealth {
  database: HealthCheck;
  cache: HealthCheck;
  externalServices: HealthCheck;
  circuitBreakers: HealthCheck;
  memory: HealthCheck;
  cpu: HealthCheck;
  disk: HealthCheck;
  performance: HealthCheck;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastChecked: number;
  message?: string;
  details?: any;
}

export interface SystemMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    usagePercentage: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    total: number;
    loadAverage: number[];
  };
  diskUsage?: {
    used: number;
    free: number;
    total: number;
    usagePercentage: number;
  };
  networkConnections?: {
    active: number;
    waiting: number;
    total: number;
  };
  processInfo: {
    pid: number;
    uptime: number;
    nodeVersion: string;
    platform: string;
    arch: string;
  };
}

export interface HealthAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: number;
  threshold?: number;
  currentValue?: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  thresholds: {
    memory: {
      warning: number;
      critical: number;
    };
    cpu: {
      warning: number;
      critical: number;
    };
    responseTime: {
      warning: number;
      critical: number;
    };
  };
}

export class HealthChecker extends EventEmitter {
  private startTime: number;
  private lastHealthCheck: HealthStatus | null = null;
  private checkInterval?: NodeJS.Timeout;
  private config: HealthCheckConfig;
  private externalServices: Map<string, () => Promise<boolean>> = new Map();
  private customCheckers: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor(config?: Partial<HealthCheckConfig>) {
    super();
    
    this.startTime = Date.now();
    this.config = {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
      thresholds: {
        memory: { warning: 80, critical: 95 },
        cpu: { warning: 80, critical: 95 },
        responseTime: { warning: 1000, critical: 5000 }
      },
      ...config
    };

    console.log('🏥 Health Checker initialized with config:', this.config);

    if (this.config.enabled) {
      this.startPeriodicChecks();
    }
  }

  async checkSystemHealth(): Promise<HealthStatus> {
    console.log('🔍 Performing system health check...');
    
    const startTime = Date.now();
    const components: ComponentHealth = {
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      externalServices: await this.checkExternalServices(),
      circuitBreakers: await this.checkCircuitBreakers(),
      memory: await this.checkMemory(),
      cpu: await this.checkCPU(),
      disk: await this.checkDisk(),
      performance: await this.checkPerformance()
    };

    const metrics = await this.collectSystemMetrics();
    const alerts = this.generateAlerts(components, metrics);
    const overallStatus = this.calculateOverallHealth(components);
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      components,
      metrics,
      alerts: alerts.length > 0 ? alerts : undefined
    };

    const checkDuration = Date.now() - startTime;
    console.log(`✅ Health check completed in ${checkDuration}ms - Status: ${overallStatus}`);

    this.lastHealthCheck = healthStatus;
    this.emit('healthCheck', healthStatus);

    return healthStatus;
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simulate database health check
      // In production, this would ping the actual database
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < this.config.thresholds.responseTime.warning ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: Date.now(),
        message: 'Database connection successful',
        details: {
          connectionPool: {
            active: 5,
            idle: 3,
            total: 8
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simulate cache health check
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        lastChecked: Date.now(),
        message: 'Cache is responding normally',
        details: {
          hitRate: 85.5,
          evictions: 12,
          size: 1024
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Cache check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    const results: Array<{ name: string; success: boolean; responseTime: number }> = [];
    
    for (const [serviceName, checker] of this.externalServices) {
      const serviceStartTime = Date.now();
      try {
        const success = await Promise.race([
          checker(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
          )
        ]);
        
        results.push({
          name: serviceName,
          success,
          responseTime: Date.now() - serviceStartTime
        });
      } catch (error) {
        results.push({
          name: serviceName,
          success: false,
          responseTime: Date.now() - serviceStartTime
        });
      }
    }

    const totalResponseTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (totalCount === 0) {
      status = 'healthy'; // No external services configured
    } else if (successCount === totalCount) {
      status = 'healthy';
    } else if (successCount > totalCount / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      responseTime: totalResponseTime,
      lastChecked: Date.now(),
      message: totalCount > 0 ? `${successCount}/${totalCount} external services healthy` : 'No external services configured',
      details: {
        services: results
      }
    };
  }

  private async checkCircuitBreakers(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const cbHealth = circuitBreakerManager.getHealthStatus();
      const stats = circuitBreakerManager.getAllStats();
      
      const status = cbHealth.healthy ? 'healthy' : 'degraded';
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: cbHealth.healthy ? 'All circuit breakers healthy' : 'Some circuit breakers are open',
        details: {
          summary: stats.summary,
          breakers: cbHealth.details
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Circuit breaker check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const usagePercentage = (memUsage.rss / totalMem) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (usagePercentage < this.config.thresholds.memory.warning) {
        status = 'healthy';
      } else if (usagePercentage < this.config.thresholds.memory.critical) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Memory usage: ${usagePercentage.toFixed(1)}%`,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
          external: memUsage.external,
          usagePercentage
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkCPU(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const cpuUsage = process.cpuUsage();
      const loadAvg = require('os').loadavg();
      
      // Simple CPU usage estimation (this is a basic approximation)
      const totalCpuTime = cpuUsage.user + cpuUsage.system;
      const cpuPercentage = Math.min((totalCpuTime / 1000000) * 100, 100); // Convert microseconds to percentage
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (cpuPercentage < this.config.thresholds.cpu.warning) {
        status = 'healthy';
      } else if (cpuPercentage < this.config.thresholds.cpu.critical) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `CPU usage: ${cpuPercentage.toFixed(1)}%, Load avg: ${loadAvg[0].toFixed(2)}`,
        details: {
          usage: cpuUsage,
          loadAverage: loadAvg,
          percentage: cpuPercentage
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `CPU check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkDisk(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Note: Getting disk usage in Node.js requires platform-specific code
      // This is a simplified implementation
      const fs = require('fs');
      const path = require('path');
      
      const stats = fs.statSync(process.cwd());
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: 'Disk access successful',
        details: {
          accessible: true,
          path: process.cwd()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Disk check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkPerformance(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check event loop lag
      const lagStart = process.hrtime.bigint();
      await new Promise(resolve => setImmediate(resolve));
      const lag = Number(process.hrtime.bigint() - lagStart) / 1000000; // Convert to ms
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (lag < 10) {
        status = 'healthy';
      } else if (lag < 100) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Event loop lag: ${lag.toFixed(2)}ms`,
        details: {
          eventLoopLag: lag,
          uptime: process.uptime()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        message: `Performance check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const os = require('os');
    
    return {
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        usagePercentage: (memUsage.rss / os.totalmem()) * 100
      },
      cpuUsage: {
        user: cpuUsage.user / 1000, // Convert to ms
        system: cpuUsage.system / 1000,
        total: (cpuUsage.user + cpuUsage.system) / 1000,
        loadAverage: os.loadavg()
      },
      processInfo: {
        pid: process.pid,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  private generateAlerts(components: ComponentHealth, metrics: SystemMetrics): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    
    // Memory alerts
    if (metrics.memoryUsage.usagePercentage > this.config.thresholds.memory.critical) {
      alerts.push({
        level: 'critical',
        component: 'memory',
        message: `Critical memory usage: ${metrics.memoryUsage.usagePercentage.toFixed(1)}%`,
        timestamp: Date.now(),
        threshold: this.config.thresholds.memory.critical,
        currentValue: metrics.memoryUsage.usagePercentage
      });
    } else if (metrics.memoryUsage.usagePercentage > this.config.thresholds.memory.warning) {
      alerts.push({
        level: 'warning',
        component: 'memory',
        message: `High memory usage: ${metrics.memoryUsage.usagePercentage.toFixed(1)}%`,
        timestamp: Date.now(),
        threshold: this.config.thresholds.memory.warning,
        currentValue: metrics.memoryUsage.usagePercentage
      });
    }
    
    // Component alerts
    Object.entries(components).forEach(([componentName, health]) => {
      if (health.status === 'unhealthy') {
        alerts.push({
          level: 'error',
          component: componentName,
          message: health.message || `${componentName} is unhealthy`,
          timestamp: Date.now()
        });
      } else if (health.status === 'degraded') {
        alerts.push({
          level: 'warning',
          component: componentName,
          message: health.message || `${componentName} is degraded`,
          timestamp: Date.now()
        });
      }
    });
    
    return alerts;
  }

  private calculateOverallHealth(components: ComponentHealth): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  // Public API methods
  addExternalService(name: string, checker: () => Promise<boolean>): void {
    this.externalServices.set(name, checker);
    console.log(`🔗 Added external service health check: ${name}`);
  }

  removeExternalService(name: string): boolean {
    const removed = this.externalServices.delete(name);
    if (removed) {
      console.log(`🗑️ Removed external service health check: ${name}`);
    }
    return removed;
  }

  addCustomCheck(name: string, checker: () => Promise<HealthCheck>): void {
    this.customCheckers.set(name, checker);
    console.log(`🛠️ Added custom health check: ${name}`);
  }

  removeCustomCheck(name: string): boolean {
    const removed = this.customCheckers.delete(name);
    if (removed) {
      console.log(`🗑️ Removed custom health check: ${name}`);
    }
    return removed;
  }

  getLastHealthCheck(): HealthStatus | null {
    return this.lastHealthCheck;
  }

  startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        console.error('Periodic health check failed:', error);
        this.emit('error', error);
      }
    }, this.config.interval);
    
    console.log(`⏰ Started periodic health checks (interval: ${this.config.interval}ms)`);
  }

  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('⏹️ Stopped periodic health checks');
    }
  }

  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Health checker configuration updated:', newConfig);
    
    if (this.config.enabled && !this.checkInterval) {
      this.startPeriodicChecks();
    } else if (!this.config.enabled && this.checkInterval) {
      this.stopPeriodicChecks();
    }
  }

  // Express.js middleware for health check endpoint
  createHealthCheckMiddleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const health = await this.checkSystemHealth();
        
        // Set appropriate HTTP status code
        let statusCode = 200;
        if (health.status === 'degraded') {
          statusCode = 200; // Still OK, but with warnings
        } else if (health.status === 'unhealthy') {
          statusCode = 503; // Service Unavailable
        }
        
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
  }

  // Readiness check (for Kubernetes)
  async readinessCheck(): Promise<{ ready: boolean; details?: any }> {
    try {
      const health = await this.checkSystemHealth();
      return {
        ready: health.status !== 'unhealthy',
        details: {
          status: health.status,
          components: health.components
        }
      };
    } catch (error) {
      return {
        ready: false,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Liveness check (for Kubernetes)
  async livenessCheck(): Promise<{ alive: boolean; details?: any }> {
    try {
      // Basic liveness check - just ensure the process is responsive
      const startTime = Date.now();
      await new Promise(resolve => setImmediate(resolve));
      const responseTime = Date.now() - startTime;
      
      return {
        alive: responseTime < 1000, // If event loop is severely blocked, consider not alive
        details: {
          responseTime,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      };
    } catch (error) {
      return {
        alive: false,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  cleanup(): void {
    console.log('🧹 Cleaning up Health Checker...');
    
    this.stopPeriodicChecks();
    this.removeAllListeners();
    this.externalServices.clear();
    this.customCheckers.clear();
    
    console.log('✅ Health Checker cleanup completed');
  }

  // Missing methods for auto-scaler
  getOverallHealth(): Promise<HealthStatus> {
    return this.checkSystemHealth();
  }

  registerComponent(name: string, checker: () => Promise<HealthCheck>): void {
    this.addCustomCheck(name, checker);
  }
}

// Singleton instance for global use
export const healthChecker = new HealthChecker();

// Helper functions for quick health checks
export async function getSystemHealth(): Promise<HealthStatus> {
  return healthChecker.checkSystemHealth();
}

export async function isSystemHealthy(): Promise<boolean> {
  const health = await healthChecker.checkSystemHealth();
  return health.status === 'healthy';
}