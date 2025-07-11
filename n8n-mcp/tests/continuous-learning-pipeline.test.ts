import { ContinuousLearningPipeline, BusinessLogicFeedback } from '../src/ai-analysis/continuous-learning-pipeline.js';
import { AIService } from '../src/ai-service.js';
import { AdaptivePromptEngine } from '../src/ai-analysis/adaptive-prompt-engine.js';
import { BusinessLogicLearningEngine } from '../src/ai-analysis/business-logic-learning.js';

describe('ContinuousLearningPipeline', () => {
  let pipeline: ContinuousLearningPipeline;
  let aiService: AIService;
  let promptEngine: AdaptivePromptEngine;
  let learningEngine: BusinessLogicLearningEngine;
  
  beforeEach(() => {
    aiService = new AIService();
    promptEngine = new AdaptivePromptEngine(aiService);
    learningEngine = new BusinessLogicLearningEngine(aiService);
    pipeline = new ContinuousLearningPipeline(aiService, promptEngine, learningEngine);
  });
  
  afterEach(() => {
    pipeline.removeAllListeners();
  });
  
  describe('processFeedback', () => {
    it('should process regular feedback and add to queue', async () => {
      const feedback: BusinessLogicFeedback = {
        id: 'test-1',
        implementationId: 'impl-1',
        timestamp: new Date(),
        severity: 'info',
        feedbackType: 'performance',
        description: 'Execution completed successfully',
        context: {
          domain: 'finance',
          industry: 'banking',
          userRole: 'analyst',
          environment: 'production'
        },
        metrics: {
          executionTime: 1500,
          accuracy: 0.95
        }
      };
      
      await pipeline.processFeedback(feedback);
      
      const summary = await pipeline.getFeedbackSummary();
      expect(summary.total).toBe(1);
      expect(summary.bySeverity.info).toBe(1);
    });
    
    it('should trigger immediate learning for critical feedback', async () => {
      const criticalFeedback: BusinessLogicFeedback = {
        id: 'critical-1',
        implementationId: 'impl-2',
        timestamp: new Date(),
        severity: 'critical',
        feedbackType: 'error',
        description: 'Critical calculation error in risk assessment',
        context: {
          domain: 'finance',
          industry: 'banking',
          userRole: 'risk-manager',
          environment: 'production'
        },
        metrics: {
          executionTime: 5000,
          accuracy: 0.3,
          errorRate: 0.7
        }
      };
      
      let updateEventFired = false;
      pipeline.on('system-updated', () => {
        updateEventFired = true;
      });
      
      await pipeline.processFeedback(criticalFeedback);
      
      // Should have triggered immediate updates
      expect(updateEventFired).toBe(true);
      
      const updates = pipeline.getSystemUpdates();
      expect(updates.length).toBeGreaterThan(0);
      expect(updates.some(u => u.type === 'prompt')).toBe(true);
    });
    
    it('should trigger batch processing when queue is full', async () => {
      let batchProcessed = false;
      pipeline.on('batch-processed', () => {
        batchProcessed = true;
      });
      
      // Fill the queue to trigger batch processing (default batch size is 100)
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const feedback: BusinessLogicFeedback = {
          id: `batch-${i}`,
          implementationId: `impl-${i}`,
          timestamp: new Date(),
          severity: 'info',
          feedbackType: 'performance',
          description: `Feedback ${i}`,
          context: {
            domain: 'finance',
            industry: 'banking',
            userRole: 'analyst',
            environment: 'production'
          }
        };
        promises.push(pipeline.processFeedback(feedback));
      }
      
      await Promise.all(promises);
      
      // Wait a bit for async batch processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(batchProcessed).toBe(true);
    });
  });
  
  describe('pattern detection', () => {
    it('should detect and track learning patterns', async () => {
      const feedbackWithPattern: BusinessLogicFeedback = {
        id: 'pattern-1',
        implementationId: 'impl-pattern',
        timestamp: new Date(),
        severity: 'warning',
        feedbackType: 'accuracy',
        description: 'Consistent underestimation in revenue calculations',
        context: {
          domain: 'sales',
          industry: 'retail',
          userRole: 'analyst',
          environment: 'production'
        },
        metrics: {
          accuracy: 0.85
        }
      };
      
      await pipeline.processFeedback(feedbackWithPattern);
      
      // Trigger batch processing
      const feedbackBatch = [];
      for (let i = 0; i < 100; i++) {
        feedbackBatch.push({
          ...feedbackWithPattern,
          id: `pattern-batch-${i}`
        });
      }
      
      await Promise.all(feedbackBatch.map(f => pipeline.processFeedback(f)));
      
      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const patterns = pipeline.getLearningPatterns();
      expect(patterns.size).toBeGreaterThan(0);
    });
  });
  
  describe('performance monitoring', () => {
    it('should track performance metrics over time', async () => {
      const feedbackWithMetrics: BusinessLogicFeedback[] = [
        {
          id: 'perf-1',
          implementationId: 'impl-perf',
          timestamp: new Date(),
          severity: 'info',
          feedbackType: 'performance',
          description: 'Normal execution',
          context: {
            domain: 'finance',
            industry: 'banking',
            userRole: 'analyst',
            environment: 'production'
          },
          metrics: {
            executionTime: 1000,
            accuracy: 0.95
          }
        },
        {
          id: 'perf-2',
          implementationId: 'impl-perf',
          timestamp: new Date(),
          severity: 'info',
          feedbackType: 'performance',
          description: 'Normal execution',
          context: {
            domain: 'finance',
            industry: 'banking',
            userRole: 'analyst',
            environment: 'production'
          },
          metrics: {
            executionTime: 1200,
            accuracy: 0.94
          }
        }
      ];
      
      for (const feedback of feedbackWithMetrics) {
        await pipeline.processFeedback(feedback);
      }
      
      const executionTimeHistory = pipeline.getPerformanceMetrics('executionTime');
      expect(executionTimeHistory).toContain(1000);
      expect(executionTimeHistory).toContain(1200);
      
      const accuracyHistory = pipeline.getPerformanceMetrics('accuracy');
      expect(accuracyHistory).toContain(0.95);
      expect(accuracyHistory).toContain(0.94);
    });
    
    it('should detect anomalies in performance metrics', async () => {
      // Create normal baseline
      for (let i = 0; i < 20; i++) {
        await pipeline.processFeedback({
          id: `normal-${i}`,
          implementationId: 'impl-normal',
          timestamp: new Date(),
          severity: 'info',
          feedbackType: 'performance',
          description: 'Normal execution',
          context: {
            domain: 'finance',
            industry: 'banking',
            userRole: 'analyst',
            environment: 'production'
          },
          metrics: {
            executionTime: 1000 + Math.random() * 200, // 1000-1200ms
            accuracy: 0.9 + Math.random() * 0.05 // 0.9-0.95
          }
        });
      }
      
      // Add anomaly
      await pipeline.processFeedback({
        id: 'anomaly-1',
        implementationId: 'impl-anomaly',
        timestamp: new Date(),
        severity: 'warning',
        feedbackType: 'performance',
        description: 'Slow execution',
        context: {
          domain: 'finance',
          industry: 'banking',
          userRole: 'analyst',
          environment: 'production'
        },
        metrics: {
          executionTime: 5000, // Anomaly: 5x normal
          accuracy: 0.5 // Anomaly: much lower accuracy
        }
      });
      
      const anomalies = pipeline.detectCurrentAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.metric === 'executionTime')).toBe(true);
    });
  });
  
  describe('system updates', () => {
    it('should track and manage system updates', async () => {
      const criticalFeedback: BusinessLogicFeedback = {
        id: 'update-test-1',
        implementationId: 'impl-update',
        timestamp: new Date(),
        severity: 'critical',
        feedbackType: 'error',
        description: 'Validation rules insufficient',
        context: {
          domain: 'finance',
          industry: 'banking',
          userRole: 'compliance',
          environment: 'production'
        }
      };
      
      await pipeline.processFeedback(criticalFeedback);
      
      const updates = pipeline.getSystemUpdates();
      expect(updates.length).toBeGreaterThan(0);
      
      const validationUpdate = updates.find(u => u.type === 'validation');
      expect(validationUpdate).toBeDefined();
      expect(validationUpdate?.rollbackAvailable).toBe(true);
    });
    
    it('should support rollback of updates', async () => {
      const feedback: BusinessLogicFeedback = {
        id: 'rollback-test',
        implementationId: 'impl-rollback',
        timestamp: new Date(),
        severity: 'critical',
        feedbackType: 'error',
        description: 'Prompt optimization caused issues',
        context: {
          domain: 'finance',
          industry: 'banking',
          userRole: 'analyst',
          environment: 'production'
        }
      };
      
      await pipeline.processFeedback(feedback);
      
      const updates = pipeline.getSystemUpdates();
      const promptUpdate = updates.find(u => u.type === 'prompt');
      
      if (promptUpdate) {
        const rollbackSuccess = await pipeline.rollbackUpdate(promptUpdate.updateId);
        expect(rollbackSuccess).toBe(true);
      }
    });
  });
  
  describe('model retraining', () => {
    it('should schedule model retraining for critical patterns', async () => {
      let retrainingScheduled = false;
      pipeline.on('retraining-scheduled', () => {
        retrainingScheduled = true;
      });
      
      // Create feedback that indicates need for retraining
      const criticalFeedback: BusinessLogicFeedback[] = [];
      for (let i = 0; i < 5; i++) {
        criticalFeedback.push({
          id: `retrain-${i}`,
          implementationId: `impl-retrain-${i}`,
          timestamp: new Date(),
          severity: 'critical',
          feedbackType: 'accuracy',
          description: 'Systematic error in calculations',
          context: {
            domain: 'finance',
            industry: 'banking',
            userRole: 'analyst',
            environment: 'production'
          },
          metrics: {
            accuracy: 0.4 // Very low accuracy
          }
        });
      }
      
      for (const feedback of criticalFeedback) {
        await pipeline.processFeedback(feedback);
      }
      
      expect(retrainingScheduled).toBe(true);
      
      const scheduledUpdates = pipeline.getScheduledUpdates();
      expect(scheduledUpdates.some(u => u.type === 'model')).toBe(true);
    });
  });
  
  describe('feedback summary', () => {
    it('should provide accurate feedback summary', async () => {
      const feedbackTypes = ['performance', 'accuracy', 'usability', 'compliance'];
      const severities = ['info', 'warning', 'error'];
      const domains = ['finance', 'sales', 'hr'];
      
      // Create diverse feedback
      for (let i = 0; i < 30; i++) {
        await pipeline.processFeedback({
          id: `summary-${i}`,
          implementationId: `impl-summary-${i}`,
          timestamp: new Date(),
          severity: severities[i % severities.length] as any,
          feedbackType: feedbackTypes[i % feedbackTypes.length] as any,
          description: `Test feedback ${i}`,
          context: {
            domain: domains[i % domains.length],
            industry: 'test',
            userRole: 'tester',
            environment: 'development'
          }
        });
      }
      
      const summary = await pipeline.getFeedbackSummary();
      
      expect(summary.total).toBe(30);
      expect(Object.keys(summary.bySeverity).length).toBe(3);
      expect(Object.keys(summary.byType).length).toBe(4);
      expect(Object.keys(summary.byDomain).length).toBe(3);
      
      // Test time window filtering
      const recentSummary = await pipeline.getFeedbackSummary(60000); // Last minute
      expect(recentSummary.total).toBe(30); // All feedback is recent
    });
  });
});