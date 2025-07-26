/**
 * n8n Node Parameters Registry
 * 
 * This file contains the parameter requirements and validation rules for n8n nodes.
 * Each node type has specific parameter formats that must be followed.
 * 
 * IMPORTANT: This registry is based on n8n node documentation and must be kept up to date.
 */

export interface NodeParameterRule {
  nodeType: string;
  parameterPath: string;
  expectedType: 'array' | 'object' | 'string' | 'number' | 'boolean';
  transformer?: (value: any) => any;
  validator?: (value: any) => boolean;
  defaultValue?: any;
  required?: boolean;
  description?: string;
}

export class NodeParametersRegistry {
  private static rules: NodeParameterRule[] = [
    // Email Send Node
    {
      nodeType: 'n8n-nodes-base.emailSend',
      parameterPath: 'toRecipients',
      expectedType: 'array',
      transformer: (value: any) => {
        if (typeof value === 'string') {
          return value.split(',').map(email => email.trim());
        }
        return Array.isArray(value) ? value : [value];
      },
      required: true,
      description: 'Recipients must be an array of email addresses'
    },
    {
      nodeType: 'n8n-nodes-base.sendEmail',
      parameterPath: 'toRecipients',
      expectedType: 'array',
      transformer: (value: any) => {
        if (typeof value === 'string') {
          return value.split(',').map(email => email.trim());
        }
        return Array.isArray(value) ? value : [value];
      },
      required: true,
      description: 'Recipients must be an array of email addresses'
    },
    
    // Merge Node
    {
      nodeType: 'n8n-nodes-base.merge',
      parameterPath: 'mergeByFields.values',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Merge field values must be an array'
    },
    {
      nodeType: 'n8n-nodes-base.merge',
      parameterPath: 'options',
      expectedType: 'object',
      defaultValue: {},
      description: 'Options must be an object'
    },
    
    // MongoDB Node
    {
      nodeType: 'n8n-nodes-base.mongoDb',
      parameterPath: 'documentId',
      expectedType: 'object',
      transformer: (value: any) => {
        if (typeof value === 'string') {
          return {
            __rl: true,
            value: value,
            mode: 'id'
          };
        }
        return value;
      },
      description: 'Document ID must be an object with __rl, value, and mode properties'
    },
    
    // Switch Node
    {
      nodeType: 'n8n-nodes-base.switch',
      parameterPath: 'mode',
      expectedType: 'string',
      defaultValue: 'expression',
      required: true,
      description: 'Switch mode is required'
    },
    {
      nodeType: 'n8n-nodes-base.switch',
      parameterPath: 'options',
      expectedType: 'object',
      defaultValue: {},
      description: 'Options must be an object'
    },
    
    // HTTP Request Node
    {
      nodeType: 'n8n-nodes-base.httpRequest',
      parameterPath: 'headerParameters.parameters',
      expectedType: 'array',
      transformer: (value: any) => {
        if (!value) return [];
        if (!Array.isArray(value)) {
          // Convert object to array format
          return Object.entries(value).map(([name, val]) => ({ name, value: val }));
        }
        return value;
      },
      defaultValue: [],
      description: 'Header parameters must be an array of {name, value} objects'
    },
    {
      nodeType: 'n8n-nodes-base.httpRequest',
      parameterPath: 'queryParameters.parameters',
      expectedType: 'array',
      transformer: (value: any) => {
        if (!value) return [];
        if (!Array.isArray(value)) {
          // Convert object to array format
          return Object.entries(value).map(([name, val]) => ({ name, value: val }));
        }
        return value;
      },
      defaultValue: [],
      description: 'Query parameters must be an array of {name, value} objects'
    },
    
    // Slack Node
    {
      nodeType: 'n8n-nodes-base.slack',
      parameterPath: 'attachments',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Attachments must be an array'
    },
    
    // Google Sheets Node
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'dataRange',
      expectedType: 'string',
      validator: (value: any) => {
        // Validate A1 notation
        return typeof value === 'string' && /^[A-Z]+\d+:[A-Z]+\d+$/.test(value);
      },
      description: 'Data range must be in A1 notation (e.g., A1:B10)'
    },
    
    // IF Node
    {
      nodeType: 'n8n-nodes-base.if',
      parameterPath: 'conditions.conditions',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      required: true,
      description: 'Conditions must be an array'
    },
    
    // Set Node
    {
      nodeType: 'n8n-nodes-base.set',
      parameterPath: 'values.values',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Values must be an array'
    },
    
    // Split In Batches Node
    {
      nodeType: 'n8n-nodes-base.splitInBatches',
      parameterPath: 'batchSize',
      expectedType: 'number',
      transformer: (value: any) => {
        const num = parseInt(value, 10);
        return isNaN(num) ? 10 : num;
      },
      defaultValue: 10,
      required: true,
      description: 'Batch size must be a number'
    },
    
