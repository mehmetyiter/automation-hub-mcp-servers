import { CodeContext, CodeMetadata } from './types.js';
import { AIService } from '../ai-service.js';

export class CodeOptimizationEngine {
  private aiService: AIService;
  private optimizationPatterns: Map<string, OptimizationPattern>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.initializeOptimizationPatterns();
  }

  private initializeOptimizationPatterns() {
    this.optimizationPatterns = new Map([
      ['loop_optimization', {
        pattern: /for\s*\([^)]*\)\s*{[^}]*}/g,
        optimization: 'Consider using array methods (map, filter, reduce) for better performance'
      }],
      ['string_concatenation', {
        pattern: /(\+=.*){3,}/g,
        optimization: 'Use array.join() for multiple string concatenations'
      }],
      ['repeated_access', {
        pattern: /(\w+\.\w+\.\w+)/g,
        optimization: 'Cache deeply nested property access'
      }],
      ['inefficient_search', {
        pattern: /\.find\([^)]*\).*\.find\([^)]*\)/g,
        optimization: 'Use Map or Set for multiple lookups'
      }]
    ]);
  }

  async optimizeCode(code: string, context: CodeContext): Promise<string> {
    console.log('🔧 Optimizing code for performance and readability...');

    // Apply pattern-based optimizations
    let optimizedCode = this.applyPatternOptimizations(code);

    // Apply AI-based optimizations
    optimizedCode = await this.applyAIOptimizations(optimizedCode, context);

    // Apply n8n specific optimizations
    optimizedCode = this.applyN8nOptimizations(optimizedCode);

    // Apply readability optimizations
    optimizedCode = this.improveReadability(optimizedCode, context);

    return optimizedCode;
  }

  private applyPatternOptimizations(code: string): string {
    let optimizedCode = code;

    // Replace var with const/let
    optimizedCode = optimizedCode.replace(/\bvar\s+/g, 'const ');

    // Optimize array operations
    optimizedCode = this.optimizeArrayOperations(optimizedCode);

    // Optimize object access
    optimizedCode = this.optimizeObjectAccess(optimizedCode);

    // Optimize string operations
    optimizedCode = this.optimizeStringOperations(optimizedCode);

    return optimizedCode;
  }

  private async applyAIOptimizations(code: string, context: CodeContext): Promise<string> {
    const optimizationPrompt = `
Optimize this JavaScript code for better performance and maintainability:

ORIGINAL CODE:
${code}

CONTEXT:
${JSON.stringify(context, null, 2)}

Apply these optimizations:
1. Performance improvements (reduce time complexity)
2. Memory efficiency
3. Code readability
4. Error handling improvements
5. Modern JavaScript features

Return ONLY the optimized code without explanations or markdown.
The code should be functionally identical but more efficient.

Focus on:
- Reducing nested loops
- Caching repeated calculations
- Using appropriate data structures
- Minimizing object/array copies
- Efficient error handling`;

    try {
      const optimizedCode = await this.aiService.callAI(optimizationPrompt);
      // Validate the optimized code still works
      new Function(optimizedCode);
      return optimizedCode;
    } catch (error) {
      console.error('AI optimization failed, returning original code:', error);
      return code;
    }
  }

  private optimizeArrayOperations(code: string): string {
    // Replace for loops with array methods where appropriate
    const forLoopPattern = /for\s*\(\s*(?:let|const|var)\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\w+)\.length\s*;\s*\1\+\+\s*\)\s*{\s*([^}]+)\s*}/g;
    
    return code.replace(forLoopPattern, (match, index, array, body) => {
      // Check if it's a simple transformation
      if (body.includes('push') && !body.includes('if') && !body.includes('break')) {
        return `${array}.map((item, ${index}) => { ${body} })`;
      }
      return match;
    });
  }

  private optimizeObjectAccess(code: string): string {
    // Cache repeated object access
    const lines = code.split('\n');
    const accessCounts = new Map<string, number>();
    
    // Count property accesses
    lines.forEach(line => {
      const matches = line.match(/(\w+(?:\.\w+){2,})/g) || [];
      matches.forEach(match => {
        accessCounts.set(match, (accessCounts.get(match) || 0) + 1);
      });
    });

    // Add caching for frequently accessed properties
    const cachingCode: string[] = [];
    accessCounts.forEach((count, access) => {
      if (count > 2) {
        const cacheName = access.split('.').pop() + 'Cache';
        cachingCode.push(`const ${cacheName} = ${access};`);
      }
    });

    if (cachingCode.length > 0) {
      // Insert caching code after variable declarations
      const insertIndex = lines.findIndex(line => line.includes('const inputItems')) + 1;
      lines.splice(insertIndex, 0, '', ...cachingCode, '');
    }

    return lines.join('\n');
  }

  private optimizeStringOperations(code: string): string {
    // Replace string concatenation in loops with array join
    const stringConcatPattern = /let\s+(\w+)\s*=\s*['"`]['"`];\s*for[^{]*{[^}]*\1\s*\+=([^}]+)}/g;
    
    return code.replace(stringConcatPattern, (match, varName, concatenation) => {
      return `const ${varName}Parts = [];\nfor${match.substring(match.indexOf('for') + 3, match.indexOf('{'))}{
        ${varName}Parts.push(${concatenation});
      }\nconst ${varName} = ${varName}Parts.join('');`;
    });
  }

  private applyN8nOptimizations(code: string): string {
    // Optimize item processing
    if (code.includes('$input.all()')) {
      // Add early return for empty input
      if (!code.includes('length === 0')) {
        code = code.replace(
          'const inputItems = $input.all();',
          'const inputItems = $input.all();\nif (!inputItems || inputItems.length === 0) {\n  return [];\n}'
        );
      }
    }

    // Optimize error handling for items
    if (code.includes('for') && code.includes('item') && !code.includes('continue')) {
      code = code.replace(
        /} catch \(error\) {/g,
        '} catch (error) {\n    // Continue processing other items instead of failing completely'
      );
    }

    return code;
  }

  private improveReadability(code: string, context: CodeContext): string {
    const lines = code.split('\n');
    const improvedLines: string[] = [];
    let inFunction = false;
    let functionDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Add section comments
      if (context.codeComplexity.level === 'complex' || context.codeComplexity.level === 'advanced') {
        if (trimmedLine.startsWith('// Validate')) {
          improvedLines.push('// ========== Input Validation ==========');
        } else if (trimmedLine.startsWith('// Main processing')) {
          improvedLines.push('// ========== Main Processing Logic ==========');
        } else if (trimmedLine.includes('error')) {
          improvedLines.push('// ========== Error Handling ==========');
        }
      }

      // Improve variable names
      let improvedLine = line;
      improvedLine = improvedLine.replace(/\b(i|j|k)\b(?=\s*[=<>])/g, match => {
        return match === 'i' ? 'index' : match === 'j' ? 'innerIndex' : 'iterator';
      });

      // Add spacing around operators
      improvedLine = improvedLine.replace(/([+\-*/%=<>!&|])(?=[^\s=])/g, '$1 ');
      improvedLine = improvedLine.replace(/(?<=[^\s=])([+\-*/%=<>!&|])/g, ' $1');

      improvedLines.push(improvedLine);

      // Add blank lines for readability
      if (trimmedLine.endsWith('}') && functionDepth === 0 && i < lines.length - 1) {
        improvedLines.push('');
      }

      // Track function depth
      functionDepth += (line.match(/{/g) || []).length;
      functionDepth -= (line.match(/}/g) || []).length;
    }

    return improvedLines.join('\n');
  }

  generateMetadata(code: string, context: CodeContext): CodeMetadata {
    const lines = code.split('\n').filter(line => line.trim()).length;
    const complexity = this.calculateComplexity(code);
    
    return {
      language: 'javascript',
      estimatedExecutionTime: this.estimateExecutionTime(code, context),
      memoryFootprint: this.estimateMemoryFootprint(code),
      complexity,
      maintainabilityScore: this.calculateMaintainability(code, lines, complexity),
      securityScore: this.calculateSecurityScore(code),
      generatedAt: new Date().toISOString()
    };
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;
    
    // Count control structures
    complexity += (code.match(/\bif\b/g) || []).length;
    complexity += (code.match(/\bfor\b/g) || []).length * 2;
    complexity += (code.match(/\bwhile\b/g) || []).length * 2;
    complexity += (code.match(/\bswitch\b/g) || []).length;
    complexity += (code.match(/\bcatch\b/g) || []).length;
    complexity += (code.match(/\?\s*:/g) || []).length; // ternary operators
    
    return complexity;
  }

  private estimateExecutionTime(code: string, context: CodeContext): number {
    let baseTime = 10; // Base 10ms
    
    // Add time for loops
    const loopCount = (code.match(/\b(for|while)\b/g) || []).length;
    baseTime += loopCount * 50;
    
    // Add time for async operations
    if (context.codeComplexity.asyncOperations) {
      baseTime += 100;
    }
    
    // Add time for complex operations
    if (context.codeComplexity.level === 'complex' || context.codeComplexity.level === 'advanced') {
      baseTime *= 2;
    }
    
    return baseTime;
  }

  private estimateMemoryFootprint(code: string): string {
    const arrayCreations = (code.match(/\[\]/g) || []).length;
    const objectCreations = (code.match(/\{\}/g) || []).length;
    
    const estimatedKB = 1 + (arrayCreations * 0.5) + (objectCreations * 0.5);
    
    if (estimatedKB < 10) return 'Low (<10KB)';
    if (estimatedKB < 100) return 'Medium (10-100KB)';
    return 'High (>100KB)';
  }

  private calculateMaintainability(code: string, lines: number, complexity: number): number {
    let score = 100;
    
    // Deduct for high complexity
    score -= Math.min(30, complexity * 2);
    
    // Deduct for too many lines
    if (lines > 100) score -= 20;
    else if (lines > 50) score -= 10;
    
    // Deduct for lack of comments
    const commentCount = (code.match(/\/\//g) || []).length;
    if (commentCount < lines / 10) score -= 10;
    
    // Bonus for good practices
    if (code.includes('const')) score += 5;
    if (code.includes('try')) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateSecurityScore(code: string): number {
    let score = 100;
    
    // Check for security issues
    if (code.includes('eval')) score -= 50;
    if (code.includes('Function(')) score -= 30;
    if (code.includes('innerHTML')) score -= 20;
    if (!code.includes('try')) score -= 10;
    
    return Math.max(0, score);
  }
}

interface OptimizationPattern {
  pattern: RegExp;
  optimization: string;
}