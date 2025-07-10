// Test setup file for Jest
import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.API_GATEWAY_URL = 'http://localhost:8080/api';

// Global test utilities
global.createMockRequest = (overrides = {}) => ({
  description: 'Test code generation',
  nodeType: 'code',
  workflowContext: {},
  ...overrides
});

global.createMockExecutionContext = (inputData = []) => ({
  $input: {
    all: () => inputData.map(data => ({ json: data }))
  },
  $json: {},
  $node: {},
  $workflow: {},
  $item: {}
});

// Mock AI Service responses
jest.mock('../src/ai-service', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    callAI: jest.fn().mockImplementation((prompt: string) => {
      // Return mock code based on prompt content
      if (prompt.includes('Python')) {
        return `
# Mock generated Python code
items = $input.all()
processed_items = []

for item in items:
    data = item['json']
    result = {
        **data,
        'processed': True
    }
    processed_items.append({'json': result})

return processed_items`;
      }
      
      // Default JavaScript mock
      return `
// Mock generated JavaScript code
const inputItems = $input.all();
const processedItems = [];

for (const item of inputItems) {
  const data = item.json;
  processedItems.push({
    json: {
      ...data,
      processed: true
    }
  });
}

return processedItems;`;
    }),
    
    getJSONResponse: jest.fn().mockImplementation(() => ({
      intent: {
        primary: 'data transformation',
        secondary: ['filtering', 'mapping']
      },
      complexity: 'moderate',
      suggestions: []
    }))
  }))
}));

// Suppress console logs during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console.log = jest.fn();
  global.console.error = jest.fn();
}

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});