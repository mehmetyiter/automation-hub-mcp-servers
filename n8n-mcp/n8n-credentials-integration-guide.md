# n8n Credentials Integration Guide

## Overview

This document provides a comprehensive understanding of how n8n handles credentials and how to integrate your platform's stored credentials with n8n workflows.

## Current n8n-MCP Server Capabilities

### 1. Credential Listing
The n8n-MCP server currently provides a read-only endpoint for listing credentials:

```typescript
// From n8n-client.ts
async getCredentials(): Promise<N8nCredential[]> {
  const response = await this.client.get('/credentials');
  return response.data.data || [];
}
```

The `N8nCredential` interface includes:
- `id`: Unique identifier
- `name`: Display name
- `type`: Credential type (e.g., 'slackApi', 'postgresDb')
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

### 2. Missing Functionality
Currently, the n8n-MCP server does NOT provide methods for:
- Creating new credentials
- Updating existing credentials
- Deleting credentials
- Retrieving credential details/data

## n8n Credential Storage and Reference Structure

### 1. How n8n Stores Credentials
- Credentials are stored encrypted in n8n's database
- Each credential has a unique ID and type
- The actual credential data (tokens, passwords, etc.) is encrypted

### 2. How Workflows Reference Credentials
Nodes in n8n workflows reference credentials by their ID in the node's parameters:

```json
{
  "id": "slack_node",
  "name": "Send Slack Message",
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.2,
  "position": [600, 300],
  "parameters": {
    "authentication": "oAuth2",
    "resource": "message",
    "operation": "post",
    "channel": "#general",
    "text": "Hello from n8n!"
  },
  "credentials": {
    "slackApi": {
      "id": "credential_id_here",
      "name": "My Slack Credentials"
    }
  }
}
```

### 3. Credential Types
Each node type requires specific credential types:
- Slack nodes: `slackApi` or `slackOAuth2Api`
- PostgreSQL nodes: `postgres`
- HTTP Request nodes: Various types based on authentication method

## Integration Strategies

### 1. Direct API Integration (Requires n8n API Extension)
To programmatically manage credentials, you would need to:

```typescript
// Proposed credential management methods (not yet implemented)
interface CredentialData {
  name: string;
  type: string;
  data: Record<string, any>; // Encrypted credential data
}

// Create credential
async createCredential(credential: CredentialData): Promise<N8nCredential> {
  const response = await this.client.post('/credentials', credential);
  return response.data.data;
}

// Update credential
async updateCredential(id: string, updates: Partial<CredentialData>): Promise<N8nCredential> {
  const response = await this.client.patch(`/credentials/${id}`, updates);
  return response.data.data;
}

// Delete credential
async deleteCredential(id: string): Promise<void> {
  await this.client.delete(`/credentials/${id}`);
}
```

### 2. Credential Mapping Architecture
To map your platform's credentials to n8n:

```typescript
interface PlatformCredential {
  id: string;
  service: string;
  credentials: {
    apiKey?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

interface CredentialMapping {
  platformCredentialId: string;
  n8nCredentialId: string;
  n8nCredentialType: string;
  lastSynced: Date;
}

// Map platform credential types to n8n credential types
const CREDENTIAL_TYPE_MAP = {
  'slack': 'slackApi',
  'postgres': 'postgres',
  'http_api': 'httpHeaderAuth',
  'oauth2': 'oAuth2Api'
};
```

### 3. Workflow Creation with Credentials
When creating workflows programmatically, include credential references:

```typescript
const workflowWithCredentials = {
  name: "Slack Notification Workflow",
  nodes: [
    {
      id: "webhook",
      name: "Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [250, 300],
      parameters: {
        httpMethod: "POST",
        path: "notify"
      }
    },
    {
      id: "slack",
      name: "Send Slack Message",
      type: "n8n-nodes-base.slack",
      typeVersion: 2.2,
      position: [450, 300],
      parameters: {
        resource: "message",
        operation": "post",
        channel": "={{$json.channel}}",
        text": "={{$json.message}}"
      },
      credentials: {
        slackApi: {
          id: "your_n8n_credential_id",
          name: "Platform Slack Credentials"
        }
      }
    }
  ],
  connections: {
    "Webhook": {
      "main": [[{ "node": "Send Slack Message", "type": "main", "index": 0 }]]
    }
  }
};
```

## Implementation Recommendations

### 1. Extend n8n-MCP Server
Add credential management capabilities to the n8n-client.ts:

