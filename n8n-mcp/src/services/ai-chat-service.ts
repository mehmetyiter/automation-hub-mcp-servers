import { PromptToWorkflowMapper } from '../planning/prompt-to-workflow-mapper.js';
import { N8nKnowledgeBase } from '../knowledge/n8n-capabilities.js';
import { EnhancedPromptGenerator } from '../ai-analysis/enhanced-prompt-generator.js';
import { ProviderFactory } from '../providers/provider-factory.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  content?: string;
  usage?: any;
  error?: string;
  analysis?: any;
}

export class AIChatService {
  private promptMapper: PromptToWorkflowMapper;
  private knowledgeBase: N8nKnowledgeBase;
  
  constructor() {
    this.promptMapper = new PromptToWorkflowMapper();
    this.knowledgeBase = new N8nKnowledgeBase();
  }
  
  /**
   * Process chat messages through our system before sending to AI
   */
  async processChat(messages: ChatMessage[], providerConfig: any): Promise<ChatResponse> {
    try {
      // 1. Extract the last user message for analysis
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        return { success: false, error: 'No user message found' };
      }
      
      // 2. Analyze the user's request with PromptToWorkflowMapper
      console.log('Analyzing user request with PromptToWorkflowMapper...');
      const analysis = await this.promptMapper.analyzePrompt(lastUserMessage.content);
      
      // 3. Create enhanced system prompt based on analysis
      const enhancedSystemPrompt = this.createEnhancedSystemPrompt(analysis, lastUserMessage.content);
      
      // 4. Add node planning rules
      const nodePlanningRules = this.getNodePlanningRules(analysis);
      
      // 5. Add validation rules
      const validationRules = this.getValidationRules();
      
      // 6. Create enhanced messages array
      const enhancedMessages: ChatMessage[] = [
        {
          role: 'system',
          content: enhancedSystemPrompt + '\n\n' + nodePlanningRules + '\n\n' + validationRules
        },
        // Include conversation history but skip the original system prompt
        ...messages.filter(m => m.role !== 'system')
      ];
      
      // 7. Send to AI provider
      console.log('Creating provider with config:', { 
        provider: providerConfig.provider, 
        hasApiKey: !!providerConfig.apiKey,
        model: providerConfig.model 
      });
      
      const provider = ProviderFactory.createProvider(providerConfig);
      
      let response;
      if ('chat' in provider && typeof provider.chat === 'function') {
        console.log('Calling provider.chat with enhanced messages');
        response = await provider.chat(enhancedMessages);
        console.log('Provider chat response:', { success: response.success, hasContent: !!response.content });
      } else {
        // Fallback for workflow generation
        console.log('Provider does not support chat functionality');
        return { 
          success: false, 
          error: 'Provider does not support chat functionality' 
        };
      }
      
      // 8. Validate and enhance the response
      if (response.success) {
        const validatedContent = this.validateAndEnhanceResponse(
          response.content, 
          analysis
        );
        
        return {
          success: true,
          content: validatedContent,
          usage: response.usage,
          analysis: {
            features: Array.from(analysis.features.keys()),
            suggestedNodes: analysis.suggestedNodes,
            tasks: analysis.tasks.length
          }
        };
      }
      
      return response;
      
    } catch (error: any) {
      console.error('Chat processing error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process chat'
      };
    }
  }
  
  private createEnhancedSystemPrompt(analysis: any, userRequest: string): string {
    // Build context from analysis without using templates
    let context = `User wants to create: ${userRequest}\n\n`;
    
    if (analysis.features && analysis.features.size > 0) {
      context += 'Key aspects identified:\n';
      analysis.features.forEach((capabilities: string[], feature: string) => {
        context += `- ${feature}\n`;
      });
    }
    
    return `You are an AI assistant specialized in creating detailed n8n workflow automation prompts.

## CONTEXT:
${context}

## YOUR ROLE:
You are an expert workflow architect who creates comprehensive n8n automation solutions by deeply understanding user needs and expanding them into complete, production-ready workflows.

1. **Deep Requirements Analysis:**
   - Understand the core problem the user is trying to solve
   - Identify implicit requirements not directly stated
   - Consider edge cases and failure scenarios
   - Think about data flow, validation, and error recovery
   - Expand abbreviated concepts into full implementations

2. **Intelligent Workflow Design:**
   - Design workflows that solve the complete problem, not just stated features
   - Add necessary intermediate processing steps
   - Include proper data transformation and validation
   - Implement comprehensive monitoring and alerting
   - Create robust error handling and recovery mechanisms

3. **Ensuring Feature Completeness:**
   - Analyze the logical flow and dependencies between features
   - Identify all communication channels mentioned and implement each one
   - Recognize optimization requirements and create appropriate processing logic
   - Understand coordination needs between different entities or systems
   - Ensure every capability mentioned has proper implementation

4. **Creating Detailed Workflows:**
   - Don't simplify complex requirements
   - Create as many nodes as needed (50+ nodes is fine for complex workflows)
   - Include data transformation nodes between integrations
   - Add validation and error handling for each major section
   ${analysis.suggestedNodes.length > 0 ? `- Use these node types: ${analysis.suggestedNodes.join(', ')}` : ''}
   ${analysis.missingCapabilities.length > 0 ? `- Address these gaps: ${analysis.missingCapabilities.join(', ')}` : ''}

## WORKFLOW PROMPT GENERATION APPROACH:

When creating the workflow prompt:
1. **Expand the user's request** into a detailed implementation plan
2. **Infer missing components** that are logically necessary
3. **Add production-ready features** like monitoring, logging, and alerting
4. **Think holistically** about the entire system, not just individual features
5. **Create detailed node descriptions** that explain both what and why

Your response should be a comprehensive workflow design document that:
- Expands brief requirements into detailed specifications
- Adds necessary infrastructure (auth, validation, error handling)
- Includes all logical dependencies and data flows
- Provides clear implementation guidance for each component
- Results in a production-ready, scalable automation solution`;
  }
  
  private getNodePlanningRules(analysis: any): string {
    // Build dynamic guidance based on what's actually needed
    let rules = '';
    
    // Only add node type guidance if specific nodes were suggested
    if (analysis.suggestedNodes && analysis.suggestedNodes.length > 0) {
      rules += `For this workflow, use the appropriate n8n nodes based on your requirements.\n\n`;
    }
    
    // Add connection guidance only if complex flow is detected
    if (analysis.features.has('Complex Logic') || analysis.features.has('Parallel Processing')) {
      rules += `Ensure proper connections between nodes for smooth workflow execution.\n`;
    }
    
    // Add conditional logic guidance only if conditions are needed
    const needsConditions = analysis.features.has('Content Moderation') || 
                           analysis.features.has('Data Validation') ||
                           analysis.features.has('Conditional Logic');
    
    if (needsConditions) {
      rules += `Implement conditional logic where needed based on your specific requirements.\n`;
    }
    
    // Add error handling reminder only for workflows with external integrations
    if (analysis.features.has('API Integration') || analysis.features.has('External Services')) {
      rules += `Include appropriate error handling for external service calls.\n`;
    }
    
    // Add timing guidance only if scheduling or delays are needed
    if (analysis.features.has('Scheduling') || analysis.features.has('Time-based Processing')) {
      rules += `Consider timing requirements for scheduled or delayed operations.\n`;
    }
    
    return rules || 'Focus on implementing the specific requirements mentioned in the request.\n';
  }
  
  private getValidationRules(): string {
    // Return minimal, non-template validation guidance
    return `Ensure your workflow is complete and properly addresses all requirements.`;
  }
  
  private validateAndEnhanceResponse(content: string, analysis: any): string {
    // Check if response mentions required nodes
    const missingNodes: string[] = [];
    analysis.suggestedNodes.forEach((node: string) => {
      if (!content.toLowerCase().includes(node.toLowerCase())) {
        missingNodes.push(node);
      }
    });
    
    // Add warnings if critical elements are missing
    let enhancedContent = content;
    
    // Removed automatic warnings - they were adding unwanted content to prompts
    // These warnings were being appended to AI responses and causing issues
    
    return enhancedContent;
  }
}