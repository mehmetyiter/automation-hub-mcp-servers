import { AIProvider, AIProviderConfig } from './types/ai-provider.js';
import { ProviderFactory } from './providers/provider-factory.js';
import { MultiStepWorkflowGenerator } from './generators/multi-step-generator.js';
import { N8nKnowledgeBase } from './knowledge/n8n-capabilities.js';

export interface WorkflowGenerationOptions {
  apiKey?: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useMultiStep?: boolean;
}

export class AIWorkflowGeneratorV3 {
  private providerConfig: AIProviderConfig;
  private knowledgeBase: N8nKnowledgeBase;

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
    
    this.knowledgeBase = new N8nKnowledgeBase();
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    console.log('=== AI Workflow Generation V3 (Multi-Step) Started ===');
    console.log('Prompt:', prompt);
    console.log('Name:', name);
    console.log('Provider:', this.providerConfig.provider);
    console.log('Model:', this.providerConfig.model || 'default');
    
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      
      // Always use multi-step for better results
      console.log('Using Multi-Step Generation for complex workflows...');
      const multiStepGenerator = new MultiStepWorkflowGenerator(provider);
      const workflow = await multiStepGenerator.generateWorkflow(prompt, name);
      
      // Validate the generated workflow
      if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
        throw new Error('Generated workflow is empty');
      }
      
      console.log(`Multi-step generation completed with ${workflow.nodes.length} nodes`);
      
      // Additional validation
      workflow.connections = this.validateAndFixConnections(workflow);
      
      return {
        success: true,
        workflow: workflow,
        provider: this.providerConfig.provider,
        method: 'multi-step-generation',
        nodeCount: workflow.nodes.length
      };
      
    } catch (error: any) {
      console.error('Workflow generation failed:', error);
      
      // Fallback to enhanced single-step generation
      try {
        console.log('Falling back to enhanced single-step generation...');
        return await this.enhancedSingleStepGeneration(prompt, name);
      } catch (fallbackError: any) {
        return {
          success: false,
          error: fallbackError.message || error.message,
          provider: this.providerConfig.provider
        };
      }
    }
  }
  
  private async enhancedSingleStepGeneration(prompt: string, name: string): Promise<any> {
    const provider = ProviderFactory.createProvider(this.providerConfig);
    
    // Enhance the prompt with knowledge base information
    const enhancedPrompt = this.enhancePromptWithKnowledge(prompt);
    
    const result = await provider.generateWorkflow(enhancedPrompt, name);
    
    if (result.success && result.workflow) {
      // Apply additional validation and fixes
      result.workflow = this.validateAndFixConnections(result.workflow);
      result.method = 'enhanced-single-step';
    }
    
    return result;
  }
  
  private enhancePromptWithKnowledge(prompt: string): string {
    const suggestions = this.knowledgeBase.suggestNodesForUseCase(prompt);
    const features = this.extractFeatures(prompt);
    const recommendedNodes = this.knowledgeBase.calculateRecommendedNodes(features);
    
    return `${prompt}

IMPORTANT CONTEXT FROM N8N KNOWLEDGE BASE:
- Suggested node types for this use case: ${suggestions.join(', ')}
- Estimated nodes based on features: ${recommendedNodes} (adjust as needed)
- Available node categories: trigger, processing, logic, communication, ai, database, control

IMPLEMENTATION GUIDELINES:
${features.map(feature => {
  const expansion = this.knowledgeBase.getExpansionForFeature(feature);
  if (expansion) {
    return `- For "${feature}": Consider nodes like ${expansion.expansion.slice(0, 3).join(', ')}...`;
  }
  return `- For "${feature}": Implement with appropriate specialized nodes`;
}).join('\n')}

Remember to create an EFFICIENT workflow with necessary error handling, validation, and monitoring.`;
  }
  
  private validateAndFixConnections(workflow: any): any {
    if (!workflow.connections) {
      workflow.connections = {};
    }
    
    // Normalize connections format
    const normalizedConnections: any = {};
    
    Object.entries(workflow.connections).forEach(([nodeId, targets]: [string, any]) => {
      // Handle both node names and IDs
      const sourceNode = workflow.nodes.find((n: any) => 
        n.id === nodeId || n.name === nodeId
      );
      
      if (!sourceNode) return;
      
      const sourceKey = sourceNode.name || sourceNode.id;
      normalizedConnections[sourceKey] = { main: [] };
      
      // Process targets
      if (targets.main && Array.isArray(targets.main)) {
        targets.main.forEach((targetGroup: any, groupIndex: number) => {
          if (!normalizedConnections[sourceKey].main[groupIndex]) {
            normalizedConnections[sourceKey].main[groupIndex] = [];
          }
          
          const normalizedGroup = Array.isArray(targetGroup) ? targetGroup : [targetGroup];
          
          normalizedGroup.forEach((target: any) => {
            if (typeof target === 'string') {
              // Find target node
              const targetNode = workflow.nodes.find((n: any) => 
                n.id === target || n.name === target
              );
              
              if (targetNode) {
                normalizedConnections[sourceKey].main[groupIndex].push({
                  node: targetNode.name || targetNode.id,
                  type: 'main',
                  index: 0
                });
              }
            } else if (target.node) {
              // Already in correct format, just ensure node exists
              const targetNode = workflow.nodes.find((n: any) => 
                n.id === target.node || n.name === target.node
              );
              
              if (targetNode) {
                normalizedConnections[sourceKey].main[groupIndex].push({
                  ...target,
                  node: targetNode.name || targetNode.id
                });
              }
            }
          });
        });
      }
    });
    
    // Find and connect orphaned nodes
    const connectedNodes = new Set<string>();
    const allNodeNames = new Set(workflow.nodes.map((n: any) => n.name || n.id));
    
    // Mark connected nodes
    Object.entries(normalizedConnections).forEach(([source, targets]: [string, any]) => {
      connectedNodes.add(source);
      if (targets.main) {
        targets.main.forEach((group: any[]) => {
          group.forEach((conn: any) => {
            connectedNodes.add(conn.node);
          });
        });
      }
    });
    
    // Find orphaned nodes
    const orphanedNodes = Array.from(allNodeNames).filter(name => !connectedNodes.has(name as string));
    
    if (orphanedNodes.length > 0) {
      console.log(`Found ${orphanedNodes.length} orphaned nodes, connecting them...`);
      
      // Connect orphaned nodes based on their type and position
      orphanedNodes.forEach(nodeName => {
        const node = workflow.nodes.find((n: any) => (n.name || n.id) === nodeName);
        if (!node) return;
        
        // Skip trigger nodes as they don't need incoming connections
        if (node.type && node.type.includes('trigger')) return;
        
        // Find a suitable parent node
        const parentNode = this.findSuitableParent(node, workflow.nodes, normalizedConnections);
        if (parentNode) {
          const parentName = parentNode.name || parentNode.id;
          if (!normalizedConnections[parentName]) {
            normalizedConnections[parentName] = { main: [[]] };
          }
          if (!normalizedConnections[parentName].main[0]) {
            normalizedConnections[parentName].main[0] = [];
          }
          normalizedConnections[parentName].main[0].push({
            node: nodeName,
            type: 'main',
            index: 0
          });
          console.log(`Connected orphaned node "${nodeName}" to "${parentName}"`);
        }
      });
    }
    
    workflow.connections = normalizedConnections;
    return workflow;
  }
  
  private findSuitableParent(node: any, allNodes: any[], connections: any): any {
    // Try to find a node that should logically connect to this one
    const nodePosition = node.position || [0, 0];
    
    // Find nodes that are positioned before (to the left of) this node
    const candidateNodes = allNodes.filter(n => {
      if (n === node) return false;
      const pos = n.position || [0, 0];
      return pos[0] < nodePosition[0];
    });
    
    if (candidateNodes.length === 0) {
      // If no nodes to the left, find the trigger node
      return allNodes.find(n => n.type && n.type.includes('trigger'));
    }
    
    // Sort by distance and return the closest one
    candidateNodes.sort((a, b) => {
      const posA = a.position || [0, 0];
      const posB = b.position || [0, 0];
      
      const distA = Math.sqrt(
        Math.pow(posA[0] - nodePosition[0], 2) +
        Math.pow(posA[1] - nodePosition[1], 2)
      );
      const distB = Math.sqrt(
        Math.pow(posB[0] - nodePosition[0], 2) +
        Math.pow(posB[1] - nodePosition[1], 2)
      );
      
      return distA - distB;
    });
    
    return candidateNodes[0];
  }
  
  private extractFeatures(prompt: string): string[] {
    const features = [];
    const keywords = [
      'api integration', 'database operation', 'notification', 'error handling',
      'data validation', 'authentication', 'monitoring', 'logging', 'reporting',
      'data processing', 'external service', 'webhook', 'scheduling', 'retry logic'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    keywords.forEach(keyword => {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        features.push(keyword);
      }
    });
    
    // Also extract specific services mentioned
    const services = ['slack', 'email', 'sms', 'database', 'api', 'webhook'];
    services.forEach(service => {
      if (lowerPrompt.includes(service)) {
        features.push(service);
      }
    });
    
    return [...new Set(features)]; // Remove duplicates
  }

  async testConnection(): Promise<boolean> {
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      return await provider.testConnection();
    } catch (error) {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      return await provider.getModels();
    } catch (error) {
      console.error('Error getting models:', error);
      return [];
    }
  }
}