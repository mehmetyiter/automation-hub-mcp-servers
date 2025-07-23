/**
 * User Required Values Registry
 * 
 * This registry defines which node parameters require user-specific values
 * that cannot be automatically generated or defaulted.
 */

export interface UserRequiredValue {
  parameter: string;
  description: string;
  example?: string;
  type: 'credential' | 'endpoint' | 'identifier' | 'configuration';
  sensitive?: boolean;
}

export interface NodeUserRequirements {
  nodeType: string;
  requiredValues: UserRequiredValue[];
}

export class UserRequiredValuesRegistry {
  private registry: Map<string, NodeUserRequirements> = new Map();

  constructor() {
    this.initializeRegistry();
  }

  private initializeRegistry(): void {
    // MQTT Node
    this.registry.set('n8n-nodes-base.mqtt', {
      nodeType: 'n8n-nodes-base.mqtt',
      requiredValues: [
        {
          parameter: 'broker',
          description: 'MQTT broker URL (e.g., your MQTT server address)',
          example: 'mqtt://your-mqtt-broker.com:1883',
          type: 'endpoint'
        },
        {
          parameter: 'username',
          description: 'MQTT broker username (if authentication required)',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'password',
          description: 'MQTT broker password (if authentication required)',
          type: 'credential',
          sensitive: true
        }
      ]
    });

    // HTTP Request Node
    this.registry.set('n8n-nodes-base.httpRequest', {
      nodeType: 'n8n-nodes-base.httpRequest',
      requiredValues: [
        {
          parameter: 'url',
          description: 'API endpoint URL',
          example: 'https://api.yourservice.com/endpoint',
          type: 'endpoint'
        },
        {
          parameter: 'authentication',
          description: 'API authentication credentials',
          type: 'credential',
          sensitive: true
        }
      ]
    });

    // Twilio Node
    this.registry.set('n8n-nodes-base.twilio', {
      nodeType: 'n8n-nodes-base.twilio',
      requiredValues: [
        {
          parameter: 'accountSid',
          description: 'Twilio Account SID',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'authToken',
          description: 'Twilio Auth Token',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'fromNumber',
          description: 'Twilio phone number to send from',
          example: '+1234567890',
          type: 'identifier'
        },
        {
          parameter: 'toNumber',
          description: 'Recipient phone number',
          example: '+0987654321',
          type: 'identifier'
        }
      ]
    });

    // Email Send Node
    this.registry.set('n8n-nodes-base.emailSend', {
      nodeType: 'n8n-nodes-base.emailSend',
      requiredValues: [
        {
          parameter: 'fromEmail',
          description: 'Sender email address',
          example: 'noreply@yourcompany.com',
          type: 'identifier'
        },
        {
          parameter: 'toEmail',
          description: 'Recipient email address',
          example: 'admin@yourcompany.com',
          type: 'identifier'
        },
        {
          parameter: 'smtp',
          description: 'SMTP server configuration',
          type: 'configuration',
          sensitive: true
        }
      ]
    });

    // WhatsApp Business Node
    this.registry.set('n8n-nodes-base.whatsappBusiness', {
      nodeType: 'n8n-nodes-base.whatsappBusiness',
      requiredValues: [
        {
          parameter: 'accessToken',
          description: 'WhatsApp Business API access token',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'phoneNumberId',
          description: 'WhatsApp Business phone number ID',
          type: 'identifier'
        },
        {
          parameter: 'to',
          description: 'Recipient WhatsApp number',
          example: '+1234567890',
          type: 'identifier'
        }
      ]
    });

    // Database Nodes
    this.registry.set('n8n-nodes-base.postgres', {
      nodeType: 'n8n-nodes-base.postgres',
      requiredValues: [
        {
          parameter: 'database',
          description: 'PostgreSQL database connection',
          type: 'credential',
          sensitive: true
        }
      ]
    });

    this.registry.set('n8n-nodes-base.mongoDb', {
      nodeType: 'n8n-nodes-base.mongoDb',
      requiredValues: [
        {
          parameter: 'connectionString',
          description: 'MongoDB connection string',
          example: 'mongodb://localhost:27017/mydb',
          type: 'endpoint',
          sensitive: true
        }
      ]
    });

    // Google Sheets Node
    this.registry.set('n8n-nodes-base.googleSheets', {
      nodeType: 'n8n-nodes-base.googleSheets',
      requiredValues: [
        {
          parameter: 'authentication',
          description: 'Google OAuth2 credentials',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'documentId',
          description: 'Google Sheets document ID',
          example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          type: 'identifier'
        }
      ]
    });

    // Webhook Node
    this.registry.set('n8n-nodes-base.webhook', {
      nodeType: 'n8n-nodes-base.webhook',
      requiredValues: [
        {
          parameter: 'path',
          description: 'Webhook path (will be appended to your n8n URL)',
          example: 'my-webhook',
          type: 'identifier'
        }
      ]
    });

    // Telegram Node
    this.registry.set('n8n-nodes-base.telegram', {
      nodeType: 'n8n-nodes-base.telegram',
      requiredValues: [
        {
          parameter: 'authentication',
          description: 'Telegram Bot API token',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'chatId',
          description: 'Telegram chat ID or username',
          example: '@yourchannel or 123456789',
          type: 'identifier'
        }
      ]
    });

    // RSS Feed Node
    this.registry.set('n8n-nodes-base.rssFeedRead', {
      nodeType: 'n8n-nodes-base.rssFeedRead',
      requiredValues: [
        {
          parameter: 'url',
          description: 'RSS feed URL',
          example: 'https://yourblog.com/feed.xml',
          type: 'endpoint'
        }
      ]
    });

    // Set Node (when used for parameters)
    this.registry.set('n8n-nodes-base.set', {
      nodeType: 'n8n-nodes-base.set',
      requiredValues: []  // Will be checked dynamically based on values
    });

    // Slack Node
    this.registry.set('n8n-nodes-base.slack', {
      nodeType: 'n8n-nodes-base.slack',
      requiredValues: [
        {
          parameter: 'authentication',
          description: 'Slack OAuth2 token or webhook URL',
          type: 'credential',
          sensitive: true
        },
        {
          parameter: 'channel',
          description: 'Slack channel ID or name',
          example: '#general or C1234567890',
          type: 'identifier'
        }
      ]
    });
  }

