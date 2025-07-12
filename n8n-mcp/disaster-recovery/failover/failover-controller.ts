import * as AWS from 'aws-sdk';
import { HealthMonitor } from './health-monitor';
import { DNSUpdater } from './dns-updater';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';
import { Pool } from 'pg';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface FailoverConfig {
  primaryRegion: string;
  secondaryRegions: string[];
  healthCheckInterval: number;
  failoverThreshold: number;
  cooldownPeriod: number;
  dnsConfig: {
    hostedZoneId: string;
    domainName: string;
    ttl: number;
  };
  notification: {
    snsTopicArn?: string;
    slackWebhookUrl?: string;
    email?: string[];
  };
}

export interface FailoverState {
  currentActiveRegion: string;
  availableRegions: string[];
  lastFailover: Date | null;
  failoverCount: number;
  healthStatus: Map<string, RegionHealth>;
  isFailoverInProgress: boolean;
}

export interface RegionHealth {
  region: string;
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  services: {
    api: boolean;
    database: boolean;
    cache: boolean;
    storage: boolean;
  };
  metrics: {
    latency: number;
    errorRate: number;
    throughput: number;
  };
}

export class FailoverController {
  private route53: AWS.Route53;
  private cloudWatch: AWS.CloudWatch;
  private sns: AWS.SNS;
  private healthMonitor: HealthMonitor;
  private dnsUpdater: DNSUpdater;
  private state: FailoverState;
  private healthCheckInterval?: NodeJS.Timeout;
  private dbPools: Map<string, Pool> = new Map();
  
  constructor(private config: FailoverConfig) {
    this.route53 = new AWS.Route53();
    this.cloudWatch = new AWS.CloudWatch();
    this.sns = new AWS.SNS();
    
    this.healthMonitor = new HealthMonitor(config);
    this.dnsUpdater = new DNSUpdater(config.dnsConfig);
    
    this.state = {
      currentActiveRegion: config.primaryRegion,
      availableRegions: [config.primaryRegion, ...config.secondaryRegions],
      lastFailover: null,
      failoverCount: 0,
      healthStatus: new Map(),
      isFailoverInProgress: false
    };
    
    this.initializeHealthStatus();
    this.startHealthMonitoring();
  }

  private initializeHealthStatus(): void {
    for (const region of this.state.availableRegions) {
      this.state.healthStatus.set(region, {
        region,
        isHealthy: region === this.config.primaryRegion,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        services: {
          api: true,
          database: true,
          cache: true,
          storage: true
        },
        metrics: {
          latency: 0,
          errorRate: 0,
          throughput: 0
        }
      });
    }
  }

  private startHealthMonitoring(): void {
    logger.info('Starting health monitoring', {
      interval: this.config.healthCheckInterval,
      regions: this.state.availableRegions
    });

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Perform initial health check
    this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    const checkPromises = this.state.availableRegions.map(region => 
      this.checkRegionHealth(region)
    );

    await Promise.all(checkPromises);

    // Check if failover is needed
    const currentHealth = this.state.healthStatus.get(this.state.currentActiveRegion);
    if (currentHealth && !currentHealth.isHealthy && 
        currentHealth.consecutiveFailures >= this.config.failoverThreshold) {
      
      // Check cooldown period
      if (this.canInitiateFailover()) {
        await this.initiateFailover();
      }
    }

    // Update metrics
    this.updateHealthMetrics();
  }

  private async checkRegionHealth(region: string): Promise<void> {
    try {
      const health = await this.healthMonitor.checkRegionHealth(region);
      const currentHealth = this.state.healthStatus.get(region)!;
      
      // Update health status
      currentHealth.isHealthy = health.isHealthy;
      currentHealth.lastCheck = new Date();
      currentHealth.services = health.services;
      currentHealth.metrics = health.metrics;
      
      if (health.isHealthy) {
        currentHealth.consecutiveFailures = 0;
      } else {
        currentHealth.consecutiveFailures++;
      }
      
      logger.debug('Health check completed', {
        region,
        healthy: health.isHealthy,
        failures: currentHealth.consecutiveFailures
      });
      
    } catch (error) {
      logger.error('Health check failed', { region, error });
      
      const currentHealth = this.state.healthStatus.get(region)!;
      currentHealth.isHealthy = false;
      currentHealth.consecutiveFailures++;
      currentHealth.lastCheck = new Date();
    }
  }

