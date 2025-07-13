import { Tutorial } from '../components/InteractiveTutorial/TutorialEngine';

export const gettingStartedTutorial: Tutorial = {
  id: 'getting-started',
  title: 'Getting Started with n8n-MCP SDK',
  description: 'Learn the basics of using the n8n-MCP SDK to interact with workflows programmatically',
  difficulty: 'beginner',
  estimatedTime: 15,
  tags: ['sdk', 'basics', 'authentication'],
  prerequisites: ['API key from n8n-MCP dashboard'],
  steps: [
    {
      id: 'introduction',
      title: 'Welcome to n8n-MCP SDK',
      type: 'content',
      content: `
# Welcome to the n8n-MCP SDK Tutorial

In this tutorial, you'll learn how to:
- Set up authentication with your API key
- Create and manage workflows programmatically
- Execute workflows and monitor their status
- Handle errors gracefully

Let's start by understanding the basic concepts of the SDK.

## What is n8n-MCP?

n8n-MCP is a powerful automation platform that allows you to create, manage, and execute workflows using a simple API. The SDK provides a convenient JavaScript/TypeScript interface to interact with the platform.

## Prerequisites

Before we begin, make sure you have:
- Node.js 14 or higher installed
- An n8n-MCP account with an API key
- Basic knowledge of JavaScript/TypeScript
      `,
      validation: {
        type: 'none'
      }
    },
    {
      id: 'setup-authentication',
      title: 'Setting Up Authentication',
      type: 'code',
      content: `
## Setting Up Authentication

The first step is to import the SDK and create a client instance with your API key.

### Exercise: Create an authenticated client

Complete the code below to create an authenticated n8n-MCP client:
      `,
      exercise: {
        initialCode: `// Import the n8n-MCP SDK
// TODO: Add the import statement

// Create a new client instance
// TODO: Initialize the client with your API key
const client = `,
        language: 'javascript',
        solution: `// Import the n8n-MCP SDK
import { N8nMcpClient } from '@n8n-mcp/sdk';

// Create a new client instance
const client = new N8nMcpClient({
  apiKey: 'your-api-key-here',
  baseURL: 'https://api.n8n-mcp.com' // Optional, uses default if not provided
});`,
        hints: [
          {
            level: 1,
            content: 'You need to import the N8nMcpClient class from the SDK package.'
          },
          {
            level: 2,
            content: 'The import statement should be: import { N8nMcpClient } from \'@n8n-mcp/sdk\';'
          },
          {
            level: 3,
            content: 'The client constructor requires an object with at least an apiKey property.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkAuthentication'
      }
    },
    {
      id: 'create-workflow',
      title: 'Creating Your First Workflow',
      type: 'code',
      content: `
## Creating a Workflow

Now let's create a simple workflow that processes data from a webhook.

### Exercise: Create a workflow with webhook and transform nodes

Create a workflow that:
1. Receives data via webhook
2. Transforms the data using a transform node
      `,
      exercise: {
        initialCode: `// Create a new workflow
async function createWorkflow() {
  try {
    const workflow = await client.workflows.create({
      // TODO: Add workflow configuration
    });
    
    console.log('Workflow created:', workflow);
    return workflow;
  } catch (error) {
    console.error('Error creating workflow:', error);
  }
}

createWorkflow();`,
        language: 'javascript',
        solution: `// Create a new workflow
async function createWorkflow() {
  try {
    const workflow = await client.workflows.create({
      name: 'My First Workflow',
      active: true,
      nodes: [
        {
          id: 'webhook',
          type: 'webhook',
          position: [100, 100],
          parameters: {
            path: '/my-webhook',
            method: 'POST'
          }
        },
        {
          id: 'transform',
          type: 'transform',
          position: [300, 100],
          parameters: {
            expression: 'return { processed: true, ...item }'
          }
        }
      ],
      connections: {
        webhook: [
          {
            node: 'transform',
            type: 'main',
            index: 0
          }
        ]
      }
    });
    
    console.log('Workflow created:', workflow);
    return workflow;
  } catch (error) {
    console.error('Error creating workflow:', error);
  }
}

createWorkflow();`,
        hints: [
          {
            level: 1,
            content: 'The workflow configuration needs name, nodes, and connections properties.'
          },
          {
            level: 2,
            content: 'Each node needs an id, type, position, and parameters.'
          },
          {
            level: 3,
            content: 'Don\'t forget to connect the webhook node to the transform node in the connections object.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkWorkflowCreation'
      }
    },
    {
      id: 'execute-workflow',
      title: 'Executing Workflows',
      type: 'code',
      content: `
## Executing a Workflow

Let's execute the workflow we just created and pass some test data.

### Exercise: Execute workflow with test data
      `,
      exercise: {
        initialCode: `// Execute the workflow
async function executeWorkflow(workflowId) {
  try {
    // TODO: Execute the workflow with test data
    const execution = 
    
    console.log('Execution started:', execution);
    return execution;
  } catch (error) {
    console.error('Error executing workflow:', error);
  }
}

// Replace with your workflow ID
executeWorkflow('your-workflow-id');`,
        language: 'javascript',
        solution: `// Execute the workflow
async function executeWorkflow(workflowId) {
  try {
    const execution = await client.workflows.execute(workflowId, {
      data: {
        name: 'Test User',
        email: 'test@example.com',
        action: 'signup'
      }
    });
    
    console.log('Execution started:', execution);
    return execution;
  } catch (error) {
    console.error('Error executing workflow:', error);
  }
}

// Replace with your workflow ID
executeWorkflow('your-workflow-id');`,
        hints: [
          {
            level: 1,
            content: 'Use the client.workflows.execute() method to run a workflow.'
          },
          {
            level: 2,
            content: 'The execute method takes the workflow ID and an optional data object.'
          }
        ]
      },
      validation: {
        type: 'execution',
        validator: 'checkWorkflowExecution'
      }
    },
    {
      id: 'error-handling',
      title: 'Error Handling Best Practices',
      type: 'code',
      content: `
## Error Handling

Proper error handling is crucial for building robust applications. Let's learn how to handle different types of errors.

### Exercise: Implement comprehensive error handling
      `,
      exercise: {
        initialCode: `// Implement error handling
async function safeWorkflowOperation() {
  // TODO: Add try-catch with specific error handling
  
  const workflow = await client.workflows.get('non-existent-id');
}

safeWorkflowOperation();`,
        language: 'javascript',
        solution: `// Implement error handling
async function safeWorkflowOperation() {
  try {
    const workflow = await client.workflows.get('non-existent-id');
    console.log('Workflow found:', workflow);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        console.error('Workflow not found');
      } else if (error.status === 401) {
        console.error('Authentication failed - check your API key');
      } else {
        console.error('API error:', error.message);
      }
    } else if (error instanceof ValidationError) {
      console.error('Validation error:', error.details);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

safeWorkflowOperation();`,
        hints: [
          {
            level: 1,
            content: 'Wrap your API calls in try-catch blocks to handle errors.'
          },
          {
            level: 2,
            content: 'Check for specific error types like ApiError and ValidationError.'
          },
          {
            level: 3,
            content: 'Handle different HTTP status codes appropriately (404, 401, etc).'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkErrorHandling'
      }
    },
    {
      id: 'quiz',
      title: 'Knowledge Check',
      type: 'quiz',
      content: `
## Knowledge Check

Let's test what you've learned so far!
      `,
      quiz: {
        questions: [
          {
            id: 'q1',
            question: 'What is required to authenticate with the n8n-MCP SDK?',
            type: 'multiple-choice',
            options: [
              'Username and password',
              'API key',
              'OAuth token',
              'Session cookie'
            ],
            correctAnswer: 'API key',
            explanation: 'The n8n-MCP SDK uses API key authentication. You provide your API key when creating the client instance.'
          },
          {
            id: 'q2',
            question: 'Which of the following are valid node types in n8n-MCP?',
            type: 'multiple-select',
            options: [
              'webhook',
              'transform',
              'http-request',
              'database',
              'email'
            ],
            correctAnswer: ['webhook', 'transform', 'http-request'],
            explanation: 'Webhook, transform, and http-request are all valid node types. Database and email nodes might be available through specific integrations.'
          },
          {
            id: 'q3',
            question: 'The client.workflows.execute() method returns immediately with an execution ID.',
            type: 'true-false',
            correctAnswer: 'true',
            explanation: 'The execute method returns immediately with an execution object containing the execution ID. The workflow runs asynchronously in the background.'
          }
        ],
        passingScore: 70
      }
    },
    {
      id: 'conclusion',
      title: 'Congratulations!',
      type: 'content',
      content: `
# Congratulations! 🎉

You've completed the Getting Started tutorial for the n8n-MCP SDK!

## What You've Learned

✅ How to authenticate with the n8n-MCP API  
✅ Creating workflows programmatically  
✅ Executing workflows with custom data  
✅ Implementing proper error handling  

## Next Steps

Now that you understand the basics, here are some suggestions for what to explore next:

1. **Advanced Workflows**: Learn about conditional logic, loops, and complex node configurations
2. **Webhook Integration**: Build real-time integrations with external services
3. **Error Recovery**: Implement retry logic and fallback strategies
4. **Performance Optimization**: Learn best practices for handling large-scale automations

## Resources

- [API Documentation](/api-docs)
- [SDK Reference](/sdk-reference)
- [Community Forum](https://community.n8n-mcp.com)
- [Example Projects](https://github.com/n8n-mcp/examples)

Happy automating! 🚀
      `,
      validation: {
        type: 'none'
      }
    }
  ]
};