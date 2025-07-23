import { AIProvider, AIProviderConfig, AIProviderInterface } from '../types/ai-provider.js';
import * as fs from 'fs';
import * as path from 'path';
import { WorkflowGenerationGuidelines } from '../workflow-generation/workflow-generation-guidelines.js';

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

  abstract generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any>;
  abstract testConnection(): Promise<boolean>;
  abstract getModels(): Promise<string[]>;

  protected buildSystemPrompt(learningContext?: any): string {
    // Get workflow generation guidelines
    const enhancedGuidelines = WorkflowGenerationGuidelines.generatePromptEnhancement();
    
    const universalPrinciples = this.trainingData?.universal_workflow_principles || {};
    
    // Add learning insights if available
    let learningInsights = '';
    if (learningContext) {
      if (learningContext.avoidErrors?.length > 0) {
        learningInsights += '\n\n🚨 AVOID THESE COMMON ERRORS (from learning system):\n';
        learningContext.avoidErrors.forEach((error: string, index: number) => {
          learningInsights += `${index + 1}. ${error}\n`;
        });
      }
      
      if (learningContext.bestPractices?.length > 0) {
        learningInsights += '\n\n✅ APPLY THESE BEST PRACTICES (from successful workflows):\n';
        learningContext.bestPractices.forEach((practice: string, index: number) => {
          learningInsights += `${index + 1}. ${practice}\n`;
        });
      }
      
      if (learningContext.commonPatterns?.length > 0) {
        learningInsights += '\n\n🎯 SUCCESSFUL PATTERNS TO CONSIDER:\n';
        learningContext.commonPatterns.forEach((pattern: any) => {
          learningInsights += `- ${pattern.type}: ${(pattern.successRate * 100).toFixed(0)}% success rate\n`;
        });
      }
    }
    
    return `🎯 INTELLIGENT WORKFLOW GENERATION SYSTEM 🎯
    
CREATE WORKFLOWS THAT PRECISELY MATCH THE REQUIREMENTS - NO MORE, NO LESS!

${enhancedGuidelines}
${learningInsights}

CORE PRINCIPLES:
- Use EXACTLY the nodes needed for the task
- Every node must serve a specific purpose
- All nodes must be properly connected
- Quality over quantity - focus on functionality

You are an expert n8n workflow architect specializing in creating MASSIVE, COMPLEX, production-ready automation workflows.

${JSON.stringify(universalPrinciples, null, 2)}

🚨 CRITICAL: SINGLE WORKFLOW ONLY 🚨
- Generate ONLY ONE workflow for the requested task
- Do NOT include multiple unrelated workflows in your response
- Do NOT add employee onboarding or other example workflows
- Focus ONLY on the specific workflow requested by the user
- If you see system warnings about missing nodes, ignore them - they're not part of the main workflow

🎯 IMPLEMENTATION REQUIREMENT 🎯
When you see a detailed plan with specific features listed:
- You MUST implement ALL features mentioned in the plan
- Each feature in the plan MUST have corresponding nodes in the workflow
- Do NOT skip features even if they seem optional
- If a feature requires multiple nodes, include all of them
- Connect all features into one cohesive workflow

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

MANDATORY ERROR HANDLING:
When the workflow involves critical operations, external APIs, or complex processing, ALWAYS include:
1. Error Trigger node (n8n-nodes-base.errorTrigger) to catch workflow errors
2. Email Send or other notification node to alert administrators
3. Connect Error Trigger to notification node for error alerts

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
6. No orphaned nodes - every node must be connected
7. IF nodes must have BOTH true AND false outputs connected
8. Switch nodes must have ALL outputs connected or use fallbackOutput
9. Merge nodes must receive inputs from ALL expected branches

SWITCH NODE RULES:
1. Each condition MUST have a unique output number
2. NEVER assign the same output number to multiple conditions
3. Output numbers should be sequential: 0, 1, 2, 3...
4. Always set fallbackOutput to handle unmatched cases
5. Example:
   rules: [
     { value2: "action1", output: 0 },
     { value2: "action2", output: 1 },
     { value2: "action3", output: 2 }
   ],
   fallbackOutput: 3

MERGE NODE CONNECTIONS:
1. ALL feature branches MUST connect to the central Merge node
2. The last node of each branch must have a connection to "Merge All Features"
3. This ensures all parallel processes complete before final processing
4. Use descriptive names like "Merge All Features" or "Combine Results"

WORKFLOW COMPLETENESS RULES:
1. Every workflow MUST have at least one trigger node
2. All branches from Switch nodes MUST eventually converge to a Merge node
3. Error handling path MUST be connected to all critical operations
4. Final processing nodes MUST run AFTER all branches complete

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
    console.log('Parsing AI response...');
    
    try {
      // Clean the response first to remove any control characters
      const cleanedResponse = this.cleanResponseForJSON(response);
      
      // Try to parse as JSON first
      const parsedWorkflow = JSON.parse(cleanedResponse);
      console.log('Direct JSON parsing successful, preserving all AI details...');
      
      // Save original AI response for comparison
      console.log('AI Response node count:', parsedWorkflow.nodes?.length || 0);
      console.log('AI Response connections count:', Object.keys(parsedWorkflow.connections || {}).length);
      
      return parsedWorkflow;
    } catch (error) {
      console.log('Direct JSON parsing failed, trying extraction methods...');
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          const cleaned = this.cleanResponseForJSON(jsonMatch[1]);
          return JSON.parse(cleaned);
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
          const cleaned = this.cleanResponseForJSON(objectMatch[0]);
          return JSON.parse(cleaned);
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
        console.error('JSON parsing failed completely:', e.message);
        console.error('Response preview (first 500 chars):', response.substring(0, 500));
        throw new Error(`Could not parse AI response as valid workflow JSON: ${e.message}`);
      }
    }
  }
  
  private cleanResponseForJSON(response: string): string {
    // Remove control characters that cause JSON parsing issues
    let cleaned = response.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Remove any BOM characters
    cleaned = cleaned.replace(/^\uFEFF/, '');
    
    // Normalize line endings
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return cleaned;
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
    
    // Remove control characters that cause JSON parsing issues
    fixed = fixed.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Fix newlines in strings to be proper JSON escaped newlines
    fixed = fixed.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    
    // Clean up multiple spaces
    fixed = fixed.replace(/\s+/g, ' ');
    
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

  // New method: Optimize Switch Node outputs
  protected optimizeSwitchNodeOutputs(switchNode: any): void {
    if (switchNode.type === 'n8n-nodes-base.switch' && switchNode.parameters?.rules?.rules) {
      const rules = switchNode.parameters.rules.rules;
      
      // Assign sequential outputs to each rule
      rules.forEach((rule: any, index: number) => {
        rule.output = index;
      });
      
      // Set fallback output
      if (switchNode.parameters.fallbackOutput === undefined) {
        switchNode.parameters.fallbackOutput = rules.length;
      }
      
      console.log(`Optimized Switch node "${switchNode.name}" with ${rules.length} rules and fallback output ${switchNode.parameters.fallbackOutput}`);
    }
  }

  // New method: Find branch end nodes
  private findBranchEndNodes(workflow: any): any[] {
    const endNodes: any[] = [];
    const mergeNodeNames = workflow.nodes
      .filter((n: any) => n.type === 'n8n-nodes-base.merge')
      .map((n: any) => n.name);
    
    workflow.nodes.forEach((node: any) => {
      const nodeName = node.name;
      const hasOutgoingConnection = workflow.connections[nodeName]?.main?.[0]?.length > 0;
      
      // Find nodes that don't have outgoing connections or don't go to merge nodes
      if (!hasOutgoingConnection || 
          (hasOutgoingConnection && !mergeNodeNames.includes(workflow.connections[nodeName].main[0][0].node))) {
        // Check if this is the end of a branch
        if (this.isEndOfBranch(workflow, node)) {
          endNodes.push(node);
        }
      }
    });
    
    return endNodes;
  }

  // New method: Check if a node is at the end of a branch
  private isEndOfBranch(workflow: any, node: any): boolean {
    const nodeName = node.name;
    
    // Skip trigger nodes - they should not be connected to merge
    if (node.type === 'n8n-nodes-base.webhook' || 
        node.type === 'n8n-nodes-base.cron' ||
        node.type === 'n8n-nodes-base.errorTrigger') {
      return false;
    }
    
    // Skip router nodes (switch, if) - they route, not end branches
    if (node.type === 'n8n-nodes-base.switch' || 
        node.type === 'n8n-nodes-base.if') {
      return false;
    }
    
    // Get outgoing connections
    const outgoingConnections = workflow.connections[nodeName]?.main?.[0] || [];
    
    // If no connections, it's an end node
    if (outgoingConnections.length === 0) {
      return true;
    }
    
    // Check if only connects to Merge or Error nodes
    const targetNodes = outgoingConnections.map((conn: any) => 
      workflow.nodes.find((n: any) => n.name === conn.node)
    );
    
    const allTargetsAreMergeOrError = targetNodes.every((target: any) => 
      target && (
        target.type === 'n8n-nodes-base.merge' ||
        target.type === 'n8n-nodes-base.errorTrigger'
      )
    );
    
    return !allTargetsAreMergeOrError;
  }

  // New method: Ensure ONLY data aggregation branches connect to merge node
  protected ensureMergeNodeConnections(workflow: any): void {
    const mergeNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.merge'
    );
    
    if (mergeNodes.length === 0) return;
    
    // Find the main merge node
    const mainMergeNode = mergeNodes.find((n: any) => 
      n.name.toLowerCase().includes('all') || 
      n.name.toLowerCase().includes('main') ||
      n.name.toLowerCase().includes('features')
    ) || mergeNodes[0];
    
    if (!mainMergeNode) return;
    
    console.log(`Checking connections to merge node "${mainMergeNode.name}"`);
    
    // IMPORTANT: Only connect nodes that produce data to be aggregated
    // According to guidelines: "Use merge nodes ONLY when data aggregation is needed"
    const dataProducingNodes = workflow.nodes.filter((n: any) => {
      const nameLower = n.name.toLowerCase();
      const typeLower = n.type.toLowerCase();
      
      // Only these types of nodes should connect to merge:
      // 1. Nodes that fetch/collect data for aggregation
      const isDataCollector = nameLower.includes('fetch') && nameLower.includes('data') ||
                            nameLower.includes('get') && nameLower.includes('data') ||
                            nameLower.includes('collect') || 
                            nameLower.includes('query') ||
                            nameLower.includes('extract');
      
      // 2. Nodes that generate reports/summaries to be combined
      const isReportGenerator = nameLower.includes('generate') && nameLower.includes('report') ||
                              nameLower.includes('calculate') && nameLower.includes('metrics') ||
                              nameLower.includes('analyze') && nameLower.includes('data');
      
      // 3. NOT notification/action nodes
      const isNotificationOrAction = nameLower.includes('send') || 
                                   nameLower.includes('notify') || 
                                   nameLower.includes('alert') ||
                                   nameLower.includes('email') ||
                                   nameLower.includes('sms') ||
                                   nameLower.includes('whatsapp') ||
                                   nameLower.includes('save') ||
                                   nameLower.includes('store') ||
                                   nameLower.includes('update');
      
      return (isDataCollector || isReportGenerator) && !isNotificationOrAction;
    });
    
    // Only connect data-producing nodes to merge
    dataProducingNodes.forEach((node: any) => {
      const hasConnectionToMerge = workflow.connections[node.name]?.main?.[0]?.some(
        (conn: any) => conn.node === mainMergeNode.name
      );
      
      if (!hasConnectionToMerge && node.name !== mainMergeNode.name) {
        this.addConnection(workflow, node.name, mainMergeNode.name);
        console.log(`Connected data node "${node.name}" to merge node "${mainMergeNode.name}" for aggregation`);
      }
    });
    
    // Warn if merge node has no appropriate connections
    const incomingConnections = Object.entries(workflow.connections).filter(([source, conns]: [string, any]) => 
      conns.main?.[0]?.some((conn: any) => conn.node === mainMergeNode.name)
    ).length;
    
    if (incomingConnections === 0) {
      console.log(`WARNING: Merge node "${mainMergeNode.name}" has no data sources - consider removing it`);
    }
  }

  // New method: Add a connection between nodes
  private addConnection(workflow: any, sourceNodeName: string, targetNodeName: string): void {
    if (!workflow.connections[sourceNodeName]) {
      workflow.connections[sourceNodeName] = { main: [[]] };
    }
    
    workflow.connections[sourceNodeName].main[0].push({
      node: targetNodeName,
      type: 'main',
      index: 0
    });
  }

  // New method: Validate all connections
  protected validateAllConnections(workflow: any): void {
    const nodeNames = new Set(workflow.nodes.map((n: any) => n.name));
    
    // Check all connections
    Object.entries(workflow.connections).forEach(([sourceName, connections]: [string, any]) => {
      if (!nodeNames.has(sourceName)) {
        console.log(`Removing orphan connection from non-existent node "${sourceName}"`);
        delete workflow.connections[sourceName];
        return;
      }
      
      // Check each connection target
      if (connections.main) {
        connections.main.forEach((outputs: any[], outputIndex: number) => {
          const validConnections = outputs.filter((conn: any) => {
            if (!nodeNames.has(conn.node)) {
              console.log(`Removing invalid connection from "${sourceName}" to non-existent node "${conn.node}"`);
              return false;
            }
            return true;
          });
          connections.main[outputIndex] = validConnections;
        });
      }
    });
  }

  // New method: Mark utility nodes
  protected markUtilityNodes(workflow: any): void {
    workflow.nodes.forEach((node: any) => {
      const lowerName = node.name.toLowerCase();
      if (lowerName.includes('rate limit') ||
          lowerName.includes('transformer') ||
          lowerName.includes('utility') ||
          lowerName.includes('helper')) {
        node.metadata = node.metadata || {};
        node.metadata.isUtility = true;
        node.metadata.description = 'Utility node - connect manually when needed';
        console.log(`Marked "${node.name}" as utility node`);
      }
    });
  }

  // New method: Post-process workflow (public wrapper)
  public applyPostProcessing(workflow: any): any {
    return this.postProcessWorkflow(workflow);
  }

  // New method: Post-process workflow
  protected postProcessWorkflow(workflow: any): any {
    console.log('Post-processing workflow...');
    
    // 1. Optimize Switch nodes
    workflow.nodes
      .filter((n: any) => n.type === 'n8n-nodes-base.switch')
      .forEach((n: any) => this.optimizeSwitchNodeOutputs(n));
    
    // 2. Ensure Merge node connections
    this.ensureMergeNodeConnections(workflow);
    
    // 3. Validate all connections
    this.validateAllConnections(workflow);
    
    // 4. Mark utility nodes
    this.markUtilityNodes(workflow);
    
    console.log('Post-processing completed');
    return workflow;
  }
}