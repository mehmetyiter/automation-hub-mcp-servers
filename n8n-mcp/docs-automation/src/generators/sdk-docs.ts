import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { TypeDocApplication, TypeDocOptions } from 'typedoc';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SDKDocsOptions {
  language: string;
  input: string;
  output: string;
  includeExamples?: boolean;
  includeApiReference?: boolean;
  theme?: string;
}

export class SDKDocsGenerator {
  async generate(options: SDKDocsOptions): Promise<void> {
    const spinner = ora(`Generating ${options.language} SDK documentation...`).start();
    
    try {
      // Create output directory
      await fs.mkdir(options.output, { recursive: true });
      
      // Generate docs based on language
      switch (options.language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          await this.generateTypeScriptDocs(options);
          break;
        case 'python':
          await this.generatePythonDocs(options);
          break;
        case 'go':
          await this.generateGoDocs(options);
          break;
        case 'java':
          await this.generateJavaDocs(options);
          break;
        case 'csharp':
        case 'c#':
          await this.generateCSharpDocs(options);
          break;
        case 'ruby':
          await this.generateRubyDocs(options);
          break;
        case 'php':
          await this.generatePHPDocs(options);
          break;
        default:
          throw new Error(`Unsupported language: ${options.language}`);
      }
      
      // Generate common documentation
      await this.generateCommonDocs(options);
      
      spinner.succeed('SDK documentation generated');
    } catch (error) {
      spinner.fail('Failed to generate SDK documentation');
      throw error;
    }
  }

  async generateFromConfig(configFile: string): Promise<void> {
    const config = JSON.parse(await fs.readFile(configFile, 'utf-8'));
    
    for (const language of config.sdk.languages) {
      await this.generate({
        language,
        input: config.sdk.input || `./sdk/${language}`,
        output: path.join(config.sdk.output, language),
        includeExamples: config.sdk.includeExamples !== false
      });
    }
  }

  private async generateTypeScriptDocs(options: SDKDocsOptions): Promise<void> {
    // Use TypeDoc for TypeScript/JavaScript
    const app = new TypeDocApplication();
    
    app.options.addReader(new (require('typedoc').TSConfigReader)());
    
    await app.bootstrapWithPlugins({
      entryPoints: [options.input],
      out: options.output,
      plugin: ['typedoc-plugin-markdown'],
      theme: 'markdown',
      readme: path.join(options.input, 'README.md'),
      excludePrivate: true,
      excludeProtected: true,
      excludeInternal: true,
      categorizeByGroup: true,
      navigationLinks: {
        'GitHub': 'https://github.com/n8n-mcp/sdk-typescript',
        'npm': 'https://www.npmjs.com/package/@n8n-mcp/sdk'
      }
    } as Partial<TypeDocOptions>);
    
    const project = await app.convert();
    
    if (project) {
      await app.generateDocs(project, options.output);
      
      // Generate additional documentation
      await this.generateTypeScriptExamples(options);
      await this.generateTypeScriptQuickstart(options);
    }
  }