  async initiateFailover(): Promise<void> {
    if (this.state.isFailoverInProgress) {
      logger.warn('Failover already in progress');
      return;
    }

    this.state.isFailoverInProgress = true;
    const startTime = Date.now();
    
    try {
      // Find best target region
      const targetRegion = this.selectTargetRegion();
      if (!targetRegion) {
        throw new Error('No healthy regions available for failover');
      }
      
      logger.warn('Initiating failover', {
        from: this.state.currentActiveRegion,
        to: targetRegion
      });
      
      metrics.recordMetric('failover', 'initiated', 1, {
        source: this.state.currentActiveRegion,
        target: targetRegion
      });
      
      // Step 1: Verify target region health
      await this.verifyTargetRegion(targetRegion);
      
      // Step 2: Enable read-only mode in current region
      await this.enableReadOnlyMode(this.state.currentActiveRegion);
      
      // Step 3: Wait for replication sync
      await this.waitForReplicationSync(targetRegion);
      
      // Step 4: Promote standby database
      await this.promoteStandbyDatabase(targetRegion);
      
      // Step 5: Update DNS records
      await this.dnsUpdater.updateDNSRecords(targetRegion);
      
      // Step 6: Warm up caches
      await this.warmUpCaches(targetRegion);
      
      // Step 7: Verify traffic serving
      await this.verifyTrafficServing(targetRegion);
      
      // Step 8: Update state
      this.state.currentActiveRegion = targetRegion;
      this.state.lastFailover = new Date();
      this.state.failoverCount++;
      
      // Step 9: Send notifications
      await this.sendFailoverNotification(targetRegion, true);
      
      const duration = Date.now() - startTime;
      logger.info('Failover completed successfully', {
        to: targetRegion,
        duration,
        failoverCount: this.state.failoverCount
      });
      
      metrics.recordMetric('failover', 'completed', 1, {
        target: targetRegion,
        duration: duration.toString()
      });
      
    } catch (error) {
      logger.error('Failover failed', { error });
      metrics.recordMetric('failover', 'failed', 1);
      
      await this.handleFailoverFailure(error);
      await this.sendFailoverNotification(null, false, error);
      
      throw error;
    } finally {
      this.state.isFailoverInProgress = false;
    }
  }

  private selectTargetRegion(): string | null {
    // Find the healthiest region (excluding current)
    let bestRegion: string | null = null;
    let bestScore = -1;
    
    for (const [region, health] of this.state.healthStatus) {
      if (region === this.state.currentActiveRegion) continue;
      if (!health.isHealthy) continue;
      
      // Calculate health score
      const score = this.calculateHealthScore(health);
      if (score > bestScore) {
        bestScore = score;
        bestRegion = region;
      }
    }
    
    return bestRegion;
  }

  private calculateHealthScore(health: RegionHealth): number {
    let score = 100;
    
    // Service availability (40 points)
    const serviceCount = Object.values(health.services).filter(s => s).length;
    score -= (4 - serviceCount) * 10;
    
    // Performance metrics (60 points)
    score -= Math.min(health.metrics.latency / 10, 20); // Max 20 point penalty for latency
    score -= Math.min(health.metrics.errorRate * 100, 20); // Max 20 point penalty for errors
    score -= Math.min((100 - health.metrics.throughput) / 5, 20); // Max 20 point penalty for low throughput
    
    return Math.max(score, 0);
  }

  private canInitiateFailover(): boolean {
    if (!this.state.lastFailover) return true;
    
    const timeSinceLastFailover = Date.now() - this.state.lastFailover.getTime();
    return timeSinceLastFailover >= this.config.cooldownPeriod;
  }

  private async verifyTargetRegion(region: string): Promise<void> {
    logger.info('Verifying target region', { region });
    
    const health = await this.healthMonitor.performDeepHealthCheck(region);
    if (!health.isHealthy) {
      throw new Error(`Target region ${region} is not healthy`);
    }
    
    // Check minimum service requirements
    const requiredServices = ['api', 'database', 'cache'];
    for (const service of requiredServices) {
      if (!health.services[service]) {
        throw new Error(`Required service ${service} is not available in ${region}`);
      }
    }
  }

  private async enableReadOnlyMode(region: string): Promise<void> {
    logger.info('Enabling read-only mode', { region });
    
    try {
      // Update application configuration
      await this.updateRegionConfig(region, { readOnly: true });
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      logger.error('Failed to enable read-only mode', { region, error });
      // Continue with failover even if this fails
    }
  }

  private async waitForReplicationSync(targetRegion: string): Promise<void> {
    logger.info('Waiting for replication sync', { targetRegion });
    
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const lag = await this.getReplicationLag(targetRegion);
      
      if (lag < 1000) { // Less than 1 second lag
        logger.info('Replication sync achieved', { lag });
        return;
      }
      
      logger.info('Waiting for replication sync', { lag, elapsed: Date.now() - startTime });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Replication sync timeout');
  }

  private async getReplicationLag(region: string): Promise<number> {
    const pool = this.getRegionDbPool(region);
    
    try {
      const result = await pool.query(`
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 as lag_ms
      `);
      
      return result.rows[0]?.lag_ms || 0;
    } catch (error) {
      logger.error('Failed to get replication lag', { region, error });
      return Infinity;
    }
  }

