import { AIWorkflowGenerator } from './dist/ai-workflow-generator.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testFullIntegration() {
  console.log('=== Testing Full AI Workflow Generation with Validation ===\n');
  
  const generator = new AIWorkflowGenerator({
    apiKey: process.env.ANTHROPIC_API_KEY,
    provider: 'anthropic'
  });
  
  // Test prompt - IoT automation
  const iotPrompt = `Create an IoT greenhouse automation workflow:
  - MQTT sensor data (temperature, humidity, soil moisture)
  - Weather API integration for forecast
  - Control irrigation with GPIO pins based on conditions
  - Send WhatsApp alerts when intervention needed
  - Log all data to time series database
  - Daily report generation with graphs`;
  
  try {
    console.log('Generating IoT workflow...\n');
    const result = await generator.generateFromPrompt(iotPrompt, 'Smart Greenhouse Automation');
    
    if (result.success) {
      console.log('✅ Workflow generated successfully!\n');
      
      // Show mapper analysis
      if (result.mapperAnalysis) {
        console.log('--- Mapper Analysis ---');
        console.log('Features:', result.mapperAnalysis.features);
        console.log('Suggested Nodes:', result.mapperAnalysis.suggestedNodes);
        console.log('Tasks:', result.mapperAnalysis.tasks.length);
      }
      
      // Show validation results
      if (result.workflowValidation) {
        console.log('\n--- Workflow Validation ---');
        console.log('Valid:', result.workflowValidation.isValid);
        console.log('Node Issues:', result.workflowValidation.nodeIssues.length);
        console.log('Workflow Issues:', result.workflowValidation.workflowIssues.length);
        console.log('Improvements:', result.workflowValidation.improvements.length);
        
        // Show corrected node types
        if (result.workflowValidation.nodeIssues.length > 0) {
          console.log('\n--- Corrected Node Types ---');
          result.workflowValidation.nodeIssues.forEach(issue => {
            console.log(`- ${issue.node.name}: ${issue.node.type}`);
          });
        }
      }
      
      // Show validation report
      if (result.validationReport) {
        console.log('\n--- Validation Report ---');
        console.log(result.validationReport);
      }
      
      // Save the workflow
      const fs = await import('fs/promises');
      const filename = 'test-iot-workflow-validated.json';
      await fs.writeFile(
        filename, 
        JSON.stringify(result.workflow, null, 2)
      );
      console.log(`\n✅ Workflow saved to ${filename}`);
      
    } else {
      console.log('❌ Workflow generation failed:', result.error);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testFullIntegration().catch(console.error);