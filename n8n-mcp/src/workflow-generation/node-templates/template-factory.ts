// node-templates/template-factory.ts

import { NodeTemplate } from './base-template.js';
import { SwitchNodeTemplate } from './switch-template.js';
import { MergeNodeTemplate } from './merge-template.js';
import { IfNodeTemplate } from './if-template.js';
import { ErrorTriggerNodeTemplate } from './error-trigger-template.js';
// Import from quick-builder for reuse
import { QuickWorkflowBuilder } from '../quick-builder.js';

export class NodeTemplateFactory {
  private templates: Map<string, NodeTemplate> = new Map();
  private quickBuilder: QuickWorkflowBuilder;
  
  constructor() {
    this.registerTemplates();
    this.quickBuilder = new QuickWorkflowBuilder();
  }
  
  private registerTemplates(): void {
    // Register new templates
    this.templates.set('n8n-nodes-base.switch', new SwitchNodeTemplate());
    this.templates.set('n8n-nodes-base.merge', new MergeNodeTemplate());
    this.templates.set('n8n-nodes-base.if', new IfNodeTemplate());
    this.templates.set('n8n-nodes-base.errorTrigger', new ErrorTriggerNodeTemplate());
  }
  
  getTemplate(nodeType: string): NodeTemplate | undefined {
    return this.templates.get(nodeType);
  }
  
  createNode(nodeType: string, config: any): any {
    // First check if we have a template
    const template = this.templates.get(nodeType);
    if (template) {
      return template.createNode(config);
    }
    
    // Otherwise, use quick builder's default node creation
    const quickNode: any = {
      id: config.id,
      name: config.name,
      type: nodeType,
      typeVersion: 1,
      position: config.position,
      parameters: this.quickBuilder.getDefaultParameters(nodeType, config)
    };
    
    // Add webhook ID if needed
    if (nodeType === 'n8n-nodes-base.webhook') {
      quickNode.webhookId = this.quickBuilder.generateWebhookId();
    }
    
    return quickNode;
  }
}