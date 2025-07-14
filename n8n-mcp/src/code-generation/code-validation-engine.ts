import { ValidationResult, ValidationIssue, CodeContext } from './types.js';
import { PythonCodeAdapter } from './language-adapters/python-adapter.js';
import { AIService } from '../ai-service.js';

export class CodeValidationEngine {
  private aiService: AIService;
  private pythonAdapter: PythonCodeAdapter;
  private securityPatterns: RegExp[];
  private performancePatterns: Map<string, string>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.pythonAdapter = new PythonCodeAdapter(provider);
    this.initializePatterns();
  }

  private initializePatterns() {
    // Security patterns to detect
    this.securityPatterns = [
      /eval\s*\(/g,
      /new\s+Function\s*\(/g,
      /require\s*\(\s*['"`]fs['"`]\s*\)/g,
      /require\s*\(\s*['"`]child_process['"`]\s*\)/g,
      /process\.env/g,
      /__dirname/g,
      /__filename/g,
      /require\s*\(\s*['"`]net['"`]\s*\)/g,
      /require\s*\(\s*['"`]http['"`]\s*\)/g,
    ];

    // Performance anti-patterns
    this.performancePatterns = new Map([
      ['nested_loops', 'Avoid deeply nested loops for better performance'],
      ['sync_in_loop', 'Avoid synchronous operations inside loops'],
      ['large_array_copy', 'Avoid copying large arrays unnecessarily'],
      ['repeated_calculations', 'Cache repeated calculations'],
      ['inefficient_string_concat', 'Use array join for string concatenation in loops']
    ]);
  }

  async validateCode(code: string, context: CodeContext, language: string = 'javascript'): Promise<ValidationResult> {
    // Delegate to Python adapter if Python code
    if (language === 'python') {
      return this.pythonAdapter.validatePythonCode(code, context);
    }
    
    // JavaScript validation
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    const securityWarnings: string[] = [];

    // Syntax validation
    const syntaxResult = this.validateSyntax(code);
    issues.push(...syntaxResult.issues);

    // Security validation
    const securityResult = this.validateSecurity(code);
    issues.push(...securityResult.issues);
    securityWarnings.push(...securityResult.warnings);

    // Logic validation
    const logicResult = await this.validateLogic(code, context);
    issues.push(...logicResult.issues);
    suggestions.push(...logicResult.suggestions);

    // Performance validation
    const performanceResult = this.validatePerformance(code, context);
    issues.push(...performanceResult.issues);
    suggestions.push(...performanceResult.suggestions);

    // n8n specific validation
    const n8nResult = this.validateN8nCompliance(code);
    issues.push(...n8nResult.issues);
    suggestions.push(...n8nResult.suggestions);

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions: [...new Set(suggestions)], // Remove duplicates
      securityWarnings: [...new Set(securityWarnings)]
    };
  }

  private validateSyntax(code: string): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    try {
      // Basic syntax check using Function constructor
      new Function(code);
    } catch (error: any) {
      const match = error.message.match(/Line (\d+):|at position (\d+)/);
      const line = match ? parseInt(match[1] || '0') : undefined;
      
      issues.push({
        type: 'syntax',
        severity: 'error',
        message: `Syntax Error: ${error.message}`,
        line
      });
    }

    // Check for common syntax issues
    if (!code.includes('return')) {
      issues.push({
        type: 'syntax',
        severity: 'warning',
        message: 'Code does not contain a return statement'
      });
    }

    // Check for unbalanced brackets
    const brackets = { '(': 0, '{': 0, '[': 0 };
    for (const char of code) {
      if (char === '(') brackets['(']++;
      if (char === ')') brackets['(']--;
      if (char === '{') brackets['{']++;
      if (char === '}') brackets['{']--;
      if (char === '[') brackets['[']++;
      if (char === ']') brackets['[']--;
    }

    for (const [bracket, count] of Object.entries(brackets)) {
      if (count !== 0) {
        issues.push({
          type: 'syntax',
          severity: 'error',
          message: `Unbalanced ${bracket} bracket`
        });
      }
    }

    return { issues };
  }

  private validateSecurity(code: string): { issues: ValidationIssue[], warnings: string[] } {
    const issues: ValidationIssue[] = [];
    const warnings: string[] = [];

    // Check for dangerous patterns
    for (const pattern of this.securityPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: `Security violation: ${pattern.source} is not allowed`
        });
        warnings.push(`Found dangerous pattern: ${matches[0]}`);
      }
    }

    // Check for potential injection vulnerabilities
    if (code.includes('${') && !code.includes('`')) {
      warnings.push('Template literals without backticks detected - potential injection risk');
    }

    // Check for unsafe JSON parsing
    if (code.includes('JSON.parse') && !code.includes('try')) {
      issues.push({
        type: 'security',
        severity: 'warning',
        message: 'JSON.parse should be wrapped in try-catch for safety'
      });
    }

    return { issues, warnings };
  }

  private async validateLogic(code: string, context: CodeContext): Promise<{ issues: ValidationIssue[], suggestions: string[] }> {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Use AI to validate logic
    const validationPrompt = `
Analyze this JavaScript code for logical issues and suggest improvements:

CODE:
${code}

EXPECTED CONTEXT:
${JSON.stringify(context, null, 2)}

Check for:
1. Logic errors or inconsistencies
2. Missing error handling
3. Incomplete implementations
4. Edge cases not handled
5. Data validation issues

Return JSON:
{
  "logicIssues": [
    {"issue": "description of logic problem", "severity": "error|warning|info"}
  ],
  "suggestions": ["improvement suggestions"]
}`;

    try {
      const result = await this.aiService.getJSONResponse(validationPrompt);
      
      if (result.logicIssues) {
        for (const issue of result.logicIssues) {
          issues.push({
            type: 'logic',
            severity: issue.severity || 'warning',
            message: issue.issue
          });
        }
      }

      if (result.suggestions) {
        suggestions.push(...result.suggestions);
      }
    } catch (error) {
      console.error('AI logic validation failed:', error);
    }

    // Basic logic checks
    if (!code.includes('try') && context.codeComplexity.errorProneParts.length > 0) {
      issues.push({
        type: 'logic',
        severity: 'warning',
        message: 'No error handling found for error-prone operations'
      });
      suggestions.push('Add try-catch blocks for error handling');
    }

    if (!code.includes('if') && !code.includes('?') && context.technicalRequirements.validation !== 'None') {
      issues.push({
        type: 'logic',
        severity: 'info',
        message: 'No conditional logic found for validation'
      });
    }

    return { issues, suggestions };
  }

  private validatePerformance(code: string, context: CodeContext): { issues: ValidationIssue[], suggestions: string[] } {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Check for nested loops
    const nestedLoopPattern = /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/;
    if (nestedLoopPattern.test(code)) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: 'Nested loops detected - consider optimization'
      });
      suggestions.push('Consider using array methods like map/filter/reduce instead of nested loops');
    }

    // Check for synchronous operations in loops
    const syncInLoopPattern = /for\s*\([^)]*\)\s*{[^}]*(readFileSync|writeFileSync)/;
    if (syncInLoopPattern.test(code)) {
      issues.push({
        type: 'performance',
        severity: 'error',
        message: 'Synchronous operations in loop detected'
      });
    }

    // Check for inefficient string concatenation
    const stringConcatInLoop = /for\s*\([^)]*\)\s*{[^}]*\+=/;
    if (stringConcatInLoop.test(code) && code.includes('+=') && code.includes('string')) {
      suggestions.push('Use array.push() and join() for string concatenation in loops');
    }

    // Check for repeated calculations
    const functionCalls = code.match(/\b\w+\s*\([^)]*\)/g) || [];
    const callCounts = new Map<string, number>();
    functionCalls.forEach(call => {
      const count = callCounts.get(call) || 0;
      callCounts.set(call, count + 1);
    });

    for (const [call, count] of callCounts) {
      if (count > 3 && !call.includes('console.')) {
        suggestions.push(`Consider caching the result of ${call} as it's called ${count} times`);
      }
    }

    return { issues, suggestions };
  }

  private validateN8nCompliance(code: string): { issues: ValidationIssue[], suggestions: string[] } {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Check for proper return structure
    if (!code.includes('return')) {
      issues.push({
        type: 'logic',
        severity: 'error',
        message: 'n8n Code node must return data'
      });
    }

    // Check for proper item structure
    if (code.includes('return') && !code.includes('json:') && !code.includes('.json')) {
      issues.push({
        type: 'logic',
        severity: 'warning',
        message: 'Ensure returned data follows n8n item structure with json property'
      });
      suggestions.push('Return data in format: [{json: {your_data}}]');
    }

    // Check for $input usage
    if (!code.includes('$input')) {
      issues.push({
        type: 'logic',
        severity: 'info',
        message: 'Code does not access input data via $input'
      });
      suggestions.push('Use $input.all() to access all input items');
    }

    // Check for proper error handling with n8n context
    if (code.includes('throw') && !code.includes('Error')) {
      issues.push({
        type: 'logic',
        severity: 'warning',
        message: 'Throw proper Error objects for better error handling in n8n'
      });
    }

    return { issues, suggestions };
  }

  async suggestImprovements(code: string, context: CodeContext): Promise<string[]> {
    const improvements: string[] = [];

    // Performance improvements
    if (context.codeComplexity.level === 'complex' || context.codeComplexity.level === 'advanced') {
      improvements.push('Consider breaking complex logic into smaller functions');
      improvements.push('Add performance monitoring for critical sections');
    }

    // Readability improvements
    if (context.codeComplexity.estimatedLines > 50) {
      improvements.push('Add section comments to improve readability');
      improvements.push('Extract repeated logic into helper functions');
    }

    // Error handling improvements
    if (context.technicalRequirements.errorHandling === 'comprehensive' || 
        context.technicalRequirements.errorHandling === 'enterprise') {
      improvements.push('Implement detailed error logging with context');
      improvements.push('Add error recovery mechanisms');
      improvements.push('Include error categorization for better handling');
    }

    return improvements;
  }
}