// test-quick-implementation.ts

import { AIWorkflowGeneratorV2 } from './ai-workflow-generator-v2.js';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  // Get API key from environment or use a test key
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No API key found. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    process.exit(1);
  }
  
  const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
  console.log(`Using ${provider} provider\n`);
  
  const generator = new AIWorkflowGeneratorV2({
    apiKey,
    provider: provider as any,
    model: provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4',
    maxTokens: 4000
  });
  
  const testPrompts = [
    {
      name: 'Simple Webhook Email',
      prompt: 'Create a webhook that validates data and sends email notification'
    },
    {
      name: 'Scheduled Data Processing',
      prompt: 'Create a scheduled workflow that runs daily, fetches data from API, processes it, and saves to database'
    },
    {
      name: 'Complex Notification System',
      prompt: 'Create a complex notification workflow with webhook trigger, data validation, fetch patient preferences from API, smart channel selection based on preferences, send via Email (SendGrid), SMS (Twilio), Push (HTTP), analyze delivery results, and return webhook response'
    }
  ];
  
  for (const test of testPrompts) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${test.name}`);
    console.log(`Prompt: ${test.prompt}`);
    console.log('='.repeat(60));
    
    try {
      const startTime = Date.now();
      const result = await generator.generateFromPrompt(test.prompt, test.name);
      const duration = Date.now() - startTime;
      
      if (result.success && result.workflow) {
        const workflow = result.workflow;
        
        console.log(`\n✅ SUCCESS - Generated in ${duration}ms`);
        console.log(`📊 Workflow Stats:`);
        console.log(`   - Nodes: ${workflow.nodes.length}`);
        console.log(`   - Connections: ${Object.keys(workflow.connections || {}).length}`);
        console.log(`   - Branches: ${workflow.nodes.filter((n: any) => n.type.includes('trigger')).length}`);
        
        // Check for disconnected nodes
        const disconnectedNodes = workflow.nodes.filter((n: any) => {
          const isTrigger = n.type.includes('trigger') || n.type.includes('webhook');
          const hasIncoming = Object.values(workflow.connections || {}).some((conns: any) => 
            conns.main?.some((output: any[]) => output.some((conn: any) => conn.node === n.id))
          );
          return !isTrigger && !hasIncoming;
        });
        
        console.log(`   - Disconnected nodes: ${disconnectedNodes.length}`);
        
        if (disconnectedNodes.length > 0) {
          console.log(`\n⚠️  Disconnected nodes found:`);
          disconnectedNodes.forEach((node: any) => {
            console.log(`   - ${node.name} (${node.id})`);
          });
        } else {
          console.log(`   ✅ All nodes properly connected!`);
        }
        
        // List all nodes
        console.log(`\n📋 Generated Nodes:`);
        workflow.nodes.forEach((node: any, index: number) => {
          console.log(`   ${index + 1}. ${node.name} (${node.type})`);
        });
        
        // Save workflow to file
        const filename = `test-output-${test.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        fs.writeFileSync(
          path.join(process.cwd(), filename),
          JSON.stringify(workflow, null, 2)
        );
        console.log(`\n💾 Workflow saved to: ${filename}`);
        
      } else {
        console.error(`\n❌ FAILED: ${result.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`\n❌ ERROR: ${error}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
}

// Run the test
test().catch(console.error);