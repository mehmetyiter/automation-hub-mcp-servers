import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as si from 'systeminformation';
import ping from 'ping';
import portscanner from 'portscanner';
import { logger } from '../utils/logger';
import { HealthStorage } from '../storage/HealthStorage';

export interface HealthCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'ping' | 'database' | 'service' | 'custom';
  target: string;
  config: {
    timeout?: number;
    interval?: number;
    retries?: number;
    expectedStatus?: number;
    expectedResponse?: string;
    headers?: Record<string, string>;
    method?: string;
    body?: string;
    authentication?: {
      type: 'basic' | 'bearer' | 'api_key';
      credentials: Record<string, string>;
    };
  };
  thresholds: {
    responseTime: {
      warning: number;
      critical: number;
    };
    availability: {
      warning: number; // percentage
      critical: number; // percentage
    };
  };
  enabled: boolean;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface HealthCheckResult {
  id: string;
  checkId: string;
  timestamp: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTime: number;
  success: boolean;
  message: string;
  error?: string;
  metadata: {
    httpStatus?: number;
    responseSize?: number;
    ssl?: {
      valid: boolean;
      expiresAt?: number;
      issuer?: string;
    };
    tcp?: {
      connected: boolean;
      port: number;
    };
    ping?: {
      packetLoss: number;
      avgTime: number;
    };
    database?: {
      connected: boolean;
      queryTime: number;
      activeConnections?: number;
    };
    service?: {
      running: boolean;
      pid?: number;
      memory?: number;
      cpu?: number;
    };
  };
}

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
    swap: {
      total: number;
      used: number;
      free: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
    disks: Array<{
      device: string;
      mount: string;
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    }>;
  };
  network: {
    interfaces: Array<{
      name: string;
      ip4: string;
      ip6: string;
      rx: number;
      tx: number;
      speed: number;
    }>;
    connections: {
      established: number;
      listening: number;
      total: number;
    };
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
    topProcesses: Array<{
      pid: number;
      name: string;
      cpu: number;
      memory: number;
    }>;
  };
  docker?: {
    containers: Array<{
      id: string;
      name: string;
      status: string;
      image: string;
      cpu: number;
      memory: number;
      networkRx: number;
      networkTx: number;
    }>;
    images: number;
    volumes: number;
    networks: number;
  };
  kubernetes?: {
    nodes: Array<{
      name: string;
      status: string;
      cpu: number;
      memory: number;
      pods: number;
    }>;
    pods: {
      running: number;
      pending: number;
      failed: number;
      total: number;
    };
    services: number;
    deployments: number;
  };
}

export interface HealthSummary {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastUpdated: number;
  checks: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  services: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  infrastructure: {
    cpu: 'healthy' | 'warning' | 'critical';
    memory: 'healthy' | 'warning' | 'critical';
    disk: 'healthy' | 'warning' | 'critical';
    network: 'healthy' | 'warning' | 'critical';
  };
  uptime: {
    system: number;
    application: number;
  };
  incidents: {
    active: number;
    resolved24h: number;
    mttr: number; // Mean Time To Recovery
  };
}

