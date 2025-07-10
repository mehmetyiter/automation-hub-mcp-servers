// Example of using the Dynamic Code Generator with multi-language support

import { DynamicCodeGenerator } from '../src/code-generation/dynamic-code-generator';
import { CodeGenerationRequest } from '../src/code-generation/types';

async function demonstrateMultiLanguageCodeGeneration() {
  const generator = new DynamicCodeGenerator();
  
  // Example 1: Generate JavaScript code for data transformation
  const jsRequest: CodeGenerationRequest = {
    description: 'Transform customer data by calculating total purchase amount and categorizing customers',
    nodeType: 'code',
    workflowContext: {
      workflowPurpose: 'Customer data analysis'
    },
    requirements: {
      language: 'javascript',
      performanceLevel: 'optimized',
      errorHandling: 'comprehensive'
    }
  };
  
  console.log('Generating JavaScript code...');
  const jsResult = await generator.generateCode(jsRequest);
  console.log('JavaScript Code Generated:');
  console.log(jsResult.code);
  console.log('\nMetadata:', jsResult.metadata);
  
  // Example 2: Generate Python code for data analysis
  const pyRequest: CodeGenerationRequest = {
    description: 'Analyze sales data to calculate monthly trends and identify top performing products',
    nodeType: 'code',
    workflowContext: {
      workflowPurpose: 'Sales analytics'
    },
    requirements: {
      language: 'python',
      performanceLevel: 'standard',
      errorHandling: 'comprehensive'
    }
  };
  
  console.log('\n\nGenerating Python code...');
  const pyResult = await generator.generateCode(pyRequest);
  console.log('Python Code Generated:');
  console.log(pyResult.code);
  console.log('\nValidation:', pyResult.validation);
  
  // Example 3: Code execution monitoring
  const codeId = await generator.generateCodeId(jsRequest);
  
  // Simulate code execution
  const executionContext = {
    $input: {
      all: () => [
        { json: { customer_id: 1, purchases: [100, 200, 300] } },
        { json: { customer_id: 2, purchases: [50, 75] } }
      ]
    }
  };
  
  try {
    console.log('\n\nExecuting generated code...');
    const result = await generator.executeGeneratedCode(codeId, executionContext);
    console.log('Execution Result:', result);
    
    // Get execution stats
    const stats = await generator.getExecutionStats(codeId);
    console.log('\nExecution Stats:', stats);
    
    // Provide feedback
    await generator.provideFeedback(codeId, {
      rating: 5,
      worked: true,
      suggestions: ['Code worked perfectly for our use case']
    });
    
    // Generate performance report
    const report = await generator.getPerformanceReport(codeId);
    console.log('\nPerformance Report:');
    console.log(report);
    
  } catch (error) {
    console.error('Execution failed:', error);
  }
}

// Example usage in n8n workflow
function exampleN8nWorkflowWithMultiLanguage() {
  return {
    name: 'Multi-Language Processing Workflow',
    nodes: [
      {
        id: '1',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        parameters: {
          path: 'process-data',
          method: 'POST'
        },
        position: [100, 200]
      },
      {
        id: '2',
        name: 'JavaScript Transform',
        type: 'n8n-nodes-base.code',
        parameters: {
          language: 'javaScript',
          jsCode: '// Dynamic code will be generated here'
        },
        position: [300, 200]
      },
      {
        id: '3',
        name: 'Python Analysis',
        type: 'n8n-nodes-base.code',
        parameters: {
          language: 'python',
          pythonCode: '# Dynamic Python code will be generated here'
        },
        position: [500, 200]
      }
    ],
    connections: {
      'Webhook': {
        main: [[{ node: 'JavaScript Transform', type: 'main', index: 0 }]]
      },
      'JavaScript Transform': {
        main: [[{ node: 'Python Analysis', type: 'main', index: 0 }]]
      }
    }
  };
}

// Run the demonstration
if (require.main === module) {
  demonstrateMultiLanguageCodeGeneration().catch(console.error);
}