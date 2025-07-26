#!/usr/bin/env ts-node

/**
 * Test script for node parameter validation
 * Run with: npx ts-node src/utils/test-node-parameters.ts
 */

import { NodeParametersRegistry } from './node-parameters-registry';

// Test cases for different node types
const testNodes = [
  // Email Send with string recipients (should be fixed to array)
  {
    type: 'n8n-nodes-base.emailSend',
    parameters: {
      toRecipients: 'admin@example.com',
      subject: 'Test Email',
      text: 'This is a test'
    }
  },
  
  // HTTP Request with object headers (should be fixed to array)
  {
    type: 'n8n-nodes-base.httpRequest',
    parameters: {
      method: 'POST',
      url: 'https://api.example.com',
      headerParameters: {
        parameters: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token'
        }
      }
    }
  },
  
  // Code node without language (should add default)
  {
    type: 'n8n-nodes-base.code',
    parameters: {
      code: 'return items;'
    }
  },
  
  // MongoDB with string documentId (should be fixed to object)
  {
    type: 'n8n-nodes-base.mongoDb',
    parameters: {
      operation: 'find',
      documentId: '{{$json.id}}'
    }
  },
  
  // Switch without mode (should add default)
  {
    type: 'n8n-nodes-base.switch',
    parameters: {
      conditions: []
    }
  },
  
  // Set node with non-array values
  {
    type: 'n8n-nodes-base.set',
    parameters: {
      values: {
        values: 'not an array'
      }
    }
  }
];

console.log('Testing Node Parameter Registry...\n');

testNodes.forEach((node, index) => {
  console.log(`Test ${index + 1}: ${node.type}`);
  console.log('Before:', JSON.stringify(node.parameters, null, 2));
  
  const fixed = NodeParametersRegistry.validateAndFixNode(node);
  console.log('After:', JSON.stringify(fixed.parameters, null, 2));
  console.log('---\n');
});

// Test documentation summary
console.log('Registered Node Types:', NodeParametersRegistry.getRegisteredNodeTypes().length);
console.log('\nSample Documentation Summary:');
const summary = NodeParametersRegistry.getDocumentationSummary();
const sampleNodes = ['n8n-nodes-base.emailSend', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.code'];
sampleNodes.forEach(nodeType => {
  if (summary[nodeType]) {
    console.log(`\n${nodeType}:`);
    summary[nodeType].forEach(param => {
      console.log(`  - ${param.parameter} (${param.type})${param.required ? ' *required' : ''}: ${param.description}`);
    });
  }
});