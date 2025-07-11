import { AIService } from '../ai-service.js';
import { 
  BusinessLogicImplementation, 
  BusinessDomain, 
  BusinessLogicRequest 
} from './business-logic-generator.js';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
  correctedImplementation?: string;
  testCases: TestCase[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'improvement';
  category: 'mathematical' | 'business' | 'performance' | 'security';
  message: string;
  location?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedFix?: string;
}

export interface TestCase {
  name: string;
  input: any;
  expectedOutput: any;
  actualOutput?: any;
  passed?: boolean;
  explanation: string;
}

export interface BusinessRule {
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class BusinessLogicValidationEngine {
  constructor(private aiService: AIService) {}
  
  async validateBusinessLogic(
    implementation: BusinessLogicImplementation,
    domain: BusinessDomain,
    request: BusinessLogicRequest
  ): Promise<BusinessLogicImplementation> {
    
    console.log('🔍 Starting Business Logic Validation...');
    
    // Phase 1: Static Code Analysis
    const staticValidation = await this.performStaticValidation(implementation);
    
    // Phase 2: Business Rule Validation  
    const businessValidation = await this.validateBusinessRules(implementation, domain);
    
    // Phase 3: Mathematical Accuracy Check
    const mathValidation = await this.validateMathematicalAccuracy(implementation, domain);
    
    // Phase 4: Performance Analysis
    const performanceValidation = await this.validatePerformance(implementation);
    
    // Phase 5: Security Check
    const securityValidation = await this.validateSecurity(implementation);
    
    // Combine all validations
    const combinedValidation = this.combineValidations([
      staticValidation,
      businessValidation, 
      mathValidation,
      performanceValidation,
      securityValidation
    ]);
    
    // Generate corrected implementation if needed
    if (combinedValidation.score < 80 || combinedValidation.issues.some(i => i.severity === 'critical')) {
      combinedValidation.correctedImplementation = await this.generateCorrectedImplementation(
        implementation,
        combinedValidation.issues,
        domain,
        request
      );
    }
    
    // Generate comprehensive test cases
    combinedValidation.testCases = await this.generateBusinessTestCases(implementation, domain);
    
    // Return validated/corrected implementation
    return {
      ...implementation,
      implementation: combinedValidation.correctedImplementation || implementation.implementation,
      tests: combinedValidation.testCases.map(tc => 
        `// Test: ${tc.name}\n// Input: ${JSON.stringify(tc.input)}\n// Expected: ${JSON.stringify(tc.expectedOutput)}`
      ),
      documentation: implementation.documentation ? 
        implementation.documentation + '\n\n## Validation Results\n' + this.formatValidationReport(combinedValidation) :
        this.formatValidationReport(combinedValidation)
    };
  }
  
  private async performStaticValidation(implementation: BusinessLogicImplementation): Promise<ValidationResult> {
    const validationPrompt = `
TASK: Perform static code analysis on this business logic implementation.

IMPLEMENTATION:
${implementation.implementation}

Analyze the code for:
1. Syntax errors and potential runtime issues
2. Code quality and maintainability
3. Error handling completeness
4. Variable naming and clarity
5. Performance inefficiencies
6. Security vulnerabilities

Return JSON:
{
  "isValid": boolean,
  "score": number (0-100),
  "issues": [
    {
      "type": "error|warning|improvement",
      "category": "mathematical|business|performance|security",
      "message": "description of the issue",
      "location": "line or function where issue occurs",
      "severity": "critical|high|medium|low",
      "suggestedFix": "how to fix this issue"
    }
  ],
  "suggestions": ["general improvement suggestions"],
  "testCases": []
}`;

    const result = await this.aiService.getJSONResponse(validationPrompt);
    return this.normalizeValidationResult(result);
  }
  
  private async validateBusinessRules(
    implementation: BusinessLogicImplementation,
    domain: BusinessDomain
  ): Promise<ValidationResult> {
    
    const businessRulesPrompt = `
TASK: Validate that the implementation correctly follows business rules.

IMPLEMENTATION:
${implementation.implementation}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

BUSINESS RULES TO CHECK:
- Explicit rules: ${domain.businessRules?.explicitRules?.join(', ') || 'none specified'}
- Implicit rules: ${domain.businessRules?.implicitRules?.join(', ') || 'none specified'}
- Regulatory requirements: ${domain.businessRules?.regulatoryRequirements?.join(', ') || 'none specified'}

Validate:
1. All explicit business rules are implemented
2. Implicit business rules are respected
3. Regulatory requirements are met
4. Industry best practices are followed
5. Edge cases are handled appropriately
6. Business constraints are enforced

Return validation result with specific business rule violations in JSON format.`;

    const result = await this.aiService.getJSONResponse(businessRulesPrompt);
    return this.normalizeValidationResult(result);
  }
  
  private async validateMathematicalAccuracy(
    implementation: BusinessLogicImplementation,
    domain: BusinessDomain
  ): Promise<ValidationResult> {
    
    const mathValidationPrompt = `
TASK: Validate mathematical accuracy of the business logic implementation.

IMPLEMENTATION:
${implementation.implementation}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

Check for:
1. Mathematical correctness of formulas
2. Proper handling of mathematical edge cases (division by zero, negative values, etc.)
3. Appropriate use of mathematical functions
4. Correct order of operations
5. Proper rounding and precision handling
6. Unit consistency and conversions
7. Statistical validity (if applicable)

Return validation focusing on mathematical accuracy and correctness in JSON format.`;

    const result = await this.aiService.getJSONResponse(mathValidationPrompt);
    return this.normalizeValidationResult(result);
  }
  
  private async validatePerformance(implementation: BusinessLogicImplementation): Promise<ValidationResult> {
    const performancePrompt = `
TASK: Analyze performance characteristics of the business logic implementation.

IMPLEMENTATION:
${implementation.implementation}

Analyze:
1. Time complexity of algorithms
2. Memory usage patterns
3. Potential bottlenecks
4. Scalability concerns
5. Optimization opportunities
6. Database query efficiency (if applicable)
7. Network call optimization (if applicable)

Return performance validation with optimization suggestions in JSON format.`;

    const result = await this.aiService.getJSONResponse(performancePrompt);
    return this.normalizeValidationResult(result);
  }
  
  private async validateSecurity(implementation: BusinessLogicImplementation): Promise<ValidationResult> {
    const securityPrompt = `
TASK: Perform security analysis of the business logic implementation.

IMPLEMENTATION:
${implementation.implementation}

Check for:
1. Input validation and sanitization
2. SQL injection vulnerabilities
3. Cross-site scripting (XSS) risks
4. Authentication and authorization checks
5. Data encryption requirements
6. Logging of sensitive information
7. Rate limiting considerations
8. Access control enforcement

Return security validation with vulnerability assessments in JSON format.`;

    const result = await this.aiService.getJSONResponse(securityPrompt);
    return this.normalizeValidationResult(result);
  }
  
  private combineValidations(validations: ValidationResult[]): ValidationResult {
    const combined: ValidationResult = {
      isValid: validations.every(v => v.isValid),
      score: Math.round(validations.reduce((sum, v) => sum + v.score, 0) / validations.length),
      issues: validations.flatMap(v => v.issues),
      suggestions: [...new Set(validations.flatMap(v => v.suggestions))],
      testCases: []
    };
    
    // Sort issues by severity
    combined.issues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    // Remove duplicate issues
    const uniqueIssues = new Map<string, ValidationIssue>();
    combined.issues.forEach(issue => {
      const key = `${issue.type}-${issue.category}-${issue.message}`;
      if (!uniqueIssues.has(key) || 
          (uniqueIssues.get(key)!.severity as any) < (issue.severity as any)) {
        uniqueIssues.set(key, issue);
      }
    });
    combined.issues = Array.from(uniqueIssues.values());
    
    return combined;
  }
  
  private async generateCorrectedImplementation(
    implementation: BusinessLogicImplementation,
    issues: ValidationIssue[],
    domain: BusinessDomain,
    request: BusinessLogicRequest
  ): Promise<string> {
    
    const correctionPrompt = `
TASK: Generate corrected business logic implementation that fixes all identified issues.

ORIGINAL IMPLEMENTATION:
${implementation.implementation}

ISSUES TO FIX:
${JSON.stringify(issues.filter(i => i.severity === 'critical' || i.severity === 'high'), null, 2)}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

ORIGINAL REQUEST:
${JSON.stringify(request, null, 2)}

Generate a corrected implementation that:
1. Fixes all critical and high severity issues
2. Maintains the original business logic intent
3. Improves performance and security
4. Includes comprehensive error handling
5. Follows best practices
6. Is production-ready

Return only the corrected implementation code.`;

    const correctedCode = await this.aiService.callAI(correctionPrompt);
    
    // Extract code from response if wrapped in code blocks
    const codeMatch = correctedCode.match(/```(?:typescript|javascript)?\n([\s\S]+?)\n```/);
    return codeMatch ? codeMatch[1] : correctedCode;
  }
  
  private async generateBusinessTestCases(
    implementation: BusinessLogicImplementation,
    domain: BusinessDomain
  ): Promise<TestCase[]> {
    
    const testCasesPrompt = `
TASK: Generate comprehensive test cases for the business logic implementation.

IMPLEMENTATION:
${implementation.implementation}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

Generate test cases that cover:
1. Happy path scenarios
2. Edge cases and boundary conditions
3. Error conditions and exception handling
4. Business rule validation
5. Performance stress testing
6. Invalid input handling

Return JSON array:
{
  "testCases": [
    {
      "name": "descriptive test name",
      "input": { "param1": value1, "param2": value2 },
      "expectedOutput": { "result": expectedValue },
      "explanation": "why this test case is important"
    }
  ]
}`;

    const result = await this.aiService.getJSONResponse(testCasesPrompt);
    return result.testCases || [];
  }
  
  async validateTestResults(testCases: TestCase[]): Promise<ValidationResult> {
    const passedTests = testCases.filter(tc => tc.passed).length;
    const totalTests = testCases.length;
    const score = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    const issues: ValidationIssue[] = testCases
      .filter(tc => !tc.passed)
      .map(tc => ({
        type: 'error' as const,
        category: 'business' as const,
        message: `Test case "${tc.name}" failed: Expected ${JSON.stringify(tc.expectedOutput)}, got ${JSON.stringify(tc.actualOutput)}`,
        severity: 'high' as const,
        suggestedFix: `Review and fix the logic for: ${tc.explanation}`
      }));
    
    return {
      isValid: score >= 80,
      score,
      issues,
      suggestions: [
        'Review failed test cases and fix underlying business logic',
        'Ensure edge cases are properly handled',
        'Validate business rule implementation'
      ],
      testCases
    };
  }

  private normalizeValidationResult(result: any): ValidationResult {
    return {
      isValid: result.isValid ?? true,
      score: result.score ?? 80,
      issues: Array.isArray(result.issues) ? result.issues : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      testCases: Array.isArray(result.testCases) ? result.testCases : []
    };
  }

  private formatValidationReport(validation: ValidationResult): string {
    let report = `### Validation Score: ${validation.score}/100\n\n`;
    
    if (validation.issues.length > 0) {
      report += '### Issues Found:\n';
      validation.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : 
                     issue.severity === 'high' ? '🟠' : 
                     issue.severity === 'medium' ? '🟡' : '🟢';
        report += `${icon} **${issue.severity.toUpperCase()}** [${issue.category}]: ${issue.message}\n`;
        if (issue.suggestedFix) {
          report += `   💡 Fix: ${issue.suggestedFix}\n`;
        }
      });
      report += '\n';
    }
    
