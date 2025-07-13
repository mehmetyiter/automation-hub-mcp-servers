import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const workflowExecutionTime = new Trend('workflow_execution_time');
const authenticationTime = new Trend('authentication_time');
const requestsPerSecond = new Rate('requests_per_second');
const concurrentUsers = new Counter('concurrent_users');

// Test data
const users = new SharedArray('users', function () {
  return Array.from({ length: 100 }, (_, i) => ({
    email: `loadtest.user.${i}@example.com`,
    password: 'password123',
    plan: i % 10 === 0 ? 'enterprise' : i % 3 === 0 ? 'pro' : 'free'
  }));
});

const workflows = new SharedArray('workflows', function () {
  return [
    {
      name: 'HTTP Request Workflow',
      nodes: [
        {
          id: 'webhook',
          type: 'webhook',
          parameters: { path: '/webhook/test', method: 'POST' }
        },
        {
          id: 'http-request',
          type: 'http-request',
          parameters: { 
            url: 'https://httpbin.org/post',
            method: 'POST',
            body: { data: '{{$json}}' }
          }
        }
      ],
      connections: [
        { source: 'webhook', target: 'http-request' }
      ]
    },
    {
      name: 'Data Transform Workflow',
      nodes: [
        {
          id: 'webhook',
          type: 'webhook',
          parameters: { path: '/webhook/transform', method: 'POST' }
        },
        {
          id: 'transform',
          type: 'transform',
          parameters: {
            code: 'return items.map(item => ({ ...item, processed: true }));'
          }
        },
        {
          id: 'condition',
          type: 'condition',
          parameters: {
            condition: '{{$json.processed}} === true'
          }
        }
      ],
      connections: [
        { source: 'webhook', target: 'transform' },
        { source: 'transform', target: 'condition' }
      ]
    },
    {
      name: 'Complex Processing Workflow',
      nodes: Array.from({ length: 10 }, (_, i) => ({
        id: `node-${i}`,
        type: i === 0 ? 'webhook' : 'transform',
        parameters: i === 0 
          ? { path: '/webhook/complex', method: 'POST' }
          : { code: `return items.map(item => ({ ...item, step${i}: Date.now() }));` }
      })),
      connections: Array.from({ length: 9 }, (_, i) => ({
        source: `node-${i}`,
        target: `node-${i + 1}`
      }))
    }
  ];
});

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 20 },    // Warm up
    { duration: '5m', target: 50 },    // Normal load
    { duration: '2m', target: 100 },   // Peak load
    { duration: '5m', target: 100 },   // Sustained peak
    { duration: '2m', target: 200 },   // Stress test
    { duration: '3m', target: 200 },   // Sustained stress
    { duration: '2m', target: 0 },     // Cool down
  ],

  thresholds: {
    // Overall performance
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'], // 5% error rate
    
    // API specific
    'api_latency': ['p(95)<1000', 'p(99)<2000'],
    'workflow_execution_time': ['p(95)<10000', 'p(99)<30000'],
    'authentication_time': ['p(95)<500'],
    
    // Business metrics
    'errors': ['rate<0.01'], // 1% error rate
    'requests_per_second': ['rate>10'], // At least 10 RPS
    
    // Resource utilization
    'http_req_duration{type:static}': ['p(95)<200'],
    'http_req_duration{type:api}': ['p(95)<1000'],
    'http_req_duration{type:workflow}': ['p(95)<5000']
  },

  ext: {
    loadimpact: {
      projectID: parseInt(__ENV.K6_PROJECT_ID || '0'),
      name: 'n8n-MCP Workflow Load Test',
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 30 },
        'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 20 }
      }
    }
  }
};

