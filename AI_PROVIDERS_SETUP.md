# AI Provider Settings Implementation

This document describes the implementation of AI provider settings in the Automation Hub MCP Servers.

## Overview

The AI provider settings allow users to:
- Store their API keys securely (encrypted)
- Configure multiple AI providers (OpenAI, Anthropic, Gemini, etc.)
- Select their preferred model for each provider
- Set one provider as active for workflow generation

## Updated Models (January 2025)

### OpenAI
- o3
- o4-mini
- gpt-4.1, gpt-4.1-mini, gpt-4.1-nano
- gpt-4o, gpt-4o-mini
- gpt-4o-realtime-preview-2024-12-17
- o1-preview, o1-mini

### Anthropic
- claude-4-opus
- claude-4-sonnet
- claude-3.7-sonnet
- claude-3.7-sonnet-thinking
- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022

### Google Gemini
- gemini-2.5-pro
- gemini-2.5-flash
- gemini-2.5-flash-lite
- gemini-2.5-pro-deep-think
- gemini-2.0-flash-thinking-exp
- gemini-2.0-flash-exp
- gemini-1.5-pro-002
- gemini-1.5-flash-002

### Meta Llama
- llama-3.3-70b-instruct
- llama-3.2-90b-vision
- llama-3.2-11b-vision
- llama-3.2-3b, llama-3.2-1b
- llama-3.1-405b, llama-3.1-70b, llama-3.1-8b

### DeepSeek
- deepseek-v3-0324
- deepseek-v3
- deepseek-r1
- deepseek-chat
- deepseek-coder

### Perplexity
- sonar-pro
- sonar
- sonar-reasoning
- deepseek-r1
- grok-3-beta
- deep-research

## Architecture

### Frontend (Web Interface)
- `AIProviderSettings.tsx` - UI component for managing AI provider settings
- Allows users to add, test, and manage multiple AI providers
- Shows which provider is active

### Auth Service (auth-mcp)
- `database-ai-providers.ts` - Database schema and queries for AI provider settings
- `http-server.ts` - API endpoints for managing AI provider settings
- Stores encrypted API keys using the existing crypto module

### N8N Service (n8n-mcp)
- `routes/ai-providers.ts` - Routes for AI provider operations
- `http-server-v2.ts` - Updated workflow generation to use stored credentials
- `providers/` - Individual provider implementations (OpenAI, Anthropic, Gemini)

## API Endpoints

### Auth Service
- `GET /api/ai-providers/user/:userId` - Get user's AI provider settings
- `POST /api/ai-providers/settings` - Save AI provider settings
- `POST /api/ai-providers/active` - Set active provider
- `DELETE /api/ai-providers/settings/:provider` - Delete provider settings
- `GET /api/ai-providers/active` - Get active provider with decrypted API key

### N8N Service
- `GET /api/ai-providers/providers` - Get supported providers
- `GET /api/ai-providers/settings` - Get user's settings (proxied to auth)
- `POST /api/ai-providers/settings` - Save settings (proxied to auth)
- `POST /api/ai-providers/models` - Get available models for a provider
- `POST /api/ai-providers/settings/active` - Set active provider

## Usage

### 1. Save AI Provider Settings
```javascript
POST /api/n8n/api/ai-providers/settings
Authorization: Bearer <token>
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8000
}
```

### 2. Generate Workflow with Stored Settings
```javascript
POST /api/n8n/tools/n8n_generate_workflow
Authorization: Bearer <token>
{
  "prompt": "Create a webhook workflow",
  "name": "My Workflow",
  "useUserSettings": true
}
```

### 3. Generate Workflow with Direct API Key
```javascript
POST /api/n8n/tools/n8n_generate_workflow
{
  "prompt": "Create a webhook workflow",
  "name": "My Workflow",
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o"
}
```

## Security

- API keys are encrypted using AES-256-GCM before storage
- Keys are only decrypted server-side when needed
- Each user can only access their own AI provider settings
- Authentication required for all AI provider endpoints

## Testing

Run the test script to verify the implementation:
```bash
node test-ai-providers.js
```

The test script will:
1. Create a test user account
2. Save settings for each AI provider
3. Test connections to verify API keys
4. Generate workflows using stored settings
5. Test direct API key usage

## Future Enhancements

1. Implement remaining providers (Llama, DeepSeek, Perplexity)
2. Add support for custom endpoints (for self-hosted models)
3. Implement usage tracking and limits
4. Add provider-specific configuration options
5. Support for multiple models per provider