    // Webhook Node
    {
      nodeType: 'n8n-nodes-base.webhook',
      parameterPath: 'path',
      expectedType: 'string',
      transformer: (value: any) => {
        if (!value || typeof value !== 'string') {
          return 'webhook';
        }
        // Ensure path starts with /
        return value.startsWith('/') ? value.substring(1) : value;
      },
      required: true,
      description: 'Webhook path is required'
    },
    
    // Postgres Node
    {
      nodeType: 'n8n-nodes-base.postgres',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      description: 'Operation is required'
    },
    {
      nodeType: 'n8n-nodes-base.postgres',
      parameterPath: 'schema',
      expectedType: 'string',
      defaultValue: 'public',
      description: 'Schema defaults to public'
    },
    
    // Redis Node
    {
      nodeType: 'n8n-nodes-base.redis',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      description: 'Operation is required'
    },
    
    // Wait Node
    {
      nodeType: 'n8n-nodes-base.wait',
      parameterPath: 'amount',
      expectedType: 'number',
      transformer: (value: any) => {
        const num = parseFloat(value);
        return isNaN(num) ? 1 : num;
      },
      defaultValue: 1,
      required: true,
      description: 'Wait amount must be a number'
    },
    {
      nodeType: 'n8n-nodes-base.wait',
      parameterPath: 'unit',
      expectedType: 'string',
      defaultValue: 'seconds',
      validator: (value: any) => {
        return ['seconds', 'minutes', 'hours', 'days'].includes(value);
      },
      description: 'Unit must be seconds, minutes, hours, or days'
    },
    
    // Code Node (Function replacement)
    {
      nodeType: 'n8n-nodes-base.code',
      parameterPath: 'language',
      expectedType: 'string',
      defaultValue: 'javascript',
      required: true,
      validator: (value: any) => {
        return ['javascript', 'python'].includes(value.toLowerCase());
      },
      description: 'Language must be javascript or python'
    },
    {
      nodeType: 'n8n-nodes-base.code',
      parameterPath: 'jsCode',
      expectedType: 'string',
      required: true,
      description: 'JavaScript code is required when language is javascript'
    },
    {
      nodeType: 'n8n-nodes-base.code',
      parameterPath: 'pythonCode',
      expectedType: 'string',
      required: true,
      description: 'Python code is required when language is python'
    },
    {
      nodeType: 'n8n-nodes-base.code',
      parameterPath: 'mode',
      expectedType: 'string',
      defaultValue: 'runOnceForAllItems',
      validator: (value: any) => {
        return ['runOnceForAllItems', 'runOnceForEachItem'].includes(value);
      },
      description: 'Mode must be runOnceForAllItems or runOnceForEachItem'
    },
    
    // Send Email Node
    {
      nodeType: 'n8n-nodes-base.sendEmail',
      parameterPath: 'toRecipients',
      expectedType: 'array',
      transformer: (value: any) => {
        if (typeof value === 'string') {
          return value.split(',').map(email => email.trim());
        }
        return Array.isArray(value) ? value : [value];
      },
      required: true,
      description: 'Recipients must be an array of email addresses'
    },
    {
      nodeType: 'n8n-nodes-base.sendEmail',
      parameterPath: 'subject',
      expectedType: 'string',
      required: true,
      description: 'Email subject is required'
    },
    {
      nodeType: 'n8n-nodes-base.sendEmail',
      parameterPath: 'text',
      expectedType: 'string',
      description: 'Email text content'
    },
    {
      nodeType: 'n8n-nodes-base.sendEmail',
      parameterPath: 'html',
      expectedType: 'string',
      description: 'Email HTML content'
    },
    
