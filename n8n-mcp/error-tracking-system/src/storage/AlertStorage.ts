import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { Alert, AlertRule } from '../alerts/AlertManager';

export class AlertStorage {
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
      this.initialized = true;
      logger.info('Alert storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize alert storage', { error: error.message });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create alerts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS alerts (
          id UUID PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          title VARCHAR(500) NOT NULL,
          message TEXT NOT NULL,
          source VARCHAR(255) NOT NULL,
          fingerprint VARCHAR(32) NOT NULL,
          timestamp BIGINT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          context JSONB NOT NULL,
          recipients JSONB NOT NULL,
          escalation JSONB NOT NULL,
          acknowledgment JSONB,
          resolution JSONB,
          notifications JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create alert rules table
      await client.query(`
        CREATE TABLE IF NOT EXISTS alert_rules (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          enabled BOOLEAN NOT NULL DEFAULT true,
          conditions JSONB NOT NULL,
          actions JSONB NOT NULL,
          throttle JSONB NOT NULL,
          schedule JSONB,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_by VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
        CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
        CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alerts_fingerprint ON alerts(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);
        
        CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
        CREATE INDEX IF NOT EXISTS idx_alert_rules_name ON alert_rules(name);
      `);

      logger.info('Alert storage tables and indexes created successfully');
    } finally {
      client.release();
    }
  }

  async storeAlert(alert: Alert): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO alerts (
          id, type, severity, status, title, message, source, fingerprint,
          timestamp, metadata, context, recipients, escalation, acknowledgment,
          resolution, notifications
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        alert.id,
        alert.type,
        alert.severity,
        alert.status,
        alert.title,
        alert.message,
        alert.source,
        alert.fingerprint,
        alert.timestamp,
        JSON.stringify(alert.metadata),
        JSON.stringify(alert.context),
        JSON.stringify(alert.recipients),
        JSON.stringify(alert.escalation),
        alert.acknowledgment ? JSON.stringify(alert.acknowledgment) : null,
        alert.resolution ? JSON.stringify(alert.resolution) : null,
        JSON.stringify(alert.notifications)
      ]);
    } finally {
      client.release();
    }
  }

  async updateAlert(alert: Alert): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        UPDATE alerts SET
          status = $2,
          metadata = $3,
          recipients = $4,
          escalation = $5,
          acknowledgment = $6,
          resolution = $7,
          notifications = $8,
          updated_at = NOW()
        WHERE id = $1
      `, [
        alert.id,
        alert.status,
        JSON.stringify(alert.metadata),
        JSON.stringify(alert.recipients),
        JSON.stringify(alert.escalation),
        alert.acknowledgment ? JSON.stringify(alert.acknowledgment) : null,
        alert.resolution ? JSON.stringify(alert.resolution) : null,
        JSON.stringify(alert.notifications)
      ]);
    } finally {
      client.release();
    }
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM alerts WHERE id = $1',
        [alertId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAlert(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async searchAlerts(query: {
    type?: string;
    severity?: string;
    status?: string;
    source?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: Alert[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereClause = '1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (query.type) {
        whereClause += ` AND type = $${paramIndex}`;
        params.push(query.type);
        paramIndex++;
      }

      if (query.severity) {
        whereClause += ` AND severity = $${paramIndex}`;
        params.push(query.severity);
        paramIndex++;
      }

      if (query.status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(query.status);
        paramIndex++;
      }

      if (query.source) {
        whereClause += ` AND source = $${paramIndex}`;
        params.push(query.source);
        paramIndex++;
      }

      if (query.startTime) {
        whereClause += ` AND timestamp >= $${paramIndex}`;
        params.push(query.startTime);
        paramIndex++;
      }

      if (query.endTime) {
        whereClause += ` AND timestamp <= $${paramIndex}`;
        params.push(query.endTime);
        paramIndex++;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) FROM alerts WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get results with pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      
      const result = await client.query(`
        SELECT * FROM alerts 
        WHERE ${whereClause} 
        ORDER BY timestamp DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      const alerts = result.rows.map(row => this.mapRowToAlert(row));

      return { alerts, total };
    } finally {
      client.release();
    }
  }

  async getAlertsInRange(startTime: number, endTime: number): Promise<Alert[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM alerts 
        WHERE timestamp BETWEEN $1 AND $2 
        ORDER BY timestamp DESC
      `, [startTime, endTime]);

      return result.rows.map(row => this.mapRowToAlert(row));
    } finally {
      client.release();
    }
  }

  async storeAlertRule(rule: AlertRule): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO alert_rules (
          id, name, description, enabled, conditions, actions, throttle,
          schedule, metadata, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        rule.id,
        rule.name,
        rule.description,
        rule.enabled,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        JSON.stringify(rule.throttle),
        rule.schedule ? JSON.stringify(rule.schedule) : null,
        JSON.stringify(rule.metadata),
        rule.createdBy,
        rule.createdAt,
        rule.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async updateAlertRule(rule: AlertRule): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        UPDATE alert_rules SET
          name = $2,
          description = $3,
          enabled = $4,
          conditions = $5,
          actions = $6,
          throttle = $7,
          schedule = $8,
          metadata = $9,
          updated_at = $10
        WHERE id = $1
      `, [
        rule.id,
        rule.name,
        rule.description,
        rule.enabled,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        JSON.stringify(rule.throttle),
        rule.schedule ? JSON.stringify(rule.schedule) : null,
        JSON.stringify(rule.metadata),
        rule.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  async getAlertRule(ruleId: string): Promise<AlertRule | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM alert_rules WHERE id = $1',
        [ruleId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAlertRule(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getAllAlertRules(): Promise<AlertRule[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM alert_rules ORDER BY name'
      );

      return result.rows.map(row => this.mapRowToAlertRule(row));
    } finally {
      client.release();
    }
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('DELETE FROM alert_rules WHERE id = $1', [ruleId]);
    } finally {
      client.release();
    }
  }

  async cleanup(maxRetentionDays: number): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const cutoffTime = Date.now() - (maxRetentionDays * 24 * 60 * 60 * 1000);
      
      const result = await client.query(
        'DELETE FROM alerts WHERE timestamp < $1 AND status IN ($2, $3)',
        [cutoffTime, 'resolved', 'suppressed']
      );

      logger.info('Cleaned up old alert data', { 
        deletedAlerts: result.rowCount,
        cutoffTime: new Date(cutoffTime).toISOString()
      });

      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      message: row.message,
      source: row.source,
      fingerprint: row.fingerprint,
      timestamp: parseInt(row.timestamp),
      metadata: row.metadata,
      context: row.context,
      recipients: row.recipients,
      escalation: row.escalation,
      acknowledgment: row.acknowledgment,
      resolution: row.resolution,
      notifications: row.notifications
    };
  }

  private mapRowToAlertRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      conditions: row.conditions,
      actions: row.actions,
      throttle: row.throttle,
      schedule: row.schedule,
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at)
    };
  }

  async destroy(): Promise<void> {
    await this.pool.end();
    logger.info('Alert storage connections closed');
  }
}