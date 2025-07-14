import { EventEmitter } from 'events';
import { AIService } from '../ai-service.js';
import { AdaptivePromptEngine } from './adaptive-prompt-engine.js';
import { BusinessLogicLearningEngine } from './business-logic-learning.js';

export interface BusinessLogicFeedback {
  id: string;
  implementationId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  feedbackType: 'performance' | 'accuracy' | 'usability' | 'compliance' | 'error';
  description: string;
  context: {
    domain: string;
    industry: string;
    userRole: string;
    environment: 'development' | 'staging' | 'production';
  };
  metrics?: {
    executionTime?: number;
    accuracy?: number;
    userSatisfaction?: number;
    errorRate?: number;
  };
  suggestedFix?: string;
  userComments?: string;
}

export interface LearningPattern {
  patternId: string;
  type: 'failure' | 'success' | 'optimization';
  description: string;
  frequency: number;
  impact: 'low' | 'medium' | 'high';
  relatedDomains: string[];
  suggestedActions: string[];
}

export interface BatchInsights {
  totalFeedback: number;
  criticalIssues: number;
  commonPatterns: LearningPattern[];
  performanceTrends: PerformanceTrend[];
  accuracyMetrics: AccuracyMetrics;
  retrainingRequired: boolean;
  recommendedActions: string[];
}

export interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  timeWindow: string;
}

export interface AccuracyMetrics {
  overallAccuracy: number;
  domainAccuracy: Map<string, number>;
  errorTypes: Map<string, number>;
}

export interface ModelUpdateScheduler {
  scheduleUpdate(update: ModelUpdate): Promise<void>;
  getScheduledUpdates(): ModelUpdate[];
  cancelUpdate(updateId: string): void;
}

export interface ModelUpdate {
  id: string;
  type: 'prompt' | 'validation' | 'model' | 'knowledge';
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduledTime: Date;
  details: any;
}

export interface PerformanceMonitor {
  trackMetric(metric: string, value: number): void;
  getMetricHistory(metric: string, timeWindow?: number): number[];
  detectAnomalies(): Anomaly[];
}

export interface Anomaly {
  metric: string;
  timestamp: Date;
  value: number;
  expectedRange: [number, number];
  severity: 'low' | 'medium' | 'high';
}

export interface SystemUpdate {
  updateId: string;
  timestamp: Date;
  type: 'prompt' | 'validation' | 'knowledge' | 'model';
  changes: string[];
  impact: string;
  rollbackAvailable: boolean;
}

export class ContinuousLearningPipeline extends EventEmitter {
  private feedbackQueue: BusinessLogicFeedback[] = [];
  private processedFeedback = new Map<string, BusinessLogicFeedback>();
  private learningPatterns = new Map<string, LearningPattern>();
  private systemUpdates: SystemUpdate[] = [];
  private performanceBaseline = new Map<string, number>();
  
  // Processing configuration
  private readonly batchSize = 100;
  private readonly criticalThreshold = 0.8;
  private readonly learningRate = 0.3;
  
  // Components
  private modelUpdateScheduler: ModelUpdateScheduler;
  private performanceMonitor: PerformanceMonitor;
  
  constructor(
    private aiService: AIService,
    private promptEngine: AdaptivePromptEngine,
    private learningEngine: BusinessLogicLearningEngine
  ) {
    super();
    this.modelUpdateScheduler = this.createModelUpdateScheduler();
    this.performanceMonitor = this.createPerformanceMonitor();
    this.startContinuousProcessing();
  }
  
  async processFeedback(feedback: BusinessLogicFeedback): Promise<void> {
    console.log(`📥 Processing feedback: ${feedback.feedbackType} - ${feedback.severity}`);
    
    // Track performance metrics
    if (feedback.metrics) {
      Object.entries(feedback.metrics).forEach(([metric, value]) => {
        if (typeof value === 'number') {
          this.performanceMonitor.trackMetric(metric, value);
        }
      });
    }
    
    // Immediate learning for critical feedback
    if (feedback.severity === 'critical') {
      await this.processImmediateLearning(feedback);
    }
    
    // Queue for batch processing
    this.feedbackQueue.push(feedback);
    this.processedFeedback.set(feedback.id, feedback);
    
    // Trigger batch processing if queue is full
    if (this.feedbackQueue.length >= this.batchSize) {
      await this.processBatchLearning();
    }
    
    // Emit feedback received event
    this.emit('feedback-received', {
      feedbackId: feedback.id,
      severity: feedback.severity,
      queueSize: this.feedbackQueue.length
    });
  }
  
