// workflow-generation/advanced-workflow-builder.ts

import { 
  WorkflowBuilderConfig, 
  BuildContext, 
  n8nWorkflow,
  n8nNode,
  BranchInfo,
  MergePointInfo
} from './workflow-builder.types.js';
import { NodeTemplateFactory } from './node-templates/template-factory.js';

export class AdvancedWorkflowBuilder {
  private config: WorkflowBuilderConfig;
  private templateFactory: NodeTemplateFactory;
  
  constructor(config?: WorkflowBuilderConfig) {
    this.config = {
      startPosition: [250, 300],
      nodeSpacing: { horizontal: 200, vertical: 150 },
      branchSpacing: 400,
      parallelSpacing: 200,
      ...config
    };
    
    this.templateFactory = new NodeTemplateFactory();
  }
  
  build(parsedPrompt: any): n8nWorkflow {
    console.log(`AdvancedWorkflowBuilder: Building workflow "${parsedPrompt.workflowName}"`);
    
    const context: BuildContext = {
      currentPosition: [...this.config.startPosition!],
      nodeMap: new Map(),
      nodeIdMap: new Map(),
      nodeIdCounter: 1,
      errors: [],
      branches: new Map(),
      mergePoints: new Map()
    };
    
    const workflow: n8nWorkflow = {
      name: parsedPrompt.workflowName,
      nodes: [],
      connections: {},
      active: false,
      settings: {},
      versionId: this.generateVersionId(),
      meta: {
        instanceId: this.generateInstanceId()
      },
      id: this.generateWorkflowId(),
      tags: [],
      pinData: {}
    };
    
    // Analyze prompt for complex patterns
    this.analyzeWorkflowStructure(parsedPrompt, context);
    
    // Build branches
    parsedPrompt.branches.forEach((branch: any, index: number) => {
      this.buildBranch(branch, index, context, workflow);
    });
    
    // Connect branches if needed
    if (parsedPrompt.branches.length > 1) {
      this.connectMultipleBranches(parsedPrompt.branches, context, workflow);
    }
    
    // Apply global requirements
    this.applyGlobalRequirements(parsedPrompt.globalRequirements, workflow, context);
    
    console.log(`Workflow built with ${workflow.nodes.length} nodes`);
    
    return workflow;
  }
  
  private analyzeWorkflowStructure(parsedPrompt: any, context: BuildContext): void {
    // Analyze for parallel execution patterns
    parsedPrompt.branches.forEach((branch: any) => {
      branch.nodes.forEach((node: any, index: number) => {
        const nodeName = node.name.toLowerCase();
        const nodeDesc = (node.description || '').toLowerCase();
        
        // Detect parallel execution
        if (nodeName.includes('parallel') || nodeDesc.includes('parallel')) {
          console.log(`Detected parallel execution at: ${node.name}`);
          node._parallel = true;
        }
        
        // Detect switch/routing nodes
        if (nodeName.includes('switch') || nodeName.includes('route') || 
            nodeDesc.includes('switch') || nodeDesc.includes('condition')) {
          console.log(`Detected switch node: ${node.name}`);
          node._switch = true;
        }
        
        // Detect merge points
        if (nodeName.includes('merge') || nodeDesc.includes('merge')) {
          console.log(`Detected merge point: ${node.name}`);
          node._merge = true;
        }
      });
    });
  }
  
