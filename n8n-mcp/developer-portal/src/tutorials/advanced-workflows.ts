import { Tutorial } from '../components/InteractiveTutorial/TutorialEngine';

export const advancedWorkflowsTutorial: Tutorial = {
  id: 'advanced-workflows',
  title: 'Advanced Workflow Patterns',
  description: 'Master complex workflow patterns including conditionals, loops, error handling, and parallel processing',
  difficulty: 'advanced',
  estimatedTime: 30,
  tags: ['advanced', 'patterns', 'performance'],
  prerequisites: ['Completed Getting Started tutorial', 'Basic understanding of n8n-MCP'],
  steps: [
    {
      id: 'introduction',
      title: 'Advanced Workflow Patterns',
      type: 'content',
      content: `
# Advanced Workflow Patterns

In this tutorial, we'll explore advanced workflow patterns that will help you build robust, scalable automations.

## What You'll Learn

- **Conditional Logic**: Route data based on dynamic conditions
- **Loops and Iteration**: Process arrays and collections efficiently
- **Error Handling**: Build resilient workflows with proper error recovery
- **Parallel Processing**: Execute multiple operations simultaneously
- **Data Transformation**: Complex data manipulation techniques

## Prerequisites

Before starting this tutorial, you should be comfortable with:
- Creating basic workflows
- Understanding node connections
- Working with the n8n-MCP SDK

Let's dive into advanced workflow patterns!
      `,
      validation: {
        type: 'none'
      }
    },
    {
      id: 'conditional-logic',
      title: 'Implementing Conditional Logic',
      type: 'code',
      content: `
## Conditional Logic with IF Nodes

Conditional logic allows your workflows to make decisions based on data.

### Exercise: Create a customer routing workflow

Build a workflow that routes customers to different processes based on their subscription tier:
- Premium customers → Fast track process
- Standard customers → Normal process
- Free tier → Basic process
      `,
      exercise: {
        initialCode: `// Create a workflow with conditional routing
async function createConditionalWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Customer Router',
    active: true,
    nodes: [
      {
        id: 'webhook',
        type: 'webhook',
        position: [100, 200],
        parameters: {
          path: '/customer-action',
          method: 'POST'
        }
      },
      // TODO: Add IF node to check customer tier
      // TODO: Add nodes for each customer tier process
    ],
    connections: {
      // TODO: Connect webhook to IF node
      // TODO: Connect IF outputs to appropriate processes
    }
  });
  
  return workflow;
}`,
        language: 'javascript',
        solution: `// Create a workflow with conditional routing
async function createConditionalWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Customer Router',
    active: true,
    nodes: [
      {
        id: 'webhook',
        type: 'webhook',
        position: [100, 200],
        parameters: {
          path: '/customer-action',
          method: 'POST'
        }
      },
      {
        id: 'checkTier',
        type: 'if',
        position: [300, 200],
        parameters: {
          conditions: [
            {
              value1: '{{$json.tier}}',
              operation: 'equals',
              value2: 'premium'
            },
            {
              value1: '{{$json.tier}}',
              operation: 'equals',
              value2: 'standard'
            }
          ]
        }
      },
      {
        id: 'premiumProcess',
        type: 'transform',
        position: [500, 100],
        parameters: {
          expression: 'return { ...item, priority: "high", processing: "fast-track" }'
        }
      },
      {
        id: 'standardProcess',
        type: 'transform',
        position: [500, 200],
        parameters: {
          expression: 'return { ...item, priority: "normal", processing: "standard" }'
        }
      },
      {
        id: 'freeProcess',
        type: 'transform',
        position: [500, 300],
        parameters: {
          expression: 'return { ...item, priority: "low", processing: "basic" }'
        }
      }
    ],
    connections: {
      webhook: [
        {
          node: 'checkTier',
          type: 'main',
          index: 0
        }
      ],
      checkTier: [
        {
          node: 'premiumProcess',
          type: 'main',
          index: 0
        },
        {
          node: 'standardProcess',
          type: 'main',
          index: 1
        },
        {
          node: 'freeProcess',
          type: 'main',
          index: 2
        }
      ]
    }
  });
  
  return workflow;
}`,
        hints: [
          {
            level: 1,
            content: 'The IF node can have multiple conditions and outputs.'
          },
          {
            level: 2,
            content: 'Each condition in the IF node creates a separate output branch (index 0, 1, 2, etc).'
          },
          {
            level: 3,
            content: 'The last output (index 2 in this case) is the "else" branch for when no conditions match.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkCodeStructure',
        validatorOptions: {
          patterns: [/type:\s*['"]if['"]/, /conditions:/, /connections.*checkTier/]
        }
      }
    },
    {
      id: 'loops-iteration',
      title: 'Working with Loops',
      type: 'code',
      content: `
## Loops and Array Processing

Process arrays of data efficiently using loop nodes and batch operations.

### Exercise: Batch process customer orders

Create a workflow that processes an array of orders, enriching each with shipping information:
      `,
      exercise: {
        initialCode: `// Create a workflow with loop processing
async function createLoopWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Order Processor',
    nodes: [
      {
        id: 'trigger',
        type: 'webhook',
        parameters: {
          path: '/process-orders'
        }
      },
      // TODO: Add split node to iterate over orders array
      // TODO: Add HTTP request node to fetch shipping rates
      // TODO: Add merge node to combine results
    ],
    connections: {
      // TODO: Connect the nodes properly
    }
  });
  
  return workflow;
}`,
        language: 'javascript',
        solution: `// Create a workflow with loop processing
async function createLoopWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Order Processor',
    active: true,
    nodes: [
      {
        id: 'trigger',
        type: 'webhook',
        position: [100, 200],
        parameters: {
          path: '/process-orders'
        }
      },
      {
        id: 'splitOrders',
        type: 'split',
        position: [300, 200],
        parameters: {
          fieldToSplit: 'orders',
          include: 'allOtherFields'
        }
      },
      {
        id: 'fetchShipping',
        type: 'http-request',
        position: [500, 200],
        parameters: {
          url: 'https://api.shipping.com/rates',
          method: 'POST',
          bodyParametersJson: {
            weight: '={{$json.weight}}',
            destination: '={{$json.address.zip}}'
          }
        }
      },
      {
        id: 'enrichOrder',
        type: 'transform',
        position: [700, 200],
        parameters: {
          expression: \`
            return {
              ...item,
              shippingRate: $json.rate,
              estimatedDelivery: $json.estimatedDays,
              totalCost: item.subtotal + $json.rate
            }
          \`
        }
      },
      {
        id: 'mergeResults',
        type: 'merge',
        position: [900, 200],
        parameters: {
          mode: 'multiplex'
        }
      }
    ],
    connections: {
      trigger: [
        { node: 'splitOrders', type: 'main', index: 0 }
      ],
      splitOrders: [
        { node: 'fetchShipping', type: 'main', index: 0 }
      ],
      fetchShipping: [
        { node: 'enrichOrder', type: 'main', index: 0 }
      ],
      enrichOrder: [
        { node: 'mergeResults', type: 'main', index: 0 }
      ]
    }
  });
  
  return workflow;
}`,
        hints: [
          {
            level: 1,
            content: 'The split node breaks an array into individual items for processing.'
          },
          {
            level: 2,
            content: 'Each item flows through the workflow separately, allowing parallel processing.'
          },
          {
            level: 3,
            content: 'The merge node collects all processed items back into an array.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkCodeStructure',
        validatorOptions: {
          patterns: [/type:\s*['"]split['"]/, /type:\s*['"]merge['"]/, /fieldToSplit/]
        }
      }
    },
    {
      id: 'error-recovery',
      title: 'Error Handling and Recovery',
      type: 'code',
      content: `
## Building Resilient Workflows

Implement error handling and recovery strategies to ensure your workflows continue running even when things go wrong.

### Exercise: Add error handling with retry logic

Create a workflow that handles API failures gracefully with exponential backoff:
      `,
      exercise: {
        initialCode: `// Create a resilient workflow with error handling
async function createResilientWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Resilient API Caller',
    nodes: [
      {
        id: 'start',
        type: 'webhook',
        parameters: { path: '/call-api' }
      },
      // TODO: Add HTTP request with error handling
      // TODO: Add error trigger node
      // TODO: Add wait node for backoff
      // TODO: Add retry logic
    ]
  });
  
  return workflow;
}`,
        language: 'javascript',
        solution: `// Create a resilient workflow with error handling
async function createResilientWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Resilient API Caller',
    active: true,
    nodes: [
      {
        id: 'start',
        type: 'webhook',
        position: [100, 200],
        parameters: { path: '/call-api' }
      },
      {
        id: 'setRetryCount',
        type: 'transform',
        position: [300, 200],
        parameters: {
          expression: 'return { ...item, retryCount: item.retryCount || 0 }'
        }
      },
      {
        id: 'apiCall',
        type: 'http-request',
        position: [500, 200],
        parameters: {
          url: '={{$json.apiUrl}}',
          method: 'POST',
          bodyParametersJson: '={{$json.payload}}',
          options: {
            timeout: 10000,
            allowUnauthorizedCerts: false
          }
        }
      },
      {
        id: 'errorTrigger',
        type: 'error-trigger',
        position: [500, 350],
        parameters: {
          errorMessage: '.*',
          maxRetries: 3
        }
      },
      {
        id: 'checkRetries',
        type: 'if',
        position: [700, 350],
        parameters: {
          conditions: [{
            value1: '={{$json.retryCount}}',
            operation: 'smaller',
            value2: 3
          }]
        }
      },
      {
        id: 'wait',
        type: 'wait',
        position: [900, 350],
        parameters: {
          amount: '={{Math.pow(2, $json.retryCount)}}',
          unit: 'seconds'
        }
      },
      {
        id: 'incrementRetry',
        type: 'transform',
        position: [1100, 350],
        parameters: {
          expression: 'return { ...item, retryCount: item.retryCount + 1 }'
        }
      },
      {
        id: 'logError',
        type: 'transform',
        position: [700, 500],
        parameters: {
          expression: 'return { error: "Max retries exceeded", originalData: item }'
        }
      }
    ],
    connections: {
      start: [
        { node: 'setRetryCount', type: 'main', index: 0 }
      ],
      setRetryCount: [
        { node: 'apiCall', type: 'main', index: 0 }
      ],
      apiCall: [
        { node: 'errorTrigger', type: 'error', index: 0 }
      ],
      errorTrigger: [
        { node: 'checkRetries', type: 'main', index: 0 }
      ],
      checkRetries: [
        { node: 'wait', type: 'main', index: 0 },
        { node: 'logError', type: 'main', index: 1 }
      ],
      wait: [
        { node: 'incrementRetry', type: 'main', index: 0 }
      ],
      incrementRetry: [
        { node: 'apiCall', type: 'main', index: 0 }
      ]
    }
  });
  
  return workflow;
}`,
        hints: [
          {
            level: 1,
            content: 'Error connections allow you to handle node failures gracefully.'
          },
          {
            level: 2,
            content: 'Use exponential backoff (2^retryCount) to avoid overwhelming failed services.'
          },
          {
            level: 3,
            content: 'Always set a maximum retry limit to prevent infinite loops.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkCodeStructure',
        validatorOptions: {
          patterns: [/type:\s*['"]error-trigger['"]/, /type:\s*['"]wait['"]/, /Math\.pow/]
        }
      }
    },
    {
      id: 'parallel-processing',
      title: 'Parallel Processing Patterns',
      type: 'code',
      content: `
## Parallel Processing for Performance

Execute multiple operations simultaneously to improve workflow performance.

### Exercise: Parallel data enrichment

Create a workflow that enriches user data from multiple sources in parallel:
      `,
      exercise: {
        initialCode: `// Create a workflow with parallel processing
async function createParallelWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Parallel Enrichment',
    nodes: [
      {
        id: 'trigger',
        type: 'webhook',
        parameters: { path: '/enrich-user' }
      },
      // TODO: Add nodes to fetch from multiple APIs in parallel
      // TODO: Add merge node to combine results
    ]
  });
  
  return workflow;
}`,
        language: 'javascript',
        solution: `// Create a workflow with parallel processing
async function createParallelWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Parallel Enrichment',
    active: true,
    nodes: [
      {
        id: 'trigger',
        type: 'webhook',
        position: [100, 300],
        parameters: { path: '/enrich-user' }
      },
      {
        id: 'fetchUserProfile',
        type: 'http-request',
        position: [400, 100],
        parameters: {
          url: 'https://api.profile.com/users/{{$json.userId}}',
          method: 'GET',
          options: { timeout: 5000 }
        }
      },
      {
        id: 'fetchUserActivity',
        type: 'http-request',
        position: [400, 300],
        parameters: {
          url: 'https://api.activity.com/users/{{$json.userId}}/stats',
          method: 'GET',
          options: { timeout: 5000 }
        }
      },
      {
        id: 'fetchUserPreferences',
        type: 'http-request',
        position: [400, 500],
        parameters: {
          url: 'https://api.preferences.com/users/{{$json.userId}}',
          method: 'GET',
          options: { timeout: 5000 }
        }
      },
      {
        id: 'mergeData',
        type: 'merge',
        position: [700, 300],
        parameters: {
          mode: 'combine',
          combinationMode: 'mergeByKey',
          mergeByKey: 'userId'
        }
      },
      {
        id: 'finalTransform',
        type: 'transform',
        position: [900, 300],
        parameters: {
          expression: \`
            const profile = items[0].$json;
            const activity = items[1].$json;
            const preferences = items[2].$json;
            
            return {
              userId: profile.userId,
              enrichedData: {
                profile: profile.data,
                activity: activity.stats,
                preferences: preferences.settings,
                enrichedAt: new Date().toISOString()
              }
            };
          \`
        }
      }
    ],
    connections: {
      trigger: [
        { node: 'fetchUserProfile', type: 'main', index: 0 },
        { node: 'fetchUserActivity', type: 'main', index: 0 },
        { node: 'fetchUserPreferences', type: 'main', index: 0 }
      ],
      fetchUserProfile: [
        { node: 'mergeData', type: 'main', index: 0 }
      ],
      fetchUserActivity: [
        { node: 'mergeData', type: 'main', index: 1 }
      ],
      fetchUserPreferences: [
        { node: 'mergeData', type: 'main', index: 2 }
      ],
      mergeData: [
        { node: 'finalTransform', type: 'main', index: 0 }
      ]
    }
  });
  
  return workflow;
}`,
        hints: [
          {
            level: 1,
            content: 'Connect one node to multiple nodes to execute them in parallel.'
          },
          {
            level: 2,
            content: 'The merge node waits for all inputs before proceeding.'
          },
          {
            level: 3,
            content: 'Use different merge modes (combine, multiplex, etc) based on your needs.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkCodeStructure',
        validatorOptions: {
          patterns: [/connections.*trigger.*\[[\s\S]*{[\s\S]*},{[\s\S]*},{[\s\S]*}\]/, /mode:\s*['"]combine['"]/]
        }
      }
    },
    {
      id: 'data-transformation',
      title: 'Advanced Data Transformation',
      type: 'code',
      content: `
## Complex Data Transformations

Learn advanced techniques for transforming and manipulating data within your workflows.

### Exercise: Build a data aggregation pipeline

Create a workflow that aggregates and transforms sales data:
      `,
      exercise: {
        initialCode: `// Create a data transformation workflow
async function createTransformWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Sales Aggregator',
    nodes: [
      {
        id: 'fetchSales',
        type: 'http-request',
        parameters: {
          url: 'https://api.sales.com/daily'
        }
      },
      // TODO: Add transformation nodes for:
      // 1. Group by product category
      // 2. Calculate totals and averages
      // 3. Format for reporting
    ]
  });
  
  return workflow;
}`,
        language: 'javascript',
        solution: `// Create a data transformation workflow
async function createTransformWorkflow() {
  const workflow = await client.workflows.create({
    name: 'Sales Aggregator',
    active: true,
    nodes: [
      {
        id: 'fetchSales',
        type: 'http-request',
        position: [100, 200],
        parameters: {
          url: 'https://api.sales.com/daily',
          method: 'GET'
        }
      },
      {
        id: 'groupByCategory',
        type: 'transform',
        position: [300, 200],
        parameters: {
          expression: \`
            // Group sales by category
            const grouped = {};
            
            items.forEach(item => {
              const sale = item.$json;
              const category = sale.category;
              
              if (!grouped[category]) {
                grouped[category] = {
                  category: category,
                  sales: [],
                  totalRevenue: 0,
                  totalUnits: 0
                };
              }
              
              grouped[category].sales.push(sale);
              grouped[category].totalRevenue += sale.revenue;
              grouped[category].totalUnits += sale.units;
            });
            
            return Object.values(grouped);
          \`
        }
      },
      {
        id: 'calculateMetrics',
        type: 'transform',
        position: [500, 200],
        parameters: {
          expression: \`
            return items.map(item => {
              const data = item.$json;
              return {
                ...data,
                averageOrderValue: data.totalRevenue / data.sales.length,
                averageUnitsPerSale: data.totalUnits / data.sales.length,
                topProduct: data.sales.reduce((max, sale) => 
                  sale.revenue > max.revenue ? sale : max
                ).productName,
                performanceRating: data.totalRevenue > 10000 ? 'High' : 
                                  data.totalRevenue > 5000 ? 'Medium' : 'Low'
              };
            });
          \`
        }
      },
      {
        id: 'formatReport',
        type: 'transform',
        position: [700, 200],
        parameters: {
          expression: \`
            const reportDate = new Date().toISOString().split('T')[0];
            
            return {
              reportDate: reportDate,
              summary: {
                totalCategories: items.length,
                totalRevenue: items.reduce((sum, item) => sum + item.$json.totalRevenue, 0),
                totalUnits: items.reduce((sum, item) => sum + item.$json.totalUnits, 0)
              },
              categories: items.map(item => ({
                name: item.$json.category,
                revenue: item.$json.totalRevenue.toFixed(2),
                units: item.$json.totalUnits,
                avgOrderValue: item.$json.averageOrderValue.toFixed(2),
                performance: item.$json.performanceRating,
                topProduct: item.$json.topProduct
              }))
            };
          \`
        }
      }
    ],
    connections: {
      fetchSales: [
        { node: 'groupByCategory', type: 'main', index: 0 }
      ],
      groupByCategory: [
        { node: 'calculateMetrics', type: 'main', index: 0 }
      ],
      calculateMetrics: [
        { node: 'formatReport', type: 'main', index: 0 }
      ]
    }
  });
  
  return workflow;
}`,
        hints: [
          {
            level: 1,
            content: 'Use JavaScript expressions in transform nodes for complex data manipulation.'
          },
          {
            level: 2,
            content: 'The items array contains all data items passed to the transform node.'
          },
          {
            level: 3,
            content: 'Break complex transformations into multiple nodes for better readability.'
          }
        ]
      },
      validation: {
        type: 'code',
        validator: 'checkDataTransformation'
      }
    },
    {
      id: 'conclusion',
      title: 'Mastering Advanced Patterns',
      type: 'content',
      content: `
# Congratulations! 🎉

You've mastered advanced workflow patterns in n8n-MCP!

## What You've Achieved

✅ **Conditional Logic**: Route data dynamically based on conditions  
✅ **Loop Processing**: Handle arrays and collections efficiently  
✅ **Error Recovery**: Build resilient workflows with retry logic  
✅ **Parallel Execution**: Optimize performance with concurrent operations  
✅ **Data Transformation**: Manipulate complex data structures  

## Best Practices Summary

### 1. Performance Optimization
- Use parallel processing when operations are independent
- Implement pagination for large datasets
- Add timeouts to prevent hanging workflows

### 2. Error Handling
- Always implement error recovery for external API calls
- Use exponential backoff for retries
- Log errors for debugging and monitoring

### 3. Code Organization
- Break complex logic into multiple nodes
- Use descriptive node names
- Document complex expressions

### 4. Testing
- Test edge cases (empty arrays, null values)
- Verify error handling paths
- Monitor workflow execution times

## Next Steps

Explore these advanced topics:
- **Webhook Security**: Implement signature verification
- **Rate Limiting**: Handle API quotas gracefully
- **Caching**: Optimize repeated operations
- **Monitoring**: Set up alerts and analytics

## Resources

- [Advanced Patterns Guide](/docs/advanced-patterns)
- [Performance Tuning](/docs/performance)
- [Security Best Practices](/docs/security)
- [Community Examples](https://github.com/n8n-mcp/advanced-examples)

Keep building amazing automations! 🚀
      `,
      validation: {
        type: 'none'
      }
    }
  ]
};