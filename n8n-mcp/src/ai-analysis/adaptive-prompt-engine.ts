import { EventEmitter } from 'events';
import { AIService } from '../ai-service.js';

export interface PromptMetrics {
  successRate: number;
  avgConfidence: number;
  avgExecutionTime: number;
  commonFailureReasons: string[];
  successPatterns: string[];
}

export interface PromptTemplate {
  template: string;
  industry: string;
  context: string;
  performance: PromptMetrics;
  lastUpdated: Date;
}

export interface BusinessContext {
  industry: string;
  domain: string;
  complexity: 'simple' | 'moderate' | 'complex';
  requirements: string[];
  constraints: string[];
}

export interface GenerationResult {
  success: boolean;
  confidence: number;
  executionTime: number;
  output: any;
  errors?: string[];
}

export interface OptimizationResult {
  optimizedPrompt: string;
  optimizationType: string[];
  expectedImprovement: number;
  reasoning: string;
}

export class AdaptivePromptEngine extends EventEmitter {
  private promptPerformance = new Map<string, PromptMetrics>();
  private industryPrompts = new Map<string, PromptTemplate[]>();
  private contextPatterns = new Map<string, string[]>();
  private learningThreshold = 0.8; // 80% confidence threshold
  
  constructor(private aiService: AIService) {
    super();
    this.initializeIndustryPrompts();
  }
  
  async optimizePrompt(
    basePrompt: string,
    context: BusinessContext,
    previousResults: GenerationResult[] = []
  ): Promise<OptimizationResult> {
    
    console.log('🎯 Optimizing prompt for context:', context.industry, context.domain);
    
    // Analyze prompt performance if we have previous results
    const metrics = previousResults.length > 0 ? 
      this.analyzePromptPerformance(basePrompt, previousResults) :
      this.getDefaultMetrics();
    
    // Get industry-specific optimizations
    const industryOptimizations = await this.getIndustryOptimizations(context.industry);
    
    // Get context-aware optimizations
    const contextOptimizations = await this.getContextOptimizations(context);
    
    // Generate optimized prompt
    const optimizedPrompt = await this.synthesizeOptimizedPrompt(
      basePrompt,
      industryOptimizations,
      contextOptimizations,
      metrics
    );
    
    // Calculate expected improvement
    const expectedImprovement = this.calculateExpectedImprovement(metrics, context);
    
    return {
      optimizedPrompt,
      optimizationType: this.determineOptimizationTypes(industryOptimizations, contextOptimizations),
      expectedImprovement,
      reasoning: this.generateOptimizationReasoning(metrics, context)
    };
  }
  
  private analyzePromptPerformance(
    prompt: string,
    results: GenerationResult[]
  ): PromptMetrics {
    const successful = results.filter(r => r.success && r.confidence > this.learningThreshold);
    const failed = results.filter(r => !r.success || r.confidence < 0.6);
    
    const metrics: PromptMetrics = {
      successRate: successful.length / results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      avgExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
      commonFailureReasons: this.extractFailureReasons(failed),
      successPatterns: this.extractSuccessPatterns(successful)
    };
    
    // Store metrics for future reference
    this.promptPerformance.set(this.getPromptKey(prompt), metrics);
    
    return metrics;
  }
  
  private extractFailureReasons(failed: GenerationResult[]): string[] {
    const reasons: Map<string, number> = new Map();
    
    failed.forEach(result => {
      if (result.errors) {
        result.errors.forEach(error => {
          const count = reasons.get(error) || 0;
          reasons.set(error, count + 1);
        });
      }
    });
    
    // Sort by frequency and return top reasons
    return Array.from(reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);
  }
  
  private extractSuccessPatterns(successful: GenerationResult[]): string[] {
    // Analyze successful outputs for common patterns
    const patterns: string[] = [];
    
    if (successful.length > 0) {
      // Extract common structural patterns
      patterns.push('Clear task definition');
      patterns.push('Specific output format requirements');
      patterns.push('Industry context provided');
      
      // Add more sophisticated pattern extraction logic here
      if (successful.every(r => r.executionTime < 3000)) {
        patterns.push('Efficient execution pattern');
      }
      
      if (successful.every(r => r.confidence > 0.9)) {
        patterns.push('High confidence pattern');
      }
    }
    
    return patterns;
  }
  