// Global setup
export function setup() {
  console.log('🚀 Starting workflow load test setup...');
  
  const baseUrl = __ENV.API_URL || 'http://localhost:8080';
  const setupData = {
    baseUrl,
    testUsers: [],
    testWorkflows: [],
    testTokens: new Map()
  };

  // Create test users and workflows
  for (let i = 0; i < Math.min(10, users.length); i++) {
    const user = users[i];
    
    // Create user
    const createUserRes = http.post(`${baseUrl}/api/test/users`, JSON.stringify({
      email: user.email,
      name: `Load Test User ${i}`,
      password: user.password,
      plan: user.plan
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'setup' }
    });

    if (createUserRes.status === 201) {
      const userData = JSON.parse(createUserRes.body);
      setupData.testUsers.push(userData);

      // Authenticate and get token
      const authRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
        email: user.email,
        password: user.password
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'setup' }
      });

      if (authRes.status === 200) {
        const authData = JSON.parse(authRes.body);
        setupData.testTokens.set(userData.id, authData.token);

        // Create workflows for this user
        workflows.slice(0, 2).forEach((workflow, idx) => {
          const workflowRes = http.post(`${baseUrl}/api/workflows`, JSON.stringify({
            ...workflow,
            name: `${workflow.name} - User ${i}`,
            active: true
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.token}`
            },
            tags: { type: 'setup' }
          });

          if (workflowRes.status === 201) {
            const workflowData = JSON.parse(workflowRes.body);
            setupData.testWorkflows.push({
              ...workflowData,
              userId: userData.id,
              token: authData.token
            });
          }
        });
      }
    }
  }

  console.log(`✅ Setup complete: ${setupData.testUsers.length} users, ${setupData.testWorkflows.length} workflows`);
  return setupData;
}

// Main test scenario
export default function (data) {
  concurrentUsers.add(1);
  
  const user = users[Math.floor(Math.random() * users.length)];
  const baseUrl = data.baseUrl;
  
  group('Authentication Flow', () => {
    const authStart = Date.now();
    
    const loginRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth', scenario: 'login' }
    });

    const authDuration = Date.now() - authStart;
    authenticationTime.add(authDuration);

    const loginSuccess = check(loginRes, {
      'login successful': (r) => r.status === 200,
      'has token': (r) => JSON.parse(r.body).token !== undefined,
      'auth time acceptable': () => authDuration < 1000
    });

    if (!loginSuccess) {
      errorRate.add(1);
      return;
    }

    const token = JSON.parse(loginRes.body).token;

    group('Workflow Operations', () => {
      // Browse workflows
      const browseStart = Date.now();
      const workflowsRes = http.get(`${baseUrl}/api/workflows?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` },
        tags: { type: 'api', operation: 'browse' }
      });

      apiLatency.add(Date.now() - browseStart);

      check(workflowsRes, {
        'workflows retrieved': (r) => r.status === 200,
        'has workflows': (r) => JSON.parse(r.body).length >= 0,
        'response time ok': (r) => r.timings.duration < 1000
      }) || errorRate.add(1);

      sleep(thinkTime());

      // Create workflow (20% probability)
      if (Math.random() < 0.2) {
        const workflow = workflows[Math.floor(Math.random() * workflows.length)];
        const createWorkflowRes = http.post(`${baseUrl}/api/workflows`, JSON.stringify({
          ...workflow,
          name: `${workflow.name} - ${Date.now()}`
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          tags: { type: 'api', operation: 'create' }
        });

        const workflowCreated = check(createWorkflowRes, {
          'workflow created': (r) => r.status === 201,
          'has workflow id': (r) => JSON.parse(r.body).id !== undefined
        });

        if (workflowCreated) {
          const workflowData = JSON.parse(createWorkflowRes.body);
          
          // Execute the workflow
          const executeStart = Date.now();
          const executeRes = http.post(`${baseUrl}/api/workflows/${workflowData.id}/execute`, JSON.stringify({
            data: generateTestData()
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            tags: { type: 'workflow', operation: 'execute' }
          });

          const executionTime = Date.now() - executeStart;
          workflowExecutionTime.add(executionTime);

          check(executeRes, {
            'execution started': (r) => r.status === 202,
            'has execution id': (r) => JSON.parse(r.body).executionId !== undefined,
            'execution time reasonable': () => executionTime < 30000
          }) || errorRate.add(1);

          if (executeRes.status === 202) {
            const executionData = JSON.parse(executeRes.body);
            
            // Poll for completion (simplified)
            sleep(2);
            
            const statusRes = http.get(`${baseUrl}/api/executions/${executionData.executionId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              tags: { type: 'api', operation: 'status' }
            });

            check(statusRes, {
              'status retrieved': (r) => r.status === 200,
              'execution completed or running': (r) => {
                const status = JSON.parse(r.body).status;
                return ['success', 'error', 'running'].includes(status);
              }
            }) || errorRate.add(1);
          }

          // Cleanup: delete the test workflow
          http.del(`${baseUrl}/api/workflows/${workflowData.id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            tags: { type: 'api', operation: 'cleanup' }
          });
        } else {
          errorRate.add(1);
        }
      }

      sleep(thinkTime());

      // Browse executions
      const executionsRes = http.get(`${baseUrl}/api/executions?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` },
        tags: { type: 'api', operation: 'browse' }
      });

      check(executionsRes, {
        'executions retrieved': (r) => r.status === 200,
        'response format correct': (r) => Array.isArray(JSON.parse(r.body))
      }) || errorRate.add(1);
    });

    group('API Key Management', () => {
      // Get API keys (50% probability)
      if (Math.random() < 0.5) {
        const apiKeysRes = http.get(`${baseUrl}/api/api-keys`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { type: 'api', operation: 'api-keys' }
        });

        check(apiKeysRes, {
          'api keys retrieved': (r) => r.status === 200
        }) || errorRate.add(1);

        // Create API key (10% probability)
        if (Math.random() < 0.1) {
          const createKeyRes = http.post(`${baseUrl}/api/api-keys`, JSON.stringify({
            name: `Load Test Key ${Date.now()}`,
            scopes: ['read', 'write']
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            tags: { type: 'api', operation: 'create-key' }
          });

          check(createKeyRes, {
            'api key created': (r) => r.status === 201
          }) || errorRate.add(1);
        }
      }
    });

    requestsPerSecond.add(1);
  });

  sleep(thinkTime());
}

// Teardown
export function teardown(data) {
  console.log('🧹 Starting load test cleanup...');
  
  // Cleanup test users and their data
  data.testUsers.forEach(user => {
    const token = data.testTokens.get(user.id);
    if (token) {
      // Delete user workflows
      http.get(`${data.baseUrl}/api/workflows`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.status === 200) {
          const workflows = JSON.parse(res.body);
          workflows.forEach(workflow => {
            http.del(`${data.baseUrl}/api/workflows/${workflow.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          });
        }
      });
    }
    
    // Delete test user
    http.del(`${data.baseUrl}/api/test/users/${user.id}`);
  });

  console.log('✅ Cleanup complete');
}

