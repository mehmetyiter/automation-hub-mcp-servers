import { describe, it, expect, beforeEach } from '@jest/globals';
import { DynamicCodeGenerator } from '../src/code-generation/dynamic-code-generator';
import { CodeContextAnalyzer } from '../src/code-generation/code-context-analyzer';
import { CodeValidationEngine } from '../src/code-generation/code-validation-engine';
import { CodeOptimizationEngine } from '../src/code-generation/code-optimization-engine';
import { CodeExecutionMonitor } from '../src/code-generation/code-execution-monitor';
import { PythonCodeAdapter } from '../src/code-generation/language-adapters/python-adapter';
import { CodeGenerationRequest } from '../src/code-generation/types';

describe('Dynamic Code Generation System', () => {
  let codeGenerator: DynamicCodeGenerator;
  let contextAnalyzer: CodeContextAnalyzer;
  let validationEngine: CodeValidationEngine;
  let optimizationEngine: CodeOptimizationEngine;
  let executionMonitor: CodeExecutionMonitor;
  let pythonAdapter: PythonCodeAdapter;

  beforeEach(() => {
    codeGenerator = new DynamicCodeGenerator();
    contextAnalyzer = new CodeContextAnalyzer();
    validationEngine = new CodeValidationEngine();
    optimizationEngine = new CodeOptimizationEngine();
    executionMonitor = new CodeExecutionMonitor();
    pythonAdapter = new PythonCodeAdapter();
  });

  describe('Code Context Analysis', () => {
    it('should analyze simple data transformation request', async () => {
      const request: CodeGenerationRequest = {
        description: 'Transform user data by adding full name field',
        nodeType: 'code',
        workflowContext: {}
      };

      const context = await contextAnalyzer.analyzeContext(request);
      
      expect(context.intent.primaryFunction).toContain('transform');
      expect(context.intent.dataTransformation).toBeTruthy();
      expect(context.codeComplexity.level).toBe('simple');
    });

    it('should detect complex calculation requirements', async () => {
      const request: CodeGenerationRequest = {
        description: 'Calculate weighted average of scores with outlier detection and normalization',
        nodeType: 'code',
        workflowContext: {}
      };

      const context = await contextAnalyzer.analyzeContext(request);
      
      expect(context.intent.primaryFunction).toContain('calculate');
      expect(context.codeComplexity.level).toMatch(/moderate|complex/);
      expect(context.technicalRequirements.algorithms).toContain('statistical');
    });

    it('should recognize environment requirements', async () => {
      const context = await contextAnalyzer.detectEnvironment({
        intent: { primaryFunction: 'process data' },
        technicalRequirements: {},
        codeComplexity: { level: 'simple' },
        optimizationOpportunities: {}
      } as any);

      expect(context.runtime).toBe('node');
      expect(context.availableLibraries).toContain('lodash');
      expect(context.bestPractices).toHaveLength(5);
    });
  });

  describe('JavaScript Code Generation', () => {
    it('should generate code for data filtering', async () => {
      const request: CodeGenerationRequest = {
        description: 'Filter items where status is active and age is greater than 18',
        nodeType: 'code',
        workflowContext: {}
      };

      const result = await codeGenerator.generateCode(request);
      
      expect(result.success).toBe(true);
      expect(result.code).toContain('$input.all()');
      expect(result.code).toContain('filter');
      expect(result.code).toContain('status');
      expect(result.code).toContain('age');
      expect(result.validation?.isValid).toBe(true);
    });

    it('should generate code with error handling', async () => {
      const request: CodeGenerationRequest = {
        description: 'Parse JSON data with validation',
        nodeType: 'code',
        workflowContext: {},
        requirements: {
          errorHandling: 'comprehensive'
        }
      };

      const result = await codeGenerator.generateCode(request);
      
      expect(result.code).toContain('try');
      expect(result.code).toContain('catch');
      expect(result.code).toContain('error');
    });

    it('should optimize generated code', async () => {
      const unoptimizedCode = `
var items = $input.all();
var result = [];
for (var i = 0; i < items.length; i++) {
  if (items[i].json.active === true) {
    result.push(items[i]);
  }
}
return result;`;

      const context = {
        intent: { primaryFunction: 'filter' },
        technicalRequirements: {},
        codeComplexity: { level: 'simple' },
        optimizationOpportunities: {}
      } as any;

      const optimized = await optimizationEngine.optimizeCode(unoptimizedCode, context);
      
      expect(optimized).not.toContain('var ');
      expect(optimized).toContain('const');
      expect(optimized.length).toBeLessThan(unoptimizedCode.length);
    });
  });

  describe('Python Code Generation', () => {
    it('should generate Python code for data analysis', async () => {
      const request: CodeGenerationRequest = {
        description: 'Calculate average and sum of numeric fields',
        nodeType: 'code',
        workflowContext: {},
        requirements: {
          language: 'python'
        }
      };

      const result = await codeGenerator.generateCode(request);
      
      expect(result.success).toBe(true);
      expect(result.code).toContain('items = $input.all()');
      expect(result.code).toContain('def ');
      expect(result.code).toContain('return');
      expect(result.code).toMatch(/\[.*"json".*\]/);
    });

    it('should validate Python code syntax', async () => {
      const validPython = `
items = $input.all()
result = []
for item in items:
    data = item['json']
    result.append({'json': data})
return result`;

      const context = {} as any;
      const validation = await pythonAdapter.validatePythonCode(validPython, context);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect Python security issues', async () => {
      const unsafePython = `
items = $input.all()
eval(items[0]['json']['code'])
return items`;

      const context = {} as any;
      const validation = await pythonAdapter.validatePythonCode(unsafePython, context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.type === 'security')).toBe(true);
    });
  });

  describe('Code Validation', () => {
    it('should detect syntax errors', async () => {
      const invalidCode = `
const items = $input.all()
if (items.length > 0 {  // Missing closing parenthesis
  return items;
}`;

      const context = {} as any;
      const validation = await validationEngine.validateCode(invalidCode, context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.type === 'syntax')).toBe(true);
    });

    it('should detect security vulnerabilities', async () => {
      const unsafeCode = `
const items = $input.all();
const code = items[0].json.userCode;
eval(code);  // Security vulnerability
return items;`;

      const context = {} as any;
      const validation = await validationEngine.validateCode(unsafeCode, context);
      
      expect(validation.securityWarnings).toHaveLength(1);
      expect(validation.issues.some(i => i.type === 'security')).toBe(true);
    });

    it('should validate n8n compliance', async () => {
      const nonCompliantCode = `
const data = getData();
return data;  // Not returning n8n format`;

      const context = {} as any;
      const validation = await validationEngine.validateCode(nonCompliantCode, context);
      
      expect(validation.issues.some(i => 
        i.message.includes('n8n') || i.message.includes('format')
      )).toBe(true);
    });
  });

  describe('Code Execution Monitoring', () => {
    it('should monitor code execution performance', async () => {
      const codeId = 'test_code_123';
      const request: CodeGenerationRequest = {
        description: 'Simple data pass-through',
        nodeType: 'code',
        workflowContext: {}
      };
      
      const code = `
const items = $input.all();
return items;`;

      const executionContext = {
        $input: {
          all: () => [
            { json: { id: 1, name: 'Test' } }
          ]
        }
      };

      const result = await executionMonitor.monitorExecution(
        codeId,
        request,
        code,
        executionContext
      );

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.memoryUsed).toBeGreaterThanOrEqual(0);
    });

    it('should track execution statistics', async () => {
      const codeId = 'test_stats_456';
      
      // Simulate multiple executions
      for (let i = 0; i < 5; i++) {
        await executionMonitor.monitorExecution(
          codeId,
          { description: 'Test', nodeType: 'code', workflowContext: {} },
          'return $input.all();',
          { $input: { all: () => [] } }
        );
      }

      const stats = await executionMonitor.getExecutionStats(codeId);
      
      expect(stats.totalExecutions).toBe(5);
      expect(stats.successRate).toBe(100);
      expect(stats.avgExecutionTime).toBeGreaterThan(0);
    });

    it('should handle execution failures', async () => {
      const codeId = 'test_fail_789';
      const code = `
const items = $input.all();
throw new Error('Intentional test error');`;

      const result = await executionMonitor.monitorExecution(
        codeId,
        { description: 'Test', nodeType: 'code', workflowContext: {} },
        code,
        { $input: { all: () => [] } }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Intentional test error');
      expect(result.performanceIssues).toHaveLength(1);
    });
  });

  describe('Integration Tests', () => {
    it('should generate, validate, and optimize code end-to-end', async () => {
      const request: CodeGenerationRequest = {
        description: 'Transform customer orders by calculating totals and applying discounts',
        nodeType: 'code',
        workflowContext: {
          workflowPurpose: 'Order processing'
        },
        requirements: {
          performanceLevel: 'optimized',
          errorHandling: 'comprehensive'
        }
      };

      const result = await codeGenerator.generateCode(request);
      
      expect(result.success).toBe(true);
      expect(result.code).toContain('$input.all()');
      expect(result.code).toContain('try');
      expect(result.validation?.isValid).toBe(true);
      expect(result.metadata.maintainabilityScore).toBeGreaterThan(70);
      expect(result.metadata.securityScore).toBeGreaterThan(80);
    });

    it('should handle multi-language workflow', async () => {
      // JavaScript request
      const jsRequest: CodeGenerationRequest = {
        description: 'Filter active users',
        nodeType: 'code',
        workflowContext: {},
        requirements: { language: 'javascript' }
      };

      const jsResult = await codeGenerator.generateCode(jsRequest);
      expect(jsResult.success).toBe(true);
      expect(jsResult.code).toContain('const');

      // Python request
      const pyRequest: CodeGenerationRequest = {
        description: 'Calculate statistics',
        nodeType: 'code',
        workflowContext: {},
        requirements: { language: 'python' }
      };

      const pyResult = await codeGenerator.generateCode(pyRequest);
      expect(pyResult.success).toBe(true);
      expect(pyResult.code).toContain('def ');
    });
  });

  describe('Performance Tests', () => {
    it('should generate code within reasonable time', async () => {
      const startTime = Date.now();
      
      const request: CodeGenerationRequest = {
        description: 'Complex data transformation with multiple conditions',
        nodeType: 'code',
        workflowContext: {}
      };

      await codeGenerator.generateCode(request);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent code generation', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        description: `Process data set ${i}`,
        nodeType: 'code',
        workflowContext: {}
      }));

      const results = await Promise.all(
        requests.map(req => codeGenerator.generateCode(req))
      );

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});