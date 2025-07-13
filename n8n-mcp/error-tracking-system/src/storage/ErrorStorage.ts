import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ErrorEvent, ErrorGroup } from '../core/ErrorTracker';

export class ErrorStorage {
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
      logger.info('Error storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize error storage', { error: error.message });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create errors table
      await client.query(`
        CREATE TABLE IF NOT EXISTS errors (
          id UUID PRIMARY KEY,
          fingerprint VARCHAR(32) NOT NULL,
          timestamp BIGINT NOT NULL,
          level VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(255) NOT NULL,
          stack_trace TEXT,
          context JSONB NOT NULL,
          metadata JSONB NOT NULL,
          breadcrumbs JSONB NOT NULL,
          performance JSONB NOT NULL,
          resolution JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create error groups table
      await client.query(`
        CREATE TABLE IF NOT EXISTS error_groups (
          id UUID PRIMARY KEY,
          fingerprint VARCHAR(32) UNIQUE NOT NULL,
          title VARCHAR(500) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(255) NOT NULL,
          level VARCHAR(20) NOT NULL,
          first_seen BIGINT NOT NULL,
          last_seen BIGINT NOT NULL,
          count INTEGER NOT NULL DEFAULT 1,
          user_count INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          assigned_to VARCHAR(255),
          tags TEXT[] DEFAULT '{}',
          environments TEXT[] DEFAULT '{}',
          platforms TEXT[] DEFAULT '{}',
          affected_workflows TEXT[] DEFAULT '{}',
          statistics JSONB NOT NULL,
          samples JSONB NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_errors_fingerprint ON errors(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp);
        CREATE INDEX IF NOT EXISTS idx_errors_level ON errors(level);
        CREATE INDEX IF NOT EXISTS idx_errors_type ON errors(type);
        CREATE INDEX IF NOT EXISTS idx_errors_workflow_id ON errors((context->>'workflowId'));
        CREATE INDEX IF NOT EXISTS idx_errors_user_id ON errors((context->>'userId'));
        
        CREATE INDEX IF NOT EXISTS idx_error_groups_fingerprint ON error_groups(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_error_groups_status ON error_groups(status);
        CREATE INDEX IF NOT EXISTS idx_error_groups_level ON error_groups(level);
        CREATE INDEX IF NOT EXISTS idx_error_groups_last_seen ON error_groups(last_seen);
      `);

      logger.info('Database tables and indexes created successfully');
    } finally {
      client.release();
    }
  }

  async storeError(error: ErrorEvent): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO errors (
          id, fingerprint, timestamp, level, message, type, stack_trace,
          context, metadata, breadcrumbs, performance, resolution
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        error.id,
        error.fingerprint,
        error.timestamp,
        error.level,
        error.message,
        error.type,
        error.stackTrace,
        JSON.stringify(error.context),
        JSON.stringify(error.metadata),
        JSON.stringify(error.breadcrumbs),
        JSON.stringify(error.performance),
        JSON.stringify(error.resolution)
      ]);
    } finally {
      client.release();
    }
  }

  async getError(errorId: string): Promise<ErrorEvent | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM errors WHERE id = $1',
        [errorId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToErrorEvent(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updateErrorGroup(errorGroup: ErrorGroup): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO error_groups (
          id, fingerprint, title, message, type, level, first_seen, last_seen,
          count, user_count, status, assigned_to, tags, environments, platforms,
          affected_workflows, statistics, samples, metadata, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
        ON CONFLICT (fingerprint) DO UPDATE SET
          title = EXCLUDED.title,
          message = EXCLUDED.message,
          level = EXCLUDED.level,
          last_seen = EXCLUDED.last_seen,
          count = EXCLUDED.count,
          user_count = EXCLUDED.user_count,
          status = EXCLUDED.status,
          assigned_to = EXCLUDED.assigned_to,
          tags = EXCLUDED.tags,
          environments = EXCLUDED.environments,
          platforms = EXCLUDED.platforms,
          affected_workflows = EXCLUDED.affected_workflows,
          statistics = EXCLUDED.statistics,
          samples = EXCLUDED.samples,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        errorGroup.id,
        errorGroup.fingerprint,
        errorGroup.title,
        errorGroup.message,
        errorGroup.type,
        errorGroup.level,
        errorGroup.firstSeen,
        errorGroup.lastSeen,
        errorGroup.count,
        errorGroup.userCount,
        errorGroup.status,
        errorGroup.assignedTo,
        errorGroup.tags,
        errorGroup.environments,
        errorGroup.platforms,
        errorGroup.affectedWorkflows,
        JSON.stringify(errorGroup.statistics),
        JSON.stringify(errorGroup.samples),
        JSON.stringify(errorGroup.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async getErrorGroup(fingerprint: string): Promise<ErrorGroup | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM error_groups WHERE fingerprint = $1',
        [fingerprint]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToErrorGroup(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getErrorGroups(limit: number = 100, offset: number = 0): Promise<ErrorGroup[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM error_groups 
        ORDER BY last_seen DESC 
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows.map(row => this.mapRowToErrorGroup(row));
    } finally {
      client.release();
    }
  }

  async getErrorsInRange(startTime: number, endTime: number): Promise<ErrorEvent[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM errors 
        WHERE timestamp BETWEEN $1 AND $2 
        ORDER BY timestamp DESC
      `, [startTime, endTime]);

      return result.rows.map(row => this.mapRowToErrorEvent(row));
    } finally {
      client.release();
    }
  }