  private async generateTypeScriptExamples(options: SDKDocsOptions): Promise<void> {
    const examplesContent = `# TypeScript SDK Examples

## Installation

\`\`\`bash
npm install @n8n-mcp/sdk
# or
yarn add @n8n-mcp/sdk
\`\`\`

## Basic Usage

### Initialize the Client

\`\`\`typescript
import { N8nMcpClient } from '@n8n-mcp/sdk';

const client = new N8nMcpClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.n8n-mcp.com' // optional
});
\`\`\`

### List Workflows

\`\`\`typescript
async function listWorkflows() {
  try {
    const workflows = await client.workflows.list({
      limit: 20,
      page: 1
    });
    
    console.log(\`Found \${workflows.pagination.total} workflows\`);
    
    workflows.data.forEach(workflow => {
      console.log(\`- \${workflow.name} (ID: \${workflow.id})\`);
    });
  } catch (error) {
    console.error('Error listing workflows:', error);
  }
}
\`\`\`

### Create a Workflow

\`\`\`typescript
async function createWorkflow() {
  const workflow = await client.workflows.create({
    name: 'My Automated Workflow',
    nodes: [
      {
        id: 'webhook_1',
        type: 'webhook',
        position: [100, 100],
        parameters: {
          path: '/my-webhook',
          method: 'POST'
        }
      },
      {
        id: 'transform_1',
        type: 'transform',
        position: [300, 100],
        parameters: {
          expression: 'return { processed: true, ...item }'
        }
      }
    ],
    connections: {
      webhook_1: [
        {
          node: 'transform_1',
          type: 'main',
          index: 0
        }
      ]
    }
  });
  
  console.log('Created workflow:', workflow.id);
}
\`\`\`

### Execute a Workflow

\`\`\`typescript
async function executeWorkflow(workflowId: string) {
  try {
    const execution = await client.workflows.execute(workflowId, {
      data: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    
    console.log('Execution started:', execution.id);
    
    // Wait for completion
    const result = await client.executions.waitForCompletion(execution.id);
    
    console.log('Execution completed:', result.status);
    console.log('Output:', result.data);
  } catch (error) {
    console.error('Execution failed:', error);
  }
}
\`\`\`

### Error Handling

\`\`\`typescript
import { ApiError, ValidationError } from '@n8n-mcp/sdk';

async function safeWorkflowOperation() {
  try {
    const workflow = await client.workflows.get('non-existent-id');
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.details);
    } else if (error instanceof ApiError) {
      switch (error.status) {
        case 404:
          console.error('Workflow not found');
          break;
        case 401:
          console.error('Authentication failed');
          break;
        default:
          console.error('API error:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
\`\`\`

### Pagination

\`\`\`typescript
async function getAllWorkflows() {
  const allWorkflows = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await client.workflows.list({
      page,
      limit: 100
    });
    
    allWorkflows.push(...response.data);
    
    hasMore = page < response.pagination.totalPages;
    page++;
  }
  
  console.log(\`Total workflows: \${allWorkflows.length}\`);
  return allWorkflows;
}
\`\`\`

### Streaming Logs

\`\`\`typescript
async function streamExecutionLogs(executionId: string) {
  const stream = await client.executions.streamLogs(executionId);
  
  stream.on('log', (log) => {
    console.log(\`[\${log.timestamp}] [\${log.level}] \${log.message}\`);
  });
  
  stream.on('error', (error) => {
    console.error('Stream error:', error);
  });
  
  stream.on('end', () => {
    console.log('Stream ended');
  });
}
\`\`\`

### Using with TypeScript

\`\`\`typescript
import { 
  Workflow, 
  WorkflowNode, 
  Execution,
  PaginatedResponse 
} from '@n8n-mcp/sdk';

interface CustomWorkflowData {
  customField: string;
  priority: number;
}

async function typedWorkflowExample(): Promise<void> {
  // Type-safe workflow creation
  const workflow: Partial<Workflow> = {
    name: 'Typed Workflow',
    nodes: [
      {
        id: 'node1',
        type: 'webhook',
        position: [0, 0],
        parameters: {}
      } as WorkflowNode
    ]
  };
  
  const created = await client.workflows.create(workflow);
  
  // Type-safe execution
  const execution = await client.workflows.execute<CustomWorkflowData>(
    created.id,
    {
      customField: 'value',
      priority: 1
    }
  );
}
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'examples.md'),
      examplesContent
    );
  }

  private async generateTypeScriptQuickstart(options: SDKDocsOptions): Promise<void> {
    const quickstartContent = `# Quick Start Guide

## Prerequisites

- Node.js 14 or higher
- npm or yarn
- n8n-MCP API key

## Installation

\`\`\`bash
npm install @n8n-mcp/sdk
\`\`\`

## Your First Script

Create a new file \`hello-n8n-mcp.ts\`:

\`\`\`typescript
import { N8nMcpClient } from '@n8n-mcp/sdk';

async function main() {
  // Initialize client
  const client = new N8nMcpClient({
    apiKey: process.env.N8N_MCP_API_KEY!
  });
  
  // Create a simple workflow
  const workflow = await client.workflows.create({
    name: 'Hello World Workflow',
    nodes: [
      {
        id: 'manual',
        type: 'manual',
        position: [250, 300]
      }
    ],
    connections: {}
  });
  
  console.log('Created workflow:', workflow.id);
  
  // Execute the workflow
  const execution = await client.workflows.execute(workflow.id);
  console.log('Execution started:', execution.id);
}

main().catch(console.error);
\`\`\`

## Run the Script

\`\`\`bash
# Set your API key
export N8N_MCP_API_KEY="your-api-key"

# Run with ts-node
npx ts-node hello-n8n-mcp.ts

# Or compile and run
tsc hello-n8n-mcp.ts
node hello-n8n-mcp.js
\`\`\`

## Next Steps

1. Explore the [API Reference](./classes/N8nMcpClient.html)
2. Check out more [Examples](./examples.html)
3. Learn about [Error Handling](./examples.html#error-handling)
4. Set up [Webhook Workflows](./examples.html#webhook-workflows)
`;

    await fs.writeFile(
      path.join(options.output, 'quickstart.md'),
      quickstartContent
    );
  }

  private async generatePythonDocs(options: SDKDocsOptions): Promise<void> {
    try {
      // Use Sphinx for Python documentation
      await execAsync(`cd ${options.input} && sphinx-quickstart -q --no-sep --project="n8n-MCP Python SDK" --author="n8n-MCP" -v 1.0 --ext-autodoc --ext-viewcode --makefile`);
      
      // Generate API docs
      await execAsync(`cd ${options.input} && sphinx-apidoc -o docs/source .`);
      
      // Build HTML docs
      await execAsync(`cd ${options.input} && make -C docs html`);
      
      // Copy to output directory
      await execAsync(`cp -r ${options.input}/docs/build/html/* ${options.output}/`);
    } catch (error) {
      // Fallback to manual documentation generation
      await this.generatePythonDocsManual(options);
    }
  }

