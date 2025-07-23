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
      const provider = ProviderFactory.createProvider(providerConfig);
      
      let response;
      if ('chat' in provider && typeof provider.chat === 'function') {
        response = await provider.chat(enhancedMessages);
      } else {
        // Fallback for workflow generation
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
    const workflowPlan = this.promptMapper.createWorkflowPlan(analysis);
    
    return `You are an AI assistant specialized in creating detailed n8n workflow automation prompts.

## CRITICAL CONTEXT ABOUT USER'S REQUEST:
${workflowPlan}

## YOUR ENHANCED ROLE:
You help users create COMPREHENSIVE, PRODUCTION-READY workflow prompts by:

1. **Understanding Requirements Deeply:**
   - Analyze the features identified above
   - Consider the suggested nodes and tasks
   - Ensure all validation items are addressed

2. **Planning Node Structure:**
   - ALWAYS create a clear node-by-node plan
   - Specify exact connections between nodes
   - Include conditional logic (IF/Switch nodes) where needed
   - Add error handling nodes

3. **Ensuring Complete Workflows:**
   - Every workflow MUST have proper error handling
   - Parallel processes MUST have merge nodes
   - Conditional flows MUST handle all cases
   - Payment processes MUST NOT charge multiple times

4. **Technical Requirements:**
   ${analysis.suggestedNodes.length > 0 ? `- Use these node types: ${analysis.suggestedNodes.join(', ')}` : ''}
   ${analysis.missingCapabilities.length > 0 ? `- Address these gaps: ${analysis.missingCapabilities.join(', ')}` : ''}

When responding:
- Structure your response with clear sections
- Include SPECIFIC node connections (Node A -> Node B)
- Plan conditional logic explicitly (IF score < 7 THEN...)
- Consider timing and delays (Wait nodes for feedback)
- Ensure data flows logically between nodes`;
  }
  
  private getNodePlanningRules(analysis: any): string {
    return `## MANDATORY NODE PLANNING RULES:

### CRITICAL: USE ONLY VALID n8n NODE TYPES:
- n8n-nodes-base.webhook (NOT webhookTrigger)
- n8n-nodes-base.httpRequest
- n8n-nodes-base.code (NOT function)
- n8n-nodes-base.emailSend (NOT email)
- n8n-nodes-base.twilio (for SMS, NOT sms)
- n8n-nodes-base.whatsappBusiness (NOT whatsapp)
- n8n-nodes-base.mqtt (NOT mqttTrigger)
- n8n-nodes-base.cron (NOT cronTrigger)
- n8n-nodes-base.errorTrigger
- n8n-nodes-base.executeCommand
- n8n-nodes-base.googleDrive
- n8n-nodes-raspberry.raspberryPi (NOT gpio, for GPIO operations)

NEVER USE: function, gpio, mqttTrigger, cronTrigger, whatsapp, email, sms

### 1. CONNECTION STRUCTURE:
ALWAYS specify connections in this format:
- Trigger Node -> First Process Node
- Process Node -> Decision Node
- Decision Node -> Branch A (condition: true)
- Decision Node -> Branch B (condition: false)
- Branch A & Branch B -> Merge Node

### 2. CONDITIONAL LOGIC REQUIREMENTS:
${analysis.features.has('Content Moderation') ? `
- Anti-fraud Check -> IF Node:
  - Low Risk -> Continue Processing
  - High Risk -> Manual Review + Admin Notification
` : ''}
${analysis.features.has('Data Storage') ? `
- Stock Check -> IF Node:
  - In Stock -> Continue Order
  - Out of Stock -> Cancel + Notify Customer
` : ''}
${analysis.features.has('Notifications') && analysis.features.has('NLP Analysis') ? `
- NPS Evaluation -> Switch Node:
  - Score 0-6 -> Customer Service Ticket
  - Score 7-8 -> Standard Campaign
  - Score 9-10 -> Referral Program
` : ''}

### 3. PARALLEL PROCESSING:
When multiple operations can run simultaneously:
- Use parallel branches from a single node
- ALWAYS add a Merge node after parallel branches
- Example: Payment Success -> [Update CRM, Send Email, Update Inventory] -> Merge -> Continue

### 4. ERROR HANDLING:
Every workflow MUST include:
- Error Trigger node for global error catching
- Try/Catch pattern for critical operations
- Specific error outputs for payment/API nodes

### 5. TIMING CONSIDERATIONS:
${analysis.features.has('Scheduling') ? '- Use Cron nodes for scheduled triggers' : ''}
${analysis.features.has('Notifications') ? '- Add Wait nodes before sending follow-up messages' : ''}
- Consider API rate limits with delay nodes`;
  }
  
  private getValidationRules(): string {
    return `## VALIDATION CHECKLIST FOR YOUR RESPONSE:

Before finalizing your response, ensure:
☑ All nodes are connected (no orphaned nodes)
☑ Payment methods use Switch node (not parallel execution)
☑ Error handling exists for all external API calls
☑ Merge nodes follow all parallel branches
☑ IF nodes have both true/false paths connected
☑ Wait nodes are used for delayed actions
☑ Data transformation nodes exist between incompatible APIs
☑ CRM/ERP updates happen at multiple points (not just end)

## COMMON MISTAKES TO AVOID:
❌ Don't process multiple payment methods simultaneously
❌ Don't send feedback immediately after order (use Wait node)
❌ Don't continue processing if critical checks fail
❌ Don't forget merge nodes after parallel branches
❌ Don't create linear flows when parallel processing is possible`;
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