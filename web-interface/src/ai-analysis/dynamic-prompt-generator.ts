import { AIAnalyzer } from './ai-analyzer';
import { PatternRecognizer } from './pattern-recognizer';
import { WorkflowArchitect } from './workflow-architect';
import { LearningEngine } from './learning-engine';
import { DeepAnalysis, RecognizedPatterns, WorkflowArchitecture, DynamicPrompt } from './types';

export class DynamicPromptGenerator {
  private aiAnalyzer: AIAnalyzer;
  private patternRecognizer: PatternRecognizer;
  private workflowArchitect: WorkflowArchitect;
  private learningEngine: LearningEngine;
  
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
    this.workflowArchitect = new WorkflowArchitect();
    this.learningEngine = new LearningEngine();
  }
  
  async generateDynamicPrompt(userRequest: string): Promise<DynamicPrompt> {
    try {
      // Step 1: Deep analysis of user request
      const deepAnalysis = await this.aiAnalyzer.analyzeRequest(userRequest);
      
      // Step 2: Recognize patterns from historical data
      const patterns = await this.patternRecognizer.recognizePatterns(deepAnalysis);
      
      // Step 3: Design optimal workflow architecture
      const architecture = await this.workflowArchitect.designArchitecture(deepAnalysis, patterns);
      
      // Step 4: Get improvement suggestions from learning engine
      const improvements = await this.learningEngine.suggestImprovements(architecture);
      
      // Step 5: Generate dynamic prompt based on all insights
      const dynamicPrompt = await this.createDynamicPrompt(
        deepAnalysis,
        patterns,
        architecture,
        improvements
      );
      
      return dynamicPrompt;
    } catch (error) {
      console.error('Error generating dynamic prompt:', error);
      throw error;
    }
  }
  
  private async createDynamicPrompt(
    analysis: DeepAnalysis,
    patterns: RecognizedPatterns,
    architecture: WorkflowArchitecture,
    improvements: string[]
  ): Promise<DynamicPrompt> {
    // Generate contextual prompt introduction
    const introduction = await this.generateIntroduction(analysis);
    
    // Generate workflow-specific instructions
    const workflowInstructions = await this.generateWorkflowInstructions(architecture);
    
    // Generate optimization guidelines
    const optimizationGuidelines = await this.generateOptimizationGuidelines(patterns, improvements);
    
    // Generate quality assurance checklist
    const qualityChecklist = await this.generateQualityChecklist(analysis, architecture);
    
    return {
      systemPrompt: this.buildSystemPrompt(introduction, workflowInstructions),
      userPrompt: this.buildUserPrompt(analysis, architecture),
      contextualGuidelines: optimizationGuidelines,
      qualityChecklist,
      metadata: {
        analysisDepth: analysis.complexityScore,
        patternCount: patterns.successPatterns.length,
        nodeCount: architecture.nodes.length,
        improvementCount: improvements.length,
        generatedAt: new Date().toISOString()
      }
    };
  }
  
  private async generateIntroduction(analysis: DeepAnalysis): Promise<string> {
    const response = await this.aiAnalyzer.analyze(
      `Generate a concise introduction for an n8n workflow creation based on:
      Intent: ${analysis.intent.primaryGoal}
      Context: ${analysis.intent.businessContext}
      Complexity: ${analysis.complexityScore}
      
      The introduction should:
      1. Acknowledge the user's goal
      2. Set appropriate expectations
      3. Highlight key considerations`
    );
    
    return response.introduction || '';
  }
  
  private async generateWorkflowInstructions(architecture: WorkflowArchitecture): Promise<string> {
    const nodeDescriptions = architecture.nodes.map((node, index) => 
      `Step ${index + 1}: ${node.type} - ${node.configuration.description || ''}`
    ).join('\n');
    
    const response = await this.aiAnalyzer.analyze(
      `Generate detailed workflow instructions for:
      ${nodeDescriptions}
      
      Connections: ${JSON.stringify(architecture.connections)}
      
      Include:
      1. Step-by-step configuration guide
      2. Parameter recommendations
      3. Error handling strategies
      4. Testing approaches`
    );
    
    return response.instructions || '';
  }
  
  private async generateOptimizationGuidelines(
    patterns: RecognizedPatterns,
    improvements: string[]
  ): Promise<string[]> {
    const guidelines = [
      ...patterns.bestPractices,
      ...improvements,
      'Monitor workflow execution times and optimize bottlenecks',
      'Implement proper error handling for each node',
      'Use caching where appropriate to improve performance',
      'Document complex logic for future maintenance'
    ];
    
    // Remove duplicates and sort by relevance
    return [...new Set(guidelines)];
  }
  
  private async generateQualityChecklist(
    analysis: DeepAnalysis,
    architecture: WorkflowArchitecture
  ): Promise<string[]> {
    const baseChecklist = [
      'All nodes are properly configured with required parameters',
      'Error handling is implemented for critical nodes',
      'Workflow has been tested with sample data',
      'Performance meets acceptable thresholds',
      'Security considerations have been addressed'
    ];
    
    // Add context-specific checks
    if (analysis.intent.urgency === 'high') {
      baseChecklist.push('Workflow includes monitoring and alerting');
    }
    
    if (architecture.nodes.some(n => n.type.includes('database'))) {
      baseChecklist.push('Database connections are properly secured');
      baseChecklist.push('Query performance has been optimized');
    }
    
    if (architecture.nodes.some(n => n.type.includes('api'))) {
      baseChecklist.push('API rate limits are respected');
      baseChecklist.push('API credentials are securely stored');
    }
    
    return baseChecklist;
  }
  
  private buildSystemPrompt(introduction: string, instructions: string): string {
    return `${introduction}

You are an expert n8n workflow architect with deep understanding of automation patterns and best practices.

${instructions}

Key Principles:
1. Always prioritize reliability and maintainability
2. Implement comprehensive error handling
3. Optimize for performance without sacrificing clarity
4. Provide clear documentation and comments
5. Follow security best practices

Remember to:
- Validate all inputs and outputs
- Handle edge cases gracefully
- Provide meaningful error messages
- Consider scalability from the start`;
  }
  
  private buildUserPrompt(analysis: DeepAnalysis, architecture: WorkflowArchitecture): string {
    return `Create an n8n workflow for: ${analysis.intent.primaryGoal}

Business Context: ${analysis.intent.businessContext}
Scope: ${analysis.intent.scope}
Urgency: ${analysis.intent.urgency}

Required Components:
${architecture.nodes.map(n => `- ${n.type}: ${n.purpose}`).join('\n')}

Technical Requirements:
${analysis.technicalRequirements.map(req => `- ${req}`).join('\n')}

Constraints:
${analysis.constraints.map(c => `- ${c}`).join('\n')}

Please provide a complete, production-ready workflow that addresses all requirements.`;
  }
}