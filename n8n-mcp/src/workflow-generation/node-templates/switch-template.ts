// node-templates/switch-template.ts

import { BaseNodeTemplate } from './base-template.js';
import { NodeCreationConfig, n8nNode } from '../workflow-builder.types.js';

export class SwitchNodeTemplate extends BaseNodeTemplate {
  type = 'n8n-nodes-base.switch';
  typeVersion = 1;
  
  createNode(config: NodeCreationConfig): n8nNode {
    // Extract conditions from config
    const conditions = config.configuration.conditions || ['Option 1', 'Option 2', 'Option 3'];
    
    // Build rules for switch node
    const rules: any[] = conditions.map((condition: string, index: number) => ({
      dataType: 'string',
      operation: 'equals',
      value1: '={{$json.paymentMethod}}', // Default field, can be customized
      value2: condition,
      output: index
    }));
    
    return {
      id: config.id,
      name: config.name,
      type: this.type,
      typeVersion: this.typeVersion,
      position: config.position,
      parameters: {
        dataType: 'string',
        value1: config.configuration.field || '={{$json.paymentMethod}}',
        rules,
        fallbackOutput: conditions.length // Last output is fallback
      }
    };
  }
}