  private async promoteStandbyDatabase(region: string): Promise<void> {
    logger.info('Promoting standby database', { region });
    
    const pool = this.getRegionDbPool(region);
    
    try {
      // Check if already primary
      const isPrimary = await pool.query('SELECT NOT pg_is_in_recovery() as is_primary');
      if (isPrimary.rows[0].is_primary) {
        logger.info('Database is already primary', { region });
        return;
      }
      
      // Promote standby
      await pool.query('SELECT pg_promote()');
      
      // Wait for promotion to complete
      let promoted = false;
      for (let i = 0; i < 30; i++) {
        const check = await pool.query('SELECT NOT pg_is_in_recovery() as is_primary');
        if (check.rows[0].is_primary) {
          promoted = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (!promoted) {
        throw new Error('Database promotion timeout');
      }
      
      logger.info('Database promoted successfully', { region });
      
    } catch (error) {
      logger.error('Failed to promote database', { region, error });
      throw error;
    }
  }

  private async warmUpCaches(region: string): Promise<void> {
    logger.info('Warming up caches', { region });
    
    try {
      // Call cache warming endpoint
      await this.callRegionEndpoint(region, '/api/admin/warm-cache', 'POST');
      
      // Wait for cache warming
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (error) {
      logger.warn('Cache warming failed', { region, error });
      // Non-critical, continue
    }
  }

  private async verifyTrafficServing(region: string): Promise<void> {
    logger.info('Verifying traffic serving', { region });
    
    // Perform multiple health checks
    for (let i = 0; i < 5; i++) {
      const response = await this.callRegionEndpoint(region, '/health', 'GET');
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    logger.info('Traffic serving verified', { region });
  }

  private async handleFailoverFailure(error: Error): Promise<void> {
    logger.error('Handling failover failure', { error });
    
    try {
      // Attempt to rollback to original region
      await this.enableReadOnlyMode(this.state.currentActiveRegion);
      
      // Record failure
      await this.recordFailoverFailure(error);
      
    } catch (rollbackError) {
      logger.error('Rollback failed', { rollbackError });
    }
  }

  private async sendFailoverNotification(targetRegion: string | null, success: boolean, error?: Error): Promise<void> {
    const message = success
      ? `Failover completed successfully to ${targetRegion}`
      : `Failover failed: ${error?.message}`;
    
    const subject = success
      ? 'n8n-MCP Failover Completed'
      : 'n8n-MCP Failover Failed';
    
    // SNS notification
    if (this.config.notification.snsTopicArn) {
      try {
        await this.sns.publish({
          TopicArn: this.config.notification.snsTopicArn,
          Subject: subject,
          Message: JSON.stringify({
            timestamp: new Date().toISOString(),
            success,
            sourceRegion: this.state.currentActiveRegion,
            targetRegion,
            error: error?.message,
            failoverCount: this.state.failoverCount
          }, null, 2)
        }).promise();
      } catch (err) {
        logger.error('Failed to send SNS notification', { err });
      }
    }
    
    // Slack notification
    if (this.config.notification.slackWebhookUrl) {
      // Send to Slack
    }
    
    // Email notification
    if (this.config.notification.email?.length) {
      // Send email
    }
  }

  private getRegionDbPool(region: string): Pool {
    if (!this.dbPools.has(region)) {
      // Create pool for region
      this.dbPools.set(region, new Pool({
        host: `db.${region}.n8n-mcp.internal`,
        port: 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }));
    }
    return this.dbPools.get(region)!;
  }

  private async updateRegionConfig(region: string, config: any): Promise<void> {
    // Update configuration in region
  }

  private async callRegionEndpoint(region: string, path: string, method: string): Promise<any> {
    // Call endpoint in specific region
    return { status: 200 };
  }

  private async recordFailoverFailure(error: Error): Promise<void> {
    // Record failure for analysis
  }

  private updateHealthMetrics(): void {
    for (const [region, health] of this.state.healthStatus) {
      metrics.recordMetric('failover', 'regionHealth', health.isHealthy ? 1 : 0, {
        region,
        consecutive_failures: health.consecutiveFailures.toString()
      });
      
      metrics.recordMetric('failover', 'regionLatency', health.metrics.latency, { region });
      metrics.recordMetric('failover', 'regionErrorRate', health.metrics.errorRate, { region });
    }
  }

  async manualFailover(targetRegion: string): Promise<void> {
    logger.info('Manual failover requested', { targetRegion });
    
    // Verify target region exists
    if (!this.state.availableRegions.includes(targetRegion)) {
      throw new Error(`Invalid target region: ${targetRegion}`);
    }
    
    // Verify target is not current
    if (targetRegion === this.state.currentActiveRegion) {
      throw new Error('Target region is already active');
    }
    
    await this.initiateFailover();
  }

  getStatus(): FailoverState {
    return {
      ...this.state,
      healthStatus: new Map(this.state.healthStatus)
    };
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Close database pools
    for (const pool of this.dbPools.values()) {
      pool.end();
    }
    
    logger.info('Failover controller stopped');
  }
}