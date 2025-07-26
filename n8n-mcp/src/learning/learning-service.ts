// learning/learning-service.ts

import { LearningEngine } from './learning-engine.js';
import { FeedbackCollector } from './feedback-collector.js';
import { WorkflowValidator } from '../validation/workflow-validator.js';

/**
 * Singleton service for managing the learning system
 */
export class LearningService {
  private static instance: LearningService;
  private learningEngine: LearningEngine;
  private feedbackCollector: FeedbackCollector;
  
  private constructor() {
    this.learningEngine = new LearningEngine();
    this.feedbackCollector = new FeedbackCollector(this.learningEngine);
  }
  
  static getInstance(): LearningService {
    if (!LearningService.instance) {
      LearningService.instance = new LearningService();
    }
    return LearningService.instance;
  }
  
  getLearningEngine(): LearningEngine {
    return this.learningEngine;
  }
  
  getFeedbackCollector(): FeedbackCollector {
    return this.feedbackCollector;
  }
  
  createValidator(): WorkflowValidator {
    return new WorkflowValidator(this.feedbackCollector);
  }
  
  /**
   * Record a workflow generation event
   */
  async recordGeneration(data: {
    prompt: string;
    workflowName: string;
    nodeCount: number;
    provider: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.learningEngine.recordGeneration({
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prompt: data.prompt,
      workflow: {
        name: data.workflowName,
        nodes: [],
        connections: {}
      },
      timestamp: new Date(),
      provider: data.provider,
      nodeCount: data.nodeCount,
      connectionCount: 0,
      model: undefined
    });
  }
  
  /**
   * Enhance a prompt with learning insights
   */
  async enhancePrompt(prompt: string): Promise<string> {
    try {
      const context = await this.learningEngine.getLearningContext(prompt);
      
      // Only enhance if we have useful context
      if (context.commonPatterns.length > 0 || 
          context.avoidErrors.length > 0 || 
          context.bestPractices.length > 0) {
        return await this.learningEngine.enhancePrompt(prompt, context);
      }
      
      return prompt;
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
      return prompt; // Return original prompt on error
    }
  }
  
  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<{
    totalGenerations: number;
    successRate: number;
    commonErrors: string[];
    bestPractices: string[];
  }> {
    const context = await this.learningEngine.getLearningContext('');
    
    return {
      totalGenerations: 0, // TODO: Implement counting
      successRate: 0, // TODO: Calculate from feedback
      commonErrors: context.avoidErrors,
      bestPractices: context.bestPractices
    };
  }
  
  /**
   * Stop the learning service
   */
  stop(): void {
    this.learningEngine.stop();
  }
}