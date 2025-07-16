import { AIWorkflowGenerator } from './dist/ai-workflow-generator.js';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testFullGeneration() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️ No API key found in environment variables');
    return;
  }

  const generator = new AIWorkflowGenerator({
    apiKey,
    provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'
  });

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

  for (const testCase of testCases) {
    console.log(`\n=== Testing: ${testCase.name} ===\n`);
    
    try {
      const result = await generator.generateFromPrompt(testCase.prompt, testCase.name);
      
      if (result.success) {
        console.log('✅ Workflow generated successfully!');
        
        const workflow = result.workflow;
        console.log(`\nWorkflow Details:`);
        console.log(`- Name: ${workflow.name}`);
        console.log(`- Nodes: ${workflow.nodes.length}`);
        console.log(`- Connections: ${Object.keys(workflow.connections).length}`);
        
        // Check for disconnected nodes
        const connectedNodes = new Set();
        Object.entries(workflow.connections).forEach(([source, targets]) => {
          connectedNodes.add(source);
          if (targets.main) {
            targets.main.forEach(targetGroup => {
              targetGroup.forEach(target => {
                connectedNodes.add(target.node);
              });
            });
          }
        });
        
        const disconnectedNodes = workflow.nodes.filter(node => 
          !connectedNodes.has(node.name)
        );
        
        if (disconnectedNodes.length > 0) {
          console.log(`\n⚠️ Found ${disconnectedNodes.length} disconnected nodes:`);
          disconnectedNodes.forEach(node => 
            console.log(`   - ${node.name} (${node.type})`)
          );
        } else {
          console.log('\n✅ All nodes are properly connected!');
        }
        
        // Show validation results
        if (result.validationResults) {
          console.log('\nValidation Results:');
          console.log(`- Passed: ${result.validationResults.passed.length} checks`);
          console.log(`- Failed: ${result.validationResults.failed.length} checks`);
          console.log(`- Warnings: ${result.validationResults.warnings.length} items`);
          
          if (result.validationResults.failed.length > 0) {
            console.log('\nFailed checks:');
            result.validationResults.failed.forEach(item => 
              console.log(`  ❌ ${item}`)
            );
          }
          
          if (result.validationResults.warnings.length > 0) {
            console.log('\nWarnings:');
            result.validationResults.warnings.forEach(item => 
              console.log(`  ⚠️ ${item}`)
            );
          }
        }
        
        // Save workflow to file for inspection
        const filename = `test-output-${testCase.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));
        console.log(`\n💾 Workflow saved to: ${filename}`);
        
      } else {
        console.log('❌ Workflow generation failed:', result.error);
      }
    } catch (error) {
      console.error('Error during generation:', error);
    }
  }
}

testFullGeneration().catch(console.error);