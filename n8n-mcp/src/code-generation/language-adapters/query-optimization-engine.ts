import { AIService } from '../../ai-service.js';
import { 
  DatabaseSchema, 
  TableSchema, 
  IndexSuggestion, 
  OptimizedQuery 
} from './sql-adapter.js';

export interface QueryAnalysis {
  tables: string[];
  joins: JoinAnalysis[];
  whereConditions: WhereCondition[];
  subqueries: SubqueryAnalysis[];
  aggregations: AggregationAnalysis[];
  orderBy: OrderByAnalysis[];
  indexUsage: IndexUsageAnalysis[];
  estimatedRows: number;
  estimatedCost: number;
}

export interface JoinAnalysis {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  leftTable: string;
  rightTable: string;
  condition: string;
  estimatedSelectivity: number;
  hasIndex: boolean;
}

export interface WhereCondition {
  column: string;
  operator: string;
  value: any;
  selectivity: number;
  hasIndex: boolean;
  canUseIndex: boolean;
}

export interface SubqueryAnalysis {
  type: 'EXISTS' | 'IN' | 'SCALAR';
  canBeRewritten: boolean;
  rewriteSuggestion?: string;
  estimatedCost: number;
}

export interface AggregationAnalysis {
  functions: string[];
  groupByColumns: string[];
  canUseIndex: boolean;
  suggestedIndex?: string;
}

export interface OrderByAnalysis {
  columns: string[];
  directions: ('ASC' | 'DESC')[];
  canUseIndex: boolean;
  suggestedIndex?: string;
}

export interface IndexUsageAnalysis {
  indexName: string;
  isUsed: boolean;
  effectiveness: number; // 0-100
  suggestion?: string;
}

export interface OptimizationRule {
  name: string;
  description: string;
  check: (analysis: QueryAnalysis, schema: DatabaseSchema) => boolean;
  apply: (sql: string, analysis: QueryAnalysis, schema: DatabaseSchema) => string;
  estimatedImprovement: number;
}

