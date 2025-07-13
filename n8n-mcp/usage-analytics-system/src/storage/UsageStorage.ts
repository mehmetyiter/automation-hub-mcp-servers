import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { UsageEvent, UsageSession, UsageMetrics, FunnelAnalysis, CohortAnalysis } from '../core/UsageTracker';

export class UsageStorage {
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
      max: config.maxConnections || 30,
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
      logger.info('Usage storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize usage storage', { error: error.message });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS usage_events (
          id UUID PRIMARY KEY,
          session_id UUID NOT NULL,
          user_id VARCHAR(255),
          event VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          timestamp BIGINT NOT NULL,
          duration INTEGER,
          properties JSONB NOT NULL DEFAULT '{}',
          context JSONB NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS usage_sessions (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255),
          start_time BIGINT NOT NULL,
          end_time BIGINT,
          duration INTEGER,
          event_count INTEGER NOT NULL DEFAULT 0,
          page_views INTEGER NOT NULL DEFAULT 0,
          api_calls INTEGER NOT NULL DEFAULT 0,
          workflow_actions INTEGER NOT NULL DEFAULT 0,
          user_actions INTEGER NOT NULL DEFAULT 0,
          bounce_rate DECIMAL(3,2) NOT NULL DEFAULT 0,
          entry_page VARCHAR(500),
          exit_page VARCHAR(500),
          conversion_events TEXT[] DEFAULT '{}',
          context JSONB NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create aggregated daily stats table
      await client.query(`
        CREATE TABLE IF NOT EXISTS usage_daily_stats (
          date DATE NOT NULL,
          total_events INTEGER NOT NULL DEFAULT 0,
          total_sessions INTEGER NOT NULL DEFAULT 0,
          unique_users INTEGER NOT NULL DEFAULT 0,
          page_views INTEGER NOT NULL DEFAULT 0,
          api_calls INTEGER NOT NULL DEFAULT 0,
          workflow_actions INTEGER NOT NULL DEFAULT 0,
          avg_session_duration INTEGER,
          bounce_rate DECIMAL(3,2),
          top_pages JSONB DEFAULT '[]',
          top_events JSONB DEFAULT '[]',
          countries JSONB DEFAULT '[]',
          devices JSONB DEFAULT '[]',
          browsers JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (date)
        );
      `);

      // Create page analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS page_analytics (
          id SERIAL PRIMARY KEY,
          page VARCHAR(500) NOT NULL,
          date DATE NOT NULL,
          views INTEGER NOT NULL DEFAULT 0,
          unique_views INTEGER NOT NULL DEFAULT 0,
          avg_time_on_page INTEGER,
          bounce_rate DECIMAL(3,2),
          entries INTEGER NOT NULL DEFAULT 0,
          exits INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(page, date)
        );
      `);

      // Create user analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_analytics (
          user_id VARCHAR(255) NOT NULL,
          date DATE NOT NULL,
          sessions INTEGER NOT NULL DEFAULT 0,
          page_views INTEGER NOT NULL DEFAULT 0,
          time_spent INTEGER NOT NULL DEFAULT 0,
          events INTEGER NOT NULL DEFAULT 0,
          last_seen TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (user_id, date)
        );
      `);

      // Create conversion funnels table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversion_funnels (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          definition JSONB NOT NULL,
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create cohort definitions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS cohort_definitions (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          period VARCHAR(20) NOT NULL,
          definition JSONB NOT NULL,
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      logger.info('Usage storage tables created successfully');
    } finally {
      client.release();
    }
  }

  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Events table indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_usage_events_session_id ON usage_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_usage_events_event ON usage_events(event);
        CREATE INDEX IF NOT EXISTS idx_usage_events_category ON usage_events(category);
        CREATE INDEX IF NOT EXISTS idx_usage_events_properties ON usage_events USING GIN(properties);
        CREATE INDEX IF NOT EXISTS idx_usage_events_context ON usage_events USING GIN(context);
      `);

      // Sessions table indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_usage_sessions_user_id ON usage_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_sessions_start_time ON usage_sessions(start_time);
        CREATE INDEX IF NOT EXISTS idx_usage_sessions_end_time ON usage_sessions(end_time);
        CREATE INDEX IF NOT EXISTS idx_usage_sessions_context ON usage_sessions USING GIN(context);
      `);

      // Daily stats indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_usage_daily_stats_date ON usage_daily_stats(date);
      `);

      // Page analytics indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_page_analytics_page ON page_analytics(page);
        CREATE INDEX IF NOT EXISTS idx_page_analytics_date ON page_analytics(date);
      `);

      // User analytics indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_analytics_date ON user_analytics(date);
      `);

      logger.info('Usage storage indexes created successfully');
    } finally {
      client.release();
    }
  }

  async storeEvents(events: UsageEvent[]): Promise<void> {
    if (events.length === 0) return;

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO usage_events (
          id, session_id, user_id, event, category, timestamp, duration,
          properties, context, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      for (const event of events) {
        await client.query(query, [
          event.id,
          event.sessionId,
          event.userId,
          event.event,
          event.category,
          event.timestamp,
          event.duration,
          JSON.stringify(event.properties),
          JSON.stringify(event.context),
          JSON.stringify(event.metadata)
        ]);
      }

      await client.query('COMMIT');

      logger.debug('Events stored successfully', { count: events.length });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to store events', { error: error.message, count: events.length });
      throw error;
    } finally {
      client.release();
    }
  }

  async storeSession(session: UsageSession): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO usage_sessions (
          id, user_id, start_time, end_time, duration, event_count,
          page_views, api_calls, workflow_actions, user_actions,
          bounce_rate, entry_page, exit_page, conversion_events,
          context, metadata, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          duration = EXCLUDED.duration,
          event_count = EXCLUDED.event_count,
          page_views = EXCLUDED.page_views,
          api_calls = EXCLUDED.api_calls,
          workflow_actions = EXCLUDED.workflow_actions,
          user_actions = EXCLUDED.user_actions,
          bounce_rate = EXCLUDED.bounce_rate,
          exit_page = EXCLUDED.exit_page,
          conversion_events = EXCLUDED.conversion_events,
          updated_at = NOW()
      `, [
        session.id,
        session.userId,
        session.startTime,
        session.endTime,
        session.duration,
        session.eventCount,
        session.pageViews,
        session.apiCalls,
        session.workflowActions,
        session.userActions,
        session.bounceRate,
        session.entryPage,
        session.exitPage,
        session.conversionEvents,
        JSON.stringify(session.context),
        JSON.stringify(session.metadata)
      ]);
    } finally {
      client.release();
    }
  }

  async getUsageMetrics(
    startTime: number,
    endTime: number,
    filters: {
      userId?: string;
      country?: string;
      platform?: string;
      version?: string;
    } = {}
  ): Promise<UsageMetrics> {
    const client = await this.pool.connect();
    
    try {
      // Build filter conditions
      let whereConditions = ['timestamp BETWEEN $1 AND $2'];
      const params: any[] = [startTime, endTime];
      let paramIndex = 3;

      if (filters.userId) {
        whereConditions.push(`user_id = $${paramIndex}`);
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters.country) {
        whereConditions.push(`context->>'country' = $${paramIndex}`);
        params.push(filters.country);
        paramIndex++;
      }

      if (filters.platform) {
        whereConditions.push(`context->>'platform' = $${paramIndex}`);
        params.push(filters.platform);
        paramIndex++;
      }

      if (filters.version) {
        whereConditions.push(`metadata->>'version' = $${paramIndex}`);
        params.push(filters.version);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get basic metrics
      const basicMetrics = await client.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as total_users
        FROM usage_events 
        WHERE ${whereClause}
      `, params);

      // Get active users
      const now = Date.now();
      const activeUsers = await client.query(`
        SELECT 
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= $${paramIndex}) as last_24_hours,
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= $${paramIndex + 1}) as last_7_days,
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= $${paramIndex + 2}) as last_30_days
        FROM usage_events 
        WHERE user_id IS NOT NULL AND timestamp <= $2
      `, [...params, now - 24*60*60*1000, now - 7*24*60*60*1000, now - 30*24*60*60*1000]);

      // Get session metrics
      const sessionMetrics = await client.query(`
        SELECT 
          AVG(duration) as avg_duration,
          AVG(page_views) as avg_page_views,
          AVG(bounce_rate) as bounce_rate,
          COUNT(*) FILTER (WHERE array_length(conversion_events, 1) > 0) / COUNT(*)::float as conversion_rate
        FROM usage_sessions 
        WHERE start_time BETWEEN $1 AND $2
      `, [startTime, endTime]);

      // Get page view metrics
      const pageMetrics = await client.query(`
        SELECT 
          COUNT(*) as total_views,
          COUNT(DISTINCT session_id) as unique_views
        FROM usage_events 
        WHERE ${whereClause} AND category = 'page_view'
      `, params);

      // Get top pages
      const topPages = await client.query(`
        SELECT 
          properties->>'page' as page,
          COUNT(*) as views,
          COUNT(DISTINCT session_id) as unique_views
        FROM usage_events 
        WHERE ${whereClause} AND category = 'page_view' AND properties->>'page' IS NOT NULL
        GROUP BY properties->>'page'
        ORDER BY views DESC
        LIMIT 10
      `, params);

      // Get API metrics
      const apiMetrics = await client.query(`
        SELECT 
          COUNT(*) as total_calls,
          AVG((properties->>'responseTime')::int) as avg_response_time,
          COUNT(*) FILTER (WHERE (properties->>'statusCode')::int >= 400) / COUNT(*)::float as error_rate
        FROM usage_events 
        WHERE ${whereClause} AND category = 'api_call'
      `, params);

      // Get top endpoints
      const topEndpoints = await client.query(`
        SELECT 
          properties->>'endpoint' as endpoint,
          COUNT(*) as calls,
          AVG((properties->>'responseTime')::int) as avg_response_time
        FROM usage_events 
        WHERE ${whereClause} AND category = 'api_call' AND properties->>'endpoint' IS NOT NULL
        GROUP BY properties->>'endpoint'
        ORDER BY calls DESC
        LIMIT 10
      `, params);

      // Get workflow metrics
      const workflowMetrics = await client.query(`
        SELECT 
          COUNT(*) as total_executions,
          AVG(duration) as avg_execution_time,
          COUNT(*) FILTER (WHERE event = 'workflow_executed') / COUNT(*)::float as success_rate
        FROM usage_events 
        WHERE ${whereClause} AND category = 'workflow_action'
      `, params);

      // Get top workflows
      const topWorkflows = await client.query(`
        SELECT 
          properties->>'workflowId' as workflow_id,
          properties->>'workflowName' as name,
          COUNT(*) as executions,
          AVG(duration) as avg_time
        FROM usage_events 
        WHERE ${whereClause} AND category = 'workflow_action' AND properties->>'workflowId' IS NOT NULL
        GROUP BY properties->>'workflowId', properties->>'workflowName'
        ORDER BY executions DESC
        LIMIT 10
      `, params);

      // Get geography data
      const countries = await client.query(`
        SELECT 
          context->>'country' as country,
          COUNT(DISTINCT user_id) as users,
          COUNT(DISTINCT session_id) as sessions
        FROM usage_events 
        WHERE ${whereClause} AND context->>'country' IS NOT NULL
        GROUP BY context->>'country'
        ORDER BY users DESC
        LIMIT 10
      `, params);

      const regions = await client.query(`
        SELECT 
          context->>'region' as region,
          COUNT(DISTINCT user_id) as users,
          COUNT(DISTINCT session_id) as sessions
        FROM usage_events 
        WHERE ${whereClause} AND context->>'region' IS NOT NULL
        GROUP BY context->>'region'
        ORDER BY users DESC
        LIMIT 10
      `, params);

      // Get technology data
      const browsers = await client.query(`
        SELECT 
          context->>'browser' as browser,
          COUNT(DISTINCT user_id) as users,
          COUNT(DISTINCT user_id) / (SELECT COUNT(DISTINCT user_id) FROM usage_events WHERE ${whereClause})::float as percentage
        FROM usage_events 
        WHERE ${whereClause} AND context->>'browser' IS NOT NULL
        GROUP BY context->>'browser'
        ORDER BY users DESC
        LIMIT 10
      `, params);

      const operatingSystems = await client.query(`
        SELECT 
          context->>'os' as os,
          COUNT(DISTINCT user_id) as users,
          COUNT(DISTINCT user_id) / (SELECT COUNT(DISTINCT user_id) FROM usage_events WHERE ${whereClause})::float as percentage
        FROM usage_events 
        WHERE ${whereClause} AND context->>'os' IS NOT NULL
        GROUP BY context->>'os'
        ORDER BY users DESC
        LIMIT 10
      `, params);

      const devices = await client.query(`
        SELECT 
          context->>'device' as device,
          COUNT(DISTINCT user_id) as users,
          COUNT(DISTINCT user_id) / (SELECT COUNT(DISTINCT user_id) FROM usage_events WHERE ${whereClause})::float as percentage
        FROM usage_events 
        WHERE ${whereClause} AND context->>'device' IS NOT NULL
        GROUP BY context->>'device'
        ORDER BY users DESC
        LIMIT 10
      `, params);

      // Construct metrics object
      const metrics: UsageMetrics = {
        totalEvents: parseInt(basicMetrics.rows[0].total_events),
        totalSessions: parseInt(basicMetrics.rows[0].total_sessions),
        totalUsers: parseInt(basicMetrics.rows[0].total_users),
        activeUsers: {
          last24Hours: parseInt(activeUsers.rows[0].last_24_hours || '0'),
          last7Days: parseInt(activeUsers.rows[0].last_7_days || '0'),
          last30Days: parseInt(activeUsers.rows[0].last_30_days || '0')
        },
        sessions: {
          averageDuration: parseInt(sessionMetrics.rows[0].avg_duration || '0'),
          averagePageViews: parseFloat(sessionMetrics.rows[0].avg_page_views || '0'),
          bounceRate: parseFloat(sessionMetrics.rows[0].bounce_rate || '0'),
          conversionRate: parseFloat(sessionMetrics.rows[0].conversion_rate || '0')
        },
        pageViews: {
          total: parseInt(pageMetrics.rows[0].total_views || '0'),
          unique: parseInt(pageMetrics.rows[0].unique_views || '0'),
          topPages: topPages.rows.map(row => ({
            page: row.page,
            views: parseInt(row.views),
            uniqueViews: parseInt(row.unique_views)
          }))
        },
        apiUsage: {
          totalCalls: parseInt(apiMetrics.rows[0].total_calls || '0'),
          averageResponseTime: parseFloat(apiMetrics.rows[0].avg_response_time || '0'),
          errorRate: parseFloat(apiMetrics.rows[0].error_rate || '0'),
          topEndpoints: topEndpoints.rows.map(row => ({
            endpoint: row.endpoint,
            calls: parseInt(row.calls),
            avgResponseTime: parseFloat(row.avg_response_time || '0')
          }))
        },
        workflows: {
          totalExecutions: parseInt(workflowMetrics.rows[0].total_executions || '0'),
          averageExecutionTime: parseFloat(workflowMetrics.rows[0].avg_execution_time || '0'),
          successRate: parseFloat(workflowMetrics.rows[0].success_rate || '0'),
          topWorkflows: topWorkflows.rows.map(row => ({
            workflowId: row.workflow_id,
            name: row.name,
            executions: parseInt(row.executions),
            avgTime: parseFloat(row.avg_time || '0')
          }))
        },
        geography: {
          countries: countries.rows.map(row => ({
            country: row.country,
            users: parseInt(row.users),
            sessions: parseInt(row.sessions)
          })),
          regions: regions.rows.map(row => ({
            region: row.region,
            users: parseInt(row.users),
            sessions: parseInt(row.sessions)
          }))
        },
        technology: {
          browsers: browsers.rows.map(row => ({
            browser: row.browser,
            users: parseInt(row.users),
            percentage: parseFloat(row.percentage || '0') * 100
          })),
          operatingSystems: operatingSystems.rows.map(row => ({
            os: row.os,
            users: parseInt(row.users),
            percentage: parseFloat(row.percentage || '0') * 100
          })),
          devices: devices.rows.map(row => ({
            device: row.device,
            users: parseInt(row.users),
            percentage: parseFloat(row.percentage || '0') * 100
          }))
        }
      };

      return metrics;
    } finally {
      client.release();
    }
  }

  async getFunnelAnalysis(
    funnelDefinition: {
      name: string;
      steps: Array<{ step: string; event: string }>;
    },
    startTime: number,
    endTime: number,
    filters: any = {}
  ): Promise<FunnelAnalysis> {
    const client = await this.pool.connect();
    
    try {
      const funnelId = `funnel_${Date.now()}`;
      const steps = funnelDefinition.steps;
      const funnelSteps: FunnelAnalysis['steps'] = [];

      let previousStepUsers = new Set<string>();
      let totalUsers = 0;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Get users who completed this step
        let query = `
          SELECT DISTINCT user_id, MIN(timestamp) as first_occurrence
          FROM usage_events 
          WHERE event = $1 AND timestamp BETWEEN $2 AND $3 AND user_id IS NOT NULL
        `;
        
        const params = [step.event, startTime, endTime];
        
        // If not the first step, filter by users who completed previous steps
        if (i > 0 && previousStepUsers.size > 0) {
          const userIds = Array.from(previousStepUsers);
          query += ` AND user_id = ANY($4)`;
          params.push(userIds);
        }
        
        query += ' GROUP BY user_id';

        const result = await client.query(query, params);
        const stepUsers = new Set(result.rows.map(row => row.user_id));
        
        if (i === 0) {
          totalUsers = stepUsers.size;
        }

        // Calculate metrics
        const users = stepUsers.size;
        const conversionRate = i === 0 ? 100 : (users / previousStepUsers.size) * 100;
        const dropOffRate = 100 - conversionRate;

        // Calculate average time (simplified)
        const avgTime = result.rows.length > 0 ? 
          result.rows.reduce((sum, row) => sum + (parseInt(row.first_occurrence) - startTime), 0) / result.rows.length : 0;

        funnelSteps.push({
          step: step.step,
          event: step.event,
          users,
          conversionRate,
          dropOffRate,
          averageTime: avgTime
        });

        previousStepUsers = stepUsers;
      }

      // Find bottleneck (step with highest drop-off rate)
      const bottleneck = funnelSteps.reduce((max, step, index) => 
        index > 0 && step.dropOffRate > max.dropOffRate ? step : max
      );

      return {
        funnelId,
        name: funnelDefinition.name,
        steps: funnelSteps,
        totalUsers,
        overallConversionRate: funnelSteps.length > 0 ? 
          (funnelSteps[funnelSteps.length - 1].users / totalUsers) * 100 : 0,
        bottleneck: bottleneck.step
      };
    } finally {
      client.release();
    }
  }

  async getCohortAnalysis(
    period: 'daily' | 'weekly' | 'monthly',
    startTime: number,
    endTime: number,
    filters: any = {}
  ): Promise<CohortAnalysis> {
    const client = await this.pool.connect();
    
    try {
      const cohortId = `cohort_${period}_${Date.now()}`;
      
      // This is a simplified cohort analysis
      // In a real implementation, you'd want to track user registration dates
      // and calculate retention based on their return visits
      
      const cohorts: CohortAnalysis['cohorts'] = [];
      
      // For now, return a basic structure
      return {
        cohortId,
        name: `${period.charAt(0).toUpperCase() + period.slice(1)} Cohort Analysis`,
        period,
        cohorts
      };
    } finally {
      client.release();
    }
  }

  async getUserJourney(
    userId: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): Promise<UsageEvent[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT * FROM usage_events 
        WHERE user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

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

      query += ` ORDER BY timestamp ASC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);
      
      return result.rows.map(row => this.mapRowToUsageEvent(row));
    } finally {
      client.release();
    }
  }

  async searchEvents(query: {
    event?: string;
    category?: string;
    userId?: string;
    sessionId?: string;
    startTime?: number;
    endTime?: number;
    properties?: Record<string, any>;
    limit?: number;
    offset?: number;
  }): Promise<{ events: UsageEvent[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (query.event) {
        whereConditions.push(`event = $${paramIndex}`);
        params.push(query.event);
        paramIndex++;
      }

      if (query.category) {
        whereConditions.push(`category = $${paramIndex}`);
        params.push(query.category);
        paramIndex++;
      }

      if (query.userId) {
        whereConditions.push(`user_id = $${paramIndex}`);
        params.push(query.userId);
        paramIndex++;
      }

      if (query.sessionId) {
        whereConditions.push(`session_id = $${paramIndex}`);
        params.push(query.sessionId);
        paramIndex++;
      }

      if (query.startTime) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        params.push(query.startTime);
        paramIndex++;
      }

      if (query.endTime) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        params.push(query.endTime);
        paramIndex++;
      }

      if (query.properties) {
        for (const [key, value] of Object.entries(query.properties)) {
          whereConditions.push(`properties->>'${key}' = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }

      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) FROM usage_events ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get events with pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const eventsQuery = `
        SELECT * FROM usage_events ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const eventsResult = await client.query(eventsQuery, [...params, limit, offset]);
      const events = eventsResult.rows.map(row => this.mapRowToUsageEvent(row));

      return { events, total };
    } finally {
      client.release();
    }
  }

  private mapRowToUsageEvent(row: any): UsageEvent {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      event: row.event,
      category: row.category,
      timestamp: parseInt(row.timestamp),
      duration: row.duration,
      properties: row.properties,
      context: row.context,
      metadata: row.metadata
    };
  }

  async destroy(): Promise<void> {
    await this.pool.end();
    logger.info('Usage storage connections closed');
  }
}