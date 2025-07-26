// workflow-generation/quick-validator.ts

import { cleanWorkflow } from '../utils/json-cleaner.js';

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
    
    // Handle circular references using the cleanWorkflow utility
    const fixedWorkflow = cleanWorkflow(workflow);
    let fixCount = 0;
    
    // Ensure connections object exists
    if (!fixedWorkflow.connections) {
      fixedWorkflow.connections = {};
    }
    
    // First, fix switch nodes and add merge nodes where needed
    const mergeFixResult = this.fixSwitchNodesAndAddMerges(fixedWorkflow);
    fixedWorkflow.nodes = mergeFixResult.nodes;
    fixedWorkflow.connections = mergeFixResult.connections;
    fixCount += mergeFixResult.fixCount;
    
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
  
  private fixSwitchNodesAndAddMerges(workflow: any): { nodes: any[], connections: any, fixCount: number } {
    console.log('Checking for switch nodes that need merge nodes...');
    
    let fixCount = 0;
    const nodes = [...workflow.nodes];
    const connections = { ...workflow.connections };
    
    // Find all switch nodes
    const switchNodes = nodes.filter(n => n.type === 'n8n-nodes-base.switch');
    
    for (const switchNode of switchNodes) {
      const switchName = switchNode.name || switchNode.id;
      
      // Collect all target nodes from all outputs
      const allTargets: Set<string> = new Set();
      const branchEndNodes: string[] = [];
      
      // Check if switch has any connections at all
      if (!connections[switchName]?.main || connections[switchName].main.length === 0) {
        console.log(`  Switch "${switchName}" has no connections at all!`);
        
        // This is a validation error - switches MUST have connections
        // We'll report this as an issue rather than creating dummy nodes
        console.log(`  ERROR: Switch node "${switchName}" has no output connections defined`);
        
        // Skip this switch - the AI should have provided proper connections
        continue;
      } else {
        connections[switchName].main.forEach((output: any[], outputIndex: number) => {
          if (output && output.length > 0) {
            // Find the end node of this branch
            const branchEndNode = this.findBranchEndNode(output[0].node, connections, nodes);
            if (branchEndNode && !branchEndNodes.includes(branchEndNode)) {
              branchEndNodes.push(branchEndNode);
            }
          } else {
            // Empty output - this is a validation error
            console.log(`  WARNING: Switch "${switchName}" output ${outputIndex} has no connections`);
            // Don't create dummy nodes - the AI should provide proper connections
          }
        });
      }
      
      // Check if branches need merging - only if they don't have terminal nodes
      const nonTerminalBranches = branchEndNodes.filter(nodeName => {
        const node = nodes.find(n => n.name === nodeName || n.id === nodeName);
        return node && !this.isTerminalNode(node) && !this.isBranchComplete(node, nodes);
      });
      
      if (nonTerminalBranches.length > 1) {
        console.log(`  Switch "${switchName}" has ${nonTerminalBranches.length} incomplete branches that need merging`);
        
        // Only merge branches that don't have proper conclusions
        // Find rightmost position for merge node
        let maxX = switchNode.position[0];
        let avgY = switchNode.position[1];
        
        nonTerminalBranches.forEach(nodeName => {
          const node = nodes.find(n => n.name === nodeName || n.id === nodeName);
          if (node) {
            maxX = Math.max(maxX, node.position[0]);
          }
        });
        
        // Create merge node
        const mergeNodeId = `merge_${switchNode.id || Date.now()}`;
        const mergeNode = {
          id: mergeNodeId,
          name: `Merge ${switchNode.name} Results`,
          type: 'n8n-nodes-base.merge',
          typeVersion: 2,
          position: [maxX + 200, avgY],
          parameters: {
            mode: 'chooseBranch',
            options: {}
          }
        };
        
        nodes.push(mergeNode);
        console.log(`  Added merge node: ${mergeNode.name}`);
        
        // Connect only non-terminal branch ends to merge node
        nonTerminalBranches.forEach((endNodeName, index) => {
          if (!connections[endNodeName]) {
            connections[endNodeName] = { main: [[]] };
          }
          
          connections[endNodeName].main[0].push({
            node: mergeNode.name,
            type: 'main',
            index: 0
          });
          
          console.log(`  Connected ${endNodeName} -> ${mergeNode.name}`);
        });
        
        fixCount++;
      } else if (branchEndNodes.length > 1) {
        console.log(`  Switch "${switchName}" has ${branchEndNodes.length} branches but they appear to be properly terminated`);
      }
    }
    
    // Report dead-end nodes as validation issues instead of auto-fixing
    const deadEndNodes = this.findDeadEndNodes(nodes, connections);
    for (const deadEnd of deadEndNodes) {
      // Skip if it's a response node or error handler
      if (deadEnd.type.includes('respondToWebhook') || 
          deadEnd.type.includes('errorTrigger') ||
          deadEnd.name.toLowerCase().includes('error') ||
          deadEnd.name.toLowerCase().includes('response')) {
        continue;
      }
      
      console.log(`  ERROR: Found dead-end node: ${deadEnd.name} (${deadEnd.type})`);
      console.log(`    This node has no logical conclusion and should be properly connected by the AI`);
      
      // Don't auto-fix - this is an AI generation error that needs proper solution
      // Each branch should have a meaningful conclusion, not arbitrary connections
    }
    
    return { nodes, connections, fixCount };
  }
  
  private findBranchEndNode(startNode: string, connections: any, nodes: any[]): string | null {
    // Follow the branch to find its end
    let currentNode = startNode;
    let visited = new Set<string>();
    
    while (currentNode) {
      if (visited.has(currentNode)) {
        // This is a loop - check if it's an intentional loop node
        const node = nodes.find(n => n.name === currentNode || n.id === currentNode);
        if (node && this.isLoopNode(node)) {
          console.log(`    Found intentional loop at ${currentNode}`);
          return null; // Loop nodes handle their own flow
        }
        break; // Avoid infinite loops in other cases
      }
      visited.add(currentNode);
      
      // Check if this node has outgoing connections
      if (!connections[currentNode]?.main?.[0]?.length) {
        return currentNode; // This is the end
      }
      
      // Follow the first connection
      const nextNode = connections[currentNode].main[0][0]?.node;
      if (!nextNode) {
        return currentNode;
      }
      
      currentNode = nextNode;
    }
    
    return null;
  }
  
  private isLoopNode(node: any): boolean {
    const loopNodeTypes = [
      'splitInBatches',
      'loop',
      'executeWorkflow'
    ];
    
    return loopNodeTypes.some(type => node.type.includes(type));
  }
  
  private findDeadEndNodes(nodes: any[], connections: any): any[] {
    const deadEnds: any[] = [];
    
    for (const node of nodes) {
      const nodeName = node.name || node.id;
      
      // Check if node has outgoing connections
      if (!connections[nodeName]?.main?.[0]?.length) {
        // Check if it's a terminal node type
        if (!this.isTerminalNode(node)) {
          deadEnds.push(node);
        }
      }
    }
    
    return deadEnds;
  }
  
  private isTerminalNode(node: any): boolean {
    const terminalTypes = [
      'respondToWebhook',
      'errorTrigger',
      'noOp'
    ];
    
    return terminalTypes.some(type => node.type.includes(type)) ||
           node.name.toLowerCase().includes('response') ||
           node.name.toLowerCase().includes('error handler');
  }
  
  private isBranchComplete(node: any, allNodes: any[]): boolean {
    // A branch is complete if it ends with:
    // 1. A database save/update operation
    // 2. An email/notification send
    // 3. An HTTP request that saves/updates data
    // 4. A webhook response
    // 5. Any operation that represents a logical conclusion
    
    const completionIndicators = [
      // Database operations
      'postgres', 'mysql', 'mongodb', 'redis',
      // Communication operations
      'emailSend', 'slack', 'telegram', 'twilio',
      // File operations
      'writeBinaryFile', 'spreadsheetFile',
      // Integration operations that typically conclude a flow
      'googleSheets', 'airtable', 'notion'
    ];
    
    // Check node type
    if (completionIndicators.some(indicator => node.type.includes(indicator))) {
      return true;
    }
    
    // Check node name for completion indicators
    const nameIndicators = [
      'save', 'store', 'update', 'send', 'notify', 
      'complete', 'finish', 'done', 'final', 'end',
      'log', 'record', 'report', 'alert'
    ];
    
    const nodeName = node.name.toLowerCase();
    return nameIndicators.some(indicator => nodeName.includes(indicator));
  }
  
  private findNearestDownstreamNode(node: any, allNodes: any[], connections: any): any | null {
    // Find a node that's to the right and on a similar Y level
    const candidates = allNodes.filter(n => {
      if (n.id === node.id) return false;
      if (n.position[0] <= node.position[0]) return false; // Must be to the right
      if (Math.abs(n.position[1] - node.position[1]) > 200) return false; // Similar Y level
      
      // Don't connect to trigger nodes
      if (n.type.includes('trigger') || n.type.includes('Trigger')) return false;
      
      return true;
    });
    
    if (candidates.length === 0) return null;
    
    // Sort by distance and return closest
    candidates.sort((a, b) => {
      const distA = Math.abs(a.position[0] - node.position[0]) + Math.abs(a.position[1] - node.position[1]);
      const distB = Math.abs(b.position[0] - node.position[0]) + Math.abs(b.position[1] - node.position[1]);
      return distA - distB;
    });
    
    return candidates[0];
  }
}