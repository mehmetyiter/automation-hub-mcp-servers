// node-parameter-handler.ts
// Handles node-specific parameter preservation from AI responses

import { n8nNode } from './workflow-builder.types.js';
import { NodeCapabilityRegistry } from './node-capability-registry.js';

export interface NodeParameterMapping {
  nodeType: string;
  requiredParameters: string[];
  parameterDefaults?: Record<string, any>;
  parameterTransforms?: Record<string, (value: any) => any>;
}

export class NodeParameterHandler {
  private parameterMappings: Map<string, NodeParameterMapping>;
  private capabilityRegistry: NodeCapabilityRegistry;

  constructor() {
    this.parameterMappings = new Map();
    this.capabilityRegistry = new NodeCapabilityRegistry();
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

    // MQTT node parameters
    this.parameterMappings.set('n8n-nodes-base.mqtt', {
      nodeType: 'n8n-nodes-base.mqtt',
      requiredParameters: ['broker', 'topic', 'options'],
      parameterDefaults: {
        broker: 'mqtt://localhost:1883',
        topic: 'n8n/default',
        options: {
          qos: 1,
          retain: false
        }
      }
    });


    // Twilio node parameters
    this.parameterMappings.set('n8n-nodes-base.twilio', {
      nodeType: 'n8n-nodes-base.twilio',
      requiredParameters: ['operation', 'from', 'to', 'message'],
      parameterDefaults: {
        operation: 'sms',
        from: '={{$credentials.fromNumber}}',
        to: '',
        message: ''
      }
    });

    // WhatsApp Business node parameters
    this.parameterMappings.set('n8n-nodes-base.whatsappBusiness', {
      nodeType: 'n8n-nodes-base.whatsappBusiness',
      requiredParameters: ['phoneNumberId', 'to', 'messageType', 'text'],
      parameterDefaults: {
        messageType: 'text',
        text: ''
      }
    });

    // Cron node parameters with proper time handling
    this.parameterMappings.set('n8n-nodes-base.cron', {
      nodeType: 'n8n-nodes-base.cron',
      requiredParameters: ['triggerTimes'],
      parameterDefaults: {
        triggerTimes: {
          item: [{
            mode: 'everyMinute'
          }]
        }
      },
      parameterTransforms: {
        // Transform common time patterns to proper cron settings
        rule: (value: any) => {
          const lowerValue = String(value).toLowerCase();
          if (lowerValue.includes('hourly') || lowerValue.includes('every hour')) {
            return { item: [{ mode: 'everyHour' }] };
          } else if (lowerValue.includes('daily') || lowerValue.includes('every day')) {
            return { item: [{ mode: 'everyDay', hour: 9, minute: 0 }] };
          } else if (lowerValue.includes('weekly') || lowerValue.includes('every week')) {
            return { item: [{ mode: 'everyWeek', hour: 9, minute: 0, weekday: 1 }] };
          }
          // Default to original value
          return value;
        }
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
    // First check if we have capability registry info for this node
    const capability = this.capabilityRegistry.getNodeCapability(node.type);
    if (capability) {
      // Use capability registry for nodes we have enhanced support for
      console.log(`Using capability registry for ${node.type}`);
      
      // Ensure parameters object exists
      if (!node.parameters) {
        node.parameters = {};
      }

      // Get required parameters from registry
      const requiredParams = this.capabilityRegistry.getRequiredParameters(node.type);
      const defaults = this.capabilityRegistry.getParameterDefaults(node.type);
      
      // Add missing required parameters
      const missingParams: string[] = [];
      for (const [param, defaultValue] of Object.entries(requiredParams)) {
        if (!(param in node.parameters)) {
          missingParams.push(param);
          node.parameters[param] = defaultValue || defaults[param];
        }
      }

      // Add any other defaults that aren't required but are useful
      for (const [param, defaultValue] of Object.entries(defaults)) {
        if (!(param in node.parameters)) {
          node.parameters[param] = defaultValue;
        }
      }

      if (missingParams.length > 0) {
        console.log(`Added missing parameters for ${node.name} (${node.type}): ${missingParams.join(', ')}`);
      }

      // Validate parameters
      const validation = this.capabilityRegistry.validateParameters(node.type, node.parameters);
      if (!validation.valid) {
        console.warn(`Parameter validation errors for ${node.name}:`, validation.errors);
      }
      if (validation.warnings.length > 0) {
        console.warn(`Parameter validation warnings for ${node.name}:`, validation.warnings);
      }
    } else {
      // Fall back to traditional mapping for other nodes
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
    }

    // Special handling for cron nodes - fix time patterns
    if (node.type === 'n8n-nodes-base.cron') {
      this.fixCronParameters(node);
    }

    return node;
  }

  /**
   * Fix cron parameters based on node name
   */
  private fixCronParameters(node: n8nNode): void {
    const nameLower = node.name.toLowerCase();
    
    // Check if we need to fix the schedule
    if (node.parameters?.triggerTimes?.item?.[0]?.mode === 'everyMinute') {
      if (nameLower.includes('hourly') || nameLower.includes('hour')) {
        console.log(`Fixing cron schedule for ${node.name}: everyMinute -> everyHour`);
        node.parameters.triggerTimes = {
          item: [{ mode: 'everyHour' }]
        };
      } else if (nameLower.includes('daily') || nameLower.includes('day')) {
        console.log(`Fixing cron schedule for ${node.name}: everyMinute -> everyDay`);
        node.parameters.triggerTimes = {
          item: [{ mode: 'everyDay', hour: 9, minute: 0 }]
        };
      } else if (nameLower.includes('weekly') || nameLower.includes('week')) {
        console.log(`Fixing cron schedule for ${node.name}: everyMinute -> everyWeek`);
        node.parameters.triggerTimes = {
          item: [{ mode: 'everyWeek', hour: 9, minute: 0, weekday: 1 }]
        };
      }
    }
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
    // First check capability registry for enhanced support
    const capability = this.capabilityRegistry.getNodeCapability(nodeType);
    if (capability) {
      // Get defaults from capability registry
      const defaults = this.capabilityRegistry.getParameterDefaults(nodeType);
      const merged = { ...defaults };
      
      // Override with AI-provided parameters
      Object.assign(merged, aiParameters);
      
      // Don't add default values for user-specific parameters
      // These should be configured by the user
      
      return merged;
    }
    
    // Fall back to old parameter mappings
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
    
    // First try capability registry validation
    const validation = this.capabilityRegistry.validateParameters(node.type, node.parameters || {});
    if (validation.errors.length > 0) {
      return validation.errors.map(error => `Node '${node.name}': ${error}`);
    }
    
    // Fall back to old parameter mappings
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
      
      // Fix Set nodes that are trying to store arrays in string fields
      if (node.parameters.values.string && Array.isArray(node.parameters.values.string)) {
        const fixedValues: any = { string: [], json: [] };
        
        for (const item of node.parameters.values.string) {
          // Check if the value contains an array expression
          if (item.value && typeof item.value === 'string' && 
              (item.value.includes('={{ [') || item.value.includes('={{[')) &&
              item.value.includes('] }}')) {
            // This is an array expression, move to json values
            fixedValues.json.push({
              name: item.name,
              value: item.value
            });
            console.log(`Fixed Set node "${node.name}": moved array value "${item.name}" from string to json`);
          } else {
            // Keep as string value
            fixedValues.string.push(item);
          }
        }
        
        // Copy other value types if they exist
        if (node.parameters.values.number) fixedValues.number = node.parameters.values.number;
        if (node.parameters.values.boolean) fixedValues.boolean = node.parameters.values.boolean;
        if (node.parameters.values.json) {
          fixedValues.json = [...fixedValues.json, ...node.parameters.values.json];
        }
        
        node.parameters.values = fixedValues;
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

  /**
   * Get intelligent parameter suggestions based on context
   */
  public getIntelligentParameters(node: n8nNode, workflowContext?: any): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Check if we have capability registry info
    const capability = this.capabilityRegistry.getNodeCapability(node.type);
    if (capability) {
      // Get defaults from registry
      const defaults = this.capabilityRegistry.getParameterDefaults(node.type);
      Object.assign(params, defaults);
      
      // Apply context-aware adjustments
      if (node.type === 'n8n-nodes-base.mqtt') {
        // Smart MQTT topic based on node name
        if (node.name.toLowerCase().includes('sensor')) {
          params.topic = 'sensors/+/data';
        } else if (node.name.toLowerCase().includes('control')) {
          params.topic = 'devices/+/control';
        } else if (node.name.toLowerCase().includes('greenhouse')) {
          params.topic = 'greenhouse/+/status';
        }
      } else if (node.type === 'n8n-nodes-base.cron') {
        // Smart schedule based on node name
        const nameLower = node.name.toLowerCase();
        if (nameLower.includes('hourly') || nameLower.includes('hour')) {
          params.triggerTimes = {
            item: [{ mode: 'everyHour' }]
          };
        } else if (nameLower.includes('daily') || nameLower.includes('day')) {
          params.triggerTimes = {
            item: [{ mode: 'everyDay', hour: 9, minute: 0 }]
          };
        } else if (nameLower.includes('weekly') || nameLower.includes('week')) {
          params.triggerTimes = {
            item: [{ mode: 'everyWeek', hour: 9, minute: 0, weekday: 1 }]
          };
        }
      }
    }
    
    return params;
  }

  /**
   * Check if node type is supported by capability registry
   */
  public hasEnhancedSupport(nodeType: string): boolean {
    return this.capabilityRegistry.getNodeCapability(nodeType) !== undefined;
  }

  /**
   * Get alternative nodes for a given node type
   */
  public getAlternativeNodes(nodeType: string): string[] {
    return this.capabilityRegistry.getAlternativeNodes(nodeType);
  }

  /**
   * Get recommended connections for a node
   */
  public getRecommendedConnections(nodeType: string): { input: string[]; output: string[] } {
    return this.capabilityRegistry.getRecommendedConnections(nodeType);
  }
}