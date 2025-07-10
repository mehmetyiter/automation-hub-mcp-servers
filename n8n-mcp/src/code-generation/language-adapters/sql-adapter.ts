import { CodeGenerationRequest, CodeContext } from '../types';
import { AIService } from '../../ai-service';
import { 
  LanguageAdapterError, 
  ValidationError,
  SecurityError 
} from '../errors/custom-errors';
import { SQLQueryParams, SQLDialectInfo } from '../types/common-types';

export interface SQLCodeGenerationOptions {
  dialect?: 'mysql' | 'postgresql' | 'sqlite' | 'mssql' | 'oracle';
  includeTransactions?: boolean;
  includeErrorHandling?: boolean;
  outputFormat?: 'json' | 'table' | 'csv';
  performanceOptimized?: boolean;
}

export class SQLCodeAdapter {
  private aiService: AIService;
  private dialectPatterns: Map<string, SQLDialectInfo>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.initializeDialectPatterns();
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

  async validateSQLSyntax(sql: string, dialect: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
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
  "errors": ["list of errors"],
  "warnings": ["list of warnings"]
}`;

    try {
      const result = await this.aiService.getJSONResponse(validationPrompt);
      return result;
    } catch (error) {
      throw new LanguageAdapterError(
        'SQL validation failed',
        'sql',
        error
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
}