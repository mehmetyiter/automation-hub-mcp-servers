import { default as fetch } from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { DynamicCodeGenerator } from './code-generation/dynamic-code-generator';
import { CodeGenerationRequest } from './code-generation/types';

export interface WorkflowGenerationOptions {
  apiKey?: string;
  provider?: 'openai' | 'anthropic';
}

interface StageResult {
  stage: string;
  nodes: any[];
  connections: any;
  success: boolean;
  error?: string;
  start_node?: string;
  end_nodes?: string[];
}

export class AIWorkflowGenerator {
  private apiKey?: string;
  private provider: 'openai' | 'anthropic';
  private trainingData: any;
  private codeGenerator: DynamicCodeGenerator;

  constructor(options?: WorkflowGenerationOptions) {
    this.apiKey = options?.apiKey;
    this.provider = options?.provider || 'anthropic';
    this.codeGenerator = new DynamicCodeGenerator(this.provider);
    this.loadTrainingData();
  }

  private loadTrainingData() {
    try {
      const trainingDataPath = path.join(process.cwd(), 'training-data', 'n8n-workflow-patterns.json');
      
      if (fs.existsSync(trainingDataPath)) {
        this.trainingData = JSON.parse(fs.readFileSync(trainingDataPath, 'utf-8'));
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    }
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    console.log('=== AI Workflow Generation Started ===');
    console.log('Prompt:', prompt);
    console.log('Name:', name);
    console.log('Provider:', this.provider);
    console.log('API Key available:', !!this.apiKey);
    console.log('API Key length:', this.apiKey?.length || 0);
    
    if (!this.apiKey) {
      console.error('No API key provided');
      return {
        success: false,
        error: 'API key is required. Please ensure ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable is set.'
      };
    }
    
    console.log('Using AI generation...');
    const startTime = Date.now();
    
    try {
      const aiResult = await this.generateWithAI(prompt, name);
      const duration = Date.now() - startTime;
      console.log(`AI generation completed in ${duration}ms`);
      console.log('AI result:', { success: aiResult.success, method: aiResult.method, confidence: aiResult.confidence });
      
      return aiResult;
    } catch (error: any) {
      console.error('AI generation failed with error:', error);
      return {
        success: false,
        error: `AI generation failed: ${error.message}`
      };
    }
  }

  private async generateWithAI(prompt: string, name: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }
    
    // Check if this is a complex workflow that needs staged generation
    const isComplex = this.isComplexPrompt(prompt);
    
    if (isComplex) {
      console.log('Complex workflow detected - using staged generation');
      return this.generateInStages(prompt, name);
    }
    
    console.log('Simple workflow - using single generation');
    try {
      const result = this.provider === 'anthropic' 
        ? await this.generateWithClaude(prompt, name)
        : await this.generateWithOpenAI(prompt, name);
      
      console.log('Single generation result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error: any) {
      console.error('Single generation error:', error);
      throw error;
    }
  }
  
  private isComplexPrompt(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    let complexityScore = 0;
    
    // Multiple sections/phases (high complexity indicator)
    const sectionIndicators = [
      'trigger events', 'data collection', 'integrations', 'error handling',
      'expected outcomes', 'edge cases', 'phase 1', 'phase 2', 'branch',
      'parallel', 'stage', 'step 1', 'step 2', 'workflow:', 'main flow',
      'parallel flow', 'multiple branches', 'simultaneously', 'different flows'
    ];
    sectionIndicators.forEach(indicator => {
      if (lowerPrompt.includes(indicator)) complexityScore += 3;
    });
    
    // Multiple triggers (parallel branches)
    const triggers = ['webhook', 'cron', 'schedule', 'trigger', 'when'];
    let triggerCount = 0;
    triggers.forEach(trigger => {
      const matches = (lowerPrompt.match(new RegExp(trigger, 'g')) || []).length;
      triggerCount += matches;
    });
    if (triggerCount >= 3) complexityScore += 5;
    
    // Integration count (external systems)
    const integrations = [
      'database', 'api', 'email', 'sms', 'slack', 'calendar', 
      'webhook', 'mysql', 'postgresql', 'twilio', 'sendgrid',
      'stripe', 'paypal', 'aws', 'google', 'microsoft', 'azure'
    ];
    let integrationCount = 0;
    integrations.forEach(integration => {
      if (lowerPrompt.includes(integration)) integrationCount++;
    });
    if (integrationCount >= 4) complexityScore += 4;
    
    // Error handling complexity
    const errorHandling = [
      'error handling', 'retry', 'fallback', 'try', 'catch',
      'failure', 'timeout', 'validation', 'exception', 'rollback'
    ];
    errorHandling.forEach(error => {
      if (lowerPrompt.includes(error)) complexityScore += 2;
    });
    
    // Business logic complexity
    const businessLogic = [
      'approval', 'escalation', 'conditional', 'if', 'decision',
      'loop', 'iterate', 'batch', 'queue', 'priority', 'workflow',
      'orchestration', 'coordination', 'synchronization'
    ];
    businessLogic.forEach(logic => {
      if (lowerPrompt.includes(logic)) complexityScore += 2;
    });
    
    // Word count (longer prompts = more complex)
    const wordCount = prompt.split(' ').length;
    if (wordCount > 200) complexityScore += 3;
    if (wordCount > 400) complexityScore += 5;
    
    // Line count (structured prompts)
    const lineCount = prompt.split('\n').length;
    if (lineCount > 10) complexityScore += 3;
    if (lineCount > 20) complexityScore += 5;
    
    // Specific complexity indicators
    const complexityIndicators = [
      '20+ nodes', '30+ nodes', 'complex', 'advanced', 'enterprise',
      'production-ready', 'scalable', 'distributed', 'microservices'
    ];
    complexityIndicators.forEach(indicator => {
      if (lowerPrompt.includes(indicator)) complexityScore += 5;
    });
    
    console.log(`Complexity analysis: Score = ${complexityScore}, Word count = ${wordCount}, Line count = ${lineCount}`);
    
    // Threshold for complex workflow (15+ points)
    return complexityScore >= 15;
  }
  
  private async generateInStages(prompt: string, name: string): Promise<any> {
    console.log('=== Starting Staged Workflow Generation ===');
    
    try {
      // Stage 1: Analyze and plan the workflow structure
      console.log('Stage 1: Analyzing workflow structure...');
      const structure = await this.analyzeWorkflowStructure(prompt);
      
      if (!structure.success) {
        return structure;
      }
      
      console.log(`Identified ${structure.branches.length} branches`);
      
      // Stage 2: Generate each branch/flow separately
      console.log('Stage 2: Generating individual branches...');
      const branchResults: StageResult[] = [];
      
      for (const branch of structure.branches) {
        console.log(`Generating branch: ${branch.name}`);
        const branchResult = await this.generateBranch(branch, prompt);
        branchResults.push(branchResult);
      }
      
      // Stage 3: Combine all branches into final workflow
      console.log('Stage 3: Combining branches into final workflow...');
      const combined = this.combineBranches(structure, branchResults, name);
      
      return combined;
    } catch (error: any) {
      console.error('Staged generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async analyzeWorkflowStructure(prompt: string): Promise<any> {
    const analysisPrompt = `Analyze this workflow request and identify its structure:

${prompt}

Return a JSON object with:
{
  "main_trigger": {
    "description": "Main entry point description",
    "type": "webhook|schedule|manual"
  },
  "branches": [
    {
      "name": "Branch name",
      "description": "What this branch does",
      "trigger_condition": "When this branch activates",
      "is_parallel": true/false,
      "estimated_nodes": number
    }
  ],
  "merge_points": [
    {
      "name": "Merge point name",
      "merges_branches": ["branch1", "branch2"]
    }
  ],
  "final_actions": "Description of final steps"
}

Focus on identifying separate flows and branches, not implementation details.`;

    const result = await this.callAIAPI(analysisPrompt);
    
    return {
      success: true,
      ...result
    };
  }
  
  private async generateBranch(branch: any, originalPrompt: string): Promise<StageResult> {
    const nodePrefix = branch.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const branchPrompt = `Generate n8n workflow nodes for this specific branch:

Branch Name: ${branch.name}
Description: ${branch.description}
Trigger Condition: ${branch.trigger_condition}
Context from full workflow: ${originalPrompt}

CRITICAL CONNECTION REQUIREMENTS:
1. DEFAULT: Create LINEAR FLOW: node1 -> node2 -> node3 -> node4 -> node5
2. CROSS-CONNECTIONS: If workflow logic requires, connect nodes across branches or to merge points
3. ERROR HANDLING: Use error outputs (index 1) for error paths:
   "NodeName": {
     "main": [
       [{"node": "NextNode", "type": "main", "index": 0}],    // Success path (index 0)
       [{"node": "ErrorHandler", "type": "main", "index": 0}]  // Error path (index 1)
     ]
   }
4. LOOPS: Use SplitInBatches for processing arrays/lists
5. CONDITIONS: Use IF/Switch nodes for branching logic

CONNECTION EXAMPLES:
- Linear: A→B→C→D
- With Error: A→(success)→B, A→(error)→ErrorHandler
- Cross-branch: BranchA_Node3→FinalMerge, BranchB_Node5→FinalMerge
- Loop: GetItems→SplitInBatches→Process→[loop back to SplitInBatches]

BRANCH STRUCTURE:
- First node: Entry point (no incoming connections)
- Middle nodes: Connected based on workflow logic
- Error handlers: Connected via error outputs from critical nodes
- Cross-connections: When data needs to flow between branches

Generate a JSON with this EXACT structure:
{
  "nodes": [
    {
      "id": "${nodePrefix}_nodename",
      "name": "Human Readable Name",
      "type": "n8n-nodes-base.nodeType",
      "typeVersion": 1,
      "position": [x, y],
      "parameters": {}
    }
  ],
  "connections": {
    "Node Name 1": {
      "main": [[{"node": "Node Name 2", "type": "main", "index": 0}]]
    },
    "Node Name 2": {
      "main": [[{"node": "Node Name 3", "type": "main", "index": 0}]]
    }
  },
  "start_node": "Node Name 1",
  "end_nodes": ["Node Name N"]
}

VALIDATION CHECKLIST:
- [ ] Every node in "nodes" array appears in "connections" (as source or target)
- [ ] start_node is the first node with no incoming connections
- [ ] end_nodes are nodes with no outgoing connections
- [ ] All node names in connections match exactly with node names in nodes array
- [ ] No isolated nodes or broken chains

Important:
- Node IDs use prefix: ${nodePrefix}_
- Node names in connections must match the "name" field exactly
- Create linear or branching flows, but ensure full connectivity`;

    try {
      const result = await this.callAIAPI(branchPrompt);
      
      // Validate and fix the branch before returning
      const validatedBranch = this.validateBranchConnections(result, nodePrefix);
      
      return {
        stage: branch.name,
        nodes: validatedBranch.nodes || [],
        connections: validatedBranch.connections || {},
        success: true,
        start_node: validatedBranch.start_node,
        end_nodes: validatedBranch.end_nodes || []
      };
    } catch (error: any) {
      return {
        stage: branch.name,
        nodes: [],
        connections: {},
        success: false,
        error: error.message
      };
    }
  }
  
  private validateBranchConnections(branch: any, nodePrefix: string): any {
    console.log(`Validating branch connections for ${nodePrefix}`);
    
    const nodes = branch.nodes || [];
    let connections = this.normalizeConnectionFormat(branch.connections || {});
    
    // 1. Ensure all nodes have required parameters
    nodes.forEach((node: any) => {
      this.addMissingNodeParameters(node);
    });
    
    // 2. If we have nodes but no connections, create a linear flow
    if (nodes.length > 0 && Object.keys(connections).length === 0) {
      console.log(`Creating linear connections for ${nodes.length} nodes in ${nodePrefix}`);
      for (let i = 0; i < nodes.length - 1; i++) {
        connections[nodes[i].name] = {
          main: [[{
            node: nodes[i + 1].name,
            type: 'main',
            index: 0
          }]]
        };
      }
    }
    
    // Build a set of all connected nodes
    const connectedNodes = new Set<string>();
    const hasIncomingConnection = new Set<string>();
    const hasOutgoingConnection = new Set<string>();
    
    Object.entries(connections).forEach(([source, targets]: [string, any]) => {
      connectedNodes.add(source);
      hasOutgoingConnection.add(source);
      
      if (targets.main) {
        targets.main.forEach((targetGroup: any[]) => {
          targetGroup.forEach((target: any) => {
            connectedNodes.add(target.node);
            hasIncomingConnection.add(target.node);
          });
        });
      }
    });
    
    // Find truly disconnected nodes (not in connections at all)
    const disconnectedNodes = nodes.filter((node: any) => !connectedNodes.has(node.name));
    
    if (disconnectedNodes.length > 0) {
      console.log(`Found ${disconnectedNodes.length} disconnected nodes in branch ${nodePrefix}: ${disconnectedNodes.map((n: any) => n.name).join(', ')}`);
      
      // Sort disconnected nodes by their position to maintain logical flow
      disconnectedNodes.sort((a: any, b: any) => {
        const aPos = a.position[0] + a.position[1];
        const bPos = b.position[0] + b.position[1];
        return aPos - bPos;
      });
      
      // For each disconnected node, find the best connection point
      disconnectedNodes.forEach((node: any) => {
        const nodeName = node.name.toLowerCase();
        let connected = false;
        
        // Try to find a logical connection based on node type/name
        if (nodeName.includes('error') || nodeName.includes('exception')) {
          // Error handling nodes - connect to the last node in the branch
          const lastNode = nodes[nodes.length - 2]; // -2 because error node might be last
          if (lastNode && lastNode.name !== node.name) {
            if (!connections[lastNode.name]) {
              connections[lastNode.name] = { main: [[]] };
            }
            connections[lastNode.name].main[0].push({
              node: node.name,
              type: 'main',
              index: 0
            });
            connected = true;
          }
        } else if (nodeName.includes('final') || nodeName.includes('complete') || nodeName.includes('send')) {
          // Final nodes - find the last connected node
          const lastConnectedNode = Array.from(hasOutgoingConnection).pop();
          if (lastConnectedNode) {
            if (!connections[lastConnectedNode]) {
              connections[lastConnectedNode] = { main: [[]] };
            }
            connections[lastConnectedNode].main[0].push({
              node: node.name,
              type: 'main',
              index: 0
            });
            connected = true;
          }
        }
        
        // If no specific logic applied, connect to the nearest connected node
        if (!connected) {
          // Find the nearest connected node by position
          let nearestNode: any = null;
          let minDistance = Infinity;
          
          nodes.forEach((otherNode: any) => {
            if (otherNode.name !== node.name && connectedNodes.has(otherNode.name)) {
              const distance = Math.abs(node.position[0] - otherNode.position[0]) + 
                             Math.abs(node.position[1] - otherNode.position[1]);
              if (distance < minDistance && node.position[0] > otherNode.position[0]) {
                // Prefer nodes to the left (earlier in flow)
                minDistance = distance;
                nearestNode = otherNode;
              }
            }
          });
          
          if (nearestNode) {
            if (!connections[nearestNode.name]) {
              connections[nearestNode.name] = { main: [[]] };
            }
            connections[nearestNode.name].main[0].push({
              node: node.name,
              type: 'main',
              index: 0
            });
          }
        }
        
        // Update connected sets
        connectedNodes.add(node.name);
      });
    }
    
    // Determine start_node - should be a node with no incoming connections
    let start_node = branch.start_node;
    if (!start_node && nodes.length > 0) {
      // Find nodes with no incoming connections
      const potentialStarts = nodes.filter((node: any) => !hasIncomingConnection.has(node.name));
      if (potentialStarts.length > 0) {
        // Pick the leftmost node as start
        const leftmostNode = potentialStarts.reduce((leftmost: any, node: any) => 
          node.position[0] < leftmost.position[0] ? node : leftmost
        );
        start_node = leftmostNode.name;
      } else {
        // Fallback to first node
        start_node = nodes[0].name;
      }
    }
    
    // Determine end_nodes - nodes with no outgoing connections
    let end_nodes = branch.end_nodes || [];
    if (end_nodes.length === 0 && nodes.length > 0) {
      end_nodes = nodes
        .filter((node: any) => !hasOutgoingConnection.has(node.name))
        .map((node: any) => node.name);
      
      if (end_nodes.length === 0) {
        // Use the rightmost node as end
        const rightmostNode = nodes.reduce((rightmost: any, node: any) => 
          node.position[0] > rightmost.position[0] ? node : rightmost
        );
        end_nodes = [rightmostNode.name];
      }
    }
    
    console.log(`Branch ${nodePrefix} validation complete: start=${start_node}, ends=[${end_nodes.join(', ')}], total nodes=${nodes.length}`);
    
    return {
      nodes,
      connections,
      start_node,
      end_nodes
    };
  }
  
  private normalizeConnectionFormat(connections: any): any {
    const normalized: any = {};
    
    Object.entries(connections).forEach(([sourceName, targets]: [string, any]) => {
      if (!targets || !targets.main) {
        return;
      }
      
      normalized[sourceName] = {
        main: targets.main.map((targetGroup: any) => {
          // If it's already in the correct format, keep it
          if (targetGroup.length > 0 && typeof targetGroup[0] === 'object' && targetGroup[0].node) {
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
    });
    
    return normalized;
  }
  
  private combineBranches(structure: any, branches: StageResult[], name: string): any {
    const allNodes: any[] = [];
    const allConnections: any = {};
    
    // Create main trigger node
    const triggerNode = {
      id: 'main_trigger',
      name: 'Main Trigger',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [250, 500],
      parameters: {
        httpMethod: 'POST',
        path: 'workflow-trigger'
      }
    };
    allNodes.push(triggerNode);
    
    // Position branches with proper spacing
    let xOffset = 450;
    let yBase = 100;
    const branchSpacing = 400;
    
    // Add all branch nodes with adjusted positions
    branches.forEach((branch, branchIndex) => {
      const yOffset = yBase + (branchIndex * branchSpacing);
      
      branch.nodes.forEach((node, nodeIndex) => {
        const adjustedNode = {
          ...node,
          position: [xOffset + (nodeIndex * 200), yOffset]
        };
        allNodes.push(adjustedNode);
      });
      
      // Normalize and merge connections
      const normalizedBranchConnections = this.normalizeConnectionFormat(branch.connections);
      Object.keys(normalizedBranchConnections).forEach(key => {
        allConnections[key] = normalizedBranchConnections[key];
      });
    });
    
    // Connect main trigger to all branch start nodes
    const branchConnections = branches
      .filter(b => b.nodes.length > 0 && b.start_node)
      .map(b => ({
        node: b.start_node,
        type: 'main',
        index: 0
      }));
    
    if (branchConnections.length > 0) {
      allConnections['Main Trigger'] = {
        main: [branchConnections]
      };
    }
    
    // Log branch information for debugging
    branches.forEach(branch => {
      console.log(`Branch ${branch.stage}: start=${branch.start_node}, end=[${branch.end_nodes?.join(', ')}]`);
    });
    
    // Add merge nodes if needed
    if (structure.merge_points && structure.merge_points.length > 0) {
      structure.merge_points.forEach((mergePoint: any, index: number) => {
        const mergeNode = {
          id: `merge_${index}`,
          name: mergePoint.name || `Merge ${index + 1}`,
          type: 'n8n-nodes-base.merge',
          typeVersion: 3,
          position: [xOffset + 1000, 500 + (index * 200)],
          parameters: {
            mode: 'multiplex'
          }
        };
        allNodes.push(mergeNode);
      });
    }
    
    // Validate and fix connections
    const validatedConnections = this.validateAndFixConnections(allNodes, allConnections);
    
    const workflow = this.sanitizeWorkflowStructure({
      name,
      nodes: allNodes,
      connections: validatedConnections,
      settings: {
        executionOrder: 'v1'
      }
    });

    return {
      success: true,
      workflow: workflow,
      method: 'staged-ai-generation',
      confidence: 0.95
    };
  }
  
  private sanitizeWorkflowStructure(workflow: any): any {
    // Ensure workflow has the correct structure
    const sanitized = {
      name: workflow.name || 'Untitled Workflow',
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      settings: workflow.settings || { executionOrder: 'v1' }
    };

    // Check if any nodes have a "main" property and move it to connections
    sanitized.nodes = sanitized.nodes.map((node: any) => {
      if (node.main) {
        console.warn(`Node "${node.name}" has a "main" property - moving to connections object`);
        // Move the main property to connections
        if (!sanitized.connections[node.name]) {
          sanitized.connections[node.name] = {};
        }
        sanitized.connections[node.name].main = node.main;
        
        // Remove the main property from the node
        const { main, ...cleanNode } = node;
        return cleanNode;
      }
      return node;
    });

    return sanitized;
  }

  private validateAndFixConnections(nodes: any[], connections: any): any {
    const connectedNodes = new Set<string>();
    // First normalize all connections to ensure consistent format
    const fixedConnections = this.normalizeConnectionFormat(connections);
    
    // Track which nodes are connected
    Object.entries(connections).forEach(([source, targets]: [string, any]) => {
      connectedNodes.add(source);
      if (targets.main) {
        targets.main.forEach((targetGroup: any[]) => {
          targetGroup.forEach((target: any) => {
            connectedNodes.add(target.node);
          });
        });
      }
    });
    
    // Find disconnected nodes (except webhooks and final nodes)
    const disconnectedNodes = nodes.filter(node => {
      const isWebhook = node.type === 'n8n-nodes-base.webhook';
      const isTrigger = node.name.toLowerCase().includes('trigger');
      const isConnected = connectedNodes.has(node.name);
      
      // Webhooks/triggers shouldn't have incoming connections but should have outgoing
      if (isWebhook || isTrigger) {
        return !connections[node.name];
      }
      
      // Other nodes should be connected
      return !isConnected;
    });
    
    console.log(`Found ${disconnectedNodes.length} disconnected nodes`);
    
    // Fix disconnected nodes by connecting them logically
    disconnectedNodes.forEach(node => {
      const nodeName = node.name.toLowerCase();
      
      // Find the most logical previous node based on naming/position
      if (nodeName.includes('final') || nodeName.includes('merge')) {
        // Final merge nodes should receive connections from all branch endpoints
        const branchEndNodes = nodes.filter(n => {
          const nName = n.name.toLowerCase();
          // Find nodes that are likely endpoints of branches
          return (nName.includes('send') || nName.includes('complete') || 
                  nName.includes('finish') || nName.includes('create')) &&
                 !nName.includes('error') && n.id !== node.id;
        });
        
        if (branchEndNodes.length > 0) {
          // Connect all branch endpoints to the final merge
          branchEndNodes.forEach(endNode => {
            if (!fixedConnections[endNode.name]) {
              fixedConnections[endNode.name] = { main: [[]] };
            }
            fixedConnections[endNode.name].main[0].push({
              node: node.name,
              type: 'main',
              index: 0
            });
            console.log(`Connected ${endNode.name} -> ${node.name} (Final Merge)`);
          });
        }
      } else if (nodeName.includes('error') || nodeName.includes('handling')) {
        // Connect error handling nodes to their branch's last node
        const branchPrefix = node.id.split('_').slice(0, -2).join('_');
        const branchNodes = nodes.filter(n => n.id.startsWith(branchPrefix) && n.id !== node.id);
        if (branchNodes.length > 0) {
          const lastBranchNode = branchNodes[branchNodes.length - 1];
          if (!fixedConnections[lastBranchNode.name]) {
            fixedConnections[lastBranchNode.name] = { main: [[]] };
          }
          if (!fixedConnections[lastBranchNode.name].main) {
            fixedConnections[lastBranchNode.name].main = [[]];
          }
          if (!Array.isArray(fixedConnections[lastBranchNode.name].main[0])) {
            fixedConnections[lastBranchNode.name].main[0] = [];
          }
          fixedConnections[lastBranchNode.name].main[0].push({
            node: node.name,
            type: 'main',
            index: 0
          });
          console.log(`Connected ${lastBranchNode.name} -> ${node.name}`);
        }
      } else if (node.type === 'n8n-nodes-base.merge') {
        // Find nodes that should connect to this merge node
        const branchesToMerge = nodes.filter(n => {
          const nName = n.name.toLowerCase();
          return (nName.includes('final') || nName.includes('complete') || 
                  nName.includes('done')) && n.id !== node.id;
        });
        
        branchesToMerge.forEach(branchNode => {
          if (!fixedConnections[branchNode.name]) {
            fixedConnections[branchNode.name] = { main: [[]] };
          }
          if (!fixedConnections[branchNode.name].main) {
            fixedConnections[branchNode.name].main = [[]];
          }
          if (!Array.isArray(fixedConnections[branchNode.name].main[0])) {
            fixedConnections[branchNode.name].main[0] = [];
          }
          fixedConnections[branchNode.name].main[0].push({
            node: node.name,
            type: 'main',
            index: 0
          });
          console.log(`Connected ${branchNode.name} -> ${node.name}`);
        });
      }
    });
    
    return fixedConnections;
  }
  
  private addMissingNodeParameters(node: any): void {
    // Add missing parameters based on node type
    switch (node.type) {
      case 'n8n-nodes-base.set':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.mode) node.parameters.mode = 'manual';
        if (!node.parameters.values) node.parameters.values = { values: [] };
        break;
        
      case 'n8n-nodes-base.code':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.language) node.parameters.language = 'javaScript';
        
        // Check if node name suggests Python
        const nodeName = node.name?.toLowerCase() || '';
        if (nodeName.includes('python') || nodeName.includes('py')) {
          node.parameters.language = 'python';
        }
        
        // Generate code based on language
        if (node.parameters.language === 'python' && !node.parameters.pythonCode) {
          node.parameters.pythonCode = this.generateDynamicCodeForNode(node, 'python');
        } else if (!node.parameters.jsCode) {
          node.parameters.jsCode = this.generateDynamicCodeForNode(node, 'javascript');
        }
        break;
        
      case 'n8n-nodes-base.httpRequest':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.method) node.parameters.method = 'GET';
        if (!node.parameters.url) node.parameters.url = 'https://api.example.com';
        if (!node.parameters.options) node.parameters.options = {};
        break;
        
      case 'n8n-nodes-base.if':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.conditions) {
          node.parameters.conditions = {
            options: { version: 2 },
            conditions: [{
              leftValue: '={{ $json.field }}',
              rightValue: 'value',
              operator: { type: 'string', operation: 'equals' }
            }]
          };
        }
        break;
        
      case 'n8n-nodes-base.switch':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.rules) {
          node.parameters.rules = {
            rules: [{
              conditions: {
                conditions: [{
                  leftValue: '={{ $json.field }}',
                  rightValue: 'value',
                  operator: { type: 'string', operation: 'equals' }
                }]
              },
              output: 0
            }]
          };
        }
        break;
        
      case 'n8n-nodes-base.merge':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.mode) node.parameters.mode = 'combine';
        if (!node.parameters.combinationMode) node.parameters.combinationMode = 'mergeByPosition';
        break;
        
      case 'n8n-nodes-base.emailSend':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.fromEmail) node.parameters.fromEmail = 'noreply@example.com';
        if (!node.parameters.toEmail) node.parameters.toEmail = '={{ $json.email }}';
        if (!node.parameters.subject) node.parameters.subject = 'Notification';
        if (!node.parameters.text) node.parameters.text = 'Email content here';
        break;
        
      case 'n8n-nodes-base.webhook':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.path) node.parameters.path = 'webhook';
        if (!node.parameters.method) node.parameters.method = 'POST';
        if (!node.parameters.responseMode) node.parameters.responseMode = 'lastNode';
        break;
        
      case 'n8n-nodes-base.cron':
        if (!node.parameters) node.parameters = {};
        if (!node.parameters.cronTimes) {
          node.parameters.cronTimes = {
            item: [{ mode: 'everyMinute' }]
          };
        }
        break;
    }
  }
  
  private ensureMergeNodesHaveOutputs(workflow: any): void {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};
    
    // Find all merge nodes
    const mergeNodes = nodes.filter((node: any) => 
      node.type === 'n8n-nodes-base.merge' || 
      node.name.toLowerCase().includes('merge')
    );
    
    mergeNodes.forEach((mergeNode: any) => {
      // Check if merge node has output connections
      if (!connections[mergeNode.name] || 
          !connections[mergeNode.name].main || 
          connections[mergeNode.name].main[0].length === 0) {
        
        // Find a suitable node to connect after merge
        const completionNode = nodes.find((node: any) => 
          node.name.toLowerCase().includes('complete') ||
          node.name.toLowerCase().includes('final') ||
          node.name.toLowerCase().includes('log')
        );
        
        if (completionNode && completionNode.name !== mergeNode.name) {
          if (!connections[mergeNode.name]) {
            connections[mergeNode.name] = { main: [[]] };
          }
          connections[mergeNode.name].main[0] = [{
            node: completionNode.name,
            type: 'main',
            index: 0
          }];
          console.log(`Connected merge node ${mergeNode.name} to ${completionNode.name}`);
        }
      }
    });
  }
  
  private findOrphanedNodes(workflow: any): any[] {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};
    
    const connectedNodes = new Set<string>();
    
    // Add all nodes that appear in connections
    Object.entries(connections).forEach(([source, targets]: [string, any]) => {
      connectedNodes.add(source);
      if (targets.main) {
        targets.main.forEach((targetGroup: any[]) => {
          targetGroup.forEach((target: any) => {
            connectedNodes.add(target.node);
          });
        });
      }
    });
    
    // Find nodes not in connections
    return nodes.filter((node: any) => !connectedNodes.has(node.name));
  }
  
  private connectOrphanedNodes(workflow: any, orphanedNodes: any[]): void {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};
    
    orphanedNodes.forEach((orphan: any) => {
      // Find best connection point based on node position and type
      let connected = false;
      
      // Try to connect based on node type
      if (orphan.name.toLowerCase().includes('merge') || 
          orphan.name.toLowerCase().includes('final')) {
        // Connect merge/final nodes to end of branches
        const branchEndNodes = nodes.filter((n: any) => 
          n.name.toLowerCase().includes('complete') ||
          n.name.toLowerCase().includes('send') ||
          n.name.toLowerCase().includes('update')
        );
        
        branchEndNodes.forEach((endNode: any) => {
          if (!connections[endNode.name]) {
            connections[endNode.name] = { main: [[]] };
          }
          connections[endNode.name].main[0].push({
            node: orphan.name,
            type: 'main',
            index: 0
          });
          connected = true;
        });
      }
      
      if (!connected) {
        // Connect to nearest node by position
        const nearestNode = this.findNearestNode(orphan, nodes, connections);
        if (nearestNode) {
          if (!connections[nearestNode.name]) {
            connections[nearestNode.name] = { main: [[]] };
          }
          connections[nearestNode.name].main[0].push({
            node: orphan.name,
            type: 'main',
            index: 0
          });
        }
      }
    });
  }
  
  private findNearestNode(targetNode: any, allNodes: any[], connections: any): any {
    let nearestNode = null;
    let minDistance = Infinity;
    
    allNodes.forEach((node: any) => {
      if (node.name !== targetNode.name) {
        const distance = Math.sqrt(
          Math.pow(targetNode.position[0] - node.position[0], 2) +
          Math.pow(targetNode.position[1] - node.position[1], 2)
        );
        
        // Prefer nodes to the left (earlier in flow)
        if (distance < minDistance && node.position[0] < targetNode.position[0]) {
          minDistance = distance;
          nearestNode = node;
        }
      }
    });
    
    return nearestNode;
  }
  
  private addErrorHandlingConnections(workflow: any): void {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};
    
    // Find nodes that should have error handling
    const criticalNodes = nodes.filter((node: any) => 
      node.type === 'n8n-nodes-base.httpRequest' ||
      node.type === 'n8n-nodes-base.postgres' ||
      node.type === 'n8n-nodes-base.emailSend' ||
      node.type === 'n8n-nodes-base.twilioSms' ||
      node.name.toLowerCase().includes('api') ||
      node.name.toLowerCase().includes('database')
    );
    
    // Find or create error handler nodes
    const errorHandlers = nodes.filter((node: any) => 
      node.name.toLowerCase().includes('error') ||
      node.name.toLowerCase().includes('handler')
    );
    
    criticalNodes.forEach((node: any) => {
      const nodeConnections = connections[node.name];
      if (nodeConnections && nodeConnections.main && !nodeConnections.main[1]) {
        // Find appropriate error handler
        const errorHandler = errorHandlers.find((handler: any) => {
          // Try to match by branch prefix
          const nodePrefix = node.id.split('_')[0];
          return handler.id.startsWith(nodePrefix);
        }) || errorHandlers[0];
        
        if (errorHandler) {
          // Add error output connection
          if (!nodeConnections.main[1]) {
            nodeConnections.main[1] = [];
          }
          nodeConnections.main[1] = [{
            node: errorHandler.name,
            type: 'main',
            index: 0
          }];
          console.log(`Added error handling: ${node.name} -> ${errorHandler.name}`);
        }
      }
    });
  }
  
  private async callAIAPI(prompt: string): Promise<any> {
    if (this.provider === 'anthropic') {
      return this.callClaudeAPI(prompt);
    } else {
      return this.callOpenAIAPIForAnalysis(prompt);
    }
  }

  private async callOpenAIAPIForAnalysis(prompt: string): Promise<any> {
    const systemPrompt = this.getSystemPrompt();
    
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: 'json_object' }
    };
    
    console.log('Calling OpenAI API...');
    console.log('Model:', requestBody.model);
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('OpenAI response received');
      console.log('Tokens used:', data.usage);
      
      const content = data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error: any) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  private async callClaudeAPI(prompt: string): Promise<any> {
    const url = 'https://api.anthropic.com/v1/messages';
    
    const systemPrompt = this.getSystemPrompt();
    
    const requestBody = {
      model: 'claude-3-opus-20240229', // Using Claude 3 Opus - the most powerful model
      max_tokens: 8000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };
    
    console.log('Calling Claude API...');
    console.log('Model:', requestBody.model);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Claude API error:', error);
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      console.log('Claude response received');
      console.log('Usage:', data.usage);
      
      // Extract JSON from Claude's response
      const content = data.content[0].text;
      
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No valid JSON found in Claude response');
    } catch (error: any) {
      console.error('Claude API call failed:', error);
      throw error;
    }
  }
  
  private async generateWithClaude(prompt: string, name: string): Promise<any> {
    const workflowPrompt = `Create an n8n workflow for: ${prompt}

Workflow name: ${name}

Return a complete n8n workflow JSON with this EXACT structure:
{
  "name": "${name}",
  "nodes": [...],
  "connections": {
    "Node Name": {
      "main": [[{"node": "Target Node", "type": "main", "index": 0}]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}

CRITICAL: Nodes must NOT have a "main" property. All connections must be in the separate "connections" object.`;

    try {
      const result = await this.callClaudeAPI(workflowPrompt);
      
      const workflow = this.sanitizeWorkflowStructure(result.workflow || result);
      return {
        success: true,
        workflow: workflow,
        method: 'claude-ai-generated',
        confidence: 0.9
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async generateWithOpenAI(prompt: string, name: string): Promise<any> {
    // Keep existing OpenAI implementation
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = `Create an n8n workflow for: ${prompt}\n\nWorkflow name: ${name}`;
    
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: 'json_object' }
    };
    
    console.log('OpenAI request body:', {
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens
    });
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('OpenAI response received');
      console.log('Tokens used:', data.usage);
      
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      console.log('Parsed AI response structure:', Object.keys(parsed));
      console.log('Full parsed response:', JSON.stringify(parsed, null, 2));
      
      // The AI might return the workflow directly or wrapped in a workflow property
      const workflow = parsed.workflow || parsed;
      
      console.log('Extracted workflow object:', JSON.stringify(workflow, null, 2));
      
      const sanitizedWorkflow = this.sanitizeWorkflowStructure(workflow);
      return {
        success: true,
        workflow: sanitizedWorkflow,
        method: 'openai-generated',
        confidence: 0.9
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }
  
  private getSystemPrompt(): string {
    let additionalGuidelines = '';
    if (this.trainingData?.patterns) {
      additionalGuidelines = `\n\nIMPORTANT LEARNINGS FROM PAST WORKFLOWS:\n`;
      
      if (this.trainingData.patterns.general?.code_node_guidelines) {
        additionalGuidelines += `\nCode Node Guidelines:\n`;
        this.trainingData.patterns.general.code_node_guidelines.forEach((guideline: any) => {
          additionalGuidelines += `- ${guideline.rule}\n`;
        });
      }
    }

    return `You are an n8n workflow expert. Generate complete, production-ready n8n workflows.

CRITICAL WORKFLOW STRUCTURE:
The workflow MUST have this exact JSON structure:
{
  "name": "Workflow Name",
  "nodes": [
    {
      "id": "unique_id",
      "name": "Node Name",
      "type": "n8n-nodes-base.nodeType",
      "typeVersion": 1,
      "position": [x, y],
      "parameters": {}
    }
  ],
  "connections": {
    "Source Node Name": {
      "main": [[{"node": "Target Node Name", "type": "main", "index": 0}]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}

IMPORTANT: Nodes MUST NOT have a "main" property. Connections are defined separately in the "connections" object at the root level.

CRITICAL CONNECTION RULES:
1. EVERY node MUST be connected to at least one other node (defined in the connections object)
2. Only final nodes in a workflow can have no outgoing connections
3. All IF nodes must have BOTH true and false paths connected
4. Branch endings must connect to merge nodes or final processing nodes
5. ERROR HANDLING: Use dual outputs for success/error paths:
   - Index 0: Success path
   - Index 1: Error path
   Example in connections object: "NodeName": {"main": [[success_connections], [error_connections]]}
6. Webhook/trigger nodes should not have incoming connections (they are entry points)
7. Use consistent connection format in connections object: {"node": "NodeName", "type": "main", "index": 0}
8. NEVER put connections inside node definitions
9. CROSS-CONNECTIONS: Connect nodes across branches when workflow logic requires
10. LOOPS: Use SplitInBatches with connections back to itself for array processing

${additionalGuidelines}

IMPORTANT RULES:
1. Generate realistic workflows with proper node counts
2. Use actual n8n node types like:
   - n8n-nodes-base.webhook (typeVersion: 1.1)
   - n8n-nodes-base.httpRequest (typeVersion: 4.2)
   - n8n-nodes-base.code (typeVersion: 2)
   - n8n-nodes-base.postgres (typeVersion: 2.4)
   - n8n-nodes-base.set (typeVersion: 3.4)
   - n8n-nodes-base.if (typeVersion: 2)
   - n8n-nodes-base.switch (typeVersion: 3)
   - n8n-nodes-base.merge (typeVersion: 3)
   - n8n-nodes-base.splitInBatches (typeVersion: 3)
   - n8n-nodes-base.wait (typeVersion: 1.1)
   - n8n-nodes-base.emailSend (typeVersion: 2.1)
   - n8n-nodes-base.slack (typeVersion: 2.2)
   - n8n-nodes-base.discord (typeVersion: 2)
   - n8n-nodes-base.twilio (typeVersion: 1)

3. Each node must have:
   - Unique id (use snake_case)
   - Descriptive name (used in connections object)
   - Correct type and typeVersion
   - Position [x, y] coordinates
   - Proper parameters
   - NO "main" property (connections go in the separate connections object)

4. For parallel flows:
   - Connect one node to multiple nodes in same array
   - Use different Y positions for visual clarity

5. For conditional branching:
   - Use IF node for binary conditions
   - Use Switch node for multiple conditions

6. Always include error handling${additionalGuidelines}

Return ONLY valid JSON with the exact structure shown above.`;
  }

  private generateDynamicCodeForNode(node: any, language: string = 'javascript'): string {
    // Check if we have context about what this node should do
    const nodeName = node.name?.toLowerCase() || '';
    const nodeId = node.id || '';
    
    try {
      // Try to use AI-powered code generation first
      const request: CodeGenerationRequest = {
        description: this.extractCodePurposeFromNodeName(node.name),
        nodeType: 'code',
        workflowContext: {
          workflowPurpose: 'Dynamic workflow automation'
        },
        requirements: {
          language: language === 'python' ? 'python' : 'javascript'
        }
      };
      
      // Use synchronous code generation based on patterns
      const result = this.codeGenerator.generateCodeForNode('code', {
        nodeName: node.name,
        purpose: this.extractCodePurposeFromNodeName(node.name)
      });
      
      // Store code ID for future monitoring
      node.codeGenerationId = `node_${nodeId}_${Date.now()}`;
      
      return result;
    } catch (error) {
      console.log('AI code generation unavailable, using template-based approach');
      
      // Fallback to template-based generation
      if (nodeName.includes('calculate') || nodeName.includes('calc')) {
        return this.generateCalculationCode();
      } else if (nodeName.includes('transform') || nodeName.includes('format')) {
        return this.generateTransformationCode();
      } else if (nodeName.includes('validate') || nodeName.includes('check')) {
        return this.generateValidationCode();
      } else if (nodeName.includes('filter')) {
        return this.generateFilterCode();
      } else if (nodeName.includes('process') || nodeName.includes('handle')) {
        return this.generateProcessingCode();
      } else if (nodeName.includes('aggregate') || nodeName.includes('sum') || nodeName.includes('total')) {
        return this.generateAggregationCode();
      } else if (nodeName.includes('parse') || nodeName.includes('extract')) {
        return this.generateParsingCode();
      } else if (nodeName.includes('log') || nodeName.includes('debug')) {
        return this.generateLoggingCode();
      }
      
      // Default to a context-aware processing code
      return this.generateDefaultProcessingCode();
    }
  }

  private extractCodePurposeFromNodeName(nodeName: string): string {
    if (!nodeName) return 'Process data items';
    
    // Extract purpose from node name
    const lowerName = nodeName.toLowerCase();
    
    if (lowerName.includes('calculate')) return 'Calculate numeric values from input data';
    if (lowerName.includes('transform')) return 'Transform data structure to new format';
    if (lowerName.includes('validate')) return 'Validate data against business rules';
    if (lowerName.includes('filter')) return 'Filter items based on conditions';
    if (lowerName.includes('aggregate')) return 'Aggregate and summarize data';
    if (lowerName.includes('parse')) return 'Parse and extract data from text';
    if (lowerName.includes('format')) return 'Format data for output';
    
    return `Process data for ${nodeName}`;
  }

  private generateCalculationCode(): string {
    return `// Dynamic calculation logic
const inputItems = $input.all();
const processedItems = [];

for (const item of inputItems) {
  try {
    const data = item.json;
    
    // Perform calculations
    const calculatedValue = Object.keys(data)
      .filter(key => typeof data[key] === 'number')
      .reduce((sum, key) => sum + data[key], 0);
    
    processedItems.push({
      json: {
        ...data,
        calculated_total: calculatedValue,
        calculation_timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Calculation error:', error);
    processedItems.push({
      json: {
        ...item.json,
        error: error.message,
        calculation_failed: true
      }
    });
  }
}

return processedItems;`;
  }

  private generateTransformationCode(): string {
    return `// Dynamic data transformation
const inputItems = $input.all();
const transformedItems = [];

for (const item of inputItems) {
  try {
    const data = item.json;
    
    // Transform data structure
    const transformed = {
      id: data.id || data._id || generateId(),
      timestamp: new Date().toISOString(),
      // Map fields dynamically
      ...Object.entries(data).reduce((acc, [key, value]) => {
        // Transform field names to snake_case
        const transformedKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        acc[transformedKey] = value;
        return acc;
      }, {}),
      processed: true
    };
    
    transformedItems.push({ json: transformed });
  } catch (error) {
    console.error('Transformation error:', error);
    transformedItems.push({
      json: {
        ...item.json,
        transformation_error: error.message
      }
    });
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

return transformedItems;`;
  }

  private generateValidationCode(): string {
    return `// Dynamic validation logic
const inputItems = $input.all();
const validatedItems = [];

for (const item of inputItems) {
  try {
    const data = item.json;
    const errors = [];
    
    // Validate required fields
    const requiredFields = Object.keys(data).filter(key => 
      !data[key] && data[key] !== 0 && data[key] !== false
    );
    
    if (requiredFields.length > 0) {
      errors.push(\`Missing required fields: \${requiredFields.join(', ')}\`);
    }
    
    // Validate data types
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes('email') && value && !isValidEmail(value)) {
        errors.push(\`Invalid email format for \${key}\`);
      }
      if (key.includes('date') && value && !isValidDate(value)) {
        errors.push(\`Invalid date format for \${key}\`);
      }
      if (key.includes('phone') && value && !isValidPhone(value)) {
        errors.push(\`Invalid phone format for \${key}\`);
      }
    });
    
    validatedItems.push({
      json: {
        ...data,
        is_valid: errors.length === 0,
        validation_errors: errors,
        validated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    validatedItems.push({
      json: {
        ...item.json,
        is_valid: false,
        validation_error: error.message
      }
    });
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function isValidDate(date) {
  return !isNaN(Date.parse(String(date)));
}

function isValidPhone(phone) {
  return /^[\d\s\-\+\(\)]+$/.test(String(phone));
}

return validatedItems;`;
  }

  private generateFilterCode(): string {
    return `// Dynamic filtering logic
const inputItems = $input.all();
const filteredItems = [];

for (const item of inputItems) {
  try {
    const data = item.json;
    let shouldInclude = true;
    
    // Apply dynamic filters based on data properties
    // Filter out items with null or undefined values
    const hasValidData = Object.values(data).some(value => 
      value !== null && value !== undefined && value !== ''
    );
    
    // Filter based on common patterns
    if (data.status && ['inactive', 'deleted', 'cancelled'].includes(data.status.toLowerCase())) {
      shouldInclude = false;
    }
    
    if (data.active === false || data.enabled === false) {
      shouldInclude = false;
    }
    
    // Include only items that pass filters
    if (shouldInclude && hasValidData) {
      filteredItems.push({
        json: {
          ...data,
          filtered_at: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Filter error:', error);
    // Include items that cause errors with error flag
    filteredItems.push({
      json: {
        ...item.json,
        filter_error: error.message
      }
    });
  }
}

console.log(\`Filtered \${inputItems.length} items to \${filteredItems.length} items\`);
return filteredItems;`;
  }

  private generateProcessingCode(): string {
    return `// Dynamic data processing
const inputItems = $input.all();
const processedItems = [];

for (const item of inputItems) {
  try {
    const data = item.json;
    
    // Process data based on content
    const processed = {
      ...data,
      // Add processing metadata
      processed_at: new Date().toISOString(),
      processing_id: generateProcessingId(),
      
      // Normalize common fields
      normalized_name: data.name?.trim().toLowerCase(),
      normalized_email: data.email?.trim().toLowerCase(),
      
      // Extract additional insights
      data_quality_score: calculateDataQuality(data),
      field_count: Object.keys(data).length,
      has_required_fields: checkRequiredFields(data)
    };
    
    processedItems.push({ json: processed });
  } catch (error) {
    console.error('Processing error:', error);
    processedItems.push({
      json: {
        ...item.json,
        processing_error: error.message,
        processing_failed: true
      }
    });
  }
}

function generateProcessingId() {
  return 'proc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function calculateDataQuality(data) {
  const fields = Object.values(data);
  const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  return Math.round((filledFields / fields.length) * 100);
}

function checkRequiredFields(data) {
  // Check for common required fields
  const commonRequired = ['id', 'name', 'email', 'type'];
  return commonRequired.every(field => 
    data[field] !== null && data[field] !== undefined && data[field] !== ''
  );
}

return processedItems;`;
  }

  private generateAggregationCode(): string {
    return `// Dynamic aggregation logic
const inputItems = $input.all();

// Aggregate data
const aggregation = {
  total_items: inputItems.length,
  numeric_sums: {},
  counts_by_field: {},
  unique_values: {},
  date_range: { min: null, max: null }
};

// Process each item for aggregation
inputItems.forEach(item => {
  const data = item.json;
  
  Object.entries(data).forEach(([key, value]) => {
    // Sum numeric values
    if (typeof value === 'number') {
      aggregation.numeric_sums[key] = (aggregation.numeric_sums[key] || 0) + value;
    }
    
    // Count occurrences
    if (value !== null && value !== undefined) {
      const strValue = String(value);
      if (!aggregation.counts_by_field[key]) {
        aggregation.counts_by_field[key] = {};
      }
      aggregation.counts_by_field[key][strValue] = 
        (aggregation.counts_by_field[key][strValue] || 0) + 1;
      
      // Track unique values
      if (!aggregation.unique_values[key]) {
        aggregation.unique_values[key] = new Set();
      }
      aggregation.unique_values[key].add(strValue);
    }
    
    // Track date range
    if (key.includes('date') || key.includes('time')) {
      const dateValue = new Date(value);
      if (!isNaN(dateValue)) {
        if (!aggregation.date_range.min || dateValue < aggregation.date_range.min) {
          aggregation.date_range.min = dateValue;
        }
        if (!aggregation.date_range.max || dateValue > aggregation.date_range.max) {
          aggregation.date_range.max = dateValue;
        }
      }
    }
  });
});

// Convert sets to counts
Object.keys(aggregation.unique_values).forEach(key => {
  aggregation.unique_values[key] = aggregation.unique_values[key].size;
});

// Add averages for numeric fields
const averages = {};
Object.entries(aggregation.numeric_sums).forEach(([key, sum]) => {
  averages[key + '_avg'] = sum / inputItems.length;
});

return [{
  json: {
    aggregation_timestamp: new Date().toISOString(),
    ...aggregation,
    averages,
    summary: {
      total_records: inputItems.length,
      numeric_fields: Object.keys(aggregation.numeric_sums).length,
      unique_fields: Object.keys(aggregation.unique_values).length
    }
  }
}];`;
  }

  private generateParsingCode(): string {
    return `// Dynamic parsing logic
const inputItems = $input.all();
const parsedItems = [];

for (const item of inputItems) {
  try {
    const data = item.json;
    const parsed = {};
    
    Object.entries(data).forEach(([key, value]) => {
      // Parse JSON strings
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          parsed[key + '_parsed'] = JSON.parse(value);
        } catch (e) {
          parsed[key] = value;
        }
      }
      // Parse dates
      else if (typeof value === 'string' && !isNaN(Date.parse(value))) {
        const date = new Date(value);
        parsed[key + '_date'] = date.toISOString();
        parsed[key + '_timestamp'] = date.getTime();
      }
      // Parse numbers from strings
      else if (typeof value === 'string' && !isNaN(Number(value))) {
        parsed[key + '_number'] = Number(value);
        parsed[key + '_original'] = value;
      }
      // Extract URLs
      else if (typeof value === 'string' && value.match(/https?:\/\/[^\s]+/)) {
        const urls = value.match(/https?:\/\/[^\s]+/g);
        parsed[key + '_urls'] = urls;
        parsed[key] = value;
      }
      // Extract emails
      else if (typeof value === 'string' && value.includes('@')) {
        const emails = value.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g);
        if (emails) {
          parsed[key + '_emails'] = emails;
        }
        parsed[key] = value;
      }
      else {
        parsed[key] = value;
      }
    });
    
    parsedItems.push({
      json: {
        original: data,
        parsed: parsed,
        parsed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Parsing error:', error);
    parsedItems.push({
      json: {
        ...item.json,
        parsing_error: error.message
      }
    });
  }
}

return parsedItems;`;
  }

  private generateLoggingCode(): string {
    return `// Dynamic logging and debugging
const inputItems = $input.all();
const timestamp = new Date().toISOString();

console.log('=== Workflow Execution Log ===');
console.log('Timestamp:', timestamp);
console.log('Total items:', inputItems.length);

// Log data structure of first item
if (inputItems.length > 0) {
  console.log('First item structure:', Object.keys(inputItems[0].json));
  console.log('First item data:', JSON.stringify(inputItems[0].json, null, 2));
}

// Analyze and log data patterns
const fieldAnalysis = {};
const valueTypes = {};

inputItems.forEach((item, index) => {
  const data = item.json;
  
  Object.entries(data).forEach(([key, value]) => {
    // Track field occurrences
    fieldAnalysis[key] = (fieldAnalysis[key] || 0) + 1;
    
    // Track value types
    const valueType = value === null ? 'null' : typeof value;
    if (!valueTypes[key]) valueTypes[key] = {};
    valueTypes[key][valueType] = (valueTypes[key][valueType] || 0) + 1;
  });
  
  // Log any errors or anomalies
  if (data.error || data.exception) {
    console.error(\`Error in item \${index}:\`, data.error || data.exception);
  }
});

console.log('Field occurrence analysis:', fieldAnalysis);
console.log('Value type analysis:', valueTypes);

// Return items with debug metadata
return inputItems.map((item, index) => ({
  json: {
    ...item.json,
    _debug: {
      index,
      timestamp,
      item_size: JSON.stringify(item.json).length,
      field_count: Object.keys(item.json).length,
      has_errors: !!(item.json.error || item.json.exception)
    }
  }
}));`;
  }

  private generateDefaultProcessingCode(): string {
    return `// AI-Generated dynamic processing code
const inputItems = $input.all();

// Validate input
if (!inputItems || inputItems.length === 0) {
  console.log('No input items received');
  return [];
}

const processedItems = [];

// Process each item
for (const item of inputItems) {
  try {
    const data = item.json;
    
    // Dynamic processing based on data structure
    const result = {
      ...data,
      // Add processing metadata
      processed: true,
      processed_at: new Date().toISOString(),
      processing_version: '1.0',
      
      // Preserve original data
      _original: JSON.parse(JSON.stringify(data))
    };
    
    // Add to results
    processedItems.push({ json: result });
    
  } catch (error) {
    console.error('Processing error for item:', item.json, error);
    
    // Return item with error information
    processedItems.push({
      json: {
        ...item.json,
        processing_error: error.message,
        processing_failed: true,
        failed_at: new Date().toISOString()
      }
    });
  }
}

console.log(\`Processed \${processedItems.length} of \${inputItems.length} items\`);
return processedItems;`;
  }
}