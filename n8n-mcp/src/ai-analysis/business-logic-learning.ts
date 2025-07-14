import { EventEmitter } from 'events';
import { AIService } from '../ai-service.js';
import { CodeGenerationDatabase } from '../code-generation/database/code-generation-db.js';
import { 
  BusinessLogicRequest, 
  BusinessLogicImplementation, 
  BusinessOutcome,
  BusinessDomain 
} from './business-logic-generator.js';

export interface BusinessLogicLearning {
  successfulPatterns: {
    mathematicalApproaches: string;
    businessRuleHandling: string;
    domainSpecificInsights: string;
    performanceOptimizations: string;
  };
  reusableBusinessLogic: {
    calculationMethods: string[];
    validationApproaches: string[];
    decisionAlgorithms: string[];
    errorHandlingPatterns: string[];
  };
  domainKnowledge: {
    businessRules: string[];
    industryPatterns: string[];
    mathematicalModels: string[];
    scalabilityInsights: string[];
  };
  improvementOpportunities: {
    accuracyImprovements: string[];
    performanceEnhancements: string[];
    userExperience: string[];
  };
}

export interface DomainKnowledge {
  domain: string;
  patterns: PatternLibrary;
  successMetrics: SuccessMetrics;
  commonMistakes: string[];
  bestPractices: string[];
  examples: Array<{
    description: string;
    implementation: string;
    result: 'success' | 'failure';
    confidence: number;
  }>;
}

export interface PatternLibrary {
  calculationPatterns: Map<string, CalculationPattern>;
  validationPatterns: Map<string, ValidationPattern>;
  decisionPatterns: Map<string, DecisionPattern>;
}

export interface CalculationPattern {
  name: string;
  formula: string;
  applicability: string[];
  successRate: number;
  usageCount: number;
}

export interface ValidationPattern {
  name: string;
  rules: string[];
  errorMessages: string[];
  successRate: number;
}

export interface DecisionPattern {
  name: string;
  criteria: string[];
  thresholds: Record<string, number>;
  outcomes: string[];
  accuracy: number;
}

export interface SuccessMetrics {
  totalImplementations: number;
  successfulImplementations: number;
  averageConfidence: number;
  commonSuccessFactors: string[];
  commonFailureReasons: string[];
}

export class BusinessLogicLearningEngine extends EventEmitter {
  private aiService: AIService;
  private database: CodeGenerationDatabase;
  private domainKnowledge: Map<string, DomainKnowledge> = new Map();
  private learningHistory: Array<{
    timestamp: Date;
    request: BusinessLogicRequest;
    outcome: BusinessOutcome;
    learnings: BusinessLogicLearning;
  }> = [];
  
  constructor(aiProvider?: string) {
    super();
    this.aiService = new AIService(aiProvider);
    this.database = new CodeGenerationDatabase();
    this.initializeDomainKnowledge();
  }
  
  private initializeDomainKnowledge(): void {
    // Initialize common business domains
    const domains = ['sales', 'finance', 'hr', 'operations', 'marketing'];
    
    domains.forEach(domain => {
      this.domainKnowledge.set(domain, {
        domain,
        patterns: {
          calculationPatterns: new Map(),
          validationPatterns: new Map(),
          decisionPatterns: new Map()
        },
        successMetrics: {
          totalImplementations: 0,
          successfulImplementations: 0,
          averageConfidence: 0,
          commonSuccessFactors: [],
          commonFailureReasons: []
        },
        commonMistakes: [],
        bestPractices: [],
        examples: []
      });
    });
  }
  
