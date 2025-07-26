#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3006';
const AUTH_TOKEN = 'dev-token-12345'; // Using dev token for testing

async function testWorkflowGeneration() {
  console.log('=== Testing Workflow Generation with Credentials ===\n');

  // Test 1: With useUserSettings but no credentialId (should fall back to active provider)
  console.log('Test 1: useUserSettings=true, no credentialId');
  try {
    const response = await fetch(`${API_BASE}/tools/n8n_generate_workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        prompt: 'Create a simple webhook that sends an email',
        name: 'Test Workflow 1',
        useUserSettings: true
        // Note: credentialId is not provided
      })
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n---\n');

  // Test 2: With specific provider but no credentialId
  console.log('Test 2: provider=anthropic, no credentialId');
  try {
    const response = await fetch(`${API_BASE}/tools/n8n_generate_workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        prompt: 'Create a simple webhook that sends an email',
        name: 'Test Workflow 2',
        provider: 'anthropic',
        useUserSettings: true
      })
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n---\n');

  // Test 3: With environment variable fallback
  console.log('Test 3: No user settings, should use environment variables');
  try {
    const response = await fetch(`${API_BASE}/tools/n8n_generate_workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        prompt: 'Create a simple webhook that sends an email',
        name: 'Test Workflow 3',
        useUserSettings: false
      })
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testChatCompletion() {
  console.log('\n\n=== Testing Chat Completion with Credentials ===\n');

  // Test chat with useUserSettings
  console.log('Test: Chat with useUserSettings=true');
  try {
    const response = await fetch(`${API_BASE}/api/ai-providers/chat/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Help me create a workflow for processing invoices'
          }
        ],
        useUserSettings: true
      })
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run tests
console.log('Starting credential flow tests...\n');
console.log('Make sure the server is running on port 3006\n');

testWorkflowGeneration()
  .then(() => testChatCompletion())
  .catch(console.error);