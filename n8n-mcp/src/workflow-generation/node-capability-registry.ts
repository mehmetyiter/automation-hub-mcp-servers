// node-capability-registry.ts
// Registry of node capabilities and requirements

export interface NodeCapability {
  canHandle: string[];
  requiredFor: string[];
  parameters: {
    [key: string]: {
      required: boolean;
      type?: string;
      default?: any;
      pattern?: string;
      options?: string[];
      description?: string;
    };
  };
  alternativeNodes?: string[];
  recommendedConnections?: {
    input?: string[];
    output?: string[];
  };
}

export class NodeCapabilityRegistry {
  private readonly capabilities: Record<string, NodeCapability> = {
    // IoT and Hardware Nodes
    'n8n-nodes-base.mqtt': {
      canHandle: [
        'iot_communication',
        'sensor_data',
        'device_control',
        'telemetry',
        'real_time_data',
        'bidirectional_messaging'
      ],
      requiredFor: [
        'sensor_monitoring',
        'device_management',
        'iot_integration',
        'smart_home',
        'industrial_automation'
      ],
      parameters: {
        broker: {
          required: true,
          type: 'string',
          pattern: '^mqtt://|^ws://',
          description: 'MQTT broker URL - must be configured by user'
        },
        topic: {
          required: true,
          type: 'string',
          pattern: '^[a-zA-Z0-9/+#]+$',
          description: 'MQTT topic to publish/subscribe'
        },
        qos: {
          required: false,
          type: 'number',
          default: 1,
          options: ['0', '1', '2'],
          description: 'Quality of Service level'
        },
        retain: {
          required: false,
          type: 'boolean',
          default: false,
          description: 'Retain message on broker'
        }
      },
      alternativeNodes: ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.webhook'],
      recommendedConnections: {
        input: ['n8n-nodes-base.cron', 'n8n-nodes-base.webhook'],
        output: ['n8n-nodes-base.function', 'n8n-nodes-base.switch']
      }
    },


    // Communication Nodes
    'n8n-nodes-base.twilio': {
      canHandle: [
        'sms_sending',
        'phone_calls',
        'urgent_alerts',
        'mobile_notifications'
      ],
      requiredFor: [
        'critical_alerts',
        'emergency_notifications',
        'otp_verification',
        'mobile_marketing'
      ],
      parameters: {
        fromNumber: {
          required: true,
          type: 'string',
          pattern: '^\\+[1-9]\\d{1,14}$',
          description: 'Twilio phone number'
        },
        toNumber: {
          required: true,
          type: 'string',
          pattern: '^\\+[1-9]\\d{1,14}$',
          description: 'Recipient phone number'
        },
        message: {
          required: true,
          type: 'string',
          description: 'SMS message content'
        },
        accountSid: {
          required: false,
          type: 'string',
          description: 'Twilio Account SID (uses credential if not provided)'
        },
        authToken: {
          required: false,
          type: 'string',
          description: 'Twilio Auth Token (uses credential if not provided)'
        }
      },
      alternativeNodes: ['n8n-nodes-base.emailSend', 'n8n-nodes-base.telegram'],
      recommendedConnections: {
        input: ['n8n-nodes-base.if', 'n8n-nodes-base.errorTrigger'],
        output: ['n8n-nodes-base.function', 'n8n-nodes-base.merge']
      }
    },

    'n8n-nodes-base.whatsappBusiness': {
      canHandle: [
        'instant_messaging',
        'customer_communication',
        'media_sharing',
        'business_messaging'
      ],
      requiredFor: [
        'customer_support',
        'order_notifications',
        'appointment_reminders',
        'marketing_campaigns'
      ],
      parameters: {
        phoneNumberId: {
          required: true,
          type: 'string',
          description: 'WhatsApp Business phone number ID'
        },
        to: {
          required: true,
          type: 'string',
          pattern: '^\\+[1-9]\\d{1,14}$',
          description: 'Recipient WhatsApp number'
        },
        messageType: {
          required: true,
          type: 'string',
          options: ['text', 'image', 'document', 'template'],
          default: 'text',
          description: 'Type of message'
        },
        text: {
          required: false,
          type: 'string',
          description: 'Message text (for text messages)'
        }
      },
      alternativeNodes: ['n8n-nodes-base.telegram', 'n8n-nodes-base.slack'],
      recommendedConnections: {
        input: ['n8n-nodes-base.webhook', 'n8n-nodes-base.switch'],
        output: ['n8n-nodes-base.function', 'n8n-nodes-base.merge']
      }
    },

    // Timing Nodes
    'n8n-nodes-base.cron': {
      canHandle: [
        'scheduled_execution',
        'time_based_triggers',
        'recurring_tasks',
        'periodic_operations'
      ],
      requiredFor: [
        'scheduled_reports',
        'maintenance_tasks',
        'data_collection',
        'cleanup_operations'
      ],
      parameters: {
        triggerTimes: {
          required: true,
          type: 'object',
          description: 'Cron schedule configuration'
        }
      },
      alternativeNodes: ['n8n-nodes-base.interval', 'n8n-nodes-base.webhook'],
      recommendedConnections: {
        output: ['n8n-nodes-base.function', 'n8n-nodes-base.switch', 'n8n-nodes-base.httpRequest']
      }
    }
  };