  async searchErrors(query: {
    text?: string;
    level?: string;
    type?: string;
    workflowId?: string;
    userId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ errors: ErrorEvent[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereClause = '1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (query.text) {
        whereClause += ` AND (message ILIKE $${paramIndex} OR type ILIKE $${paramIndex})`;
        params.push(`%${query.text}%`);
        paramIndex++;
      }

      if (query.level) {
        whereClause += ` AND level = $${paramIndex}`;
        params.push(query.level);
        paramIndex++;
      }

      if (query.type) {
        whereClause += ` AND type = $${paramIndex}`;
        params.push(query.type);
        paramIndex++;
      }

      if (query.workflowId) {
        whereClause += ` AND context->>'workflowId' = $${paramIndex}`;
        params.push(query.workflowId);
        paramIndex++;
      }

      if (query.userId) {
        whereClause += ` AND context->>'userId' = $${paramIndex}`;
        params.push(query.userId);
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
        `SELECT COUNT(*) FROM errors WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get results with pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      
      const result = await client.query(`
        SELECT * FROM errors 
        WHERE ${whereClause} 
        ORDER BY timestamp DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      const errors = result.rows.map(row => this.mapRowToErrorEvent(row));

      return { errors, total };
    } finally {
      client.release();
    }
  }

  async getErrorTrends(
    startTime: number,
    endTime: number,
    granularity: 'hour' | 'day'
  ): Promise<Array<{ timestamp: number; count: number; level: Record<string, number> }>> {
    const client = await this.pool.connect();
    
    try {
      const interval = granularity === 'hour' ? '1 hour' : '1 day';
      const truncFunc = granularity === 'hour' ? 'date_trunc(\'hour\', to_timestamp(timestamp/1000))' 
        : 'date_trunc(\'day\', to_timestamp(timestamp/1000))';

      const result = await client.query(`
        SELECT 
          EXTRACT(EPOCH FROM ${truncFunc}) * 1000 as bucket_timestamp,
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE level = 'error') as error_count,
          COUNT(*) FILTER (WHERE level = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE level = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE level = 'fatal') as fatal_count
        FROM errors 
        WHERE timestamp BETWEEN $1 AND $2 
        GROUP BY ${truncFunc}
        ORDER BY bucket_timestamp
      `, [startTime, endTime]);

      return result.rows.map(row => ({
        timestamp: parseInt(row.bucket_timestamp),
        count: parseInt(row.total_count),
        level: {
          error: parseInt(row.error_count || 0),
          warning: parseInt(row.warning_count || 0),
          critical: parseInt(row.critical_count || 0),
          fatal: parseInt(row.fatal_count || 0)
        }
      }));
    } finally {
      client.release();
    }
  }

  async cleanup(maxRetentionDays: number): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const cutoffTime = Date.now() - (maxRetentionDays * 24 * 60 * 60 * 1000);
      
      // Delete old errors
      const result = await client.query(
        'DELETE FROM errors WHERE timestamp < $1',
        [cutoffTime]
      );

      // Clean up orphaned error groups (no recent errors)
      await client.query(`
        DELETE FROM error_groups 
        WHERE fingerprint NOT IN (
          SELECT DISTINCT fingerprint 
          FROM errors 
          WHERE timestamp >= $1
        ) AND last_seen < $1
      `, [cutoffTime]);

      logger.info('Cleaned up old error data', { 
        deletedErrors: result.rowCount,
        cutoffTime: new Date(cutoffTime).toISOString()
      });

      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  private mapRowToErrorEvent(row: any): ErrorEvent {
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      timestamp: parseInt(row.timestamp),
      level: row.level,
      message: row.message,
      type: row.type,
      stackTrace: row.stack_trace,
      context: row.context,
      metadata: row.metadata,
      breadcrumbs: row.breadcrumbs,
      performance: row.performance,
      resolution: row.resolution
    };
  }

  private mapRowToErrorGroup(row: any): ErrorGroup {
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      title: row.title,
      message: row.message,
      type: row.type,
      level: row.level,
      firstSeen: parseInt(row.first_seen),
      lastSeen: parseInt(row.last_seen),
      count: parseInt(row.count),
      userCount: parseInt(row.user_count),
      status: row.status,
      assignedTo: row.assigned_to,
      tags: row.tags || [],
      environments: row.environments || [],
      platforms: row.platforms || [],
      affectedWorkflows: row.affected_workflows || [],
      statistics: row.statistics,
      samples: row.samples,
      metadata: row.metadata
    };
  }

  async destroy(): Promise<void> {
    await this.pool.end();
    logger.info('Error storage connections closed');
  }
}