  async learnFromBusinessOutcome(
    request: BusinessLogicRequest,
    generatedLogic: BusinessLogicImplementation,
    businessOutcome: BusinessOutcome,
    domain: BusinessDomain
  ): Promise<void> {
    console.log(`📚 Learning from business outcome (${businessOutcome.success ? 'SUCCESS' : 'FAILURE'})`);
    
    let learnings: BusinessLogicLearning;
    
    if (businessOutcome.success) {
      learnings = await this.analyzeSuccessfulLogic(request, generatedLogic, businessOutcome, domain);
      await this.reinforceSuccessfulPatterns(domain.businessDomain.function, learnings);
    } else {
      learnings = await this.analyzeFailedLogic(request, generatedLogic, businessOutcome, domain);
      await this.learnFromFailures(domain.businessDomain.function, learnings, businessOutcome);
    }
    
    // Store learning history
    this.learningHistory.push({
      timestamp: new Date(),
      request,
      outcome: businessOutcome,
      learnings
    });
    
    // Update domain knowledge
    await this.updateDomainKnowledge(domain.businessDomain.function, businessOutcome, learnings);
    
    // Emit learning event
    this.emit('learning-complete', {
      domain: domain.businessDomain.function,
      success: businessOutcome.success,
      learnings
    });
  }
  
  private async analyzeSuccessfulLogic(
    request: BusinessLogicRequest,
    logic: BusinessLogicImplementation,
    outcome: BusinessOutcome,
    domain: BusinessDomain
  ): Promise<BusinessLogicLearning> {
    const learningPrompt = `
TASK: Analyze this successful business logic implementation and extract learnings.

ORIGINAL REQUEST:
${JSON.stringify(request, null, 2)}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

IMPLEMENTED LOGIC:
${logic.implementation}

BUSINESS OUTCOME:
${JSON.stringify(outcome, null, 2)}

Extract learnings for future business logic generation:

{
  "successfulPatterns": {
    "mathematicalApproaches": "What mathematical approaches worked well?",
    "businessRuleHandling": "How were business rules successfully implemented?",
    "domainSpecificInsights": "What domain-specific insights were effective?",
    "performanceOptimizations": "What performance optimizations were successful?"
  },
  "reusableBusinessLogic": {
    "calculationMethods": ["specific calculation patterns that can be reused"],
    "validationApproaches": ["effective validation strategies"],
    "decisionAlgorithms": ["successful decision-making algorithms"],
    "errorHandlingPatterns": ["effective error handling for business scenarios"]
  },
  "domainKnowledge": {
    "businessRules": ["business rules that were successfully captured"],
    "industryPatterns": ["industry-specific patterns that worked"],
    "mathematicalModels": ["mathematical models that were effective"],
    "scalabilityInsights": ["insights about scaling this logic"]
  },
  "improvementOpportunities": {
    "accuracyImprovements": ["ways to improve calculation accuracy"],
    "performanceEnhancements": ["performance improvement opportunities"],
    "userExperience": ["ways to improve business user experience"]
  }
}

Focus on SPECIFIC, ACTIONABLE learnings that can improve future implementations.`;

    const result = await this.aiService.getJSONResponse(learningPrompt);
    return result as BusinessLogicLearning;
  }
  
  private async analyzeFailedLogic(
    request: BusinessLogicRequest,
    logic: BusinessLogicImplementation,
    outcome: BusinessOutcome,
    domain: BusinessDomain
  ): Promise<BusinessLogicLearning> {
    const failureAnalysisPrompt = `
TASK: Analyze this failed business logic implementation and extract learnings.

ORIGINAL REQUEST:
${JSON.stringify(request, null, 2)}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

IMPLEMENTED LOGIC:
${logic.implementation}

BUSINESS OUTCOME (FAILED):
${JSON.stringify(outcome, null, 2)}

Analyze what went wrong and extract learnings:

{
  "successfulPatterns": {
    "mathematicalApproaches": "What mathematical approaches should be avoided?",
    "businessRuleHandling": "What business rule handling mistakes were made?",
    "domainSpecificInsights": "What domain understanding was missing?",
    "performanceOptimizations": "What performance issues occurred?"
  },
  "reusableBusinessLogic": {
    "calculationMethods": ["calculation patterns to avoid"],
    "validationApproaches": ["validation gaps that need addressing"],
    "decisionAlgorithms": ["decision logic that failed"],
    "errorHandlingPatterns": ["missing error handling scenarios"]
  },
  "domainKnowledge": {
    "businessRules": ["business rules that were missed or misunderstood"],
    "industryPatterns": ["industry patterns that were not considered"],
    "mathematicalModels": ["mathematical models that failed"],
    "scalabilityInsights": ["scalability issues encountered"]
  },
  "improvementOpportunities": {
    "accuracyImprovements": ["specific accuracy issues to address"],
    "performanceEnhancements": ["performance problems to solve"],
    "userExperience": ["user experience issues to fix"]
  }
}

Focus on understanding WHY it failed and HOW to prevent similar failures.`;

    const result = await this.aiService.getJSONResponse(failureAnalysisPrompt);
    return result as BusinessLogicLearning;
  }
  
