// node-parameter-handler.ts
// Handles node-specific parameter preservation from AI responses

import { n8nNode } from './workflow-builder.types.js';

export interface NodeParameterMapping {
  nodeType: string;
  requiredParameters: string[];
  parameterDefaults?: Record<string, any>;
  parameterTransforms?: Record<string, (value: any) => any>;
}

export class NodeParameterHandler {
  private parameterMappings: Map<string, NodeParameterMapping>;

  constructor() {
    this.parameterMappings = new Map();
    this.initializeParameterMappings();
  }

  private initializeParameterMappings(): void {
    // Switch node parameters
    this.parameterMappings.set('n8n-nodes-base.switch', {
      nodeType: 'n8n-nodes-base.switch',
      requiredParameters: ['dataType', 'value1', 'rules', 'fallbackOutput'],
      parameterDefaults: {
        dataType: 'string',
        value1: '={{$json}}',
        fallbackOutput: 0
      }
    });

    // Email Send node parameters
    this.parameterMappings.set('n8n-nodes-base.emailSend', {
      nodeType: 'n8n-nodes-base.emailSend',
      requiredParameters: ['subject', 'text', 'options'],
      parameterDefaults: {
        options: {}
      },
      parameterTransforms: {
        toEmail: (value: any) => ({ toRecipients: value }),
        fromEmail: (value: any) => ({ fromEmail: value })
      }
    });

    // HTTP Request node parameters
    this.parameterMappings.set('n8n-nodes-base.httpRequest', {
      nodeType: 'n8n-nodes-base.httpRequest',
      requiredParameters: ['url', 'method', 'options'],
      parameterDefaults: {
        method: 'GET',
        options: {}
      }
    });

    // IF node parameters
    this.parameterMappings.set('n8n-nodes-base.if', {
      nodeType: 'n8n-nodes-base.if',
      requiredParameters: ['conditions'],
      parameterDefaults: {
        conditions: {
          boolean: []
        }
      }
    });

    // Function node parameters
    this.parameterMappings.set('n8n-nodes-base.function', {
      nodeType: 'n8n-nodes-base.function',
      requiredParameters: ['functionCode'],
      parameterDefaults: {
        functionCode: '// Your code here\nreturn items;'
      }
    });

    // Webhook node parameters
    this.parameterMappings.set('n8n-nodes-base.webhook', {
      nodeType: 'n8n-nodes-base.webhook',
      requiredParameters: ['path', 'httpMethod', 'options'],
      parameterDefaults: {
        httpMethod: 'POST',
        options: {}
      }
    });

    // Split In Batches parameters
    this.parameterMappings.set('n8n-nodes-base.splitInBatches', {
      nodeType: 'n8n-nodes-base.splitInBatches',
      requiredParameters: ['batchSize', 'options'],
      parameterDefaults: {
        batchSize: 10,
        options: {}
      }
    });

    // Set node parameters
    this.parameterMappings.set('n8n-nodes-base.set', {
      nodeType: 'n8n-nodes-base.set',
      requiredParameters: ['values', 'options'],
      parameterDefaults: {
        values: {
          string: []
        },
        options: {}
      }
    });

    // Merge node parameters
    this.parameterMappings.set('n8n-nodes-base.merge', {
      nodeType: 'n8n-nodes-base.merge',
      requiredParameters: ['mode', 'options'],
      parameterDefaults: {
        mode: 'append',
        options: {}
      }
    });

    // Schedule Trigger parameters
    this.parameterMappings.set('n8n-nodes-base.scheduleTrigger', {
      nodeType: 'n8n-nodes-base.scheduleTrigger',
      requiredParameters: ['rule'],
      parameterDefaults: {
        rule: {
          interval: [{
            field: 'hours',
            hoursInterval: 1
          }]
        }
      }
    });

    // Error Trigger parameters (no required parameters)
    this.parameterMappings.set('n8n-nodes-base.errorTrigger', {
      nodeType: 'n8n-nodes-base.errorTrigger',
      requiredParameters: [],
      parameterDefaults: {}
    });

    // Code node parameters
    this.parameterMappings.set('n8n-nodes-base.code', {
      nodeType: 'n8n-nodes-base.code',
      requiredParameters: ['jsCode'],
      parameterDefaults: {
        jsCode: '// Your code here\nreturn $input.all();'
      }
    });

    // Cron node parameters
    this.parameterMappings.set('n8n-nodes-base.cron', {
      nodeType: 'n8n-nodes-base.cron',
      requiredParameters: ['triggerTimes'],
      parameterDefaults: {
        triggerTimes: {
          item: [{
            mode: 'everyMinute'
          }]
        }
      }
    });

    // Respond to Webhook parameters
    this.parameterMappings.set('n8n-nodes-base.respondToWebhook', {
      nodeType: 'n8n-nodes-base.respondToWebhook',
      requiredParameters: ['options'],
      parameterDefaults: {
        options: {}
      }
    });
  }

