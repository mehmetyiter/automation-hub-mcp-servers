import { Pool } from 'pg';
import { Logger } from '../utils/logger';

export interface QueryPlan {
  queryName: string;
  originalQuery: string;
  optimizedQuery: string;
  executionPlan: any;
  estimatedCost: number;
  actualExecutionTime?: number;
  recommendations: string[];
}

export interface QueryStatistics {
  queryName: string;
  executionCount: number;
  avgExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  slowestExecution: number;
  lastExecuted: Date;
}

export class QueryOptimizer {
  private pool: Pool;
  private logger: Logger;
  private queryCache: Map<string, QueryPlan> = new Map();
  private queryStats: Map<string, QueryStatistics> = new Map();
  private slowQueryThreshold = 100; // ms

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
    this.startQueryMonitoring();
  }

  async optimizeUserCredentialQueries(): Promise<void> {
    this.logger.info('🔧 Optimizing user credential queries...');

    await this.optimizeQuery('getUserActiveCredentials', `
      SELECT 
        uc.id,
        uc.user_id,
        uc.provider,
        uc.encrypted_api_key,
        uc.encryption_version,
        uc.validation_status,
        uc.last_validated_at,
        uc.metadata
      FROM user_credentials uc
      WHERE uc.user_id = $1 
        AND uc.is_active = true
        AND uc.provider = $2
      ORDER BY uc.created_at DESC
      LIMIT 1
    `);

    await this.optimizeQuery('getCredentialsForValidation', `
      WITH credentials_to_validate AS (
        SELECT 
          id,
          user_id,
          provider,
          last_validated_at,
          validation_interval,
          ROW_NUMBER() OVER (PARTITION BY provider ORDER BY last_validated_at ASC) as rn
        FROM user_credentials
        WHERE is_active = true
          AND (last_validated_at + (validation_interval || ' seconds')::interval) < NOW()
      )
      SELECT * FROM credentials_to_validate 
      WHERE rn <= 10
    `);
  }

  async optimizeUsageQueries(): Promise<void> {
    this.logger.info('📊 Optimizing usage analytics queries...');

    await this.optimizeQuery('calculateUserCosts', `
      WITH daily_costs AS (
        SELECT 
          DATE(created_at) as usage_date,
          provider,
          model,
          SUM(estimated_cost) as daily_cost,
          COUNT(*) as request_count,
          SUM(input_tokens + output_tokens) as total_tokens
        FROM api_usage_events
        WHERE user_id = $1
          AND created_at >= $2
          AND created_at < $3
        GROUP BY DATE(created_at), provider, model
      )
      SELECT 
        usage_date,
        provider,
        model,
        daily_cost,
        request_count,
        total_tokens,
        SUM(daily_cost) OVER (ORDER BY usage_date) as cumulative_cost
      FROM daily_costs
      ORDER BY usage_date DESC, daily_cost DESC
    `);

    await this.optimizeQuery('compareProviderCosts', `
      WITH provider_metrics AS (
        SELECT 
          provider,
          COUNT(*) as total_requests,
          SUM(estimated_cost) as total_cost,
          AVG(estimated_cost) as avg_cost_per_request,
          AVG(execution_time) as avg_execution_time,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time) as median_execution_time,
          COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_count
        FROM api_usage_events
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY provider
      )
      SELECT 
        *,
        ROUND(100.0 * error_count / total_requests, 2) as error_rate,
        RANK() OVER (ORDER BY total_cost / total_requests ASC) as cost_efficiency_rank,
        RANK() OVER (ORDER BY median_execution_time ASC) as speed_rank
      FROM provider_metrics
      ORDER BY total_cost DESC
    `);
  }

  async optimizeBudgetQueries(): Promise<void> {
    this.logger.info('💰 Optimizing budget tracking queries...');

    await this.optimizeQuery('getBudgetCompliance', `
      WITH recent_usage AS (
        SELECT 
          COALESCE(provider, 'global') as provider,
          SUM(estimated_cost) as current_spend,
          COUNT(*) as request_count
        FROM api_usage_events
        WHERE user_id = $1
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY provider
      )
      SELECT 
        ub.id,
        ub.budget_type,
        ub.provider,
        ub.budget_amount,
        COALESCE(ru.current_spend, 0) as current_spend,
        COALESCE(ru.request_count, 0) as request_count,
        CASE 
          WHEN ub.budget_amount > 0 THEN 
            ROUND((COALESCE(ru.current_spend, 0) / ub.budget_amount) * 100, 2)
          ELSE 0
        END as utilization_percentage,
        ub.alert_thresholds,
        ub.auto_stop_at_limit,
        CASE 
          WHEN COALESCE(ru.current_spend, 0) >= ub.budget_amount * 0.95 THEN 'critical'
          WHEN COALESCE(ru.current_spend, 0) >= ub.budget_amount * 0.80 THEN 'warning'
          WHEN COALESCE(ru.current_spend, 0) >= ub.budget_amount * 0.50 THEN 'moderate'
          ELSE 'low'
        END as budget_status
      FROM user_budget_configs ub
      LEFT JOIN recent_usage ru ON ub.provider = ru.provider OR ub.provider IS NULL
      WHERE ub.user_id = $1 AND ub.is_active = true
      ORDER BY utilization_percentage DESC
    `);
  }

  private async optimizeQuery(queryName: string, query: string): Promise<QueryPlan> {
    this.logger.info(`🔍 Analyzing query: ${queryName}`);

    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const planResult = await this.pool.query(explainQuery, [
        'dummy-user-id',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      ].slice(0, query.split('$').length - 1));

      const executionPlan = planResult.rows[0]['QUERY PLAN'];
      const analysis = this.analyzePlan(executionPlan);
      const recommendations = this.generateRecommendations(analysis);
      const optimizedQuery = this.applyOptimizations(query, recommendations);

      const plan: QueryPlan = {
        queryName,
        originalQuery: query,
        optimizedQuery,
        executionPlan,
        estimatedCost: analysis.totalCost,
        recommendations
      };

      this.queryCache.set(queryName, plan);
      return plan;
    } catch (error) {
      this.logger.error(`Error analyzing query ${queryName}:`, error);
      return {
        queryName,
        originalQuery: query,
        optimizedQuery: query,
        executionPlan: null,
        estimatedCost: 0,
        recommendations: ['Analysis failed due to error']
      };
    }
  }

  private analyzePlan(plan: any): any {
    const analysis = {
      totalCost: 0,
      totalTime: 0,
      nodeTypes: [] as string[],
      indexes: [] as string[],
      scans: [] as any[],
      joins: [] as any[],
      sorts: [] as any[],
      issues: [] as string[]
    };

    const analyzePlanNode = (node: any) => {
      analysis.totalCost += node['Total Cost'] || 0;
      analysis.totalTime += node['Actual Total Time'] || 0;
      analysis.nodeTypes.push(node['Node Type']);

      if (node['Node Type'] === 'Seq Scan' && node['Actual Rows'] > 1000) {
        analysis.issues.push(`Sequential scan on ${node['Relation Name']} (${node['Actual Rows']} rows)`);
        analysis.scans.push(node);
      }

      if (node['Index Name']) {
        analysis.indexes.push(node['Index Name']);
      }

      if (node['Node Type'] === 'Sort' && node['Sort Space Used'] > 1000) {
        analysis.issues.push(`Large sort operation using ${node['Sort Space Used']}KB`);
        analysis.sorts.push(node);
      }

      if (node['Node Type'] === 'Hash Join' && node['Actual Rows'] > 10000) {
        analysis.joins.push(node);
      }

      if (node['Plans']) {
        node['Plans'].forEach(analyzePlanNode);
      }
    };

    analyzePlanNode(plan[0]['Plan']);
    return analysis;
  }

  private generateRecommendations(analysis: any): string[] {
    const recommendations: string[] = [];

    analysis.scans.forEach((scan: any) => {
      recommendations.push(
        `Consider adding index on ${scan['Relation Name']} for columns used in filter: ${scan['Filter'] || 'unknown'}`
      );
    });

    if (analysis.sorts.length > 0) {
      recommendations.push('Consider adding indexes to avoid sort operations');
    }

    if (analysis.joins.length > 0) {
      recommendations.push('Consider denormalizing frequently joined tables or using materialized views');
    }

    if (analysis.totalCost > 1000) {
      recommendations.push('Query has high cost, consider breaking into smaller queries or caching results');
    }

    return recommendations;
  }

  private applyOptimizations(query: string, recommendations: string[]): string {
    let optimizedQuery = query;

    if (recommendations.some(r => r.includes('materialized view'))) {
      optimizedQuery = `-- Consider using materialized view for this query\n${optimizedQuery}`;
    }

    if (recommendations.some(r => r.includes('index'))) {
      optimizedQuery = this.restructureForIndexUsage(optimizedQuery);
    }

    return optimizedQuery;
  }

  private restructureForIndexUsage(query: string): string {
    return query;
  }

  private startQueryMonitoring(): void {
    setInterval(async () => {
      await this.checkSlowQueries();
      await this.updateQueryStatistics();
    }, 60000);
  }

  private async checkSlowQueries(): Promise<void> {
    try {
      const slowQueries = await this.pool.query(`
        SELECT 
          query,
          calls,
          mean_exec_time,
          total_exec_time,
          stddev_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `, [this.slowQueryThreshold]);

      if (slowQueries.rows.length > 0) {
        this.logger.warn('⚠️ Slow queries detected:', slowQueries.rows);
        for (const slowQuery of slowQueries.rows) {
          await this.suggestOptimizationForSlowQuery(slowQuery);
        }
      }
    } catch (error) {
      this.logger.error('Error checking slow queries:', error);
    }
  }

  private async updateQueryStatistics(): Promise<void> {
    for (const [queryName, plan] of this.queryCache.entries()) {
      const stats = await this.getQueryExecutionStats(plan.originalQuery);
      this.queryStats.set(queryName, stats);
    }
  }

  private async getQueryExecutionStats(query: string): Promise<QueryStatistics> {
    return {
      queryName: 'unknown',
      executionCount: 0,
      avgExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      slowestExecution: 0,
      lastExecuted: new Date()
    };
  }

  private async suggestOptimizationForSlowQuery(slowQuery: any): Promise<void> {
    this.logger.info(`🐌 Analyzing slow query with mean execution time: ${slowQuery.mean_exec_time}ms`);
  }

  async generateOptimizationReport(): Promise<string> {
    const report = {
      timestamp: new Date(),
      totalQueries: this.queryCache.size,
      optimizedQueries: Array.from(this.queryCache.entries()).map(([name, plan]) => ({
        name,
        originalCost: plan.estimatedCost,
        recommendations: plan.recommendations
      })),
      slowQueries: Array.from(this.queryStats.entries())
        .filter(([_, stats]) => stats.avgExecutionTime > this.slowQueryThreshold)
        .map(([name, stats]) => ({ name, ...stats }))
    };

    return JSON.stringify(report, null, 2);
  }
}