  private async getIndustryOptimizations(industry: string): Promise<string[]> {
    const optimizations: string[] = [];
    
    switch (industry.toLowerCase()) {
      case 'finance':
      case 'banking':
        optimizations.push('Include regulatory compliance requirements');
        optimizations.push('Emphasize accuracy and precision in calculations');
        optimizations.push('Add risk assessment considerations');
        optimizations.push('Include audit trail requirements');
        break;
        
      case 'healthcare':
        optimizations.push('Include HIPAA compliance considerations');
        optimizations.push('Emphasize patient safety requirements');
        optimizations.push('Add clinical validation needs');
        optimizations.push('Include privacy protection measures');
        break;
        
      case 'retail':
      case 'ecommerce':
        optimizations.push('Include customer experience factors');
        optimizations.push('Add inventory management considerations');
        optimizations.push('Emphasize scalability requirements');
        optimizations.push('Include seasonal variation handling');
        break;
        
      case 'technology':
      case 'saas':
        optimizations.push('Emphasize performance optimization');
        optimizations.push('Include security best practices');
        optimizations.push('Add API design considerations');
        optimizations.push('Include multi-tenancy requirements');
        break;
        
      default:
        optimizations.push('Include industry best practices');
        optimizations.push('Add standard compliance requirements');
    }
    
    return optimizations;
  }
  
  private async getContextOptimizations(context: BusinessContext): Promise<string[]> {
    const optimizations: string[] = [];
    
    // Complexity-based optimizations
    switch (context.complexity) {
      case 'simple':
        optimizations.push('Focus on clarity and directness');
        optimizations.push('Minimize technical jargon');
        break;
        
      case 'moderate':
        optimizations.push('Balance detail with clarity');
        optimizations.push('Include step-by-step breakdowns');
        break;
        
      case 'complex':
        optimizations.push('Provide comprehensive analysis');
        optimizations.push('Include multiple solution approaches');
        optimizations.push('Add edge case handling');
        break;
    }
    
    // Requirement-based optimizations
    if (context.requirements.some(req => req.includes('performance'))) {
      optimizations.push('Emphasize performance optimization techniques');
    }
    
    if (context.requirements.some(req => req.includes('security'))) {
      optimizations.push('Include security validation steps');
    }
    
    if (context.requirements.some(req => req.includes('compliance'))) {
      optimizations.push('Add regulatory compliance checks');
    }
    
    // Constraint-based optimizations
    if (context.constraints.some(constraint => constraint.includes('time'))) {
      optimizations.push('Prioritize time-efficient solutions');
    }
    
    if (context.constraints.some(constraint => constraint.includes('resource'))) {
      optimizations.push('Focus on resource-efficient implementations');
    }
    
    return optimizations;
  }
  