  /**
   * Ensure all required parameters are present for a node
   */
  public ensureNodeParameters(node: n8nNode): n8nNode {
    const mapping = this.parameterMappings.get(node.type);
    if (!mapping) {
      console.log(`No parameter mapping found for node type: ${node.type}`);
      return node;
    }

    // Ensure parameters object exists
    if (!node.parameters) {
      node.parameters = {};
    }

    // Check and add missing required parameters
    const missingParams: string[] = [];
    for (const param of mapping.requiredParameters) {
      if (!(param in node.parameters)) {
        missingParams.push(param);
        // Add default if available
        if (mapping.parameterDefaults && param in mapping.parameterDefaults) {
          node.parameters[param] = mapping.parameterDefaults[param];
        }
      }
    }

    if (missingParams.length > 0) {
      console.log(`Added missing parameters for ${node.name} (${node.type}): ${missingParams.join(', ')}`);
    }

    // Apply any parameter transforms
    if (mapping.parameterTransforms) {
      for (const [param, transform] of Object.entries(mapping.parameterTransforms)) {
        if (param in node.parameters) {
          node.parameters[param] = transform(node.parameters[param]);
        }
      }
    }

    return node;
  }

  /**
   * Extract and preserve AI-provided parameters
   */
  public extractAIParameters(aiNode: any): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    // Preserve all parameters from AI response
    if (aiNode.parameters) {
      Object.assign(parameters, aiNode.parameters);
    }

    // Log what we're preserving
    const paramKeys = Object.keys(parameters);
    if (paramKeys.length > 0) {
      console.log(`  Preserving AI parameters for ${aiNode.name}: ${paramKeys.join(', ')}`);
    }

