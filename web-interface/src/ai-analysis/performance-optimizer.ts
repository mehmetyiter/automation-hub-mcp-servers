import { DeepAnalysis, WorkflowArchitecture, DynamicPrompt } from './types';
import { LearningEngine } from './learning-engine';
import { AIAnalyzer } from './ai-analyzer';

export class PerformanceOptimizer {
  private learningEngine: LearningEngine;
  private aiAnalyzer: AIAnalyzer;
  private cache: Map<string, any> = new Map();
  private performanceThresholds = {
    maxResponseTime: 5000, // 5 seconds
    maxNodeCount: 50,
    maxComplexity: 0.8,
    minSuccessRate: 0.9
  };
  
  constructor() {
    this.learningEngine = new LearningEngine();
    this.aiAnalyzer = new AIAnalyzer();
  }
  
  async optimizePromptGeneration(analysis: DeepAnalysis): Promise<any> {
    const cacheKey = this.generateCacheKey(analysis);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Analyze performance metrics
    const metrics = this.learningEngine.getPerformanceMetrics();
    const optimizations = await this.identifyOptimizations(analysis, metrics);
    
    // Apply optimizations
    const optimizedAnalysis = await this.applyOptimizations(analysis, optimizations);
    
    // Cache the result
    this.cache.set(cacheKey, optimizedAnalysis);
    
    // Clean old cache entries
    this.cleanCache();
    
    return optimizedAnalysis;
  }
  
  async validateWorkflowQuality(workflow: WorkflowArchitecture): Promise<{
    isValid: boolean;
    issues: string[];
    score: number;
  }> {
    const issues: string[] = [];
    let score = 100;
    
    // Check node count
    if (workflow.nodes.length > this.performanceThresholds.maxNodeCount) {
      issues.push(`Workflow has ${workflow.nodes.length} nodes, exceeding recommended maximum of ${this.performanceThresholds.maxNodeCount}`);
      score -= 10;
    }
    
    // Check complexity
    if (workflow.estimatedComplexity > this.performanceThresholds.maxComplexity) {
      issues.push(`Workflow complexity (${workflow.estimatedComplexity}) exceeds threshold`);
      score -= 15;
    }
    
    // Check for disconnected nodes
    const disconnectedNodes = this.findDisconnectedNodes(workflow);
    if (disconnectedNodes.length > 0) {
      issues.push(`Found ${disconnectedNodes.length} disconnected nodes: ${disconnectedNodes.join(', ')}`);
      score -= 20;
    }
    
    // Check for missing error handling
    const nodesWithoutErrorHandling = this.findNodesWithoutErrorHandling(workflow);
    if (nodesWithoutErrorHandling.length > 0) {
      issues.push(`${nodesWithoutErrorHandling.length} nodes lack error handling`);
      score -= 5 * nodesWithoutErrorHandling.length;
    }
    
    // Check for circular dependencies
    if (this.hasCircularDependencies(workflow)) {
      issues.push('Workflow contains circular dependencies');
      score -= 30;
    }
    
    // AI-based quality check
    const aiQualityCheck = await this.performAIQualityCheck(workflow);
    issues.push(...aiQualityCheck.issues);
    score = Math.max(0, score - aiQualityCheck.penaltyPoints);
    
    return {
      isValid: score >= 60,
      issues,
      score: Math.max(0, score)
    };
  }
  
  private async identifyOptimizations(analysis: DeepAnalysis, metrics: any): Promise<string[]> {
    const optimizations: string[] = [];
    
    // Check if similar workflows have performance issues
    const similarWorkflowMetrics = this.findSimilarWorkflowMetrics(analysis, metrics);
    
    if (similarWorkflowMetrics.avgExecutionTime > this.performanceThresholds.maxResponseTime) {
      optimizations.push('reduce_complexity');
      optimizations.push('add_caching');
    }
    
    if (analysis.complexityScore > 0.7) {
      optimizations.push('simplify_workflow');
      optimizations.push('break_into_subworkflows');
    }
    
    if (analysis.intent.urgency === 'high') {
      optimizations.push('prioritize_critical_path');
      optimizations.push('add_parallel_processing');
    }
    
    return optimizations;
  }
  
