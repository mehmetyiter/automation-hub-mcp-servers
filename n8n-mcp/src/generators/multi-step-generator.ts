import { N8nKnowledgeBase, ExpansionRule } from '../knowledge/n8n-capabilities.js';
import { AIProviderInterface } from '../types/ai-provider.js';

export interface WorkflowSection {
  name: string;
  nodes: any[];
  connections: any;
  startNodeId: string;
  endNodeIds: string[];
}

export interface GenerationPlan {
  totalNodes: number;
  sections: {
    name: string;
    description: string;
    estimatedNodes: number;
    dependencies: string[];
  }[];
}

export class MultiStepWorkflowGenerator {
  private knowledgeBase: N8nKnowledgeBase;
  private provider: AIProviderInterface;
  private nodeIdCounter: number = 1;
  private learningContext?: any;
  private progressCallback?: (message: string) => void;
  
  constructor(provider: AIProviderInterface, learningContext?: any, progressCallback?: (message: string) => void) {
    this.provider = provider;
    this.knowledgeBase = new N8nKnowledgeBase();
    this.learningContext = learningContext;
    this.progressCallback = progressCallback;
  }
  
  async generateWorkflow(prompt: string, name: string): Promise<any> {
    console.log('Starting multi-step workflow generation...');
    this.progressCallback?.('Starting multi-step workflow generation...');
    
    if (this.learningContext) {
      console.log('Using learning context with insights from previous workflows');
      this.progressCallback?.('Analyzing similar workflows from learning database...');
    }
    
    // Step 1: Analyze requirements and create generation plan
    this.progressCallback?.('Creating workflow generation plan...');
    const plan = await this.createGenerationPlan(prompt);
    console.log('Generation plan created:', plan);
    this.progressCallback?.(`Planning ${plan.totalNodes} nodes across ${plan.sections.length} sections`);
    
    // Step 2: Generate core workflow structure
    this.progressCallback?.('Generating core workflow structure...');
    const coreSection = await this.generateCoreSection(prompt, name, plan);
    console.log(`Core section generated with ${coreSection.nodes.length} nodes`);
    this.progressCallback?.(`Core section completed with ${coreSection.nodes.length} nodes`);
    
    // Step 3: Generate each expansion section
    const sections: WorkflowSection[] = [coreSection];
    for (const sectionPlan of plan.sections) {
      this.progressCallback?.(`Generating ${sectionPlan.name} section...`);
      const section = await this.generateSection(sectionPlan, prompt, sections);
      sections.push(section);
      console.log(`Generated ${sectionPlan.name} with ${section.nodes.length} nodes`);
      this.progressCallback?.(`${sectionPlan.name} section completed with ${section.nodes.length} nodes`);
    }
    
    // Step 4: Merge all sections into final workflow
    this.progressCallback?.('Merging all sections into final workflow...');
    const finalWorkflow = this.mergeSections(sections, name);
    console.log(`Final workflow has ${finalWorkflow.nodes.length} nodes`);
    this.progressCallback?.(`Workflow assembled with ${finalWorkflow.nodes.length} total nodes`);
    
    // Step 5: Validate and fix connections
    this.progressCallback?.('Validating and optimizing node connections...');
    this.validateAndFixConnections(finalWorkflow);
    this.progressCallback?.('Workflow generation completed successfully!');
    
    return finalWorkflow;
  }
  
