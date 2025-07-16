import { PromptToWorkflowMapper } from './dist/planning/prompt-to-workflow-mapper.js';

// Mock workflow generator that uses mapper insights
class MockWorkflowGenerator {
  constructor() {
    this.mapper = new PromptToWorkflowMapper();
  }
  
  async generateWorkflow(prompt, name) {
    // Analyze with mapper
    const analysis = await this.mapper.analyzePrompt(prompt);
    
    // Create nodes based on mapper suggestions
    const nodes = [];
    let nodeId = 1;
    let xPos = 100;
    const yBase = 300;
    
    // Add trigger node based on analysis
    if (analysis.features.has('Scheduling')) {
      nodes.push({
        id: `node_${nodeId++}`,
        name: 'Daily Schedule',
        type: 'n8n-nodes-base.cron',
        typeVersion: 1,
        position: [xPos, yBase],
        parameters: {
          cronTimes: { item: [{ mode: 'everyDay', hour: 9 }] }
        }
      });
      xPos += 200;
    } else if (analysis.features.has('Real-time Processing')) {
      nodes.push({
        id: `node_${nodeId++}`,
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1.1,
        position: [xPos, yBase],
        parameters: { path: 'trigger', method: 'POST' }
      });
      xPos += 200;
    } else {
      nodes.push({
        id: `node_${nodeId++}`,
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [xPos, yBase],
        parameters: {}
      });
      xPos += 200;
    }
    
    // Add nodes for each task
    analysis.tasks.slice(1, -1).forEach((task, index) => {
      const mainNode = task.requiredNodes[0];
      const nodeType = this.getNodeType(mainNode);
      
      nodes.push({
        id: `node_${nodeId++}`,
        name: task.description.split(' ').slice(0, 3).join(' '),
        type: nodeType,
        typeVersion: 1,
        position: [xPos, yBase + (index % 2 ? 100 : -100)],
        parameters: this.getNodeParameters(nodeType)
      });
      xPos += 200;
    });
    
    // Add error handler
    nodes.push({
      id: `node_${nodeId++}`,
      name: 'Error Handler',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [xPos, yBase + 200],
      parameters: {}
    });
    
    // Create linear connections
    const connections = {};
    for (let i = 0; i < nodes.length - 2; i++) {
      connections[nodes[i].name] = {
        main: [[{
          node: nodes[i + 1].name,
          type: 'main',
          index: 0
        }]]
      };
    }
    
    return {
      success: true,
      workflow: {
        name,
        nodes,
        connections,
        settings: { executionOrder: 'v1' }
      },
      mapperAnalysis: analysis,
      mockGenerated: true
    };
  }
  
  getNodeType(nodeName) {
    const typeMap = {
      'Cron': 'n8n-nodes-base.cron',
      'Webhook': 'n8n-nodes-base.webhook',
      'HTTP Request': 'n8n-nodes-base.httpRequest',
      'Function': 'n8n-nodes-base.code',
      'Database': 'n8n-nodes-base.postgres',
      'Send Email': 'n8n-nodes-base.emailSend',
      'IF': 'n8n-nodes-base.if',
      'Switch': 'n8n-nodes-base.switch',
      'Set': 'n8n-nodes-base.set',
      'Error Trigger': 'n8n-nodes-base.errorTrigger'
    };
    
    for (const [key, value] of Object.entries(typeMap)) {
      if (nodeName.includes(key)) return value;
    }
    
    return 'n8n-nodes-base.code'; // Default to code node
  }
  
  getNodeParameters(nodeType) {
    const defaults = {
      'n8n-nodes-base.httpRequest': { method: 'GET', url: 'https://api.example.com' },
      'n8n-nodes-base.code': { language: 'javaScript', jsCode: '// Process items\nreturn items;' },
      'n8n-nodes-base.emailSend': { fromEmail: 'noreply@example.com', subject: 'Notification' },
      'n8n-nodes-base.if': { conditions: { conditions: [] } },
      'n8n-nodes-base.set': { mode: 'manual', values: { values: [] } }
    };
    
    return defaults[nodeType] || {};
  }
}

// Test the mock generator
async function testMockGeneration() {
  console.log('=== Testing Mapper Integration with Mock Generator ===\n');
  
  const generator = new MockWorkflowGenerator();
  
  const testPrompt = `Create a YouTube comment moderation system that:
- Monitors new comments on my videos
- Uses NLP to detect spam and inappropriate content
- Automatically hides spam comments
- Sends daily reports via email
- Stores moderation history in database`;
  
  const result = await generator.generateWorkflow(testPrompt, 'YouTube Moderation');
  
  if (result.success) {
    console.log('✅ Mock workflow generated successfully!\n');
    
    const workflow = result.workflow;
    console.log('Workflow Structure:');
    console.log(`- Name: ${workflow.name}`);
    console.log(`- Nodes: ${workflow.nodes.length}`);
    console.log(`- Node Types:`);
    workflow.nodes.forEach(node => {
      console.log(`  - ${node.name} (${node.type})`);
    });
    
    console.log(`\n- Connections: ${Object.keys(workflow.connections).length}`);
    
    // Verify all nodes are connected
    const connectedNodes = new Set();
    Object.entries(workflow.connections).forEach(([source, targets]) => {
      connectedNodes.add(source);
      targets.main[0].forEach(target => connectedNodes.add(target.node));
    });
    
    const disconnected = workflow.nodes.filter(n => !connectedNodes.has(n.name));
    
    if (disconnected.length === 0) {
      console.log('\n✅ All nodes properly connected!');
    } else {
      console.log(`\n⚠️ ${disconnected.length} disconnected nodes:`, disconnected.map(n => n.name));
    }
    
    console.log('\n=== Mapper Analysis Used ===');
    console.log('Features:', Array.from(result.mapperAnalysis.features.keys()).join(', '));
    console.log('Tasks:', result.mapperAnalysis.tasks.length);
    console.log('Suggested Nodes:', result.mapperAnalysis.suggestedNodes.length);
    console.log('Validation Items:', result.mapperAnalysis.validationChecklist.length);
  }
}

testMockGeneration().catch(console.error);