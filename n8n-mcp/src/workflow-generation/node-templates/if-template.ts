// node-templates/if-template.ts

import { BaseNodeTemplate } from './base-template.js';
import { NodeCreationConfig, n8nNode } from '../workflow-builder.types.js';

export class IfNodeTemplate extends BaseNodeTemplate {
  type = 'n8n-nodes-base.if';
  typeVersion = 1;
  
  createNode(config: NodeCreationConfig): n8nNode {
    const conditions = config.configuration.conditions || {
      boolean: [
        {
          value1: '={{$json.riskScore}}',
          operation: 'smallerEqual',
          value2: 50
        }
      ]
    };
    
    return {
      id: config.id,
      name: config.name,
      type: this.type,
      typeVersion: this.typeVersion,
      position: config.position,
      parameters: {
        conditions
      }
    };
  }
}