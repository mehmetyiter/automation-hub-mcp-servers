import { WorkflowValidationService } from './dist/services/workflow-validation-service.js';
import { readFile } from 'fs/promises';

async function testWorkflowValidation() {
  console.log('=== Testing Workflow Validation Service ===\n');
  
  const validationService = new WorkflowValidationService();
  
  // Test with the IoT workflow
  console.log('1. Testing IoT Workflow (Automating Irrigation and Climate Control)\n');
  
  try {
    const iotWorkflow = JSON.parse(
      await readFile('/home/mehmet/Documents/n8nMCP/Automating Irrigation and Climate Control.json', 'utf-8')
    );
    
    const result = await validationService.validateWorkflow(iotWorkflow);
    
    console.log('Validation Result:');
    console.log('- Is Valid:', result.isValid);
    console.log('- Node Issues:', result.nodeIssues.length);
    console.log('- Workflow Issues:', result.workflowIssues.length);
    console.log('- Improvements:', result.improvements.length);
    console.log('- Missing Capabilities:', result.missingCapabilities.length);
    
    // Generate and display the report
    const report = validationService.generateValidationReport(result);
    console.log('\n--- Validation Report ---\n');
    console.log(report);
    
    // Show the corrected workflow snippet
    if (result.nodeIssues.length > 0) {
      console.log('\n--- Node Type Corrections Applied ---');
      result.nodeIssues.forEach(issue => {
        console.log(`- ${issue.node.name}: ${issue.node.type}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing IoT workflow:', error);
  }
  
  // Test with the order management workflow
  console.log('\n\n2. Testing Order Management Workflow\n');
  
  try {
    const orderWorkflow = JSON.parse(
      await readFile('/home/mehmet/Documents/n8nMCP/Process Management from Customer Order to Post-Delivery.json', 'utf-8')
    );
    
    const result = await validationService.validateWorkflow(orderWorkflow);
    
    console.log('Validation Result:');
    console.log('- Is Valid:', result.isValid);
    console.log('- Node Issues:', result.nodeIssues.length);
    console.log('- Workflow Issues:', result.workflowIssues.length);
    console.log('- Improvements:', result.improvements.length);
    console.log('- Missing Capabilities:', result.missingCapabilities.length);
    
    // Generate and display the report
    const report = validationService.generateValidationReport(result);
    console.log('\n--- Validation Report ---\n');
    console.log(report);
    
  } catch (error) {
    console.error('Error testing order workflow:', error);
  }
}

// Run the test
testWorkflowValidation().catch(console.error);