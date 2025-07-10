import { 
  CodeGenerationRequest, 
  CodeExecutionResult, 
  LearningData, 
  CodePattern 
} from './types';
import { AIService } from '../ai-service';
import * as fs from 'fs/promises';
import * as path from 'path';

export class CodeGenerationLearningEngine {
  private aiService: AIService;
  private learningDataPath: string;
  private patterns: Map<string, CodePattern>;
  private successfulPatterns: CodePattern[] = [];
  private failurePatterns: Map<string, string[]> = new Map();

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.learningDataPath = path.join(process.cwd(), 'learning-data', 'code-generation');
    this.patterns = new Map();
    this.initializeLearningData();
  }

  private async initializeLearningData() {
    try {
      // Create learning data directory if it doesn't exist
      await fs.mkdir(this.learningDataPath, { recursive: true });
      
      // Load existing patterns
      await this.loadPatterns();
    } catch (error) {
      console.error('Failed to initialize learning data:', error);
    }
  }

  async learnFromCodeSuccess(
    request: CodeGenerationRequest,
    generatedCode: string,
    executionResult: CodeExecutionResult
  ): Promise<void> {
    console.log('📚 Learning from code execution...');
    
    if (executionResult.success) {
      await this.reinforceSuccessfulPatterns(request, generatedCode, executionResult);
    } else {
      await this.analyzeFailurePatterns(request, generatedCode, executionResult);
    }
    
    // Save learning data
    await this.saveLearningData({
      request,
      generatedCode,
      executionResult,
      patterns: Array.from(this.patterns.values()),
      timestamp: new Date().toISOString()
    });
  }

  private async reinforceSuccessfulPatterns(
    request: CodeGenerationRequest,
    code: string,
    result: CodeExecutionResult
  ): Promise<void> {
    
    const learningPrompt = `
TASK: Analyze this successful code generation and extract reusable patterns.

ORIGINAL REQUEST:
${JSON.stringify(request, null, 2)}

GENERATED CODE:
${code}

EXECUTION RESULT:
${JSON.stringify(result, null, 2)}

Extract learnings for future code generation:

{
  "successful_patterns": {
    "code_structure": "What code structure patterns worked well?",
    "algorithm_approaches": "What algorithmic approaches were effective?",
    "error_handling": "What error handling patterns were successful?",
    "data_processing": "What data processing techniques worked?",
    "performance_optimizations": "What performance optimizations were effective?"
  },
  "reusable_components": {
    "validation_functions": ["reusable validation patterns"],
    "calculation_methods": ["effective calculation approaches"],
    "transformation_logic": ["successful data transformation patterns"],
    "error_recovery": ["effective error recovery strategies"]
  },
  "adaptation_guidelines": {
    "when_to_apply": ["scenarios where these patterns should be used"],
    "how_to_modify": ["how to adapt these patterns for different contexts"],
    "performance_considerations": ["performance implications to consider"]
  }
}`;

    try {
      const learnings = await this.aiService.getJSONResponse(learningPrompt);
      
      // Extract and store patterns
      await this.extractAndStorePatterns(learnings, code, result);
      
      // Update success metrics
      this.updateSuccessMetrics(request, result);
      
    } catch (error) {
      console.error('Failed to analyze successful patterns:', error);
    }
  }

  private async analyzeFailurePatterns(
    request: CodeGenerationRequest,
    code: string,
    result: CodeExecutionResult
  ): Promise<void> {
    
    const failurePrompt = `
TASK: Analyze this failed code generation to identify what went wrong.

REQUEST:
${JSON.stringify(request, null, 2)}

GENERATED CODE:
${code}

FAILURE RESULT:
${JSON.stringify(result, null, 2)}

Identify:
{
  "failure_reasons": ["why did this code fail?"],
  "problematic_patterns": ["what patterns caused issues?"],
  "missing_elements": ["what was missing from the code?"],
  "improvement_suggestions": ["how to avoid this in future?"]
}`;

    try {
      const analysis = await this.aiService.getJSONResponse(failurePrompt);
      
      // Store failure patterns
      const key = `${request.nodeType}_${request.description.substring(0, 50)}`;
      this.failurePatterns.set(key, analysis.failure_reasons || []);
      
      // Learn from failures
      await this.updatePatternsFromFailure(analysis);
      
    } catch (error) {
      console.error('Failed to analyze failure patterns:', error);
    }
  }

  private async extractAndStorePatterns(learnings: any, code: string, result: CodeExecutionResult): Promise<void> {
    // Extract validation patterns
    if (learnings.reusable_components?.validation_functions) {
      for (const validation of learnings.reusable_components.validation_functions) {
        const pattern: CodePattern = {
          id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: validation,
          description: 'Validation pattern extracted from successful code',
          pattern: this.extractCodePattern(code, 'validation'),
          usage: learnings.adaptation_guidelines?.when_to_apply || [],
          performance: result.executionTime < 100 ? 0.9 : 0.7,
          reliability: 0.95,
          category: 'validation'
        };
        
        this.patterns.set(pattern.id, pattern);
        this.successfulPatterns.push(pattern);
      }
    }
    
    // Extract calculation patterns
    if (learnings.reusable_components?.calculation_methods) {
      for (const calc of learnings.reusable_components.calculation_methods) {
        const pattern: CodePattern = {
          id: `calculation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: calc,
          description: 'Calculation pattern from successful implementation',
          pattern: this.extractCodePattern(code, 'calculation'),
          usage: learnings.adaptation_guidelines?.when_to_apply || [],
          performance: 0.85,
          reliability: 0.9,
          category: 'calculation'
        };
        
        this.patterns.set(pattern.id, pattern);
      }
    }
  }

  private extractCodePattern(code: string, type: string): string {
    // Extract relevant code pattern based on type
    const lines = code.split('\n');
    let pattern = '';
    let capturing = false;
    
    for (const line of lines) {
      if (type === 'validation' && line.includes('validate') || line.includes('check')) {
        capturing = true;
      } else if (type === 'calculation' && line.includes('calculate') || line.includes('compute')) {
        capturing = true;
      }
      
      if (capturing) {
        pattern += line + '\n';
        
        // Stop at the end of the function or block
        if (line.includes('}') && !line.includes('{')) {
          break;
        }
      }
    }
    
    return pattern || '// Pattern extraction pending';
  }

  private updateSuccessMetrics(request: CodeGenerationRequest, result: CodeExecutionResult): void {
    // Track success metrics for different request types
    const metricKey = `${request.nodeType}_success_rate`;
    const currentMetrics = this.getMetrics(metricKey);
    
    currentMetrics.totalAttempts = (currentMetrics.totalAttempts || 0) + 1;
    currentMetrics.successCount = (currentMetrics.successCount || 0) + 1;
    currentMetrics.avgExecutionTime = 
      ((currentMetrics.avgExecutionTime || 0) * (currentMetrics.totalAttempts - 1) + result.executionTime) / 
      currentMetrics.totalAttempts;
    
    this.saveMetrics(metricKey, currentMetrics);
  }

  private async updatePatternsFromFailure(analysis: any): Promise<void> {
    // Mark problematic patterns
    if (analysis.problematic_patterns) {
      for (const problematicPattern of analysis.problematic_patterns) {
        // Find and mark patterns as problematic
        this.patterns.forEach((pattern, id) => {
          if (pattern.pattern.includes(problematicPattern)) {
            pattern.reliability = Math.max(0, pattern.reliability - 0.1);
          }
        });
      }
    }
  }

  async getRelevantPatterns(request: CodeGenerationRequest): Promise<CodePattern[]> {
    const relevantPatterns: CodePattern[] = [];
    const requestContext = request.description.toLowerCase();
    
    // Filter patterns based on request context
    this.patterns.forEach(pattern => {
      // Check if pattern is relevant to the request
      const isRelevant = pattern.usage.some(use => 
        requestContext.includes(use.toLowerCase())
      ) || pattern.name.toLowerCase().includes(requestContext.substring(0, 20));
      
      if (isRelevant && pattern.reliability > 0.7) {
        relevantPatterns.push(pattern);
      }
    });
    
    // Sort by reliability and performance
    return relevantPatterns.sort((a, b) => 
      (b.reliability * b.performance) - (a.reliability * a.performance)
    ).slice(0, 5); // Top 5 patterns
  }

  async suggestCodePatterns(context: string): Promise<string[]> {
    const patterns = await this.getRelevantPatterns({
      description: context,
      nodeType: 'code',
      workflowContext: {}
    });
    
    return patterns.map(p => p.pattern);
  }

  private async loadPatterns(): Promise<void> {
    try {
      const patternsFile = path.join(this.learningDataPath, 'patterns.json');
      const data = await fs.readFile(patternsFile, 'utf-8');
      const savedPatterns = JSON.parse(data);
      
      savedPatterns.forEach((pattern: CodePattern) => {
        this.patterns.set(pattern.id, pattern);
      });
      
      console.log(`📖 Loaded ${this.patterns.size} code patterns`);
    } catch (error) {
      console.log('📝 No existing patterns found, starting fresh');
    }
  }

  private async saveLearningData(data: LearningData): Promise<void> {
    try {
      const filename = `learning_${Date.now()}.json`;
      const filepath = path.join(this.learningDataPath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      
      // Also save current patterns
      await this.savePatterns();
    } catch (error) {
      console.error('Failed to save learning data:', error);
    }
  }

  private async savePatterns(): Promise<void> {
    try {
      const patternsFile = path.join(this.learningDataPath, 'patterns.json');
      const patterns = Array.from(this.patterns.values());
      
      await fs.writeFile(patternsFile, JSON.stringify(patterns, null, 2));
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }

  private getMetrics(key: string): any {
    // In a real implementation, this would load from a database
    return {};
  }

  private saveMetrics(key: string, metrics: any): void {
    // In a real implementation, this would save to a database
    console.log(`📊 Updated metrics for ${key}:`, metrics);
  }

  async getSuccessRate(nodeType: string): Promise<number> {
    const metrics = this.getMetrics(`${nodeType}_success_rate`);
    if (!metrics.totalAttempts) return 0;
    
    return (metrics.successCount / metrics.totalAttempts) * 100;
  }

  async getCommonFailures(nodeType: string): Promise<string[]> {
    const failures: string[] = [];
    
    this.failurePatterns.forEach((reasons, key) => {
      if (key.startsWith(nodeType)) {
        failures.push(...reasons);
      }
    });
    
    return [...new Set(failures)]; // Remove duplicates
  }
}