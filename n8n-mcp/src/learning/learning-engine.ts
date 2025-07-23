import { 
  FeedbackData, 
  LearningContext, 
  WorkflowSimilarity,
  GenerationRecord,
  PerformanceMetric
} from './types.js';
import { KnowledgeStore } from './knowledge-store.js';
import { PatternAnalyzer } from './pattern-analyzer.js';

export class LearningEngine {
  private knowledgeStore: KnowledgeStore;
  private patternAnalyzer: PatternAnalyzer;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(dataDir?: string) {
    this.knowledgeStore = new KnowledgeStore(dataDir);
    this.patternAnalyzer = new PatternAnalyzer();
    
    // Start periodic pattern analysis
    this.startPeriodicAnalysis();
  }

  async recordGeneration(record: GenerationRecord): Promise<void> {
    await this.knowledgeStore.saveGeneration(record);
  }

  async recordFeedback(feedback: FeedbackData): Promise<void> {
    await this.knowledgeStore.saveFeedback(feedback);
    
    // Update metrics
    await this.updateMetrics();
  }

  async getLearningContext(prompt: string): Promise<LearningContext> {
    // Find similar workflows
    const similarGenerations = await this.knowledgeStore.findSimilarWorkflows(prompt);
    const feedbacks = await this.knowledgeStore.loadFeedback();
    const patterns = await this.knowledgeStore.loadPatterns();
    
    // Map generations to similarities with outcomes
    const similarities: WorkflowSimilarity[] = similarGenerations.map(gen => {
      const feedback = feedbacks.find(f => 
        f.workflowId === gen.id || 
        f.prompt.toLowerCase() === gen.prompt.toLowerCase()
      );
      
      return {
        workflowId: gen.id,
        similarity: 0.8, // Simplified for now
        outcome: feedback?.outcome || 'success',
        configuration: gen.workflow
      };
    });
    
    // Get common errors to avoid
    const commonErrors = await this.knowledgeStore.getCommonErrors();
    
    // Get best practices
    const bestPractices = await this.knowledgeStore.getBestPractices();
    
    return {
      similarWorkflows: similarities,
      commonPatterns: patterns.filter(p => p.successRate > 0.7),
      avoidErrors: commonErrors,
      bestPractices
    };
  }

  async enhancePrompt(userPrompt: string, context: LearningContext): Promise<string> {
    let enhancedPrompt = userPrompt;
    
    // Add successful pattern hints
    if (context.commonPatterns.length > 0) {
      const patternHints = context.commonPatterns
        .map(p => `- ${p.type}: ${(p.successRate * 100).toFixed(0)}% success rate`)
        .join('\n');
      
      enhancedPrompt += `\n\nConsider these successful patterns:\n${patternHints}`;
    }
    
    // Add error avoidance
    if (context.avoidErrors.length > 0) {
      const errorList = context.avoidErrors
        .map(e => `- ${e}`)
        .join('\n');
      
      enhancedPrompt += `\n\nAvoid these common issues:\n${errorList}`;
    }
    
    // Add best practices
    if (context.bestPractices.length > 0) {
      const practiceList = context.bestPractices
        .slice(0, 3)
        .map(p => `- ${p}`)
        .join('\n');
      
      enhancedPrompt += `\n\nBest practices:\n${practiceList}`;
    }
    
    return enhancedPrompt;
  }

  async findSimilarRequests(prompt: string): Promise<GenerationRecord[]> {
    return await this.knowledgeStore.findSimilarWorkflows(prompt);
  }

  private async updateMetrics(): Promise<void> {
    const feedbacks = await this.knowledgeStore.loadFeedback();
    const metricsMap = new Map<string, PerformanceMetric>();
    
    feedbacks.forEach(feedback => {
      const key = feedback.workflowType;
      const metric = metricsMap.get(key) || {
        workflowType: key,
        count: 0,
        avgExecutionTime: 0,
        successRate: 0,
        lastUpdated: new Date()
      };
      
      metric.count++;
      if (feedback.executionTime) {
        metric.avgExecutionTime = 
          (metric.avgExecutionTime * (metric.count - 1) + feedback.executionTime) / metric.count;
      }
      
      metricsMap.set(key, metric);
    });
    
    // Calculate success rates
    metricsMap.forEach((metric, key) => {
      const typeFeeedbacks = feedbacks.filter(f => f.workflowType === key);
      const successful = typeFeeedbacks.filter(f => f.outcome === 'success').length;
      metric.successRate = successful / typeFeeedbacks.length;
    });
    
    await this.knowledgeStore.updateMetrics(Array.from(metricsMap.values()));
  }

  private async analyzePatterns(): Promise<void> {
    const feedbacks = await this.knowledgeStore.loadFeedback();
    const generations = await this.knowledgeStore.loadGenerations();
    
    const patterns = this.patternAnalyzer.analyzePatterns(feedbacks, generations);
    await this.knowledgeStore.updatePatterns(patterns);
    
    // Log merge node issue detection
    const mergeIssues = this.patternAnalyzer.detectMergeNodeIssue(generations);
    if (mergeIssues > 0) {
      console.log(`Detected ${mergeIssues} workflows with merge node connection issues`);
    }
  }

  private startPeriodicAnalysis(): void {
    // Run analysis every hour
    this.updateInterval = setInterval(() => {
      this.analyzePatterns().catch(error => {
        console.error('Pattern analysis failed:', error);
      });
    }, 60 * 60 * 1000); // 1 hour
    
    // Run initial analysis
    this.analyzePatterns().catch(error => {
      console.error('Initial pattern analysis failed:', error);
    });
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}