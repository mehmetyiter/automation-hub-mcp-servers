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
    
    // Analyze complexity vs performance
    if (analysis.workflow_characteristics?.complexity === 'enterprise') {
      optimizations.push('break_into_subworkflows');
      optimizations.push('implement_caching');
      optimizations.push('use_connection_pooling');
    } else if (analysis.complexityScore > 0.7) {
      optimizations.push('simplify_workflow');
      optimizations.push('reduce_decision_points');
    }
    
    // Analyze integration patterns
    if (analysis.workflow_characteristics?.external_integrations?.length > 5) {
      optimizations.push('batch_api_calls');
      optimizations.push('implement_circuit_breaker');
      optimizations.push('add_request_throttling');
    }
    
    // Analyze real-time requirements
    if (analysis.technical_requirements?.real_time_requirements) {
      optimizations.push('optimize_critical_path');
      optimizations.push('use_event_driven_architecture');
      optimizations.push('implement_async_processing');
    }
    
    // Analyze urgency and scope
    if (analysis.intent.urgency === 'high') {
      optimizations.push('prioritize_critical_path');
      optimizations.push('add_parallel_processing');
      optimizations.push('implement_fast_fail');
    }
    
    // Analyze data patterns
    if (analysis.entities.data.length > 10) {
      optimizations.push('implement_data_streaming');
      optimizations.push('add_data_validation_early');
      optimizations.push('use_data_compression');
    }
    
    return [...new Set(optimizations)]; // Remove duplicates
  }
  
  private async applyOptimizations(analysis: DeepAnalysis, optimizations: string[]): Promise<DeepAnalysis> {
    // Create a deep copy of the analysis
    const optimizedAnalysis = JSON.parse(JSON.stringify(analysis));
    
    // Apply each optimization
    for (const optimization of optimizations) {
      switch (optimization) {
        case 'reduce_complexity':
          optimizedAnalysis.complexityScore = Math.min(0.7, optimizedAnalysis.complexityScore);
          optimizedAnalysis.constraints.push('Reduce workflow complexity for better performance');
          break;
          
        case 'simplify_workflow':
          optimizedAnalysis.constraints.push('Keep workflow simple and maintainable');
          optimizedAnalysis.technicalRequirements.push('Use simple, proven patterns');
          break;
          
        case 'break_into_subworkflows':
          optimizedAnalysis.technicalRequirements.push('Break into modular sub-workflows');
          optimizedAnalysis.constraints.push('Each sub-workflow should handle one responsibility');
          break;
          
        case 'add_caching':
        case 'implement_caching':
          if (!optimizedAnalysis.technical_requirements.storage_requirements.includes('cache')) {
            optimizedAnalysis.technical_requirements.storage_requirements.push('cache');
          }
          optimizedAnalysis.technicalRequirements.push('Implement caching for frequently accessed data');
          break;
          
        case 'add_parallel_processing':
        case 'implement_async_processing':
          optimizedAnalysis.technicalRequirements.push('Implement parallel processing where possible');
          if (!optimizedAnalysis.technical_requirements.batch_processing) {
            optimizedAnalysis.technical_requirements.batch_processing = true;
          }
          break;
          
        case 'prioritize_critical_path':
        case 'optimize_critical_path':
          optimizedAnalysis.constraints.push('Focus on critical path optimization');
          optimizedAnalysis.technicalRequirements.push('Identify and optimize the critical execution path');
          break;
          
        case 'batch_api_calls':
          optimizedAnalysis.technicalRequirements.push('Batch external API calls to reduce overhead');
          break;
          
        case 'implement_circuit_breaker':
          optimizedAnalysis.technicalRequirements.push('Implement circuit breaker pattern for external services');
          break;
          
        case 'use_connection_pooling':
          optimizedAnalysis.technicalRequirements.push('Use connection pooling for database and API connections');
          break;
          
        case 'implement_data_streaming':
          optimizedAnalysis.technicalRequirements.push('Use streaming for large data processing');
          break;
          
        case 'use_event_driven_architecture':
          optimizedAnalysis.technical_requirements.data_flow_pattern = 'mesh';
          optimizedAnalysis.technicalRequirements.push('Implement event-driven architecture');
          break;
          
        case 'add_request_throttling':
          optimizedAnalysis.technicalRequirements.push('Implement request throttling and rate limiting');
          break;
          
        case 'implement_fast_fail':
          optimizedAnalysis.technicalRequirements.push('Implement fast-fail mechanisms');
          break;
          
        case 'add_data_validation_early':
          optimizedAnalysis.technicalRequirements.push('Validate data at entry points');
          break;
          
        case 'use_data_compression':
          optimizedAnalysis.technicalRequirements.push('Compress data for storage and transfer');
          break;
          
        case 'reduce_decision_points':
          if (optimizedAnalysis.workflow_characteristics.decision_points > 3) {
            optimizedAnalysis.workflow_characteristics.decision_points = Math.max(3, 
              Math.floor(optimizedAnalysis.workflow_characteristics.decision_points * 0.7)
            );
          }
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