  private async reinforceSuccessfulPatterns(
    domain: string,
    learnings: BusinessLogicLearning
  ): Promise<void> {
    const domainKnowledge = this.domainKnowledge.get(domain);
    if (!domainKnowledge) return;
    
    // Extract and store calculation patterns
    learnings.reusableBusinessLogic.calculationMethods.forEach(method => {
      const patternKey = this.generatePatternKey(method);
      const existing = domainKnowledge.patterns.calculationPatterns.get(patternKey);
      
      if (existing) {
        existing.successRate = (existing.successRate * existing.usageCount + 1) / (existing.usageCount + 1);
        existing.usageCount++;
      } else {
        domainKnowledge.patterns.calculationPatterns.set(patternKey, {
          name: patternKey,
          formula: method,
          applicability: [domain],
          successRate: 1.0,
          usageCount: 1
        });
      }
    });
    
    // Update success metrics
    domainKnowledge.successMetrics.totalImplementations++;
    domainKnowledge.successMetrics.successfulImplementations++;
    domainKnowledge.successMetrics.averageConfidence = 
      (domainKnowledge.successMetrics.averageConfidence * (domainKnowledge.successMetrics.totalImplementations - 1) + 0.8) /
      domainKnowledge.successMetrics.totalImplementations;
    
    // Add best practices
    if (learnings.domainKnowledge.industryPatterns.length > 0) {
      domainKnowledge.bestPractices.push(...learnings.domainKnowledge.industryPatterns);
      domainKnowledge.bestPractices = [...new Set(domainKnowledge.bestPractices)];
    }
  }
  
  private async learnFromFailures(
    domain: string,
    learnings: BusinessLogicLearning,
    outcome: BusinessOutcome
  ): Promise<void> {
    const domainKnowledge = this.domainKnowledge.get(domain);
    if (!domainKnowledge) return;
    
    // Update failure metrics
    domainKnowledge.successMetrics.totalImplementations++;
    
    // Add to common mistakes
    if (outcome.errors && outcome.errors.length > 0) {
      domainKnowledge.commonMistakes.push(...outcome.errors);
      domainKnowledge.commonMistakes = [...new Set(domainKnowledge.commonMistakes)];
    }
    
    // Add failure reasons
    const failureReasons = learnings.improvementOpportunities.accuracyImprovements.concat(
      learnings.improvementOpportunities.performanceEnhancements
    );
    domainKnowledge.successMetrics.commonFailureReasons.push(...failureReasons);
    domainKnowledge.successMetrics.commonFailureReasons = 
      [...new Set(domainKnowledge.successMetrics.commonFailureReasons)];
  }
  