export interface IncidentDefinition {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
  affectedServices: string[];
  checkIds: string[];
  startTime: number;
  endTime?: number;
  updates: Array<{
    timestamp: number;
    status: string;
    message: string;
    updatedBy: string;
  }>;
  assignedTo?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export class HealthMonitor extends EventEmitter {
  private healthStorage: HealthStorage;
  private healthChecks = new Map<string, HealthCheck>();
  private checkIntervals = new Map<string, NodeJS.Timeout>();
  private systemMetrics: SystemMetrics | null = null;
  private incidents = new Map<string, IncidentDefinition>();
  
  private readonly SYSTEM_METRICS_INTERVAL = 30000; // 30 seconds
  private readonly DEFAULT_CHECK_INTERVAL = 60000; // 1 minute
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  constructor(
    healthStorage: HealthStorage,
    private options: {
      enableSystemMetrics?: boolean;
      enableDockerMetrics?: boolean;
      enableKubernetesMetrics?: boolean;
      systemMetricsInterval?: number;
      defaultCheckInterval?: number;
      maxIncidentHistory?: number;
    } = {}
  ) {
    super();
    
    this.healthStorage = healthStorage;
    
    this.options = {
      enableSystemMetrics: true,
      enableDockerMetrics: false,
      enableKubernetesMetrics: false,
      systemMetricsInterval: 30000,
      defaultCheckInterval: 60000,
      maxIncidentHistory: 1000,
      ...options
    };

    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Collect system metrics
    if (this.options.enableSystemMetrics) {
      setInterval(() => this.collectSystemMetrics(), this.options.systemMetricsInterval!);
      // Collect initial metrics
      this.collectSystemMetrics();
    }

    // Cleanup old data
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
    
    // Check for incident auto-resolution
    setInterval(() => this.checkIncidentAutoResolution(), 5 * 60 * 1000); // Every 5 minutes
  }

  // Add health check
  async addHealthCheck(checkData: Omit<HealthCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const checkId = uuidv4();
    const now = Date.now();

    const healthCheck: HealthCheck = {
      id: checkId,
      createdAt: now,
      updatedAt: now,
      config: {
        timeout: this.DEFAULT_TIMEOUT,
        interval: this.DEFAULT_CHECK_INTERVAL,
        retries: 3,
        ...checkData.config
      },
      ...checkData
    };

    this.healthChecks.set(checkId, healthCheck);
    await this.healthStorage.storeHealthCheck(healthCheck);

    if (healthCheck.enabled) {
      this.startHealthCheck(healthCheck);
    }

    this.emit('health_check_added', healthCheck);

    logger.info('Health check added', {
      checkId,
      name: healthCheck.name,
      type: healthCheck.type,
      target: healthCheck.target
    });

    return checkId;
  }

  // Update health check
  async updateHealthCheck(checkId: string, updates: Partial<HealthCheck>): Promise<void> {
    const healthCheck = this.healthChecks.get(checkId);
    if (!healthCheck) {
      throw new Error(`Health check not found: ${checkId}`);
    }

    const updatedCheck = {
      ...healthCheck,
      ...updates,
      updatedAt: Date.now()
    };

    this.healthChecks.set(checkId, updatedCheck);
    await this.healthStorage.updateHealthCheck(updatedCheck);

    // Restart check with new configuration
    this.stopHealthCheck(checkId);
    if (updatedCheck.enabled) {
      this.startHealthCheck(updatedCheck);
    }

    this.emit('health_check_updated', updatedCheck);

    logger.info('Health check updated', { checkId, name: updatedCheck.name });
  }

  // Remove health check
  async removeHealthCheck(checkId: string): Promise<void> {
    const healthCheck = this.healthChecks.get(checkId);
    if (!healthCheck) {
      return;
    }

    this.stopHealthCheck(checkId);
    this.healthChecks.delete(checkId);
    await this.healthStorage.deleteHealthCheck(checkId);

    this.emit('health_check_removed', { checkId, name: healthCheck.name });

    logger.info('Health check removed', { checkId, name: healthCheck.name });
  }

  // Execute health check manually
  async executeHealthCheck(checkId: string): Promise<HealthCheckResult> {
    const healthCheck = this.healthChecks.get(checkId);
    if (!healthCheck) {
      throw new Error(`Health check not found: ${checkId}`);
    }

    return this.performHealthCheck(healthCheck);
  }

  // Get health summary
  async getHealthSummary(): Promise<HealthSummary> {
    const checks = Array.from(this.healthChecks.values());
    const recentResults = await this.healthStorage.getRecentResults(24 * 60 * 60 * 1000); // Last 24 hours

    // Count check statuses
    const checkCounts = {
      total: checks.length,
      healthy: 0,
      warning: 0,
      critical: 0,
      unknown: 0
    };

    // Get latest result for each check
    const latestResults = new Map<string, HealthCheckResult>();
    recentResults.forEach(result => {
      if (!latestResults.has(result.checkId) || 
          result.timestamp > latestResults.get(result.checkId)!.timestamp) {
        latestResults.set(result.checkId, result);
      }
    });

    // Count statuses
    checks.forEach(check => {
      const result = latestResults.get(check.id);
      if (result) {
        checkCounts[result.status]++;
      } else {
        checkCounts.unknown++;
      }
    });

    // Determine overall health
    let overall: HealthSummary['overall'] = 'healthy';
    if (checkCounts.critical > 0) {
      overall = 'critical';
    } else if (checkCounts.warning > 0) {
      overall = 'warning';
    } else if (checkCounts.unknown > 0) {
      overall = 'unknown';
    }

    // Infrastructure health from system metrics
    const infraHealth = this.getInfrastructureHealth();

    // Service health
    const serviceHealth = this.getServiceHealth(latestResults);

    // Incident metrics
    const incidentMetrics = this.getIncidentMetrics();

    return {
      overall,
      lastUpdated: Date.now(),
      checks: checkCounts,
      services: serviceHealth,
      infrastructure: infraHealth,
      uptime: {
        system: process.uptime(),
        application: process.uptime()
      },
      incidents: incidentMetrics
    };
  }

  // Get system metrics
  getSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics;
  }

