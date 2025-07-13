import React, { useState, useEffect, useCallback } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { ApiClient } from '../../services/api-client';
import { EnvironmentSelector } from './EnvironmentSelector';
import { AuthTokenInput } from './AuthTokenInput';
import { QuickActions } from './QuickActions';
import { ApiActivityFeed } from './ApiActivityFeed';
import { CodeExamples } from './CodeExamples';
import './ApiExplorer.css';

interface Environment {
  value: string;
  label: string;
  url: string;
  description: string;
}

interface ApiActivity {
  id: string;
  method: string;
  url: string;
  status?: number;
  timestamp: Date;
  duration?: number;
  request_id: string;
}

export const ApiExplorer: React.FC = () => {
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('sandbox');
  const [apiActivity, setApiActivity] = useState<ApiActivity[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const environments: Environment[] = [
    {
      value: 'sandbox',
      label: 'Sandbox',
      url: 'https://sandbox-api.n8n-mcp.com',
      description: 'Safe testing environment with mock data'
    },
    {
      value: 'staging',
      label: 'Staging',
      url: 'https://staging-api.n8n-mcp.com',
      description: 'Pre-production environment'
    },
    {
      value: 'production',
      label: 'Production',
      url: 'https://api.n8n-mcp.com',
      description: 'Live production environment'
    }
  ];

  // Load OpenAPI specification
  useEffect(() => {
    const loadApiSpec = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/openapi.yaml');
        const yamlText = await response.text();
        
        // Convert YAML to JSON (you'd need a YAML parser library)
        const spec = await import('js-yaml').then(yaml => yaml.load(yamlText));
        setOpenApiSpec(spec);
      } catch (error) {
        console.error('Failed to load API specification:', error);
      } finally {
        setLoading(false);
      }
    };

    loadApiSpec();
  }, []);

  const generateRequestId = useCallback((): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const getEnvironmentUrl = useCallback((envValue: string): string => {
    const env = environments.find(e => e.value === envValue);
    return env?.url || 'https://api.n8n-mcp.com';
  }, [environments]);

  const logApiActivity = useCallback((activity: Omit<ApiActivity, 'id' | 'timestamp'>) => {
    const newActivity: ApiActivity = {
      ...activity,
      id: generateRequestId(),
      timestamp: new Date()
    };
    
    setApiActivity(prev => [newActivity, ...prev.slice(0, 49)]); // Keep last 50 activities
  }, [generateRequestId]);

  // Custom Swagger UI plugin for enhanced functionality
  const TryItOutPlugin = useCallback(() => {
    return {
      statePlugins: {
        spec: {
          wrapSelectors: {
            requestInterceptor: (ori: any) => (state: any) => (req: any) => {
              // Add authentication
              if (authToken) {
                req.headers['Authorization'] = `Bearer ${authToken}`;
              }
              
              // Update base URL based on environment
              if (req.url.startsWith('https://api.n8n-mcp.com')) {
                req.url = req.url.replace(
                  'https://api.n8n-mcp.com',
                  getEnvironmentUrl(environment)
                );
              }
              
              // Add request tracking headers
              const requestId = generateRequestId();
              req.headers['X-Request-ID'] = requestId;
              req.headers['X-Environment'] = environment;
              req.headers['User-Agent'] = 'n8n-MCP-Explorer/1.0.0';
              
              // Log API activity
              logApiActivity({
                method: req.method.toUpperCase(),
                url: req.url,
                request_id: requestId
              });
              
              return req;
            },
            
            responseInterceptor: (ori: any) => (state: any) => (res: any) => {
              // Update activity with response details
              const requestId = res.headers['x-request-id'] || res.url.split('?')[0];
              setApiActivity(prev => 
                prev.map(activity => 
                  activity.request_id === requestId
                    ? {
                        ...activity,
                        status: res.status,
                        duration: Date.now() - activity.timestamp.getTime()
                      }
                    : activity
                )
              );
              
              return res;
            }
          }
        }
      },
      
      components: {
        TryItOutButton: (props: any) => {
          return React.createElement('button', {
            ...props,
            onClick: () => {
              setSelectedOperation(`${props.method}-${props.path}`);
              props.onClick();
            }
          }, props.children);
        }
      }
    };
  }, [authToken, environment, getEnvironmentUrl, generateRequestId, logApiActivity]);

  const handleGenerateSandboxToken = async (): Promise<void> => {
    try {
      // Generate a temporary sandbox token
      const response = await fetch(`${getEnvironmentUrl('sandbox')}/auth/sandbox-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose: 'api_explorer',
          expires_in: 3600 // 1 hour
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAuthToken(data.token);
      } else {
        console.error('Failed to generate sandbox token');
      }
    } catch (error) {
      console.error('Error generating sandbox token:', error);
    }
  };

  const handleDownloadPostmanCollection = async (): Promise<void> => {
    try {
      // Convert OpenAPI spec to Postman collection
      const collection = await convertToPostmanCollection(openApiSpec, environment);
      const blob = new Blob([JSON.stringify(collection, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `n8n-mcp-api-${environment}.postman_collection.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate Postman collection:', error);
    }
  };

  const handleGenerateSDK = (): void => {
    // Navigate to SDK generator
    window.open('/sdk-generator', '_blank');
  };

  const handleOpenInPlayground = (): void => {
    // Navigate to code playground with current operation
    const params = new URLSearchParams({
      operation: selectedOperation || '',
      environment,
      token: authToken
    });
    window.open(`/playground?${params.toString()}`, '_blank');
  };

  if (loading) {
    return (
      <div className="api-explorer-loading">
        <div className="loading-spinner"></div>
        <p>Loading API documentation...</p>
      </div>
    );
  }

  if (!openApiSpec) {
    return (
      <div className="api-explorer-error">
        <p>Failed to load API specification</p>
      </div>
    );
  }

  return (
    <div className="api-explorer">
      <div className="api-explorer-header">
        <div className="header-content">
          <h1>n8n-MCP API Explorer</h1>
          <p>Interactive API documentation with live testing capabilities</p>
        </div>
        
        <div className="header-controls">
          <EnvironmentSelector
            value={environment}
            onChange={setEnvironment}
            options={environments}
          />
          
          <AuthTokenInput
            value={authToken}
            onChange={setAuthToken}
            onGenerate={handleGenerateSandboxToken}
            environment={environment}
          />
          
          <QuickActions
            onDownloadPostman={handleDownloadPostmanCollection}
            onGenerateSDK={handleGenerateSDK}
            onOpenPlayground={handleOpenInPlayground}
            disabled={!authToken}
          />
        </div>
      </div>
      
      <div className="api-explorer-content">
        <div className="swagger-container">
          <SwaggerUI
            spec={openApiSpec}
            plugins={[TryItOutPlugin]}
            tryItOutEnabled={true}
            displayRequestDuration={true}
            filter={true}
            deepLinking={true}
            supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
            defaultModelsExpandDepth={1}
            defaultModelExpandDepth={1}
            showExtensions={true}
            showCommonExtensions={true}
            presets={[
              SwaggerUI.presets.apis,
              SwaggerUI.presets.standalone
            ]}
            onComplete={(system: any) => {
              // Add custom examples
              injectCustomExamples(system);
              
              // Add response validators
              addResponseValidators(system);
              
              // Setup real-time features
              setupRealtimeFeatures(system);
            }}
          />
        </div>
        
        <div className="sidebar">
          <ApiActivityFeed activities={apiActivity} />
          
          {selectedOperation && (
            <CodeExamples
              operation={selectedOperation}
              environment={environment}
              authToken={authToken}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const convertToPostmanCollection = async (spec: any, environment: string) => {
  const collection = {
    info: {
      name: `n8n-MCP API (${environment})`,
      description: spec.info.description,
      version: spec.info.version,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{authToken}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'baseUrl',
        value: spec.servers.find((s: any) => s.description.toLowerCase().includes(environment))?.url || spec.servers[0].url
      },
      {
        key: 'authToken',
        value: '',
        type: 'string'
      }
    ],
    item: []
  };

  // Convert OpenAPI paths to Postman requests
  for (const [path, pathItem] of Object.entries(spec.paths as any)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation === 'object' && operation.operationId) {
        const request = {
          name: operation.summary || operation.operationId,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json'
              }
            ],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(Boolean)
            }
          }
        };

        (collection.item as any).push(request);
      }
    }
  }

  return collection;
};

