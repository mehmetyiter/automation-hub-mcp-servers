// Test script to demonstrate workflow generation guidelines
import { WorkflowGenerationGuidelines } from './dist/workflow-generation/workflow-generation-guidelines.js';

console.log('=== Workflow Generation Guidelines Test ===\n');

// Test 1: Analyze a workflow description
console.log('1. Analyzing workflow descriptions:\n');

const testDescriptions = [
  'Monitor sensors and merge all data for processing',
  'Check inventory, process payment, send notifications, merge all results',
  'Generate report by fetching data from APIs and merging them'
];

testDescriptions.forEach((desc, index) => {
  console.log(`Test ${index + 1}: "${desc}"`);
  const analysis = WorkflowGenerationGuidelines.analyzeWorkflowPlan(desc);
  console.log('Issues found:', analysis.issues);
  console.log('Suggestions:', analysis.suggestions);
  console.log('Improved:', analysis.improvedDescription);
  console.log('---\n');
});

// Test 2: Get guidelines for different workflow types
console.log('2. Guidelines for different workflow types:\n');

const workflowTypes = ['monitoring', 'alert', 'report', 'integration'];

workflowTypes.forEach(type => {
  console.log(`${type.toUpperCase()} Workflow Guidelines:`);
  const guidelines = WorkflowGenerationGuidelines.getGuidelinesForWorkflowType(type);
  guidelines.forEach(g => console.log(`  - ${g}`));
  console.log();
});

// Test 3: Generate node code with guidelines
console.log('3. Node code generation examples:\n');

const nodeExamples = [
  { name: 'Validate Customer Data', type: 'function' },
  { name: 'Transform Sales Report', type: 'function' },
  { name: 'Aggregate Sensor Readings', type: 'function' }
];

nodeExamples.forEach(node => {
  console.log(`Node: ${node.name}`);
  const code = WorkflowGenerationGuidelines.generateNodeCode(node.name, node.type);
  console.log('Generated code preview:');
  console.log(code.split('\n').slice(0, 10).join('\n') + '\n...');
  console.log('---\n');
});

// Test 4: Show core principles
console.log('4. Core Workflow Generation Principles:\n');
WorkflowGenerationGuidelines.CORE_PRINCIPLES.forEach((principle, index) => {
  console.log(`${index + 1}. ${principle}`);
});

console.log('\n=== Test Complete ===');