  private async updateDomainKnowledge(
    domain: string,
    outcome: BusinessOutcome,
    learnings: BusinessLogicLearning
  ): Promise<void> {
    const updatePrompt = `
TASK: Update domain knowledge based on business logic implementation outcome.

DOMAIN: ${domain}
OUTCOME: ${outcome.success ? 'SUCCESS' : 'FAILURE'}
LEARNINGS: ${JSON.stringify(learnings, null, 2)}

Synthesize key insights that should be remembered for future ${domain} domain implementations:

{
  "keyInsights": ["most important learnings"],
  "patternUpdates": ["patterns to reinforce or avoid"],
  "domainSpecificRules": ["domain-specific rules discovered"],
  "optimizationStrategies": ["optimization approaches for this domain"]
}`;

    const insights = await this.aiService.getJSONResponse(updatePrompt);
    
    // Store insights in database for persistence
    await this.database.storeCodeRequest({
      id: `learning_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      request: {
        type: 'domain-learning',
        description: `Learning from ${domain} implementation`,
        context: { domain, success: outcome.success },
        language: 'learning',
        framework: 'business-logic'
      },
      generatedCode: JSON.stringify(insights),
      metadata: { learnings, outcome },
      feedback: null
    });
  }
  
  private generatePatternKey(pattern: string): string {
    // Generate a normalized key for pattern matching
    return pattern
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .substring(0, 50);
  }
  
  // Public API methods
  
  async getDomainInsights(domain: string): Promise<DomainKnowledge | null> {
    return this.domainKnowledge.get(domain) || null;
  }
  
  async getSuccessfulPatterns(domain: string, patternType?: string): Promise<any[]> {
    const domainKnowledge = this.domainKnowledge.get(domain);
    if (!domainKnowledge) return [];
    
    const patterns: any[] = [];
    
    if (!patternType || patternType === 'calculation') {
      domainKnowledge.patterns.calculationPatterns.forEach(pattern => {
        if (pattern.successRate > 0.7) {
          patterns.push(pattern);
        }
      });
    }
    
    if (!patternType || patternType === 'validation') {
      domainKnowledge.patterns.validationPatterns.forEach(pattern => {
        if (pattern.successRate > 0.7) {
          patterns.push(pattern);
        }
      });
    }
    
    if (!patternType || patternType === 'decision') {
      domainKnowledge.patterns.decisionPatterns.forEach(pattern => {
        if (pattern.accuracy > 0.7) {
          patterns.push(pattern);
        }
      });
    }
    
    return patterns.sort((a, b) => (b.successRate || b.accuracy) - (a.successRate || a.accuracy));
  }
  
  async getRecommendationsForDomain(domain: string): Promise<{
    bestPractices: string[];
    avoidPatterns: string[];
    successFactors: string[];
  }> {
    const domainKnowledge = this.domainKnowledge.get(domain);
    if (!domainKnowledge) {
      return {
        bestPractices: [],
        avoidPatterns: [],
        successFactors: []
      };
    }
    
    return {
      bestPractices: domainKnowledge.bestPractices,
      avoidPatterns: domainKnowledge.commonMistakes,
      successFactors: domainKnowledge.successMetrics.commonSuccessFactors
    };
  }
  
  async generateLearningReport(): Promise<string> {
    let report = '# Business Logic Learning Report\n\n';
    
    this.domainKnowledge.forEach((knowledge, domain) => {
      report += `## ${domain.toUpperCase()} Domain\n\n`;
      report += `- Total Implementations: ${knowledge.successMetrics.totalImplementations}\n`;
      report += `- Success Rate: ${
        knowledge.successMetrics.totalImplementations > 0
          ? ((knowledge.successMetrics.successfulImplementations / knowledge.successMetrics.totalImplementations) * 100).toFixed(1)
          : 0
      }%\n`;
      report += `- Average Confidence: ${(knowledge.successMetrics.averageConfidence * 100).toFixed(1)}%\n\n`;
      
      if (knowledge.bestPractices.length > 0) {
        report += '### Best Practices\n';
        knowledge.bestPractices.slice(0, 5).forEach(practice => {
          report += `- ${practice}\n`;
        });
        report += '\n';
      }
      
      if (knowledge.commonMistakes.length > 0) {
        report += '### Common Mistakes\n';
        knowledge.commonMistakes.slice(0, 5).forEach(mistake => {
          report += `- ${mistake}\n`;
        });
        report += '\n';
      }
    });
    
    return report;
  }
  
  async exportLearnings(): Promise<any> {
    const learnings: any = {
      timestamp: new Date(),
      domains: {}
    };
    
    this.domainKnowledge.forEach((knowledge, domain) => {
      learnings.domains[domain] = {
        metrics: knowledge.successMetrics,
        patterns: {
          calculation: Array.from(knowledge.patterns.calculationPatterns.values()),
          validation: Array.from(knowledge.patterns.validationPatterns.values()),
          decision: Array.from(knowledge.patterns.decisionPatterns.values())
        },
        bestPractices: knowledge.bestPractices,
        commonMistakes: knowledge.commonMistakes
      };
    });
    
    return learnings;
  }
  
