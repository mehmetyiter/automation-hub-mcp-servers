#!/usr/bin/env node

/**
 * Test script for Gemini credential with model dropdown
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

// Gemini API key from console.md
const geminiApiKey = 'AIzaSyDjlblIVEdpPO3YWJsswuwsEu0r8ZyXEII';

async function login() {
  console.log('🔐 Logging in...');
  
  try {
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

async function getCredentialTemplates() {
  console.log('\n📋 Fetching credential templates...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/auth/credentials/templates`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const geminiTemplate = data.data.find(t => t.id === 'google_ai');
      
      if (geminiTemplate) {
        console.log('✅ Found Google AI (Gemini) template');
        console.log('   Available models:', geminiTemplate.fields.find(f => f.key === 'model')?.options.join(', '));
        return geminiTemplate;
      } else {
        console.error('❌ Google AI template not found');
        return null;
      }
    } else {
      console.error('❌ Failed to fetch templates');
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching templates:', error.message);
    return null;
  }
}

async function createGeminiCredential() {
  console.log('\n🔧 Creating Gemini credential...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/auth/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'My Gemini API',
        templateId: 'google_ai',
        values: {
          apiKey: geminiApiKey,
          model: 'gemini-2.0-flash-exp'
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Gemini credential created successfully');
      console.log('   Credential ID:', data.data.id);
      return data.data.id;
    } else {
      const error = await response.text();
      console.error('❌ Failed to create credential:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating credential:', error.message);
    return null;
  }
}

async function testGeminiCredential(credentialId) {
  console.log('\n🧪 Testing Gemini credential...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/auth/credentials/${credentialId}/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Test result: ${data.data.valid ? 'VALID' : 'INVALID'}`);
      console.log(`   Message: ${data.data.message}`);
      return data.data.valid;
    } else {
      console.error('❌ Failed to test credential');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing credential:', error.message);
    return false;
  }
}

async function testWorkflowGeneration() {
  console.log('\n🔄 Testing workflow generation with Gemini...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/n8n/tools/n8n_generate_workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'Create a simple webhook that responds with "Hello from Gemini"',
        name: 'Gemini Test Workflow',
        provider: 'gemini',
        apiKey: geminiApiKey,
        model: 'gemini-2.0-flash-exp'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Workflow generated successfully with Gemini!');
      console.log(`   Provider: ${data.data.provider}`);
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
  console.log('🚀 Starting Gemini Credential Tests\n');
  console.log('📍 Using Gemini API Key:', geminiApiKey.substring(0, 10) + '...');
  
  // Login
  if (!await login()) {
    console.error('❌ Failed to authenticate. Exiting...');
    process.exit(1);
  }
  
  // Get templates
  const template = await getCredentialTemplates();
  if (!template) {
    console.error('❌ Failed to get credential template. Exiting...');
    process.exit(1);
  }
  
  // Create credential
  const credentialId = await createGeminiCredential();
  if (!credentialId) {
    console.error('❌ Failed to create credential. Exiting...');
    process.exit(1);
  }
  
  // Test credential
  await testGeminiCredential(credentialId);
  
  // Test workflow generation
  await testWorkflowGeneration();
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});