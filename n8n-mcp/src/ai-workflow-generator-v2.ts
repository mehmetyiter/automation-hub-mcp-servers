import { AIProvider, AIProviderConfig } from './types/ai-provider.js';
import { ProviderFactory } from './providers/provider-factory.js';

export interface WorkflowGenerationOptions {
  apiKey?: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIWorkflowGeneratorV2 {
  private providerConfig: AIProviderConfig;

  constructor(options: WorkflowGenerationOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required');
    }

    this.providerConfig = {
      provider: options.provider || 'openai',
      apiKey: options.apiKey,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    console.log('=== AI Workflow Generation V2 Started ===');
    console.log('Prompt:', prompt);
    console.log('Name:', name);
    console.log('Provider:', this.providerConfig.provider);
    console.log('Model:', this.providerConfig.model || 'default');
    
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      const result = await provider.generateWorkflow(prompt, name);
      
      if (result.success && result.workflow) {
        // Apply additional validation and fixes
        result.workflow = this.validateAndFixConnections(result.workflow);
      }
      
      return result;
    } catch (error: any) {
      console.error('Workflow generation failed:', error);
      return {
        success: false,
        error: error.message,
        provider: this.providerConfig.provider
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      return await provider.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      return await provider.getModels();
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  static getSupportedProviders(): AIProvider[] {
    return ProviderFactory.getActiveProviders();
  }

  private validateAndFixConnections(workflow: any): any {
    if (!workflow.connections) {
      workflow.connections = {};
    }

    // Get all node IDs (removed unused vars)

    // Check each node has connections (except start nodes)
    workflow.nodes.forEach((node: any) => {
      const nodeName = node.name;
      
      // Skip if it's a trigger node and already has connections
      if (workflow.connections[nodeName]) {
        return;
      }

      // Find nodes that should connect to this node based on position
      const potentialSource = this.findPotentialSourceNode(node, workflow.nodes);
      if (potentialSource && !workflow.connections[potentialSource.name]) {
        workflow.connections[potentialSource.name] = {
          main: [[{
            node: nodeName,
            type: 'main',
            index: 0
          }]]
        };
      }
    });

    // Fix disconnected final/orchestration nodes
    const finalNodes = workflow.nodes.filter((n: any) => 
      n.name.toLowerCase().includes('final') || 
      n.name.toLowerCase().includes('orchestration') ||
      n.name.toLowerCase().includes('completion')
    );

    finalNodes.forEach((finalNode: any) => {
      if (!this.hasIncomingConnections(finalNode.name, workflow.connections)) {
        // Find the last merge or set node to connect from
        const sourceNode = this.findBestSourceForFinalNode(finalNode, workflow);
        if (sourceNode) {
          if (!workflow.connections[sourceNode.name]) {
            workflow.connections[sourceNode.name] = { main: [[]] };
          }
          workflow.connections[sourceNode.name].main[0].push({
            node: finalNode.name,
            type: 'main',
            index: 0
          });
        }
      }
    });

    return workflow;
  }

  private findPotentialSourceNode(targetNode: any, allNodes: any[]): any {
    // Find node that's positioned before this one
    const targetX = targetNode.position[0];
    const targetY = targetNode.position[1];

    return allNodes
      .filter(n => n.id !== targetNode.id)
      .filter(n => n.position[0] < targetX) // Must be to the left
      .sort((a, b) => {
        // Prefer nodes that are horizontally aligned
        const aDist = Math.abs(a.position[1] - targetY);
        const bDist = Math.abs(b.position[1] - targetY);
        return aDist - bDist;
      })[0];
  }

  private hasIncomingConnections(nodeName: string, connections: any): boolean {
    for (const [, targets] of Object.entries(connections)) {
      const targetsData = targets as any;
      if (targetsData.main) {
        for (const branch of targetsData.main) {
          if (branch.some((conn: any) => conn.node === nodeName)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private findBestSourceForFinalNode(finalNode: any, workflow: any): any {
    // Look for merge nodes first
    const mergeNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.merge' && n.id !== finalNode.id
    );
    
    if (mergeNodes.length > 0) {
      // Return the rightmost merge node
      return mergeNodes.sort((a: any, b: any) => b.position[0] - a.position[0])[0];
    }

    // Look for set nodes
    const setNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.set' && n.id !== finalNode.id
    );
    
    if (setNodes.length > 0) {
      return setNodes.sort((a: any, b: any) => b.position[0] - a.position[0])[0];
    }

    // Return any node that's to the left of the final node
    return this.findPotentialSourceNode(finalNode, workflow.nodes);
  }
}