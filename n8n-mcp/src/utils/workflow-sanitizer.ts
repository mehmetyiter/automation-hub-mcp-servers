/**
 * Sanitize workflow to ensure all node parameters are properly structured
 * This helps prevent "propertyValues[itemName] is not iterable" errors in n8n
 */

export function sanitizeWorkflow(workflow: any): any {
  if (!workflow || !workflow.nodes) {
    return workflow;
  }

  // Create a deep copy to avoid mutating the original
  const sanitized = JSON.parse(JSON.stringify(workflow));

  // Sanitize each node
  sanitized.nodes = sanitized.nodes.map((node: any) => {
    // Ensure node has required fields
    if (!node.id) {
      console.warn(`Node ${node.name} missing id`);
    }
    if (!node.type) {
      console.warn(`Node ${node.name} missing type`);
    }
    if (!node.position) {
      node.position = [100, 100];
    }

    // Handle duplicate properties that should only exist in parameters
    // This is a common issue with AI-generated workflows, especially from OpenAI
    const propertiesToMove = ['functionCode', 'jsCode', 'pythonCode', 'expression'];
    propertiesToMove.forEach(prop => {
      if (node[prop] !== undefined && node.type.includes('function')) {
        // If the property exists at root level, move it to parameters
        if (!node.parameters) {
          node.parameters = {};
        }
        // Only move if not already in parameters or if root level has more content
        if (!node.parameters[prop] || 
            (typeof node[prop] === 'string' && node[prop].length > (node.parameters[prop] || '').length)) {
          console.log(`Moving ${prop} from root to parameters for node ${node.name}`);
          node.parameters[prop] = node[prop];
        }
        // Always remove from root level
        delete node[prop];
      }
    });

    // Remove any other properties that shouldn't exist at root level
    const allowedRootProperties = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 
                                  'credentials', 'disabled', 'continueOnFail', 'retryOnFail', 
                                  'maxTries', 'waitBetweenTries', 'alwaysOutputData', 'executeOnce'];
    Object.keys(node).forEach(key => {
      if (!allowedRootProperties.includes(key)) {
        console.warn(`Removing unexpected root property '${key}' from node ${node.name}`);
        delete node[key];
      }
    });

    // Sanitize parameters based on node type
    if (node.parameters) {
      node.parameters = sanitizeNodeParameters(node.type, node.parameters);
    }

    return node;
  });

  return sanitized;
}

function sanitizeNodeParameters(nodeType: string, parameters: any): any {
  const sanitized = { ...parameters };

  // Handle common parameter issues
  switch (nodeType) {
    case 'n8n-nodes-base.httpRequest':
    case 'n8n-nodes-base.webhook':
      // Ensure headers is an object or undefined, not an array
      if (Array.isArray(sanitized.headers)) {
        sanitized.headers = undefined;
      }
      // Ensure queryParameters is an object or undefined
      if (Array.isArray(sanitized.queryParameters)) {
        sanitized.queryParameters = undefined;
      }
      break;

    case 'n8n-nodes-base.function':
    case 'n8n-nodes-base.functionItem':
      // Ensure functionCode is a string
      if (typeof sanitized.functionCode !== 'string') {
        sanitized.functionCode = 'return items;';
      }
      break;

    case 'n8n-nodes-base.set':
      // Ensure values is properly structured
      if (sanitized.values && !sanitized.values.values) {
        sanitized.values = {
          values: Array.isArray(sanitized.values) ? sanitized.values : []
        };
      }
      break;

    case 'n8n-nodes-base.if':
      // Ensure conditions are properly structured
      if (sanitized.conditions && !sanitized.conditions.conditions) {
        sanitized.conditions = {
          conditions: Array.isArray(sanitized.conditions) ? sanitized.conditions : []
        };
      }
      break;

    case 'n8n-nodes-base.switch':
      // Ensure rules are properly structured
      if (sanitized.rules && !sanitized.rules.rules) {
        sanitized.rules = {
          rules: Array.isArray(sanitized.rules) ? sanitized.rules : []
        };
      }
      break;

    case 'n8n-nodes-base.scheduleTrigger':
      // Schedule trigger parameters should follow n8n format
      if (sanitized.rule && sanitized.rule.interval && Array.isArray(sanitized.rule.interval)) {
        sanitized.rule.interval = sanitized.rule.interval.map((interval: any) => {
          const fixed = { ...interval };
          // Parameter names should match n8n documentation
          if (fixed.minutesInterval !== undefined) {
            // This is already correct
          } else if (fixed.hoursInterval !== undefined) {
            // This is already correct
          } else if (fixed.daysInterval !== undefined) {
            // This is already correct
          }
          return fixed;
        });
      }
      break;

    case 'n8n-nodes-base.emailSend':
      // Fix email parameter names and ensure they are strings
      if (sanitized.to) {
        sanitized.toEmail = Array.isArray(sanitized.to) ? sanitized.to.join(',') : sanitized.to;
        delete sanitized.to;
      }
      if (sanitized.from) {
        sanitized.fromEmail = sanitized.from;
        delete sanitized.from;
      }
      if (sanitized.cc) {
        sanitized.ccEmail = Array.isArray(sanitized.cc) ? sanitized.cc.join(',') : sanitized.cc;
        delete sanitized.cc;
      }
      if (sanitized.bcc) {
        sanitized.bccEmail = Array.isArray(sanitized.bcc) ? sanitized.bcc.join(',') : sanitized.bcc;
        delete sanitized.bcc;
      }
      // Fix email format parameter
      if (sanitized.emailType) {
        sanitized.emailFormat = sanitized.emailType;
        delete sanitized.emailType;
      }
      // Fix message/text/html parameters
      if (sanitized.message && !sanitized.text && !sanitized.html) {
        if (sanitized.emailFormat === 'html' || sanitized.emailType === 'html') {
          sanitized.html = sanitized.message;
        } else {
          sanitized.text = sanitized.message;
        }
        delete sanitized.message;
      }
      if (sanitized.htmlBody) {
        sanitized.html = sanitized.htmlBody;
        delete sanitized.htmlBody;
      }
      break;
  }

  // Remove any parameters that are empty arrays or objects
  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];
    if (Array.isArray(value) && value.length === 0) {
      delete sanitized[key];
    } else if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
      delete sanitized[key];
    }
  });

  return sanitized;
}

export function validateWorkflowParameters(workflow: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push('Workflow must have a nodes array');
    return { valid: false, errors };
  }

  workflow.nodes.forEach((node: any, index: number) => {
    if (!node.type) {
      errors.push(`Node at index ${index} missing type`);
    }
    if (!node.name) {
      errors.push(`Node at index ${index} missing name`);
    }
    if (!node.id) {
      errors.push(`Node at index ${index} missing id`);
    }

    // Check for common parameter issues
    if (node.parameters) {
      const params = node.parameters;
      
      // Check for improperly structured arrays
      Object.entries(params).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Check if it looks like it should be an array
          if (value.hasOwnProperty('0') && !value.hasOwnProperty('length')) {
            errors.push(`Node ${node.name}: Parameter ${key} appears to be a malformed array`);
          }
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}