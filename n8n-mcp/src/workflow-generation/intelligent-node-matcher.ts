/**
 * Intelligent Node Matcher
 * Analyzes node purpose and parameters to find the best n8n equivalent
 */

interface NodeIntent {
  purpose: string;
  action?: string;
  inputType?: string;
  outputType?: string;
  parameters?: any;
}

export class IntelligentNodeMatcher {
  
  /**
   * Analyze node name and parameters to determine its intent
   */
  private static analyzeNodeIntent(nodeName: string, nodeType: string, parameters: any): NodeIntent {
    const lowerName = nodeName.toLowerCase();
    const lowerType = nodeType.toLowerCase();
    
    // Hardware/IoT Control Detection
    if (lowerName.includes('valve') || lowerName.includes('pump') || 
        lowerName.includes('gpio') || lowerName.includes('pin') ||
        lowerName.includes('relay') || lowerName.includes('actuator') ||
        lowerType.includes('raspberry') || lowerType.includes('arduino')) {
      return {
        purpose: 'hardware_control',
        action: 'control_device',
        inputType: 'control_signal',
        outputType: 'device_state',
        parameters
      };
    }
    
    // Notification Detection
    if (lowerName.includes('sms') || lowerName.includes('text message')) {
      return {
        purpose: 'notification',
        action: 'send_sms',
        inputType: 'message',
        outputType: 'notification_status'
      };
    }
    
    if (lowerName.includes('whatsapp') || lowerName.includes('wa message')) {
      return {
        purpose: 'notification', 
        action: 'send_whatsapp',
        inputType: 'message',
        outputType: 'notification_status'
      };
    }
    
    if (lowerName.includes('email') || lowerName.includes('mail')) {
      return {
        purpose: 'notification',
        action: 'send_email',
        inputType: 'message',
        outputType: 'notification_status'
      };
    }
    
    // Data Processing Detection
    if (lowerName.includes('process') || lowerName.includes('transform') ||
        lowerName.includes('analyze') || lowerName.includes('calculate')) {
      return {
        purpose: 'data_processing',
        action: 'transform_data',
        inputType: 'data',
        outputType: 'processed_data'
      };
    }
    
    // Conditional Logic Detection
    if (lowerName.includes('check') || lowerName.includes('if') ||
        lowerName.includes('condition') || lowerName.includes('route')) {
      return {
        purpose: 'conditional',
        action: 'evaluate_condition',
        inputType: 'data',
        outputType: 'boolean'
      };
    }
    
    // HTTP/API Detection
    if (lowerName.includes('api') || lowerName.includes('http') ||
        lowerName.includes('webhook') || lowerName.includes('request')) {
      return {
        purpose: 'api_call',
        action: 'http_request',
        inputType: 'request_data',
        outputType: 'response_data'
      };
    }
    
    // Database Detection
    if (lowerName.includes('database') || lowerName.includes('db') ||
        lowerName.includes('query') || lowerName.includes('insert')) {
      return {
        purpose: 'database',
        action: 'database_operation',
        inputType: 'query',
        outputType: 'result_set'
      };
    }
    
    // File Storage Detection
    if (lowerName.includes('upload') || lowerName.includes('download') ||
        lowerName.includes('file') || lowerName.includes('document')) {
      return {
        purpose: 'file_storage',
        action: 'file_operation',
        inputType: 'file_data',
        outputType: 'file_reference'
      };
    }
    
    // Merge/Combine Detection
    if (lowerName.includes('merge') || lowerName.includes('combine') ||
        lowerName.includes('join') || lowerName.includes('aggregate')) {
      return {
        purpose: 'data_merge',
        action: 'combine_data',
        inputType: 'multiple_data',
        outputType: 'merged_data'
      };
    }
    
    return {
      purpose: 'unknown',
      action: 'unknown',
      parameters
    };
  }
  
  /**
   * Find the best matching n8n node based on intent
   */
  public static findBestMatch(nodeName: string, nodeType: string, parameters: any): {
    nodeType: string;
    reasoning: string;
    parameterTransform?: (params: any) => any;
  } {
    const intent = this.analyzeNodeIntent(nodeName, nodeType, parameters);
    
    switch (intent.purpose) {
      case 'hardware_control':
        // For hardware control, we have multiple options
        if (parameters.url || parameters.endpoint) {
          return {
            nodeType: 'n8n-nodes-base.httpRequest',
            reasoning: 'Hardware control via HTTP API (URL parameter detected)'
          };
        } else if (parameters.topic || nodeType.includes('mqtt')) {
          return {
            nodeType: 'n8n-nodes-base.mqtt',
            reasoning: 'Hardware control via MQTT (topic parameter detected)',
            parameterTransform: (params) => ({
              operation: 'publish',
              topic: params.topic || 'device/control',
              message: JSON.stringify({
                device: params.gpio || params.pin || 'device',
                action: params.state || params.action || 'toggle'
              })
            })
          };
        } else {
          return {
            nodeType: 'n8n-nodes-base.httpRequest',
            reasoning: 'Hardware control via HTTP API (default for IoT)',
            parameterTransform: (params) => ({
              method: 'POST',
              url: '={{ $env.IOT_CONTROL_API }}/control',
              authentication: 'genericCredentialType',
              genericAuthType: 'httpHeaderAuth',
              sendBody: true,
              bodyParameters: {
                parameters: [
                  { name: 'device', value: params.gpio || params.pin || 'device' },
                  { name: 'action', value: params.state || params.action || 'toggle' }
                ]
              }
            })
          };
        }
        
      case 'notification':
        if (intent.action === 'send_sms') {
          return {
            nodeType: 'n8n-nodes-base.twilio',
            reasoning: 'SMS notification detected'
          };
        } else if (intent.action === 'send_whatsapp') {
          return {
            nodeType: 'n8n-nodes-base.whatsappBusiness',
            reasoning: 'WhatsApp notification detected'
          };
        } else if (intent.action === 'send_email') {
          return {
            nodeType: 'n8n-nodes-base.emailSendSmtp',
            reasoning: 'Email notification detected'
          };
        }
        break;
        
      case 'data_processing':
        return {
          nodeType: 'n8n-nodes-base.function',
          reasoning: 'Data processing/transformation detected'
        };
        
      case 'conditional':
        return {
          nodeType: 'n8n-nodes-base.if',
          reasoning: 'Conditional logic detected'
        };
        
      case 'api_call':
        return {
          nodeType: 'n8n-nodes-base.httpRequest',
          reasoning: 'API call detected'
        };
        
      case 'database':
        // Could be PostgreSQL, MySQL, MongoDB etc based on parameters
        return {
          nodeType: 'n8n-nodes-base.postgres',
          reasoning: 'Database operation detected (defaulting to PostgreSQL)'
        };
        
      case 'file_storage':
        // Could be Google Drive, Dropbox, S3 etc
        if (nodeName.includes('google') || nodeName.includes('drive')) {
          return {
            nodeType: 'n8n-nodes-base.googleDrive',
            reasoning: 'Google Drive file operation detected'
          };
        }
        return {
          nodeType: 'n8n-nodes-base.httpRequest',
          reasoning: 'File operation via API'
        };
        
      case 'data_merge':
        return {
          nodeType: 'n8n-nodes-base.merge',
          reasoning: 'Data merging/combining detected'
        };
    }
    
    // Fallback to simple mapping
    return {
      nodeType: nodeType,
      reasoning: 'No specific intent detected, using original type'
    };
  }
}