import { CodeGenerationRequest, CodeContext } from '../types';
import { AIService } from '../../ai-service';
import { 
  LanguageAdapterError, 
  ValidationError,
  SecurityError 
} from '../errors/custom-errors';
import * as crypto from 'crypto';
import { SQLQueryParams, SQLDialectInfo } from '../types/common-types';

export interface SQLCodeGenerationOptions {
  dialect?: 'mysql' | 'postgresql' | 'sqlite' | 'mssql' | 'oracle';
  includeTransactions?: boolean;
  includeErrorHandling?: boolean;
  outputFormat?: 'json' | 'table' | 'csv';
  performanceOptimized?: boolean;
  validateSchema?: boolean;
  autoComplete?: boolean;
  connectionId?: string;
}

export interface DatabaseSchema {
  tables: Map<string, TableSchema>;
  views: Map<string, ViewSchema>;
  functions: Map<string, FunctionSchema>;
  indexes: Map<string, IndexSchema>;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  constraints: ConstraintSchema[];
  primaryKey?: string[];
  foreignKeys: ForeignKeySchema[];
}

export interface ViewSchema {
  name: string;
  columns: ColumnSchema[];
  definition: string;
}

export interface FunctionSchema {
  name: string;
  parameters: ParameterSchema[];
  returnType: string;
  description?: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
  isAutoIncrement?: boolean;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  tableName: string;
}

export interface ConstraintSchema {
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'NOT_NULL' | 'PRIMARY_KEY' | 'FOREIGN_KEY';
  columns: string[];
  definition?: string;
}

export interface ForeignKeySchema {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'CASCADE' | 'SET_NULL' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET_NULL' | 'RESTRICT';
}

export interface ParameterSchema {
  name: string;
  type: string;
  isRequired: boolean;
  defaultValue?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: SchemaSuggestion[];
}