    // MySQL Node
    {
      nodeType: 'n8n-nodes-base.mySql',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['executeQuery', 'insert', 'update', 'delete'].includes(value);
      },
      description: 'Operation is required'
    },
    {
      nodeType: 'n8n-nodes-base.mySql',
      parameterPath: 'query',
      expectedType: 'string',
      required: true,
      description: 'SQL query is required for executeQuery operation'
    },
    {
      nodeType: 'n8n-nodes-base.mySql',
      parameterPath: 'table',
      expectedType: 'string',
      required: true,
      description: 'Table name is required for insert/update/delete operations'
    },
    
    // Execute Command Node
    {
      nodeType: 'n8n-nodes-base.executeCommand',
      parameterPath: 'command',
      expectedType: 'string',
      required: true,
      description: 'Command to execute is required'
    },
    
    // Item Lists (Loop) Node
    {
      nodeType: 'n8n-nodes-base.itemLists',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['concatenateItems', 'summarize', 'split', 'sort', 'limit'].includes(value);
      },
      description: 'Operation is required'
    },
    {
      nodeType: 'n8n-nodes-base.itemLists',
      parameterPath: 'batchSize',
      expectedType: 'number',
      transformer: (value: any) => {
        const num = parseInt(value, 10);
        return isNaN(num) ? 10 : num;
      },
      defaultValue: 10,
      description: 'Batch size must be a number for split operation'
    },
    
    // Date & Time Node
    {
      nodeType: 'n8n-nodes-base.dateTime',
      parameterPath: 'action',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['format', 'calculate', 'extractDate'].includes(value);
      },
      description: 'Action is required'
    },
    {
      nodeType: 'n8n-nodes-base.dateTime',
      parameterPath: 'value',
      expectedType: 'string',
      required: true,
      description: 'Date value is required'
    },
    
    // Aggregate Node
    {
      nodeType: 'n8n-nodes-base.aggregate',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['aggregate', 'branch'].includes(value);
      },
      description: 'Operation is required'
    },
    {
      nodeType: 'n8n-nodes-base.aggregate',
      parameterPath: 'fieldsToAggregate.fieldToAggregate',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Fields to aggregate must be an array'
    },
    
    // Filter Node  
    {
      nodeType: 'n8n-nodes-base.filter',
      parameterPath: 'conditions.conditions',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      required: true,
      description: 'Filter conditions must be an array'
    },
    
    // HTML Node
    {
      nodeType: 'n8n-nodes-base.html',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['generateHtmlTemplate', 'extractHtmlContent'].includes(value);
      },
      description: 'Operation is required'
    },
    {
      nodeType: 'n8n-nodes-base.html',
      parameterPath: 'html',
      expectedType: 'string',
      required: true,
      description: 'HTML content is required'
    },
    
    // Crypto Node
    {
      nodeType: 'n8n-nodes-base.crypto',
      parameterPath: 'action',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['hash', 'hmac', 'sign', 'verify', 'encrypt', 'decrypt'].includes(value);
      },
      description: 'Action is required'
    },
    {
      nodeType: 'n8n-nodes-base.crypto',
      parameterPath: 'type',
      expectedType: 'string',
      required: true,
      description: 'Crypto type is required'
    },
    
    // Schedule Trigger Node
    {
      nodeType: 'n8n-nodes-base.scheduleTrigger',
      parameterPath: 'rule.interval',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Schedule intervals must be an array'
    },
    
    // Manual Trigger Node
    {
      nodeType: 'n8n-nodes-base.manualTrigger',
      parameterPath: 'triggerPolicy',
      expectedType: 'string',
      defaultValue: 'workflowActivate',
      validator: (value: any) => {
        return ['workflowActivate', 'manual'].includes(value);
      },
      description: 'Trigger policy must be workflowActivate or manual'
    },
    
    // Google Sheets Node
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'operation',
      expectedType: 'string',
      required: true,
      validator: (value: any) => {
        return ['append', 'appendOrUpdate', 'clear', 'create', 'delete', 'deleteColumns', 'deleteRows', 'read', 'update'].includes(value);
      },
      description: 'Operation is required'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'documentId',
      expectedType: 'object',
      transformer: (value: any) => {
        if (typeof value === 'string') {
          return {
            __rl: true,
            value: value,
            mode: 'id'
          };
        }
        return value;
      },
      required: true,
      description: 'Document ID must be an object with __rl, value, and mode properties'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'sheetId',
      expectedType: 'object',
      transformer: (value: any) => {
        if (typeof value === 'string') {
          return {
            __rl: true,
            value: value,
            mode: 'id'
          };
        }
        return value;
      },
      required: true,
      description: 'Sheet ID must be an object with __rl, value, and mode properties'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'range',
      expectedType: 'string',
      validator: (value: any) => {
        // Validate A1 notation
        if (!value) return true; // Optional parameter
        return typeof value === 'string' && /^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(value);
      },
      description: 'Range must be in A1 notation (e.g., A1:B10)'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'options.valueInputMode',
      expectedType: 'string',
      defaultValue: 'USER_ENTERED',
      validator: (value: any) => {
        return ['RAW', 'USER_ENTERED'].includes(value);
      },
      description: 'Value input mode must be RAW or USER_ENTERED'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'options.valueRenderMode',
      expectedType: 'string',
      defaultValue: 'UNFORMATTED_VALUE',
      validator: (value: any) => {
        return ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'].includes(value);
      },
      description: 'Value render mode for reading data'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'options.dateTimeRenderOption',
      expectedType: 'string',
      defaultValue: 'FORMATTED_STRING',
      validator: (value: any) => {
        return ['SERIAL_NUMBER', 'FORMATTED_STRING'].includes(value);
      },
      description: 'Date time render option'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'mappingMode',
      expectedType: 'string',
      defaultValue: 'defineBelow',
      validator: (value: any) => {
        return ['defineBelow', 'autoMapInputData', 'nothing'].includes(value);
      },
      description: 'Mapping mode for column data'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'values.value',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Values must be an array'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'filters.values',
      expectedType: 'array',
      transformer: (value: any) => {
        return Array.isArray(value) ? value : [];
      },
      defaultValue: [],
      description: 'Filter values must be an array'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'columnToMatchOn',
      expectedType: 'string',
      description: 'Column to match on for update operations'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'headerRow',
      expectedType: 'number',
      transformer: (value: any) => {
        const num = parseInt(value, 10);
        return isNaN(num) ? 1 : num;
      },
      defaultValue: 1,
      description: 'Header row index'
    },
    {
      nodeType: 'n8n-nodes-base.googleSheets',
      parameterPath: 'firstDataRow',
      expectedType: 'number',
      transformer: (value: any) => {
        const num = parseInt(value, 10);
        return isNaN(num) ? 2 : num;
      },
      defaultValue: 2,
      description: 'First data row index'
    }
  ];

  /**
   * Get all rules for a specific node type
   */
  static getRulesForNode(nodeType: string): NodeParameterRule[] {
    return this.rules.filter(rule => rule.nodeType === nodeType);
  }

  /**
   * Validate and fix node parameters
   */
  static validateAndFixNode(node: any): any {
    if (!node || !node.type) return node;

    const rules = this.getRulesForNode(node.type);
    if (rules.length === 0) return node;

    const fixedNode = { ...node };
    if (!fixedNode.parameters) {
      fixedNode.parameters = {};
    }

    rules.forEach(rule => {
      const value = this.getNestedValue(fixedNode.parameters, rule.parameterPath);
      
      // Check if parameter is required and missing
      if (rule.required && (value === undefined || value === null)) {
        if (rule.defaultValue !== undefined) {
          this.setNestedValue(fixedNode.parameters, rule.parameterPath, rule.defaultValue);
        } else {
          console.warn(`Required parameter ${rule.parameterPath} missing in ${node.type}`);
        }
        return;
      }

      // Skip if value is undefined and not required
      if (value === undefined && !rule.required) {
        if (rule.defaultValue !== undefined) {
          this.setNestedValue(fixedNode.parameters, rule.parameterPath, rule.defaultValue);
        }
        return;
      }

      // Validate type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.expectedType) {
        // Try to transform the value
        if (rule.transformer) {
          const transformedValue = rule.transformer(value);
          this.setNestedValue(fixedNode.parameters, rule.parameterPath, transformedValue);
        } else if (rule.defaultValue !== undefined) {
          this.setNestedValue(fixedNode.parameters, rule.parameterPath, rule.defaultValue);
        } else {
          console.warn(`Parameter ${rule.parameterPath} has wrong type in ${node.type}. Expected ${rule.expectedType}, got ${actualType}`);
        }
      }

      // Run validator if exists
      if (rule.validator) {
        const currentValue = this.getNestedValue(fixedNode.parameters, rule.parameterPath);
        if (!rule.validator(currentValue)) {
          console.warn(`Parameter ${rule.parameterPath} failed validation in ${node.type}`);
          if (rule.defaultValue !== undefined) {
            this.setNestedValue(fixedNode.parameters, rule.parameterPath, rule.defaultValue);
          }
        }
      }
    });

    return fixedNode;
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Set nested value in object using dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Add a new rule to the registry
   */
  static addRule(rule: NodeParameterRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all registered node types
   */
  static getRegisteredNodeTypes(): string[] {
    return [...new Set(this.rules.map(rule => rule.nodeType))];
  }
  
  /**
   * Apply all parameter fixes to a workflow
   */
  static fixWorkflowParameters(workflow: any): any {
    if (!workflow || !workflow.nodes || !Array.isArray(workflow.nodes)) {
      return workflow;
    }
    
    const fixedWorkflow = { ...workflow };
    fixedWorkflow.nodes = workflow.nodes.map((node: any) => {
      return this.validateAndFixNode(node);
    });
    
    return fixedWorkflow;
  }
  
  /**
   * Get a summary of all registered node rules for documentation
   */
  static getDocumentationSummary(): Record<string, any[]> {
    const summary: Record<string, any[]> = {};
    
    this.rules.forEach(rule => {
      if (!summary[rule.nodeType]) {
        summary[rule.nodeType] = [];
      }
      summary[rule.nodeType].push({
        parameter: rule.parameterPath,
        type: rule.expectedType,
        required: rule.required || false,
        description: rule.description
      });
    });
    
    return summary;
  }
}