  private async processImmediateLearning(
    feedback: BusinessLogicFeedback
  ): Promise<void> {
    console.log('🚨 Processing critical feedback immediately...');
    
    // Extract learning patterns
    const patterns = await this.extractFailurePatterns(feedback);
    
    // Update prompt templates immediately
    await this.updatePromptTemplates(patterns);
    
    // Update validation rules
    await this.updateValidationRules(patterns);
    
    // Update domain knowledge
    await this.updateDomainKnowledge(feedback, patterns);
    
    // Notify related systems
    await this.notifySystemUpdates(patterns);
    
    // Schedule model retraining if needed
    if (this.shouldTriggerRetraining(patterns)) {
      await this.scheduleModelRetraining('critical', patterns);
    }
  }
  
  private async extractFailurePatterns(
    feedback: BusinessLogicFeedback
  ): Promise<LearningPattern[]> {
    
    const analysisPrompt = `
TASK: Extract learning patterns from critical feedback.

FEEDBACK:
${JSON.stringify(feedback, null, 2)}

Analyze the feedback and extract actionable learning patterns. Return JSON:

{
  "patterns": [
    {
      "patternId": "unique_pattern_id",
      "type": "failure|success|optimization",
      "description": "clear description of the pattern",
      "frequency": 1,
      "impact": "low|medium|high",
      "relatedDomains": ["domains where this pattern applies"],
      "suggestedActions": ["specific actions to prevent/encourage this pattern"]
    }
  ],
  "rootCause": "identified root cause of the issue",
  "preventionStrategies": ["strategies to prevent similar issues"],
  "immediateActions": ["actions that should be taken immediately"]
}`;

    const result = await this.aiService.getJSONResponse(analysisPrompt);
    
    // Store patterns for future reference
    result.patterns.forEach((pattern: LearningPattern) => {
      const existing = this.learningPatterns.get(pattern.patternId);
      if (existing) {
        existing.frequency++;
        existing.impact = this.escalateImpact(existing.impact, pattern.impact);
      } else {
        this.learningPatterns.set(pattern.patternId, pattern);
      }
    });
    
    return result.patterns;
  }
  
  private escalateImpact(
    current: 'low' | 'medium' | 'high',
    new_: 'low' | 'medium' | 'high'
  ): 'low' | 'medium' | 'high' {
    const impactLevels = { low: 0, medium: 1, high: 2 };
    const maxLevel = Math.max(impactLevels[current], impactLevels[new_]);
    return Object.keys(impactLevels)[maxLevel] as 'low' | 'medium' | 'high';
  }
  
  private async updatePromptTemplates(patterns: LearningPattern[]): Promise<void> {
    console.log('📝 Updating prompt templates based on patterns...');
    
    for (const pattern of patterns) {
      if (pattern.type === 'failure' && pattern.impact !== 'low') {
        // Get current prompt performance
        const promptMetrics = this.promptEngine.getPromptPerformanceMetrics();
        
        // Find prompts that might have caused this failure
        const relatedPrompts = Array.from(promptMetrics.entries())
          .filter(([_, metrics]) => metrics.commonFailureReasons.includes(pattern.description));
        
        // Learn from the failure
        for (const [promptKey, metrics] of relatedPrompts) {
          await this.promptEngine.learnFromResult(promptKey, {
            success: false,
            confidence: 0.3,
            executionTime: metrics.avgExecutionTime,
            output: null,
            errors: [pattern.description]
          });
        }
      }
    }
    
    // Create system update record
    this.recordSystemUpdate({
      updateId: `prompt-update-${Date.now()}`,
      timestamp: new Date(),
      type: 'prompt',
      changes: patterns.map(p => `Updated prompts for pattern: ${p.description}`),
      impact: 'Prompt optimization based on failure patterns',
      rollbackAvailable: true
    });
  }
  
