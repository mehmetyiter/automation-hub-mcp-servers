import { PromptToWorkflowMapper } from './src/planning/prompt-to-workflow-mapper.js';
import { AIWorkflowGenerator } from './src/ai-workflow-generator.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testMapperIntegration() {
  console.log('=== Testing PromptToWorkflowMapper Integration ===\n');
  
  // Test prompts
  const testCases = [
    {
      name: 'YouTube Comment Moderation',
      prompt: `Create a YouTube comment moderation system that:
- Monitors new comments on my videos
- Uses NLP to detect spam and inappropriate content
- Automatically hides spam comments
- Sends daily reports via email
- Stores moderation history in database`
    },
    {
      name: 'Library Book Tracking',
      prompt: `I want to track overdue book returns in my library. 
The system should check daily for overdue books, calculate late fees, 
and send WhatsApp reminders to borrowers.`
    }
  ];
  
  // Initialize mapper
  const mapper = new PromptToWorkflowMapper();
  
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---\n`);
    
    // Analyze with mapper
    const analysis = await mapper.analyzePrompt(testCase.prompt);
    
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
  
  // Test with AI workflow generator if API key is available
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    console.log('\n\n=== Testing Full AI Workflow Generation with Mapper ===\n');
    
    const generator = new AIWorkflowGenerator({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
      provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'
    });
    
    const testPrompt = testCases[0].prompt;
    const result = await generator.generateFromPrompt(testPrompt, 'YouTube Moderation Test');
    
    if (result.success) {
      console.log('✅ Workflow generated successfully!');
      console.log(`Nodes: ${result.workflow.nodes.length}`);
      console.log(`Connections: ${Object.keys(result.workflow.connections).length}`);
      
      if (result.validationResults) {
        console.log('\nValidation Results:');
        console.log(`  Passed: ${result.validationResults.passed.length}`);
        console.log(`  Failed: ${result.validationResults.failed.length}`);
        console.log(`  Warnings: ${result.validationResults.warnings.length}`);
        
        if (result.validationResults.failed.length > 0) {
          console.log('\n  Failed checks:');
          result.validationResults.failed.forEach((item: string) => 
            console.log(`    ❌ ${item}`)
          );
        }
      }
      
      // Check for disconnected nodes
      const connectedNodes = new Set<string>();
      Object.entries(result.workflow.connections).forEach(([source, targets]: [string, any]) => {
        connectedNodes.add(source);
        if (targets.main) {
          targets.main.forEach((targetGroup: any[]) => {
            targetGroup.forEach((target: any) => {
              connectedNodes.add(target.node);
            });
          });
        }
      });
      
      const disconnectedNodes = result.workflow.nodes.filter((node: any) => 
        !connectedNodes.has(node.name)
      );
      
      if (disconnectedNodes.length > 0) {
        console.log(`\n⚠️ Found ${disconnectedNodes.length} disconnected nodes:`);
        disconnectedNodes.forEach((node: any) => 
          console.log(`   - ${node.name} (${node.type})`)
        );
      } else {
        console.log('\n✅ All nodes are properly connected!');
      }
    } else {
      console.log('❌ Workflow generation failed:', result.error);
    }
  } else {
    console.log('\n⚠️ No API key found - skipping AI generation test');
  }
}

// Run the test
testMapperIntegration().catch(console.error);