  private async synthesizeOptimizedPrompt(
    basePrompt: string,
    industryOptimizations: string[],
    contextOptimizations: string[],
    metrics: PromptMetrics
  ): Promise<string> {
    
    const synthesisPrompt = `
TASK: Optimize this prompt based on performance metrics and optimization requirements.

BASE PROMPT:
${basePrompt}

PERFORMANCE METRICS:
- Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
- Average Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%
- Average Execution Time: ${metrics.avgExecutionTime}ms
- Common Failures: ${metrics.commonFailureReasons.join(', ') || 'None'}
- Success Patterns: ${metrics.successPatterns.join(', ') || 'None'}

INDUSTRY OPTIMIZATIONS:
${industryOptimizations.map(opt => `- ${opt}`).join('\n')}

CONTEXT OPTIMIZATIONS:
${contextOptimizations.map(opt => `- ${opt}`).join('\n')}

Generate an optimized version of the prompt that:
1. Addresses the common failure reasons
2. Reinforces the success patterns
3. Incorporates all industry-specific optimizations
4. Applies all context-specific optimizations
5. Maintains clarity and specificity
6. Improves expected success rate and confidence

Return ONLY the optimized prompt text, no explanations.`;

    const optimized = await this.aiService.callAI(synthesisPrompt);
    
    // Clean up the response
    return optimized.replace(/```[a-z]*\n?/g, '').trim();
  }
  
  private determineOptimizationTypes(
    industryOpts: string[],
    contextOpts: string[]
  ): string[] {
    const types: string[] = [];
    
    if (industryOpts.length > 0) types.push('industry-specific');
    if (contextOpts.length > 0) types.push('context-aware');
    if (industryOpts.some(opt => opt.includes('compliance'))) types.push('compliance-focused');
    if (contextOpts.some(opt => opt.includes('performance'))) types.push('performance-optimized');
    
    return types;
  }
  
  private calculateExpectedImprovement(metrics: PromptMetrics, context: BusinessContext): number {
    let improvement = 0;
    
    // Base improvement from addressing failures
    if (metrics.commonFailureReasons.length > 0) {
      improvement += 0.1 * metrics.commonFailureReasons.length; // 10% per failure reason addressed
    }
    
    // Improvement from success pattern reinforcement
    if (metrics.successPatterns.length > 0) {
      improvement += 0.05 * metrics.successPatterns.length; // 5% per success pattern
    }
    
    // Context complexity bonus
    switch (context.complexity) {
      case 'simple':
        improvement += 0.05;
        break;
      case 'moderate':
        improvement += 0.1;
        break;
      case 'complex':
        improvement += 0.15;
        break;
    }
    
    // Cap at realistic improvement
    return Math.min(improvement, 0.4); // Max 40% improvement
  }
  
  private generateOptimizationReasoning(metrics: PromptMetrics, context: BusinessContext): string {
    const reasons: string[] = [];
    
    if (metrics.successRate < 0.8) {
      reasons.push(`Low success rate (${(metrics.successRate * 100).toFixed(1)}%) addressed through targeted improvements`);
    }
    
    if (metrics.avgConfidence < 0.8) {
      reasons.push(`Confidence level improved through clearer task definition and requirements`);
    }
    
    if (metrics.commonFailureReasons.length > 0) {
      reasons.push(`Common failures addressed: ${metrics.commonFailureReasons.slice(0, 3).join(', ')}`);
    }
    
    reasons.push(`Industry-specific optimizations for ${context.industry} applied`);
    reasons.push(`Context complexity (${context.complexity}) considerations included`);
    
    return reasons.join('. ');
  }
  
  private getDefaultMetrics(): PromptMetrics {
    return {
      successRate: 0.7,
      avgConfidence: 0.75,
      avgExecutionTime: 3000,
      commonFailureReasons: [],
      successPatterns: ['Standard pattern']
    };
  }
  
  private getPromptKey(prompt: string): string {
    // Generate a unique key for the prompt (first 100 chars + hash)
    const preview = prompt.substring(0, 100);
    const hash = this.simpleHash(prompt);
    return `${preview}...${hash}`;
  }
  
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private initializeIndustryPrompts(): void {
    // Initialize with some default industry templates
    this.industryPrompts.set('finance', [
      {
        template: 'Financial calculation with regulatory compliance',
        industry: 'finance',
        context: 'risk-assessment',
        performance: this.getDefaultMetrics(),
        lastUpdated: new Date()
      }
    ]);
    
    this.industryPrompts.set('healthcare', [
      {
        template: 'Clinical decision support with patient safety',
        industry: 'healthcare',
        context: 'diagnosis-support',
        performance: this.getDefaultMetrics(),
        lastUpdated: new Date()
      }
    ]);
  }
  
  // Public methods for learning and adaptation
  
  async learnFromResult(prompt: string, result: GenerationResult): Promise<void> {
    const key = this.getPromptKey(prompt);
    const existing = this.promptPerformance.get(key) || this.getDefaultMetrics();
    
    // Update metrics with new result
    const updatedMetrics = this.updateMetrics(existing, result);
    this.promptPerformance.set(key, updatedMetrics);
    
    // Emit learning event
    this.emit('prompt-learning', {
      prompt: key,
      metrics: updatedMetrics,
      improvement: updatedMetrics.successRate - existing.successRate
    });
  }
  
  private updateMetrics(existing: PromptMetrics, newResult: GenerationResult): PromptMetrics {
    // Simple exponential moving average for updating metrics
    const alpha = 0.3; // Learning rate
    
    return {
      successRate: existing.successRate * (1 - alpha) + (newResult.success ? 1 : 0) * alpha,
      avgConfidence: existing.avgConfidence * (1 - alpha) + newResult.confidence * alpha,
      avgExecutionTime: existing.avgExecutionTime * (1 - alpha) + newResult.executionTime * alpha,
      commonFailureReasons: newResult.errors ? 
        [...existing.commonFailureReasons, ...newResult.errors].slice(-10) : 
        existing.commonFailureReasons,
      successPatterns: existing.successPatterns // Updated separately
    };
  }
  
  getPromptPerformanceMetrics(): Map<string, PromptMetrics> {
    return new Map(this.promptPerformance);
  }
  
  async suggestPromptImprovements(prompt: string): Promise<string[]> {
    const key = this.getPromptKey(prompt);
    const metrics = this.promptPerformance.get(key);
    
    if (!metrics) {
      return ['No performance data available for this prompt'];
    }
    
    const suggestions: string[] = [];
    
    if (metrics.successRate < 0.8) {
      suggestions.push('Consider adding more specific requirements to improve success rate');
    }
    
    if (metrics.avgConfidence < 0.8) {
      suggestions.push('Add clearer output format specifications to boost confidence');
    }
    
    if (metrics.avgExecutionTime > 5000) {
      suggestions.push('Simplify prompt structure to reduce execution time');
    }
    
    if (metrics.commonFailureReasons.length > 3) {
      suggestions.push(`Address common failures: ${metrics.commonFailureReasons.slice(0, 3).join(', ')}`);
    }
    
    return suggestions;
  }
}

// Export convenience function
export function createAdaptivePromptEngine(aiProvider?: string): AdaptivePromptEngine {
  return new AdaptivePromptEngine(new AIService(aiProvider));
}