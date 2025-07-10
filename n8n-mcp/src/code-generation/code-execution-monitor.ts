import { 
  CodeExecutionResult, 
  CodeGenerationRequest,
  ExecutionMetrics,
  PerformanceIssue 
} from './types';
import { CodeGenerationLearningEngine } from './code-generation-learning-engine';
import { CodeGenerationDatabase } from './database/code-generation-db';
import * as fs from 'fs/promises';
import * as path from 'path';

export class CodeExecutionMonitor {
  private learningEngine: CodeGenerationLearningEngine;
  private database: CodeGenerationDatabase;
  private executionHistory: Map<string, ExecutionMetrics[]>;
  private performanceThresholds: {
    executionTime: number;
    memoryUsage: number;
    errorRate: number;
  };
  private monitoringDataPath: string;

  constructor(provider?: string) {
    this.learningEngine = new CodeGenerationLearningEngine(provider);
    this.database = new CodeGenerationDatabase();
    this.executionHistory = new Map();
    this.performanceThresholds = {
      executionTime: 1000, // 1 second
      memoryUsage: 50 * 1024 * 1024, // 50MB
      errorRate: 0.05 // 5%
    };
    this.monitoringDataPath = path.join(process.cwd(), 'monitoring-data', 'code-execution');
    this.initializeMonitoring();
  }

  private async initializeMonitoring() {
    try {
      await fs.mkdir(this.monitoringDataPath, { recursive: true });
      await this.loadExecutionHistory();
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
    }
  }

  async monitorExecution(
    codeId: string,
    request: CodeGenerationRequest,
    generatedCode: string,
    executionContext: any
  ): Promise<CodeExecutionResult> {
    console.log('📊 Monitoring code execution...');
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      // Create execution sandbox
      const result = await this.executeInSandbox(generatedCode, executionContext);
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      const executionMetrics: ExecutionMetrics = {
        codeId,
        executionTime: endTime - startTime,
        memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
        success: result.success,
        error: result.error,
        timestamp: new Date().toISOString(),
        inputSize: JSON.stringify(executionContext).length,
        outputSize: result.output ? JSON.stringify(result.output).length : 0
      };
      
      // Store execution metrics
      await this.recordExecutionMetrics(codeId, executionMetrics);
      
      // Analyze performance
      const performanceIssues = this.analyzePerformance(executionMetrics);
      
      // Learn from execution
      await this.learningEngine.learnFromCodeSuccess(request, generatedCode, result);
      
      // Generate execution result
      const executionResult: CodeExecutionResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        executionTime: executionMetrics.executionTime,
        memoryUsed: executionMetrics.memoryUsed,
        performanceIssues
      };
      
      // Save monitoring data
      await this.saveMonitoringData(codeId, executionMetrics, performanceIssues);
      