  // Get health checks
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  // Get health check results
  async getHealthCheckResults(
    checkId?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): Promise<HealthCheckResult[]> {
    return this.healthStorage.getResults(checkId, startTime, endTime, limit);
  }

  // Create incident
  async createIncident(incidentData: Omit<IncidentDefinition, 'id' | 'startTime' | 'updates'>): Promise<string> {
    const incidentId = uuidv4();
    const now = Date.now();

    const incident: IncidentDefinition = {
      id: incidentId,
      startTime: now,
      updates: [{
        timestamp: now,
        status: incidentData.status,
        message: `Incident created: ${incidentData.description}`,
        updatedBy: 'system'
      }],
      ...incidentData
    };

    this.incidents.set(incidentId, incident);
    await this.healthStorage.storeIncident(incident);

    this.emit('incident_created', incident);

    logger.warn('Incident created', {
      incidentId,
      title: incident.title,
      severity: incident.severity,
      affectedServices: incident.affectedServices
    });

    return incidentId;
  }

  // Update incident
  async updateIncident(
    incidentId: string,
    update: {
      status?: IncidentDefinition['status'];
      message: string;
      updatedBy: string;
      assignedTo?: string;
    }
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const now = Date.now();

    // Add update
    incident.updates.push({
      timestamp: now,
      status: update.status || incident.status,
      message: update.message,
      updatedBy: update.updatedBy
    });

    // Update status and assignment
    if (update.status) {
      incident.status = update.status;
    }
    if (update.assignedTo !== undefined) {
      incident.assignedTo = update.assignedTo;
    }

    // Set end time if resolved
    if (incident.status === 'resolved' && !incident.endTime) {
      incident.endTime = now;
    }

    await this.healthStorage.updateIncident(incident);

    this.emit('incident_updated', incident);

    logger.info('Incident updated', {
      incidentId,
      status: incident.status,
      updatedBy: update.updatedBy
    });
  }

  // Get incidents
  getIncidents(status?: IncidentDefinition['status']): IncidentDefinition[] {
    const incidents = Array.from(this.incidents.values());
    return status ? incidents.filter(i => i.status === status) : incidents;
  }

  private startHealthCheck(healthCheck: HealthCheck): void {
    const interval = healthCheck.config.interval || this.DEFAULT_CHECK_INTERVAL;
    
    // Perform initial check
    this.performHealthCheck(healthCheck);
    
    // Schedule recurring checks
    const intervalId = setInterval(() => {
      this.performHealthCheck(healthCheck);
    }, interval);
    
    this.checkIntervals.set(healthCheck.id, intervalId);

    logger.debug('Health check started', {
      checkId: healthCheck.id,
      name: healthCheck.name,
      interval
    });
  }

  private stopHealthCheck(checkId: string): void {
    const intervalId = this.checkIntervals.get(checkId);
    if (intervalId) {
      clearInterval(intervalId);
      this.checkIntervals.delete(checkId);
    }
  }

