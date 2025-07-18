// workflow-generation/direct-workflow-builder.ts

import { NodeParameterHandler } from './node-parameter-handler.js';
import { WorkflowPlan } from './workflow-analyzer.js';
import { AIProviderInterface } from '../types/ai-provider.js';

export class DirectWorkflowBuilder {
  private parameterHandler: NodeParameterHandler;
  private provider: AIProviderInterface | null = null;
  
  constructor() {
    this.parameterHandler = new NodeParameterHandler();
  }
  
  setProvider(provider: AIProviderInterface): void {
    this.provider = provider;
  }
  
  build(aiWorkflow: any, workflowPlan?: WorkflowPlan): any {
    console.log('DirectWorkflowBuilder: Preserving AI response exactly...');
    
    if (!aiWorkflow || !aiWorkflow.nodes || !aiWorkflow.connections) {
      throw new Error('Invalid AI workflow structure');
    }
    
    console.log(`AI provided ${aiWorkflow.nodes.length} nodes with full parameters`);
    
    // Create a clean copy preserving all AI details
    let workflow = {
      name: aiWorkflow.name,
      nodes: this.preserveNodes(aiWorkflow.nodes),
      connections: this.preserveConnections(aiWorkflow.connections),
      active: false,
      settings: {},
      versionId: this.generateVersionId(),
      meta: {
        instanceId: this.generateInstanceId()
      },
      id: this.generateWorkflowId(),
      tags: [],
      pinData: {}
    };
    
    // Post-processing: Add missing features based on workflow plan
    if (workflowPlan) {
      workflow = this.applyPostProcessing(workflow, workflowPlan);
    }
    
    // Apply provider's post-processing if available
    console.log('Checking for post-processing capability...');
    console.log('Provider exists:', !!this.provider);
    if (this.provider) {
      console.log('Provider type:', this.provider.constructor.name);
      console.log('Has applyPostProcessing:', 'applyPostProcessing' in this.provider);
      console.log('Method type:', typeof (this.provider as any).applyPostProcessing);
    }
    
    if (this.provider && 'applyPostProcessing' in this.provider) {
      console.log('Calling provider post-processing...');
      workflow = (this.provider as any).applyPostProcessing(workflow);
    } else {
      console.log('Post-processing not available');
    }
    
    console.log('DirectWorkflowBuilder: All AI details preserved');
    return workflow;
  }
  
  private preserveNodes(aiNodes: any[]): any[] {
    return aiNodes.map((node, index) => {
      // Extract AI parameters first
      const aiParameters = this.parameterHandler.extractAIParameters(node);
      
      // Merge with node type defaults, preserving AI values
      const mergedParameters = this.parameterHandler.mergeParameters(node.type, aiParameters);
      
      // Preserve all AI parameters exactly
      const preservedNode: any = {
        id: node.id || (index + 1).toString(),
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion || 1,
        position: Array.isArray(node.position) ? node.position : [256 + (index * 200), 304],
        parameters: mergedParameters
      };
      
      // Add webhook ID if it's a webhook node
      if (node.type === 'n8n-nodes-base.webhook') {
        preservedNode.webhookId = node.webhookId || this.generateWebhookId();
      }
      
      // Ensure all required parameters are present
      const fixedNode = this.parameterHandler.ensureNodeParameters(preservedNode);
      
      // Fix common parameter issues
      const finalNode = this.parameterHandler.fixCommonParameterIssues(fixedNode);
      
      // Validate parameters
      const errors = this.parameterHandler.validateNodeParameters(finalNode);
      if (errors.length > 0) {
        console.log(`  Parameter validation warnings for ${node.name}:`, errors);
      }
      
      return finalNode;
    });
  }
  
  private preserveConnections(aiConnections: any): any {
    // AI connections are already in perfect format, just return them
    console.log('Preserving AI connections exactly:', Object.keys(aiConnections).length, 'connections');
    return aiConnections;
  }
  
  private generateVersionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  private generateInstanceId(): string {
    return '7221b4279d96e7954ef75d7c02b5031844eee3ca1705c75c15ad040f91c7b140';
  }
  
  private generateWorkflowId(): string {
    return Math.random().toString(36).substr(2, 16);
  }
  
  private generateWebhookId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  private applyPostProcessing(workflow: any, workflowPlan: WorkflowPlan): any {
    console.log('Applying post-processing based on workflow plan...');
    
    // Check if error handling is needed but missing
    if (workflowPlan.errorHandling.globalErrorNode) {
      const hasErrorTrigger = workflow.nodes.some((node: any) => 
        node.type === 'n8n-nodes-base.errorTrigger'
      );
      
      if (!hasErrorTrigger) {
        console.log('Adding missing error handling nodes...');
        workflow = this.addErrorHandling(workflow, workflowPlan);
      }
    }
    
    // Fix code node formatting issues
    workflow.nodes = workflow.nodes.map((node: any) => {
      if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
        node.parameters.jsCode = this.fixCodeFormatting(node.parameters.jsCode);
      }
      return node;
    });
    
    return workflow;
  }
  
  private addErrorHandling(workflow: any, workflowPlan: WorkflowPlan): any {
    const errorTriggerId = (workflow.nodes.length + 1).toString();
    const errorNotificationId = (workflow.nodes.length + 2).toString();
    
    // Add error trigger node
    const errorTriggerNode = {
      id: errorTriggerId,
      name: 'Error Handler',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [250, 600],
      parameters: {}
    };
    
    // Add error notification node
    const errorNotificationNode = {
      id: errorNotificationId,
      name: 'Error Notification',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 1,
      position: [450, 600],
      parameters: {
        toRecipients: 'admin@company.com',
        subject: 'Workflow Error: {{$node["Error Handler"].json["error"]["message"]}}',
        text: 'An error occurred in the workflow:\\n\\nError: {{$node["Error Handler"].json["error"]["message"]}}\\nNode: {{$node["Error Handler"].json["error"]["node"]["name"]}}\\nTime: {{$now}}',
        options: {}
      }
    };
    
    // Add nodes to workflow
    workflow.nodes.push(errorTriggerNode);
    workflow.nodes.push(errorNotificationNode);
    
    // Add connection from error trigger to notification
    if (!workflow.connections['Error Handler']) {
      workflow.connections['Error Handler'] = {
        main: [[{
          node: 'Error Notification',
          type: 'main',
          index: 0
        }]]
      };
    }
    
    console.log('Error handling nodes added successfully');
    return workflow;
  }
  
  private fixCodeFormatting(jsCode: string): string {
    // Fix common formatting issues in code nodes
    return jsCode
      .replace(/,\s*/g, ',\\n  ') // Add newlines after commas
      .replace(/return\s*{/g, 'return {\\n  ') // Format return statements
      .replace(/}\s*;/g, '\\n};') // Format closing braces
      .replace(/\\n\\n+/g, '\\n\\n') // Remove extra blank lines
      .trim();
  }
}