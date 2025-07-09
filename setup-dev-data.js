#!/usr/bin/env node

/**
 * Setup development data for testing
 * Creates AI provider settings for the dev user
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const DEV_TOKEN = 'dev-token-12345';
const BASE_URL = 'http://localhost:8080';

async function setupDevData() {
  console.log('🔧 Setting up development data...\n');

  // Save AI provider settings
  const providers = [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'sk-dev-test-key',
      model: 'o3',
      temperature: 0.7,
      maxTokens: 8000
    },
    {
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY || 'AIzaSyDjlblIVEdpPO3YWJsswuwsEu0r8ZyXEII',
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      maxTokens: 8000
    }
  ];

  for (const provider of providers) {
    try {
      console.log(`📝 Saving ${provider.provider} settings...`);
      
      const response = await fetch(`${BASE_URL}/api/n8n/api/ai-providers/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEV_TOKEN}`
        },
        body: JSON.stringify(provider)
      });

      if (response.ok) {
        console.log(`✅ ${provider.provider} settings saved`);
      } else {
        const error = await response.text();
        console.error(`❌ Failed to save ${provider.provider}:`, error);
      }
    } catch (error) {
      console.error(`❌ Error saving ${provider.provider}:`, error.message);
    }
  }

  // Set OpenAI as active
  try {
    console.log('\n🎯 Setting OpenAI as active provider...');
    
    const response = await fetch(`${BASE_URL}/api/n8n/api/ai-providers/settings/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEV_TOKEN}`
      },
      body: JSON.stringify({ provider: 'openai' })
    });

    if (response.ok) {
      console.log('✅ OpenAI set as active provider');
    } else {
      console.error('❌ Failed to set active provider');
    }
  } catch (error) {
    console.error('❌ Error setting active provider:', error.message);
  }

  console.log('\n✅ Development data setup complete!');
  console.log('\nYou can now use the AI Assistant with these providers:');
  console.log('- OpenAI O3 (active)');
  console.log('- Gemini 2.0 Flash');
}

// Run setup
setupDevData().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});