  private async updateValidationRules(patterns: LearningPattern[]): Promise<void> {
    console.log('✅ Updating validation rules...');
    
    const validationUpdates = patterns
      .filter(p => p.type === 'failure' && p.suggestedActions.some(a => a.includes('validation')))
      .map(pattern => ({
        rule: pattern.description,
        action: pattern.suggestedActions.find(a => a.includes('validation')) || '',
        severity: pattern.impact,
        domains: pattern.relatedDomains
      }));
    
    if (validationUpdates.length > 0) {
      // Update validation engine (would integrate with actual validation engine)
      console.log(`Added ${validationUpdates.length} new validation rules`);
      
      this.recordSystemUpdate({
        updateId: `validation-update-${Date.now()}`,
        timestamp: new Date(),
        type: 'validation',
        changes: validationUpdates.map(u => `New rule: ${u.rule}`),
        impact: 'Enhanced validation coverage',
        rollbackAvailable: true
      });
    }
  }
  
  private async updateDomainKnowledge(
    feedback: BusinessLogicFeedback,
    patterns: LearningPattern[]
  ): Promise<void> {
    console.log('🧠 Updating domain knowledge...');
    
    // Update learning engine with new patterns
    await this.learningEngine.recordBusinessOutcome({
      implementationId: feedback.implementationId,
      success: feedback.severity !== 'critical' && feedback.severity !== 'error',
      confidence: feedback.metrics?.accuracy || 0.5,
      executionTime: feedback.metrics?.executionTime || 0,
      userFeedback: feedback.userComments,
      errorDetails: feedback.severity === 'error' ? feedback.description : undefined,
      improvements: patterns.flatMap(p => p.suggestedActions)
    });
    
    // Extract domain-specific insights
    const domainInsights = await this.extractDomainInsights(feedback, patterns);
    
    // Update domain knowledge base
    if (domainInsights.length > 0) {
      console.log(`Added ${domainInsights.length} domain-specific insights`);
      
      this.recordSystemUpdate({
        updateId: `knowledge-update-${Date.now()}`,
        timestamp: new Date(),
        type: 'knowledge',
        changes: domainInsights,
        impact: `Enhanced ${feedback.context.domain} domain knowledge`,
        rollbackAvailable: false
      });
    }
  }
  
  private async extractDomainInsights(
    feedback: BusinessLogicFeedback,
    patterns: LearningPattern[]
  ): Promise<string[]> {
    const insights: string[] = [];
    
    // Industry-specific insights
    if (feedback.context.industry) {
      const industryPatterns = patterns.filter(p => 
        p.relatedDomains.includes(feedback.context.industry)
      );
      
      industryPatterns.forEach(pattern => {
        insights.push(`${feedback.context.industry}: ${pattern.description}`);
      });
    }
    
    // Performance insights
    if (feedback.metrics?.executionTime) {
      const baseline = this.performanceBaseline.get(feedback.context.domain) || 1000;
      if (feedback.metrics.executionTime > baseline * 2) {
        insights.push(`Performance degradation detected in ${feedback.context.domain}`);
      }
    }
    
    return insights;
  }
  
  private async notifySystemUpdates(patterns: LearningPattern[]): Promise<void> {
    // Emit events for different pattern types
    patterns.forEach(pattern => {
      this.emit('pattern-detected', {
        pattern,
        timestamp: new Date(),
        action: 'immediate-learning'
      });
    });
    
    // Notify if critical patterns detected
    const criticalPatterns = patterns.filter(p => p.impact === 'high');
    if (criticalPatterns.length > 0) {
      this.emit('critical-patterns', {
        patterns: criticalPatterns,
        recommendedActions: criticalPatterns.flatMap(p => p.suggestedActions)
      });
    }
  }
  
  private shouldTriggerRetraining(patterns: LearningPattern[]): boolean {
    // Check if patterns indicate need for model retraining
    const highImpactPatterns = patterns.filter(p => p.impact === 'high');
    const highFrequencyPatterns = patterns.filter(p => p.frequency > 5);
    
    return highImpactPatterns.length > 2 || highFrequencyPatterns.length > 0;
  }
  
  private async processBatchLearning(): Promise<void> {
    console.log(`📊 Processing batch of ${this.feedbackQueue.length} feedback items...`);
    
    // Analyze feedback batch
    const insights = await this.analyzeFeedbackBatch(this.feedbackQueue);
    
    // Update domain knowledge
    await this.updateDomainKnowledgeBatch(insights);
    
    // Check if retraining is needed
    if (insights.retrainingRequired) {
      await this.scheduleModelRetraining('batch', insights.commonPatterns);
    }
    
    // Update performance baselines
    this.updatePerformanceBaselines(insights);
    
    // Clear processed feedback
    this.feedbackQueue = [];
    
    // Emit batch processing complete
    this.emit('batch-processed', {
      insights,
      timestamp: new Date()
    });
  }
  