export interface ValidationError {
  type: 'SYNTAX' | 'SCHEMA' | 'SECURITY' | 'PERFORMANCE';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'PERFORMANCE' | 'DEPRECATED' | 'STYLE';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface SchemaSuggestion {
  type: 'TABLE' | 'COLUMN' | 'FUNCTION' | 'INDEX';
  name: string;
  description: string;
  score: number; // relevance score 0-100
}

export interface AutoCompleteResult {
  suggestions: AutoCompleteSuggestion[];
  context: 'TABLE' | 'COLUMN' | 'FUNCTION' | 'KEYWORD' | 'VALUE';
}

export interface AutoCompleteSuggestion {
  text: string;
  displayText: string;
  type: 'table' | 'column' | 'function' | 'keyword' | 'value';
  score: number;
  description?: string;
  insertText?: string;
}

export class SQLCodeAdapter {
  private aiService: AIService;
  private dialectPatterns: Map<string, SQLDialectInfo>;
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }>;
  private queryPlanCache: Map<string, string>;
  private schemaCache: Map<string, DatabaseSchema>;
  private readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private cacheHitCount = 0;
  private cacheMissCount = 0;
  private readonly SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
    'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW',
    'INDEX', 'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'KEY', 'UNIQUE', 'NOT', 'NULL',
    'DEFAULT', 'CHECK', 'REFERENCES', 'ON', 'CASCADE', 'SET', 'RESTRICT',
    'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'EXCEPT',
    'INTERSECT', 'DISTINCT', 'ALL', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'IF', 'EXISTS', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'IS', 'AND', 'OR', 'NOT'
  ];

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.initializeDialectPatterns();
    this.queryCache = new Map();
    this.queryPlanCache = new Map();
    this.schemaCache = new Map();
    this.startCacheCleanup();
  }

  private sanitizeIdentifier(identifier: string): string {
    // SQL identifier sanitization - only allow alphanumeric, underscore, and dot (for schema.table)
    return identifier.replace(/[^a-zA-Z0-9_\.]/g, '');
  }

  private validateParameters(params: SQLQueryParams): boolean {
    // Validate that all parameters are safe types
    if (!params || typeof params !== 'object') {
      return false;
    }
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && 
          value !== undefined && 
          typeof value !== 'string' && 
          typeof value !== 'number' && 
          typeof value !== 'boolean' && 
          !(value instanceof Date)) {
        throw new ValidationError(
          `Invalid parameter type for '${key}'`,
          { field: key, value, rule: 'type' }
        );
      }
    }
    
    return true;
  }

  private escapeStringValue(value: string): string {
    // Escape single quotes in string values
    return value.replace(/'/g, "''");
  }

  private initializeDialectPatterns() {
    this.dialectPatterns = new Map([
      ['mysql', {
        jsonExtract: 'JSON_EXTRACT',
        jsonArray: 'JSON_ARRAY',
        stringAgg: 'GROUP_CONCAT',
        limitSyntax: 'LIMIT',
        dateFormat: 'DATE_FORMAT'
      }],
      ['postgresql', {
        jsonExtract: '->',
        jsonArray: 'json_agg',
        stringAgg: 'string_agg',
        limitSyntax: 'LIMIT',
        dateFormat: 'TO_CHAR'
      }],
      ['sqlite', {
        jsonExtract: 'json_extract',
        jsonArray: 'json_array',
        stringAgg: 'group_concat',
        limitSyntax: 'LIMIT',
        dateFormat: 'strftime'
      }],
      ['mssql', {
        jsonExtract: 'JSON_VALUE',
        jsonArray: 'FOR JSON PATH',
        stringAgg: 'STRING_AGG',
        limitSyntax: 'TOP',
        dateFormat: 'FORMAT'
      }],
      ['oracle', {
        jsonExtract: 'JSON_VALUE',
        jsonArray: 'JSON_ARRAYAGG',
        stringAgg: 'LISTAGG',
        limitSyntax: 'FETCH FIRST',
        dateFormat: 'TO_CHAR'
      }]
    ]);
  }

  async generateSQLCode(
    request: CodeGenerationRequest,
    context: CodeContext,
    options?: SQLCodeGenerationOptions
  ): Promise<string> {
    const dialect = options?.dialect || 'postgresql';
    const includeTransactions = options?.includeTransactions ?? true;
    const includeErrorHandling = options?.includeErrorHandling ?? true;
    const outputFormat = options?.outputFormat || 'json';
    
    const prompt = this.buildSQLPrompt(request, context, dialect, options);
    const generatedSQL = await this.aiService.callAI(prompt);
    
    // Clean and format the SQL
    let cleanSQL = this.cleanSQL(generatedSQL);
    
    // Wrap in n8n compatible structure
    return this.wrapForN8n(cleanSQL, dialect, outputFormat, includeErrorHandling);
  }

  private buildSQLPrompt(
    request: CodeGenerationRequest,
    context: CodeContext,
    dialect: string,
    options?: SQLCodeGenerationOptions
  ): string {
    const dialectInfo = this.dialectPatterns.get(dialect) || this.dialectPatterns.get('postgresql')!;
    
    return `
Generate ${dialect.toUpperCase()} SQL code for n8n workflow automation.

Task: ${request.description}

Requirements:
- SQL Dialect: ${dialect}
- Include Transactions: ${options?.includeTransactions}
- Performance Optimized: ${options?.performanceOptimized}
- Output Format: ${options?.outputFormat}

Context:
${JSON.stringify(context.intent, null, 2)}

Dialect-specific functions:
- JSON extraction: ${dialectInfo.jsonExtract}
- JSON aggregation: ${dialectInfo.jsonArray}
- String aggregation: ${dialectInfo.stringAgg}
- Limit syntax: ${dialectInfo.limitSyntax}
- Date formatting: ${dialectInfo.dateFormat}

Generate SQL that:
1. Handles the business logic efficiently
2. Includes proper error handling
3. Returns results in ${options?.outputFormat} format
4. Follows ${dialect} best practices
5. Includes comments explaining complex logic
6. Handles NULL values appropriately
7. Uses parameterized queries for security

The SQL should work within n8n's database node context.`;
  }

  private cleanSQL(sql: string): string {
    // Remove markdown code blocks
    sql = sql.replace(/```sql\n?/gi, '');
    sql = sql.replace(/```\n?/g, '');
    
    // Clean up extra whitespace
    sql = sql.trim();
    
    // Ensure semicolons at statement ends
    if (!sql.endsWith(';')) {
      sql += ';';
    }
    
    return sql;
  }

  private wrapForN8n(
    sql: string,
    dialect: string,
    outputFormat: string,
    includeErrorHandling: boolean
  ): string {
    const template = `// SQL Query for n8n Database Node
// Dialect: ${dialect}
// Output Format: ${outputFormat}

// Get input parameters from previous nodes
const inputItems = $input.all();
const parameters = {};

// Validation function for SQL parameters
function validateSQLParameters(params) {
  const validTypes = ['string', 'number', 'boolean'];
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && !validTypes.includes(typeof value)) {
      throw new ValidationError(
        \`Invalid parameter type for '\${key}': \${typeof value}\`,
        { field: key, value, rule: 'type' }
      );
    }
    
    // Additional validation for strings to prevent SQL injection
    if (typeof value === 'string' && value.includes("'") && value.includes('"')) {
      console.warn(\`Parameter '\${key}' contains quotes, ensure proper parameterization\`);
    }
  }
  
  return true;
}

// Extract and validate parameters from input
if (inputItems.length > 0) {
  const firstItem = inputItems[0].json;
  
  // Map input fields to query parameters
  Object.keys(firstItem).forEach(key => {
    // Sanitize parameter names
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    parameters[sanitizedKey] = firstItem[key];
  });
  
  // Validate parameters
  validateSQLParameters(parameters);
}

// Main SQL query
const query = \`${sql}\`;

// Prepare query configuration
const queryConfig = {
  query: query,
  additionalFields: {
    queryParams: parameters
  }
};

${includeErrorHandling ? `
// Error handling wrapper
try {
  // Return configuration for n8n Database node
  return {
    json: queryConfig,
    query: query,
    parameters: parameters
  };
} catch (error) {
  console.error('SQL generation error:', error);
  return {
    json: {
      error: error.message,
      query: query,
      parameters: parameters
    }
  };
}` : `
// Return configuration for n8n Database node
return {
  json: queryConfig,
  query: query,
  parameters: parameters
};`}`;

    return template;
  }

  generateSQLFallbackCode(request: CodeGenerationRequest, dialect: string = 'postgresql'): string {
    const description = request.description.toLowerCase();
    let sql = '';
    
    if (description.includes('select') || description.includes('fetch') || description.includes('get')) {
      sql = this.generateSelectQuery(dialect);
    } else if (description.includes('insert') || description.includes('create')) {
      sql = this.generateInsertQuery(dialect);
    } else if (description.includes('update')) {
      sql = this.generateUpdateQuery(dialect);
    } else if (description.includes('delete')) {
      sql = this.generateDeleteQuery(dialect);
    } else if (description.includes('aggregate') || description.includes('sum') || description.includes('count')) {
      sql = this.generateAggregateQuery(dialect);
    } else {
      sql = this.generateGenericQuery(dialect);
    }
    
    return this.wrapForN8n(sql, dialect, 'json', true);
  }

  private generateSelectQuery(dialect: string): string {
    return `-- Select query template
SELECT 
  id,
  name,
  email,
  created_at,
  status
FROM users
WHERE status = :status
  AND created_at >= :start_date
ORDER BY created_at DESC
${dialect === 'mssql' ? 'OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY' : 'LIMIT 100'}`;
  }

  private generateInsertQuery(dialect: string): string {
    const returning = dialect === 'postgresql' ? 'RETURNING id, created_at' : '';
    return `-- Insert query template
INSERT INTO users (name, email, status, created_at)
VALUES (:name, :email, :status, CURRENT_TIMESTAMP)
${returning}`;
  }

  private generateUpdateQuery(dialect: string): string {
    const returning = dialect === 'postgresql' ? 'RETURNING id, updated_at' : '';
    return `-- Update query template
UPDATE users
SET 
  name = :name,
  email = :email,
  status = :status,
  updated_at = CURRENT_TIMESTAMP
WHERE id = :id
${returning}`;
  }

  private generateDeleteQuery(dialect: string): string {
    const returning = dialect === 'postgresql' ? 'RETURNING id' : '';
    return `-- Delete query template
DELETE FROM users
WHERE id = :id
  AND status = 'inactive'
${returning}`;
  }

  private generateAggregateQuery(dialect: string): string {
    const dialectInfo = this.dialectPatterns.get(dialect) || this.dialectPatterns.get('postgresql')!;
    
    return `-- Aggregation query template
SELECT 
  status,
  COUNT(*) as count,
  ${dialectInfo.stringAgg}(name, ', ') as names,
  AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))) as avg_age_seconds
FROM users
WHERE created_at >= :start_date
GROUP BY status
HAVING COUNT(*) > 0
ORDER BY count DESC`;
  }

  private generateGenericQuery(dialect: string): string {
    return `-- Generic query template
-- Modify this query based on your needs
SELECT *
FROM your_table
WHERE your_condition = :parameter
ORDER BY id DESC`;
  }

  async validateSQLSyntax(
    sql: string, 
    dialect: string,
    connectionId?: string
  ): Promise<ValidationResult> {
    const validationPrompt = `
Validate this ${dialect} SQL syntax:

${sql}

Check for:
1. Syntax errors
2. Security issues (SQL injection vulnerabilities)
3. Performance concerns
4. Best practice violations

Return validation result:
{
  "isValid": true/false,
  "errors": ["list of syntax errors"],
  "warnings": ["list of warnings and suggestions"]
}`;

    try {
      const result = await this.aiService.getJSONResponse(validationPrompt);
      
      // Also perform schema validation if connection provided
      if (connectionId) {
        const schemaValidation = await this.validateQueryAgainstSchema(sql, connectionId, dialect);
        
        // Merge results
        return {
          isValid: result.isValid && schemaValidation.isValid,
          errors: [
            ...(result.errors || []).map((msg: string) => ({ type: 'SYNTAX' as const, message: msg })),
            ...schemaValidation.errors
          ],
          warnings: [
            ...(result.warnings || []).map((msg: string) => ({ type: 'STYLE' as const, message: msg })),
            ...schemaValidation.warnings
          ],
          suggestions: schemaValidation.suggestions
        };
      }
      
      // Convert legacy format to new format
      return {
        isValid: result.isValid,
        errors: (result.errors || []).map((msg: string) => ({ type: 'SYNTAX' as const, message: msg })),
        warnings: (result.warnings || []).map((msg: string) => ({ type: 'STYLE' as const, message: msg })),
        suggestions: []
      };
    } catch (error) {
      throw new LanguageAdapterError(
        'SQL validation failed',
        'sql',
        { 
          originalError: error,
          context: { 
            sql,
            dialect,
            validationPrompt: validationPrompt.substring(0, 200) + '...' 
          },
          timestamp: new Date().toISOString()
        }
      );
    }
  }

  optimizeSQL(sql: string, dialect: string): string {
    // Basic SQL optimizations
    const optimizations = [
      // Add index hints for common patterns
      { pattern: /WHERE\s+(\w+)\s*=\s*:/gi, replacement: 'WHERE $1 = :' },
      
      // Convert SELECT * to specific columns (would need schema info in real implementation)
      { pattern: /SELECT\s+\*\s+FROM/gi, replacement: 'SELECT /* specify columns */ * FROM' },
      
      // Add NOLOCK hint for SQL Server read queries
      ...(dialect === 'mssql' ? [
        { pattern: /FROM\s+(\w+)\s+WHERE/gi, replacement: 'FROM $1 WITH (NOLOCK) WHERE' }
      ] : []),
      
      // Use EXISTS instead of IN for better performance
      { pattern: /WHERE\s+\w+\s+IN\s*\(\s*SELECT/gi, replacement: 'WHERE EXISTS (SELECT 1' }
    ];
    
    let optimizedSQL = sql;
    optimizations.forEach(({ pattern, replacement }) => {
      optimizedSQL = optimizedSQL.replace(pattern, replacement);
    });
    
    return optimizedSQL;
  }

  private startCacheCleanup(): void {
    // Run cache cleanup every minute
    setInterval(() => {
      this.cleanExpiredCache();
    }, 60000);
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, cached] of this.queryCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.queryCache.delete(key);
        this.queryPlanCache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Removed ${removed} expired cache entries`);
    }

    // Also clean if cache is too large
    if (this.queryCache.size > this.MAX_CACHE_SIZE) {
      const entriesToRemove = this.queryCache.size - this.MAX_CACHE_SIZE;
      const entries = Array.from(this.queryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < entriesToRemove; i++) {
        this.queryCache.delete(entries[i][0]);
        this.queryPlanCache.delete(entries[i][0]);
      }
      
      console.log(`🧹 Removed ${entriesToRemove} oldest cache entries (LRU)`);
    }
  }

  async executeWithCache(
    sql: string,
    params: SQLQueryParams,
    options?: {
      cacheTtl?: number;
      useCache?: boolean;
      cacheKey?: string;
    }
  ): Promise<any> {
    // Validate parameters first
    this.validateParameters(params);
    
    const cacheKey = options?.cacheKey || this.generateCacheKey(sql, params);
    const useCache = options?.useCache !== false;
    
    // Check cache first
    if (useCache && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cached.ttl) {
        this.cacheHitCount++;
        console.log(`🎯 Query cache hit (${this.getCacheHitRate()}% hit rate): ${cacheKey}`);
        return cached.result;
      }
    }
    
    this.cacheMissCount++;
    
    // Execute query (this would be the actual database execution in production)
    const result = await this.executeQuery(sql, params);
    
    // Cache successful results
    if (useCache && result.success) {
      const ttl = options?.cacheTtl || this.DEFAULT_CACHE_TTL;
      this.queryCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        ttl
      });
      
      // Also cache query plan if available
      if (result.queryPlan) {
        this.queryPlanCache.set(cacheKey, result.queryPlan);
      }
    }
    
    return result;
  }

  private generateCacheKey(sql: string, params: SQLQueryParams): string {
    const crypto = require('crypto');
    const normalizedSQL = sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    
    return crypto
      .createHash('md5')
      .update(normalizedSQL + paramString)
      .digest('hex');
  }

  private async executeQuery(sql: string, params: SQLQueryParams): Promise<any> {
    // This is a placeholder for actual query execution
    // In production, this would execute against a real database
    console.log('🔄 Executing SQL query:', sql.substring(0, 50) + '...');
    
    return {
      success: true,
      data: [],
      rowCount: 0,
      queryPlan: `EXPLAIN ${sql}`,
      executionTime: Math.random() * 100
    };
  }

  private getCacheHitRate(): string {
    const total = this.cacheHitCount + this.cacheMissCount;
    if (total === 0) return '0';
    return ((this.cacheHitCount / total) * 100).toFixed(1);
  }

  getCacheStats(): {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
    queryPlansCached: number;
  } {
    const total = this.cacheHitCount + this.cacheMissCount;
    return {
      size: this.queryCache.size,
      hitRate: total > 0 ? (this.cacheHitCount / total) * 100 : 0,
      hits: this.cacheHitCount,
      misses: this.cacheMissCount,
      queryPlansCached: this.queryPlanCache.size
    };
  }

  clearCache(): void {
    this.queryCache.clear();
    this.queryPlanCache.clear();
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
    console.log('🗑️ Query cache cleared');
  }

  invalidateCachePattern(pattern: string | RegExp): number {
    let invalidated = 0;
    
    for (const [key, cached] of this.queryCache.entries()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.queryCache.delete(key);
        this.queryPlanCache.delete(key);
        invalidated++;
      }
    }
    
    if (invalidated > 0) {
      console.log(`🗑️ Invalidated ${invalidated} cache entries matching pattern`);
    }
    
    return invalidated;
  }

  async loadDatabaseSchema(
    connectionId: string,
    dialect: string
  ): Promise<DatabaseSchema> {
    // Check cache first
    if (this.schemaCache.has(connectionId)) {
      return this.schemaCache.get(connectionId)!;
    }

    console.log(`📊 Loading database schema for connection: ${connectionId}`);
    
    // In production, this would connect to the actual database
    // For now, we'll create a mock schema
    const schema = await this.generateMockSchema(dialect);
    
    // Cache the schema
    this.schemaCache.set(connectionId, schema);
    
    return schema;
  }

  private async generateMockSchema(dialect: string): Promise<DatabaseSchema> {
    // Mock database schema for demonstration
    const tables = new Map<string, TableSchema>();
    const views = new Map<string, ViewSchema>();
    const functions = new Map<string, FunctionSchema>();
    const indexes = new Map<string, IndexSchema>();

    // Users table
    tables.set('users', {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isAutoIncrement: true },
        { name: 'email', type: 'VARCHAR', nullable: false, maxLength: 255 },
        { name: 'name', type: 'VARCHAR', nullable: true, maxLength: 100 },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false },
        { name: 'status', type: 'VARCHAR', nullable: false, maxLength: 20 }
      ],
      indexes: [
        { name: 'users_pkey', columns: ['id'], isUnique: true, isPrimary: true, tableName: 'users' },
        { name: 'users_email_idx', columns: ['email'], isUnique: true, isPrimary: false, tableName: 'users' }
      ],
      constraints: [
        { name: 'users_status_check', type: 'CHECK', columns: ['status'], definition: "status IN ('active', 'inactive', 'pending')" }
      ],
      primaryKey: ['id'],
      foreignKeys: []
    });

    // Orders table
    tables.set('orders', {
      name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isAutoIncrement: true },
        { name: 'user_id', type: 'INTEGER', nullable: false },
        { name: 'total', type: 'DECIMAL', nullable: false, precision: 10, scale: 2 },
        { name: 'status', type: 'VARCHAR', nullable: false, maxLength: 20 },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false }
      ],
      indexes: [
        { name: 'orders_pkey', columns: ['id'], isUnique: true, isPrimary: true, tableName: 'orders' },
        { name: 'orders_user_id_idx', columns: ['user_id'], isUnique: false, isPrimary: false, tableName: 'orders' }
      ],
      constraints: [],
      primaryKey: ['id'],
      foreignKeys: [
        { name: 'orders_user_id_fkey', column: 'user_id', referencedTable: 'users', referencedColumn: 'id', onDelete: 'CASCADE' }
      ]
    });

    // User summary view
    views.set('user_summary', {
      name: 'user_summary',
      columns: [
        { name: 'user_id', type: 'INTEGER', nullable: false },
        { name: 'email', type: 'VARCHAR', nullable: false, maxLength: 255 },
        { name: 'total_orders', type: 'BIGINT', nullable: false },
        { name: 'total_spent', type: 'DECIMAL', nullable: true, precision: 10, scale: 2 }
      ],
      definition: 'SELECT u.id as user_id, u.email, COUNT(o.id) as total_orders, SUM(o.total) as total_spent FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.email'
    });

    // Common functions by dialect
    if (dialect === 'postgresql') {
      functions.set('generate_series', {
        name: 'generate_series',
        parameters: [
          { name: 'start', type: 'INTEGER', isRequired: true },
          { name: 'stop', type: 'INTEGER', isRequired: true },
          { name: 'step', type: 'INTEGER', isRequired: false, defaultValue: 1 }
        ],
        returnType: 'SETOF INTEGER',
        description: 'Generate a series of integers'
      });
    } else if (dialect === 'mysql') {
      functions.set('NOW', {
        name: 'NOW',
        parameters: [],
        returnType: 'DATETIME',
        description: 'Returns current date and time'
      });
    }

    return { tables, views, functions, indexes };
  }

  async validateQueryAgainstSchema(
    sql: string,
    connectionId: string,
    dialect: string
  ): Promise<ValidationResult> {
    const schema = await this.loadDatabaseSchema(connectionId, dialect);
    const parsedQuery = await this.parseSQL(sql, dialect);
    
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Validate table existence
    parsedQuery.tables?.forEach(tableName => {
      if (!schema.tables.has(tableName) && !schema.views.has(tableName)) {
        validation.errors.push({
          type: 'SCHEMA',
          message: `Table or view '${tableName}' does not exist`,
          suggestion: this.suggestSimilarTable(tableName, schema)
        });
        validation.isValid = false;
      }
    });

    // Validate column existence
    parsedQuery.columns?.forEach(({ table, column }) => {
      const tableSchema = schema.tables.get(table) || schema.views.get(table);
      if (tableSchema && !tableSchema.columns.find(c => c.name === column)) {
        validation.errors.push({
          type: 'SCHEMA',
          message: `Column '${column}' does not exist in table '${table}'`,
          suggestion: this.suggestSimilarColumn(column, tableSchema)
        });
        validation.isValid = false;
      }
    });

    // Performance warnings
    if (parsedQuery.hasWildcardSelect) {
      validation.warnings.push({
        type: 'PERFORMANCE',
        message: 'Avoid SELECT * for better performance',
        suggestion: 'Specify only the columns you need'
      });
    }

    if (parsedQuery.missingIndexHints?.length > 0) {
      parsedQuery.missingIndexHints.forEach(hint => {
        validation.warnings.push({
          type: 'PERFORMANCE',
          message: `Consider adding an index on ${hint}`,
          suggestion: `CREATE INDEX idx_${hint.replace('.', '_')} ON ${hint}`
        });
      });
    }

    // Generate schema suggestions
    validation.suggestions = this.generateSchemaSuggestions(parsedQuery, schema);

    return validation;
  }

  private async parseSQL(sql: string, dialect: string): Promise<{
    tables: string[];
    columns: Array<{ table: string; column: string }>;
    hasWildcardSelect: boolean;
    missingIndexHints: string[];
  }> {
    // Simple regex-based parsing (in production, use a proper SQL parser)
    const tables: string[] = [];
    const columns: Array<{ table: string; column: string }> = [];
    
    // Extract table names from FROM and JOIN clauses
    const fromMatches = sql.match(/FROM\s+([\w\.]+)/gi);
    const joinMatches = sql.match(/JOIN\s+([\w\.]+)/gi);
    
    [...(fromMatches || []), ...(joinMatches || [])].forEach(match => {
      const tableName = match.split(/\s+/)[1];
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    });

    // Check for wildcard selects
    const hasWildcardSelect = /SELECT\s+\*/i.test(sql);

    // Extract WHERE conditions that might benefit from indexes
    const whereMatches = sql.match(/WHERE\s+([\w\.]+)\s*[=<>]/gi);
    const missingIndexHints = (whereMatches || [])
      .map(match => match.match(/WHERE\s+([\w\.]+)/i)?.[1])
      .filter(Boolean) as string[];

    return { tables, columns, hasWildcardSelect, missingIndexHints };
  }

  private suggestSimilarTable(tableName: string, schema: DatabaseSchema): string {
    const allTables = [...schema.tables.keys(), ...schema.views.keys()];
    const similar = allTables.find(name => 
      this.calculateSimilarity(tableName.toLowerCase(), name.toLowerCase()) > 0.6
    );
    return similar ? `Did you mean '${similar}'?` : 'Check available tables in your database';
  }

  private suggestSimilarColumn(columnName: string, tableSchema: TableSchema | ViewSchema): string {
    const similar = tableSchema.columns.find(col => 
      this.calculateSimilarity(columnName.toLowerCase(), col.name.toLowerCase()) > 0.6
    );
    return similar ? `Did you mean '${similar.name}'?` : `Available columns: ${tableSchema.columns.map(c => c.name).join(', ')}`;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private generateSchemaSuggestions(
    parsedQuery: any,
    schema: DatabaseSchema
  ): SchemaSuggestion[] {
    const suggestions: SchemaSuggestion[] = [];

    // Suggest relevant tables based on query context
    if (parsedQuery.tables.length === 0) {
      schema.tables.forEach((table, name) => {
        suggestions.push({
          type: 'TABLE',
          name,
          description: `Table with ${table.columns.length} columns`,
          score: 70
        });
      });
    }

    return suggestions.sort((a, b) => b.score - a.score);
  }

  async getAutoCompleteSuggestions(
    sql: string,
    cursorPosition: number,
    connectionId: string,
    dialect: string
  ): Promise<AutoCompleteResult> {
    const schema = await this.loadDatabaseSchema(connectionId, dialect);
    const beforeCursor = sql.substring(0, cursorPosition).toLowerCase();
    const afterCursor = sql.substring(cursorPosition);
    
    // Determine context
    let context: AutoCompleteResult['context'] = 'KEYWORD';
    if (/\bfrom\s+\w*$/i.test(beforeCursor)) {
      context = 'TABLE';
    } else if (/\bselect\s+[\w\s,]*\w*$/i.test(beforeCursor)) {
      context = 'COLUMN';
    } else if (/\b\w+\s*\(\s*\w*$/i.test(beforeCursor)) {
      context = 'FUNCTION';
    }

    const suggestions: AutoCompleteSuggestion[] = [];

    // Generate suggestions based on context
    switch (context) {
      case 'TABLE':
        schema.tables.forEach((table, name) => {
          suggestions.push({
            text: name,
            displayText: `${name} (table)`,
            type: 'table',
            score: 90,
            description: `Table with ${table.columns.length} columns`
          });
        });
        schema.views.forEach((view, name) => {
          suggestions.push({
            text: name,
            displayText: `${name} (view)`,
            type: 'table',
            score: 85,
            description: 'Database view'
          });
        });
        break;

      case 'COLUMN':
        // Extract table context for better column suggestions
        const tableMatch = beforeCursor.match(/from\s+([\w\.]+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const table = schema.tables.get(tableName) || schema.views.get(tableName);
          if (table) {
            table.columns.forEach(column => {
              suggestions.push({
                text: column.name,
                displayText: `${column.name} (${column.type})`,
                type: 'column',
                score: 95,
                description: `${column.type}${column.nullable ? ' nullable' : ' not null'}`
              });
            });
          }
        }
        break;

      case 'FUNCTION':
        schema.functions.forEach((func, name) => {
          const params = func.parameters.map(p => p.name).join(', ');
          suggestions.push({
            text: name,
            displayText: `${name}(${params})`,
            type: 'function',
            score: 80,
            description: func.description || `Returns ${func.returnType}`,
            insertText: `${name}(${func.parameters.map(p => `\${${p.name}}`).join(', ')})`
          });
        });
        break;

      case 'KEYWORD':
      default:
        this.SQL_KEYWORDS.forEach(keyword => {
          suggestions.push({
            text: keyword,
            displayText: keyword,
            type: 'keyword',
            score: 50
          });
        });
        break;
    }

    return {
      suggestions: suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 20), // Limit to top 20 suggestions
      context
    };
  }

  getSchemaInfo(connectionId: string): DatabaseSchema | null {
    return this.schemaCache.get(connectionId) || null;
  }

  refreshSchema(connectionId: string): void {
    this.schemaCache.delete(connectionId);
    console.log(`🔄 Schema cache cleared for connection: ${connectionId}`);
  }
}

// Fluent Query Builder Implementation
export class SQLQueryBuilder {
  private query: {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    tables: string[];
    columns: string[];
    values: Record<string, any>[];
    conditions: string[];
    joins: Array<{ type: string; table: string; condition: string }>;
    groupBy: string[];
    having: string[];
    orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
    limit?: number;
    offset?: number;
    distinct: boolean;
  };

  private dialect: string;
  private parameters: Record<string, any> = {};
  private parameterIndex = 0;

  constructor(dialect: string = 'postgresql') {
    this.dialect = dialect;
    this.query = {
      type: 'SELECT',
      tables: [],
      columns: [],
      values: [],
      conditions: [],
      joins: [],
      groupBy: [],
      having: [],
      orderBy: [],
      distinct: false
    };
  }

  static select(...columns: string[]): SQLQueryBuilder {
    const builder = new SQLQueryBuilder();
    builder.query.type = 'SELECT';
    builder.query.columns = columns.length > 0 ? columns : ['*'];
    return builder;
  }

  static selectDistinct(...columns: string[]): SQLQueryBuilder {
    const builder = SQLQueryBuilder.select(...columns);
    builder.query.distinct = true;
    return builder;
  }

  static insertInto(table: string): SQLQueryBuilder {
    const builder = new SQLQueryBuilder();
    builder.query.type = 'INSERT';
    builder.query.tables = [table];
    return builder;
  }

  static update(table: string): SQLQueryBuilder {
    const builder = new SQLQueryBuilder();
    builder.query.type = 'UPDATE';
    builder.query.tables = [table];
    return builder;
  }

  static deleteFrom(table: string): SQLQueryBuilder {
    const builder = new SQLQueryBuilder();
    builder.query.type = 'DELETE';
    builder.query.tables = [table];
    return builder;
  }

  from(table: string, alias?: string): SQLQueryBuilder {
    const tableRef = alias ? `${table} AS ${alias}` : table;
    this.query.tables = [tableRef];
    return this;
  }

  join(table: string, condition: string, alias?: string): SQLQueryBuilder {
    const tableRef = alias ? `${table} AS ${alias}` : table;
    this.query.joins.push({ type: 'INNER JOIN', table: tableRef, condition });
    return this;
  }

  leftJoin(table: string, condition: string, alias?: string): SQLQueryBuilder {
    const tableRef = alias ? `${table} AS ${alias}` : table;
    this.query.joins.push({ type: 'LEFT JOIN', table: tableRef, condition });
    return this;
  }

  rightJoin(table: string, condition: string, alias?: string): SQLQueryBuilder {
    const tableRef = alias ? `${table} AS ${alias}` : table;
    this.query.joins.push({ type: 'RIGHT JOIN', table: tableRef, condition });
    return this;
  }

  fullJoin(table: string, condition: string, alias?: string): SQLQueryBuilder {
    const tableRef = alias ? `${table} AS ${alias}` : table;
    this.query.joins.push({ type: 'FULL OUTER JOIN', table: tableRef, condition });
    return this;
  }

  where(condition: string, ...params: any[]): SQLQueryBuilder {
    const parameterizedCondition = this.parameterizeCondition(condition, params);
    this.query.conditions.push(parameterizedCondition);
    return this;
  }

  andWhere(condition: string, ...params: any[]): SQLQueryBuilder {
    return this.where(condition, ...params);
  }

  orWhere(condition: string, ...params: any[]): SQLQueryBuilder {
    const parameterizedCondition = this.parameterizeCondition(condition, params);
    if (this.query.conditions.length > 0) {
      this.query.conditions.push(`OR ${parameterizedCondition}`);
    } else {
      this.query.conditions.push(parameterizedCondition);
    }
    return this;
  }

  whereIn(column: string, values: any[]): SQLQueryBuilder {
    const placeholders = values.map(val => {
      const param = this.addParameter(val);
      return param;
    }).join(', ');
    this.query.conditions.push(`${column} IN (${placeholders})`);
    return this;
  }

  whereBetween(column: string, min: any, max: any): SQLQueryBuilder {
    const minParam = this.addParameter(min);
    const maxParam = this.addParameter(max);
    this.query.conditions.push(`${column} BETWEEN ${minParam} AND ${maxParam}`);
    return this;
  }

  whereNull(column: string): SQLQueryBuilder {
    this.query.conditions.push(`${column} IS NULL`);
    return this;
  }

  whereNotNull(column: string): SQLQueryBuilder {
    this.query.conditions.push(`${column} IS NOT NULL`);
    return this;
  }

  groupBy(...columns: string[]): SQLQueryBuilder {
    this.query.groupBy.push(...columns);
    return this;
  }

  having(condition: string, ...params: any[]): SQLQueryBuilder {
    const parameterizedCondition = this.parameterizeCondition(condition, params);
    this.query.having.push(parameterizedCondition);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): SQLQueryBuilder {
    this.query.orderBy.push({ column, direction });
    return this;
  }

  orderByDesc(column: string): SQLQueryBuilder {
    return this.orderBy(column, 'DESC');
  }

  limit(count: number): SQLQueryBuilder {
    this.query.limit = count;
    return this;
  }

  offset(count: number): SQLQueryBuilder {
    this.query.offset = count;
    return this;
  }

  // INSERT specific methods
  values(data: Record<string, any> | Record<string, any>[]): SQLQueryBuilder {
    if (this.query.type !== 'INSERT') {
      throw new Error('values() can only be used with INSERT queries');
    }
    
    const valueArray = Array.isArray(data) ? data : [data];
    this.query.values = valueArray;
    
    // Extract column names from first record
    if (valueArray.length > 0) {
      this.query.columns = Object.keys(valueArray[0]);
    }
    
    return this;
  }

  // UPDATE specific methods
  set(column: string, value: any): SQLQueryBuilder;
  set(data: Record<string, any>): SQLQueryBuilder;
  set(columnOrData: string | Record<string, any>, value?: any): SQLQueryBuilder {
    if (this.query.type !== 'UPDATE') {
      throw new Error('set() can only be used with UPDATE queries');
    }

    if (typeof columnOrData === 'string') {
      const param = this.addParameter(value);
      this.query.conditions.push(`${columnOrData} = ${param}`);
    } else {
      Object.entries(columnOrData).forEach(([col, val]) => {
        const param = this.addParameter(val);
        this.query.conditions.push(`${col} = ${param}`);
      });
    }
    
    return this;
  }

  private parameterizeCondition(condition: string, params: any[]): string {
    let parameterizedCondition = condition;
    params.forEach(param => {
      const paramName = this.addParameter(param);
      parameterizedCondition = parameterizedCondition.replace('?', paramName);
    });
    return parameterizedCondition;
  }

  private addParameter(value: any): string {
    const paramName = `param_${this.parameterIndex++}`;
    this.parameters[paramName] = value;
    return this.dialect === 'postgresql' ? `$${this.parameterIndex}` : `:${paramName}`;
  }

  getParameters(): Record<string, any> {
    return { ...this.parameters };
  }

  build(): string {
    return this.buildSQL();
  }

  buildWithParams(): { sql: string; params: Record<string, any> } {
    return {
      sql: this.buildSQL(),
      params: this.getParameters()
    };
  }

  private buildSQL(): string {
    switch (this.query.type) {
      case 'SELECT':
        return this.buildSelectQuery();
      case 'INSERT':
        return this.buildInsertQuery();
      case 'UPDATE':
        return this.buildUpdateQuery();
      case 'DELETE':
        return this.buildDeleteQuery();
      default:
        throw new Error(`Unsupported query type: ${this.query.type}`);
    }
  }

  private buildSelectQuery(): string {
    let sql = 'SELECT';
    
    if (this.query.distinct) {
      sql += ' DISTINCT';
    }
    
    sql += ` ${this.query.columns.join(', ')}`;
    
    if (this.query.tables.length > 0) {
      sql += ` FROM ${this.query.tables[0]}`;
    }
    
    // Add JOINs
    this.query.joins.forEach(join => {
      sql += ` ${join.type} ${join.table} ON ${join.condition}`;
    });
    
    // Add WHERE clause
    if (this.query.conditions.length > 0) {
      sql += ` WHERE ${this.query.conditions.join(' AND ')}`;
    }
    
    // Add GROUP BY
    if (this.query.groupBy.length > 0) {
      sql += ` GROUP BY ${this.query.groupBy.join(', ')}`;
    }
    
    // Add HAVING
    if (this.query.having.length > 0) {
      sql += ` HAVING ${this.query.having.join(' AND ')}`;
    }
    
    // Add ORDER BY
    if (this.query.orderBy.length > 0) {
      const orderClauses = this.query.orderBy.map(order => `${order.column} ${order.direction}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }
    
    // Add LIMIT and OFFSET (dialect-specific)
    if (this.query.limit !== undefined) {
      if (this.dialect === 'mssql') {
        sql += ` OFFSET ${this.query.offset || 0} ROWS FETCH NEXT ${this.query.limit} ROWS ONLY`;
      } else {
        sql += ` LIMIT ${this.query.limit}`;
        if (this.query.offset !== undefined) {
          sql += ` OFFSET ${this.query.offset}`;
        }
      }
    }
    
    return sql;
  }

  private buildInsertQuery(): string {
    if (this.query.tables.length === 0) {
      throw new Error('INSERT query requires a table');
    }
    
    if (this.query.values.length === 0) {
      throw new Error('INSERT query requires values');
    }
    
    let sql = `INSERT INTO ${this.query.tables[0]}`;
    
    const columns = this.query.columns;
    sql += ` (${columns.join(', ')})`;
    
    sql += ' VALUES ';
    
    const valuesClauses = this.query.values.map(record => {
      const values = columns.map(col => {
        const param = this.addParameter(record[col]);
        return param;
      });
      return `(${values.join(', ')})`;
    });
    
    sql += valuesClauses.join(', ');
    
    // Add RETURNING clause for PostgreSQL
    if (this.dialect === 'postgresql') {
      sql += ' RETURNING *';
    }
    
    return sql;
  }

  private buildUpdateQuery(): string {
    if (this.query.tables.length === 0) {
      throw new Error('UPDATE query requires a table');
    }
    
    let sql = `UPDATE ${this.query.tables[0]} SET `;
    
    // Extract SET clauses from conditions (this is a simplified approach)
    const setClauses = this.query.conditions.filter(condition => condition.includes('='));
    const whereClauses = this.query.conditions.filter(condition => !condition.includes('='));
    
    if (setClauses.length === 0) {
      throw new Error('UPDATE query requires SET clauses');
    }
    
    sql += setClauses.join(', ');
    
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    // Add RETURNING clause for PostgreSQL
    if (this.dialect === 'postgresql') {
      sql += ' RETURNING *';
    }
    
    return sql;
  }

  private buildDeleteQuery(): string {
    if (this.query.tables.length === 0) {
      throw new Error('DELETE query requires a table');
    }
    
    let sql = `DELETE FROM ${this.query.tables[0]}`;
    
    if (this.query.conditions.length > 0) {
      sql += ` WHERE ${this.query.conditions.join(' AND ')}`;
    }
    
    // Add RETURNING clause for PostgreSQL
    if (this.dialect === 'postgresql') {
      sql += ' RETURNING *';
    }
    
    return sql;
  }

  // Convenience methods for common query patterns
  static findById(table: string, id: any, dialect: string = 'postgresql'): SQLQueryBuilder {
    return SQLQueryBuilder.select('*')
      .from(table)
      .where('id = ?', id);
  }

  static findByField(table: string, field: string, value: any, dialect: string = 'postgresql'): SQLQueryBuilder {
    return SQLQueryBuilder.select('*')
      .from(table)
      .where(`${field} = ?`, value);
  }

  static paginate(table: string, page: number, pageSize: number, dialect: string = 'postgresql'): SQLQueryBuilder {
    const offset = (page - 1) * pageSize;
    return SQLQueryBuilder.select('*')
      .from(table)
      .limit(pageSize)
      .offset(offset);
  }

  // Method chaining helpers
  clone(): SQLQueryBuilder {
    const cloned = new SQLQueryBuilder(this.dialect);
    cloned.query = JSON.parse(JSON.stringify(this.query));
    cloned.parameters = { ...this.parameters };
    cloned.parameterIndex = this.parameterIndex;
    return cloned;
  }

  // Debug helpers
  toString(): string {
    return this.buildSQL();
  }

  toStringWithParams(): string {
    const { sql, params } = this.buildWithParams();
    return `${sql}\n\nParameters: ${JSON.stringify(params, null, 2)}`;
  }
}