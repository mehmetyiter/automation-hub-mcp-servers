import { api } from '../services/api';
import { FeedbackData } from './types';
import { LearningEngine } from './learning-engine';

export class FeedbackCollector {
  private learningEngine: LearningEngine;
  private pendingFeedback: Map<string, Partial<FeedbackData>> = new Map();
  
  constructor() {
    this.learningEngine = new LearningEngine();
  }
  
  // Start tracking a workflow execution
  startTracking(workflowId: string, workflowType: string, nodeCount: number): void {
    this.pendingFeedback.set(workflowId, {
      workflowId,
      workflowType,
      nodeCount,
      timestamp: new Date().toISOString(),
      startTime: Date.now()
    });
  }
  
  // Record workflow completion
  recordSuccess(workflowId: string, additionalData?: any): void {
    const pending = this.pendingFeedback.get(workflowId);
    if (!pending || !pending.startTime) return;
    
    const feedback: FeedbackData = {
      workflowId,
      workflowType: pending.workflowType || 'unknown',
      outcome: 'success',
      executionTime: Date.now() - pending.startTime,
      nodeCount: pending.nodeCount || 0,
      errorDetails: [],
      timestamp: pending.timestamp || new Date().toISOString(),
      ...additionalData
    };
    
    this.submitFeedback(feedback);
    this.pendingFeedback.delete(workflowId);
  }
  
  // Record workflow failure
  recordFailure(workflowId: string, error: any): void {
    const pending = this.pendingFeedback.get(workflowId);
    if (!pending || !pending.startTime) return;
    
    const feedback: FeedbackData = {
      workflowId,
      workflowType: pending.workflowType || 'unknown',
      outcome: 'failure',
      executionTime: Date.now() - pending.startTime,
      nodeCount: pending.nodeCount || 0,
      errorDetails: [
        {
          message: error.message || 'Unknown error',
          code: error.code,
          stack: error.stack
        }
      ],
      timestamp: pending.timestamp || new Date().toISOString()
    };
    
    this.submitFeedback(feedback);
    this.pendingFeedback.delete(workflowId);
  }
  
  // Submit feedback to learning engine and optionally to backend
  private async submitFeedback(feedback: FeedbackData): Promise<void> {
    try {
      // Send to learning engine for immediate learning
      await this.learningEngine.learn(feedback);
      
      // Also send to backend for persistent storage
      await api.post('/ai-analysis/feedback', feedback);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }
  
  // Get performance insights for a specific workflow type
  async getInsights(workflowType: string): Promise<any> {
    try {
      const response = await api.get(`/ai-analysis/insights/${workflowType}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get insights:', error);
      return null;
    }
  }
  
  // Manual feedback submission (for user-reported issues)
  async submitUserFeedback(workflowId: string, feedback: {
    rating: number;
    comments: string;
    issues?: string[];
  }): Promise<void> {
    try {
      await api.post('/ai-analysis/user-feedback', {
        workflowId,
        ...feedback
      });
    } catch (error) {
      console.error('Failed to submit user feedback:', error);
    }
  }
}

// Singleton instance
export const feedbackCollector = new FeedbackCollector();