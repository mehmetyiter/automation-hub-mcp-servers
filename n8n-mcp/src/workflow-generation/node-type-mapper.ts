/**
 * Node Type Mapper
 * Maps incorrect or non-existent node types to valid n8n node types
 */

export class NodeTypeMapper {
  private static mappings: Record<string, string> = {
    // Code execution
    'n8n-nodes-base.code': 'n8n-nodes-base.function',
    'n8n-nodes-base.functionItem': 'n8n-nodes-base.function',
    
    // Conditional routing
    'n8n-nodes-base.switch': 'n8n-nodes-base.if',
    'n8n-nodes-base.router': 'n8n-nodes-base.if',
    
    // Email - CORRECTED MAPPINGS (n8n actually uses emailSend, not sendEmail)
    'n8n-nodes-base.sendEmail': 'n8n-nodes-base.emailSend',
    'n8n-nodes-base.emailSendSmtp': 'n8n-nodes-base.emailSend',
    'n8n-nodes-base.email': 'n8n-nodes-base.emailSend',
    'sendEmail': 'n8n-nodes-base.emailSend',
    'emailSendSmtp': 'n8n-nodes-base.emailSend',
    
    // Error handling - CORRECTED MAPPINGS
    'n8n-nodes-base.errorWorkflow': 'n8n-nodes-base.errorTrigger',
    'n8n-nodes-base.error': 'n8n-nodes-base.errorTrigger',
    'errorWorkflow': 'n8n-nodes-base.errorTrigger',
    'errorTrigger': 'n8n-nodes-base.errorTrigger',
    
    // IoT/Hardware control - Map to HTTP Request for API calls
    'n8n-nodes-base.raspberryPi': 'n8n-nodes-base.httpRequest',
    'n8n-nodes-raspberry.raspberryPi': 'n8n-nodes-base.httpRequest',
    'n8n-nodes-base.gpio': 'n8n-nodes-base.httpRequest',
    'n8n-nodes-base.iot': 'n8n-nodes-base.httpRequest',
    
    // Execute command
    'n8n-nodes-base.executeCommand': 'n8n-nodes-base.executeCommand',
    'n8n-nodes-base.exec': 'n8n-nodes-base.executeCommand',
    
    // Merge
    'n8n-nodes-base.merge': 'n8n-nodes-base.merge',
    'n8n-nodes-base.join': 'n8n-nodes-base.merge',
    
    // HTTP
    'n8n-nodes-base.httpRequest': 'n8n-nodes-base.httpRequest',
    'n8n-nodes-base.webhook': 'n8n-nodes-base.webhook',
    
    // Google Drive
    'n8n-nodes-base.googleDrive': 'n8n-nodes-base.googleDrive',
    
    // Sticky Note
    'n8n-nodes-base.stickyNote': 'n8n-nodes-base.stickyNote',
    
    // HTML
    'n8n-nodes-base.html': 'n8n-nodes-base.html',
    
    // Discord - Discord doesn't have a native trigger, use webhook
    'n8n-nodes-base.discordTrigger': 'n8n-nodes-base.webhook',
    'n8n-nodes-base.discordWebhook': 'n8n-nodes-base.webhook',
    
    // Slack
    'n8n-nodes-base.slackTrigger': 'n8n-nodes-base.webhook',
  };

  /**
   * Map a node type to its correct n8n equivalent
   */
  public static mapNodeType(nodeType: string): string {
    return this.mappings[nodeType] || nodeType;
  }

  /**
   * Check if a node type needs mapping
   */
  public static needsMapping(nodeType: string): boolean {
    return nodeType in this.mappings && this.mappings[nodeType] !== nodeType;
  }

  /**
   * Transform node parameters when changing node type
   */
  public static transformParameters(oldType: string, newType: string, parameters: any): any {
    // Special handling for Raspberry Pi -> HTTP Request transformation
    if (oldType.includes('raspberryPi') && newType === 'n8n-nodes-base.httpRequest') {
      const { board, gpio, state, ...rest } = parameters;
      
      return {
        method: 'POST',
        url: '={{ $env.IOT_API_URL }}/gpio/control',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: 'board',
              value: board || 'default'
            },
            {
              name: 'gpio',
              value: gpio || ''
            },
            {
              name: 'state',
              value: state || 'off'
            }
          ]
        },
        options: {
          timeout: 5000
        },
        ...rest
      };
    }

    // Special handling for code -> function transformation
    if (oldType === 'n8n-nodes-base.code' && newType === 'n8n-nodes-base.function') {
      const { jsCode, functionCode, ...rest } = parameters;
      return {
        functionCode: jsCode || functionCode || 'return items;',
        ...rest
      };
    }

    // Special handling for switch -> if transformation
    if (oldType === 'n8n-nodes-base.switch' && newType === 'n8n-nodes-base.if') {
      const { dataType, value1, rules, ...rest } = parameters;
      
      // Convert switch rules to if conditions
      if (rules?.rules?.length > 0) {
        const firstRule = rules.rules[0];
        return {
          conditions: {
            boolean: [],
            string: [{
              value1: value1 || '={{ $json.value }}',
              operation: 'equals',
              value2: firstRule.value2 || ''
            }],
            number: []
          },
          ...rest
        };
      }
      
      return parameters;
    }

    // Special handling for email nodes -> emailSend
    if ((oldType.includes('sendEmail') || oldType.includes('email')) && newType === 'n8n-nodes-base.emailSend') {
      const { fromEmail, toEmail, toRecipients, ccEmail, subject, text, html, attachments, ...rest } = parameters;
      
      // n8n emailSend uses different parameter structure
      return {
        fromEmail: fromEmail || '{{ $credentials.smtp.user }}',
        toRecipients: toRecipients || toEmail || '',
        ccRecipients: ccEmail || '',
        subject: subject || '',
        text: text || '',
        html: html || '',
        attachments: attachments || '',
        options: {},
        ...rest
      };
    }

    // Special handling for Discord/Slack triggers -> webhook
    if ((oldType.includes('discordTrigger') || oldType.includes('slackTrigger')) && newType === 'n8n-nodes-base.webhook') {
      return {
        httpMethod: 'POST',
        path: oldType.includes('discord') ? 'discord-webhook' : 'slack-webhook',
        options: {
          responseMode: 'responseNode',
          rawBody: true
        }
      };
    }

    return parameters;
  }

  /**
   * Get a description of what the mapping does
   */
  public static getMappingDescription(oldType: string, newType: string): string {
    if (oldType.includes('raspberryPi')) {
      return 'Raspberry Pi GPIO control mapped to HTTP Request. Configure IOT_API_URL environment variable.';
    }
    
    if (oldType === 'n8n-nodes-base.code') {
      return 'Code node mapped to Function node.';
    }
    
    if (oldType === 'n8n-nodes-base.switch') {
      return 'Switch node mapped to IF node. Only first condition preserved.';
    }
    
    if (oldType.includes('email')) {
      return 'Email node mapped to Send Email node.';
    }
    
    return `Node type ${oldType} mapped to ${newType}`;
  }
}