  private buildBranch(
    branch: any, 
    branchIndex: number, 
    context: BuildContext, 
    workflow: n8nWorkflow
  ): void {
    console.log(`Building branch: ${branch.name}`);
    
    const branchStartY = this.config.startPosition![1] + (branchIndex * this.config.branchSpacing!);
    let currentX = this.config.startPosition![0];
    
    // Create trigger node
    const triggerNode = this.createTriggerNode(branch.triggerType, [currentX, branchStartY], context);
    workflow.nodes.push(triggerNode);
    context.nodeMap.set(triggerNode.id, triggerNode);
    
    currentX += this.config.nodeSpacing!.horizontal;
    let previousNodeId = triggerNode.id;
    
    // Process branch nodes
    for (let i = 0; i < branch.nodes.length; i++) {
      const nodeSpec = branch.nodes[i];
      
      // Handle parallel execution
      if (nodeSpec._parallel && i + 1 < branch.nodes.length) {
        const parallelResult = this.handleParallelExecution(
          nodeSpec, 
          branch.nodes, 
          i, 
          previousNodeId, 
          currentX, 
          branchStartY, 
          context, 
          workflow
        );
        
        previousNodeId = parallelResult.mergeNodeId;
        currentX = parallelResult.endX;
        i = parallelResult.skipToIndex - 1; // -1 because loop will increment
        continue;
      }
      
      // Handle switch nodes
      if (nodeSpec._switch) {
        const switchResult = this.handleSwitchNode(
          nodeSpec,
          branch.nodes,
          i,
          previousNodeId,
          currentX,
          branchStartY,
          context,
          workflow
        );
        
        previousNodeId = switchResult.mergeNodeId || switchResult.switchNodeId;
        currentX = switchResult.endX;
        i = switchResult.skipToIndex - 1;
        continue;
      }
      
      // Regular node creation
      const position: [number, number] = [currentX, branchStartY];
      const node = this.createNodeFromSpec(nodeSpec, position, context);
      
      workflow.nodes.push(node);
      context.nodeMap.set(node.id, node);
      
      // Connect to previous
      this.addConnection(workflow.connections, previousNodeId, node.id);
      
      previousNodeId = node.id;
      currentX += this.config.nodeSpacing!.horizontal;
    }
    
    // Add response node for webhooks
    if (branch.triggerType === 'webhook') {
      const responseNode = this.createResponseNode([currentX, branchStartY], context);
      workflow.nodes.push(responseNode);
      this.addConnection(workflow.connections, previousNodeId, responseNode.id);
    }
  }
  
  private handleParallelExecution(
    parallelNode: any,
    allNodes: any[],
    startIndex: number,
    sourceNodeId: string,
    startX: number,
    baseY: number,
    context: BuildContext,
    workflow: n8nWorkflow
  ): any {
    console.log(`Handling parallel execution: ${parallelNode.name}`);
    
    // Find parallel branches
    const parallelBranches: any[] = [];
    let currentBranch: any[] = [];
    let endIndex = startIndex;
    
    // Look for parallel nodes
    for (let i = startIndex; i < allNodes.length; i++) {
      const node = allNodes[i];
      
      if (node._merge) {
        endIndex = i;
        if (currentBranch.length > 0) {
          parallelBranches.push(currentBranch);
        }
        break;
      }
      
      // Detect branch separators (e.g., different payment methods)
      if (node.description && (
        node.description.includes('Stripe') ||
        node.description.includes('PayPal') ||
        node.description.includes('Crypto') ||
        node.description.includes('Email') ||
        node.description.includes('SMS')
      )) {
        if (currentBranch.length > 0) {
          parallelBranches.push(currentBranch);
        }
        currentBranch = [node];
      } else if (currentBranch.length > 0) {
        currentBranch.push(node);
      }
    }
    
    if (currentBranch.length > 0) {
      parallelBranches.push(currentBranch);
    }
    
    // Create parallel branches
    const branchEndNodes: string[] = [];
    let maxX = startX;
    
    parallelBranches.forEach((branch, index) => {
      const branchY = baseY + (index * this.config.parallelSpacing!);
      let branchX = startX;
      let lastNodeId = sourceNodeId;
      
      branch.forEach(nodeSpec => {
        const position: [number, number] = [branchX, branchY];
        const node = this.createNodeFromSpec(nodeSpec, position, context);
        
        workflow.nodes.push(node);
        context.nodeMap.set(node.id, node);
        
        this.addConnection(workflow.connections, lastNodeId, node.id);
        
        lastNodeId = node.id;
        branchX += this.config.nodeSpacing!.horizontal;
      });
      
      branchEndNodes.push(lastNodeId);
      maxX = Math.max(maxX, branchX);
    });
    
    // Create merge node
    const mergeNode = this.createMergeNode(
      [maxX, baseY],
      branchEndNodes.length,
      context
    );
    
    workflow.nodes.push(mergeNode);
    context.nodeMap.set(mergeNode.id, mergeNode);
    
    // Connect all branches to merge
    branchEndNodes.forEach((nodeId, index) => {
      this.addConnection(workflow.connections, nodeId, mergeNode.id, 0, index);
    });
    
    return {
      mergeNodeId: mergeNode.id,
      endX: maxX + this.config.nodeSpacing!.horizontal,
      skipToIndex: endIndex + 1
    };
  }
  