const injectCustomExamples = (system: any) => {
  const examples = {
    '/workflows': {
      'POST': {
        'typescript': `import { N8nMcpClient } from '@n8n-mcp/sdk';

const client = new N8nMcpClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.n8n-mcp.com'
});

const workflow = await client.workflows.create({
  name: 'My Automation',
  prompt: 'Send an email when someone submits the contact form',
  tags: ['automation', 'email'],
  active: true
});

console.log('Workflow created:', workflow.id);`,
        
        'python': `from n8n_mcp import Client

client = Client(
    api_key='your-api-key',
    base_url='https://api.n8n-mcp.com'
)

workflow = client.workflows.create(
    name='My Automation',
    prompt='Send an email when someone submits the contact form',
    tags=['automation', 'email'],
    active=True
)

print(f'Workflow created: {workflow.id}')`,
        
        'curl': `curl -X POST https://api.n8n-mcp.com/workflows \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Automation",
    "prompt": "Send an email when someone submits the contact form",
    "tags": ["automation", "email"],
    "active": true
  }'`
      }
    }
  };

  // Inject examples into Swagger UI
  Object.entries(examples).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, languages]) => {
      try {
        system.specActions.setExamples({ path, method, examples: languages });
      } catch (error) {
        console.warn('Failed to inject examples:', error);
      }
    });
  });
};

const addResponseValidators = (system: any) => {
  // Add custom response validation
  system.presets.apis.statePlugins.spec.wrapActions.execute = (oriAction: any) => (args: any) => {
    const result = oriAction(args);
    
    // Add custom validation logic
    if (result && result.res) {
      validateApiResponse(result.res);
    }
    
    return result;
  };
};

const validateApiResponse = (response: any) => {
  // Custom response validation logic
  if (response.status >= 400) {
    console.warn('API request failed:', response.status, response.statusText);
  }
  
  // Check for common issues
  if (response.headers['content-type']?.includes('application/json')) {
    try {
      const data = JSON.parse(response.text);
      if (data.error) {
        console.error('API error response:', data.error);
      }
    } catch (error) {
      console.warn('Failed to parse JSON response');
    }
  }
};

const setupRealtimeFeatures = (system: any) => {
  // Setup WebSocket connection for real-time updates
  try {
    const ws = new WebSocket('wss://api.n8n-mcp.com/ws');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'api_update') {
        // Handle real-time API updates
        console.log('Real-time API update:', data);
      }
    };
    
    ws.onerror = (error) => {
      console.warn('WebSocket connection failed:', error);
    };
  } catch (error) {
    console.warn('WebSocket not supported or connection failed');
  }
};

export default ApiExplorer;