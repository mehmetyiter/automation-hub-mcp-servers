// node-templates/error-trigger-template.ts

import { BaseNodeTemplate } from './base-template.js';
import { NodeCreationConfig, n8nNode } from '../workflow-builder.types.js';

export class ErrorTriggerNodeTemplate extends BaseNodeTemplate {
  type = 'n8n-nodes-base.errorTrigger';
  typeVersion = 1;
  
  createNode(config: NodeCreationConfig): n8nNode {
    return {
      id: config.id,
      name: config.name,
      type: this.type,
      typeVersion: this.typeVersion,
      position: config.position,
      parameters: {}
    };
  }
}