// node-templates/merge-template.ts

import { BaseNodeTemplate } from './base-template.js';
import { NodeCreationConfig, n8nNode } from '../workflow-builder.types.js';

export class MergeNodeTemplate extends BaseNodeTemplate {
  type = 'n8n-nodes-base.merge';
  typeVersion = 2;
  
  createNode(config: NodeCreationConfig): n8nNode {
    const mode = config.configuration.mode || 'append';
    const inputCount = config.configuration.inputCount || 2;
    
    return {
      id: config.id,
      name: config.name,
      type: this.type,
      typeVersion: this.typeVersion,
      position: config.position,
      parameters: {
        mode,
        options: {}
      }
    };
  }
}