```typescript
// Add to n8n-client.ts
async createCredential(credential: {
  name: string;
  type: string;
  data: Record<string, any>;
}): Promise<N8nCredential> {
  const response = await this.client.post('/credentials', credential);
  return response.data.data;
}

async updateCredential(id: string, updates: Partial<{
  name: string;
  data: Record<string, any>;
}>): Promise<N8nCredential> {
  const response = await this.client.patch(`/credentials/${id}`, updates);
  return response.data.data;
}

async deleteCredential(id: string): Promise<void> {
  await this.client.delete(`/credentials/${id}`);
}

async getCredentialSchema(type: string): Promise<any> {
  const response = await this.client.get(`/credential-types/${type}`);
  return response.data.data;
}
```

### 2. Create Credential Sync Service
Build a service to sync platform credentials with n8n:

```typescript
class CredentialSyncService {
  constructor(
    private n8nClient: N8nClient,
    private platformCredentialStore: any
  ) {}

  async syncCredential(platformCredential: PlatformCredential): Promise<string> {
    // Check if credential already exists in n8n
    const existingCredentials = await this.n8nClient.getCredentials();
    const existing = existingCredentials.find(
      c => c.name === `Platform_${platformCredential.id}`
    );

    const credentialData = this.mapPlatformToN8n(platformCredential);

    if (existing) {
      // Update existing credential
      await this.n8nClient.updateCredential(existing.id, {
        data: credentialData.data
      });
      return existing.id;
    } else {
      // Create new credential
      const created = await this.n8nClient.createCredential(credentialData);
      return created.id;
    }
  }

  private mapPlatformToN8n(platformCredential: PlatformCredential) {
    const type = CREDENTIAL_TYPE_MAP[platformCredential.service];
    
    switch (type) {
      case 'slackApi':
        return {
          name: `Platform_${platformCredential.id}`,
          type: 'slackApi',
          data: {
            accessToken: platformCredential.credentials.token
          }
        };
      
      case 'postgres':
        return {
          name: `Platform_${platformCredential.id}`,
          type: 'postgres',
          data: {
            host: platformCredential.credentials.host,
            port: platformCredential.credentials.port,
            database: platformCredential.credentials.database,
            user: platformCredential.credentials.user,
            password: platformCredential.credentials.password
          }
        };
      
      // Add more mappings as needed
    }
  }
}
```

### 3. Workflow Template with Dynamic Credentials
Create workflow templates that can accept credential IDs:

```typescript
function createSlackWorkflow(credentialId: string, workflowName: string) {
  return {
    name: workflowName,
    nodes: [
      {
        id: "trigger",
        name: "When Called",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [250, 300],
        parameters: {}
      },
      {
        id: "slack",
        name: "Send to Slack",
        type: "n8n-nodes-base.slack",
        typeVersion: 2.2,
        position: [450, 300],
        parameters: {
          resource: "message",
          operation: "post",
          channel: "#notifications",
          text: "Automated message from platform"
        },
        credentials: {
          slackApi: {
            id: credentialId,
            name: "Platform Managed Credential"
          }
        }
      }
    ],
    connections: {
      "When Called": {
        "main": [[{ "node": "Send to Slack", "type": "main", "index": 0 }]]
      }
    }
  };
}
```

## Security Considerations

1. **Credential Encryption**: Ensure all credential data is encrypted both in transit and at rest
2. **Access Control**: Implement proper access control for credential management
3. **Audit Logging**: Log all credential operations for security auditing
4. **Rotation**: Implement credential rotation capabilities
5. **Validation**: Validate credential data before syncing to n8n

## Next Steps

1. **Verify n8n API Capabilities**: Check if your n8n instance supports credential management via API
2. **Implement Credential Sync**: Build the credential synchronization service
3. **Test Integration**: Test with non-production credentials first
4. **Monitor Usage**: Track credential usage and implement alerts for failures

## Example: Complete Slack Integration

```typescript
// 1. Sync platform Slack credential to n8n
const slackCredentialId = await credentialSync.syncCredential({
  id: 'platform_slack_001',
  service: 'slack',
  credentials: {
    token: 'xoxb-your-slack-bot-token'
  }
});

// 2. Create workflow using the synced credential
const workflow = createSlackWorkflow(slackCredentialId, 'Platform Slack Notifications');

// 3. Deploy workflow to n8n
const deployedWorkflow = await n8nClient.createWorkflow(workflow);

// 4. Activate workflow
await n8nClient.activateWorkflow(deployedWorkflow.id);
```

This integration approach allows you to maintain credentials in your platform while seamlessly using them in n8n workflows.