  private handleSwitchNode(
    switchSpec: any,
    allNodes: any[],
    startIndex: number,
    sourceNodeId: string,
    startX: number,
    baseY: number,
    context: BuildContext,
    workflow: n8nWorkflow
  ): any {
    console.log(`Handling switch node: ${switchSpec.name}`);
    
    // Create switch node
    const switchNode = this.createSwitchNode(switchSpec, [startX, baseY], context);
    workflow.nodes.push(switchNode);
    context.nodeMap.set(switchNode.id, switchNode);
    
    // Connect from source
    this.addConnection(workflow.connections, sourceNodeId, switchNode.id);
    
    // TODO: Parse switch branches from prompt
    // For now, create a simple pass-through
    
    return {
      switchNodeId: switchNode.id,
      endX: startX + this.config.nodeSpacing!.horizontal,
      skipToIndex: startIndex + 1
    };
  }
  
  private createNodeFromSpec(spec: any, position: [number, number], context: BuildContext): n8nNode {
    const nodeId = (context.nodeIdCounter++).toString();
    
    const config = {
      id: nodeId,
      name: spec.name,
      position,
      configuration: spec.configuration || {}
    };
    
    return this.templateFactory.createNode(spec.type, config);
  }
  
  private createTriggerNode(triggerType: string, position: [number, number], context: BuildContext): n8nNode {
    const nodeId = (context.nodeIdCounter++).toString();
    
    if (triggerType.includes('webhook')) {
      return this.templateFactory.createNode('n8n-nodes-base.webhook', {
        id: nodeId,
        name: 'Webhook Trigger',
        position,
        configuration: { path: '/webhook' }
      });
    } else if (triggerType.includes('schedule') || triggerType.includes('cron')) {
      return this.templateFactory.createNode('n8n-nodes-base.scheduleTrigger', {
        id: nodeId,
        name: 'Schedule Trigger',
        position,
        configuration: {}
      });
    }
    
    // Default
    return this.templateFactory.createNode('n8n-nodes-base.manualTrigger', {
      id: nodeId,
      name: 'Manual Trigger',
      position,
      configuration: {}
    });
  }
  
  private createMergeNode(position: [number, number], inputCount: number, context: BuildContext): n8nNode {
    const nodeId = (context.nodeIdCounter++).toString();
    
    return this.templateFactory.createNode('n8n-nodes-base.merge', {
      id: nodeId,
      name: 'Merge Results',
      position,
      configuration: { mode: 'append', inputCount }
    });
  }
  
  private createSwitchNode(spec: any, position: [number, number], context: BuildContext): n8nNode {
    const nodeId = (context.nodeIdCounter++).toString();
    
    // Extract conditions from description
    const conditions = this.extractSwitchConditions(spec);
    
    return this.templateFactory.createNode('n8n-nodes-base.switch', {
      id: nodeId,
      name: spec.name,
      position,
      configuration: { conditions }
    });
  }
  
  private createResponseNode(position: [number, number], context: BuildContext): n8nNode {
    const nodeId = (context.nodeIdCounter++).toString();
    
    return this.templateFactory.createNode('n8n-nodes-base.respondToWebhook', {
      id: nodeId,
      name: 'Respond to Webhook',
      position,
      configuration: {}
    });
  }
  
  private extractSwitchConditions(spec: any): string[] {
    const desc = (spec.description || '').toLowerCase();
    
    // Look for common patterns
    if (desc.includes('payment')) {
      return ['stripe', 'paypal', 'crypto'];
    }
    if (desc.includes('shipping')) {
      return ['dhl', 'ups', 'fedex'];
    }
    if (desc.includes('risk') || desc.includes('score')) {
      return ['low', 'medium', 'high'];
    }
    
    return ['option1', 'option2', 'option3'];
  }
  