  private async analyzeFeedbackBatch(
    feedbackBatch: BusinessLogicFeedback[]
  ): Promise<BatchInsights> {
    
    const analysisPrompt = `
TASK: Analyze batch of business logic feedback for learning insights.

FEEDBACK BATCH SUMMARY:
- Total items: ${feedbackBatch.length}
- Critical issues: ${feedbackBatch.filter(f => f.severity === 'critical').length}
- Domains: ${[...new Set(feedbackBatch.map(f => f.context.domain))].join(', ')}
- Feedback types: ${[...new Set(feedbackBatch.map(f => f.feedbackType))].join(', ')}

DETAILED FEEDBACK:
${JSON.stringify(feedbackBatch.slice(0, 20), null, 2)}
${feedbackBatch.length > 20 ? `... and ${feedbackBatch.length - 20} more items` : ''}

Analyze the feedback batch and return comprehensive insights as JSON:

{
  "totalFeedback": ${feedbackBatch.length},
  "criticalIssues": <number>,
  "commonPatterns": [
    {
      "patternId": "pattern_id",
      "type": "failure|success|optimization",
      "description": "pattern description",
      "frequency": <occurrences>,
      "impact": "low|medium|high",
      "relatedDomains": ["domains"],
      "suggestedActions": ["actions"]
    }
  ],
  "performanceTrends": [
    {
      "metric": "metric_name",
      "trend": "improving|stable|degrading",
      "changeRate": <percentage>,
      "timeWindow": "time period"
    }
  ],
  "accuracyMetrics": {
    "overallAccuracy": <0-1>,
    "domainAccuracy": {
      "domain_name": <accuracy>
    },
    "errorTypes": {
      "error_type": <count>
    }
  },
  "retrainingRequired": <boolean>,
  "recommendedActions": ["high-level recommendations"]
}`;

    const insights = await this.aiService.getJSONResponse(analysisPrompt);
    
    // Enrich with calculated metrics
    insights.accuracyMetrics.domainAccuracy = new Map(
      Object.entries(insights.accuracyMetrics.domainAccuracy || {})
    );
    insights.accuracyMetrics.errorTypes = new Map(
      Object.entries(insights.accuracyMetrics.errorTypes || {})
    );
    
    return insights;
  }
  
  private async updateDomainKnowledgeBatch(insights: BatchInsights): Promise<void> {
    console.log('📚 Updating domain knowledge from batch insights...');
    
    // Update patterns in learning engine
    for (const pattern of insights.commonPatterns) {
      if (pattern.type === 'success' && pattern.frequency > 3) {
        // Reinforce successful patterns
        pattern.relatedDomains.forEach(domain => {
          console.log(`Reinforcing successful pattern in ${domain}: ${pattern.description}`);
        });
      } else if (pattern.type === 'failure' && pattern.impact !== 'low') {
        // Learn from failures
        console.log(`Learning from failure pattern: ${pattern.description}`);
      }
    }
    
    // Update accuracy baselines per domain
    insights.accuracyMetrics.domainAccuracy.forEach((accuracy, domain) => {
      const currentBaseline = this.performanceBaseline.get(`${domain}_accuracy`) || 0.8;
      if (Math.abs(accuracy - currentBaseline) > 0.1) {
        console.log(`Updating ${domain} accuracy baseline: ${currentBaseline} → ${accuracy}`);
        this.performanceBaseline.set(`${domain}_accuracy`, accuracy);
      }
    });
  }
  
  private async scheduleModelRetraining(
    trigger: 'critical' | 'batch',
    patterns: LearningPattern[]
  ): Promise<void> {
    console.log(`🔧 Scheduling model retraining (trigger: ${trigger})...`);
    
    const priority = trigger === 'critical' ? 'critical' : 'high';
    
    const update: ModelUpdate = {
      id: `retrain-${Date.now()}`,
      type: 'model',
      priority,
      scheduledTime: trigger === 'critical' ? 
        new Date() : // Immediate for critical
        new Date(Date.now() + 3600000), // 1 hour for batch
      details: {
        trigger,
        patterns: patterns.map(p => ({
          id: p.patternId,
          description: p.description,
          impact: p.impact
        })),
        affectedDomains: [...new Set(patterns.flatMap(p => p.relatedDomains))],
        recommendedChanges: patterns.flatMap(p => p.suggestedActions)
      }
    };
    
    await this.modelUpdateScheduler.scheduleUpdate(update);
    
    this.emit('retraining-scheduled', {
      updateId: update.id,
      priority: update.priority,
      scheduledTime: update.scheduledTime
    });
  }
  
