import { 
  FeedbackData, 
  LearningContext, 
  WorkflowSimilarity,
  GenerationRecord,
  PerformanceMetric,
  WorkflowPattern
} from './types.js';
import { KnowledgeStore } from './knowledge-store.js';
import { PatternAnalyzer } from './pattern-analyzer.js';
import { SYSTEM_RULES, rulesToLearningContext, getCriticalRules } from './system-rules.js';

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
    // Get system rules first
    const systemRules = rulesToLearningContext();
    
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
    
    // Merge system rules with learned knowledge
    const mergedErrors = [...new Set([
      ...systemRules.avoidErrors,
      ...commonErrors
    ])];
    
    const mergedBestPractices = [...new Set([
      ...systemRules.bestPractices,
      ...bestPractices
    ])];
    
    // Add system-specific patterns
    const systemPatterns = this.createSystemPatterns();
    
    return {
      similarWorkflows: similarities,
      commonPatterns: [...systemPatterns, ...patterns.filter(p => p.successRate > 0.7)],
      avoidErrors: mergedErrors,
      bestPractices: mergedBestPractices
    };
  }

  async enhancePrompt(userPrompt: string, context: LearningContext): Promise<string> {
    let enhancedPrompt = userPrompt;
    
    // Add critical system rules first
    const criticalRules = getCriticalRules();
    if (criticalRules.length > 0) {
      enhancedPrompt += '\n\n🚨 CRITICAL REQUIREMENTS:\n';
      enhancedPrompt += criticalRules
        .slice(0, 5) // Top 5 critical rules
        .map(r => `- ${r.rule}`)
        .join('\n');
    }
    
    // Add successful pattern hints
    if (context.commonPatterns.length > 0) {
      const systemPatterns = context.commonPatterns.filter(p => p.successRate >= 1.0);
      const learnedPatterns = context.commonPatterns.filter(p => p.successRate < 1.0);
      
      if (systemPatterns.length > 0) {
        enhancedPrompt += '\n\nMandatory patterns:\n';
        enhancedPrompt += systemPatterns
          .map(p => `- ${p.type}: ${p.commonConfigurations[0]?.rule || 'Required'}`)
          .join('\n');
      }
      
      if (learnedPatterns.length > 0) {
        enhancedPrompt += '\n\nRecommended patterns:\n';
        enhancedPrompt += learnedPatterns
          .slice(0, 3)
          .map(p => `- ${p.type}: ${(p.successRate * 100).toFixed(0)}% success rate`)
          .join('\n');
      }
    }
    
    // Add error avoidance with emphasis on system errors
    if (context.avoidErrors.length > 0) {
      const systemErrors = SYSTEM_RULES.avoidErrors;
      const criticalErrors = context.avoidErrors.filter(e => systemErrors.includes(e));
      const otherErrors = context.avoidErrors.filter(e => !systemErrors.includes(e));
      
      enhancedPrompt += '\n\n❌ NEVER DO:\n';
      if (criticalErrors.length > 0) {
        enhancedPrompt += criticalErrors
          .slice(0, 5)
          .map(e => `- ${e}`)
          .join('\n');
      }
      
      if (otherErrors.length > 0) {
        enhancedPrompt += '\n\nAlso avoid:\n';
        enhancedPrompt += otherErrors
          .slice(0, 3)
          .map(e => `- ${e}`)
          .join('\n');
      }
    }
    
    // Add best practices with system rules highlighted
    if (context.bestPractices.length > 0) {
      const systemPractices = SYSTEM_RULES.bestPractices;
      const criticalPractices = context.bestPractices.filter(p => systemPractices.includes(p));
      const otherPractices = context.bestPractices.filter(p => !systemPractices.includes(p));
      
      enhancedPrompt += '\n\n✅ ALWAYS:\n';
      if (criticalPractices.length > 0) {
        enhancedPrompt += criticalPractices
          .slice(0, 5)
          .map(p => `- ${p}`)
          .join('\n');
      }
      
      if (otherPractices.length > 0 && criticalPractices.length < 5) {
        enhancedPrompt += otherPractices
          .slice(0, 5 - criticalPractices.length)
          .map(p => `- ${p}`)
          .join('\n');
      }
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
    
    // Learn switch node patterns
    this.learnSwitchNodePatterns(generations);
  }
  
  private learnSwitchNodePatterns(generations: GenerationRecord[]): void {
    const switchPatterns: any[] = [];
    
    generations.forEach(gen => {
      if (gen.workflow && gen.workflow.nodes) {
        const switchNodes = gen.workflow.nodes.filter((n: any) => n.type === 'n8n-nodes-base.switch');
        
        switchNodes.forEach((switchNode: any) => {
          const connections = gen.workflow.connections[switchNode.name] || gen.workflow.connections[switchNode.id];
          
          if (connections?.main && Array.isArray(connections.main)) {
            const hasAllConnections = connections.main.every((branch: any[]) => branch && branch.length > 0);
            const outputCount = connections.main.length;
            
            switchPatterns.push({
              nodeId: switchNode.id,
              nodeName: switchNode.name,
              outputCount: outputCount,
              hasAllConnections: hasAllConnections,
              success: gen.success && hasAllConnections,
              pattern: hasAllConnections ? 'properly_connected_switch' : 'incomplete_switch'
            });
          } else {
            switchPatterns.push({
              nodeId: switchNode.id,
              nodeName: switchNode.name,
              outputCount: 0,
              hasAllConnections: false,
              success: false,
              pattern: 'disconnected_switch'
            });
          }
        });
      }
    });
    
    // Store successful switch patterns
    const successfulPatterns = switchPatterns.filter(p => p.success);
    if (successfulPatterns.length > 0) {
      this.knowledgeStore.addPattern('switch_connections', {
        totalAnalyzed: switchPatterns.length,
        successful: successfulPatterns.length,
        averageOutputs: successfulPatterns.reduce((sum, p) => sum + p.outputCount, 0) / successfulPatterns.length,
        commonPatterns: successfulPatterns.slice(0, 5)
      });
    }
    
    // Store failed patterns for learning
    const failedPatterns = switchPatterns.filter(p => !p.success);
    if (failedPatterns.length > 0) {
      console.log(`Found ${failedPatterns.length} switch nodes with connection issues`);
      this.knowledgeStore.addPattern('switch_failures', {
        total: failedPatterns.length,
        disconnected: failedPatterns.filter(p => p.pattern === 'disconnected_switch').length,
        incomplete: failedPatterns.filter(p => p.pattern === 'incomplete_switch').length
      });
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

  private createSystemPatterns(): WorkflowPattern[] {
    return [
      {
        type: 'metadata_compliance',
        frequency: 1000, // Always required
        successRate: 1.0,
        commonConfigurations: [{
          rule: 'All workflows must include id, versionId, meta.instanceId',
          severity: 'critical'
        }],
        commonErrors: ['Missing workflow metadata fields']
      },
      {
        type: 'connection_validation',
        frequency: 1000,
        successRate: 0.95,
        commonConfigurations: [{
          rule: 'All non-trigger nodes must have incoming connections',
          autoFix: true
        }],
        commonErrors: ['Disconnected nodes found']
      },
      {
        type: 'branch_completion',
        frequency: 800,
        successRate: 0.9,
        commonConfigurations: [{
          rule: 'Branches must end with save/send/notify operations',
          examples: ['database save', 'email send', 'webhook response']
        }],
        commonErrors: ['Empty branches without conclusions']
      },
      {
        type: 'error_handling',
        frequency: 600,
        successRate: 0.85,
        commonConfigurations: [{
          rule: 'Critical operations need error handling',
          criticalOps: ['database', 'external APIs', 'file operations']
        }],
        commonErrors: ['Missing error handling for critical operations']
      },
      {
        type: 'no_templates',
        frequency: 1000,
        successRate: 1.0,
        commonConfigurations: [{
          rule: 'NEVER use hardcoded templates',
          severity: 'critical'
        }],
        commonErrors: ['Template-based generation detected']
      }
    ];
  }
}