  private addConnection(
    connections: any,
    fromId: string,
    toId: string,
    fromOutput: number = 0,
    toInput: number = 0
  ): void {
    if (!connections[fromId]) {
      connections[fromId] = { main: [] };
    }
    
    // Ensure array exists for this output
    while (connections[fromId].main.length <= fromOutput) {
      connections[fromId].main.push([]);
    }
    
    connections[fromId].main[fromOutput].push({
      node: toId,
      type: 'main',
      index: toInput
    });
  }
  
  private connectMultipleBranches(branches: any[], context: BuildContext, workflow: n8nWorkflow): void {
    // Implementation for connecting multiple branches
    // This would handle complex multi-trigger workflows
  }
  
  private applyGlobalRequirements(requirements: any, workflow: n8nWorkflow, context: BuildContext): void {
    if (!requirements || requirements.length === 0) {
      return;
    }
    
    console.log('Applying global requirements...');
    
    requirements.forEach((req: any) => {
      if (req.type === 'error-handling') {
        this.addGlobalErrorHandling(workflow, context);
      }
    });
  }
  
  private addGlobalErrorHandling(workflow: n8nWorkflow, context: BuildContext): void {
    console.log('Adding global error handling...');
    
    // Create error trigger node
    const errorNodeId = (context.nodeIdCounter++).toString();
    const errorTrigger = this.templateFactory.createNode('n8n-nodes-base.errorTrigger', {
      id: errorNodeId,
      name: 'Error Handler',
      position: [this.config.startPosition![0], this.config.startPosition![1] - 200]
    });
    
    workflow.nodes.push(errorTrigger);
    context.nodeMap.set(errorTrigger.id, errorTrigger);
    
    // Create notification node
    const notificationNodeId = (context.nodeIdCounter++).toString();
    const notificationNode = this.templateFactory.createNode('n8n-nodes-base.emailSend', {
      id: notificationNodeId,
      name: 'Error Notification',
      position: [this.config.startPosition![0] + 200, this.config.startPosition![1] - 200],
      configuration: {
        toEmail: 'admin@example.com',
        subject: 'Workflow Error: {{$node["Error Handler"].json.workflow.name}}',
        text: 'Error: {{$node["Error Handler"].json.error.message}}\n\nNode: {{$node["Error Handler"].json.error.node.name}}'
      }
    });
    
    workflow.nodes.push(notificationNode);
    context.nodeMap.set(notificationNode.id, notificationNode);
    
    // Connect error trigger to notification
    this.addConnection(workflow.connections, errorNodeId, notificationNodeId);
    
    // Add error output to critical nodes
    const criticalNodes = workflow.nodes.filter((node: any) => 
      node.type.includes('httpRequest') || 
      node.type.includes('database') || 
      node.type.includes('postgres') ||
      node.type.includes('mysql') ||
      node.type.includes('api')
    );
    
    criticalNodes.forEach((node: any) => {
      // Add error branch (output index 1) to connect to error handler
      if (!workflow.connections[node.id]) {
        workflow.connections[node.id] = { main: [[]] };
      }
      
      // Ensure we have an error output
      if (!workflow.connections[node.id].main[1]) {
        workflow.connections[node.id].main[1] = [];
      }
      
      // Don't duplicate if already connected
      const alreadyConnected = workflow.connections[node.id].main[1].some(
        (conn: any) => conn.node === errorNodeId
      );
      
      if (!alreadyConnected) {
        workflow.connections[node.id].main[1].push({
          node: errorNodeId,
          type: 'main',
          index: 0
        });
      }
    });
    
    console.log(`Added error handling to ${criticalNodes.length} critical nodes`);
  }
  
  // Utility methods (reuse from QuickWorkflowBuilder)
  private generateVersionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateInstanceId(): string {
    return Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
  
  private generateWorkflowId(): string {
    return Array(16).fill(0).map(() => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        .charAt(Math.floor(Math.random() * 62))
    ).join('');
  }
}