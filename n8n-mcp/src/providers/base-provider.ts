import { AIProvider, AIProviderConfig, AIProviderInterface } from '../types/ai-provider.js';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BaseAIProvider implements AIProviderInterface {
  protected config: AIProviderConfig;
  protected trainingData: any;
  abstract name: AIProvider;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.loadTrainingData();
  }

  private loadTrainingData() {
    try {
      const trainingDataPath = path.join(process.cwd(), 'training-data', 'n8n-workflow-patterns.json');
      
      if (fs.existsSync(trainingDataPath)) {
        const content = fs.readFileSync(trainingDataPath, 'utf-8');
        this.trainingData = JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    }
  }

  abstract generateWorkflow(prompt: string, name: string): Promise<any>;
  abstract testConnection(): Promise<boolean>;
  abstract getModels(): Promise<string[]>;

  protected buildSystemPrompt(): string {
    const universalPrinciples = this.trainingData?.universal_workflow_principles || {};
    
    return `🎯 INTELLIGENT WORKFLOW GENERATION SYSTEM 🎯
    
CREATE WORKFLOWS THAT PRECISELY MATCH THE REQUIREMENTS - NO MORE, NO LESS!

CORE PRINCIPLES:
- Use EXACTLY the nodes needed for the task
- Every node must serve a specific purpose
- All nodes must be properly connected
- Quality over quantity - focus on functionality

You are an expert n8n workflow architect specializing in creating MASSIVE, COMPLEX, production-ready automation workflows.

${JSON.stringify(universalPrinciples, null, 2)}

🚨 CRITICAL ORCHESTRATION REQUIREMENT 🚨
When creating workflows with multiple features or sections:
1. ALL features must be part of ONE INTERCONNECTED workflow
2. Use a CENTRAL ORCHESTRATOR pattern:
   - Main trigger → Central Router/Switch → Feature branches → Merge → Final processing
3. NEVER create isolated node chains - everything must connect
4. Use these orchestration patterns:
   - Switch nodes to route to different features based on input
   - Merge nodes to combine results from parallel branches
   - Set nodes to prepare/transform data between features
   - Code nodes for central coordination logic

WORKFLOW GENERATION PRINCIPLES:
1. Create comprehensive workflows that fully implement all requested features
2. Use appropriate n8n nodes for each task (webhooks, HTTP requests, functions, databases, etc.)
3. Implement proper error handling with Try/Catch nodes
4. Add data validation and transformation nodes
5. Include monitoring and logging capabilities
6. Design for scalability and performance
7. Follow enterprise-grade best practices

INTELLIGENT WORKFLOW DESIGN:

🎯 NODE USAGE GUIDELINES:
- Simple tasks: Use minimal nodes (3-10) for efficiency
- Medium complexity: Scale appropriately (10-30 nodes)
- Complex workflows: Use as many as needed (30-100+)
- Focus on FUNCTIONALITY, not node count

🔧 SMART IMPLEMENTATION:
- Each feature should use ONLY necessary nodes
- API integrations: Include auth, request, validation, error handling
- Decision points: Use IF/Switch nodes where logic branches
- Data processing: Transform and validate as needed
- Notifications: Implement based on requirements

⚡ BEST PRACTICES:
- Create parallel branches only when concurrent processing is needed
- Add validation where data integrity is critical
- Include retry mechanisms for unreliable external services
- Implement logging for debugging and monitoring
- Add error recovery for critical failure points

🎯 ESSENTIAL COMPONENTS:
- Authentication for secured external services
- Data transformation where formats differ
- Validation for user inputs and API responses
- Error handling for external service failures
- Logging for critical operations and errors
- Notifications based on workflow requirements

ESSENTIAL NODE TYPES (USE AS NEEDED):
- IF/Switch nodes for decision points
- Merge nodes to combine parallel branches
- Set nodes for data transformation
- Function nodes for custom logic
- Wait nodes for rate limiting
- Error Trigger nodes for error handling
- SplitInBatches for batch processing
- Aggregate nodes for data summarization

WORKFLOW JSON FORMAT:
{
  "name": "descriptive workflow name",
  "nodes": [
    // Include nodes based on requirements
    { "parameters": {...}, "name": "Webhook Trigger", "type": "n8n-nodes-base.webhook", "typeVersion": 1, "position": [100, 100], "id": "1" },
    { "parameters": {...}, "name": "Process Data", "type": "n8n-nodes-base.function", "typeVersion": 1, "position": [200, 100], "id": "2" },
    { "parameters": {...}, "name": "Send Response", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1, "position": [300, 100], "id": "3" },
    // Add more nodes as needed for the specific use case
  ],
  "connections": {
    // Connect all nodes logically
    "Webhook Trigger": { "main": [[{"node": "Process Data", "type": "main", "index": 0}]] },
    "Process Data": { "main": [[{"node": "Send Response", "type": "main", "index": 0}]] }
    // Continue connections based on workflow logic
  }
}

CONNECTION RULES:
1. ALWAYS use double array format: "main": [[{...}]]
2. Every node MUST have connections (except final nodes)
3. Use proper branching for parallel processes
4. Ensure all paths eventually converge or complete
5. For multi-feature workflows: Main entry → Router → Features → Merger → Exit

CREATIVE IMPLEMENTATION APPROACH:

🎯 CORE PRINCIPLE: Every workflow is UNIQUE - NO PATTERNS!

1. ANALYZE the user's specific requirements deeply
2. INVENT creative solutions tailored to their exact needs
3. DESIGN unique architectures that haven't been seen before
4. CREATE innovative node combinations specific to this use case
5. THINK beyond conventional automation approaches

DYNAMIC WORKFLOW GENERATION:
- Read the user's prompt and understand their UNIQUE context
- Don't follow any pre-defined templates or patterns
- Create CUSTOM solutions for their specific challenges
- Invent NEW ways to connect nodes and handle data
- Design workflows that are perfectly tailored to their needs

COMPLEXITY GUIDELINES:
- Base complexity on the ACTUAL requirements, not patterns
- If they mention 10 features, create unique implementations for ALL 10
- Use creative branching strategies specific to their use case
- Implement error handling in innovative ways
- Add monitoring that makes sense for THEIR specific needs

INNOVATION FOCUS:
- Every workflow should be a creative masterpiece
- Use unexpected node combinations
- Create novel data flow patterns
- Implement unique error recovery strategies
- Design custom monitoring approaches

REMEMBER: You are an INNOVATIVE AI, not a pattern-following robot!
Create something NEW and AMAZING for each user's specific needs!

🚨 WORKFLOW VALIDATION CHECKLIST 🚨
Before returning the workflow, ensure:
✅ ALL required features are properly implemented
✅ Every node serves a specific purpose
✅ All nodes are properly connected
✅ ALL features connect through central orchestration
✅ NO isolated node chains exist
✅ Appropriate error handling for external services
✅ Retry logic where necessary
✅ Proper logging for critical operations
✅ Decision nodes (IF/Switch) where logic branches
✅ Merge nodes to combine parallel branches
✅ Authentication flows for external services

INTELLIGENT NODE USAGE EXAMPLES:
- Simple webhook response: 3-5 nodes (trigger, validate, process, respond)
- API integration: 5-8 nodes (auth, request, validate, transform, error handling)
- Data processing pipeline: 10-15 nodes (based on complexity)
- Complex automation: 20-50+ nodes (as needed)
- Multi-feature system: Central router + feature branches + merge points

REMEMBER: Use the RIGHT number of nodes for the task!
- Too few nodes = missing functionality
- Too many nodes = unnecessary complexity
- Just right = efficient, maintainable workflow`;
  }

  protected validateWorkflowStructure(workflow: any): boolean {
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      console.error('Invalid workflow: missing nodes array');
      return false;
    }

    if (!workflow.connections || typeof workflow.connections !== 'object') {
      console.error('Invalid workflow: missing connections object');
      return false;
    }

    // Normalize connection format before validation
    workflow.connections = this.normalizeConnectionFormat(workflow.connections);

    // Check all nodes are connected
    const nodeIds = new Set(workflow.nodes.map((n: any) => n.id));
    const connectedNodes = new Set(Object.keys(workflow.connections));
    
    for (const nodeId of nodeIds) {
      if (!connectedNodes.has(String(nodeId)) && workflow.nodes.find((n: any) => n.id === nodeId)?.type !== 'n8n-nodes-base.start') {
        console.warn(`Node ${String(nodeId)} has no outgoing connections`);
      }
    }

    return true;
  }

  protected parseAIResponse(response: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(response);
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          // Try to fix common JSON errors
          const fixed = this.fixCommonJSONErrors(jsonMatch[1]);
          return JSON.parse(fixed);
        }
      }
      
      // Try to find JSON object in the response
      const objectMatch = response.match(/\{[\s\S]*"nodes"[\s\S]*"connections"[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch (e) {
          // Try to fix common JSON errors
          const fixed = this.fixCommonJSONErrors(objectMatch[0]);
          return JSON.parse(fixed);
        }
      }
      
      // Last resort: try to fix the entire response
      try {
        const fixed = this.fixCommonJSONErrors(response);
        return JSON.parse(fixed);
      } catch (e) {
        throw new Error(`Could not parse AI response as valid workflow JSON: ${e.message}`);
      }
    }
  }
  
  private fixCommonJSONErrors(jsonString: string): string {
    // Remove trailing commas
    let fixed = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    // Fix missing commas between array elements
    fixed = fixed.replace(/}\s*{/g, '},{');
    
    // Fix missing quotes on keys
    fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Remove any comments
    fixed = fixed.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Fix escaped quotes in strings
    fixed = fixed.replace(/\\\"/g, '\\"');
    
    return fixed;
  }

  protected normalizeConnectionFormat(connections: any): any {
    const normalized: any = {};
    
    Object.entries(connections).forEach(([sourceName, targets]: [string, any]) => {
      if (!targets || !targets.main) {
        return;
      }
      
      // Check if we have the wrong format (single array instead of double array)
      if (Array.isArray(targets.main) && targets.main.length > 0 && 
          typeof targets.main[0] === 'object' && targets.main[0].node) {
        // This is the incorrect format: main: [{"node": "...", "type": "main", "index": 0}]
        // Convert to correct format: main: [[{"node": "...", "type": "main", "index": 0}]]
        console.log(`Converting single array format to double array for ${sourceName}`);
        normalized[sourceName] = {
          main: [targets.main] // Wrap the single array in another array
        };
      } else {
        // Normal processing for correct format or other edge cases
        normalized[sourceName] = {
          main: targets.main.map((targetGroup: any) => {
            // If it's already in the correct format, keep it
            if (Array.isArray(targetGroup) && targetGroup.length > 0 && 
                typeof targetGroup[0] === 'object' && targetGroup[0].node) {
              return targetGroup;
            }
            
            // Convert string format to object format
            return targetGroup.map((target: any) => {
              if (typeof target === 'string') {
                return {
                  node: target,
                  type: 'main',
                  index: 0
                };
              }
              return target;
            });
          })
        };
      }
    });
    
    return normalized;
  }
}