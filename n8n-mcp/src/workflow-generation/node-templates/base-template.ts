// node-templates/base-template.ts

import { NodeCreationConfig, n8nNode } from '../workflow-builder.types.js';

export interface NodeTemplate {
  type: string;
  typeVersion: number;
  defaultPosition: [number, number];
  
  createNode(config: NodeCreationConfig): n8nNode;
  validateConfig(config: any): boolean;
}

export abstract class BaseNodeTemplate implements NodeTemplate {
  abstract type: string;
  abstract typeVersion: number;
  defaultPosition: [number, number] = [250, 300];
  
  abstract createNode(config: NodeCreationConfig): n8nNode;
  
  validateConfig(config: any): boolean {
    return true; // Override in specific templates
  }
  
  protected generateWebhookId(): string {
    // Generate UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}