  private async createGenerationPlan(prompt: string): Promise<GenerationPlan> {
    const features = this.extractFeatures(prompt);
    const recommendedNodes = this.knowledgeBase.calculateRecommendedNodes(features);
    
    const planPrompt = `Analyze this workflow request and create a generation plan.

Request: ${prompt}

You MUST respond with ONLY a valid JSON object (no markdown, no explanations, no text before or after).
The JSON must follow this exact structure:

{
  "totalNodes": 50,
  "sections": [
    {
      "name": "Core Workflow",
      "description": "Main workflow structure with triggers and basic flow",
      "estimatedNodes": 10,
      "dependencies": []
    },
    {
      "name": "Input Validation",
      "description": "Input validation and sanitization",
      "estimatedNodes": 8,
      "dependencies": ["Core Workflow"]
    },
    {
      "name": "Data Processing",
      "description": "Main data processing and transformation logic",
      "estimatedNodes": 15,
      "dependencies": ["Input Validation"]
    },
    {
      "name": "External Integrations",
      "description": "API calls and external service integrations",
      "estimatedNodes": 12,
      "dependencies": ["Data Processing"]
    },
    {
      "name": "Error Handling",
      "description": "Error handling and recovery",
      "estimatedNodes": 5,
      "dependencies": ["Core Workflow"]
    }
  ]
}

Replace the numbers with appropriate estimates based on the complexity of the requested workflow.
DO NOT include any text before or after the JSON object.`;
    
    const response = await this.provider.generateWorkflow(planPrompt, 'plan');
    
    // Check if the provider returned an error
    if (!response.success) {
      console.error('Provider returned an error:', response.error);
      // Throw the error to prevent continuing with invalid workflow
      throw new Error(`Failed to generate plan: ${response.error || 'Unknown error'}`);
    }
    
    // Extract plan from response
    if (response.workflow) {
      try {
        let planData: GenerationPlan;
        
        // If the workflow is already a valid plan object
        if (response.workflow.totalNodes && response.workflow.sections) {
          planData = response.workflow;
        }
        // If it's a string, try to parse it
        else if (typeof response.workflow === 'string') {
          planData = JSON.parse(response.workflow);
        }
        // If it has a description field, try to extract JSON from it
        else if (response.workflow.description) {
          const jsonMatch = response.workflow.description.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            planData = JSON.parse(jsonMatch[0]);
          } else {
            planData = JSON.parse(response.workflow.description);
          }
        }
        // If it has nodes array, extract from the first node's parameters
        else if (response.workflow.nodes && response.workflow.nodes.length > 0) {
          const firstNode = response.workflow.nodes[0];
          if (firstNode.parameters?.functionCode) {
            const jsonMatch = firstNode.parameters.functionCode.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              planData = JSON.parse(jsonMatch[0]);
            }
          }
        }
        
        // Validate the plan structure
        if (planData && planData.totalNodes && Array.isArray(planData.sections)) {
          return planData;
        }
        
        // Default plan if parsing fails
        console.warn('Could not extract valid plan from response, using default');
        return this.createDefaultPlan(features);
      } catch (error) {
        console.error('Failed to parse plan, using default:', error);
        return this.createDefaultPlan(features);
      }
    }
    
    return this.createDefaultPlan(features);
  }
  
  private createDefaultPlan(features: string[]): GenerationPlan {
    const baseNodes = 5;
    const nodesPerFeature = 5;
    const estimatedTotal = baseNodes + (features.length * nodesPerFeature);
    
    const sections = [];
    
    // Always include core workflow
    sections.push({
      name: "Core Workflow",
      description: "Main workflow structure with triggers and basic flow",
      estimatedNodes: Math.min(10, Math.floor(estimatedTotal * 0.3)),
      dependencies: []
    });
    
    // Add validation if features suggest it
    if (features.some(f => f.includes('validation') || f.includes('api'))) {
      sections.push({
        name: "Input Validation",
        description: "Input validation and sanitization",
        estimatedNodes: Math.min(8, Math.floor(estimatedTotal * 0.2)),
        dependencies: ["Core Workflow"]
      });
    }
    
    // Main processing is always needed
    sections.push({
      name: "Data Processing",
      description: "Main data processing and transformation logic",
      estimatedNodes: Math.floor(estimatedTotal * 0.3),
      dependencies: sections.some(s => s.name === "Input Validation") ? ["Input Validation"] : ["Core Workflow"]
    });
    
    // Add integrations if needed
    if (features.some(f => f.includes('api') || f.includes('integration') || f.includes('external'))) {
      sections.push({
        name: "External Integrations",
        description: "API calls and external service integrations",
        estimatedNodes: Math.floor(estimatedTotal * 0.2),
        dependencies: ["Data Processing"]
      });
    }
    
    // Error handling is essential
    sections.push({
      name: "Error Handling",
      description: "Error handling and recovery",
      estimatedNodes: Math.min(5, Math.floor(estimatedTotal * 0.1)),
      dependencies: ["Core Workflow"]
    });
    
    // Add monitoring if complex enough
    if (estimatedTotal > 20) {
      sections.push({
        name: "Monitoring & Logging",
        description: "Activity logging and monitoring",
        estimatedNodes: Math.min(5, Math.floor(estimatedTotal * 0.1)),
        dependencies: ["Core Workflow"]
      });
    }
    
    return {
      totalNodes: sections.reduce((sum, s) => sum + s.estimatedNodes, 0),
      sections
    };
  }
  
  private async generateCoreSection(prompt: string, name: string, plan: GenerationPlan): Promise<WorkflowSection> {
    const corePrompt = `Generate ONLY a valid n8n workflow JSON for the CORE section of "${name}".

Original request: ${prompt}

Generate ${plan.sections.find(s => s.name === 'Core Workflow')?.estimatedNodes || 10} nodes for the core section.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON (no markdown, no explanations)
2. Include "nodes" array with proper n8n node types
3. Include "connections" object linking all nodes
4. Start node IDs from "1"
5. All nodes MUST be connected
6. Function nodes MUST return items as array: return [{json: data}] NOT return {json: data}

Required structure:
{
  "name": "${name}",
  "nodes": [
    {
      "id": "1",
      "name": "Trigger",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [100, 100],
      "parameters": {}
    }
  ],
  "connections": {
    "1": {
      "main": [[{"node": "2", "type": "main", "index": 0}]]
    }
  }
}

DO NOT include any text before or after the JSON.`;
    
    const response = await this.provider.generateWorkflow(corePrompt, `${name} - Core`);
    
    if (response.success && response.workflow) {
      return {
        name: "Core Workflow",
        nodes: response.workflow.nodes || [],
        connections: response.workflow.connections || {},
        startNodeId: "1",
        endNodeIds: this.findEndNodes(response.workflow)
      };
    }
    
    throw new Error('Failed to generate core section');
  }
  
  private async generateSection(
    sectionPlan: any, 
    originalPrompt: string,
    existingSections: WorkflowSection[]
  ): Promise<WorkflowSection> {
    // Update node ID counter based on existing nodes
    const existingNodeCount = existingSections.reduce((sum, s) => sum + s.nodes.length, 0);
    this.nodeIdCounter = existingNodeCount + 1;
    
    const sectionPrompt = `Generate ONLY valid n8n workflow JSON for the "${sectionPlan.name}" section.

Original request: ${originalPrompt}
Section: ${sectionPlan.description}
Required nodes: EXACTLY ${sectionPlan.estimatedNodes} nodes

Section requirements:
${this.getSectionRequirements(sectionPlan.name, sectionPlan.estimatedNodes)}

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON (no markdown, no text)
2. Start node IDs from "${this.nodeIdCounter}"
3. Generate EXACTLY ${sectionPlan.estimatedNodes} nodes
4. All nodes MUST be connected
5. Use proper n8n node types
6. Function nodes MUST return items as array: return [{json: data}] NOT return {json: data}

Required structure:
{
  "name": "${sectionPlan.name}",
  "nodes": [
    {
      "id": "${this.nodeIdCounter}",
      "name": "First Node",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [100, 100],
      "parameters": {}
    }
  ],
  "connections": {
    "${this.nodeIdCounter}": {
      "main": [[{"node": "${this.nodeIdCounter + 1}", "type": "main", "index": 0}]]
    }
  }
}

DO NOT include any text before or after the JSON.`;
    
    const response = await this.provider.generateWorkflow(sectionPrompt, `${sectionPlan.name} Section`);
    
    // Check if the provider returned an error
    if (!response.success) {
      console.error(`Failed to generate ${sectionPlan.name} section:`, response.error);
      // Return a basic section as fallback
      return this.generateBasicSection(sectionPlan.name, sectionPlan.estimatedNodes);
    }
    
    if (response.workflow) {
      // Adjust node IDs to continue from existing nodes
      this.adjustNodeIds(response.workflow);
      
      return {
        name: sectionPlan.name,
        nodes: response.workflow.nodes || [],
        connections: response.workflow.connections || {},
        startNodeId: String(this.nodeIdCounter),
        endNodeIds: this.findEndNodes(response.workflow)
      };
    }
    
    // Fallback: generate a basic section
    return this.generateBasicSection(sectionPlan.name, sectionPlan.estimatedNodes);
  }
  
  private getSectionRequirements(sectionName: string, estimatedNodes: number = 10): string {
    const requirements: { [key: string]: string } = {
      "Input Validation": `
- Schema validation nodes (3-4)
- Type checking nodes (2-3)
- Business rule validation (3-4)
- Sanitization nodes (2-3)
- Validation error handling (2-3)`,
      
      "Data Processing": `
- Data transformation nodes (4-5)
- Calculation/aggregation nodes (3-4)
- Loop nodes for batch processing (2-3)
- Conditional processing (IF/Switch) (3-4)
- Data enrichment nodes (3-4)`,
      
      "External Integrations": `
- Authentication nodes (2-3)
- HTTP Request nodes for APIs (4-5)
- Response validation (3-4)
- Retry logic with Wait nodes (2-3)
- Data mapping nodes (3-4)`,
      
      "Error Handling": `
- Error classification nodes (2-3)
- Recovery strategy nodes (3-4)
- Fallback processing (2-3)
- Error logging (2-3)
- Admin notifications (1-2)`,
      
      "Monitoring & Logging": `
- Activity logging nodes (3-4)
- Performance tracking (2-3)
- Audit trail creation (2-3)
- Metrics collection (2-3)`
    };
    
    return requirements[sectionName] || `
- Relevant processing nodes (${Math.floor(estimatedNodes * 0.5)})
- Control flow nodes (${Math.floor(estimatedNodes * 0.3)})
- Error handling (${Math.floor(estimatedNodes * 0.2)})`;
  }
  
  private adjustNodeIds(workflow: any): void {
    const idMap: { [key: string]: string } = {};
    const nameToId: { [key: string]: string } = {};
    
    // Update node IDs and create name mapping
    workflow.nodes.forEach((node: any) => {
      const oldId = node.id;
      const newId = String(this.nodeIdCounter++);
      idMap[oldId] = newId;
      node.id = newId;
      
      // Also map node names to new IDs
      if (node.name) {
        nameToId[node.name] = newId;
      }
    });
    
    // Update connections with new IDs
    const newConnections: any = {};
    Object.entries(workflow.connections || {}).forEach(([nodeKey, targets]: [string, any]) => {
      // Try to resolve node key (could be ID or name)
      const newNodeId = idMap[nodeKey] || nameToId[nodeKey] || nodeKey;
      
      if (!newConnections[newNodeId]) {
        newConnections[newNodeId] = {};
      }
      
      Object.entries(targets).forEach(([type, connections]: [string, any]) => {
        newConnections[newNodeId][type] = connections.map((connGroup: any[]) => 
          connGroup.map((conn: any) => ({
            ...conn,
            node: idMap[conn.node] || nameToId[conn.node] || conn.node
          }))
        );
      });
    });
    
    workflow.connections = newConnections;
  }
  
  private mergeSections(sections: WorkflowSection[], workflowName: string): any {
    const allNodes: any[] = [];
    const allConnections: any = {};
    
    // Collect all nodes and connections
    sections.forEach(section => {
      allNodes.push(...section.nodes);
      Object.assign(allConnections, section.connections);
    });
    
    // Connect sections together
    for (let i = 1; i < sections.length; i++) {
      const prevSection = sections[i - 1];
      const currentSection = sections[i];
      
      // Connect end nodes of previous section to start node of current section
      prevSection.endNodeIds.forEach(endId => {
        if (!allConnections[endId]) {
          allConnections[endId] = { main: [[]] };
        }
        allConnections[endId].main[0].push({
          node: currentSection.startNodeId,
          type: "main",
          index: 0
        });
      });
    }
    
    // Position nodes in a grid layout
    this.positionNodes(allNodes);
    
    return {
      name: workflowName,
      nodes: allNodes,
      connections: allConnections,
      settings: {},
      active: false
    };
  }
  
  private positionNodes(nodes: any[]): void {
    const columns = 8;
    const xSpacing = 200;
    const ySpacing = 150;
    
    nodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      
      node.position = [
        100 + (col * xSpacing),
        100 + (row * ySpacing)
      ];
    });
  }
  
  private findEndNodes(workflow: any): string[] {
    if (!workflow.connections || Object.keys(workflow.connections).length === 0) {
      console.warn('No connections found in workflow section');
      // If no connections, return the last node as end node
      const nodes = workflow.nodes || [];
      return nodes.length > 0 ? [nodes[nodes.length - 1].id] : [];
    }
    
    const hasOutgoing = new Set(Object.keys(workflow.connections));
    const allNodes = new Set((workflow.nodes || []).map((n: any) => n.id));
    
    const endNodes = Array.from(allNodes).filter((id: any) => !hasOutgoing.has(id)) as string[];
    
    // If all nodes have outgoing connections (circular), take the last node
    if (endNodes.length === 0 && workflow.nodes && workflow.nodes.length > 0) {
      return [workflow.nodes[workflow.nodes.length - 1].id];
    }
    
    return endNodes;
  }
  
  private validateAndFixConnections(workflow: any): void {
    // Remove unused variable
    // const nodeMap = new Map(workflow.nodes.map((n: any) => [n.id, n]));
    const connected = new Set<string>();
    
    // Find all connected nodes
    Object.entries(workflow.connections).forEach(([source, targets]: [string, any]) => {
      connected.add(source);
      if (targets.main) {
        targets.main.forEach((group: any[]) => {
          group.forEach((conn: any) => {
            connected.add(conn.node);
          });
        });
      }
    });
    
    // Find disconnected nodes
    const disconnected = workflow.nodes.filter((n: any) => !connected.has(n.id));
    
    if (disconnected.length > 0) {
      console.log(`Found ${disconnected.length} disconnected nodes, connecting them...`);
      
      // Connect disconnected nodes based on their position
      disconnected.forEach((node: any) => {
        // Find the nearest node that comes before this one
        const prevNode = this.findNearestPreviousNode(node, workflow.nodes);
        if (prevNode) {
          if (!workflow.connections[prevNode.id]) {
            workflow.connections[prevNode.id] = { main: [[]] };
          }
          workflow.connections[prevNode.id].main[0].push({
            node: node.id,
            type: "main",
            index: 0
          });
        }
      });
    }
  }
  
  private findNearestPreviousNode(targetNode: any, allNodes: any[]): any {
    // Find nodes that are positioned before (to the left of) the target node
    const candidateNodes = allNodes.filter(n => 
      n.id !== targetNode.id && 
      n.position[0] < targetNode.position[0]
    );
    
    if (candidateNodes.length === 0) return null;
    
    // Sort by distance and return the closest one
    candidateNodes.sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.position[0] - targetNode.position[0], 2) +
        Math.pow(a.position[1] - targetNode.position[1], 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.position[0] - targetNode.position[0], 2) +
        Math.pow(b.position[1] - targetNode.position[1], 2)
      );
      return distA - distB;
    });
    
    return candidateNodes[0];
  }
  
  private generateBasicSection(name: string, nodeCount: number): WorkflowSection {
    const nodes = [];
    const connections: any = {};
    const startId = String(this.nodeIdCounter);
    
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = String(this.nodeIdCounter++);
      nodes.push({
        id: nodeId,
        name: `${name} Node ${i + 1}`,
        type: "n8n-nodes-base.function",
        typeVersion: 1,
        position: [100 + (i % 5) * 200, 100 + Math.floor(i / 5) * 150],
        parameters: {
          functionCode: `// ${name} processing\nreturn items;`
        }
      });
      
      // Connect to previous node
      if (i > 0) {
        const prevId = String(this.nodeIdCounter - 2);
        connections[prevId] = {
          main: [[{ node: nodeId, type: "main", index: 0 }]]
        };
      }
    }
    
    return {
      name,
      nodes,
      connections,
      startNodeId: startId,
      endNodeIds: [String(this.nodeIdCounter - 1)]
    };
  }
  
  private extractFeatures(prompt: string): string[] {
    const features = [];
    const keywords = [
      'api', 'database', 'notification', 'email', 'sms', 'validation',
      'authentication', 'processing', 'transformation', 'integration',
      'monitoring', 'logging', 'error handling', 'retry', 'scheduling',
      'webhook', 'report', 'analysis', 'calculation', 'filtering'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    keywords.forEach(keyword => {
      if (lowerPrompt.includes(keyword)) {
        features.push(keyword);
      }
    });
    
    return features;
  }
}