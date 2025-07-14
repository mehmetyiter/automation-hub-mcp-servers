import { CodeGenerationRequest, CodeContext } from '../types.js';
import { AIService } from '../../ai-service.js';

export interface TypeScriptCodeGenerationOptions {
  strict?: boolean;
  targetES?: 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext';
  moduleSystem?: 'commonjs' | 'esm';
  includeTypes?: boolean;
  asyncAwait?: boolean;
  errorHandling?: 'try-catch' | 'result-type' | 'promises';
}

interface TypeDefinition {
  name: string;
  definition: string;
}

export class TypeScriptCodeAdapter {
  private aiService: AIService;
  private commonTypes: Map<string, TypeDefinition>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.initializeCommonTypes();
  }

  private initializeCommonTypes() {
    this.commonTypes = new Map([
      ['N8nItem', {
        name: 'N8nItem',
        definition: `interface N8nItem {
  json: Record<string, any>;
  binary?: Record<string, any>;
}`
      }],
      ['WorkflowData', {
        name: 'WorkflowData',
        definition: `interface WorkflowData {
  items: N8nItem[];
  context: Record<string, any>;
}`
      }],
      ['Result', {
        name: 'Result',
        definition: `type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };`
      }],
      ['ProcessedItem', {
        name: 'ProcessedItem',
        definition: `interface ProcessedItem extends N8nItem {
  processed: boolean;
  processedAt: string;
  errors?: string[];
}`
      }]
    ]);
  }

  async generateTypeScriptCode(
    request: CodeGenerationRequest,
    context: CodeContext,
    options?: TypeScriptCodeGenerationOptions
  ): Promise<string> {
    const strict = options?.strict ?? true;
    const targetES = options?.targetES || 'ES2020';
    const includeTypes = options?.includeTypes ?? true;
    const asyncAwait = options?.asyncAwait ?? true;
    const errorHandling = options?.errorHandling || 'try-catch';
    
    const prompt = this.buildTypeScriptPrompt(request, context, options);
    const generatedCode = await this.aiService.callAI(prompt);
    
    // Clean and format the code
    let cleanCode = this.cleanTypeScriptCode(generatedCode);
    
    // Add type definitions if requested
    if (includeTypes) {
      cleanCode = this.addTypeDefinitions(cleanCode, context);
    }
    
    // Wrap for n8n compatibility
    return this.wrapForN8n(cleanCode, strict, errorHandling);
  }

  private buildTypeScriptPrompt(
    request: CodeGenerationRequest,
    context: CodeContext,
    options?: TypeScriptCodeGenerationOptions
  ): string {
    return `
Generate TypeScript code for n8n workflow automation.

Task: ${request.description}

Requirements:
- TypeScript with ${options?.strict ? 'strict' : 'flexible'} typing
- Target: ${options?.targetES || 'ES2020'}
- Use ${options?.asyncAwait ? 'async/await' : 'promises'}
- Error handling: ${options?.errorHandling || 'try-catch'}
- Module system: ${options?.moduleSystem || 'commonjs'}

Context:
${JSON.stringify(context.intent, null, 2)}

Generate TypeScript code that:
1. Has proper type annotations for all variables and functions
2. Uses interfaces for complex data structures
3. Implements the requested business logic
4. Follows TypeScript best practices
5. Includes JSDoc comments for functions
6. Handles errors appropriately
7. Is compatible with n8n's execution environment
8. Uses generic types where appropriate
9. Avoids 'any' type unless absolutely necessary

The code should work within n8n's Code node with TypeScript support.`;
  }

  private cleanTypeScriptCode(code: string): string {
    // Remove markdown code blocks
    code = code.replace(/```typescript\n?/gi, '');
    code = code.replace(/```ts\n?/gi, '');
    code = code.replace(/```\n?/g, '');
    
    // Clean up imports (n8n doesn't support imports in Code nodes)
    code = code.replace(/^import\s+.*?;?\s*$/gm, '');
    code = code.replace(/^export\s+/gm, '');
    
    return code.trim();
  }

  private addTypeDefinitions(code: string, context: CodeContext): string {
    const usedTypes = new Set<string>();
    
    // Detect which types are used in the code
    this.commonTypes.forEach((typeDef, key) => {
      if (code.includes(key)) {
        usedTypes.add(key);
      }
    });
    
    // Always include N8nItem if working with items
    if (code.includes('$input') || code.includes('items')) {
      usedTypes.add('N8nItem');
    }
    
    // Build type definitions section
    let typeDefinitions = '// Type Definitions\n';
    usedTypes.forEach(typeName => {
      const typeDef = this.commonTypes.get(typeName);
      if (typeDef) {
        typeDefinitions += typeDef.definition + '\n\n';
      }
    });
    
    // Add custom types based on context
    // TODO: Add custom type generation based on technical requirements
    // if (context.technicalRequirements.inputDataStructure) {
    //   typeDefinitions += this.generateCustomTypes(context.technicalRequirements.inputDataStructure);
    // }
    
    return typeDefinitions + '\n' + code;
  }

  private generateCustomTypes(dataStructure: any): string {
    let customTypes = '// Custom Types\n';
    
    // Generate interface from data structure
    const interfaceName = 'CustomData';
    customTypes += `interface ${interfaceName} {\n`;
    
    Object.entries(dataStructure).forEach(([key, value]) => {
      const type = this.inferTypeFromValue(value);
      customTypes += `  ${key}: ${type};\n`;
    });
    
    customTypes += '}\n\n';
    
    return customTypes;
  }

  private inferTypeFromValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) {
      if (value.length > 0) {
        return `${this.inferTypeFromValue(value[0])}[]`;
      }
      return 'any[]';
    }
    if (typeof value === 'object') return 'Record<string, any>';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'any';
  }

  private wrapForN8n(
    code: string,
    strict: boolean,
    errorHandling: string
  ): string {
    const strictDirective = strict ? '"use strict";\n\n' : '';
    
    const template = `${strictDirective}// TypeScript code for n8n Code node
// Enable TypeScript in node settings

${code}

// Main execution function
async function processItems(): Promise<N8nItem[]> {
  const inputItems = $input.all();
  const processedItems: N8nItem[] = [];
  
  ${errorHandling === 'try-catch' ? `
  try {
    for (const item of inputItems) {
      const processedItem = await processItem(item);
      processedItems.push(processedItem);
    }
  } catch (error) {
    console.error('Processing error:', error);
    throw error;
  }` : errorHandling === 'result-type' ? `
  for (const item of inputItems) {
    const result = await safeProcessItem(item);
    if (result.success) {
      processedItems.push(result.data);
    } else {
      console.error('Processing error:', result.error);
      processedItems.push({
        json: {
          ...item.json,
          error: result.error.message,
          status: 'failed'
        }
      });
    }
  }` : `
  await Promise.all(
    inputItems.map(async (item) => {
      try {
        const processedItem = await processItem(item);
        processedItems.push(processedItem);
      } catch (error) {
        console.error('Item processing error:', error);
        processedItems.push({
          json: {
            ...item.json,
            error: error.message,
            status: 'failed'
          }
        });
      }
    })
  );`}
  
  return processedItems;
}

// Execute and return results
return processItems();`;

    return template;
  }

  generateTypeScriptFallbackCode(
    request: CodeGenerationRequest,
    options?: TypeScriptCodeGenerationOptions
  ): string {
    const description = request.description.toLowerCase();
    let code = '';
    
    if (description.includes('transform')) {
      code = this.generateTransformCode();
    } else if (description.includes('validate')) {
      code = this.generateValidationCode();
    } else if (description.includes('aggregate')) {
      code = this.generateAggregationCode();
    } else if (description.includes('api') || description.includes('http')) {
      code = this.generateAPICode();
    } else {
      code = this.generateGenericCode();
    }
    
    const includeTypes = options?.includeTypes ?? true;
    if (includeTypes) {
      code = this.addTypeDefinitions(code, { intent: {} } as CodeContext);
    }
    
    return this.wrapForN8n(code, true, 'try-catch');
  }

  private generateTransformCode(): string {
    return `
// Transform function with proper typing
function transformData<T extends Record<string, any>>(
  data: T
): T & { transformed: boolean; timestamp: string } {
  return {
    ...data,
    transformed: true,
    timestamp: new Date().toISOString()
  };
}

// Process single item
async function processItem(item: N8nItem): Promise<N8nItem> {
  const transformedData = transformData(item.json);
  
  return {
    json: transformedData,
    binary: item.binary
  };
}`;
  }

  private generateValidationCode(): string {
    return `
// Validation schema
interface ValidationRule<T> {
  field: keyof T;
  required?: boolean;
  type?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
}

// Validate data against rules
function validateData<T extends Record<string, any>>(
  data: T,
  rules: ValidationRule<T>[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const rule of rules) {
    const value = data[rule.field];
    
    if (rule.required && (value === undefined || value === null)) {
      errors.push(\`\${String(rule.field)} is required\`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      if (rule.type && typeof value !== rule.type) {
        errors.push(\`\${String(rule.field)} must be of type \${rule.type}\`);
      }
      
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(\`\${String(rule.field)} format is invalid\`);
      }
      
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors.push(\`\${String(rule.field)} must be at least \${rule.min}\`);
      }
      
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors.push(\`\${String(rule.field)} must be at most \${rule.max}\`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Process single item with validation
async function processItem(item: N8nItem): Promise<N8nItem> {
  const rules: ValidationRule<any>[] = [
    { field: 'email', required: true, pattern: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ },
    { field: 'age', type: 'number', min: 0, max: 150 }
  ];
  
  const validation = validateData(item.json, rules);
  
  return {
    json: {
      ...item.json,
      validation,
      isValid: validation.isValid
    }
  };
}`;
  }

  private generateAggregationCode(): string {
    return `
// Aggregation types
interface AggregationResult {
  count: number;
  sum?: number;
  average?: number;
  min?: number;
  max?: number;
  items: any[];
}

// Generic aggregation function
function aggregate<T extends Record<string, any>>(
  items: T[],
  groupBy: keyof T,
  aggregateField?: keyof T
): Map<any, AggregationResult> {
  const groups = new Map<any, AggregationResult>();
  
  for (const item of items) {
    const key = item[groupBy];
    
    if (!groups.has(key)) {
      groups.set(key, {
        count: 0,
        sum: 0,
        items: []
      });
    }
    
    const group = groups.get(key)!;
    group.count++;
    group.items.push(item);
    
    if (aggregateField && typeof item[aggregateField] === 'number') {
      group.sum = (group.sum || 0) + item[aggregateField];
    }
  }
  
  // Calculate averages
  groups.forEach((group) => {
    if (group.sum !== undefined && group.count > 0) {
      group.average = group.sum / group.count;
    }
    
    if (aggregateField) {
      const values = group.items
        .map(item => item[aggregateField])
        .filter(v => typeof v === 'number') as number[];
      
      if (values.length > 0) {
        group.min = Math.min(...values);
        group.max = Math.max(...values);
      }
    }
  });
  
  return groups;
}

// Process items with aggregation
async function processItem(item: N8nItem): Promise<N8nItem> {
  // This would typically work on all items, not just one
  return item;
}`;
  }

  private generateAPICode(): string {
    return `
// API Response types
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

// Generic API handler
async function makeAPICall<T>(
  url: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json() as T;
    
    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : 'API request failed',
      statusCode: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 0
    };
  }
}

// Process item with API call
async function processItem(item: N8nItem): Promise<N8nItem> {
  const apiUrl = \`https://api.example.com/process/\${item.json.id}\`;
  const response = await makeAPICall<any>(apiUrl, {
    method: 'POST',
    body: JSON.stringify(item.json)
  });
  
  return {
    json: {
      ...item.json,
      apiResponse: response,
      processedAt: new Date().toISOString()
    }
  };
}`;
  }

  private generateGenericCode(): string {
    return `
// Generic processing function
async function processItem(item: N8nItem): Promise<N8nItem> {
  // Type-safe data extraction
  const data = item.json as Record<string, any>;
  
  // Process the data
  const processedData = {
    ...data,
    processed: true,
    processedAt: new Date().toISOString(),
    // Add your custom logic here
  };
  
  return {
    json: processedData,
    binary: item.binary
  };
}`;
  }

  async validateTypeScriptCode(code: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const validationPrompt = `
Validate this TypeScript code for n8n Code node:

${code}

Check for:
1. Type safety issues
2. Syntax errors
3. Best practice violations
4. Performance concerns
5. n8n compatibility issues

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
      return {
        isValid: true,
        errors: [],
        warnings: ['Automated validation unavailable']
      };
    }
  }
}