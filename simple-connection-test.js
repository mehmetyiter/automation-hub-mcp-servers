#!/usr/bin/env node

// Simple test to verify connection logic
const testWorkflow = {
  name: "Test Workflow",
  nodes: [
    {
      id: "1",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      position: [100, 200]
    },
    {
      id: "2", 
      name: "Process Data",
      type: "n8n-nodes-base.code",
      position: [300, 200]
    },
    {
      id: "3",
      name: "Send Response",
      type: "n8n-nodes-base.respondToWebhook",
      position: [500, 200]
    }
  ],
  connections: {}
};

// Create sequential connections
function createSequentialConnections(workflow) {
  const fixed = JSON.parse(JSON.stringify(workflow));
  
  // Sort nodes by position
  const sortedNodes = [...fixed.nodes].sort((a, b) => a.position[0] - b.position[0]);
  
  // Create connections
  for (let i = 0; i < sortedNodes.length - 1; i++) {
    const current = sortedNodes[i];
    const next = sortedNodes[i + 1];
    
    fixed.connections[current.name] = {
      main: [[{
        node: next.name,
        type: 'main',
        index: 0
      }]]
    };
  }
  
  return fixed;
}

console.log('Before fixing:');
console.log('Connections:', JSON.stringify(testWorkflow.connections, null, 2));

const fixed = createSequentialConnections(testWorkflow);

console.log('\nAfter fixing:');
console.log('Connections:', JSON.stringify(fixed.connections, null, 2));

// Test if it looks correct
const hasConnections = Object.keys(fixed.connections).length > 0;
console.log('\nConnection validation:', hasConnections ? 'PASS' : 'FAIL');
console.log('Expected connections: 2, Actual:', Object.keys(fixed.connections).length);