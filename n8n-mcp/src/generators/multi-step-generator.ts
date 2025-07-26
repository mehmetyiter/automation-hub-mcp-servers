import { N8nKnowledgeBase, ExpansionRule } from '../knowledge/n8n-capabilities.js';
import { AIProviderInterface } from '../types/ai-provider.js';
import { PromptToWorkflowMapper } from '../planning/prompt-to-workflow-mapper.js';

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
  private promptMapper: PromptToWorkflowMapper;
  
  constructor(provider: AIProviderInterface, learningContext?: any, progressCallback?: (message: string) => void) {
    this.provider = provider;
    this.knowledgeBase = new N8nKnowledgeBase();
    this.learningContext = learningContext;
    this.progressCallback = progressCallback;
    this.promptMapper = new PromptToWorkflowMapper();
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
    const finalWorkflow = await this.mergeSections(sections, name);
    console.log(`Final workflow has ${finalWorkflow.nodes.length} nodes`);
    this.progressCallback?.(`Workflow assembled with ${finalWorkflow.nodes.length} total nodes`);
    
    // Step 5: Validate and fix connections
    this.progressCallback?.('Validating and optimizing node connections...');
    this.validateAndFixConnections(finalWorkflow);
    this.progressCallback?.('Workflow generation completed successfully!');
    
    return finalWorkflow;
  }
  
  private async createGenerationPlan(prompt: string): Promise<GenerationPlan> {
    // Analyze the prompt with PromptToWorkflowMapper for dynamic understanding
    const analysis = await this.promptMapper.analyzePrompt(prompt);
    console.log('Prompt analysis completed:', {
      features: analysis.features.size,
      tasks: analysis.tasks.length,
      suggestedNodes: analysis.suggestedNodes.length
    });
    
    // Extract features for fallback
    const features = this.extractFeatures(prompt);
    
    // Generate a detailed markdown-style prompt like in the old system
    let enhancedPrompt = `To create a comprehensive n8n workflow for: ${prompt}\n\n`;
    enhancedPrompt += `### Workflow Requirements Analysis\n\n`;
    
    // Add feature breakdown
    if (analysis.features.size > 0) {
      enhancedPrompt += `#### Identified Features:\n`;
      analysis.features.forEach((nodes, feature) => {
        enhancedPrompt += `- **${feature}**: Requires ${nodes.join(', ')}\n`;
      });
      enhancedPrompt += '\n';
    }
    
    // Add task breakdown
    if (analysis.tasks.length > 0) {
      enhancedPrompt += `#### Workflow Tasks:\n`;
      analysis.tasks.forEach(task => {
        enhancedPrompt += `\n##### ${task.id}. ${task.description}\n`;
        enhancedPrompt += `- Required Nodes: ${task.requiredNodes.join(', ')}\n`;
        if (task.dependencies.length > 0) {
          enhancedPrompt += `- Dependencies: ${task.dependencies.join(', ')}\n`;
        }
        enhancedPrompt += `- Validation: ${task.validationChecks.join('; ')}\n`;
      });
      enhancedPrompt += '\n';
    }
    
    // Add suggested nodes
    if (analysis.suggestedNodes.length > 0) {
      enhancedPrompt += `#### Suggested Node Types:\n`;
      enhancedPrompt += analysis.suggestedNodes.map(node => `- ${node}`).join('\n');
      enhancedPrompt += '\n\n';
    }
    
    // Add validation checklist
    if (analysis.validationChecklist.length > 0) {
      enhancedPrompt += `#### Validation Requirements:\n`;
      enhancedPrompt += analysis.validationChecklist.map(check => `☑ ${check}`).join('\n');
      enhancedPrompt += '\n\n';
    }
    
    // Add learning context if available
    if (this.learningContext) {
      if (this.learningContext.bestPractices?.length > 0) {
        enhancedPrompt += `#### Best Practices from Similar Workflows:\n`;
        enhancedPrompt += this.learningContext.bestPractices.map((p: string) => `- ${p}`).join('\n');
        enhancedPrompt += '\n\n';
      }
      
      if (this.learningContext.avoidErrors?.length > 0) {
        enhancedPrompt += `#### Common Errors to Avoid:\n`;
        enhancedPrompt += this.learningContext.avoidErrors.map((e: string) => `- ${e}`).join('\n');
        enhancedPrompt += '\n\n';
      }
    }
    
    enhancedPrompt += `### Generation Plan Request\n\n`;
    enhancedPrompt += `Based on the above analysis, create a workflow generation plan that:\n`;
    enhancedPrompt += `1. Addresses all identified features and requirements\n`;
    enhancedPrompt += `2. Implements proper error handling and validation\n`;
    enhancedPrompt += `3. Follows n8n best practices\n`;
    enhancedPrompt += `4. Creates a scalable and maintainable workflow\n\n`;
    
    enhancedPrompt += `Return ONLY a JSON object with this structure:\n`;
    enhancedPrompt += `{\n`;
    enhancedPrompt += `  "totalNodes": <number based on complexity>,\n`;
    enhancedPrompt += `  "sections": [\n`;
    enhancedPrompt += `    {\n`;
    enhancedPrompt += `      "name": "<section name>",\n`;
    enhancedPrompt += `      "description": "<what this section does>",\n`;
    enhancedPrompt += `      "estimatedNodes": <number>,\n`;
    enhancedPrompt += `      "dependencies": [<array of section names this depends on>]\n`;
    enhancedPrompt += `    }\n`;
    enhancedPrompt += `  ]\n`;
    enhancedPrompt += `}\n\n`;
    enhancedPrompt += `Important: Create sections based on the actual requirements, not a fixed template.`;
    
    const response = await this.provider.generateWorkflow(enhancedPrompt, 'plan');
    
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
    // Fallback plan when AI can't generate one
    // Based on actual feature analysis, not templates
    console.log('Creating fallback plan based on feature analysis');
    
    const sections = [];
    let totalEstimatedNodes = 0;
    
    // Core section is essential for any workflow
    const coreNodes = Math.max(5, features.length * 2);
    sections.push({
      name: "Core Workflow",
      description: "Main workflow structure with triggers and basic flow",
      estimatedNodes: coreNodes,
      dependencies: []
    });
    totalEstimatedNodes += coreNodes;
    
    // Add validation if features suggest it
    if (features.some(f => f.includes('validation') || f.includes('api'))) {
      const validationNodes = Math.max(5, Math.ceil(features.length * 1.5));
      sections.push({
        name: "Input Validation",
        description: "Input validation and sanitization",
        estimatedNodes: validationNodes,
        dependencies: ["Core Workflow"]
      });
      totalEstimatedNodes += validationNodes;
    }
    
    // Main processing is always needed
    const processingNodes = Math.max(8, features.length * 3);
    sections.push({
      name: "Data Processing",
      description: "Main data processing and transformation logic",
      estimatedNodes: processingNodes,
      dependencies: sections.some(s => s.name === "Input Validation") ? ["Input Validation"] : ["Core Workflow"]
    });
    totalEstimatedNodes += processingNodes;
    
    // Add integrations if needed
    if (features.some(f => f.includes('api') || f.includes('integration') || f.includes('external'))) {
      const integrationNodes = Math.max(6, features.filter(f => f.includes('api') || f.includes('integration')).length * 4);
      sections.push({
        name: "External Integrations",
        description: "API calls and external service integrations",
        estimatedNodes: integrationNodes,
        dependencies: ["Data Processing"]
      });
      totalEstimatedNodes += integrationNodes;
    }
    
    // Error handling is essential
    const errorNodes = Math.max(4, Math.ceil(sections.length * 1.5));
    sections.push({
      name: "Error Handling",
      description: "Error handling and recovery",
      estimatedNodes: errorNodes,
      dependencies: ["Core Workflow"]
    });
    totalEstimatedNodes += errorNodes;
    
    // Add monitoring if complex workflow
    if (features.length > 3 || totalEstimatedNodes > 20) {
      const monitoringNodes = Math.max(3, features.length);
      sections.push({
        name: "Monitoring & Logging",
        description: "Activity logging and monitoring",
        estimatedNodes: monitoringNodes,
        dependencies: ["Core Workflow"]
      });
      totalEstimatedNodes += monitoringNodes;
    }
    
    return {
      totalNodes: totalEstimatedNodes,
      sections
    };
  }
  
  private async generateCoreSection(prompt: string, name: string, plan: GenerationPlan): Promise<WorkflowSection> {
    // Analyze the prompt for core section generation
    const analysis = await this.promptMapper.analyzePrompt(prompt);
    const coreSection = plan.sections.find(s => s.name === 'Core Workflow');
    
    // Build dynamic prompt based on analysis
    let corePrompt = `Create the core section of an n8n workflow for: ${name}\n\n`;
    corePrompt += `### Core Section Requirements\n\n`;
    corePrompt += `Original request: ${prompt}\n\n`;
    
    if (coreSection) {
      corePrompt += `This core section should focus on: ${coreSection.description}\n`;
      if (coreSection.estimatedNodes > 0) {
        corePrompt += `Estimated complexity: approximately ${coreSection.estimatedNodes} nodes\n`;
      }
    }
    
    corePrompt += `\n#### Key Components Needed:\n`;
    
    // Identify trigger requirements
    const triggerNeeded = analysis.suggestedNodes.find(n => 
      n.includes('cron') || n.includes('webhook') || n.includes('trigger')
    );
    if (triggerNeeded) {
      corePrompt += `- Trigger: ${triggerNeeded}\n`;
    } else {
      corePrompt += `- Trigger: Choose appropriate based on use case\n`;
    }
    
    // Add core processing requirements
    corePrompt += `- Initial data setup and validation\n`;
    corePrompt += `- Main processing flow initialization\n`;
    corePrompt += `- Basic error handling setup\n`;
    
    if (analysis.features.size > 0) {
      corePrompt += `\n#### Features to Initialize:\n`;
      let count = 0;
      analysis.features.forEach((nodes, feature) => {
        if (count < 3) { // Focus on top features for core
          corePrompt += `- ${feature}: Set up foundation for ${nodes[0]}\n`;
          count++;
        }
      });
    }
    
    corePrompt += `\n### Technical Requirements:\n`;
    corePrompt += `Return a valid n8n workflow JSON object with:\n`;
    corePrompt += `- "name": "${name}"\n`;
    corePrompt += `- "nodes": array of n8n node objects\n`;
    corePrompt += `- "connections": object mapping node connections\n`;
    corePrompt += `- Node IDs starting from "1"\n`;
    corePrompt += `- All nodes properly connected\n`;
    corePrompt += `- Function nodes returning items as array: return [{json: data}]\n`;
    corePrompt += `\nReturn ONLY the JSON object, no explanations or markdown.`;
    
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
    
    // Generate dynamic prompt based on section requirements
    const analysis = await this.promptMapper.analyzePrompt(originalPrompt);
    
    let sectionPrompt = `Create the "${sectionPlan.name}" section for the workflow.\n\n`;
    sectionPrompt += `### Section Overview\n`;
    sectionPrompt += `Purpose: ${sectionPlan.description}\n`;
    sectionPrompt += `Original request: ${originalPrompt}\n\n`;
    
    // Add context from previous sections
    if (existingSections.length > 0) {
      sectionPrompt += `### Previous Sections Context\n`;
      existingSections.forEach(section => {
        sectionPrompt += `- ${section.name}: ${section.nodes.length} nodes (ends at node ${section.endNodeIds.join(', ')})\n`;
      });
      sectionPrompt += `\n`;
    }
    
    // Add specific requirements based on section type
    sectionPrompt += `### ${sectionPlan.name} Requirements\n`;
    
    // Find relevant features for this section
    const relevantFeatures = Array.from(analysis.features.entries())
      .filter(([feature]) => {
        const sectionNameLower = sectionPlan.name.toLowerCase();
        const featureLower = feature.toLowerCase();
        return sectionNameLower.includes(featureLower) || 
               featureLower.includes(sectionNameLower) ||
               (sectionPlan.description && sectionPlan.description.toLowerCase().includes(featureLower));
      });
    
    if (relevantFeatures.length > 0) {
      sectionPrompt += `\n#### Relevant Features:\n`;
      relevantFeatures.forEach(([feature, nodes]) => {
        sectionPrompt += `- ${feature}: Implement using ${nodes.join(', ')}\n`;
      });
    }
    
    // Add dependencies context
    if (sectionPlan.dependencies && sectionPlan.dependencies.length > 0) {
      sectionPrompt += `\n#### Dependencies:\n`;
      sectionPrompt += `This section depends on: ${sectionPlan.dependencies.join(', ')}\n`;
      sectionPrompt += `Connect to the output of these sections.\n`;
    }
    
    // Add learning context if available
    if (this.learningContext && this.learningContext.sectionPatterns) {
      const patterns = this.learningContext.sectionPatterns[sectionPlan.name];
      if (patterns) {
        sectionPrompt += `\n#### Best Practices for ${sectionPlan.name}:\n`;
        patterns.forEach((pattern: string) => sectionPrompt += `- ${pattern}\n`);
      }
    }
    
    sectionPrompt += `\n### Critical Connection Requirements:\n`;
    sectionPrompt += `- Every node must have explicit connections defined\n`;
    sectionPrompt += `- Switch nodes: Define connections for ALL output branches\n`;
    sectionPrompt += `- If nodes: Define connections for both true/false outputs\n`;
    sectionPrompt += `- No node should be left disconnected\n`;
    sectionPrompt += `- Each branch must reach a logical conclusion\n`;
    sectionPrompt += `- Dead-end nodes are NOT allowed\n`;
    
    sectionPrompt += `\n### Technical Requirements:\n`;
    sectionPrompt += `- Start node IDs from: ${this.nodeIdCounter}\n`;
    sectionPrompt += `- Create appropriate number of nodes based on complexity\n`;
    sectionPrompt += `- All nodes must be properly connected\n`;
    sectionPrompt += `- Use correct n8n node types from the catalog\n`;
    sectionPrompt += `- Function nodes must return: [{json: data}]\n`;
    sectionPrompt += `\nReturn a JSON object with "name", "nodes", and "connections" properties.`;
    
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
  
  private async mergeSections(sections: WorkflowSection[], workflowName: string): Promise<any> {
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
    
    // Import ID generators at the top of the file if not already imported
    const { generateWorkflowId, generateVersionId, generateInstanceId } = await import('../utils/id-generator.js');
    
    return {
      name: workflowName,
      nodes: allNodes,
      connections: allConnections,
      settings: {},
      active: false,
      // Add required n8n metadata fields
      id: generateWorkflowId(),
      versionId: generateVersionId(),
      meta: {
        instanceId: generateInstanceId()
      },
      tags: [],
      pinData: {}
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