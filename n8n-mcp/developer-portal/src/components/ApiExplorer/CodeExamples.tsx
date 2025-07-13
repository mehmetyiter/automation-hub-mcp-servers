import React, { useState } from 'react';
import './CodeExamples.css';

interface CodeExamplesProps {
  operation: string;
  environment: string;
  authToken: string;
}

interface CodeExample {
  language: string;
  label: string;
  code: string;
  description: string;
}

export const CodeExamples: React.FC<CodeExamplesProps> = ({
  operation,
  environment,
  authToken
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('typescript');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const getEnvironmentUrl = (env: string): string => {
    const urls = {
      sandbox: 'https://sandbox-api.n8n-mcp.com',
      staging: 'https://staging-api.n8n-mcp.com',
      production: 'https://api.n8n-mcp.com'
    };
    return urls[env as keyof typeof urls] || urls.production;
  };

  const generateExamples = (op: string): CodeExample[] => {
    const baseUrl = getEnvironmentUrl(environment);
    const [method, path] = op.split('-');
    
    // Parse operation to determine the endpoint and method
    const operationExamples: Record<string, CodeExample[]> = {
      'POST-/workflows': [
        {
          language: 'typescript',
          label: 'TypeScript SDK',
          description: 'Using the official n8n-MCP TypeScript SDK',
          code: `import { N8nMcpClient } from '@n8n-mcp/sdk';

const client = new N8nMcpClient({
  apiKey: '${authToken ? '[REDACTED]' : 'your-api-key'}',
  baseURL: '${baseUrl}',
  timeout: 30000
});

try {
  const workflow = await client.workflows.create({
    name: 'My Automation Workflow',
    description: 'Automated email workflow',
    prompt: 'Send a welcome email when someone submits the contact form',
    tags: ['automation', 'email', 'welcome'],
    active: true
  });
  
  console.log('✅ Workflow created:', {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status
  });
  
  // Optionally start the workflow immediately
  if (workflow.status === 'active') {
    const execution = await client.workflows.execute(workflow.id, {
      data: { test: true }
    });
    console.log('🚀 Workflow executed:', execution.id);
  }
  
} catch (error) {
  console.error('❌ Failed to create workflow:', error.message);
  
  if (error.response?.status === 401) {
    console.error('Authentication failed. Check your API key.');
  } else if (error.response?.status === 422) {
    console.error('Validation error:', error.response.data.details);
  }
}`
        },
        {
          language: 'python',
          label: 'Python SDK',
          description: 'Using the official n8n-MCP Python client',
          code: `from n8n_mcp import Client
from n8n_mcp.exceptions import ApiError, ValidationError

# Initialize client
client = Client(
    api_key='${authToken ? '[REDACTED]' : 'your-api-key'}',
    base_url='${baseUrl}',
    timeout=30
)

try:
    # Create workflow using natural language
    workflow = client.workflows.create(
        name='My Automation Workflow',
        description='Automated email workflow',
        prompt='Send a welcome email when someone submits the contact form',
        tags=['automation', 'email', 'welcome'],
        active=True
    )
    
    print(f"✅ Workflow created: {workflow.id}")
    print(f"   Name: {workflow.name}")
    print(f"   Status: {workflow.status}")
    print(f"   Nodes: {len(workflow.nodes)}")
    
    # Execute workflow if active
    if workflow.status == 'active':
        execution = client.workflows.execute(
            workflow_id=workflow.id,
            data={'test': True}
        )
        print(f"🚀 Workflow executed: {execution.id}")
        
except ValidationError as e:
    print(f"❌ Validation error: {e.message}")
    for detail in e.details:
        print(f"   {detail.field}: {detail.message}")
        
except ApiError as e:
    print(f"❌ API error: {e.message}")
    if e.status_code == 401:
        print("Authentication failed. Check your API key.")
        
except Exception as e:
    print(f"❌ Unexpected error: {str(e)}")`
        },
        {
          language: 'javascript',
          label: 'JavaScript (Node.js)',
          description: 'Using fetch with modern JavaScript',
          code: `const fetch = require('node-fetch'); // npm install node-fetch

async function createWorkflow() {
  const apiUrl = '${baseUrl}/workflows';
  const headers = {
    'Authorization': 'Bearer ${authToken ? '[REDACTED]' : 'your-api-key'}',
    'Content-Type': 'application/json',
    'User-Agent': 'n8n-MCP-Client/1.0.0'
  };
  
  const workflowData = {
    name: 'My Automation Workflow',
    description: 'Automated email workflow',
    prompt: 'Send a welcome email when someone submits the contact form',
    tags: ['automation', 'email', 'welcome'],
    active: true
  };
  
  try {
    console.log('🔄 Creating workflow...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(workflowData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(\`API Error (\${response.status}): \${errorData.message}\`);
    }
    
    const workflow = await response.json();
    
    console.log('✅ Workflow created successfully:');
    console.log(\`   ID: \${workflow.id}\`);
    console.log(\`   Name: \${workflow.name}\`);
    console.log(\`   Status: \${workflow.status}\`);
    console.log(\`   Nodes: \${workflow.nodes.length}\`);
    
    // Execute workflow if needed
    if (workflow.status === 'active') {
      const executionResponse = await fetch(\`\${apiUrl}/\${workflow.id}/execute\`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: { test: true } })
      });
      
      if (executionResponse.ok) {
        const execution = await executionResponse.json();
        console.log(\`🚀 Workflow executed: \${execution.execution_id}\`);
      }
    }
    
    return workflow;
    
  } catch (error) {
    console.error('❌ Failed to create workflow:', error.message);
    
    if (error.message.includes('401')) {
      console.error('💡 Tip: Check your API key authentication');
    } else if (error.message.includes('422')) {
      console.error('💡 Tip: Verify your request data format');
    }
    
    throw error;
  }
}

// Execute the function
createWorkflow()
  .then(workflow => console.log('Done!'))
  .catch(error => process.exit(1));`
        },
        {
          language: 'curl',
          label: 'cURL',
          description: 'Raw HTTP request using cURL',
          code: `#!/bin/bash

# Set variables
API_URL="${baseUrl}/workflows"
API_KEY="${authToken ? '[REDACTED]' : 'your-api-key'}"

# Create workflow
echo "🔄 Creating workflow..."

RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \\
  -X POST "$API_URL" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "User-Agent: curl-client/1.0.0" \\
  -d '{
    "name": "My Automation Workflow",
    "description": "Automated email workflow",
    "prompt": "Send a welcome email when someone submits the contact form",
    "tags": ["automation", "email", "welcome"],
    "active": true
  }')

# Extract HTTP status code
HTTP_STATUS=$(echo $RESPONSE | tr -d '\\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

# Check response
if [ $HTTP_STATUS -eq 201 ]; then
  echo "✅ Workflow created successfully"
  echo "$RESPONSE_BODY" | jq '.'
  
  # Extract workflow ID for execution
  WORKFLOW_ID=$(echo "$RESPONSE_BODY" | jq -r '.id')
  
  # Execute workflow (optional)
  echo "🚀 Executing workflow..."
  curl -s -X POST "$API_URL/$WORKFLOW_ID/execute" \\
    -H "Authorization: Bearer $API_KEY" \\
    -H "Content-Type: application/json" \\
    -d '{"data": {"test": true}}' | jq '.'
    
elif [ $HTTP_STATUS -eq 401 ]; then
  echo "❌ Authentication failed (401)"
  echo "💡 Tip: Check your API key"
  
elif [ $HTTP_STATUS -eq 422 ]; then
  echo "❌ Validation error (422)"
  echo "$RESPONSE_BODY" | jq '.details'
  
else
  echo "❌ Request failed with status: $HTTP_STATUS"
  echo "$RESPONSE_BODY"
fi`
        },
        {
          language: 'go',
          label: 'Go',
          description: 'Using Go with the standard HTTP client',
          code: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type WorkflowRequest struct {
    Name        string   \`json:"name"\`
    Description string   \`json:"description"\`
    Prompt      string   \`json:"prompt"\`
    Tags        []string \`json:"tags"\`
    Active      bool     \`json:"active"\`
}

type WorkflowResponse struct {
    ID          string \`json:"id"\`
    Name        string \`json:"name"\`
    Description string \`json:"description"\`
    Status      string \`json:"status"\`
    CreatedAt   string \`json:"created_at"\`
}

type ErrorResponse struct {
    Error   string \`json:"error"\`
    Message string \`json:"message"\`
}

func main() {
    client := &http.Client{
        Timeout: 30 * time.Second,
    }
    
    // Prepare request data
    workflowReq := WorkflowRequest{
        Name:        "My Automation Workflow",
        Description: "Automated email workflow", 
        Prompt:      "Send a welcome email when someone submits the contact form",
        Tags:        []string{"automation", "email", "welcome"},
        Active:      true,
    }
    
    jsonData, err := json.Marshal(workflowReq)
    if err != nil {
        fmt.Printf("❌ Failed to marshal JSON: %v\\n", err)
        return
    }
    
    // Create HTTP request
    req, err := http.NewRequest("POST", "${baseUrl}/workflows", bytes.NewBuffer(jsonData))
    if err != nil {
        fmt.Printf("❌ Failed to create request: %v\\n", err)
        return
    }
    
    // Set headers
    req.Header.Set("Authorization", "Bearer ${authToken ? '[REDACTED]' : 'your-api-key'}")
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("User-Agent", "go-client/1.0.0")
    
    fmt.Println("🔄 Creating workflow...")
    
    // Send request
    resp, err := client.Do(req)
    if err != nil {
        fmt.Printf("❌ Request failed: %v\\n", err)
        return
    }
    defer resp.Body.Close()
    
    // Read response
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        fmt.Printf("❌ Failed to read response: %v\\n", err)
        return
    }
    
    // Handle response
    switch resp.StatusCode {
    case 201:
        var workflow WorkflowResponse
        if err := json.Unmarshal(body, &workflow); err != nil {
            fmt.Printf("❌ Failed to parse response: %v\\n", err)
            return
        }
        
        fmt.Println("✅ Workflow created successfully:")
        fmt.Printf("   ID: %s\\n", workflow.ID)
        fmt.Printf("   Name: %s\\n", workflow.Name)
        fmt.Printf("   Status: %s\\n", workflow.Status)
        fmt.Printf("   Created: %s\\n", workflow.CreatedAt)
        
    case 401:
        fmt.Println("❌ Authentication failed (401)")
        fmt.Println("💡 Tip: Check your API key")
        
    case 422:
        var errorResp ErrorResponse
        json.Unmarshal(body, &errorResp)
        fmt.Printf("❌ Validation error (422): %s\\n", errorResp.Message)
        
    default:
        fmt.Printf("❌ Request failed with status %d\\n", resp.StatusCode)
        fmt.Printf("Response: %s\\n", string(body))
    }
}`
        }
      ]
    };

    // Get examples for the current operation or fallback to workflow creation
    const operationKey = `${method?.toUpperCase()}-${path}`;
    return operationExamples[operationKey] || operationExamples['POST-/workflows'] || [];
  };

  const examples = generateExamples(operation);
  const selectedExample = examples.find(ex => ex.language === selectedLanguage) || examples[0];

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  if (!examples.length) {
    return (
      <div className="code-examples">
        <h3>Code Examples</h3>
        <div className="no-examples">
          No code examples available for this operation.
        </div>
      </div>
    );
  }

  return (
    <div className="code-examples">
      <div className="examples-header">
        <h3>Code Examples</h3>
        <div className="language-selector">
          {examples.map((example) => (
            <button
              key={example.language}
              type="button"
              onClick={() => setSelectedLanguage(example.language)}
              className={`language-btn ${selectedLanguage === example.language ? 'active' : ''}`}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {selectedExample && (
        <div className="example-content">
          <div className="example-meta">
            <div className="example-description">
              {selectedExample.description}
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(selectedExample.code)}
              className={`copy-btn ${copyStatus}`}
              title="Copy to clipboard"
            >
              {copyStatus === 'copied' ? '✅' : copyStatus === 'error' ? '❌' : '📋'}
            </button>
          </div>
          
          <div className="code-block">
            <pre>
              <code className={`language-${selectedExample.language}`}>
                {selectedExample.code}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};