  private async generatePythonDocsManual(options: SDKDocsOptions): Promise<void> {
    const readmeContent = `# Python SDK Documentation

## Installation

\`\`\`bash
pip install n8n-mcp
\`\`\`

## Quick Start

\`\`\`python
from n8n_mcp import Client

# Initialize client
client = Client(api_key="your-api-key")

# List workflows
workflows = client.workflows.list()
for workflow in workflows.data:
    print(f"- {workflow.name} (ID: {workflow.id})")

# Create a workflow
workflow = client.workflows.create({
    "name": "My Python Workflow",
    "nodes": [
        {
            "id": "webhook_1",
            "type": "webhook",
            "position": [100, 100],
            "parameters": {
                "path": "/webhook",
                "method": "POST"
            }
        }
    ],
    "connections": {}
})

print(f"Created workflow: {workflow.id}")

# Execute workflow
execution = client.workflows.execute(workflow.id, {
    "data": {"test": True}
})

print(f"Execution started: {execution.id}")
\`\`\`

## API Reference

### Client

\`\`\`python
class Client:
    def __init__(self, api_key: str, base_url: str = "https://api.n8n-mcp.com"):
        """Initialize the n8n-MCP client.
        
        Args:
            api_key: Your API key
            base_url: API base URL (optional)
        """
\`\`\`

### Workflows Resource

\`\`\`python
class WorkflowsResource:
    def list(self, limit: int = 20, page: int = 1) -> PaginatedResponse[Workflow]:
        """List workflows."""
        
    def get(self, workflow_id: str) -> Workflow:
        """Get workflow by ID."""
        
    def create(self, data: Dict[str, Any]) -> Workflow:
        """Create a new workflow."""
        
    def update(self, workflow_id: str, data: Dict[str, Any]) -> Workflow:
        """Update a workflow."""
        
    def delete(self, workflow_id: str) -> None:
        """Delete a workflow."""
        
    def execute(self, workflow_id: str, data: Optional[Dict[str, Any]] = None) -> Execution:
        """Execute a workflow."""
\`\`\`

### Error Handling

\`\`\`python
from n8n_mcp import Client, ApiError, ValidationError

client = Client(api_key="your-api-key")

try:
    workflow = client.workflows.get("non-existent")
except ValidationError as e:
    print(f"Validation error: {e.details}")
except ApiError as e:
    if e.status_code == 404:
        print("Workflow not found")
    else:
        print(f"API error: {e.message}")
\`\`\`

## Examples

### Async Operations

\`\`\`python
import asyncio
from n8n_mcp import AsyncClient

async def main():
    client = AsyncClient(api_key="your-api-key")
    
    # Async workflow operations
    workflows = await client.workflows.list()
    
    # Execute multiple workflows concurrently
    tasks = [
        client.workflows.execute(wf.id)
        for wf in workflows.data[:5]
    ]
    
    executions = await asyncio.gather(*tasks)
    print(f"Started {len(executions)} executions")

asyncio.run(main())
\`\`\`

### Pagination

\`\`\`python
def get_all_workflows(client):
    """Get all workflows using pagination."""
    all_workflows = []
    page = 1
    
    while True:
        response = client.workflows.list(page=page, limit=100)
        all_workflows.extend(response.data)
        
        if page >= response.pagination.total_pages:
            break
            
        page += 1
    
    return all_workflows
\`\`\`

### Context Managers

\`\`\`python
from n8n_mcp import Client

# Automatic cleanup with context manager
with Client(api_key="your-api-key") as client:
    workflows = client.workflows.list()
    # Client automatically closes connections when done
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'README.md'),
      readmeContent
    );
  }

  private async generateGoDocs(options: SDKDocsOptions): Promise<void> {
    try {
      // Use godoc for Go documentation
      await execAsync(`cd ${options.input} && godoc -http=:6060 &`);
      
      // Wait a moment for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Download the documentation
      await execAsync(`wget -r -np -k -E -p -erobots=off http://localhost:6060/pkg/${options.input}/`);
      
      // Kill godoc server
      await execAsync(`pkill godoc`);
      
      // Move to output directory
      await execAsync(`mv localhost:6060/* ${options.output}/`);
    } catch (error) {
      // Fallback to manual documentation
      await this.generateGoDocsManual(options);
    }
  }

  private async generateGoDocsManual(options: SDKDocsOptions): Promise<void> {
    const readmeContent = `# Go SDK Documentation

## Installation

\`\`\`bash
go get github.com/n8n-mcp/go-sdk
\`\`\`

## Quick Start

\`\`\`go
package main

import (
    "fmt"
    "log"
    
    n8nmcp "github.com/n8n-mcp/go-sdk"
)

func main() {
    // Initialize client
    client := n8nmcp.NewClient("your-api-key")
    
    // List workflows
    workflows, err := client.Workflows.List(n8nmcp.ListOptions{
        Limit: 20,
        Page:  1,
    })
    if err != nil {
        log.Fatal(err)
    }
    
    for _, workflow := range workflows.Data {
        fmt.Printf("- %s (ID: %s)\\n", workflow.Name, workflow.ID)
    }
    
    // Create workflow
    workflow, err := client.Workflows.Create(n8nmcp.WorkflowCreateRequest{
        Name: "My Go Workflow",
        Nodes: []n8nmcp.Node{
            {
                ID:   "webhook_1",
                Type: "webhook",
                Position: []int{100, 100},
                Parameters: map[string]interface{}{
                    "path":   "/webhook",
                    "method": "POST",
                },
            },
        },
        Connections: map[string][]n8nmcp.Connection{},
    })
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("Created workflow: %s\\n", workflow.ID)
}
\`\`\`

## API Reference

### Client

\`\`\`go
type Client struct {
    Workflows  *WorkflowsService
    Executions *ExecutionsService
}

func NewClient(apiKey string) *Client
func NewClientWithOptions(apiKey string, opts ClientOptions) *Client
\`\`\`

### Error Handling

\`\`\`go
import (
    "errors"
    "fmt"
    
    n8nmcp "github.com/n8n-mcp/go-sdk"
)

func handleWorkflow(client *n8nmcp.Client, id string) error {
    workflow, err := client.Workflows.Get(id)
    if err != nil {
        var apiErr *n8nmcp.APIError
        if errors.As(err, &apiErr) {
            switch apiErr.StatusCode {
            case 404:
                return fmt.Errorf("workflow not found")
            case 401:
                return fmt.Errorf("authentication failed")
            default:
                return fmt.Errorf("API error: %s", apiErr.Message)
            }
        }
        return err
    }
    
    // Use workflow...
    return nil
}
\`\`\`

## Examples

### Context Support

\`\`\`go
import (
    "context"
    "time"
)

func executeWithTimeout(client *n8nmcp.Client, workflowID string) error {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    execution, err := client.Workflows.ExecuteContext(ctx, workflowID, nil)
    if err != nil {
        return err
    }
    
    // Wait for completion with context
    result, err := client.Executions.WaitForCompletionContext(ctx, execution.ID)
    if err != nil {
        return err
    }
    
    fmt.Printf("Execution completed: %s\\n", result.Status)
    return nil
}
\`\`\`

### Concurrent Operations

\`\`\`go
import (
    "sync"
)

func executeConcurrently(client *n8nmcp.Client, workflowIDs []string) {
    var wg sync.WaitGroup
    
    for _, id := range workflowIDs {
        wg.Add(1)
        
        go func(workflowID string) {
            defer wg.Done()
            
            execution, err := client.Workflows.Execute(workflowID, nil)
            if err != nil {
                log.Printf("Error executing %s: %v", workflowID, err)
                return
            }
            
            log.Printf("Started execution %s for workflow %s", execution.ID, workflowID)
        }(id)
    }
    
    wg.Wait()
}
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'README.md'),
      readmeContent
    );
  }

  private async generateJavaDocs(options: SDKDocsOptions): Promise<void> {
    try {
      // Use Javadoc
      await execAsync(`cd ${options.input} && javadoc -d ${options.output} -sourcepath src -subpackages com.n8nmcp`);
    } catch (error) {
      // Fallback to manual documentation
      await this.generateJavaDocsManual(options);
    }
  }

  private async generateJavaDocsManual(options: SDKDocsOptions): Promise<void> {
    const readmeContent = `# Java SDK Documentation

## Installation

### Maven

\`\`\`xml
<dependency>
    <groupId>com.n8nmcp</groupId>
    <artifactId>n8n-mcp-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
\`\`\`

### Gradle

\`\`\`gradle
implementation 'com.n8nmcp:n8n-mcp-sdk:1.0.0'
\`\`\`

## Quick Start

\`\`\`java
import com.n8nmcp.sdk.Client;
import com.n8nmcp.sdk.models.Workflow;
import com.n8nmcp.sdk.models.Execution;

public class Example {
    public static void main(String[] args) {
        // Initialize client
        Client client = new Client("your-api-key");
        
        try {
            // List workflows
            var workflows = client.workflows().list();
            for (Workflow workflow : workflows.getData()) {
                System.out.println("- " + workflow.getName() + " (ID: " + workflow.getId() + ")");
            }
            
            // Create workflow
            Workflow newWorkflow = Workflow.builder()
                .name("My Java Workflow")
                .addNode(Node.builder()
                    .id("webhook_1")
                    .type("webhook")
                    .position(100, 100)
                    .parameter("path", "/webhook")
                    .parameter("method", "POST")
                    .build())
                .build();
                
            Workflow created = client.workflows().create(newWorkflow);
            System.out.println("Created workflow: " + created.getId());
            
            // Execute workflow
            Execution execution = client.workflows().execute(created.getId());
            System.out.println("Execution started: " + execution.getId());
            
        } catch (ApiException e) {
            System.err.println("API error: " + e.getMessage());
        }
    }
}
\`\`\`

## Error Handling

\`\`\`java
import com.n8nmcp.sdk.exceptions.ApiException;
import com.n8nmcp.sdk.exceptions.ValidationException;
import com.n8nmcp.sdk.exceptions.NotFoundException;

try {
    Workflow workflow = client.workflows().get("non-existent");
} catch (NotFoundException e) {
    System.err.println("Workflow not found");
} catch (ValidationException e) {
    System.err.println("Validation error: " + e.getDetails());
} catch (ApiException e) {
    System.err.println("API error: " + e.getMessage());
    System.err.println("Status code: " + e.getStatusCode());
}
\`\`\`

## Async Operations

\`\`\`java
import java.util.concurrent.CompletableFuture;

CompletableFuture<Workflow> future = client.workflows().getAsync("workflow-id");

future.thenAccept(workflow -> {
    System.out.println("Got workflow: " + workflow.getName());
}).exceptionally(throwable -> {
    System.err.println("Error: " + throwable.getMessage());
    return null;
});
\`\`\`

## Builder Pattern

\`\`\`java
// Using builders for complex objects
Workflow workflow = Workflow.builder()
    .name("Complex Workflow")
    .active(true)
    .addNode(Node.builder()
        .id("trigger")
        .type("schedule")
        .parameter("cron", "0 0 * * *")
        .build())
    .addNode(Node.builder()
        .id("http")
        .type("http-request")
        .parameter("url", "https://api.example.com/data")
        .parameter("method", "GET")
        .build())
    .addConnection("trigger", "http")
    .build();
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'README.md'),
      readmeContent
    );
  }

  private async generateCSharpDocs(options: SDKDocsOptions): Promise<void> {
    try {
      // Use DocFX or Sandcastle
      await execAsync(`cd ${options.input} && docfx init -q`);
      await execAsync(`cd ${options.input} && docfx build`);
      
      // Copy output
      await execAsync(`cp -r ${options.input}/_site/* ${options.output}/`);
    } catch (error) {
      // Fallback to manual documentation
      await this.generateCSharpDocsManual(options);
    }
  }

  private async generateCSharpDocsManual(options: SDKDocsOptions): Promise<void> {
    const readmeContent = `# C# SDK Documentation

## Installation

### NuGet

\`\`\`bash
dotnet add package N8nMcp.Sdk
\`\`\`

### Package Manager

\`\`\`powershell
Install-Package N8nMcp.Sdk
\`\`\`

## Quick Start

\`\`\`csharp
using N8nMcp.Sdk;
using N8nMcp.Sdk.Models;

class Program
{
    static async Task Main(string[] args)
    {
        // Initialize client
        var client = new Client("your-api-key");
        
        // List workflows
        var workflows = await client.Workflows.ListAsync();
        foreach (var workflow in workflows.Data)
        {
            Console.WriteLine($"- {workflow.Name} (ID: {workflow.Id})");
        }
        
        // Create workflow
        var newWorkflow = new Workflow
        {
            Name = "My C# Workflow",
            Nodes = new List<Node>
            {
                new Node
                {
                    Id = "webhook_1",
                    Type = "webhook",
                    Position = new[] { 100, 100 },
                    Parameters = new Dictionary<string, object>
                    {
                        ["path"] = "/webhook",
                        ["method"] = "POST"
                    }
                }
            },
            Connections = new Dictionary<string, List<Connection>>()
        };
        
        var created = await client.Workflows.CreateAsync(newWorkflow);
        Console.WriteLine($"Created workflow: {created.Id}");
        
        // Execute workflow
        var execution = await client.Workflows.ExecuteAsync(created.Id);
        Console.WriteLine($"Execution started: {execution.Id}");
    }
}
\`\`\`

## Error Handling

\`\`\`csharp
using N8nMcp.Sdk.Exceptions;

try
{
    var workflow = await client.Workflows.GetAsync("non-existent");
}
catch (NotFoundException)
{
    Console.WriteLine("Workflow not found");
}
catch (ValidationException ex)
{
    Console.WriteLine($"Validation error: {string.Join(", ", ex.Errors)}");
}
catch (ApiException ex)
{
    Console.WriteLine($"API error: {ex.Message}");
    Console.WriteLine($"Status code: {ex.StatusCode}");
}
\`\`\`

## LINQ Support

\`\`\`csharp
// Filter workflows using LINQ
var activeWorkflows = workflows.Data
    .Where(w => w.Active)
    .OrderBy(w => w.Name)
    .ToList();

// Project to custom model
var workflowSummaries = workflows.Data
    .Select(w => new
    {
        w.Id,
        w.Name,
        NodeCount = w.Nodes.Count,
        LastModified = w.UpdatedAt
    })
    .ToList();
\`\`\`

## Dependency Injection

\`\`\`csharp
// In Startup.cs or Program.cs
services.AddSingleton<IClient>(provider => 
    new Client(Configuration["N8nMcp:ApiKey"]));

// In your service
public class WorkflowService
{
    private readonly IClient _client;
    
    public WorkflowService(IClient client)
    {
        _client = client;
    }
    
    public async Task<IEnumerable<Workflow>> GetActiveWorkflowsAsync()
    {
        var response = await _client.Workflows.ListAsync();
        return response.Data.Where(w => w.Active);
    }
}
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'README.md'),
      readmeContent
    );
  }

  private async generateRubyDocs(options: SDKDocsOptions): Promise<void> {
    try {
      // Use YARD for Ruby documentation
      await execAsync(`cd ${options.input} && yard doc`);
      await execAsync(`cp -r ${options.input}/doc/* ${options.output}/`);
    } catch (error) {
      // Fallback to manual documentation
      await this.generateRubyDocsManual(options);
    }
  }

  private async generateRubyDocsManual(options: SDKDocsOptions): Promise<void> {
    const readmeContent = `# Ruby SDK Documentation

## Installation

Add to your Gemfile:

\`\`\`ruby
gem 'n8n-mcp'
\`\`\`

Or install directly:

\`\`\`bash
gem install n8n-mcp
\`\`\`

## Quick Start

\`\`\`ruby
require 'n8n_mcp'

# Initialize client
client = N8nMcp::Client.new(api_key: 'your-api-key')

# List workflows
workflows = client.workflows.list
workflows.data.each do |workflow|
  puts "- #{workflow.name} (ID: #{workflow.id})"
end

# Create workflow
workflow = client.workflows.create(
  name: 'My Ruby Workflow',
  nodes: [
    {
      id: 'webhook_1',
      type: 'webhook',
      position: [100, 100],
      parameters: {
        path: '/webhook',
        method: 'POST'
      }
    }
  ],
  connections: {}
)

puts "Created workflow: #{workflow.id}"

# Execute workflow
execution = client.workflows.execute(workflow.id, data: { test: true })
puts "Execution started: #{execution.id}"
\`\`\`

## Error Handling

\`\`\`ruby
begin
  workflow = client.workflows.get('non-existent')
rescue N8nMcp::NotFoundError
  puts "Workflow not found"
rescue N8nMcp::ValidationError => e
  puts "Validation error: #{e.details}"
rescue N8nMcp::ApiError => e
  puts "API error: #{e.message}"
  puts "Status code: #{e.status_code}"
end
\`\`\`

## Block Syntax

\`\`\`ruby
# Using blocks for cleaner code
N8nMcp::Client.new(api_key: 'your-api-key') do |client|
  # List and process workflows
  client.workflows.list.data.each do |workflow|
    next unless workflow.active
    
    puts "Processing #{workflow.name}"
    execution = client.workflows.execute(workflow.id)
    puts "Started execution #{execution.id}"
  end
end
\`\`\`

## Pagination

\`\`\`ruby
# Automatic pagination with enumerator
client.workflows.each_page do |page|
  page.data.each do |workflow|
    puts workflow.name
  end
end

# Or collect all workflows
all_workflows = client.workflows.all
puts "Total workflows: #{all_workflows.count}"
\`\`\`

## Configuration

\`\`\`ruby
# Global configuration
N8nMcp.configure do |config|
  config.api_key = 'your-api-key'
  config.base_url = 'https://api.n8n-mcp.com'
  config.timeout = 30
  config.retry_count = 3
end

# Use pre-configured client
client = N8nMcp::Client.new
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'README.md'),
      readmeContent
    );
  }

  private async generatePHPDocs(options: SDKDocsOptions): Promise<void> {
    try {
      // Use phpDocumentor
      await execAsync(`cd ${options.input} && phpdoc -d src -t ${options.output}`);
    } catch (error) {
      // Fallback to manual documentation
      await this.generatePHPDocsManual(options);
    }
  }

  private async generatePHPDocsManual(options: SDKDocsOptions): Promise<void> {
    const readmeContent = `# PHP SDK Documentation

## Installation

### Composer

\`\`\`bash
composer require n8nmcp/sdk
\`\`\`

## Quick Start

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use N8nMcp\\Sdk\\Client;
use N8nMcp\\Sdk\\Exceptions\\ApiException;

// Initialize client
$client = new Client('your-api-key');

// List workflows
$workflows = $client->workflows->list();
foreach ($workflows->data as $workflow) {
    echo "- {$workflow->name} (ID: {$workflow->id})\\n";
}

// Create workflow
$workflow = $client->workflows->create([
    'name' => 'My PHP Workflow',
    'nodes' => [
        [
            'id' => 'webhook_1',
            'type' => 'webhook',
            'position' => [100, 100],
            'parameters' => [
                'path' => '/webhook',
                'method' => 'POST'
            ]
        ]
    ],
    'connections' => []
]);

echo "Created workflow: {$workflow->id}\\n";

// Execute workflow
$execution = $client->workflows->execute($workflow->id, [
    'data' => ['test' => true]
]);

echo "Execution started: {$execution->id}\\n";
\`\`\`

## Error Handling

\`\`\`php
try {
    $workflow = $client->workflows->get('non-existent');
} catch (NotFoundException $e) {
    echo "Workflow not found\\n";
} catch (ValidationException $e) {
    echo "Validation error: " . json_encode($e->getErrors()) . "\\n";
} catch (ApiException $e) {
    echo "API error: {$e->getMessage()}\\n";
    echo "Status code: {$e->getStatusCode()}\\n";
}
\`\`\`

## PSR-7 Support

\`\`\`php
use GuzzleHttp\\Psr7\\Request;

// Custom request with PSR-7
$request = new Request(
    'GET',
    '/workflows',
    ['X-Custom-Header' => 'value']
);

$response = $client->sendRequest($request);
$workflows = json_decode($response->getBody()->getContents());
\`\`\`

## Async Operations

\`\`\`php
// Using promises for async operations
$promise = $client->workflows->listAsync();

$promise->then(
    function ($workflows) {
        echo "Got {$workflows->pagination->total} workflows\\n";
    },
    function ($error) {
        echo "Error: {$error->getMessage()}\\n";
    }
);

// Wait for multiple operations
$promises = [
    $client->workflows->getAsync('id1'),
    $client->workflows->getAsync('id2'),
    $client->workflows->getAsync('id3')
];

$results = \\GuzzleHttp\\Promise\\settle($promises)->wait();
\`\`\`

## Laravel Integration

\`\`\`php
// In config/services.php
'n8n_mcp' => [
    'api_key' => env('N8N_MCP_API_KEY'),
    'base_url' => env('N8N_MCP_BASE_URL', 'https://api.n8n-mcp.com'),
],

// Service Provider
namespace App\\Providers;

use Illuminate\\Support\\ServiceProvider;
use N8nMcp\\Sdk\\Client;

class N8nMcpServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(Client::class, function ($app) {
            return new Client(config('services.n8n_mcp.api_key'));
        });
    }
}

// In your controller
use N8nMcp\\Sdk\\Client;

class WorkflowController extends Controller
{
    protected $client;
    
    public function __construct(Client $client)
    {
        $this->client = $client;
    }
    
    public function index()
    {
        $workflows = $this->client->workflows->list();
        return view('workflows.index', compact('workflows'));
    }
}
\`\`\`
`;

    await fs.writeFile(
      path.join(options.output, 'README.md'),
      readmeContent
    );
  }

  private async generateCommonDocs(options: SDKDocsOptions): Promise<void> {
    // Generate getting started guide
    await this.generateGettingStarted(options);
    
    // Generate authentication guide
    await this.generateAuthenticationGuide(options);
    
    // Generate best practices
    await this.generateBestPractices(options);
    
    // Generate troubleshooting guide
    await this.generateTroubleshooting(options);
  }

  private async generateGettingStarted(options: SDKDocsOptions): Promise<void> {
    const content = `# Getting Started

## Prerequisites

Before you begin, make sure you have:

1. An n8n-MCP account
2. An API key (get one from your dashboard)
3. The SDK installed for your language

## Basic Concepts

### Workflows

Workflows are the core of n8n-MCP. They consist of:
- **Nodes**: Individual tasks or operations
- **Connections**: Links between nodes that define data flow
- **Parameters**: Configuration for each node

### Executions

When you run a workflow, it creates an execution. Executions:
- Have a unique ID
- Track status (running, success, error)
- Store input and output data
- Generate logs

### Authentication

All API requests require authentication using an API key. Include it in:
- HTTP header: \`Authorization: Bearer YOUR_API_KEY\`
- SDK client initialization

## Your First Workflow

1. **Create a simple workflow**
2. **Execute it with test data**
3. **Check the results**

See language-specific examples for detailed code.

## Next Steps

- Explore [node types](./nodes.md)
- Learn about [error handling](./error-handling.md)
- Set up [webhooks](./webhooks.md)
- Configure [authentication](./authentication.md)
`;

    await fs.writeFile(
      path.join(options.output, 'getting-started.md'),
      content
    );
  }

  private async generateAuthenticationGuide(options: SDKDocsOptions): Promise<void> {
    const content = `# Authentication Guide

## API Key Authentication

n8n-MCP uses API key authentication for all requests.

### Getting Your API Key

1. Log in to your n8n-MCP dashboard
2. Navigate to Settings > API Keys
3. Click "Create New API Key"
4. Copy the key (you won't see it again!)

### Using Your API Key

Include your API key in all requests:

**HTTP Header:**
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

**SDK Initialization:**
See language-specific examples in the SDK documentation.

## Security Best Practices

### Storing API Keys

**DO:**
- Store keys in environment variables
- Use secret management systems
- Rotate keys regularly
- Use different keys for different environments

**DON'T:**
- Commit keys to version control
- Share keys between team members
- Use production keys in development
- Expose keys in client-side code

### Environment Variables

\`\`\`bash
# .env file (add to .gitignore!)
N8N_MCP_API_KEY=your-api-key-here

# Shell
export N8N_MCP_API_KEY="your-api-key-here"

# Windows
set N8N_MCP_API_KEY=your-api-key-here
\`\`\`

### Key Rotation

Rotate your API keys periodically:

1. Create a new API key
2. Update your applications
3. Verify everything works
4. Delete the old key

## Rate Limiting

API keys are subject to rate limits:

- **Default**: 100 requests per minute
- **Burst**: 200 requests per minute (short term)
- **Headers**: Check \`X-RateLimit-*\` headers

### Handling Rate Limits

1. Implement exponential backoff
2. Cache responses when possible
3. Batch operations
4. Use webhooks for real-time updates

## OAuth 2.0 (Coming Soon)

OAuth 2.0 support is planned for:
- Third-party integrations
- User-facing applications
- Fine-grained permissions
`;

    await fs.writeFile(
      path.join(options.output, 'authentication.md'),
      content
    );
  }

  private async generateBestPractices(options: SDKDocsOptions): Promise<void> {
    const content = `# Best Practices

## Workflow Design

### 1. Keep It Simple
- Start with simple workflows
- Add complexity gradually
- Use sub-workflows for reusable logic

### 2. Error Handling
- Always implement error nodes
- Use try-catch patterns
- Log errors for debugging
- Set up alerts for critical failures

### 3. Performance
- Limit parallel executions
- Use pagination for large datasets
- Implement timeouts
- Cache frequently accessed data

## API Usage

### 1. Efficient Requests
\`\`\`javascript
// Bad: Multiple requests
const w1 = await client.workflows.get('id1');
const w2 = await client.workflows.get('id2');

// Good: Batch where possible
const workflows = await client.workflows.list({
  ids: ['id1', 'id2']
});
\`\`\`

### 2. Pagination
Always handle pagination for list operations:
\`\`\`javascript
async function getAllWorkflows() {
  const allWorkflows = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await client.workflows.list({ page, limit: 100 });
    allWorkflows.push(...response.data);
    hasMore = page < response.pagination.totalPages;
    page++;
  }
  
  return allWorkflows;
}
\`\`\`

### 3. Error Recovery
Implement retry logic with exponential backoff:
\`\`\`javascript
async function retryOperation(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
\`\`\`

## Security

### 1. Input Validation
- Always validate webhook inputs
- Sanitize user data
- Use schema validation
- Implement rate limiting

### 2. Secrets Management
- Never hardcode credentials
- Use environment variables
- Rotate secrets regularly
- Audit access logs

### 3. Network Security
- Use HTTPS only
- Verify webhook signatures
- Implement IP whitelisting
- Use VPN for sensitive operations

## Monitoring

### 1. Logging
- Log all workflow executions
- Include correlation IDs
- Use structured logging
- Set appropriate log levels

### 2. Metrics
Track key metrics:
- Execution success rate
- Average execution time
- Error frequency
- API usage

### 3. Alerts
Set up alerts for:
- Failed executions
- High error rates
- Slow performance
- API limit warnings

## Testing

### 1. Unit Tests
Test individual nodes and logic:
\`\`\`javascript
describe('Workflow Logic', () => {
  it('should transform data correctly', () => {
    const input = { name: 'test' };
    const output = transformNode(input);
    expect(output).toEqual({ name: 'TEST' });
  });
});
\`\`\`

### 2. Integration Tests
Test complete workflows:
\`\`\`javascript
it('should execute workflow end-to-end', async () => {
  const execution = await client.workflows.execute(testWorkflowId, {
    data: { test: true }
  });
  
  const result = await waitForCompletion(execution.id);
  expect(result.status).toBe('success');
});
\`\`\`

### 3. Load Testing
- Test with production-like data volumes
- Simulate concurrent executions
- Monitor resource usage
- Identify bottlenecks

## Documentation

### 1. Workflow Documentation
- Document workflow purpose
- Explain node configurations
- List required inputs
- Describe expected outputs

### 2. Code Comments
\`\`\`javascript
// Calculate exponential backoff delay
// Starts at 1s, doubles each retry up to maxDelay
const delay = Math.min(
  Math.pow(2, retryCount) * 1000,
  maxDelay
);
\`\`\`

### 3. API Documentation
- Keep SDK docs updated
- Document custom nodes
- Provide usage examples
- Include troubleshooting guides
`;

    await fs.writeFile(
      path.join(options.output, 'best-practices.md'),
      content
    );
  }

  private async generateTroubleshooting(options: SDKDocsOptions): Promise<void> {
    const content = `# Troubleshooting Guide

## Common Issues

### Authentication Errors

**Problem**: "Invalid API key" or 401 errors

**Solutions**:
1. Check your API key is correct
2. Ensure no extra spaces or characters
3. Verify the key hasn't expired
4. Check you're using the right environment

\`\`\`javascript
// Debug authentication
console.log('API Key:', process.env.N8N_MCP_API_KEY?.substring(0, 8) + '...');
\`\`\`

### Connection Issues

**Problem**: "Connection refused" or timeout errors

**Solutions**:
1. Check your internet connection
2. Verify the API URL is correct
3. Check firewall settings
4. Try using a different DNS

\`\`\`bash
# Test connectivity
curl -I https://api.n8n-mcp.com/health
\`\`\`

### Rate Limiting

**Problem**: 429 "Too Many Requests" errors

**Solutions**:
1. Implement request throttling
2. Add delays between requests
3. Use batch operations
4. Cache responses

\`\`\`javascript
// Check rate limit headers
response.headers['x-ratelimit-remaining']
response.headers['x-ratelimit-reset']
\`\`\`

## Workflow Issues

### Workflow Won't Execute

**Checklist**:
- [ ] Workflow is active
- [ ] All required parameters are set
- [ ] Nodes are properly connected
- [ ] No syntax errors in expressions

### Execution Stuck

**Problem**: Execution stays in "running" state

**Solutions**:
1. Check for infinite loops
2. Verify external API availability
3. Look for timeout settings
4. Check webhook responses

### Data Not Passing Between Nodes

**Problem**: Nodes receive empty or incorrect data

**Debug Steps**:
1. Add logging nodes
2. Check data structure
3. Verify expression syntax
4. Test with simple data first

\`\`\`javascript
// Debug data flow
console.log('Input data:', JSON.stringify($input.all(), null, 2));
\`\`\`

## Performance Issues

### Slow Executions

**Optimizations**:
1. Reduce node count
2. Parallelize operations
3. Implement caching
4. Optimize expressions

### Memory Issues

**Solutions**:
1. Process data in batches
2. Clear unnecessary variables
3. Use streaming where possible
4. Limit parallel executions

## Error Messages

### "propertyValues[itemName] is not iterable"

**Cause**: Trying to iterate over non-array data

**Fix**: Ensure data is in correct format:
\`\`\`javascript
// Wrap single items in array
const items = Array.isArray(data) ? data : [data];
\`\`\`

### "Cannot read property 'x' of undefined"

**Cause**: Accessing property of null/undefined

**Fix**: Add safety checks:
\`\`\`javascript
// Safe property access
const value = data?.property?.subProperty || defaultValue;
\`\`\`

### "Workflow execution timeout"

**Cause**: Execution exceeds time limit

**Fix**:
1. Optimize slow operations
2. Increase timeout settings
3. Split into smaller workflows
4. Use async processing

## Debugging Tips

### 1. Enable Debug Logging

\`\`\`javascript
// Set debug environment variable
process.env.DEBUG = 'n8n-mcp:*';
\`\`\`

### 2. Use Request Interceptors

\`\`\`javascript
// Log all API requests
client.interceptors.request.use(request => {
  console.log('Request:', request);
  return request;
});
\`\`\`

### 3. Workflow Testing

\`\`\`javascript
// Test with minimal data
const testData = { test: true };
const result = await client.workflows.execute(id, testData);
\`\`\`

### 4. Check System Status

Visit: https://status.n8n-mcp.com

## Getting Help

1. **Check Documentation**: Review relevant guides
2. **Search Issues**: GitHub issues may have solutions
3. **Community Forum**: Ask the community
4. **Support Ticket**: Contact support for critical issues

### Information to Provide

When reporting issues, include:
- SDK version
- Error messages
- Code snippets
- Workflow JSON
- Execution IDs
- Timestamps
`;

    await fs.writeFile(
      path.join(options.output, 'troubleshooting.md'),
      content
    );
  }
}