      return executionResult;
      
    } catch (error: any) {
      const executionResult: CodeExecutionResult = {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
        performanceIssues: [{
          type: 'runtime_error',
          severity: 'critical',
          description: `Execution failed: ${error.message}`,
          suggestion: 'Review code logic and error handling'
        }]
      };
      
      // Learn from failure
      await this.learningEngine.learnFromCodeSuccess(request, generatedCode, executionResult);
      
      return executionResult;
    }
  }

  private async executeInSandbox(code: string, context: any): Promise<any> {
    try {
      // Create a safe execution environment
      const sandbox = {
        console: {
          log: (...args: any[]) => console.log('[SANDBOX]', ...args),
          error: (...args: any[]) => console.error('[SANDBOX]', ...args),
          warn: (...args: any[]) => console.warn('[SANDBOX]', ...args)
        },
        $input: context.$input || { all: () => [] },
        $json: context.$json || {},
        $node: context.$node || {},
        $workflow: context.$workflow || {},
        $item: context.$item || {},
        // Add common n8n helpers
        DateTime: context.DateTime,
        Buffer: Buffer,
        JSON: JSON,
        Object: Object,
        Array: Array,
        String: String,
        Number: Number,
        Math: Math,
        Date: Date,
        RegExp: RegExp,
        // Track execution metrics
        __executionMetrics: {
          operations: 0,
          maxDepth: 0,
          currentDepth: 0
        }
      };
      
      // Wrap code with monitoring
      const monitoredCode = this.wrapCodeWithMonitoring(code);
      
      // Create function from code
      const fn = new Function(...Object.keys(sandbox), monitoredCode);
      
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), 5000);
      });
      
      const executionPromise = Promise.resolve(fn(...Object.values(sandbox)));
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      return {
        success: true,
        output: result,
        metrics: sandbox.__executionMetrics
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: null
      };
    }
  }

  private wrapCodeWithMonitoring(code: string): string {
    return `
try {
  // Track operation count
  const originalMap = Array.prototype.map;
  const originalFilter = Array.prototype.filter;
  const originalForEach = Array.prototype.forEach;
  
  Array.prototype.map = function(...args) {
    __executionMetrics.operations++;
    return originalMap.apply(this, args);
  };
  
  Array.prototype.filter = function(...args) {
    __executionMetrics.operations++;
    return originalFilter.apply(this, args);
  };
  
  Array.prototype.forEach = function(...args) {
    __executionMetrics.operations++;
    return originalForEach.apply(this, args);
  };
  
  // User code
  ${code}
  
} finally {
  // Restore original methods
  Array.prototype.map = originalMap;
  Array.prototype.filter = originalFilter;
  Array.prototype.forEach = originalForEach;
}`;
  }

  private async recordExecutionMetrics(codeId: string, metrics: ExecutionMetrics): Promise<void> {
    // Store in memory cache
    if (!this.executionHistory.has(codeId)) {
      this.executionHistory.set(codeId, []);
    }
    
    const history = this.executionHistory.get(codeId)!;
    history.push(metrics);
    
    // Keep only last 100 executions per code in memory
    if (history.length > 100) {
      history.shift();
    }
    
    // Also save to database
    try {
      await this.database.saveExecutionMetrics(metrics);
    } catch (error) {
      console.error('Failed to save execution metrics to database:', error);
    }
  }

  private analyzePerformance(metrics: ExecutionMetrics): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    
    // Check execution time
    if (metrics.executionTime > this.performanceThresholds.executionTime) {
      issues.push({
        type: 'slow_execution',
        severity: 'warning',
        description: `Execution took ${metrics.executionTime}ms (threshold: ${this.performanceThresholds.executionTime}ms)`,
        suggestion: 'Consider optimizing loops or using more efficient algorithms'
      });
    }
    
    // Check memory usage
    if (metrics.memoryUsed > this.performanceThresholds.memoryUsage) {
      issues.push({
        type: 'high_memory',
        severity: 'warning',
        description: `High memory usage: ${(metrics.memoryUsed / 1024 / 1024).toFixed(2)}MB`,
        suggestion: 'Consider streaming data or processing in chunks'
      });
    }
    
    // Check input/output ratio
    if (metrics.outputSize > metrics.inputSize * 10) {
      issues.push({
        type: 'data_explosion',
        severity: 'info',
        description: 'Output data is significantly larger than input',
        suggestion: 'Verify if all generated data is necessary'
      });
    }
    
    return issues;
  }

  async getExecutionStats(codeId: string): Promise<{
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    avgMemoryUsed: number;
    commonErrors: string[];
    performanceTrend: 'improving' | 'stable' | 'degrading';
  }> {
    // Get history from database
    let history: ExecutionMetrics[];
    try {
      history = await this.database.getExecutionMetrics(codeId);
    } catch (error) {
      history = this.executionHistory.get(codeId) || [];
    }
    
    if (history.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgExecutionTime: 0,
        avgMemoryUsed: 0,
        commonErrors: [],
        performanceTrend: 'stable'
      };
    }
    
    const successCount = history.filter(m => m.success).length;
    const totalTime = history.reduce((sum, m) => sum + m.executionTime, 0);
    const totalMemory = history.reduce((sum, m) => sum + m.memoryUsed, 0);
    
    // Collect errors
    const errors = history
      .filter(m => !m.success && m.error)
      .map(m => m.error!)
      .reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const commonErrors = Object.entries(errors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);
    
    // Analyze performance trend
    const recentHistory = history.slice(-10);
    const olderHistory = history.slice(-20, -10);
    
    const recentAvgTime = recentHistory.reduce((sum, m) => sum + m.executionTime, 0) / recentHistory.length;
    const olderAvgTime = olderHistory.length > 0 
      ? olderHistory.reduce((sum, m) => sum + m.executionTime, 0) / olderHistory.length 
      : recentAvgTime;
    
    let performanceTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentAvgTime < olderAvgTime * 0.9) {
      performanceTrend = 'improving';
    } else if (recentAvgTime > olderAvgTime * 1.1) {
      performanceTrend = 'degrading';
    }
    
    return {
      totalExecutions: history.length,
      successRate: (successCount / history.length) * 100,
      avgExecutionTime: totalTime / history.length,
      avgMemoryUsed: totalMemory / history.length,
      commonErrors,
      performanceTrend
    };
  }

  async provideFeedback(
    codeId: string,
    feedback: {
      rating: number; // 1-5
      worked: boolean;
      issues?: string[];
      suggestions?: string[];
    }
  ): Promise<void> {
    console.log('💬 Processing user feedback...');
    
    try {
      // Save to database
      await this.database.saveUserFeedback(codeId, feedback);
      
      // Update learning engine based on feedback
      if (!feedback.worked || feedback.rating < 3) {
        // Learn from negative feedback
        console.log('📚 Learning from negative feedback...');
        // This would trigger re-analysis of the generated code
      }
      
    } catch (error) {
      console.error('Failed to save feedback:', error);
    }
  }

  private async loadFeedback(codeId: string): Promise<any[]> {
    try {
      return await this.database.getUserFeedback(codeId);
    } catch {
      return [];
    }
  }

  private async saveMonitoringData(
    codeId: string, 
    metrics: ExecutionMetrics, 
    issues: PerformanceIssue[]
  ): Promise<void> {
    try {
      const monitoringFile = path.join(this.monitoringDataPath, `monitoring_${codeId}.json`);
      
      const monitoringData = {
        codeId,
        latestExecution: metrics,
        performanceIssues: issues,
        stats: await this.getExecutionStats(codeId),
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(monitoringFile, JSON.stringify(monitoringData, null, 2));
    } catch (error) {
      console.error('Failed to save monitoring data:', error);
    }
  }

  private async loadExecutionHistory(): Promise<void> {
    try {
      // Load recent execution metrics from database
      // This would need a method to get all recent metrics
      // For now, we'll start with empty cache
      console.log('📊 Execution history will be loaded from database on demand');
    } catch (error) {
      console.log('📝 No existing execution history found');
    }
  }

  async generatePerformanceReport(codeId: string): Promise<string> {
    const stats = await this.getExecutionStats(codeId);
    const feedback = await this.loadFeedback(codeId);
    
    const report = `
# Code Execution Performance Report
## Code ID: ${codeId}

### Execution Statistics
- Total Executions: ${stats.totalExecutions}
- Success Rate: ${stats.successRate.toFixed(2)}%
- Average Execution Time: ${stats.avgExecutionTime.toFixed(2)}ms
- Average Memory Used: ${(stats.avgMemoryUsed / 1024 / 1024).toFixed(2)}MB
- Performance Trend: ${stats.performanceTrend}

### Common Errors
${stats.commonErrors.length > 0 ? stats.commonErrors.map(e => `- ${e}`).join('\n') : 'No errors recorded'}

### User Feedback (${feedback.length} responses)
${feedback.length > 0 ? 
  `- Average Rating: ${(feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)}/5
- Success Rate: ${(feedback.filter(f => f.worked).length / feedback.length * 100).toFixed(0)}%` 
  : 'No feedback provided yet'}

### Recommendations
${this.generateRecommendations(stats, feedback)}
`;
    
    return report;
  }

  private generateRecommendations(stats: any, feedback: any[]): string {
    const recommendations: string[] = [];
    
    if (stats.successRate < 90) {
      recommendations.push('- Improve error handling to increase reliability');
    }
    
    if (stats.avgExecutionTime > this.performanceThresholds.executionTime) {
      recommendations.push('- Optimize algorithms to reduce execution time');
    }
    
    if (stats.performanceTrend === 'degrading') {
      recommendations.push('- Investigate recent changes that may have impacted performance');
    }
    
    if (feedback.length > 0) {
      const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
      if (avgRating < 3.5) {
        recommendations.push('- Address user feedback to improve code quality');
      }
    }
    
    return recommendations.length > 0 ? recommendations.join('\n') : '- Code is performing well';
  }
}