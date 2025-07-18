const axios = require('axios');

async function testErrorHandlingGeneration() {
  const prompt = `Create a workflow for processing orders with:
  - Webhook trigger to receive orders
  - Stock validation via API
  - Payment processing (Stripe and PayPal in parallel)
  - Order fulfillment API call
  - Email notifications
  
  IMPORTANT: Add comprehensive error handling:
  - Error Trigger node for global error handling
  - Error notifications to admin
  - Retry logic for API failures
  - Fallback paths for payment failures`;
  
  try {
    const response = await axios.post('http://localhost:3000/api/generate-workflow', {
      prompt: prompt,
      name: 'Order Processing with Error Handling',
      provider: 'openai'
    });
    
    console.log('Response status:', response.status);
    console.log('Generated workflow:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Analyze what was generated
    if (response.data.workflow) {
      const workflow = response.data.workflow;
      const errorNodes = workflow.nodes.filter(n => n.type.includes('errorTrigger'));
      console.log('\nError handling nodes found:', errorNodes.length);
      console.log('Error nodes:', errorNodes);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testErrorHandlingGeneration();