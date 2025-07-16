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
  
  constructor(provider: AIProviderInterface) {
    this.provider = provider;
    this.knowledgeBase = new N8nKnowledgeBase();
  }
  
  async generateWorkflow(prompt: string, name: string): Promise<any> {
    console.log('Starting multi-step workflow generation...');
    
    // Step 1: Analyze requirements and create generation plan
    const plan = await this.createGenerationPlan(prompt);
    console.log('Generation plan created:', plan);
    
    // Step 2: Generate core workflow structure
    const coreSection = await this.generateCoreSection(prompt, name, plan);
    console.log(`Core section generated with ${coreSection.nodes.length} nodes`);
    
    // Step 3: Generate each expansion section
    const sections: WorkflowSection[] = [coreSection];
    for (const sectionPlan of plan.sections) {
      const section = await this.generateSection(sectionPlan, prompt, sections);
      sections.push(section);
      console.log(`Generated ${sectionPlan.name} with ${section.nodes.length} nodes`);
    }
    
    // Step 4: Merge all sections into final workflow
    const finalWorkflow = this.mergeSections(sections, name);
    console.log(`Final workflow has ${finalWorkflow.nodes.length} nodes`);
    
    // Step 5: Validate and fix connections
    this.validateAndFixConnections(finalWorkflow);
    
    return finalWorkflow;
  }
  
  private async createGenerationPlan(prompt: string): Promise<GenerationPlan> {
    const features = this.extractFeatures(prompt);
    const recommendedNodes = this.knowledgeBase.calculateRecommendedNodes(features);
    
    const planPrompt = `Analyze this workflow request and create a detailed generation plan:

Request: ${prompt}

Based on the features, approximately ${recommendedNodes} nodes are recommended.

Break down the workflow into logical sections based on functionality:
1. Core workflow (main flow)
2. Data validation & preprocessing (if needed)
3. Main processing branches
4. Error handling & recovery
5. Monitoring & logging (if required)
6. Notifications & reporting (if needed)

Allocate nodes based on actual requirements, not fixed numbers.

Return a JSON object with this structure:
{
  "totalNodes": <number>,
  "sections": [
    {
      "name": "section name",
      "description": "what this section does",
      "estimatedNodes": <number>,
      "dependencies": ["other section names it depends on"]
    }
  ]
}`;
    
    const response = await this.provider.generateWorkflow(planPrompt, 'plan');
    
    // Extract plan from response
    if (response.success && response.workflow) {
      try {
        // The workflow might contain the plan in description or as a string
        let planData;
        if (typeof response.workflow === 'string') {
          planData = JSON.parse(response.workflow);
        } else if (response.workflow.description) {
          planData = JSON.parse(response.workflow.description);
        } else {
          // Default plan if parsing fails
          planData = this.createDefaultPlan(features);
        }
        return planData;
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
    const corePrompt = `Create the CORE section of a workflow named "${name}".

Original request: ${prompt}

This is just the CORE section with basic structure. Include:
1. Appropriate trigger node(s)
2. Initial validation (if needed)
3. Main routing logic (if branching is required)
4. Basic processing nodes
5. Response/output nodes
6. Basic error handling

Important:
- Use proper n8n node types
- All nodes must be connected
- Include node IDs starting from "1"
- This is just the foundation - other sections will add more complexity

Return a complete n8n workflow JSON with nodes and connections.`;
    
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
    
    const sectionPrompt = `Expand the workflow with a new section: "${sectionPlan.name}"

Original request: ${originalPrompt}
Section description: ${sectionPlan.description}
Target nodes for this section: ${sectionPlan.estimatedNodes}

Generate EXACTLY ${sectionPlan.estimatedNodes} nodes for this section.

This section should include:
${this.getSectionRequirements(sectionPlan.name, sectionPlan.estimatedNodes)}

Important:
- Start node IDs from "${this.nodeIdCounter}"
- All nodes must be properly connected within this section
- First node should be connectable from previous sections
- Include appropriate n8n node types
- This is ONE section of a larger workflow

Return a complete n8n workflow JSON with nodes and connections for JUST this section.`;
    
    const response = await this.provider.generateWorkflow(sectionPrompt, `${sectionPlan.name} Section`);
    
    if (response.success && response.workflow) {
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
    
    // Update node IDs
    workflow.nodes.forEach((node: any) => {
      const oldId = node.id;
      const newId = String(this.nodeIdCounter++);
      idMap[oldId] = newId;
      node.id = newId;
    });
    
    // Update connections with new IDs
    const newConnections: any = {};
    Object.entries(workflow.connections).forEach(([nodeId, targets]: [string, any]) => {
      const newNodeId = idMap[nodeId] || nodeId;
      newConnections[newNodeId] = {};
      
      Object.entries(targets).forEach(([type, connections]: [string, any]) => {
        newConnections[newNodeId][type] = connections.map((connGroup: any[]) => 
          connGroup.map((conn: any) => ({
            ...conn,
            node: idMap[conn.node] || conn.node
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
    const hasOutgoing = new Set(Object.keys(workflow.connections || {}));
    const allNodes = new Set((workflow.nodes || []).map((n: any) => n.id));
    
    return Array.from(allNodes).filter((id: any) => !hasOutgoing.has(id)) as string[];
  }
  
  private validateAndFixConnections(workflow: any): void {
    const nodeMap = new Map(workflow.nodes.map((n: any) => [n.id, n]));
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
        const prevNode = this.findNearestPreviousNode(node, workflow.nodes, workflow.connections);
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
  
  private findNearestPreviousNode(targetNode: any, allNodes: any[], connections: any): any {
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