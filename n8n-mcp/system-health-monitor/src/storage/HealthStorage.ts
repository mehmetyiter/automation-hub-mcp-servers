import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { HealthCheck, HealthCheckResult, SystemMetrics, IncidentDefinition } from '../core/HealthMonitor';

export class HealthStorage {
  private pool: Pool;
  private initialized = false;

  constructor(private config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
  }) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.createTables();
      await this.createIndexes();
      this.initialized = true;
      logger.info('Health storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize health storage', { error: error.message });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create health checks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS health_checks (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          target VARCHAR(500) NOT NULL,
          config JSONB NOT NULL DEFAULT '{}',
          thresholds JSONB NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          tags TEXT[] DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      // Create health check results table
      await client.query(`
        CREATE TABLE IF NOT EXISTS health_check_results (
          id UUID PRIMARY KEY,
          check_id UUID NOT NULL,
          timestamp BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL,
          response_time INTEGER NOT NULL,
          success BOOLEAN NOT NULL,
          message TEXT NOT NULL,
          error TEXT,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create system metrics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          cpu JSONB NOT NULL,
          memory JSONB NOT NULL,
          disk JSONB NOT NULL,
          network JSONB NOT NULL,
          processes JSONB NOT NULL,
          docker JSONB,
          kubernetes JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create incidents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS incidents (
          id UUID PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          severity VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          affected_services TEXT[] DEFAULT '{}',
          check_ids UUID[] DEFAULT '{}',
          start_time BIGINT NOT NULL,
          end_time BIGINT,
          updates JSONB NOT NULL DEFAULT '[]',
          assigned_to VARCHAR(255),
          tags TEXT[] DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create aggregated health stats table
      await client.query(`
        CREATE TABLE IF NOT EXISTS health_stats_daily (
          date DATE NOT NULL,
          check_id UUID NOT NULL,
          total_checks INTEGER NOT NULL DEFAULT 0,
          successful_checks INTEGER NOT NULL DEFAULT 0,
          failed_checks INTEGER NOT NULL DEFAULT 0,
          avg_response_time INTEGER NOT NULL DEFAULT 0,
          min_response_time INTEGER NOT NULL DEFAULT 0,
          max_response_time INTEGER NOT NULL DEFAULT 0,
          uptime_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
          downtime_minutes INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (date, check_id)
        );
      `);

      // Create system health snapshots table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_health_snapshots (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          overall_status VARCHAR(20) NOT NULL,
          total_checks INTEGER NOT NULL,
          healthy_checks INTEGER NOT NULL,
          warning_checks INTEGER NOT NULL,
          critical_checks INTEGER NOT NULL,
          infrastructure_health JSONB NOT NULL,
          active_incidents INTEGER NOT NULL,
          system_uptime BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create service dependencies table
      await client.query(`
        CREATE TABLE IF NOT EXISTS service_dependencies (
          id UUID PRIMARY KEY,
          service_name VARCHAR(255) NOT NULL,
          depends_on VARCHAR(255) NOT NULL,
          dependency_type VARCHAR(50) NOT NULL,
          criticality VARCHAR(20) NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(service_name, depends_on)
        );
      `);

      logger.info('Health storage tables created successfully');
    } finally {
      client.release();
    }
  }

  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Health checks indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_health_checks_name ON health_checks(name);
        CREATE INDEX IF NOT EXISTS idx_health_checks_type ON health_checks(type);
        CREATE INDEX IF NOT EXISTS idx_health_checks_enabled ON health_checks(enabled);
        CREATE INDEX IF NOT EXISTS idx_health_checks_tags ON health_checks USING GIN(tags);
      `);

      // Health check results indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_health_results_check_id ON health_check_results(check_id);
        CREATE INDEX IF NOT EXISTS idx_health_results_timestamp ON health_check_results(timestamp);
        CREATE INDEX IF NOT EXISTS idx_health_results_status ON health_check_results(status);
        CREATE INDEX IF NOT EXISTS idx_health_results_check_timestamp ON health_check_results(check_id, timestamp);
      `);

      // System metrics indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
      `);

      // Incidents indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
        CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
        CREATE INDEX IF NOT EXISTS idx_incidents_start_time ON incidents(start_time);
        CREATE INDEX IF NOT EXISTS idx_incidents_check_ids ON incidents USING GIN(check_ids);
        CREATE INDEX IF NOT EXISTS idx_incidents_tags ON incidents USING GIN(tags);
      `);

      // Health stats indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_health_stats_date ON health_stats_daily(date);
        CREATE INDEX IF NOT EXISTS idx_health_stats_check_id ON health_stats_daily(check_id);
      `);

      // System health snapshots indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp ON system_health_snapshots(timestamp);
        CREATE INDEX IF NOT EXISTS idx_health_snapshots_status ON system_health_snapshots(overall_status);
      `);

      // Service dependencies indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_service_deps_service ON service_dependencies(service_name);
        CREATE INDEX IF NOT EXISTS idx_service_deps_depends ON service_dependencies(depends_on);
      `);

      logger.info('Health storage indexes created successfully');
    } finally {
      client.release();
    }
  }

  async storeHealthCheck(healthCheck: HealthCheck): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO health_checks (
          id, name, type, target, config, thresholds, enabled, tags, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        healthCheck.id,
        healthCheck.name,
        healthCheck.type,
        healthCheck.target,
        JSON.stringify(healthCheck.config),
        JSON.stringify(healthCheck.thresholds),
        healthCheck.enabled,
        healthCheck.tags,
        JSON.stringify(healthCheck.metadata),
        healthCheck.createdAt,
        healthCheck.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async updateHealthCheck(healthCheck: HealthCheck): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        UPDATE health_checks SET
          name = $2,
          type = $3,
          target = $4,
          config = $5,
          thresholds = $6,
          enabled = $7,
          tags = $8,
          metadata = $9,
          updated_at = $10
        WHERE id = $1
      `, [
        healthCheck.id,
        healthCheck.name,
        healthCheck.type,
        healthCheck.target,
        JSON.stringify(healthCheck.config),
        JSON.stringify(healthCheck.thresholds),
        healthCheck.enabled,
        healthCheck.tags,
        JSON.stringify(healthCheck.metadata),
        healthCheck.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async deleteHealthCheck(checkId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('DELETE FROM health_checks WHERE id = $1', [checkId]);
    } finally {
      client.release();
    }
  }

  async getHealthChecks(): Promise<HealthCheck[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM health_checks ORDER BY name');
      return result.rows.map(row => this.mapRowToHealthCheck(row));
    } finally {
      client.release();
    }
  }

  async storeResult(result: HealthCheckResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO health_check_results (
          id, check_id, timestamp, status, response_time, success, message, error, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        result.id,
        result.checkId,
        result.timestamp,
        result.status,
        result.responseTime,
        result.success,
        result.message,
        result.error,
        JSON.stringify(result.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async getResults(
    checkId?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): Promise<HealthCheckResult[]> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT * FROM health_check_results WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (checkId) {
        query += ` AND check_id = $${paramIndex}`;
        params.push(checkId);
        paramIndex++;
      }

      if (startTime) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(startTime);
        paramIndex++;
      }

      if (endTime) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(endTime);
        paramIndex++;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToResult(row));
    } finally {
      client.release();
    }
  }

  async getRecentResults(timeRangeMs: number): Promise<HealthCheckResult[]> {
    const startTime = Date.now() - timeRangeMs;
    return this.getResults(undefined, startTime, undefined, 1000);
  }

  async storeSystemMetrics(metrics: SystemMetrics): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO system_metrics (
          timestamp, cpu, memory, disk, network, processes, docker, kubernetes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        metrics.timestamp,
        JSON.stringify(metrics.cpu),
        JSON.stringify(metrics.memory),
        JSON.stringify(metrics.disk),
        JSON.stringify(metrics.network),
        JSON.stringify(metrics.processes),
        metrics.docker ? JSON.stringify(metrics.docker) : null,
        metrics.kubernetes ? JSON.stringify(metrics.kubernetes) : null
      ]);
    } finally {
      client.release();
    }
  }

  async getSystemMetrics(
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): Promise<SystemMetrics[]> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT * FROM system_metrics WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (startTime) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(startTime);
        paramIndex++;
      }

      if (endTime) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(endTime);
        paramIndex++;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToSystemMetrics(row));
    } finally {
      client.release();
    }
  }

  async storeIncident(incident: IncidentDefinition): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO incidents (
          id, title, description, severity, status, affected_services, check_ids,
          start_time, end_time, updates, assigned_to, tags, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        incident.id,
        incident.title,
        incident.description,
        incident.severity,
        incident.status,
        incident.affectedServices,
        incident.checkIds,
        incident.startTime,
        incident.endTime,
        JSON.stringify(incident.updates),
        incident.assignedTo,
        incident.tags,
        JSON.stringify(incident.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async updateIncident(incident: IncidentDefinition): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        UPDATE incidents SET
          title = $2,
          description = $3,
          severity = $4,
          status = $5,
          affected_services = $6,
          check_ids = $7,
          end_time = $8,
          updates = $9,
          assigned_to = $10,
          tags = $11,
          metadata = $12,
          updated_at = NOW()
        WHERE id = $1
      `, [
        incident.id,
        incident.title,
        incident.description,
        incident.severity,
        incident.status,
        incident.affectedServices,
        incident.checkIds,
        incident.endTime,
        JSON.stringify(incident.updates),
        incident.assignedTo,
        incident.tags,
        JSON.stringify(incident.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async getIncidents(
    status?: string,
    limit: number = 100
  ): Promise<IncidentDefinition[]> {
    const client = await this.pool.connect();
    
    try {
      let query = 'SELECT * FROM incidents WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY start_time DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToIncident(row));
    } finally {
      client.release();
    }
  }

  async aggregateDailyStats(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO health_stats_daily (
          date, check_id, total_checks, successful_checks, failed_checks,
          avg_response_time, min_response_time, max_response_time,
          uptime_percentage, downtime_minutes
        )
        SELECT 
          DATE(to_timestamp(timestamp/1000)) as date,
          check_id,
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE success = true) as successful_checks,
          COUNT(*) FILTER (WHERE success = false) as failed_checks,
          AVG(response_time)::INTEGER as avg_response_time,
          MIN(response_time) as min_response_time,
          MAX(response_time) as max_response_time,
          (COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*))::DECIMAL(5,2) as uptime_percentage,
          (COUNT(*) FILTER (WHERE success = false) * 5)::INTEGER as downtime_minutes
        FROM health_check_results 
        WHERE DATE(to_timestamp(timestamp/1000)) = CURRENT_DATE - INTERVAL '1 day'
        GROUP BY DATE(to_timestamp(timestamp/1000)), check_id
        ON CONFLICT (date, check_id) DO UPDATE SET
          total_checks = EXCLUDED.total_checks,
          successful_checks = EXCLUDED.successful_checks,
          failed_checks = EXCLUDED.failed_checks,
          avg_response_time = EXCLUDED.avg_response_time,
          min_response_time = EXCLUDED.min_response_time,
          max_response_time = EXCLUDED.max_response_time,
          uptime_percentage = EXCLUDED.uptime_percentage,
          downtime_minutes = EXCLUDED.downtime_minutes
      `);
    } finally {
      client.release();
    }
  }

  async cleanup(maxAge: number): Promise<void> {
    const client = await this.pool.connect();
    const cutoffTime = Date.now() - maxAge;
    
    try {
      await client.query('BEGIN');

      // Clean up old health check results
      const resultCleanup = await client.query(
        'DELETE FROM health_check_results WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up old system metrics
      const metricsCleanup = await client.query(
        'DELETE FROM system_metrics WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up old resolved incidents
      const incidentCleanup = await client.query(
        'DELETE FROM incidents WHERE status = $1 AND end_time < $2',
        ['resolved', cutoffTime]
      );

      // Clean up old daily stats
      const statsCleanup = await client.query(
        'DELETE FROM health_stats_daily WHERE date < $1',
        [new Date(cutoffTime).toISOString().split('T')[0]]
      );

      // Clean up old health snapshots
      const snapshotCleanup = await client.query(
        'DELETE FROM system_health_snapshots WHERE timestamp < $1',
        [cutoffTime]
      );

      await client.query('COMMIT');

      logger.info('Health storage cleanup completed', {
        deletedResults: resultCleanup.rowCount,
        deletedMetrics: metricsCleanup.rowCount,
        deletedIncidents: incidentCleanup.rowCount,
        deletedStats: statsCleanup.rowCount,
        deletedSnapshots: snapshotCleanup.rowCount
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Health storage cleanup failed', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToHealthCheck(row: any): HealthCheck {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      target: row.target,
      config: row.config,
      thresholds: row.thresholds,
      enabled: row.enabled,
      tags: row.tags || [],
      metadata: row.metadata,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at)
    };
  }

  private mapRowToResult(row: any): HealthCheckResult {
    return {
      id: row.id,
      checkId: row.check_id,
      timestamp: parseInt(row.timestamp),
      status: row.status,
      responseTime: row.response_time,
      success: row.success,
      message: row.message,
      error: row.error,
      metadata: row.metadata
    };
  }

  private mapRowToSystemMetrics(row: any): SystemMetrics {
    return {
      timestamp: parseInt(row.timestamp),
      cpu: row.cpu,
      memory: row.memory,
      disk: row.disk,
      network: row.network,
      processes: row.processes,
      docker: row.docker,
      kubernetes: row.kubernetes
    };
  }

  private mapRowToIncident(row: any): IncidentDefinition {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      affectedServices: row.affected_services || [],
      checkIds: row.check_ids || [],
      startTime: parseInt(row.start_time),
      endTime: row.end_time ? parseInt(row.end_time) : undefined,
      updates: row.updates,
      assignedTo: row.assigned_to,
      tags: row.tags || [],
      metadata: row.metadata
    };
  }

  async destroy(): Promise<void> {
    await this.pool.end();
    logger.info('Health storage connections closed');
  }
}