    if (validation.suggestions.length > 0) {
      report += '### Suggestions:\n';
      validation.suggestions.forEach(suggestion => {
        report += `- ${suggestion}\n`;
      });
      report += '\n';
    }
    
    if (validation.testCases.length > 0) {
      report += `### Test Cases Generated: ${validation.testCases.length}\n`;
    }
    
    return report;
  }

  // Additional validation utilities
  
  async validateAgainstIndustryStandards(
    implementation: BusinessLogicImplementation,
    industry: string
  ): Promise<ValidationIssue[]> {
    const standardsPrompt = `
TASK: Validate implementation against ${industry} industry standards.

IMPLEMENTATION:
${implementation.implementation}

Check for compliance with:
1. Industry-specific calculation methods
2. Standard business practices
3. Common pitfalls in ${industry}
4. Best practices for ${industry}

Return array of validation issues.`;

    const result = await this.aiService.getJSONResponse(standardsPrompt);
    return result.issues || [];
  }

  async suggestPerformanceOptimizations(
    implementation: BusinessLogicImplementation
  ): Promise<string[]> {
    const optimizationPrompt = `
TASK: Suggest performance optimizations for the business logic.

IMPLEMENTATION:
${implementation.implementation}

Analyze and suggest:
1. Algorithm optimizations
2. Caching opportunities
3. Parallel processing possibilities
4. Memory usage improvements
5. Database query optimizations

Return array of optimization suggestions.`;

    const result = await this.aiService.getJSONResponse(optimizationPrompt);
    return result.suggestions || [];
  }
}

// Export convenience function
export function createBusinessLogicValidationEngine(aiProvider?: string): BusinessLogicValidationEngine {
  return new BusinessLogicValidationEngine(new AIService(aiProvider));
}