#!/usr/bin/env node

/**
 * Test script for AI provider settings
 * Tests saving, retrieving, and using AI provider credentials
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8080';
let authToken = null;

// Test credentials
const testUser = {
  email: 'test@example.com',
  password: 'test123',
  name: 'Test User'
};

// Test AI providers
const testProviders = [
  {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8000
  },
  {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 8000
  },
  {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || 'AIza-test-key',
    model: 'gemini-2.0-flash-exp',
    temperature: 0.7,
    maxTokens: 8000
  }
];

async function login() {
  console.log('🔐 Logging in...');
  
  try {
    // Try login first
    const loginResponse = await fetch(`${BASE_URL}/api/auth/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    if (loginResponse.ok) {
      const data = await loginResponse.json();
      authToken = data.data.accessToken;
      console.log('✅ Logged in successfully');
      return true;
    }
    
    // If login fails, try to register
    console.log('📝 Login failed, trying to register...');
    const registerResponse = await fetch(`${BASE_URL}/api/auth/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (registerResponse.ok) {
      const data = await registerResponse.json();
      authToken = data.data.accessToken;
      console.log('✅ Registered and logged in successfully');
      return true;
    }
    
    console.error('❌ Failed to login or register');
    return false;
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    return false;
  }
}

async function saveAIProvider(providerConfig) {
  console.log(`\n💾 Saving ${providerConfig.provider} settings...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/n8n/api/ai-providers/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(providerConfig)
    });
    
    if (response.ok) {
      console.log(`✅ ${providerConfig.provider} settings saved successfully`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ Failed to save ${providerConfig.provider}:`, error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error saving ${providerConfig.provider}:`, error.message);
    return false;
  }
}

async function testConnection(provider) {
  console.log(`\n🔌 Testing ${provider} connection...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/n8n/api/ai-providers/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        provider: provider,
        apiKey: testProviders.find(p => p.provider === provider).apiKey
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${provider} connection successful!`);
      if (data.models && data.models.length > 0) {
        console.log(`   Found ${data.models.length} models:`, data.models.slice(0, 5).join(', '), '...');
      }
      return true;
    } else {
      console.error(`❌ ${provider} connection failed`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing ${provider}:`, error.message);
    return false;
  }
}

async function setActiveProvider(provider) {
  console.log(`\n🎯 Setting ${provider} as active provider...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/n8n/api/ai-providers/settings/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ provider })
    });
    
    if (response.ok) {
      console.log(`✅ ${provider} set as active provider`);
      return true;
    } else {
      console.error(`❌ Failed to set ${provider} as active`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error setting active provider:`, error.message);
    return false;
  }
}

async function testWorkflowGeneration(useUserSettings = false) {
  console.log(`\n🔧 Testing workflow generation (useUserSettings: ${useUserSettings})...`);
  
  try {
    const body = {
      prompt: 'Create a simple webhook that responds with "Hello World"',
      name: 'Test Workflow',
      useUserSettings: useUserSettings
    };
    
    // If not using user settings, provide API key directly
    if (!useUserSettings) {
      body.provider = 'openai';
      body.apiKey = testProviders[0].apiKey;
    }
    
    const response = await fetch(`${BASE_URL}/api/n8n/tools/n8n_generate_workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(body)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Workflow generated successfully!');
      console.log(`   Provider used: ${data.data.provider}`);
      console.log(`   Nodes: ${data.data.workflow.nodes.length}`);
      console.log(`   Connections: ${Object.keys(data.data.workflow.connections).length}`);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to generate workflow:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error generating workflow:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting AI Provider Tests\n');
  
  // Login
  if (!await login()) {
    console.error('❌ Failed to authenticate. Exiting...');
    process.exit(1);
  }
  
  // Save all providers
  for (const provider of testProviders) {
    await saveAIProvider(provider);
  }
  
  // Test connections
  for (const provider of testProviders) {
    await testConnection(provider.provider);
  }
  
  // Set each as active and test workflow generation
  for (const provider of testProviders) {
    await setActiveProvider(provider.provider);
    await testWorkflowGeneration(true); // Use stored settings
  }
  
  // Test direct API key usage
  console.log('\n📊 Testing direct API key usage...');
  await testWorkflowGeneration(false);
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});