    return parameters;
  }

  /**
   * Merge AI parameters with defaults, preserving AI values
   */
  public mergeParameters(nodeType: string, aiParameters: Record<string, any>): Record<string, any> {
    const mapping = this.parameterMappings.get(nodeType);
    if (!mapping) {
      return aiParameters;
    }

    // Start with defaults
    const merged = { ...(mapping.parameterDefaults || {}) };
    
    // Override with AI-provided parameters
    Object.assign(merged, aiParameters);

    return merged;
  }

  /**
   * Validate node parameters
   */
  public validateNodeParameters(node: n8nNode): string[] {
    const errors: string[] = [];
    const mapping = this.parameterMappings.get(node.type);
    
    if (!mapping) {
      return errors;
    }

    // Check for empty required parameters
    for (const param of mapping.requiredParameters) {
      if (!node.parameters || !(param in node.parameters)) {
        errors.push(`Node '${node.name}' missing required parameter: ${param}`);
      } else if (node.parameters[param] === null || node.parameters[param] === undefined) {
        errors.push(`Node '${node.name}' has null/undefined parameter: ${param}`);
      }
    }

    return errors;
  }

  /**
   * Fix common parameter issues
   */
  public fixCommonParameterIssues(node: n8nNode): n8nNode {
    // Fix switch node conditions format
    if (node.type === 'n8n-nodes-base.switch') {
      // Preserve value parameter from AI
      if (node.parameters?.value && !node.parameters.value1) {
        node.parameters.value1 = node.parameters.value;
        delete node.parameters.value;
      }
      
      // Ensure rules have correct structure
      if (node.parameters?.rules && !node.parameters.rules.rules) {
        // If rules is directly an array, wrap it
        if (Array.isArray(node.parameters.rules)) {
          node.parameters.rules = {
            rules: node.parameters.rules
          };
        }
      }
    }

    // Fix email recipients format
    if (node.type === 'n8n-nodes-base.emailSend') {
      // Convert sendTo to toRecipients
      if (node.parameters?.sendTo && !node.parameters.toRecipients) {
        node.parameters.toRecipients = node.parameters.sendTo;
        delete node.parameters.sendTo;
      }
      
      // Convert toEmail to toRecipients
      if (node.parameters?.toEmail && !node.parameters.toRecipients) {
        node.parameters.toRecipients = node.parameters.toEmail;
        delete node.parameters.toEmail;
      }
      
      // Ensure toRecipients is a string
      if (node.parameters?.toRecipients && typeof node.parameters.toRecipients !== 'string') {
        if (Array.isArray(node.parameters.toRecipients)) {
          node.parameters.toRecipients = node.parameters.toRecipients.join(',');
        } else {
          node.parameters.toRecipients = String(node.parameters.toRecipients);
        }
      }
    }

    // Fix HTTP Request authentication and endpoint
    if (node.type === 'n8n-nodes-base.httpRequest') {
      // Convert endpoint to url
      if (node.parameters?.endpoint && !node.parameters.url) {
        node.parameters.url = node.parameters.endpoint;
        delete node.parameters.endpoint;
      }
      
      // Fix bodyParameters format
      if (node.parameters?.bodyParameters && node.parameters?.sendBody) {
        // Convert bodyParameters to the correct format
        if (typeof node.parameters.bodyParameters === 'object') {
          node.parameters.bodyParametersJson = JSON.stringify(node.parameters.bodyParameters);
          node.parameters.contentType = 'json';
          delete node.parameters.bodyParameters;
        }
      }
      
      // Ensure authentication is properly set
      if (node.parameters?.authentication && typeof node.parameters.authentication === 'string' && node.parameters.authentication !== 'none') {
        // Authentication might need credentials reference
        console.log(`Note: HTTP Request node '${node.name}' uses ${node.parameters.authentication} authentication`);
      }
    }

    // Fix Cron node rule parameter
    if (node.type === 'n8n-nodes-base.cron' && node.parameters?.rule && !node.parameters.triggerTimes) {
      // Convert simple rule to triggerTimes format
      node.parameters.triggerTimes = {
        item: [{
          mode: 'custom',
          cronExpression: node.parameters.rule
        }]
      };
      delete node.parameters.rule;
    }

    // Fix Set node values format
    if (node.type === 'n8n-nodes-base.set' && node.parameters?.values) {
      // If values is a plain object, convert to n8n format
      if (!node.parameters.values.string && !node.parameters.values.number && !node.parameters.values.boolean) {
        const stringValues = [];
        for (const [key, value] of Object.entries(node.parameters.values)) {
          stringValues.push({
            name: key,
            value: String(value)
          });
        }
        node.parameters.values = {
          string: stringValues
        };
      }
      
      // Ensure options property exists
      if (!node.parameters.options) {
        node.parameters.options = {};
      }
    }

    // Ensure all nodes have options property if missing
    if (!node.parameters?.options && this.nodeRequiresOptions(node.type)) {
      node.parameters = node.parameters || {};
      node.parameters.options = {};
    }

    return node;
  }

  /**
   * Check if node type requires options property
   */
  private nodeRequiresOptions(nodeType: string): boolean {
    const nodesRequiringOptions = [
      'n8n-nodes-base.emailSend',
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.splitInBatches',
      'n8n-nodes-base.merge',
      'n8n-nodes-base.set',
      'n8n-nodes-base.respondToWebhook'
    ];
    return nodesRequiringOptions.includes(nodeType);
  }

  /**
   * Get parameter documentation for a node type
   */
  public getParameterDocumentation(nodeType: string): string {
    const mapping = this.parameterMappings.get(nodeType);
    if (!mapping) {
      return `No parameter documentation available for ${nodeType}`;
    }

    const docs = [`Parameters for ${nodeType}:`, ''];
    docs.push('Required parameters:');
    mapping.requiredParameters.forEach(param => {
      const defaultValue = mapping.parameterDefaults?.[param];
      docs.push(`  - ${param}${defaultValue !== undefined ? ` (default: ${JSON.stringify(defaultValue)})` : ''}`);
    });

    return docs.join('\n');
  }
}