  async importLearnings(learnings: any): Promise<void> {
    if (!learnings.domains) return;
    
    Object.entries(learnings.domains).forEach(([domain, data]: [string, any]) => {
      const knowledge = this.domainKnowledge.get(domain) || this.createDomainKnowledge(domain);
      
      // Import metrics
      if (data.metrics) {
        knowledge.successMetrics = { ...knowledge.successMetrics, ...data.metrics };
      }
      
      // Import patterns
      if (data.patterns) {
        if (data.patterns.calculation) {
          data.patterns.calculation.forEach((pattern: CalculationPattern) => {
            knowledge.patterns.calculationPatterns.set(pattern.name, pattern);
          });
        }
      }
      
      // Import best practices and mistakes
      if (data.bestPractices) {
        knowledge.bestPractices = [...new Set([...knowledge.bestPractices, ...data.bestPractices])];
      }
      if (data.commonMistakes) {
        knowledge.commonMistakes = [...new Set([...knowledge.commonMistakes, ...data.commonMistakes])];
      }
      
      this.domainKnowledge.set(domain, knowledge);
    });
  }
  
  private createDomainKnowledge(domain: string): DomainKnowledge {
    return {
      domain,
      patterns: {
        calculationPatterns: new Map(),
        validationPatterns: new Map(),
        decisionPatterns: new Map()
      },
      successMetrics: {
        totalImplementations: 0,
        successfulImplementations: 0,
        averageConfidence: 0,
        commonSuccessFactors: [],
        commonFailureReasons: []
      },
      commonMistakes: [],
      bestPractices: [],
      examples: []
    };
  }
  
  reset(): void {
    console.log('🔄 Resetting Business Logic Learning Engine');
    this.domainKnowledge.clear();
    this.learningHistory = [];
    this.initializeDomainKnowledge();
  }

  async recordBusinessOutcome(outcome: {
    implementationId: string;
    success: boolean;
    confidence: number;
    executionTime: number;
    userFeedback?: string;
    errorDetails?: string;
    improvements?: string[];
  }): Promise<void> {
    console.log('📝 Recording business outcome:', outcome.implementationId);
    
    // Store in learning history
    // Note: we need to have a proper request and learnings to match the type
    // For now, we'll skip adding to learningHistory since we only have the outcome

    // Update success metrics
    const domain = this.extractDomainFromImplementationId(outcome.implementationId);
    if (domain) {
      const knowledge = this.domainKnowledge.get(domain);
      if (knowledge) {
        knowledge.successMetrics.totalImplementations++;
        if (outcome.success) {
          knowledge.successMetrics.successfulImplementations++;
        }
        
        // Update average confidence
        const metrics = knowledge.successMetrics;
        metrics.averageConfidence = 
          (metrics.averageConfidence * (metrics.totalImplementations - 1) + outcome.confidence) / 
          metrics.totalImplementations;

        // Store feedback
        if (outcome.userFeedback) {
          knowledge.examples.push({
            description: outcome.userFeedback,
            implementation: '',
            result: outcome.success ? 'success' : 'failure',
            confidence: outcome.confidence
          });
        }

        // Store error patterns
        if (!outcome.success && outcome.errorDetails) {
          knowledge.commonMistakes.push(outcome.errorDetails);
        }

        // Store improvements
        if (outcome.improvements && outcome.improvements.length > 0) {
          knowledge.bestPractices.push(...outcome.improvements);
        }
      }
    }
  }

  private extractDomainFromImplementationId(implementationId: string): string {
    // Extract domain from implementation ID format: domain_timestamp_random
    const parts = implementationId.split('_');
    return parts[0] || 'general';
  }
}

// Export convenience function
export function createBusinessLogicLearningEngine(aiProvider?: string): BusinessLogicLearningEngine {
  return new BusinessLogicLearningEngine(aiProvider);
}