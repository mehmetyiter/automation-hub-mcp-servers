import axios, { AxiosInstance } from 'axios';
import { AuthConfig } from './config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GenerateWorkflowOptions {
  name: string;
  prompt: string;
}

export interface GenerateSDKOptions {
  language: string;
  openApiSpec: any;
  outputDir: string;
  packageName: string;
  namespace?: string;
}

export interface GenerateNodeOptions {
  type: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  outputDir: string;
}

export interface GenerateIntegrationOptions {
  service: string;
  displayName: string;
  baseUrl: string;
  authType: string;
  operations: string[];
  outputDir: string;
}

export class GenerateService {
  private client?: AxiosInstance;

  constructor(auth?: AuthConfig) {
    if (auth) {
      this.client = axios.create({
        baseURL: auth.baseUrl,
        headers: {
          'Authorization': `Bearer ${auth.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async generateWorkflow(options: GenerateWorkflowOptions): Promise<any> {
    if (!this.client) {
      throw new Error('Authentication required for workflow generation');
    }

    const response = await this.client.post('/generate/workflow', {
      name: options.name,
      prompt: options.prompt
    });

    return response.data;
  }

  async deployWorkflow(workflow: any): Promise<any> {
    if (!this.client) {
      throw new Error('Authentication required for workflow deployment');
    }

    const response = await this.client.post('/workflows', workflow);
    return response.data;
  }

  async fetchOpenApiSpec(): Promise<any> {
    if (!this.client) {
      // Use default spec
      return this.getDefaultOpenApiSpec();
    }

    const response = await this.client.get('/openapi.json');
    return response.data;
  }

  async generateSDK(options: GenerateSDKOptions): Promise<void> {
    // Create output directory
    await fs.mkdir(options.outputDir, { recursive: true });

    // Use the SDK generator tool
    const generatorPath = path.join(__dirname, '..', '..', '..', 'tools', 'sdk-generator');
    
    try {
      await execAsync(`node ${generatorPath}/dist/cli.js generate ${options.language} \
        --spec '${JSON.stringify(options.openApiSpec)}' \
        --output ${options.outputDir} \
        --package-name ${options.packageName} \
        ${options.namespace ? `--namespace ${options.namespace}` : ''}`);
    } catch (error) {
      // Fallback to built-in templates
      await this.generateSDKFromTemplate(options);
    }
  }

  private async generateSDKFromTemplate(options: GenerateSDKOptions): Promise<void> {
    const templates = {
      typescript: this.generateTypeScriptSDK,
      python: this.generatePythonSDK,
      go: this.generateGoSDK,
      java: this.generateJavaSDK,
      csharp: this.generateCSharpSDK,
      ruby: this.generateRubySDK,
      php: this.generatePHPSDK
    };

    const generator = templates[options.language as keyof typeof templates];
    if (!generator) {
      throw new Error(`Unsupported language: ${options.language}`);
    }

    await generator.call(this, options);
  }

  getInstallInstructions(language: string, packageName: string): string {
    const instructions: Record<string, string> = {
      typescript: `npm install ${packageName}`,
      python: `pip install ${packageName}`,
      go: `go get github.com/your-org/${packageName}`,
      java: `// Add to pom.xml:\n<dependency>\n  <groupId>com.n8nmcp</groupId>\n  <artifactId>${packageName}</artifactId>\n  <version>1.0.0</version>\n</dependency>`,
      csharp: `dotnet add package ${packageName}`,
      ruby: `gem install ${packageName}`,
      php: `composer require n8nmcp/${packageName}`
    };

    return instructions[language] || '';
  }

  async generateNode(options: GenerateNodeOptions): Promise<void> {
    await fs.mkdir(options.outputDir, { recursive: true });

    // Generate package.json
    const packageJson = {
      name: `n8n-nodes-${options.name}`,
      version: '1.0.0',
      description: options.description,
      main: 'index.js',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch'
      },
      files: ['dist'],
      n8n: {
        credentials: options.type === 'webhook' ? [] : [`dist/credentials/${options.name}Credentials.js`],
        nodes: [`dist/nodes/${options.name}/${options.name}.node.js`]
      },
      devDependencies: {
        '@types/node': '^20.10.0',
        'n8n-workflow': '^1.0.0',
        'typescript': '^5.3.2'
      }
    };

    await fs.writeFile(
      path.join(options.outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Generate tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };

    await fs.writeFile(
      path.join(options.outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    // Generate node file
    await this.generateNodeFile(options);

    // Generate credentials file if not webhook
    if (options.type !== 'webhook') {
      await this.generateCredentialsFile(options);
    }
  }

  private async generateNodeFile(options: GenerateNodeOptions): Promise<void> {
    const nodeDir = path.join(options.outputDir, 'src', 'nodes', options.name);
    await fs.mkdir(nodeDir, { recursive: true });

    const nodeTypes: Record<string, string> = {
      trigger: 'ITriggerNode',
      action: 'INodeType',
      transform: 'INodeType',
      webhook: 'IWebhookNode'
    };

    const nodeTemplate = `import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ${options.type === 'trigger' ? 'ITriggerFunctions, ITriggerNode' : ''}
  ${options.type === 'webhook' ? 'IWebhookFunctions, IWebhookNode' : ''}
} from 'n8n-workflow';

export class ${options.name} implements ${nodeTypes[options.type]} {
  description: INodeTypeDescription = {
    displayName: '${options.displayName}',
    name: '${options.name}',
    group: ['${options.type}'],
    version: 1,
    description: '${options.description}',
    defaults: {
      name: '${options.displayName}',
    },
    inputs: ${options.type === 'trigger' || options.type === 'webhook' ? '[]' : "['main']"},
    outputs: ['main'],
    ${options.type !== 'webhook' ? `credentials: [
      {
        name: '${options.name}Api',
        required: true,
      },
    ],` : ''}
    properties: [
      ${this.getNodeProperties(options.type)}
    ],
  };

  ${this.getNodeMethods(options.type)}
}`;

    await fs.writeFile(
      path.join(nodeDir, `${options.name}.node.ts`),
      nodeTemplate
    );
  }

  private getNodeProperties(type: string): string {
    const properties: Record<string, string> = {
      trigger: `{
        displayName: 'Event',
        name: 'event',
        type: 'options',
        options: [
          {
            name: 'On Create',
            value: 'create',
          },
          {
            name: 'On Update',
            value: 'update',
          },
          {
            name: 'On Delete',
            value: 'delete',
          },
        ],
        default: 'create',
        required: true,
      }`,
      action: `{
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          {
            name: 'Create',
            value: 'create',
          },
          {
            name: 'Get',
            value: 'get',
          },
          {
            name: 'Update',
            value: 'update',
          },
          {
            name: 'Delete',
            value: 'delete',
          },
        ],
        default: 'get',
        required: true,
      }`,
      transform: `{
        displayName: 'JavaScript Code',
        name: 'jsCode',
        type: 'string',
        typeOptions: {
          alwaysOpenEditWindow: true,
          editor: 'code',
          rows: 10,
        },
        default: 'return items;',
        description: 'JavaScript code to transform items',
        noDataExpression: true,
      }`,
      webhook: `{
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: '/webhook',
        required: true,
        description: 'The path to listen on',
      },
      {
        displayName: 'Method',
        name: 'httpMethod',
        type: 'options',
        options: [
          {
            name: 'GET',
            value: 'GET',
          },
          {
            name: 'POST',
            value: 'POST',
          },
        ],
        default: 'POST',
        description: 'The HTTP method to listen for',
      }`
    };

    return properties[type] || properties.action;
  }

  private getNodeMethods(type: string): string {
    const methods: Record<string, string> = {
      trigger: `async trigger(this: ITriggerFunctions): Promise<void> {
    const event = this.getNodeParameter('event') as string;
    
    // Implement your trigger logic here
    // This is a mock implementation
    const mockData = {
      event,
      timestamp: new Date().toISOString(),
      data: { example: 'data' }
    };
    
    this.emit([this.helpers.returnJsonArray([mockData])]);
  }`,
      action: `async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const operation = this.getNodeParameter('operation', 0) as string;
    const returnData: INodeExecutionData[] = [];
    
    for (let i = 0; i < items.length; i++) {
      try {
        // Implement your action logic here based on operation
        const result = {
          operation,
          success: true,
          data: items[i].json
        };
        
        returnData.push({ json: result });
      } catch (error: any) {
        throw new Error(\`Error in item \${i}: \${error.message}\`);
      }
    }
    
    return this.prepareOutputData(returnData);
  }`,
      transform: `async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const jsCode = this.getNodeParameter('jsCode', 0) as string;
    
    // Create a function from the code
    const transformFunction = new Function('items', jsCode);
    
    try {
      const result = transformFunction(items);
      return this.prepareOutputData(result);
    } catch (error: any) {
      throw new Error(\`JavaScript error: \${error.message}\`);
    }
  }`,
      webhook: `async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const resp = this.getResponseObject();
    const path = this.getNodeParameter('path') as string;
    const httpMethod = this.getNodeParameter('httpMethod') as string;
    
    if (req.method !== httpMethod) {
      resp.status(405).send('Method Not Allowed');
      return { noWebhookResponse: true };
    }
    
    const webhookData = {
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body,
      method: req.method,
      path: path
    };
    
    return {
      workflowData: [this.helpers.returnJsonArray([webhookData])],
    };
  }`
    };

    return methods[type] || methods.action;
  }

  private async generateCredentialsFile(options: GenerateNodeOptions): Promise<void> {
    const credentialsDir = path.join(options.outputDir, 'src', 'credentials');
    await fs.mkdir(credentialsDir, { recursive: true });

    const credentialsTemplate = `import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class ${options.name}Api implements ICredentialType {
  name = '${options.name}Api';
  displayName = '${options.displayName} API';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      default: '',
      required: true,
      typeOptions: {
        password: true,
      },
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.example.com',
      required: true,
    },
  ];
}`;

    await fs.writeFile(
      path.join(credentialsDir, `${options.name}Credentials.ts`),
      credentialsTemplate
    );
  }

  async generateIntegration(options: GenerateIntegrationOptions): Promise<void> {
    // This would generate a full integration package
    // For brevity, creating a simplified version
    await fs.mkdir(options.outputDir, { recursive: true });

    // Create README
    const readme = `# ${options.displayName} Integration

This integration provides nodes for interacting with ${options.displayName}.

## Features

${options.operations.map(op => `- ${op}`).join('\n')}

## Installation

1. Install the package: \`npm link\`
2. Restart n8n
3. The ${options.displayName} node will be available in the node palette

## Configuration

1. Create ${options.displayName} credentials in n8n
2. Add your API key and base URL
3. Use the node in your workflows
`;

    await fs.writeFile(path.join(options.outputDir, 'README.md'), readme);

    // Generate the integration using node generator
    await this.generateNode({
      type: 'action',
      name: options.service,
      displayName: options.displayName,
      description: `Integration with ${options.displayName}`,
      category: 'Integration',
      outputDir: options.outputDir
    });
  }

  private async generateTypeScriptSDK(options: GenerateSDKOptions): Promise<void> {
    // Generate TypeScript SDK files
    const srcDir = path.join(options.outputDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Generate index.ts
    const indexContent = `export * from './client';
export * from './types';
export * from './errors';`;

    await fs.writeFile(path.join(srcDir, 'index.ts'), indexContent);

    // Generate client.ts
    const clientContent = `import axios, { AxiosInstance } from 'axios';
import { Workflow, Execution } from './types';

export class ${options.packageName.replace(/-/g, '')}Client {
  private client: AxiosInstance;

  constructor(config: { apiKey: string; baseURL?: string }) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.n8n-mcp.com',
      headers: {
        'Authorization': \`Bearer \${config.apiKey}\`,
        'Content-Type': 'application/json'
      }
    });
  }

  workflows = {
    list: async (params?: any) => {
      const response = await this.client.get('/workflows', { params });
      return response.data;
    },
    get: async (id: string) => {
      const response = await this.client.get(\`/workflows/\${id}\`);
      return response.data;
    },
    create: async (data: any) => {
      const response = await this.client.post('/workflows', data);
      return response.data;
    },
    update: async (id: string, data: any) => {
      const response = await this.client.put(\`/workflows/\${id}\`, data);
      return response.data;
    },
    delete: async (id: string) => {
      await this.client.delete(\`/workflows/\${id}\`);
    },
    execute: async (id: string, data?: any) => {
      const response = await this.client.post(\`/workflows/\${id}/execute\`, { data });
      return response.data;
    }
  };

  executions = {
    get: async (id: string) => {
      const response = await this.client.get(\`/executions/\${id}\`);
      return response.data;
    },
    list: async (workflowId: string, params?: any) => {
      const response = await this.client.get(\`/workflows/\${workflowId}/executions\`, { params });
      return response.data;
    }
  };
}`;

    await fs.writeFile(path.join(srcDir, 'client.ts'), clientContent);

    // Generate package.json
    const packageJson = {
      name: options.packageName,
      version: '1.0.0',
      description: 'TypeScript SDK for n8n-MCP',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        prepublish: 'npm run build'
      },
      dependencies: {
        axios: '^1.6.0'
      },
      devDependencies: {
        '@types/node': '^20.10.0',
        typescript: '^5.3.2'
      }
    };

    await fs.writeFile(
      path.join(options.outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  private async generatePythonSDK(options: GenerateSDKOptions): Promise<void> {
    // Generate Python SDK files
    const packageDir = path.join(options.outputDir, options.packageName.replace(/-/g, '_'));
    await fs.mkdir(packageDir, { recursive: true });

    // Generate __init__.py
    const initContent = `from .client import Client
from .exceptions import ApiError, ValidationError

__version__ = '1.0.0'
__all__ = ['Client', 'ApiError', 'ValidationError']`;

    await fs.writeFile(path.join(packageDir, '__init__.py'), initContent);

    // Generate client.py
    const clientContent = `import requests
from typing import Dict, Any, Optional
from .exceptions import ApiError, ValidationError

class Client:
    def __init__(self, api_key: str, base_url: str = 'https://api.n8n-mcp.com'):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
        
        self.workflows = WorkflowsResource(self)
        self.executions = ExecutionsResource(self)
    
    def request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        response = self.session.request(method, url, **kwargs)
        
        if response.status_code >= 400:
            if response.status_code == 422:
                raise ValidationError(response.json())
            else:
                raise ApiError(response.status_code, response.text)
        
        return response.json() if response.text else {}

class WorkflowsResource:
    def __init__(self, client: Client):
        self.client = client
    
    def list(self, **params) -> Dict[str, Any]:
        return self.client.request('GET', '/workflows', params=params)
    
    def get(self, workflow_id: str) -> Dict[str, Any]:
        return self.client.request('GET', f'/workflows/{workflow_id}')
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request('POST', '/workflows', json=data)
    
    def update(self, workflow_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request('PUT', f'/workflows/{workflow_id}', json=data)
    
    def delete(self, workflow_id: str) -> None:
        self.client.request('DELETE', f'/workflows/{workflow_id}')
    
    def execute(self, workflow_id: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self.client.request('POST', f'/workflows/{workflow_id}/execute', json={'data': data})

class ExecutionsResource:
    def __init__(self, client: Client):
        self.client = client
    
    def get(self, execution_id: str) -> Dict[str, Any]:
        return self.client.request('GET', f'/executions/{execution_id}')
    
    def list(self, workflow_id: str, **params) -> Dict[str, Any]:
        return self.client.request('GET', f'/workflows/{workflow_id}/executions', params=params)`;

    await fs.writeFile(path.join(packageDir, 'client.py'), clientContent);

    // Generate setup.py
    const setupContent = `from setuptools import setup, find_packages

setup(
    name='${options.packageName}',
    version='1.0.0',
    description='Python SDK for n8n-MCP',
    packages=find_packages(),
    install_requires=[
        'requests>=2.31.0',
    ],
    python_requires='>=3.7',
)`;

    await fs.writeFile(path.join(options.outputDir, 'setup.py'), setupContent);
  }

  private async generateGoSDK(options: GenerateSDKOptions): Promise<void> {
    // Generate Go SDK files
    await fs.mkdir(options.outputDir, { recursive: true });

    // Generate client.go
    const clientContent = `package ${options.packageName.replace(/-/g, '')}

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Client struct {
    apiKey     string
    baseURL    string
    httpClient *http.Client
    
    Workflows  *WorkflowsService
    Executions *ExecutionsService
}

func NewClient(apiKey string) *Client {
    c := &Client{
        apiKey:  apiKey,
        baseURL: "https://api.n8n-mcp.com",
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
    
    c.Workflows = &WorkflowsService{client: c}
    c.Executions = &ExecutionsService{client: c}
    
    return c
}

func (c *Client) request(method, path string, body interface{}) (*http.Response, error) {
    var reqBody []byte
    var err error
    
    if body != nil {
        reqBody, err = json.Marshal(body)
        if err != nil {
            return nil, err
        }
    }
    
    req, err := http.NewRequest(method, c.baseURL+path, bytes.NewBuffer(reqBody))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+c.apiKey)
    req.Header.Set("Content-Type", "application/json")
    
    return c.httpClient.Do(req)
}

type WorkflowsService struct {
    client *Client
}

func (s *WorkflowsService) List() ([]Workflow, error) {
    resp, err := s.client.request("GET", "/workflows", nil)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Data []Workflow \`json:"data"\`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    return result.Data, nil
}`;

    await fs.writeFile(path.join(options.outputDir, 'client.go'), clientContent);

    // Generate go.mod
    const goModContent = `module github.com/your-org/${options.packageName}

go 1.21

require (
    // Add dependencies here
)`;

    await fs.writeFile(path.join(options.outputDir, 'go.mod'), goModContent);
  }

  private async generateJavaSDK(options: GenerateSDKOptions): Promise<void> {
    // Generate Java SDK structure
    const srcDir = path.join(options.outputDir, 'src', 'main', 'java', ...options.namespace!.split('.'));
    await fs.mkdir(srcDir, { recursive: true });

    // Generate Client.java
    const clientContent = `package ${options.namespace};

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Client {
    private final String apiKey;
    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    public final WorkflowsResource workflows;
    public final ExecutionsResource executions;
    
    public Client(String apiKey) {
        this(apiKey, "https://api.n8n-mcp.com");
    }
    
    public Client(String apiKey, String baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.objectMapper = new ObjectMapper();
        
        this.workflows = new WorkflowsResource(this);
        this.executions = new ExecutionsResource(this);
    }
    
    // Implementation details...
}`;

    await fs.writeFile(path.join(srcDir, 'Client.java'), clientContent);

    // Generate pom.xml
    const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.n8nmcp</groupId>
    <artifactId>${options.packageName}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <name>${options.packageName}</name>
    <description>Java SDK for n8n-MCP</description>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.15.3</version>
        </dependency>
    </dependencies>
</project>`;

    await fs.writeFile(path.join(options.outputDir, 'pom.xml'), pomContent);
  }

  private async generateCSharpSDK(options: GenerateSDKOptions): Promise<void> {
    // Generate C# SDK structure
    await fs.mkdir(options.outputDir, { recursive: true });

    // Generate Client.cs
    const clientContent = `using System;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace ${options.namespace || 'N8nMcp.Sdk'}
{
    public class Client
    {
        private readonly string _apiKey;
        private readonly string _baseUrl;
        private readonly HttpClient _httpClient;
        
        public WorkflowsResource Workflows { get; }
        public ExecutionsResource Executions { get; }
        
        public Client(string apiKey, string baseUrl = "https://api.n8n-mcp.com")
        {
            _apiKey = apiKey;
            _baseUrl = baseUrl.TrimEnd('/');
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            
            Workflows = new WorkflowsResource(this);
            Executions = new ExecutionsResource(this);
        }
        
        // Implementation details...
    }
}`;

    await fs.writeFile(path.join(options.outputDir, 'Client.cs'), clientContent);

    // Generate .csproj
    const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.1</TargetFramework>
    <PackageId>${options.packageName}</PackageId>
    <Version>1.0.0</Version>
    <Authors>n8n-MCP</Authors>
    <Description>C# SDK for n8n-MCP</Description>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>`;

    await fs.writeFile(path.join(options.outputDir, `${options.packageName}.csproj`), csprojContent);
  }

  private async generateRubySDK(options: GenerateSDKOptions): Promise<void> {
    // Generate Ruby SDK
    const libDir = path.join(options.outputDir, 'lib', options.packageName.replace(/-/g, '_'));
    await fs.mkdir(libDir, { recursive: true });

    // Generate main file
    const mainContent = `require 'net/http'
require 'json'
require 'uri'

module ${options.packageName.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')}
  class Client
    attr_reader :workflows, :executions
    
    def initialize(api_key, base_url = 'https://api.n8n-mcp.com')
      @api_key = api_key
      @base_url = base_url.chomp('/')
      @workflows = WorkflowsResource.new(self)
      @executions = ExecutionsResource.new(self)
    end
    
    def request(method, path, params = nil, body = nil)
      uri = URI("#{@base_url}#{path}")
      uri.query = URI.encode_www_form(params) if params && method == :get
      
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == 'https'
      
      request = case method
      when :get then Net::HTTP::Get.new(uri)
      when :post then Net::HTTP::Post.new(uri)
      when :put then Net::HTTP::Put.new(uri)
      when :delete then Net::HTTP::Delete.new(uri)
      end
      
      request['Authorization'] = "Bearer #{@api_key}"
      request['Content-Type'] = 'application/json'
      request.body = body.to_json if body
      
      response = http.request(request)
      
      if response.code.to_i >= 400
        raise ApiError.new(response.code, response.body)
      end
      
      JSON.parse(response.body) if response.body && !response.body.empty?
    end
  end
  
  class ApiError < StandardError
    attr_reader :status_code, :body
    
    def initialize(status_code, body)
      @status_code = status_code
      @body = body
      super("API Error: #{status_code} - #{body}")
    end
  end
end`;

    await fs.writeFile(path.join(libDir, 'client.rb'), mainContent);

    // Generate gemspec
    const gemspecContent = `Gem::Specification.new do |spec|
  spec.name          = "${options.packageName}"
  spec.version       = "1.0.0"
  spec.authors       = ["n8n-MCP"]
  spec.summary       = "Ruby SDK for n8n-MCP"
  spec.description   = "Ruby SDK for interacting with n8n-MCP API"
  spec.homepage      = "https://github.com/n8n-mcp/${options.packageName}"
  spec.license       = "MIT"
  
  spec.files         = Dir["lib/**/*", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]
  
  spec.required_ruby_version = ">= 2.5.0"
  
  spec.add_runtime_dependency "json", "~> 2.0"
end`;

    await fs.writeFile(
      path.join(options.outputDir, `${options.packageName}.gemspec`),
      gemspecContent
    );
  }

  private async generatePHPSDK(options: GenerateSDKOptions): Promise<void> {
    // Generate PHP SDK
    const srcDir = path.join(options.outputDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Generate Client.php
    const clientContent = `<?php

namespace N8nMcp\\Sdk;

use GuzzleHttp\\Client as HttpClient;
use GuzzleHttp\\Exception\\RequestException;

class Client
{
    private $apiKey;
    private $baseUrl;
    private $httpClient;
    
    public $workflows;
    public $executions;
    
    public function __construct($apiKey, $baseUrl = 'https://api.n8n-mcp.com')
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        
        $this->httpClient = new HttpClient([
            'base_uri' => $this->baseUrl,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'timeout' => 30,
        ]);
        
        $this->workflows = new WorkflowsResource($this);
        $this->executions = new ExecutionsResource($this);
    }
    
    public function request($method, $path, $options = [])
    {
        try {
            $response = $this->httpClient->request($method, $path, $options);
            $body = $response->getBody()->getContents();
            
            return json_decode($body, true);
        } catch (RequestException $e) {
            if ($e->hasResponse()) {
                $statusCode = $e->getResponse()->getStatusCode();
                $body = $e->getResponse()->getBody()->getContents();
                
                throw new ApiException("API Error: {$statusCode}", $statusCode, $body);
            }
            
            throw $e;
        }
    }
}

class ApiException extends \\Exception
{
    private $statusCode;
    private $responseBody;
    
    public function __construct($message, $statusCode, $responseBody)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->responseBody = $responseBody;
    }
    
    public function getStatusCode()
    {
        return $this->statusCode;
    }
    
    public function getResponseBody()
    {
        return $this->responseBody;
    }
}`;

    await fs.writeFile(path.join(srcDir, 'Client.php'), clientContent);

    // Generate composer.json
    const composerContent = {
      name: `n8nmcp/${options.packageName}`,
      description: 'PHP SDK for n8n-MCP',
      type: 'library',
      license: 'MIT',
      require: {
        php: '>=7.2',
        'guzzlehttp/guzzle': '^7.0'
      },
      autoload: {
        'psr-4': {
          'N8nMcp\\Sdk\\': 'src/'
        }
      }
    };

    await fs.writeFile(
      path.join(options.outputDir, 'composer.json'),
      JSON.stringify(composerContent, null, 2)
    );
  }

  private getDefaultOpenApiSpec(): any {
    // Return a default OpenAPI spec
    return {
      openapi: '3.0.0',
      info: {
        title: 'n8n-MCP API',
        version: '1.0.0',
        description: 'API for n8n-MCP workflow automation platform'
      },
      servers: [
        {
          url: 'https://api.n8n-mcp.com',
          description: 'Production server'
        }
      ],
      paths: {
        '/workflows': {
          get: {
            summary: 'List workflows',
            operationId: 'listWorkflows',
            parameters: [
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer' }
              },
              {
                name: 'page',
                in: 'query',
                schema: { type: 'integer' }
              }
            ],
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Workflow' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: 'Create workflow',
            operationId: 'createWorkflow',
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/WorkflowInput' }
                }
              }
            },
            responses: {
              '201': {
                description: 'Workflow created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Workflow' }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          Workflow: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              active: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          WorkflowInput: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              nodes: { type: 'array' },
              connections: { type: 'object' }
            }
          }
        }
      }
    };
  }
}