export class QueryOptimizationEngine {
  private aiService: AIService;
  private optimizationRules: OptimizationRule[];

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.initializeOptimizationRules();
  }

  async optimizeQuery(
    sql: string,
    schema: DatabaseSchema,
    dialect: string
  ): Promise<OptimizedQuery> {
    console.log('🔧 Starting query optimization...');
    
    // Analyze the query
    const analysis = await this.analyzeQuery(sql, schema, dialect);
    
    // Apply optimization rules
    const optimizations = this.applyOptimizationRules(sql, analysis, schema);
    
    // Generate index suggestions
    const indexSuggestions = this.generateIndexSuggestions(analysis, schema);
    
    // Apply optimizations
    let optimizedSQL = sql;
    let totalImprovement = 0;
    
    for (const optimization of optimizations) {
      if (optimization.canApply) {
        optimizedSQL = optimization.apply(optimizedSQL, analysis, schema);
        totalImprovement += optimization.estimatedImprovement;
      }
    }
    
    // Generate warnings
    const warnings = this.generateOptimizationWarnings(analysis);
    
    // Get execution plan if supported
    const executionPlan = await this.getExecutionPlan(optimizedSQL, dialect);
    
    console.log(`✅ Query optimization completed. Estimated improvement: ${totalImprovement}%`);
    
    return {
      originalSQL: sql,
      optimizedSQL,
      estimatedImprovement: Math.min(totalImprovement, 90), // Cap at 90%
      indexSuggestions,
      warnings,
      executionPlan
    };
  }

  private async analyzeQuery(
    sql: string, 
    schema: DatabaseSchema, 
    dialect: string
  ): Promise<QueryAnalysis> {
    console.log('📊 Analyzing query structure...');
    
    // Use AI to analyze complex query patterns
    const aiAnalysisPrompt = `
Analyze this ${dialect} SQL query for optimization opportunities:

${sql}

Provide detailed analysis:
{
  "tables": ["list of tables"],
  "joins": [
    {
      "type": "join type",
      "leftTable": "table1",
      "rightTable": "table2",
      "condition": "join condition",
      "estimatedSelectivity": 0.1
    }
  ],
  "whereConditions": [
    {
      "column": "column name",
      "operator": "=, <, >, LIKE, etc",
      "selectivity": 0.1
    }
  ],
  "subqueries": [],
  "aggregations": {
    "functions": ["COUNT", "SUM", etc],
    "groupByColumns": ["columns"]
  },
  "orderBy": {
    "columns": ["columns"],
    "directions": ["ASC", "DESC"]
  },
  "estimatedRows": 1000,
  "estimatedCost": 100
}`;

    try {
      const aiAnalysis = await this.aiService.getJSONResponse(aiAnalysisPrompt);
      
      // Combine AI analysis with manual analysis
      const manualAnalysis = this.performManualAnalysis(sql, schema);
      
      return {
        ...aiAnalysis,
        indexUsage: manualAnalysis.indexUsage,
        // Validate and correct AI analysis with schema info
        tables: this.validateTables(aiAnalysis.tables || [], schema),
        joins: this.enrichJoinAnalysis(aiAnalysis.joins || [], schema),
        whereConditions: this.enrichWhereConditions(aiAnalysis.whereConditions || [], schema)
      };
      
    } catch (error) {
      console.warn('AI analysis failed, using manual analysis:', error);
      return this.performManualAnalysis(sql, schema);
    }
  }

  private performManualAnalysis(sql: string, schema: DatabaseSchema): QueryAnalysis {
    // Simple regex-based analysis as fallback
    const tables = this.extractTables(sql, schema);
    const joins = this.extractJoins(sql);
    const whereConditions = this.extractWhereConditions(sql, schema);
    
    return {
      tables,
      joins,
      whereConditions,
      subqueries: [],
      aggregations: [],
      orderBy: [],
      indexUsage: this.analyzeIndexUsage(sql, schema),
      estimatedRows: 1000,
      estimatedCost: 100
    };
  }

  private extractTables(sql: string, schema: DatabaseSchema): string[] {
    const fromMatches = sql.match(/FROM\s+([`\w\.]+)/gi) || [];
    const joinMatches = sql.match(/JOIN\s+([`\w\.]+)/gi) || [];
    
    const allMatches = [...fromMatches, ...joinMatches];
    const tables = allMatches
      .map(match => match.split(/\s+/)[1].replace(/[`"]/g, ''))
      .filter(table => schema.tables.has(table) || schema.views.has(table));
    
    return [...new Set(tables)];
  }

  private extractJoins(sql: string): JoinAnalysis[] {
    const joinRegex = /(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+([`\w\.]+)\s+ON\s+([^WHERE^GROUP^ORDER^HAVING]+)/gi;
    const joins: JoinAnalysis[] = [];
    let match;
    
    while ((match = joinRegex.exec(sql)) !== null) {
      joins.push({
        type: (match[1] || 'INNER') as any,
        leftTable: '',  // Would need more complex parsing
        rightTable: match[2].replace(/[`"]/g, ''),
        condition: match[3].trim(),
        estimatedSelectivity: 0.1,
        hasIndex: false // Would check against schema
      });
    }
    
    return joins;
  }

  private extractWhereConditions(sql: string, schema: DatabaseSchema): WhereCondition[] {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+HAVING|$)/i);
    if (!whereMatch) return [];
    
    const whereClause = whereMatch[1];
    const conditions: WhereCondition[] = [];
    
    // Simple pattern matching for common conditions
    const patterns = [
      /([`\w\.]+)\s*(=|<|>|<=|>=|<>|!=)\s*([^AND^OR]+)/g,
      /([`\w\.]+)\s+LIKE\s+([^AND^OR]+)/g,
      /([`\w\.]+)\s+IN\s*\([^)]+\)/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(whereClause)) !== null) {
        const column = match[1].replace(/[`"]/g, '');
        conditions.push({
          column,
          operator: match[2] || 'LIKE' || 'IN',
          value: match[3] || match[2],
          selectivity: 0.1,
          hasIndex: this.hasIndexOnColumn(column, schema),
          canUseIndex: true
        });
      }
    });
    
    return conditions;
  }

  private hasIndexOnColumn(column: string, schema: DatabaseSchema): boolean {
    // Check if any table has an index on this column
    for (const [_, table] of schema.tables) {
      if (table.indexes.some(index => index.columns.includes(column))) {
        return true;
      }
    }
    return false;
  }

  private analyzeIndexUsage(sql: string, schema: DatabaseSchema): IndexUsageAnalysis[] {
    const usage: IndexUsageAnalysis[] = [];
    
    // Analyze which indexes might be used
    schema.tables.forEach((table, tableName) => {
      table.indexes.forEach(index => {
        const isUsed = index.columns.some(col => 
          sql.toLowerCase().includes(col.toLowerCase())
        );
        
        usage.push({
          indexName: index.name,
          isUsed,
          effectiveness: isUsed ? 80 : 20,
          suggestion: !isUsed ? `Consider using index ${index.name} in WHERE clause` : undefined
        });
      });
    });
    
    return usage;
  }

  private validateTables(tables: string[], schema: DatabaseSchema): string[] {
    return tables.filter(table => 
      schema.tables.has(table) || schema.views.has(table)
    );
  }

  private enrichJoinAnalysis(joins: any[], schema: DatabaseSchema): JoinAnalysis[] {
    return joins.map(join => ({
      ...join,
      hasIndex: this.checkJoinIndex(join, schema)
    }));
  }

  private enrichWhereConditions(conditions: any[], schema: DatabaseSchema): WhereCondition[] {
    return conditions.map(condition => ({
      ...condition,
      hasIndex: this.hasIndexOnColumn(condition.column, schema),
      canUseIndex: this.canUseIndexForCondition(condition)
    }));
  }

  private checkJoinIndex(join: any, schema: DatabaseSchema): boolean {
    // Check if join condition can use indexes
    return true; // Simplified
  }

  private canUseIndexForCondition(condition: any): boolean {
    // Check if condition can benefit from index
    const indexFriendlyOperators = ['=', '<', '>', '<=', '>=', 'IN'];
    return indexFriendlyOperators.includes(condition.operator);
  }

  private initializeOptimizationRules(): void {
    this.optimizationRules = [
      {
        name: 'Rewrite EXISTS subqueries',
        description: 'Convert EXISTS subqueries to JOINs when possible',
        check: (analysis) => analysis.subqueries.some(sq => sq.type === 'EXISTS' && sq.canBeRewritten),
        apply: (sql) => this.rewriteExistsSubqueries(sql),
        estimatedImprovement: 25
      },
      {
        name: 'Optimize IN clauses',
        description: 'Convert IN subqueries to JOINs',
        check: (analysis) => analysis.subqueries.some(sq => sq.type === 'IN' && sq.canBeRewritten),
        apply: (sql) => this.optimizeInClauses(sql),
        estimatedImprovement: 20
      },
      {
        name: 'Add index hints',
        description: 'Add index hints for better performance',
        check: (analysis) => analysis.whereConditions.some(wc => wc.hasIndex && !wc.canUseIndex),
        apply: (sql, analysis, schema) => this.addIndexHints(sql, analysis, schema),
        estimatedImprovement: 15
      },
      {
        name: 'Optimize ORDER BY',
        description: 'Optimize ORDER BY clauses with indexes',
        check: (analysis) => analysis.orderBy.length > 0 && analysis.orderBy.some(ob => !ob.canUseIndex),
        apply: (sql, analysis, schema) => this.optimizeOrderBy(sql, analysis, schema),
        estimatedImprovement: 10
      }
    ];
  }

  private applyOptimizationRules(
    sql: string, 
    analysis: QueryAnalysis, 
    schema: DatabaseSchema
  ): Array<OptimizationRule & { canApply: boolean }> {
    return this.optimizationRules.map(rule => ({
      ...rule,
      canApply: rule.check(analysis, schema)
    }));
  }

  private rewriteExistsSubqueries(sql: string): string {
    // Simplified rewrite - in production, would use proper SQL parser
    return sql.replace(
      /EXISTS\s*\(\s*SELECT\s+[^)]+\)/gi,
      'INNER JOIN (SELECT DISTINCT ...) subq ON ...'
    );
  }

  private optimizeInClauses(sql: string): string {
    // Convert IN subqueries to JOINs
    return sql.replace(
      /IN\s*\(\s*SELECT\s+([^)]+)\)/gi,
      'EXISTS (SELECT 1 FROM $1)'
    );
  }

  private addIndexHints(sql: string, analysis: QueryAnalysis, schema: DatabaseSchema): string {
    // Add database-specific index hints
    let optimizedSQL = sql;
    
    analysis.whereConditions.forEach(condition => {
      if (condition.hasIndex) {
        // Add hint based on dialect
        optimizedSQL = optimizedSQL.replace(
          new RegExp(`\\b${condition.column}\\b`, 'g'),
          `${condition.column} /* INDEX */`
        );
      }
    });
    
    return optimizedSQL;
  }

  private optimizeOrderBy(sql: string, analysis: QueryAnalysis, schema: DatabaseSchema): string {
    // Suggest composite indexes for ORDER BY
    if (analysis.orderBy.length > 0 && analysis.orderBy[0].columns.length > 1) {
      const orderByColumns = analysis.orderBy[0].columns;
      const tableName = orderByColumns[0].split('.')[0];
      const indexSuggestion = `/* Consider adding index: CREATE INDEX idx_${orderByColumns.join('_').replace(/\./g, '_')} ON ${tableName}(${orderByColumns.map(c => c.split('.')[1] || c).join(', ')}) */`;
      return `${indexSuggestion}\n${sql}`;
    }
    
    return sql;
  }

  private generateIndexSuggestions(analysis: QueryAnalysis, schema: DatabaseSchema): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    
    // Suggest indexes for WHERE conditions
    analysis.whereConditions.forEach(condition => {
      if (!condition.hasIndex && condition.canUseIndex) {
        suggestions.push({
          table: analysis.tables[0] || 'unknown', // Simplified
          columns: [condition.column],
          type: 'btree',
          estimated_improvement: 30,
          sql: `CREATE INDEX idx_${condition.column} ON table_name(${condition.column})`
        });
      }
    });
    
    // Suggest composite indexes for multi-column conditions
    if (analysis.whereConditions.length > 1) {
      const columns = analysis.whereConditions
        .filter(c => c.canUseIndex)
        .map(c => c.column);
      
      if (columns.length > 1) {
        suggestions.push({
          table: analysis.tables[0] || 'unknown',
          columns,
          type: 'btree',
          estimated_improvement: 50,
          sql: `CREATE INDEX idx_${columns.join('_')} ON table_name(${columns.join(', ')})`
        });
      }
    }
    
    // Suggest indexes for JOIN conditions
    analysis.joins.forEach(join => {
      if (!join.hasIndex) {
        suggestions.push({
          table: join.rightTable,
          columns: [join.condition.split('=')[1]?.trim() || 'join_column'],
          type: 'btree',
          estimated_improvement: 40,
          sql: `CREATE INDEX idx_${join.rightTable}_join ON ${join.rightTable}(join_column)`
        });
      }
    });
    
    return suggestions;
  }

  private generateOptimizationWarnings(analysis: QueryAnalysis): string[] {
    const warnings: string[] = [];
    
    if (analysis.estimatedRows > 100000) {
      warnings.push('Query may return a large number of rows. Consider adding LIMIT clause.');
    }
    
    if (analysis.joins.length > 3) {
      warnings.push('Query has many JOINs. Consider denormalization or query splitting.');
    }
    
    if (analysis.subqueries.length > 2) {
      warnings.push('Query has multiple subqueries. Consider rewriting as JOINs.');
    }
    
    const unindexedConditions = analysis.whereConditions.filter(c => !c.hasIndex);
    if (unindexedConditions.length > 0) {
      warnings.push(`Consider adding indexes for columns: ${unindexedConditions.map(c => c.column).join(', ')}`);
    }
    
    return warnings;
  }

  private async getExecutionPlan(sql: string, dialect: string): Promise<string | undefined> {
    try {
      // Generate execution plan based on dialect
      const planSQL = this.getExplainSQL(sql, dialect);
      return `Execution plan for: ${planSQL}`;
    } catch (error) {
      console.warn('Could not generate execution plan:', error);
      return undefined;
    }
  }

  private getExplainSQL(sql: string, dialect: string): string {
    switch (dialect.toLowerCase()) {
      case 'postgresql':
        return `EXPLAIN (ANALYZE, BUFFERS) ${sql}`;
      case 'mysql':
        return `EXPLAIN FORMAT=JSON ${sql}`;
      case 'mssql':
        return `SET SHOWPLAN_ALL ON; ${sql}`;
      case 'oracle':
        return `EXPLAIN PLAN FOR ${sql}`;
      default:
        return `EXPLAIN ${sql}`;
    }
  }
}