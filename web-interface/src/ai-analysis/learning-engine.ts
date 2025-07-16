import { DeepAnalysis, WorkflowArchitecture, FeedbackData } from './types';
import { AIAnalyzer } from './ai-analyzer';
import { AIService } from './ai-service';
import { DatabaseService } from './database-service';

export class LearningEngine {
  private aiAnalyzer: AIAnalyzer;
  private aiService: AIService;
  private databaseService: DatabaseService;
  private feedbackHistory: FeedbackData[] = [];
  private performanceMetrics: Map<string, any> = new Map();
  
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
    this.aiService = new AIService('openai', false); // Use environment variables
    this.databaseService = new DatabaseService();
  }
  
  async learn(feedback: FeedbackData): Promise<void> {
    // Store feedback for future learning
    this.feedbackHistory.push(feedback);
    
    // Update performance metrics
    this.updatePerformanceMetrics(feedback);
    
    // Analyze patterns in successful/failed workflows
    const learningInsights = await this.analyzeFeedbackPatterns();
    
    // Update knowledge base
    await this.updateKnowledgeBase(learningInsights);
  }
  
  private async analyzeFeedbackPatterns(): Promise<any> {
    const successfulWorkflows = this.feedbackHistory.filter(f => f.outcome === 'success');
    const failedWorkflows = this.feedbackHistory.filter(f => f.outcome === 'failure');
    
    // Use AI to find patterns in successful workflows
    const successPatterns = await this.aiAnalyzer.analyze(
      `Analyze these successful workflows and extract common patterns:
      ${JSON.stringify(successfulWorkflows, null, 2)}
      
      Focus on:
      1. Node configurations that work well together
      2. Common workflow structures
      3. Successful parameter combinations
      4. Optimization techniques used`
    );
    
    // Analyze failure patterns
    const failurePatterns = await this.aiAnalyzer.analyze(
      `Analyze these failed workflows and identify common issues:
      ${JSON.stringify(failedWorkflows, null, 2)}
      
      Focus on:
      1. Common error patterns
      2. Node incompatibilities
      3. Parameter misconfigurations
      4. Missing components`
    );
    
    return {
      successPatterns,
      failurePatterns,
      recommendations: await this.generateRecommendations(successPatterns, failurePatterns)
    };
  }
  
  private async generateRecommendations(successPatterns: any, failurePatterns: any): Promise<string[]> {
    const response = await this.aiAnalyzer.analyze(
      `Based on these success and failure patterns, generate specific recommendations:
      
      Success Patterns: ${JSON.stringify(successPatterns)}
      Failure Patterns: ${JSON.stringify(failurePatterns)}
      
      Provide actionable recommendations for:
      1. Workflow optimization
      2. Error prevention
      3. Performance improvements
      4. Best practices`
    );
    
    return response.recommendations || [];
  }
  
  private updatePerformanceMetrics(feedback: FeedbackData): void {
    const key = `${feedback.workflowType}_${feedback.outcome}`;
    const current = this.performanceMetrics.get(key) || { count: 0, avgExecutionTime: 0 };
    
    current.count++;
    current.avgExecutionTime = (current.avgExecutionTime * (current.count - 1) + feedback.executionTime) / current.count;
    
    this.performanceMetrics.set(key, current);
  }
  
  private async updateKnowledgeBase(insights: any): Promise<void> {
    // In a real implementation, this would update a database
    // For now, we'll store in memory
    console.log('Knowledge base updated with:', insights);
  }
  
  async getPerformanceMetrics(): Promise<any> {
    // Get metrics from database instead of local map
    return await this.databaseService.getPerformanceMetrics();
  }
  
  private getMetricBasedImprovements(workflow: WorkflowArchitecture, metrics: any): string[] {
    const improvements = [];
    
    // Check if workflow and nodes exist
    if (!workflow || !workflow.nodes) {
      return ['Workflow structure is incomplete or missing nodes'];
    }
    
    // Analyze node count
    if (workflow.nodes.length > 30) {
      improvements.push('Consider breaking this workflow into smaller sub-workflows for better maintainability');
    }
    
    // Analyze complexity
    if (workflow.estimatedComplexity > 0.8) {
      improvements.push('Simplify complex logic by using more straightforward node configurations');
    }
    
    // Check for common performance issues
    if (workflow.nodes && workflow.nodes.some(n => n.type && (n.type.includes('loop') || n.type.includes('iteration')))) {
      improvements.push('Add batch processing to loops for better performance');
    }
    
    // Check for missing error handling
    const nodesWithoutErrorHandling = workflow.nodes ? workflow.nodes.filter(n => 
      n.configuration && !n.configuration.errorHandling && !n.configuration.continueOnFail
    ) : [];
    if (nodesWithoutErrorHandling.length > 0) {
      improvements.push(`Add error handling to ${nodesWithoutErrorHandling.length} nodes that currently lack it`);
    }
    
    // Analyze metrics for specific issues
    for (const [key, metric] of Object.entries(metrics)) {
      if (metric && typeof metric === 'object') {
        const m = metric as any;
        if (m.successRate < 0.8) {
          improvements.push(`Improve reliability for ${key} workflows (current success rate: ${(m.successRate * 100).toFixed(1)}%)`);
        }
        if (m.avgExecutionTime > 30000) {
          improvements.push(`Optimize performance for ${key} workflows (current avg time: ${(m.avgExecutionTime / 1000).toFixed(1)}s)`);
        }
      }
    }
    
    return improvements;
  }
  
  private getFallbackImprovements(workflow: WorkflowArchitecture): string[] {
    const improvements = [
      'Add comprehensive error handling to all nodes',
      'Implement retry logic for external API calls',
      'Add logging for debugging and monitoring',
      'Optimize data transformations for performance',
      'Consider caching frequently accessed data'
    ];
    
    // Check if workflow and nodes exist before accessing properties
    if (workflow && workflow.nodes && workflow.nodes.length > 20) {
      improvements.push('Break down complex workflows into smaller, reusable components');
    }
    
    if (workflow && workflow.connections && workflow.nodes && workflow.connections.length > workflow.nodes.length * 1.5) {
      improvements.push('Simplify workflow connections to improve maintainability');
    }
    
    return improvements;
  }
  
  async suggestImprovements(workflow: WorkflowArchitecture): Promise<string[]> {
    // Get recent feedback data from database
    const recentFeedbackData = await this.databaseService.getRecentFeedback();
    const metrics = await this.databaseService.getPerformanceMetrics();
    
    // Ensure recentFeedback is an array
    const recentFeedback = Array.isArray(recentFeedbackData) ? recentFeedbackData : [];
    
    // Analyze architecture for improvement opportunities
    const improvementPrompt = `
TASK: Analyze this workflow architecture and suggest specific improvements.

ARCHITECTURE:
${JSON.stringify(workflow, null, 2)}

RECENT FEEDBACK (showing patterns of success and failure):
${JSON.stringify(recentFeedback.slice(0, 10), null, 2)}

PERFORMANCE METRICS:
${JSON.stringify(metrics, null, 2)}

Provide specific, actionable improvements in JSON format:
{
  "performance_improvements": ["specific performance optimizations"],
  "reliability_improvements": ["reliability enhancements"],
  "maintainability_improvements": ["maintainability enhancements"],
  "security_improvements": ["security enhancements"],
  "user_experience_improvements": ["UX improvements"],
  "cost_optimizations": ["cost reduction strategies"]
}

Focus on:
1. Common failure patterns from the feedback
2. Performance bottlenecks
3. Security vulnerabilities
4. Scalability issues
5. User experience problems`;

    try {
      const result = await this.aiService.getJSONResponse(improvementPrompt);
      
      // Flatten all improvements into a single array
      const improvements = [];
      for (const category of Object.values(result)) {
        if (Array.isArray(category)) {
          improvements.push(...category);
        }
      }
      
      // Add specific improvements based on metrics
      improvements.push(...this.getMetricBasedImprovements(workflow, metrics));
      
      // Remove duplicates and return
      return [...new Set(improvements)];
    } catch (error) {
      console.error('Failed to generate improvements:', error);
      return this.getFallbackImprovements(workflow);
    }
  }
  
  private findSimilarWorkflows(workflow: WorkflowArchitecture): FeedbackData[] {
    return this.feedbackHistory.filter(feedback => {
      // Simple similarity check based on workflow type and node count
      return feedback.workflowType === workflow.nodes[0]?.type &&
             Math.abs(feedback.nodeCount - workflow.nodes.length) <= 2;
    });
  }
}