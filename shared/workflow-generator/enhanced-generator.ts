import { WorkflowPattern } from '../patterns';
import { AIService } from '../ai/ai-service';
import { PatternMatcher } from './pattern-matcher';
import { IntentAnalyzer } from './intent-analyzer';
import { WorkflowOptimizer } from './workflow-optimizer';

export interface GenerationOptions {
  platform: 'n8n' | 'make' | 'zapier' | 'vapi';
  description: string;
  name: string;
  useAI?: boolean;
  patternMatchingThreshold?: number;
  includeCredentials?: boolean;
  optimizeForCost?: boolean;
  optimizeForSpeed?: boolean;
}

export interface GenerationResult {
  success: boolean;
  workflow?: any;
  pattern?: WorkflowPattern;
  confidence: number;
  method: 'ai' | 'pattern' | 'hybrid';
  suggestions?: string[];
  requiredCredentials?: string[];
  estimatedCost?: number;
  estimatedExecutionTime?: number;
}

export class EnhancedWorkflowGenerator {
  private aiService: AIService;
  private patternMatcher: PatternMatcher;
  private intentAnalyzer: IntentAnalyzer;
  private optimizer: WorkflowOptimizer;

  constructor(
    aiApiKey?: string,
    private patterns: WorkflowPattern[] = []
  ) {
    this.aiService = new AIService(aiApiKey);
    this.patternMatcher = new PatternMatcher(patterns);
    this.intentAnalyzer = new IntentAnalyzer();
    this.optimizer = new WorkflowOptimizer();
  }

  async generate(options: GenerationOptions): Promise<GenerationResult> {
    console.log(`🚀 Generating workflow for: ${options.description}`);

    // Step 1: Analyze user intent
    const intent = await this.intentAnalyzer.analyze(options.description);
    console.log('📊 Intent analysis:', intent);

    // Step 2: Try pattern matching first
    const patternResult = await this.tryPatternGeneration(options, intent);
    
    if (patternResult.confidence > (options.patternMatchingThreshold || 0.7)) {
      console.log('✅ Using pattern-based generation');
      return patternResult;
    }

    // Step 3: If pattern matching isn't confident enough and AI is enabled
    if (options.useAI) {
      const aiResult = await this.tryAIGeneration(options, intent);
      
      if (aiResult.confidence > patternResult.confidence) {
        console.log('✅ Using AI-based generation');
        return aiResult;
      }
    }

    // Step 4: Hybrid approach - enhance pattern with AI
    if (patternResult.pattern && options.useAI) {
      const hybridResult = await this.enhancePatternWithAI(
        patternResult.pattern,
        options,
        intent
      );
      
      if (hybridResult.confidence > patternResult.confidence) {
        console.log('✅ Using hybrid generation');
        return hybridResult;
      }
    }

    // Return best result
    return patternResult;
  }

  private async tryPatternGeneration(
    options: GenerationOptions,
    intent: any
  ): Promise<GenerationResult> {
    // Find matching patterns
    const matches = this.patternMatcher.findMatches(
      options.description,
      options.platform,
      intent
    );

    if (matches.length === 0) {
      return {
        success: false,
        confidence: 0,
        method: 'pattern',
        suggestions: ['No matching patterns found. Try being more specific.']
      };
    }

    const bestMatch = matches[0];
    
    // Get platform-specific workflow
    const platformWorkflow = bestMatch.pattern.platforms[options.platform];
    
    if (!platformWorkflow) {
      return {
        success: false,
        confidence: bestMatch.score / 100,
        method: 'pattern',
        pattern: bestMatch.pattern,
        suggestions: [`Pattern found but not available for ${options.platform}`]
      };
    }

    // Customize workflow with user's specific requirements
    let workflow = this.customizeWorkflow(
      platformWorkflow,
      options,
      intent
    );

    // Optimize if requested
    if (options.optimizeForCost || options.optimizeForSpeed) {
      workflow = await this.optimizer.optimize(workflow, {
        platform: options.platform,
        optimizeForCost: options.optimizeForCost,
        optimizeForSpeed: options.optimizeForSpeed
      });
    }

    return {
      success: true,
      workflow: {
        ...workflow,
        name: options.name
      },
      pattern: bestMatch.pattern,
      confidence: bestMatch.score / 100,
      method: 'pattern',
      requiredCredentials: bestMatch.pattern.requiredServices,
      estimatedCost: this.estimateCost(workflow, options.platform),
      estimatedExecutionTime: this.estimateExecutionTime(workflow, options.platform)
    };
  }

  private async tryAIGeneration(
    options: GenerationOptions,
    intent: any
  ): Promise<GenerationResult> {
    try {
      const aiPrompt = this.buildAIPrompt(options, intent);
      const aiResponse = await this.aiService.generateWorkflow(
        options.platform,
        aiPrompt,
        options.name
      );

      if (!aiResponse.workflow) {
        return {
          success: false,
          confidence: 0,
          method: 'ai',
          suggestions: ['AI generation failed. Try pattern-based approach.']
        };
      }

      return {
        success: true,
        workflow: aiResponse.workflow,
        confidence: aiResponse.confidence || 0.8,
        method: 'ai',
        suggestions: aiResponse.suggestions,
        requiredCredentials: aiResponse.requiredCredentials,
        estimatedCost: this.estimateCost(aiResponse.workflow, options.platform),
        estimatedExecutionTime: this.estimateExecutionTime(aiResponse.workflow, options.platform)
      };
    } catch (error) {
      console.error('AI generation error:', error);
      return {
        success: false,
        confidence: 0,
        method: 'ai',
        suggestions: ['AI service unavailable']
      };
    }
  }