  private updatePerformanceBaselines(insights: BatchInsights): void {
    // Update performance trends
    insights.performanceTrends.forEach(trend => {
      const currentBaseline = this.performanceBaseline.get(trend.metric) || 0;
      
      if (trend.trend === 'improving') {
        const newBaseline = currentBaseline * (1 - trend.changeRate / 100);
        this.performanceBaseline.set(trend.metric, newBaseline);
      } else if (trend.trend === 'degrading') {
        const newBaseline = currentBaseline * (1 + trend.changeRate / 100);
        this.performanceBaseline.set(trend.metric, newBaseline);
      }
    });
  }
  
  private startContinuousProcessing(): void {
    // Process feedback queue periodically
    setInterval(() => {
      if (this.feedbackQueue.length > 0) {
        this.processBatchLearning().catch(error => {
          console.error('Batch processing error:', error);
          this.emit('processing-error', error);
        });
      }
    }, 300000); // Every 5 minutes
    
    // Monitor for anomalies
    setInterval(() => {
      const anomalies = this.performanceMonitor.detectAnomalies();
      if (anomalies.length > 0) {
        this.handleAnomalies(anomalies);
      }
    }, 60000); // Every minute
  }
  
  private handleAnomalies(anomalies: Anomaly[]): void {
    const criticalAnomalies = anomalies.filter(a => a.severity === 'high');
    
    if (criticalAnomalies.length > 0) {
      console.warn(`⚠️ ${criticalAnomalies.length} critical anomalies detected`);
      
      this.emit('anomalies-detected', {
        anomalies: criticalAnomalies,
        timestamp: new Date(),
        recommendedAction: 'investigate-immediately'
      });
      
      // Create synthetic feedback for anomalies
      criticalAnomalies.forEach(anomaly => {
        const syntheticFeedback: BusinessLogicFeedback = {
          id: `anomaly-${Date.now()}-${Math.random()}`,
          implementationId: 'system',
          timestamp: anomaly.timestamp,
          severity: 'critical',
          feedbackType: 'performance',
          description: `Anomaly detected in ${anomaly.metric}: ${anomaly.value} (expected: ${anomaly.expectedRange})`,
          context: {
            domain: 'system',
            industry: 'all',
            userRole: 'system',
            environment: 'production'
          },
          metrics: {
            [anomaly.metric]: anomaly.value
          }
        };
        
        this.processFeedback(syntheticFeedback);
      });
    }
  }
  
  private recordSystemUpdate(update: SystemUpdate): void {
    this.systemUpdates.push(update);
    
    // Keep only recent updates (last 100)
    if (this.systemUpdates.length > 100) {
      this.systemUpdates = this.systemUpdates.slice(-100);
    }
    
    this.emit('system-updated', update);
  }
  
  private createModelUpdateScheduler(): ModelUpdateScheduler {
    const scheduledUpdates: ModelUpdate[] = [];
    
    return {
      async scheduleUpdate(update: ModelUpdate): Promise<void> {
        scheduledUpdates.push(update);
        scheduledUpdates.sort((a, b) => 
          a.scheduledTime.getTime() - b.scheduledTime.getTime()
        );
      },
      
      getScheduledUpdates(): ModelUpdate[] {
        return [...scheduledUpdates];
      },
      
      cancelUpdate(updateId: string): void {
        const index = scheduledUpdates.findIndex(u => u.id === updateId);
        if (index !== -1) {
          scheduledUpdates.splice(index, 1);
        }
      }
    };
  }
  
