import { ValidationResult } from './TutorialEngine';

/**
 * Collection of validators for tutorial exercises
 */
export const tutorialValidators = {
  /**
   * Check if workflow creation code is correct
   */
  checkWorkflowCreation: (code: string): ValidationResult => {
    const hasWorkflowCreation = code.includes('client.workflows.create');
    const hasCorrectNodes = code.includes('http-request') && code.includes('transform');
    const hasName = code.includes('name:') || code.includes('name =');
    
    if (!hasWorkflowCreation) {
      return {
        success: false,
        message: 'You need to call client.workflows.create()',
        hint: 'Use the workflows resource to create a new workflow'
      };
    }
    
    if (!hasName) {
      return {
        success: false,
        message: 'Your workflow needs a name property',
        hint: 'Add a name property to your workflow configuration'
      };
    }
    
    if (!hasCorrectNodes) {
      return {
        success: false,
        message: 'Your workflow should include both http-request and transform nodes',
        hint: 'Check the node types in your workflow definition'
      };
    }
    
    return { 
      success: true, 
      message: 'Great job! Your workflow creation code is correct.',
      score: 100
    };
  },
  
  /**
   * Check API response for successful workflow creation
   */
  checkApiResponse: async (response: any): Promise<ValidationResult> => {
    if (!response) {
      return {
        success: false,
        message: 'No response received',
        hint: 'Make sure your code executes the API call'
      };
    }

    if (response.error) {
      return {
        success: false,
        message: `API error: ${response.error}`,
        hint: 'Check your API key and request format'
      };
    }
    
    if (response.status !== 201 && response.status !== 200) {
      return {
        success: false,
        message: `Expected status 201, got ${response.status}`,
        hint: 'Make sure your request body is valid'
      };
    }
    
    if (!response.data?.id) {
      return {
        success: false,
        message: 'Response should include workflow ID',
        hint: 'Check the API documentation for the response format'
      };
    }
    
    return { 
      success: true, 
      message: 'Perfect! Your API call was successful.',
      score: 100
    };
  },

  /**
   * Check authentication setup
   */
  checkAuthentication: (code: string): ValidationResult => {
    const hasApiKey = code.includes('apiKey:') || code.includes('apiKey =');
    const hasClient = code.includes('new N8nMcpClient') || code.includes('Client(');
    
    if (!hasClient) {
      return {
        success: false,
        message: 'You need to create a client instance',
        hint: 'Initialize the N8nMcpClient with your configuration'
      };
    }
    
    if (!hasApiKey) {
      return {
        success: false,
        message: 'You need to provide an API key',
        hint: 'Add apiKey to your client configuration'
      };
    }
    
    return { 
      success: true, 
      message: 'Authentication is set up correctly!',
      score: 100
    };
  },

  /**
   * Check error handling implementation
   */
  checkErrorHandling: (code: string): ValidationResult => {
    const hasTryCatch = code.includes('try') && code.includes('catch');
    const hasErrorHandling = code.includes('error') || code.includes('Error');
    const hasSpecificErrors = code.includes('ApiError') || code.includes('ValidationError');
    
    if (!hasTryCatch) {
      return {
        success: false,
        message: 'You need to use try-catch for error handling',
        hint: 'Wrap your API calls in a try-catch block'
      };
    }
    
    if (!hasErrorHandling) {
      return {
        success: false,
        message: 'You need to handle errors in the catch block',
        hint: 'Log or handle the error in your catch block'
      };
    }
    
    let score = 80;
    if (hasSpecificErrors) {
      score = 100;
    }
    
    return { 
      success: true, 
      message: hasSpecificErrors 
        ? 'Excellent! You\'re handling specific error types.'
        : 'Good job! Consider checking for specific error types for better handling.',
      score
    };
  },

  /**
   * Check webhook implementation
   */
  checkWebhookSetup: (code: string): ValidationResult => {
    const hasWebhookNode = code.includes('webhook') || code.includes('Webhook');
    const hasPath = code.includes('path:') && (code.includes('/') || code.includes('webhook'));
    const hasMethod = code.includes('method:') || code.includes('POST') || code.includes('GET');
    
    if (!hasWebhookNode) {
      return {
        success: false,
        message: 'You need to add a webhook node',
        hint: 'Add a node with type "webhook" to your workflow'
      };
    }
    
    if (!hasPath) {
      return {
        success: false,
        message: 'Your webhook needs a path',
        hint: 'Add a path property like "/my-webhook"'
      };
    }
    
    if (!hasMethod) {
      return {
        success: false,
        message: 'Specify the HTTP method for your webhook',
        hint: 'Add method: "POST" or "GET" to your webhook configuration'
      };
    }
    
    return { 
      success: true, 
      message: 'Perfect! Your webhook is configured correctly.',
      score: 100
    };
  },

  /**
   * Check data transformation
   */
  checkDataTransformation: (code: string): ValidationResult => {
    const hasTransform = code.includes('transform') || code.includes('map') || code.includes('filter');
    const hasReturn = code.includes('return');
    const hasDataAccess = code.includes('$json') || code.includes('item') || code.includes('data');
    
    if (!hasTransform) {
      return {
        success: false,
        message: 'You need to transform the data',
        hint: 'Use map, filter, or a transform node to modify the data'
      };
    }
    
    if (!hasReturn) {
      return {
        success: false,
        message: 'Your transformation needs to return data',
        hint: 'Make sure to return the transformed data'
      };
    }
    
    if (!hasDataAccess) {
      return {
        success: false,
        message: 'You need to access the input data',
        hint: 'Use $json or item to access the incoming data'
      };
    }
    
    return { 
      success: true, 
      message: 'Excellent! Your data transformation is working correctly.',
      score: 100
    };
  },

  /**
   * Check workflow execution
   */
  checkWorkflowExecution: async (response: any): Promise<ValidationResult> => {
    if (!response) {
      return {
        success: false,
        message: 'No execution response received',
        hint: 'Make sure you call the execute method'
      };
    }

    if (response.error) {
      return {
        success: false,
        message: `Execution error: ${response.error}`,
        hint: 'Check if your workflow is active and properly configured'
      };
    }
    
    if (!response.execution_id && !response.data?.id) {
      return {
        success: false,
        message: 'No execution ID returned',
        hint: 'The response should include an execution ID'
      };
    }
    
    const hasStatus = response.status === 'running' || response.status === 'success' || response.data?.status;
    
    if (!hasStatus) {
      return {
        success: false,
        message: 'Execution status not found',
        hint: 'Check the execution response format'
      };
    }
    
    return { 
      success: true, 
      message: 'Workflow executed successfully!',
      score: 100
    };
  },

  /**
   * Generic code structure validator
   */
  checkCodeStructure: (code: string, requirements: {
    imports?: string[];
    functions?: string[];
    variables?: string[];
    patterns?: RegExp[];
  }): ValidationResult => {
    const errors: string[] = [];
    
    // Check imports
    if (requirements.imports) {
      for (const imp of requirements.imports) {
        if (!code.includes(imp)) {
          errors.push(`Missing import: ${imp}`);
        }
      }
    }
    
    // Check functions
    if (requirements.functions) {
      for (const func of requirements.functions) {
        if (!code.includes(func)) {
          errors.push(`Missing function call: ${func}`);
        }
      }
    }
    
    // Check variables
    if (requirements.variables) {
      for (const variable of requirements.variables) {
        if (!code.includes(variable)) {
          errors.push(`Missing variable: ${variable}`);
        }
      }
    }
    
    // Check patterns
    if (requirements.patterns) {
      for (const pattern of requirements.patterns) {
        if (!pattern.test(code)) {
          errors.push(`Code doesn't match required pattern`);
        }
      }
    }
    
    if (errors.length > 0) {
      return {
        success: false,
        message: 'Your code is missing some requirements',
        details: errors,
        hint: errors[0]
      };
    }
    
    return {
      success: true,
      message: 'All requirements met!',
      score: 100
    };
  }
};