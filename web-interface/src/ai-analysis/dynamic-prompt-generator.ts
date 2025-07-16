import { AIAnalyzer } from './ai-analyzer';
import { WorkflowArchitect } from './workflow-architect';
import { LearningEngine } from './learning-engine';
import { DeepAnalysis, WorkflowArchitecture, DynamicPrompt } from './types';

export class DynamicPromptGenerator {
  private aiAnalyzer: AIAnalyzer;
  private workflowArchitect: WorkflowArchitect;
  private learningEngine: LearningEngine;
  
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
    this.workflowArchitect = new WorkflowArchitect();
    this.learningEngine = new LearningEngine();
  }
  
  async generateDynamicPrompt(userRequest: string): Promise<DynamicPrompt> {
    try {
      // Step 1: Deep analysis of user request
      const deepAnalysis = await this.aiAnalyzer.analyzeRequest(userRequest);
      
      // Step 2: Design optimal workflow architecture (AI-driven, no patterns)
      const architecture = await this.workflowArchitect.designArchitecture(deepAnalysis);
      
      // Step 3: Get improvement suggestions from learning engine
      const improvements = await this.learningEngine.suggestImprovements(architecture);
      
      // Step 4: Generate pure AI dynamic prompt
      const dynamicPrompt = await this.createPureAIDynamicPrompt(
        deepAnalysis,
        architecture,
        improvements
      );
      
      return dynamicPrompt;
    } catch (error) {
      console.error('Error generating dynamic prompt:', error);
      throw error;
    }
  }
  
  private async createPureAIDynamicPrompt(
    analysis: DeepAnalysis,
    architecture: WorkflowArchitecture,
    improvements: string[]
  ): Promise<DynamicPrompt> {
    // Generate contextual prompt introduction using pure AI
    const introduction = await this.generateAIIntroduction(analysis);
    
    // Generate workflow-specific instructions with AI creativity
    const workflowInstructions = await this.generateAIWorkflowInstructions(architecture);
    
    // Generate AI-driven optimization guidelines
    const optimizationGuidelines = await this.generateAIOptimizationGuidelines(analysis, improvements);
    
    // Generate dynamic quality checklist
    const qualityChecklist = await this.generateAIQualityChecklist(analysis, architecture);
    
    return {
      systemPrompt: this.buildAISystemPrompt(introduction, workflowInstructions),
      userPrompt: this.buildAIUserPrompt(analysis, architecture),
      contextualGuidelines: optimizationGuidelines,
      qualityChecklist,
      metadata: {
        analysisDepth: analysis.complexityScore,
        nodeCount: architecture?.nodes?.length || 0,
        improvementCount: improvements.length,
        generatedAt: new Date().toISOString(),
        approach: 'pure-ai-dynamic'
      }
    };
  }
  
  private async generateAIIntroduction(analysis: DeepAnalysis): Promise<string> {
    const response = await this.aiAnalyzer.analyze(
      `As a creative AI workflow architect, generate a dynamic introduction that:
      
      CONTEXT:
      - Goal: ${analysis?.intent?.primaryGoal || 'Create automation'}
      - Business Context: ${analysis?.intent?.businessContext || 'general'}
      - Complexity: ${analysis?.complexityScore || 'medium'}
      
      APPROACH:
      - Be creative and adaptive, not pattern-based
      - Focus on innovative solutions
      - Encourage AI to think outside conventional patterns
      - Emphasize unique aspects of this specific request
      
      Generate a fresh, creative introduction that breaks away from standard templates.`
    );
    
    return response.introduction || 'Let me design a creative, custom workflow solution for your unique needs.';
  }
  
  private async generateAIWorkflowInstructions(architecture: WorkflowArchitecture): Promise<string> {
    const response = await this.aiAnalyzer.analyze(
      `As an innovative AI architect, create dynamic workflow instructions that:
      
      CREATIVE APPROACH:
      - Don't follow rigid templates or patterns
      - Invent new solutions specific to this workflow
      - Think creatively about node combinations
      - Suggest innovative approaches not seen before
      
      WORKFLOW CONTEXT:
      - Nodes: ${architecture?.nodes?.length || 0} components
      - Connections: ${JSON.stringify(architecture?.connections || {})}
      - Complexity: ${architecture?.estimatedComplexity || 'medium'}
      
      INSTRUCTIONS SHOULD:
      - Be inventive and adaptive
      - Suggest creative optimization techniques
      - Propose novel error handling approaches
      - Include unique testing strategies
      
      Generate fresh, innovative instructions that break conventional patterns.`
    );
    
    return response.instructions || 'Create an innovative, purpose-built workflow solution.';
  }
  
  private async generateAIOptimizationGuidelines(
    analysis: DeepAnalysis,
    improvements: string[]
  ): Promise<string[]> {
    const response = await this.aiAnalyzer.analyze(
      `As a creative AI optimizer, generate innovative optimization guidelines for:
      
      CONTEXT:
      - Goal: ${analysis?.intent?.primaryGoal || 'automation'}
      - Business Context: ${analysis?.intent?.businessContext || 'general'}
      - Complexity: ${analysis?.complexityScore || 'medium'}
      
      CREATIVE OPTIMIZATION APPROACH:
      - Don't use standard optimization patterns
      - Think of novel optimization techniques
      - Consider unique performance approaches
      - Suggest creative caching strategies
      - Invent new error handling methods
      
      CURRENT IMPROVEMENTS: ${improvements.join(', ')}
      
      Generate 5-7 innovative, creative optimization guidelines that break away from conventional approaches.`
    );
    
    return response.guidelines || [
      'Implement adaptive performance monitoring',
      'Create dynamic error recovery strategies',
      'Develop intelligent caching mechanisms',
      'Design flexible scaling approaches',
      'Build innovative debugging capabilities'
    ];
  }
  
  private async generateAIQualityChecklist(
    analysis: DeepAnalysis,
    architecture: WorkflowArchitecture
  ): Promise<string[]> {
    const response = await this.aiAnalyzer.analyze(
      `As an innovative AI quality assurance specialist, create a dynamic quality checklist for:
      
      CONTEXT:
      - Goal: ${analysis?.intent?.primaryGoal || 'automation'}
      - Urgency: ${analysis?.intent?.urgency || 'medium'}
      - Nodes: ${architecture?.nodes?.length || 0} components
      
      CREATIVE QA APPROACH:
      - Don't use standard quality checklists
      - Think of innovative quality metrics
      - Consider unique testing approaches
      - Suggest creative validation methods
      - Invent new quality assurance techniques
      
      SPECIFIC CONSIDERATIONS:
      - Node types: ${architecture?.nodes?.map(n => n.type).join(', ') || 'various'}
      - Estimated complexity: ${architecture.estimatedComplexity}
      
      Generate 6-8 innovative, creative quality checks that go beyond conventional QA approaches.`
    );
    
    return response.checklist || [
      'Verify adaptive error handling responds to different failure scenarios',
      'Ensure workflow demonstrates intelligent decision-making capabilities',
      'Test dynamic performance scaling under various load conditions',
      'Validate innovative integration approaches function correctly',
      'Confirm creative optimization techniques improve efficiency',
      'Verify workflow adapts to changing requirements gracefully'
    ];
  }
  
  private buildAISystemPrompt(introduction: string, instructions: string): string {
    return `${introduction}

🚀 You are an INNOVATIVE AI workflow architect who breaks conventional patterns and creates unique solutions.

${instructions}

🎯 CREATIVE PRINCIPLES:
1. BREAK away from standard patterns - invent new approaches
2. THINK creatively about node combinations and connections
3. INNOVATE beyond traditional automation workflows
4. ADAPT dynamically to specific user needs
5. CREATE unique solutions that haven't been seen before

🔥 DYNAMIC APPROACH:
- Don't follow rigid templates or patterns
- Invent new workflow architectures
- Think outside conventional automation boxes
- Suggest creative, innovative solutions
- Adapt to the specific context and requirements

⚡ INNOVATION FOCUS:
- Generate fresh, creative workflow designs
- Propose novel integration approaches
- Suggest innovative optimization techniques
- Create adaptive error handling strategies
- Design intelligent, responsive workflows`;
  }
  
  private buildAIUserPrompt(analysis: DeepAnalysis, architecture: WorkflowArchitecture): string {
    return `🎯 CREATIVE CHALLENGE: Design an innovative n8n workflow for: ${analysis?.intent?.primaryGoal || 'automation'}

🌟 CONTEXT FOR INNOVATION:
- Business Context: ${analysis?.intent?.businessContext || 'general'}
- Scope: ${analysis?.intent?.scope || 'standard'}
- Urgency: ${analysis?.intent?.urgency || 'medium'}

🚀 ARCHITECTURAL INSPIRATION:
${architecture?.nodes?.map(n => `- ${n.type}: ${n.purpose || 'custom solution'}`).join('\n') || '- Create innovative node combinations'}

💡 CREATIVE REQUIREMENTS:
${analysis?.technicalRequirements?.map(req => `- ${req}`).join('\n') || '- Create innovative technical solutions'}

🔥 INNOVATION CONSTRAINTS:
${analysis?.constraints?.map(c => `- ${c}`).join('\n') || '- Push creative boundaries within limits'}

⚡ MISSION: Create a completely UNIQUE, innovative workflow that:
- Breaks away from conventional patterns
- Demonstrates creative problem-solving
- Introduces novel automation approaches
- Adapts dynamically to specific needs
- Showcases innovative architecture design

Don't just build a workflow - INNOVATE a revolutionary automation solution!`;
  }
}