  /**
   * Get user required values for a specific node type
   */
  public getRequiredValues(nodeType: string): UserRequiredValue[] {
    const requirements = this.registry.get(nodeType);
    return requirements?.requiredValues || [];
  }

  /**
   * Check if a node has user required values
   */
  public hasRequiredValues(nodeType: string): boolean {
    return this.registry.has(nodeType);
  }

  /**
   * Get all nodes that have user required values
   */
  public getAllNodesWithRequirements(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Analyze a workflow and return all user required values
   */
  public analyzeWorkflow(nodes: any[]): {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    missingValues: UserRequiredValue[];
  }[] {
    const results: any[] = [];

    for (const node of nodes) {
      // Special handling for Set nodes (often used for workflow parameters/config)
      if (node.type === 'n8n-nodes-base.set' && 
          (node.name?.toLowerCase().includes('parameter') || 
           node.name?.toLowerCase().includes('config') ||
           node.name?.toLowerCase().includes('setting'))) {
        const setNodeValues = this.analyzeSetNode(node);
        if (setNodeValues.length > 0) {
          results.push({
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            missingValues: setNodeValues
          });
        }
        continue;
      }

      // Special handling for Function nodes that configure data
      if ((node.type === 'n8n-nodes-base.function' || node.type === 'n8n-nodes-base.code') && 
          (node.name?.toLowerCase().includes('config') || node.name?.toLowerCase().includes('parameter'))) {
        const functionNodeValues = this.analyzeFunctionNode(node);
        if (functionNodeValues.length > 0) {
          results.push({
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            missingValues: functionNodeValues
          });
        }
        continue;
      }

      if (this.hasRequiredValues(node.type)) {
        const requiredValues = this.getRequiredValues(node.type);
        const missingValues: UserRequiredValue[] = [];

        for (const required of requiredValues) {
          const paramValue = node.parameters?.[required.parameter];
          
          // Check if value is missing or is a placeholder
          if (!paramValue || 
              this.isPlaceholderValue(paramValue) ||
              (required.type === 'endpoint' && this.isExampleEndpoint(paramValue)) ||
              (required.type === 'identifier' && this.isExampleIdentifier(paramValue))) {
            missingValues.push(required);
          }
        }

        if (missingValues.length > 0) {
          results.push({
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            missingValues
          });
        }
      }
    }

    return results;
  }

  /**
   * Analyze Set node for workflow parameters
   */
  private analyzeSetNode(node: any): UserRequiredValue[] {
    const missingValues: UserRequiredValue[] = [];
    
    if (!node.parameters?.values) return missingValues;
    
    const values = node.parameters.values;
    
    // Check string values
    if (values.string && Array.isArray(values.string)) {
      for (const param of values.string) {
        if (param.value && this.isPlaceholderValue(param.value)) {
          // Determine type based on parameter name
          let type: UserRequiredValue['type'] = 'configuration';
          let description = `Parameter '${param.name}'`;
          
          if (param.name.toLowerCase().includes('url') || 
              param.name.toLowerCase().includes('endpoint')) {
            type = 'endpoint';
            description = `URL/Endpoint for ${param.name}`;
          } else if (param.name.toLowerCase().includes('id') || 
                     param.name.toLowerCase().includes('channel') ||
                     param.name.toLowerCase().includes('name')) {
            type = 'identifier';
            description = `Identifier for ${param.name}`;
          }
          
          missingValues.push({
            parameter: param.name,
            description,
            type,
            example: param.value
          });
        }
      }
    }
    
    // Check number values
    if (values.number && Array.isArray(values.number)) {
      for (const param of values.number) {
        if (param.value && this.isExampleIdentifier(param.value.toString())) {
          missingValues.push({
            parameter: param.name,
            description: `Numeric identifier for ${param.name}`,
            type: 'identifier',
            example: param.value.toString()
          });
        }
      }
    }
    
    return missingValues;
  }

  /**
   * Analyze Function node for configuration values
   */
  private analyzeFunctionNode(node: any): UserRequiredValue[] {
    const missingValues: UserRequiredValue[] = [];
    
    const code = node.parameters?.functionCode || node.parameters?.jsCode || '';
    
    // Look for example URLs in the code
    const urlRegex = /["'](https?:\/\/[^"']+)["']/g;
    let match;
    
    while ((match = urlRegex.exec(code)) !== null) {
      const url = match[1];
      if (this.isExampleEndpoint(url)) {
        missingValues.push({
          parameter: 'url',
          description: 'RSS feed URL or API endpoint',
          type: 'endpoint',
          example: url
        });
      }
    }
    
    // Look for example email addresses
    const emailRegex = /["']([^"']*@[^"']+)["']/g;
    while ((match = emailRegex.exec(code)) !== null) {
      const email = match[1];
      if (this.isPlaceholderValue(email)) {
        missingValues.push({
          parameter: 'email',
          description: 'Email address',
          type: 'identifier',
          example: email
        });
      }
    }
    
    // Look for obvious placeholders in strings
    const stringRegex = /["']([^"']+)["']/g;
    while ((match = stringRegex.exec(code)) !== null) {
      const value = match[1];
      if (value.toLowerCase().includes('your_') || 
          value.toLowerCase().includes('example') ||
          value === 'YOUR_CHAT_ID_HERE') {
        missingValues.push({
          parameter: 'configuration',
          description: `Configuration value: ${value}`,
          type: 'configuration',
          example: value
        });
      }
    }
    
    return missingValues;
  }

  /**
   * Check if a value is a placeholder
   */
  private isPlaceholderValue(value: any): boolean {
    if (typeof value !== 'string') return false;
    
    const placeholders = [
      'your-',
      'yourcompany',
      'yourblog',
      'yourchannel',
      'example.com',
      'example.org',
      '@example.',
      'localhost',
      'placeholder',
      'sample',
      'test',
      'demo',
      'xxx',
      '123456',
      'abc123',
      'noreply@',
      'admin@',
      'user@',
      'info@',
      'alerts@',
      'notifications@',
      'recipient@',
      '1234-5678',
      'sample_doc_id',
      'mqtt_user',
      'mqtt_password',
      'your_api_key',
      'bearer [token]',
      '$env.',
      '{{$env.'
    ];

    const lowerValue = value.toLowerCase();
    return placeholders.some(ph => lowerValue.includes(ph));
  }

  /**
   * Check if an endpoint is an example
   */
  private isExampleEndpoint(value: string): boolean {
    const examplePatterns = [
      /example\.com/i,
      /example\.org/i,
      /localhost/i,
      /127\.0\.0\.1/,
      /test\./i,
      /demo\./i,
      /sample\./i,
      /yourcompany/i,
      /yourdomain/i,
      /yourservice/i,
      /yourblog/i,
      /fraudcheckapi\.com/i,  // Common test API
      /api\.example/i,
      /mqtt-broker\.example/i,
      /ecommerce\.com/i  // Generic domain
    ];

    return examplePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Check if an identifier is an example
   */
  private isExampleIdentifier(value: string): boolean {
    const examplePatterns = [
      /^[0-9]+$/,  // Just numbers like "123456"
      /^abc/i,
      /test/i,
      /sample/i,
      /example/i,
      /your/i,
      /1234-5678/i,  // UUID patterns
      /sample_doc_id/i,
      /@yourchannel/i,
      /webhook-alert/i,
      /email-webhook/i,
      /contact-form/i,
      /mqtt_user/i,
      /mqtt_password/i,
      /^unknown$/i,  // Default values
      /^normal$/i,
      /^default/i
    ];

    return examplePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Generate a user-friendly report of missing values
   */
  public generateReport(analysis: ReturnType<typeof this.analyzeWorkflow>): string {
    if (analysis.length === 0) {
      return 'All required user values are properly configured!';
    }

    let report = '## User Configuration Required\n\n';
    report += 'The following configurations need to be set up:\n\n';

    // Group by credential type to avoid duplicates
    const credentialGroups = new Map<string, {
      nodeType: string;
      parameters: Set<string>;
      nodes: string[];
      examples: Map<string, string>;
    }>();

    // Group similar credentials together
    for (const node of analysis) {
      for (const missing of node.missingValues) {
        if (missing.type === 'credential') {
          // Create a key based on node type
          const key = node.nodeType;
          
          if (!credentialGroups.has(key)) {
            credentialGroups.set(key, {
              nodeType: node.nodeType,
              parameters: new Set(),
              nodes: [],
              examples: new Map()
            });
          }
          
          const group = credentialGroups.get(key)!;
          group.parameters.add(missing.parameter);
          if (!group.nodes.includes(node.nodeName)) {
            group.nodes.push(node.nodeName);
          }
          if (missing.example && !group.examples.has(missing.parameter)) {
            group.examples.set(missing.parameter, missing.example);
          }
        }
      }
    }

    // First, list credential requirements grouped by type
    if (credentialGroups.size > 0) {
      report += '### 🔐 Credentials Required\n\n';
      
      for (const [key, group] of credentialGroups) {
        const nodeTypeName = group.nodeType.replace('n8n-nodes-base.', '').toUpperCase();
        report += `#### ${nodeTypeName} Credentials\n`;
        report += `Used by: ${group.nodes.join(', ')}\n\n`;
        
        for (const param of group.parameters) {
          const example = group.examples.get(param);
          report += `- **${param}**`;
          if (example) {
            report += ` (e.g., \`${example}\`)`;
          }
          report += '\n';
        }
        report += '\n';
      }
    }

    // Then list other configuration requirements
    const otherConfigs = analysis.filter(node => 
      node.missingValues.some(v => v.type !== 'credential')
    );

    if (otherConfigs.length > 0) {
      report += '### ⚙️ Other Configurations\n\n';
      
      for (const node of otherConfigs) {
        const nonCredentials = node.missingValues.filter(v => v.type !== 'credential');
        if (nonCredentials.length > 0) {
          report += `#### ${node.nodeName}\n`;
          
          for (const missing of nonCredentials) {
            report += `- **${missing.parameter}**: ${missing.description}\n`;
            if (missing.example) {
              report += `  Example: \`${missing.example}\`\n`;
            }
            report += '\n';
          }
        }
      }
    }

    report += '\n### 📋 Next Steps:\n';
    report += '1. Set up credentials in n8n (Settings → Credentials)\n';
    report += '2. Update workflow nodes with your specific values\n';
    report += '3. Test each connection before running the full workflow\n';

    return report;
  }
}