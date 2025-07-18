// workflow-generation/quick-validator.ts

export class QuickValidator {
  validate(workflow: any): any {
    console.log('QuickValidator: Starting validation...');
    
    const errors = [];
    const warnings = [];
    const fixableIssues = [];
    
    // Build a map of all connections
    const connectedNodes = new Set<string>();
    const nodeMap = new Map<string, any>();
    
    // Add all nodes to map
    workflow.nodes.forEach((node: any) => {
      nodeMap.set(node.id, node);
    });
    
    // Track all nodes that have incoming connections
    Object.entries(workflow.connections || {}).forEach(([fromId, connections]: [string, any]) => {
      if (connections.main) {
        connections.main.forEach((outputArray: any[]) => {
          outputArray.forEach((conn: any) => {
            connectedNodes.add(conn.node);
          });
        });
      }
    });
    
    // Check each node for issues
    workflow.nodes.forEach((node: any) => {
      const isTrigger = node.type.includes('trigger') || node.type.includes('webhook') || node.type.includes('Trigger');
      const isResponseNode = node.type.includes('respondToWebhook');
      
      // Check if non-trigger nodes have incoming connections
      if (!isTrigger && !connectedNodes.has(node.id)) {
        errors.push({
          message: `Node "${node.name}" (${node.id}) is disconnected - no incoming connections`,
          nodeId: node.id,
          type: 'disconnected'
        });
        
        fixableIssues.push({
          nodeId: node.id,
          type: 'disconnected',
          description: `Connect node "${node.name}"`
        });
      }
      
      // Check if non-response nodes have outgoing connections
      const hasOutgoing = workflow.connections && workflow.connections[node.id];
      if (!hasOutgoing && !isResponseNode && !this.isLastNode(node, workflow)) {
        warnings.push({
          message: `Node "${node.name}" (${node.id}) has no outgoing connections`,
          nodeId: node.id,
          type: 'no-outgoing'
        });
      }
      
      // Check for missing required parameters
      this.validateNodeParameters(node, warnings);
    });
    
    // Check for overall workflow issues
    if (workflow.nodes.length === 0) {
      errors.push({
        message: 'Workflow has no nodes',
        type: 'empty-workflow'
      });
    }
    
    // Check for trigger nodes
    const triggerNodes = workflow.nodes.filter((n: any) => 
      n.type.includes('trigger') || n.type.includes('webhook') || n.type.includes('Trigger')
    );
    
    if (triggerNodes.length === 0) {
      errors.push({
        message: 'Workflow has no trigger node',
        type: 'no-trigger'
      });
    }
    
    const score = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5));
    
    console.log(`Validation complete: ${errors.length} errors, ${warnings.length} warnings, score: ${score}`);
    
    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      fixableIssues
    };
  }
  
  autoFix(workflow: any): any {
    console.log('QuickValidator: Attempting to auto-fix issues...');
    
    const fixedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep clone
    let fixCount = 0;
    
    // Ensure connections object exists
    if (!fixedWorkflow.connections) {
      fixedWorkflow.connections = {};
    }
    
    // Get validation results to identify issues
    const validation = this.validate(workflow);
    
    // Fix disconnected nodes
    validation.fixableIssues.forEach((issue: any) => {
      if (issue.type === 'disconnected') {
        const disconnectedNode = fixedWorkflow.nodes.find((n: any) => n.id === issue.nodeId);
        if (!disconnectedNode) return;
        
        // Find the best node to connect from (nearest node to the left)
        const potentialSources = fixedWorkflow.nodes.filter((n: any) => {
          return n.id !== issue.nodeId && 
                 n.position[0] < disconnectedNode.position[0] &&
                 Math.abs(n.position[1] - disconnectedNode.position[1]) < 150; // Same branch
        });
        
        if (potentialSources.length > 0) {
          // Sort by distance (closest first)
          potentialSources.sort((a: any, b: any) => {
            const distA = disconnectedNode.position[0] - a.position[0];
            const distB = disconnectedNode.position[0] - b.position[0];
            return distA - distB;
          });
          
          const sourceNode = potentialSources[0];
          
          // Create connection using node names (n8n uses names, not IDs)
          const sourceName = sourceNode.name || sourceNode.id;
          const targetName = disconnectedNode.name || disconnectedNode.id;
          
          if (!fixedWorkflow.connections[sourceName]) {
            fixedWorkflow.connections[sourceName] = { main: [[]] };
          }
          
          // Check if connection already exists
          const existingConnection = fixedWorkflow.connections[sourceName].main[0]
            .find((conn: any) => conn.node === targetName);
          
          if (!existingConnection) {
            fixedWorkflow.connections[sourceName].main[0].push({
              node: targetName,
              type: 'main',
              index: 0
            });
            
            console.log(`  Fixed: Connected ${sourceNode.name} -> ${disconnectedNode.name}`);
            fixCount++;
          }
        } else {
          console.log(`  Could not find suitable source node for ${disconnectedNode.name}`);
        }
      }
    });
    
    // Fix nodes without outgoing connections (connect them in sequence)
    const nodesByPosition = fixedWorkflow.nodes
      .slice()
      .sort((a: any, b: any) => a.position[0] - b.position[0]);
    
    for (let i = 0; i < nodesByPosition.length - 1; i++) {
      const current = nodesByPosition[i];
      const next = nodesByPosition[i + 1];
      
      // Check if they're on the same branch (similar Y position)
      if (Math.abs(current.position[1] - next.position[1]) < 150) {
        const currentName = current.name || current.id;
        const nextName = next.name || next.id;
        
        if (!fixedWorkflow.connections[currentName]) {
          fixedWorkflow.connections[currentName] = { main: [[]] };
          
          fixedWorkflow.connections[currentName].main[0].push({
            node: nextName,
            type: 'main',
            index: 0
          });
          
          console.log(`  Fixed: Added connection ${current.name} -> ${next.name}`);
          fixCount++;
        }
      }
    }
    
    // Add default parameters to nodes that need them
    fixedWorkflow.nodes.forEach((node: any) => {
      if (node.type === 'n8n-nodes-base.webhook' && !node.parameters?.path) {
        node.parameters = node.parameters || {};
        node.parameters.path = '/webhook';
        console.log(`  Fixed: Added default webhook path to ${node.name}`);
        fixCount++;
      }
      
      if (node.type === 'n8n-nodes-base.code' && !node.parameters?.jsCode) {
        node.parameters = node.parameters || {};
        node.parameters.jsCode = '// Add your code here\nreturn items;';
        console.log(`  Fixed: Added default code to ${node.name}`);
        fixCount++;
      }
    });
    
    console.log(`Auto-fix complete: ${fixCount} issues fixed`);
    
    return fixedWorkflow;
  }
  
  private isLastNode(node: any, workflow: any): boolean {
    // Check if this node is likely the last in its branch
    const sameBranchNodes = workflow.nodes.filter((n: any) => 
      Math.abs(n.position[1] - node.position[1]) < 150
    );
    
    // Check if any node is to the right of this one
    const hasNodeToRight = sameBranchNodes.some((n: any) => 
      n.id !== node.id && n.position[0] > node.position[0] + 50
    );
    
    return !hasNodeToRight;
  }
  
  private validateNodeParameters(node: any, warnings: any[]): void {
    switch (node.type) {
      case 'n8n-nodes-base.webhook':
        if (!node.parameters?.path) {
          warnings.push({
            message: `Webhook node "${node.name}" missing path parameter`,
            nodeId: node.id,
            type: 'missing-parameter'
          });
        }
        break;
        
      case 'n8n-nodes-base.emailSend':
        if (!node.parameters?.toEmail) {
          warnings.push({
            message: `Email node "${node.name}" missing recipient`,
            nodeId: node.id,
            type: 'missing-parameter'
          });
        }
        break;
        
      case 'n8n-nodes-base.postgres':
        if (node.parameters?.operation === 'executeQuery' && !node.parameters?.query) {
          warnings.push({
            message: `Database node "${node.name}" missing query`,
            nodeId: node.id,
            type: 'missing-parameter'
          });
        }
        break;
        
      case 'n8n-nodes-base.httpRequest':
        if (!node.parameters?.url) {
          warnings.push({
            message: `HTTP Request node "${node.name}" missing URL`,
            nodeId: node.id,
            type: 'missing-parameter'
          });
        }
        break;
    }
  }
}