  private async enhancePatternWithAI(
    pattern: WorkflowPattern,
    options: GenerationOptions,
    intent: any
  ): Promise<GenerationResult> {
    const baseWorkflow = pattern.platforms[options.platform];
    
    if (!baseWorkflow) {
      return {
        success: false,
        confidence: 0,
        method: 'hybrid'
      };
    }

    try {
      // Use AI to enhance the pattern
      const enhancementPrompt = `
        Enhance this ${options.platform} workflow based on the user's specific requirements:
        
        User Request: ${options.description}
        Base Pattern: ${pattern.name}
        
        Current Workflow: ${JSON.stringify(baseWorkflow, null, 2)}
        
        Enhance the workflow by:
        1. Adding any missing nodes based on the user's requirements
        2. Updating node parameters with specific values
        3. Optimizing the flow for the use case
        4. Adding error handling if needed
        
        Return the enhanced workflow in the same format.
      `;

      const aiResponse = await this.aiService.enhance(enhancementPrompt);
      
      return {
        success: true,
        workflow: {
          ...aiResponse.workflow,
          name: options.name
        },
        pattern,
        confidence: 0.9, // High confidence for hybrid approach
        method: 'hybrid',
        suggestions: aiResponse.suggestions,
        requiredCredentials: pattern.requiredServices
      };
    } catch (error) {
      // Fallback to pattern only
      return this.tryPatternGeneration(options, intent);
    }
  }

  private customizeWorkflow(
    workflow: any,
    options: GenerationOptions,
    intent: any
  ): any {
    // Deep clone the workflow
    const customized = JSON.parse(JSON.stringify(workflow));
    
    // Update workflow name
    if (customized.name) {
      customized.name = options.name;
    }
    
    // Platform-specific customizations
    switch (options.platform) {
      case 'n8n':
        return this.customizeN8nWorkflow(customized, intent);
      case 'make':
        return this.customizeMakeScenario(customized, intent);
      case 'zapier':
        return this.customizeZapierZap(customized, intent);
      case 'vapi':
        return this.customizeVapiAssistant(customized, intent);
      default:
        return customized;
    }
  }

  private customizeN8nWorkflow(workflow: any, intent: any): any {
    // Add custom node parameters based on intent
    if (intent.entities) {
      workflow.nodes?.forEach((node: any) => {
        // Customize webhook paths
        if (node.type === 'n8n-nodes-base.webhook' && intent.entities.webhook_path) {
          node.parameters.path = intent.entities.webhook_path;
        }
        
        // Customize email parameters
        if (node.type === 'n8n-nodes-base.emailSend' && intent.entities.email) {
          if (intent.entities.email_subject) {
            node.parameters.subject = intent.entities.email_subject;
          }
        }
        
        // Add more customizations as needed
      });
    }
    
    return workflow;
  }

  private customizeMakeScenario(scenario: any, intent: any): any {
    // Make.com specific customizations
    return scenario;
  }

  private customizeZapierZap(zap: any, intent: any): any {
    // Zapier specific customizations
    return zap;
  }

  private customizeVapiAssistant(assistant: any, intent: any): any {
    // VAPI specific customizations
    if (intent.entities) {
      if (intent.entities.assistant_name) {
        assistant.name = intent.entities.assistant_name;
      }
      
      if (intent.entities.greeting) {
        assistant.firstMessage = intent.entities.greeting;
      }
      
      if (intent.entities.voice_style) {
        assistant.voice = {
          ...assistant.voice,
          style: intent.entities.voice_style
        };
      }
    }
    
    return assistant;
  }

  private buildAIPrompt(options: GenerationOptions, intent: any): string {
    return `
      Create a ${options.platform} workflow/automation for the following request:
      
      User Request: ${options.description}
      Workflow Name: ${options.name}
      
      Detected Intent: ${JSON.stringify(intent, null, 2)}
      
      Requirements:
      - Use best practices for ${options.platform}
      - Include error handling
      - Make it production-ready
      - Use appropriate node types and configurations
      
      ${options.optimizeForCost ? '- Optimize for minimal API calls and cost' : ''}
      ${options.optimizeForSpeed ? '- Optimize for fastest execution' : ''}
      
      Return a valid ${options.platform} workflow/configuration.
    `;
  }

  private estimateCost(workflow: any, platform: string): number {
    // Rough cost estimation based on nodes and API calls
    let cost = 0;
    
    switch (platform) {
      case 'n8n':
        // Estimate based on node types
        workflow.nodes?.forEach((node: any) => {
          if (node.type.includes('openAi')) cost += 0.02;
          if (node.type.includes('httpRequest')) cost += 0.001;
          // Add more cost calculations
        });
        break;
      case 'vapi':
        // VAPI has per-minute pricing
        cost = 0.05; // Base cost per call
        break;
      // Add other platforms
    }
    
    return cost;
  }

  private estimateExecutionTime(workflow: any, platform: string): number {
    // Rough execution time estimation in seconds
    let time = 0;
    
    switch (platform) {
      case 'n8n':
        // Estimate based on node types
        workflow.nodes?.forEach((node: any) => {
          if (node.type.includes('wait')) time += 60;
          if (node.type.includes('httpRequest')) time += 2;
          if (node.type.includes('openAi')) time += 5;
          // Add more time calculations
        });
        break;
      // Add other platforms
    }
    
    return time || 5; // Default 5 seconds
  }
}