import { PromptToWorkflowMapper } from './dist/planning/prompt-to-workflow-mapper.js';

async function testMapper() {
  console.log('=== Testing PromptToWorkflowMapper ===\n');
  
  const mapper = new PromptToWorkflowMapper();
  
  const testPrompt = `Create a YouTube comment moderation system that:
- Monitors new comments on my videos
- Uses NLP to detect spam and inappropriate content
- Automatically hides spam comments
- Sends daily reports via email
- Stores moderation history in database`;
  
  console.log('Test Prompt:', testPrompt);
  console.log('\n--- Analysis Results ---\n');
  
  const analysis = await mapper.analyzePrompt(testPrompt);
  
  console.log('Features Identified:');
  for (const [feature, capabilities] of analysis.features) {
    console.log(`  ${feature}:`);
    capabilities.forEach(cap => console.log(`    - ${cap}`));
  }
  
  console.log('\nSuggested Nodes:', analysis.suggestedNodes.join(', '));
  
  console.log('\nWorkflow Tasks:');
  analysis.tasks.forEach((task, index) => {
    console.log(`  ${index + 1}. ${task.description}`);
    console.log(`     Required Nodes: ${task.requiredNodes.join(', ')}`);
  });
  
  console.log('\nValidation Checklist:');
  analysis.validationChecklist.forEach(item => console.log(`  ${item}`));
  
  if (analysis.missingCapabilities.length > 0) {
    console.log('\nMissing Capabilities:');
    analysis.missingCapabilities.forEach(item => console.log(`  ⚠️ ${item}`));
  }
  
  // Generate workflow plan
  const plan = mapper.createWorkflowPlan(analysis);
  console.log('\n=== Generated Workflow Plan ===');
  console.log(plan);
}

testMapper().catch(console.error);