// Helper functions
function thinkTime() {
  return Math.random() * 3 + 1; // 1-4 seconds
}

function generateTestData() {
  return {
    timestamp: Date.now(),
    data: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => ({
      id: i,
      value: Math.random() * 100,
      name: `item-${i}`,
      processed: false
    })),
    metadata: {
      source: 'load-test',
      batch: Math.floor(Math.random() * 1000),
      priority: Math.floor(Math.random() * 5) + 1
    }
  };
}

// Scenario variations for different load patterns
export function browseOnlyScenario(data) {
  // Lighter scenario for read-only operations
  const user = users[Math.floor(Math.random() * users.length)];
  const token = authenticateUser(user, data.baseUrl);
  
  if (token) {
    // Just browse workflows and executions
    http.get(`${data.baseUrl}/api/workflows`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { type: 'api', scenario: 'browse-only' }
    });
    
    sleep(1);
    
    http.get(`${data.baseUrl}/api/executions`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { type: 'api', scenario: 'browse-only' }
    });
  }
}

export function heavyProcessingScenario(data) {
  // Heavier scenario with complex workflows
  const user = users[Math.floor(Math.random() * users.length)];
  const token = authenticateUser(user, data.baseUrl);
  
  if (token) {
    const complexWorkflow = workflows[2]; // Use the complex workflow
    
    const createRes = http.post(`${data.baseUrl}/api/workflows`, JSON.stringify(complexWorkflow), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      tags: { type: 'workflow', scenario: 'heavy-processing' }
    });
    
    if (createRes.status === 201) {
      const workflowData = JSON.parse(createRes.body);
      
      // Execute with large dataset
      http.post(`${data.baseUrl}/api/workflows/${workflowData.id}/execute`, JSON.stringify({
        data: generateLargeTestData()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { type: 'workflow', scenario: 'heavy-processing' }
      });
      
      // Cleanup
      http.del(`${data.baseUrl}/api/workflows/${workflowData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  }
}

function authenticateUser(user, baseUrl) {
  const loginRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  if (loginRes.status === 200) {
    return JSON.parse(loginRes.body).token;
  }
  return null;
}

function generateLargeTestData() {
  return {
    timestamp: Date.now(),
    data: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      value: Math.random() * 100,
      name: `large-item-${i}`,
      metadata: {
        category: Math.floor(Math.random() * 10),
        tags: Array.from({ length: 3 }, () => `tag-${Math.floor(Math.random() * 100)}`),
        data: new Array(100).fill(0).map(() => Math.random())
      }
    }))
  };
}