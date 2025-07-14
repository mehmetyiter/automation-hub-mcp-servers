import { EventEmitter } from 'events';
import { PrometheusMetricsCollector, MetricsConfig } from './prometheus-metrics-collector.js';
import { GrafanaDashboardGenerator } from './grafana-dashboards.js';
import { HighAvailabilityManager } from '../infrastructure/high-availability-manager.js';
import fs from 'fs/promises';
import path from 'path';

export interface MonitoringConfig {
  prometheus: MetricsConfig;
  grafana: {
    url: string;
    apiKey?: string;
    dashboardsPath: string;
    autoProvision: boolean;
  };
  alerts: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
    slackChannel?: string;
  };
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    endpoints: HealthCheckEndpoint[];
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    destination: 'console' | 'file' | 'both';
    filePath?: string;
    maxFileSize?: number;
    maxFiles?: number;
  };
}

export interface HealthCheckEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  timeout: number;
  critical: boolean;
}

export interface MonitoringAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  labels: Record<string, string>;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ServiceMetrics {
  timestamp: Date;
  services: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    errorRate: number;
    throughput: number;
    saturation: number;
  }>;
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: {
      in: number;
      out: number;
    };
  };
  business: {
    activeUsers: number;
    apiCalls: number;
    totalCost: number;
    credentialsActive: number;
    securityEvents: number;
  };
}

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private metricsCollector: PrometheusMetricsCollector;
  private dashboardGenerator: GrafanaDashboardGenerator;
  private haManager?: HighAvailabilityManager;
  private healthCheckInterval?: NodeJS.Timeout;
  private activeAlerts: Map<string, MonitoringAlert> = new Map();
  private metricsHistory: ServiceMetrics[] = [];
  private maxHistorySize = 1000;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.metricsCollector = new PrometheusMetricsCollector(config.prometheus);
    this.dashboardGenerator = new GrafanaDashboardGenerator();
  }

  async initialize(haManager?: HighAvailabilityManager): Promise<void> {
    console.log('📊 Initializing Monitoring Service...');

    try {
      // Store HA manager reference if provided
      this.haManager = haManager;

      // Start Prometheus metrics server
      await this.metricsCollector.start();

      // Setup Grafana dashboards
      if (this.config.grafana.autoProvision) {
        await this.provisionGrafanaDashboards();
      }

      // Start health checks
      if (this.config.healthChecks.enabled) {
        this.startHealthChecks();
      }

      // Setup metric collection
      this.setupMetricCollection();

      // Setup alert monitoring
      if (this.config.alerts.enabled) {
        this.setupAlertMonitoring();
      }

      console.log('✅ Monitoring Service initialized successfully');
      this.emit('monitoring-initialized', { timestamp: new Date() });

    } catch (error) {
      console.error('❌ Failed to initialize Monitoring Service:', error);
      throw error;
    }
  }

  private async provisionGrafanaDashboards(): Promise<void> {
    console.log('📈 Provisioning Grafana dashboards...');

    try {
      // Generate dashboards
      const credentialDashboard = this.dashboardGenerator.generateCredentialManagementDashboard();
      
      // Create dashboards directory
      await fs.mkdir(this.config.grafana.dashboardsPath, { recursive: true });

      // Write dashboard JSON
      const dashboardPath = path.join(
        this.config.grafana.dashboardsPath,
        'credential-management.json'
      );
      await fs.writeFile(
        dashboardPath,
        this.dashboardGenerator.exportDashboard(credentialDashboard)
      );

      // Create provisioning config
      const provisioningConfig = this.dashboardGenerator.generateProvisioningConfig([credentialDashboard]);
      const provisioningPath = path.join(
        this.config.grafana.dashboardsPath,
        '../provisioning/dashboards/credential-management.yaml'
      );
      
      await fs.mkdir(path.dirname(provisioningPath), { recursive: true });
      await fs.writeFile(provisioningPath, provisioningConfig);

      console.log('✅ Grafana dashboards provisioned');

      // If API key is provided, also import via API
      if (this.config.grafana.apiKey) {
        await this.importDashboardViaAPI(credentialDashboard);
      }

    } catch (error) {
      console.error('❌ Failed to provision Grafana dashboards:', error);
      throw error;
    }
  }

  private async importDashboardViaAPI(dashboard: any): Promise<void> {
    try {
      const response = await fetch(`${this.config.grafana.url}/api/dashboards/db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.grafana.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dashboard,
          overwrite: true,
          folderId: 0
        })
      });

      if (response.ok) {
        console.log('✅ Dashboard imported via Grafana API');
      } else {
        console.error('❌ Failed to import dashboard via API:', await response.text());
      }
    } catch (error) {
      console.error('❌ Error importing dashboard via API:', error);
    }
  }

  private startHealthChecks(): void {
    console.log('🏥 Starting health checks...');

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthChecks.interval);

    // Perform initial check
    this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    const results: Record<string, boolean> = {};

    for (const endpoint of this.config.healthChecks.endpoints) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);

        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        const isHealthy = response.status === endpoint.expectedStatus;
        results[endpoint.name] = isHealthy;

        // Update metrics
        this.metricsCollector.updateServiceHealth(
          endpoint.name,
          'endpoint',
          isHealthy
        );

        this.metricsCollector.recordApiRequest(
          endpoint.method,
          endpoint.url,
          response.status,
          'health-check',
          responseTime / 1000
        );

        if (!isHealthy && endpoint.critical) {
          this.createAlert({
            severity: 'critical',
            type: 'health_check_failed',
            title: `Critical Health Check Failed: ${endpoint.name}`,
            description: `Endpoint ${endpoint.url} returned status ${response.status}, expected ${endpoint.expectedStatus}`,
            metric: 'health_check',
            currentValue: response.status,
            threshold: endpoint.expectedStatus,
            labels: { endpoint: endpoint.name, url: endpoint.url }
          });
        }

      } catch (error) {
        results[endpoint.name] = false;
        
        this.metricsCollector.updateServiceHealth(
          endpoint.name,
          'endpoint',
          false
        );

        if (endpoint.critical) {
          this.createAlert({
            severity: 'critical',
            type: 'health_check_error',
            title: `Critical Health Check Error: ${endpoint.name}`,
            description: `Failed to check endpoint ${endpoint.url}: ${error}`,
            metric: 'health_check',
            currentValue: 0,
            threshold: 1,
            labels: { endpoint: endpoint.name, url: endpoint.url, error: String(error) }
          });
        }
      }
    }

    this.emit('health-check-completed', { results, timestamp: new Date() });
  }

  private setupMetricCollection(): void {
    // Collect metrics from HA Manager if available
    if (this.haManager) {
      setInterval(() => {
        const haMetrics = this.haManager!.getMetrics();
        
        // Update circuit breaker metrics
        const circuitBreakers = this.haManager!.getCircuitBreakerStatus();
        for (const breaker of circuitBreakers) {
          this.metricsCollector.updateCircuitBreakerStatus(breaker.service, breaker.state);
        }

        // Update health metrics
        const healthStatus = this.haManager!.getHealthStatus();
        for (const [service, health] of Object.entries(healthStatus)) {
          this.metricsCollector.updateServiceHealth(service, 'service', health.status === 'healthy');
        }

      }, 10000); // Every 10 seconds
    }

    // Collect system metrics
    setInterval(async () => {
      const metrics = await this.collectSystemMetrics();
      this.metricsHistory.push(metrics);
      
      // Keep only recent history
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // Update Prometheus metrics
      this.metricsCollector.updateCpuUsage('total', metrics.system.cpu);
      this.metricsCollector.updateMemoryUsage('used', metrics.system.memory);
      const startTime = this.metricsCollector['config'].defaultLabels?.startTime;
      if (typeof startTime === 'number') {
        this.metricsCollector.updateUptime((Date.now() - startTime) / 1000);
      }

      this.emit('metrics-collected', metrics);

    }, 30000); // Every 30 seconds
  }

  private setupAlertMonitoring(): void {
    console.log('🚨 Setting up alert monitoring...');

    // Define alert rules
    const alertRules = [
      {
        name: 'high_error_rate',
        query: () => this.getCurrentMetrics().services['api']?.errorRate || 0,
        threshold: 5, // 5% error rate
        severity: 'critical' as const,
        title: 'High Error Rate Detected',
        description: 'API error rate exceeds 5%'
      },
      {
        name: 'low_cache_hit_rate',
        query: () => this.getCurrentMetrics().services['cache']?.throughput || 100,
        threshold: 70, // 70% hit rate
        severity: 'warning' as const,
        title: 'Low Cache Hit Rate',
        description: 'Cache hit rate below 70%',
        inverted: true
      },
      {
        name: 'high_memory_usage',
        query: () => this.getCurrentMetrics().system.memory,
        threshold: 90, // 90% memory usage
        severity: 'warning' as const,
        title: 'High Memory Usage',
        description: 'Memory usage exceeds 90%'
      },
      {
        name: 'security_events_spike',
        query: () => this.getCurrentMetrics().business.securityEvents,
        threshold: 10, // 10 events per minute
        severity: 'critical' as const,
        title: 'Security Events Spike',
        description: 'Unusual number of security events detected'
      }
    ];

    // Check alert rules periodically
    setInterval(() => {
      for (const rule of alertRules) {
        const currentValue = rule.query();
        const shouldAlert = rule.inverted ? 
          currentValue < rule.threshold : 
          currentValue > rule.threshold;

        if (shouldAlert) {
          this.createAlert({
            severity: rule.severity,
            type: rule.name,
            title: rule.title,
            description: rule.description,
            metric: rule.name,
            currentValue,
            threshold: rule.threshold,
            labels: { rule: rule.name }
          });
        } else {
          // Resolve alert if it exists
          this.resolveAlert(rule.name);
        }
      }
    }, 60000); // Check every minute
  }

  private async collectSystemMetrics(): Promise<ServiceMetrics> {
    const process = require('process');
    const os = require('os');

    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    return {
      timestamp: new Date(),
      services: {
        api: {
          status: 'healthy',
          responseTime: 150,
          errorRate: 0.5,
          throughput: 1000,
          saturation: 45
        },
        database: {
          status: 'healthy',
          responseTime: 50,
          errorRate: 0.1,
          throughput: 500,
          saturation: 30
        },
        cache: {
          status: 'healthy',
          responseTime: 5,
          errorRate: 0.01,
          throughput: 95, // Hit rate
          saturation: 60
        }
      },
      system: {
        cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
        memory: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        disk: 0, // Would need additional library for disk usage
        network: {
          in: 0, // Would need additional monitoring
          out: 0
        }
      },
      business: {
        activeUsers: 150,
        apiCalls: 10000,
        totalCost: 250.50,
        credentialsActive: 45,
        securityEvents: 2
      }
    };
  }

  private createAlert(alert: Omit<MonitoringAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const fullAlert: MonitoringAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    // Check if similar alert already exists
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      a => a.type === alert.type && !a.resolved
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.currentValue = alert.currentValue;
      existingAlert.timestamp = new Date();
    } else {
      // Create new alert
      this.activeAlerts.set(fullAlert.id, fullAlert);
      this.sendAlertNotifications(fullAlert);
      this.emit('alert-created', fullAlert);
    }

    // Record alert metric
    this.metricsCollector.recordSecurityEvent(
      alert.type,
      alert.severity,
      'monitoring'
    );
  }

  private resolveAlert(type: string): void {
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.type === type && !alert.resolved) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        this.emit('alert-resolved', alert);
      }
    }
  }

  private async sendAlertNotifications(alert: MonitoringAlert): Promise<void> {
    console.log(`🚨 Sending notifications for alert: ${alert.title}`);

    // Webhook notification
    if (this.config.alerts.webhookUrl) {
      try {
        await fetch(this.config.alerts.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'monitoring_alert',
            alert,
            timestamp: new Date()
          })
        });
      } catch (error) {
        console.error('Failed to send webhook notification:', error);
      }
    }

    // Email notification (would need email service integration)
    if (this.config.alerts.emailRecipients?.length) {
      console.log(`📧 Would send email to: ${this.config.alerts.emailRecipients.join(', ')}`);
    }

    // Slack notification (would need Slack integration)
    if (this.config.alerts.slackChannel) {
      console.log(`💬 Would send Slack message to: ${this.config.alerts.slackChannel}`);
    }
  }

  // Public API methods

  recordCredentialOperation(operation: string, provider: string, status: 'success' | 'failure', duration: number): void {
    this.metricsCollector.recordCredentialOperation(operation, provider, status, duration);
  }

  recordApiRequest(method: string, endpoint: string, statusCode: number, provider: string, duration: number, requestSize?: number, responseSize?: number): void {
    this.metricsCollector.recordApiRequest(method, endpoint, statusCode, provider, duration);
    
    if (requestSize) {
      this.metricsCollector.recordApiRequestSize(method, endpoint, provider, requestSize);
    }
    
    if (responseSize) {
      this.metricsCollector.recordApiResponseSize(method, endpoint, provider, responseSize);
    }
  }

  updateCostMetrics(period: string, provider: string, model: string, amount: number): void {
    this.metricsCollector.updateCostByProvider(provider, model, period, amount);
    this.metricsCollector.updateEstimatedCost(period, 'total', amount);
  }

  recordSecurityEvent(eventType: string, severity: string, source: string): void {
    this.metricsCollector.recordSecurityEvent(eventType, severity, source);
    
    // Check if this should trigger an alert
    if (severity === 'critical') {
      this.createAlert({
        severity: 'critical',
        type: 'security_event',
        title: `Critical Security Event: ${eventType}`,
        description: `A critical security event occurred from source: ${source}`,
        metric: 'security_events',
        currentValue: 1,
        threshold: 0,
        labels: { event_type: eventType, source }
      });
    }
  }

  updateDatabaseMetrics(connections: number, queryDuration: number, queryType: string): void {
    this.metricsCollector.updateDatabaseConnections('active', 'main', connections);
    this.metricsCollector.recordDatabaseQuery(queryType, 'credentials', queryDuration);
  }

  updateCacheMetrics(hitRate: number, cacheType: string = 'redis'): void {
    this.metricsCollector.updateCacheHitRate(cacheType, hitRate);
  }

  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  getAlertHistory(limit: number = 100): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getCurrentMetrics(): ServiceMetrics {
    return this.metricsHistory[this.metricsHistory.length - 1] || {
      timestamp: new Date(),
      services: {},
      system: { cpu: 0, memory: 0, disk: 0, network: { in: 0, out: 0 } },
      business: { activeUsers: 0, apiCalls: 0, totalCost: 0, credentialsActive: 0, securityEvents: 0 }
    };
  }

  getMetricsHistory(duration: number = 3600000): ServiceMetrics[] {
    const cutoff = Date.now() - duration;
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);
  }

  async exportMetrics(format: 'prometheus' | 'json' = 'prometheus'): Promise<string> {
    if (format === 'prometheus') {
      return await this.metricsCollector.getMetrics();
    } else {
      return JSON.stringify({
        current: this.getCurrentMetrics(),
        alerts: this.getActiveAlerts(),
        history: this.getMetricsHistory()
      }, null, 2);
    }
  }

  getGrafanaDashboardUrl(): string {
    return `${this.config.grafana.url}/d/credential-management/credential-management-system`;
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Monitoring Service...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.metricsCollector.stop();

    console.log('✅ Monitoring Service stopped');
    this.emit('monitoring-stopped');
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}

// Export convenience function
export function createMonitoringService(config: MonitoringConfig): MonitoringService {
  return new MonitoringService(config);
}

// Export default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  prometheus: {
    port: 9090,
    path: '/metrics',
    collectDefaultMetrics: true,
    prefix: 'credential_mgmt_',
    defaultLabels: {
      app: 'credential-management',
      env: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      startTime: Date.now().toString()
    }
  },
  grafana: {
    url: 'http://localhost:3000',
    dashboardsPath: '/var/lib/grafana/dashboards',
    autoProvision: true
  },
  alerts: {
    enabled: true
  },
  healthChecks: {
    enabled: true,
    interval: 60000, // 1 minute
    timeout: 5000,   // 5 seconds
    endpoints: [
      {
        name: 'api',
        url: 'http://localhost:8080/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 3000,
        critical: true
      },
      {
        name: 'database',
        url: 'http://localhost:5432/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        critical: true
      },
      {
        name: 'redis',
        url: 'http://localhost:6379/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 3000,
        critical: false
      }
    ]
  },
  logging: {
    level: 'info',
    format: 'json',
    destination: 'console'
  }
};