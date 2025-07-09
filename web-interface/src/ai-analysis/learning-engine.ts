import { DeepAnalysis, RecognizedPatterns, WorkflowArchitecture, FeedbackData } from './types';
import { AIAnalyzer } from './ai-analyzer';

export class LearningEngine {
  private aiAnalyzer: AIAnalyzer;
  private feedbackHistory: FeedbackData[] = [];
  private performanceMetrics: Map<string, any> = new Map();
  
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
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
  
  getPerformanceMetrics(): any {
    return Object.fromEntries(this.performanceMetrics);
  }
  
  async suggestImprovements(workflow: WorkflowArchitecture): Promise<string[]> {
    const metrics = this.getPerformanceMetrics();
    const similarWorkflows = this.findSimilarWorkflows(workflow);
    
    const improvements = await this.aiAnalyzer.analyze(
      `Suggest improvements for this workflow based on historical data:
      
      Current Workflow: ${JSON.stringify(workflow)}
      Performance Metrics: ${JSON.stringify(metrics)}
      Similar Workflows: ${JSON.stringify(similarWorkflows)}
      
      Provide specific suggestions for:
      1. Performance optimization
      2. Error reduction
      3. Resource efficiency
      4. User experience improvements`
    );
    
    return improvements.suggestions || [];
  }
  
  private findSimilarWorkflows(workflow: WorkflowArchitecture): FeedbackData[] {
    return this.feedbackHistory.filter(feedback => {
      // Simple similarity check based on workflow type and node count
      return feedback.workflowType === workflow.nodes[0]?.type &&
             Math.abs(feedback.nodeCount - workflow.nodes.length) <= 2;
    });
  }
}