// workflow-generation/quick-builder.ts

import { NodeParameterHandler } from './node-parameter-handler.js';

export class QuickWorkflowBuilder {
  private nodeParameterHandler: NodeParameterHandler;
  private nodeSpacing = {
    horizontal: 200,
    vertical: 200
  };
  
  constructor() {
    this.nodeParameterHandler = new NodeParameterHandler();
  }
  
  build(parsed: any): any {
    console.log('QuickWorkflowBuilder: Starting to build workflow...');
    
    const workflow = {
      name: parsed.workflowName,
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
    
    let nodeIdCounter = 1;
    let baseY = 300;
    
    // Process each branch
    parsed.branches.forEach((branch: any, branchIndex: number) => {
      console.log(`Building branch ${branchIndex + 1}: ${branch.name}`);
      
      const branchY = baseY + (branchIndex * this.nodeSpacing.vertical);
      let xPos = 250;
      
      // Create trigger node based on branch trigger type
      const triggerId = nodeIdCounter++;
      const triggerNode = this.createTriggerNode(triggerId.toString(), branch.triggerType, [xPos, branchY]);
      workflow.nodes.push(triggerNode);
      console.log(`  Added trigger: ${triggerNode.name} (${triggerNode.type})`);
      
      let previousNodeId = triggerId.toString();
      xPos += this.nodeSpacing.horizontal;
      
      // Add all nodes from the branch
      branch.nodes.forEach((node: any, nodeIndex: number) => {
        const currentId = nodeIdCounter++;
        const workflowNode = {
          id: currentId.toString(),
          name: node.name,
          type: node.type,
          typeVersion: 1,
          position: [xPos, branchY],
          parameters: this.getDefaultParameters(node.type, node)
        };
        
        workflow.nodes.push(workflowNode);
        console.log(`  Added node: ${node.name} (${node.type})`);
        
        // Connect to previous node
        if (!workflow.connections[previousNodeId]) {
          workflow.connections[previousNodeId] = { main: [[]] };
        }
        workflow.connections[previousNodeId].main[0].push({
          node: currentId.toString(),
          type: 'main',
          index: 0
        });
        
        previousNodeId = currentId.toString();
        xPos += this.nodeSpacing.horizontal;
      });
      
      // If the last node isn't a response node and this is a webhook branch, add one
      if (branch.triggerType === 'webhook' && 
          branch.nodes.length > 0 && 
          !branch.nodes[branch.nodes.length - 1].type.includes('respondToWebhook')) {
        
        const responseId = nodeIdCounter++;
        const responseNode = {
          id: responseId.toString(),
          name: 'Respond to Webhook',
          type: 'n8n-nodes-base.respondToWebhook',
          typeVersion: 1,
          position: [xPos, branchY],
          parameters: {
            options: {}
          }
        };
        
        workflow.nodes.push(responseNode);
        console.log(`  Added response node for webhook branch`);
        
        // Connect to response node
        if (!workflow.connections[previousNodeId]) {
          workflow.connections[previousNodeId] = { main: [[]] };
        }
        workflow.connections[previousNodeId].main[0].push({
          node: responseId.toString(),
          type: 'main',
          index: 0
        });
      }
    });
    
    console.log(`Total nodes created: ${workflow.nodes.length}`);
    console.log(`Total connections: ${Object.keys(workflow.connections).length}`);
    
    return workflow;
  }
  
  private createTriggerNode(id: string, triggerType: string, position: [number, number]): any {
    const baseNode = {
      id,
      position,
      typeVersion: 1
    };
    
    if (triggerType.includes('webhook')) {
      return {
        ...baseNode,
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        parameters: { 
          path: '/webhook',
          authentication: 'none',
          options: {}
        },
        webhookId: this.generateWebhookId()
      };
    } else if (triggerType.includes('schedule') || triggerType.includes('cron')) {
      return {
        ...baseNode,
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        parameters: { 
          rule: {
            interval: [{ field: 'hours', hoursInterval: 1 }]
          }
        }
      };
    } else if (triggerType.includes('error')) {
      return {
        ...baseNode,
        name: 'Error Trigger',
        type: 'n8n-nodes-base.errorTrigger',
        parameters: {}
      };
    } else {
      // Default to manual trigger
      return {
        ...baseNode,
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        parameters: {}
      };
    }
  }
  
  getDefaultParameters(nodeType: string, nodeInfo: any): any {
    // First check if we have enhanced support for this node type
    if (this.nodeParameterHandler.hasEnhancedSupport(nodeType)) {
      // Create a temporary node object for context
      const tempNode = {
        id: '1',
        type: nodeType,
        name: nodeInfo.name || '',
        typeVersion: 1,
        position: [0, 0] as [number, number],
        parameters: {}
      };
      
      // Get intelligent parameters based on context
      const intelligentParams = this.nodeParameterHandler.getIntelligentParameters(tempNode);
      if (Object.keys(intelligentParams).length > 0) {
        console.log(`  Using intelligent parameters for ${nodeType}:`, intelligentParams);
        return intelligentParams;
      }
    }
    
    // Fall back to traditional switch-based defaults
    switch (nodeType) {
      case 'n8n-nodes-base.webhook':
        return { 
          path: '/webhook',
          authentication: 'none',
          options: {}
        };
        
      case 'n8n-nodes-base.code':
        return {
          jsCode: this.generateCodeForNode(nodeInfo.name)
        };
        
      case 'n8n-nodes-base.emailSend':
        return {
          toEmail: '={{$json.email}}',
          subject: 'Notification',
          text: '={{$json.message}}',
          options: {}
        };
        
      case 'n8n-nodes-base.twilio':
        return {
          operation: 'sms',
          from: '={{$credentials.fromNumber}}',
          to: '={{$json.phone}}',
          message: '={{$json.message}}',
          options: {}
        };
        
      case 'n8n-nodes-base.postgres':
        return {
          operation: 'executeQuery',
          query: 'SELECT * FROM table_name WHERE id = {{$json.id}}',
          additionalFields: {}
        };
        
      case 'n8n-nodes-base.httpRequest':
        return {
          url: 'https://api.example.com/endpoint',
          method: 'GET',
          options: {}
        };
        
      case 'n8n-nodes-base.if':
        return {
          conditions: {
            boolean: [
              {
                value1: '={{$json.value}}',
                value2: true
              }
            ]
          }
        };
        
      case 'n8n-nodes-base.merge':
        return {
          mode: 'append'
        };
        
      case 'n8n-nodes-base.respondToWebhook':
        return {
          options: {}
        };
        
      default:
        return {};
    }
  }
  
  private generateCodeForNode(nodeName: string): string {
    const lowerName = nodeName.toLowerCase();
    
    if (lowerName.includes('validate')) {
      return `// Validation logic for ${nodeName}
const requiredFields = ['field1', 'field2']; // Update with actual required fields
const item = items[0];

for (const field of requiredFields) {
  if (!item.json[field]) {
    throw new Error(\`Missing required field: \${field}\`);
  }
}

// Additional validation logic here

return items;`;
    }
    
    if (lowerName.includes('transform') || lowerName.includes('process')) {
      return `// Transform data for ${nodeName}
return items.map(item => {
  return {
    json: {
      ...item.json,
      // Add transformations here
      processed: true,
      timestamp: new Date().toISOString()
    }
  };
});`;
    }
    
    if (lowerName.includes('filter')) {
      return `// Filter logic for ${nodeName}
return items.filter(item => {
  // Add your filter condition here
  return item.json.status === 'active';
});`;
    }
    
    if (lowerName.includes('analyze')) {
      return `// Analysis logic for ${nodeName}
const results = items.map(item => {
  // Perform analysis
  return {
    ...item.json,
    analysis: {
      // Add analysis results
    }
  };
});

return [{
  json: {
    results,
    summary: {
      total: results.length,
      timestamp: new Date().toISOString()
    }
  }
}];`;
    }
    
    // Default code
    return `// ${nodeName} logic
// Add your custom logic here

return items;`;
  }
  
  // Utility methods
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
  
  generateWebhookId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}