  // Get capability for a specific node type
  public getNodeCapability(nodeType: string): NodeCapability | undefined {
    return this.capabilities[nodeType];
  }

  // Find nodes that can handle specific capabilities
  public findNodesByCapability(capability: string): string[] {
    const matchingNodes: string[] = [];
    
    for (const [nodeType, nodeCapability] of Object.entries(this.capabilities)) {
      if (nodeCapability.canHandle.includes(capability) || 
          nodeCapability.requiredFor.includes(capability)) {
        matchingNodes.push(nodeType);
      }
    }
    
    return matchingNodes;
  }

  // Get required parameters for a node
  public getRequiredParameters(nodeType: string): Record<string, any> {
    const capability = this.capabilities[nodeType];
    if (!capability) return {};
    
    const requiredParams: Record<string, any> = {};
    
    for (const [paramName, paramConfig] of Object.entries(capability.parameters)) {
      if (paramConfig.required) {
        requiredParams[paramName] = paramConfig.default || null;
      }
    }
    
    return requiredParams;
  }

  // Get parameter defaults for a node
  public getParameterDefaults(nodeType: string): Record<string, any> {
    const capability = this.capabilities[nodeType];
    if (!capability) return {};
    
    const defaults: Record<string, any> = {};
    
    for (const [paramName, paramConfig] of Object.entries(capability.parameters)) {
      if (paramConfig.default !== undefined) {
        defaults[paramName] = paramConfig.default;
      }
    }
    
    return defaults;
  }

  // Validate parameters for a node
  public validateParameters(nodeType: string, parameters: Record<string, any>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const capability = this.capabilities[nodeType];
    if (!capability) {
      return {
        valid: false,
        errors: [`Unknown node type: ${nodeType}`],
        warnings: []
      };
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required parameters
    for (const [paramName, paramConfig] of Object.entries(capability.parameters)) {
      const value = parameters[paramName];
      
      if (paramConfig.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${paramName}`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        if (paramConfig.type && typeof value !== paramConfig.type) {
          errors.push(`Parameter ${paramName} should be of type ${paramConfig.type}`);
        }
        
        // Pattern validation
        if (paramConfig.pattern && typeof value === 'string') {
          const regex = new RegExp(paramConfig.pattern);
          if (!regex.test(value)) {
            errors.push(`Parameter ${paramName} does not match required pattern: ${paramConfig.pattern}`);
          }
        }
        
        // Options validation
        if (paramConfig.options && !paramConfig.options.includes(String(value))) {
          warnings.push(`Parameter ${paramName} should be one of: ${paramConfig.options.join(', ')}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get alternative nodes for a given node type
  public getAlternativeNodes(nodeType: string): string[] {
    const capability = this.capabilities[nodeType];
    return capability?.alternativeNodes || [];
  }

  // Get recommended connections for a node
  public getRecommendedConnections(nodeType: string): {
    input: string[];
    output: string[];
  } {
    const capability = this.capabilities[nodeType];
    if (capability?.recommendedConnections) {
      return {
        input: capability.recommendedConnections.input || [],
        output: capability.recommendedConnections.output || []
      };
    }
    return { input: [], output: [] };
  }

  // Check if a node can handle a specific use case
  public canHandle(nodeType: string, useCase: string): boolean {
    const capability = this.capabilities[nodeType];
    if (!capability) return false;
    
    return capability.canHandle.includes(useCase) || 
           capability.requiredFor.includes(useCase);
  }
}