  private async applyOptimizations(analysis: DeepAnalysis, optimizations: string[]): Promise<DeepAnalysis> {
    let optimizedAnalysis = { ...analysis };
    
    for (const optimization of optimizations) {
      switch (optimization) {
        case 'reduce_complexity':
          optimizedAnalysis.complexityScore = Math.min(0.7, optimizedAnalysis.complexityScore);
          break;
        case 'simplify_workflow':
          optimizedAnalysis.constraints.push('Keep workflow simple and maintainable');
          break;
        case 'add_parallel_processing':
          optimizedAnalysis.technicalRequirements.push('Implement parallel processing where possible');
          break;
        case 'prioritize_critical_path':
          optimizedAnalysis.constraints.push('Focus on critical path optimization');
          break;
      }
    }
    
    return optimizedAnalysis;
  }
  
  private async performAIQualityCheck(workflow: WorkflowArchitecture): Promise<{
    issues: string[];
    penaltyPoints: number;
  }> {
    const response = await this.aiAnalyzer.analyze(
      `Analyze this workflow for quality issues:
      ${JSON.stringify(workflow, null, 2)}
      
      Check for:
      1. Security vulnerabilities
      2. Performance bottlenecks
      3. Maintainability issues
      4. Best practice violations
      
      Return issues and severity (1-10) for each.`
    );
    
    const issues: string[] = response.issues || [];
    const penaltyPoints = response.totalSeverity || 0;
    
    return { issues, penaltyPoints };
  }
  
  private findDisconnectedNodes(workflow: WorkflowArchitecture): string[] {
    const connectedNodes = new Set<string>();
    
    // Add all nodes that appear in connections
    workflow.connections.forEach(conn => {
      connectedNodes.add(conn.source);
      connectedNodes.add(conn.target);
    });
    
    // Find nodes not in connections
    return workflow.nodes
      .map(n => n.id)
      .filter(id => !connectedNodes.has(id));
  }
  
  private findNodesWithoutErrorHandling(workflow: WorkflowArchitecture): string[] {
    return workflow.nodes
      .filter(node => {
        const hasErrorHandling = 
          node.configuration.errorHandling ||
          node.configuration.continueOnFail ||
          node.type.includes('error') ||
          node.type.includes('catch');
        return !hasErrorHandling;
      })
      .map(n => n.id);
  }
  
  private hasCircularDependencies(workflow: WorkflowArchitecture): boolean {
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    workflow.connections.forEach(conn => {
      if (!graph.has(conn.source)) {
        graph.set(conn.source, []);
      }
      graph.get(conn.source)!.push(conn.target);
    });
    
    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of workflow.nodes.map(n => n.id)) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return true;
      }
    }
    
    return false;
  }
  
  private findSimilarWorkflowMetrics(analysis: DeepAnalysis, metrics: any): any {
    // Find metrics for workflows with similar characteristics
    const relevantMetrics = Object.entries(metrics)
      .filter(([key]) => key.includes(analysis.intent.primaryGoal.toLowerCase()))
      .map(([_, value]) => value);
    
    if (relevantMetrics.length === 0) {
      return { avgExecutionTime: 0, successRate: 1 };
    }
    
    // Calculate averages
    const avgExecutionTime = relevantMetrics.reduce((sum: number, m: any) => 
      sum + (m.avgExecutionTime || 0), 0) / relevantMetrics.length;
    
    const successRate = relevantMetrics.reduce((sum: number, m: any) => 
      sum + (m.successRate || 1), 0) / relevantMetrics.length;
    
    return { avgExecutionTime, successRate };
  }
  
  private generateCacheKey(analysis: DeepAnalysis): string {
    return `${analysis.intent.primaryGoal}_${analysis.complexityScore}_${analysis.intent.scope}`;
  }
  
  private cleanCache(): void {
    // Keep only 100 most recent entries
    if (this.cache.size > 100) {
      const entriesToDelete = this.cache.size - 100;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < entriesToDelete; i++) {
        this.cache.delete(keys[i]);
      }
    }
  }
}