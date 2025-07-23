import { FeedbackData } from './types.js';
import { LearningEngine } from './learning-engine.js';

export class FeedbackCollector {
  private learningEngine: LearningEngine;

  constructor(learningEngine?: LearningEngine) {
    this.learningEngine = learningEngine || new LearningEngine();
  }

  async collectFeedback(feedback: Partial<FeedbackData> & { workflowId: string }): Promise<void> {
    // Validate required fields
    if (!feedback.workflowId) {
      throw new Error('Workflow ID is required');
    }

    // Set defaults
    const completeFeedback: FeedbackData = {
      workflowId: feedback.workflowId,
      workflowType: feedback.workflowType || 'unknown',
      prompt: feedback.prompt || '',
      outcome: feedback.outcome || 'partial',
      executionTime: feedback.executionTime,
      errorMessage: feedback.errorMessage,
      nodeCount: feedback.nodeCount || 0,
      userRating: feedback.userRating,
      improvements: feedback.improvements || [],
      timestamp: new Date()
    };

    // Record feedback
    await this.learningEngine.recordFeedback(completeFeedback);

    console.log(`Feedback recorded for workflow ${feedback.workflowId}:`, {
      outcome: completeFeedback.outcome,
      rating: completeFeedback.userRating,
      hasError: !!completeFeedback.errorMessage
    });
  }

  async collectWorkflowExecutionResult(
    workflowId: string,
    executionResult: {
      success: boolean;
      executionTime: number;
      error?: string;
      nodeExecutions?: Array<{ nodeId: string; success: boolean; error?: string }>;
    }
  ): Promise<void> {
    const feedback: Partial<FeedbackData> = {
      workflowId,
      outcome: executionResult.success ? 'success' : 'failure',
      executionTime: executionResult.executionTime,
      errorMessage: executionResult.error
    };

    // Analyze node-level failures
    if (executionResult.nodeExecutions) {
      const failedNodes = executionResult.nodeExecutions.filter(n => !n.success);
      if (failedNodes.length > 0) {
        feedback.improvements = failedNodes.map(n => 
          `Fix node ${n.nodeId}: ${n.error || 'Unknown error'}`
        );
      }
    }

    await this.collectFeedback(feedback as FeedbackData);
  }

  async collectUserRating(
    workflowId: string,
    rating: number,
    comments?: string
  ): Promise<void> {
    const feedback: Partial<FeedbackData> = {
      workflowId,
      userRating: rating,
      outcome: rating >= 4 ? 'success' : rating <= 2 ? 'failure' : 'partial'
    };

    if (comments) {
      feedback.improvements = [comments];
    }

    await this.collectFeedback(feedback as FeedbackData);
  }

  async getWorkflowFeedbackSummary(workflowId: string): Promise<{
    totalFeedback: number;
    avgRating?: number;
    successRate: number;
    commonIssues: string[];
  }> {
    const allFeedback = await this.learningEngine['knowledgeStore'].loadFeedback();
    const workflowFeedback = allFeedback.filter(f => f.workflowId === workflowId);

    if (workflowFeedback.length === 0) {
      return {
        totalFeedback: 0,
        successRate: 0,
        commonIssues: []
      };
    }

    const ratings = workflowFeedback
      .filter(f => f.userRating !== undefined)
      .map(f => f.userRating!);

    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
      : undefined;

    const successCount = workflowFeedback.filter(f => f.outcome === 'success').length;
    const successRate = successCount / workflowFeedback.length;

    const issues = workflowFeedback
      .filter(f => f.errorMessage)
      .map(f => f.errorMessage!)
      .filter((issue, index, self) => self.indexOf(issue) === index)
      .slice(0, 5);

    return {
      totalFeedback: workflowFeedback.length,
      avgRating,
      successRate,
      commonIssues: issues
    };
  }
}