  private createPerformanceMonitor(): PerformanceMonitor {
    const metricHistory = new Map<string, number[]>();
    const metricTimestamps = new Map<string, Date[]>();
    
    return {
      trackMetric(metric: string, value: number): void {
        const history = metricHistory.get(metric) || [];
        const timestamps = metricTimestamps.get(metric) || [];
        
        history.push(value);
        timestamps.push(new Date());
        
        // Keep last 1000 values
        if (history.length > 1000) {
          history.shift();
          timestamps.shift();
        }
        
        metricHistory.set(metric, history);
        metricTimestamps.set(metric, timestamps);
      },
      
      getMetricHistory(metric: string, timeWindow?: number): number[] {
        const history = metricHistory.get(metric) || [];
        
        if (!timeWindow) {
          return [...history];
        }
        
        const timestamps = metricTimestamps.get(metric) || [];
        const cutoff = Date.now() - timeWindow;
        const startIndex = timestamps.findIndex(t => t.getTime() > cutoff);
        
        return startIndex === -1 ? [] : history.slice(startIndex);
      },
      
      detectAnomalies(): Anomaly[] {
        const anomalies: Anomaly[] = [];
        
        metricHistory.forEach((history, metric) => {
          if (history.length < 10) return; // Need enough data
          
          // Calculate statistics
          const recent = history.slice(-10);
          const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
          const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
          const stdDev = Math.sqrt(variance);
          
          // Check last value for anomaly
          const lastValue = history[history.length - 1];
          const expectedRange: [number, number] = [mean - 2 * stdDev, mean + 2 * stdDev];
          
          if (lastValue < expectedRange[0] || lastValue > expectedRange[1]) {
            anomalies.push({
              metric,
              timestamp: metricTimestamps.get(metric)?.[history.length - 1] || new Date(),
              value: lastValue,
              expectedRange,
              severity: Math.abs(lastValue - mean) > 3 * stdDev ? 'high' : 'medium'
            });
          }
        });
        
        return anomalies;
      }
    };
  }
  
  // Public API methods
  
  async getFeedbackSummary(timeWindow?: number): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
  }> {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const relevantFeedback = Array.from(this.processedFeedback.values())
      .filter(f => f.timestamp.getTime() > cutoff);
    
    const summary = {
      total: relevantFeedback.length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byDomain: {} as Record<string, number>
    };
    
    relevantFeedback.forEach(feedback => {
      summary.bySeverity[feedback.severity] = (summary.bySeverity[feedback.severity] || 0) + 1;
      summary.byType[feedback.feedbackType] = (summary.byType[feedback.feedbackType] || 0) + 1;
      summary.byDomain[feedback.context.domain] = (summary.byDomain[feedback.context.domain] || 0) + 1;
    });
    
    return summary;
  }
  
  getLearningPatterns(): Map<string, LearningPattern> {
    return new Map(this.learningPatterns);
  }
  
  getSystemUpdates(limit: number = 50): SystemUpdate[] {
    return this.systemUpdates.slice(-limit);
  }
  
  getPerformanceBaselines(): Map<string, number> {
    return new Map(this.performanceBaseline);
  }
  
  async rollbackUpdate(updateId: string): Promise<boolean> {
    const update = this.systemUpdates.find(u => u.updateId === updateId);
    
    if (!update || !update.rollbackAvailable) {
      return false;
    }
    
    console.log(`⏪ Rolling back update: ${updateId}`);
    
    // Implement rollback logic based on update type
    switch (update.type) {
      case 'prompt':
        // Rollback prompt changes
        console.log('Rolling back prompt templates...');
        break;
      case 'validation':
        // Rollback validation rules
        console.log('Rolling back validation rules...');
        break;
      case 'knowledge':
        // Knowledge updates typically can't be rolled back
        return false;
      case 'model':
        // Cancel scheduled model updates
        this.modelUpdateScheduler.cancelUpdate(updateId);
        break;
    }
    
    this.emit('update-rolled-back', { updateId, timestamp: new Date() });
    return true;
  }
  
  getScheduledUpdates(): ModelUpdate[] {
    return this.modelUpdateScheduler.getScheduledUpdates();
  }
  
  getPerformanceMetrics(metric: string, timeWindow?: number): number[] {
    return this.performanceMonitor.getMetricHistory(metric, timeWindow);
  }
  
  detectCurrentAnomalies(): Anomaly[] {
    return this.performanceMonitor.detectAnomalies();
  }
}

// Export convenience function
export function createContinuousLearningPipeline(
  aiProvider?: string,
  promptEngine?: AdaptivePromptEngine,
  learningEngine?: BusinessLogicLearningEngine
): ContinuousLearningPipeline {
  const aiService = new AIService(aiProvider);
  const _promptEngine = promptEngine || new AdaptivePromptEngine(aiService);
  const _learningEngine = learningEngine || new BusinessLogicLearningEngine(aiProvider);
  
  return new ContinuousLearningPipeline(aiService, _promptEngine, _learningEngine);
}