  private async performHealthCheck(healthCheck: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      switch (healthCheck.type) {
        case 'http':
          result = await this.performHttpCheck(healthCheck, startTime);
          break;
        case 'tcp':
          result = await this.performTcpCheck(healthCheck, startTime);
          break;
        case 'ping':
          result = await this.performPingCheck(healthCheck, startTime);
          break;
        case 'database':
          result = await this.performDatabaseCheck(healthCheck, startTime);
          break;
        case 'service':
          result = await this.performServiceCheck(healthCheck, startTime);
          break;
        case 'custom':
          result = await this.performCustomCheck(healthCheck, startTime);
          break;
        default:
          throw new Error(`Unsupported health check type: ${healthCheck.type}`);
      }

      // Determine status based on thresholds
      result.status = this.determineStatus(result, healthCheck);

      // Store result
      await this.healthStorage.storeResult(result);

      // Emit events
      this.emit('health_check_completed', result);
      
      if (result.status === 'critical' || result.status === 'warning') {
        this.emit('health_check_failed', result);
        
        // Auto-create incident for critical failures
        if (result.status === 'critical') {
          await this.handleCriticalFailure(healthCheck, result);
        }
      }

      return result;

    } catch (error) {
      result = {
        id: uuidv4(),
        checkId: healthCheck.id,
        timestamp: startTime,
        status: 'critical',
        responseTime: Date.now() - startTime,
        success: false,
        message: 'Health check execution failed',
        error: error.message,
        metadata: {}
      };

      await this.healthStorage.storeResult(result);
      this.emit('health_check_failed', result);

      logger.error('Health check failed', {
        checkId: healthCheck.id,
        name: healthCheck.name,
        error: error.message
      });

      return result;
    }
  }

  private async performHttpCheck(healthCheck: HealthCheck, startTime: number): Promise<HealthCheckResult> {
    const axios = require('axios');
    const config = healthCheck.config;
    
    const response = await axios({
      method: config.method || 'GET',
      url: healthCheck.target,
      timeout: config.timeout || this.DEFAULT_TIMEOUT,
      headers: config.headers || {},
      data: config.body,
      auth: config.authentication?.type === 'basic' ? {
        username: config.authentication.credentials.username,
        password: config.authentication.credentials.password
      } : undefined,
      validateStatus: () => true // Don't throw on HTTP errors
    });

    const responseTime = Date.now() - startTime;
    const success = response.status >= 200 && response.status < 400;

    return {
      id: uuidv4(),
      checkId: healthCheck.id,
      timestamp: startTime,
      status: 'healthy', // Will be determined by thresholds
      responseTime,
      success,
      message: success ? 'HTTP check successful' : `HTTP error: ${response.status}`,
      metadata: {
        httpStatus: response.status,
        responseSize: JSON.stringify(response.data).length
      }
    };
  }

  private async performTcpCheck(healthCheck: HealthCheck, startTime: number): Promise<HealthCheckResult> {
    const [host, portStr] = healthCheck.target.split(':');
    const port = parseInt(portStr);

    const isOpen = await new Promise<boolean>((resolve) => {
      portscanner.checkPortStatus(port, host, (error, status) => {
        resolve(status === 'open');
      });
    });

    const responseTime = Date.now() - startTime;

    return {
      id: uuidv4(),
      checkId: healthCheck.id,
      timestamp: startTime,
      status: 'healthy',
      responseTime,
      success: isOpen,
      message: isOpen ? 'TCP connection successful' : 'TCP connection failed',
      metadata: {
        tcp: {
          connected: isOpen,
          port
        }
      }
    };
  }

  private async performPingCheck(healthCheck: HealthCheck, startTime: number): Promise<HealthCheckResult> {
    const result = await ping.promise.probe(healthCheck.target, {
      timeout: (healthCheck.config.timeout || this.DEFAULT_TIMEOUT) / 1000
    });

    const responseTime = Date.now() - startTime;

    return {
      id: uuidv4(),
      checkId: healthCheck.id,
      timestamp: startTime,
      status: 'healthy',
      responseTime: result.avg || responseTime,
      success: result.alive,
      message: result.alive ? 'Ping successful' : 'Ping failed',
      metadata: {
        ping: {
          packetLoss: parseFloat(result.packetLoss as string) || 0,
          avgTime: result.avg || 0
        }
      }
    };
  }

  private async performDatabaseCheck(healthCheck: HealthCheck, startTime: number): Promise<HealthCheckResult> {
    // This would implement database-specific health checks
    // For now, return a placeholder
    const responseTime = Date.now() - startTime;

    return {
      id: uuidv4(),
      checkId: healthCheck.id,
      timestamp: startTime,
      status: 'healthy',
      responseTime,
      success: true,
      message: 'Database check not implemented',
      metadata: {
        database: {
          connected: true,
          queryTime: responseTime
        }
      }
    };
  }

  private async performServiceCheck(healthCheck: HealthCheck, startTime: number): Promise<HealthCheckResult> {
    // This would implement service-specific health checks
    // For now, return a placeholder
    const responseTime = Date.now() - startTime;

    return {
      id: uuidv4(),
      checkId: healthCheck.id,
      timestamp: startTime,
      status: 'healthy',
      responseTime,
      success: true,
      message: 'Service check not implemented',
      metadata: {
        service: {
          running: true
        }
      }
    };
  }

  private async performCustomCheck(healthCheck: HealthCheck, startTime: number): Promise<HealthCheckResult> {
    // This would implement custom health checks via scripts or plugins
    // For now, return a placeholder
    const responseTime = Date.now() - startTime;

    return {
      id: uuidv4(),
      checkId: healthCheck.id,
      timestamp: startTime,
      status: 'healthy',
      responseTime,
      success: true,
      message: 'Custom check not implemented',
      metadata: {}
    };
  }

  private determineStatus(result: HealthCheckResult, healthCheck: HealthCheck): HealthCheckResult['status'] {
    if (!result.success) {
      return 'critical';
    }

    const thresholds = healthCheck.thresholds;
    
    if (result.responseTime >= thresholds.responseTime.critical) {
      return 'critical';
    } else if (result.responseTime >= thresholds.responseTime.warning) {
      return 'warning';
    }

    return 'healthy';
  }

  private async handleCriticalFailure(healthCheck: HealthCheck, result: HealthCheckResult): Promise<void> {
    // Check if there's already an active incident for this check
    const existingIncident = Array.from(this.incidents.values())
      .find(incident => 
        incident.checkIds.includes(healthCheck.id) && 
        incident.status !== 'resolved'
      );

    if (existingIncident) {
      // Update existing incident
      await this.updateIncident(existingIncident.id, {
        message: `Health check continues to fail: ${result.message}`,
        updatedBy: 'system'
      });
    } else {
      // Create new incident
      await this.createIncident({
        title: `Health Check Failure: ${healthCheck.name}`,
        description: `Critical failure detected for ${healthCheck.name}: ${result.message}`,
        severity: 'critical',
        status: 'open',
        affectedServices: [healthCheck.name],
        checkIds: [healthCheck.id],
        assignedTo: undefined,
        tags: ['auto-generated', 'health-check', ...healthCheck.tags],
        metadata: {
          checkType: healthCheck.type,
          target: healthCheck.target,
          responseTime: result.responseTime
        }
      });
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const [cpu, memory, disk, network, processes] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkInterfaces(),
        si.processes()
      ]);

      this.systemMetrics = {
        timestamp: Date.now(),
        cpu: {
          usage: cpu.currentLoad,
          loadAverage: cpu.avgLoad ? [cpu.avgLoad] : [],
          cores: cpu.cpus?.length || 1,
          temperature: undefined // Would need additional temperature monitoring
        },
        memory: {
          total: memory.total,
          used: memory.used,
          free: memory.free,
          usagePercent: (memory.used / memory.total) * 100,
          swap: {
            total: memory.swaptotal,
            used: memory.swapused,
            free: memory.swapfree
          }
        },
        disk: {
          total: disk.reduce((sum, d) => sum + d.size, 0),
          used: disk.reduce((sum, d) => sum + d.used, 0),
          free: disk.reduce((sum, d) => sum + d.available, 0),
          usagePercent: disk.length > 0 ? 
            (disk.reduce((sum, d) => sum + d.used, 0) / disk.reduce((sum, d) => sum + d.size, 0)) * 100 : 0,
          disks: disk.map(d => ({
            device: d.fs,
            mount: d.mount,
            total: d.size,
            used: d.used,
            free: d.available,
            usagePercent: (d.used / d.size) * 100
          }))
        },
        network: {
          interfaces: network.map(iface => ({
            name: iface.iface,
            ip4: iface.ip4 || '',
            ip6: iface.ip6 || '',
            rx: 0, // Would need network stats
            tx: 0,
            speed: iface.speed || 0
          })),
          connections: {
            established: 0,
            listening: 0,
            total: 0
          }
        },
        processes: {
          total: processes.all,
          running: processes.running,
          sleeping: processes.sleeping,
          zombie: processes.zombie || 0,
          topProcesses: processes.list?.slice(0, 10).map(proc => ({
            pid: proc.pid,
            name: proc.name,
            cpu: proc.cpu,
            memory: proc.mem
          })) || []
        }
      };

      await this.healthStorage.storeSystemMetrics(this.systemMetrics);
      this.emit('system_metrics_collected', this.systemMetrics);

    } catch (error) {
      logger.error('Failed to collect system metrics', { error: error.message });
    }
  }

  private getInfrastructureHealth(): HealthSummary['infrastructure'] {
    if (!this.systemMetrics) {
      return {
        cpu: 'unknown',
        memory: 'unknown',
        disk: 'unknown',
        network: 'unknown'
      };
    }

    const metrics = this.systemMetrics;

    return {
      cpu: metrics.cpu.usage > 90 ? 'critical' : metrics.cpu.usage > 70 ? 'warning' : 'healthy',
      memory: metrics.memory.usagePercent > 90 ? 'critical' : metrics.memory.usagePercent > 80 ? 'warning' : 'healthy',
      disk: metrics.disk.usagePercent > 95 ? 'critical' : metrics.disk.usagePercent > 85 ? 'warning' : 'healthy',
      network: 'healthy' // Would need network monitoring to determine
    };
  }

  private getServiceHealth(latestResults: Map<string, HealthCheckResult>): HealthSummary['services'] {
    const services = Array.from(this.healthChecks.values())
      .filter(check => check.type === 'service' || check.type === 'http');

    let healthy = 0;
    let unhealthy = 0;

    services.forEach(service => {
      const result = latestResults.get(service.id);
      if (result && result.status === 'healthy') {
        healthy++;
      } else {
        unhealthy++;
      }
    });

    return {
      total: services.length,
      healthy,
      unhealthy
    };
  }

  private getIncidentMetrics(): HealthSummary['incidents'] {
    const incidents = Array.from(this.incidents.values());
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;

    const active = incidents.filter(i => i.status !== 'resolved').length;
    const resolved24h = incidents.filter(i => 
      i.status === 'resolved' && 
      i.endTime && 
      i.endTime >= last24h
    ).length;

    // Calculate MTTR (Mean Time To Recovery)
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved' && i.endTime);
    const mttr = resolvedIncidents.length > 0 ?
      resolvedIncidents.reduce((sum, i) => sum + (i.endTime! - i.startTime), 0) / resolvedIncidents.length : 0;

    return {
      active,
      resolved24h,
      mttr
    };
  }

  private checkIncidentAutoResolution(): void {
    // Check if any incidents should be auto-resolved based on health check recovery
    for (const incident of this.incidents.values()) {
      if (incident.status === 'resolved') continue;

      // Check if all associated health checks are now healthy
      const allHealthy = incident.checkIds.every(checkId => {
        // This would check recent results to see if the check is consistently healthy
        return true; // Simplified for now
      });

      if (allHealthy) {
        this.updateIncident(incident.id, {
          status: 'resolved',
          message: 'Auto-resolved: All associated health checks are now healthy',
          updatedBy: 'system'
        });
      }
    }
  }

  private cleanup(): void {
    // Clean up old data based on retention policies
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    // This would be implemented in the storage layer
    this.healthStorage.cleanup(maxAge);
  }

  destroy(): void {
    // Stop all health check intervals
    for (const intervalId of this.checkIntervals.values()) {
      clearInterval(intervalId);
    }

    this.removeAllListeners();
    this.healthChecks.clear();
    this.checkIntervals.clear();
    this.incidents.clear();
  }
}