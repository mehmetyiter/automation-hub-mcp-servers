import { AIProvider, AIProviderConfig } from './types/ai-provider.js';
import { ProviderFactory } from './providers/provider-factory.js';
import { MultiStepWorkflowGenerator } from './generators/multi-step-generator.js';
import { N8nKnowledgeBase } from './knowledge/n8n-capabilities.js';
import { LearningEngine } from './learning/learning-engine.js';
import { GenerationRecord } from './learning/types.js';
import { WorkflowValidator } from './validation/workflow-validator.js';
import { DirectWorkflowBuilder } from './workflow-generation/direct-workflow-builder.js';
import { v4 as uuidv4 } from 'uuid';

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
  private learningEngine: LearningEngine;
  private validator: WorkflowValidator;

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
    this.learningEngine = new LearningEngine();
    this.validator = new WorkflowValidator();
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    console.log('=== AI Workflow Generation V3 (Multi-Step) Started ===');
    console.log('Prompt:', prompt);
    console.log('Name:', name);
    console.log('Provider:', this.providerConfig.provider);
    console.log('Model:', this.providerConfig.model || 'default');
    
    const generationId = uuidv4();
    
    try {
      // Get learning context for similar workflows
      const learningContext = await this.learningEngine.getLearningContext(prompt);
      console.log(`Found ${learningContext.similarWorkflows.length} similar workflows`);
      console.log(`Common errors to avoid: ${learningContext.avoidErrors.length}`);
      console.log(`Best practices: ${learningContext.bestPractices.length}`);
      
      // Enhance prompt with learning insights
      const enhancedPrompt = await this.learningEngine.enhancePrompt(prompt, learningContext);
      
      const provider = ProviderFactory.createProvider(this.providerConfig);
      
      // Pass learning context and progress callback to multi-step generator
      console.log('Using Multi-Step Generation with learning insights...');
      const progressCallback = (this.providerConfig as any).progressCallback;
      const multiStepGenerator = new MultiStepWorkflowGenerator(provider, learningContext, progressCallback);
      let workflow = await multiStepGenerator.generateWorkflow(enhancedPrompt, name);
      
      // Validate the generated workflow
      if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
        throw new Error('Generated workflow is empty');
      }
      
      console.log(`Multi-step generation completed with ${workflow.nodes.length} nodes`);
      
      // Additional validation
      workflow.connections = this.validateAndFixConnections(workflow);
      
      // Validate workflow and auto-fix issues
      const validationResult = await this.validator.validateWorkflow(workflow, generationId);
      console.log(`Validation result: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
      console.log(`Found ${validationResult.issues.length} issues, ${validationResult.warnings.length} warnings`);
      
      // Auto-fix invalid node types if possible
      if (!validationResult.isValid) {
        workflow = await this.autoFixWorkflow(workflow, validationResult);
        // Re-validate after fixes
        const reValidation = await this.validator.validateWorkflow(workflow, generationId);
        console.log(`After auto-fix: ${reValidation.isValid ? 'VALID' : 'STILL INVALID'}`);
      }
      
      // Record generation for future learning
      const generationRecord: GenerationRecord = {
        id: generationId,
        prompt: prompt,
        workflow: workflow,
        provider: this.providerConfig.provider,
        model: this.providerConfig.model,
        timestamp: new Date(),
        nodeCount: workflow.nodes.length,
        connectionCount: Object.keys(workflow.connections).length
      };
      
      await this.learningEngine.recordGeneration(generationRecord);
      
      return {
        success: true,
        workflow: workflow,
        provider: this.providerConfig.provider,
        method: 'multi-step-generation',
        nodeCount: workflow.nodes.length,
        generationId: generationId,
        learningInsights: {
          similarWorkflowsUsed: learningContext.similarWorkflows.length,
          errorsAvoided: learningContext.avoidErrors.length,
          bestPracticesApplied: learningContext.bestPractices.length
        }
      };
      
    } catch (error: any) {
      console.error('Workflow generation failed:', error);
      
      // Fallback to enhanced single-step generation
      try {
        console.log('Falling back to enhanced single-step generation...');
        const result = await this.enhancedSingleStepGeneration(prompt, name);
        
        // Still record the generation attempt
        if (result.success && result.workflow) {
          const generationRecord: GenerationRecord = {
            id: generationId,
            prompt: prompt,
            workflow: result.workflow,
            provider: this.providerConfig.provider,
            model: this.providerConfig.model,
            timestamp: new Date(),
            nodeCount: result.workflow.nodes?.length || 0,
            connectionCount: Object.keys(result.workflow.connections || {}).length
          };
          
          await this.learningEngine.recordGeneration(generationRecord);
          result.generationId = generationId;
        }
        
        return result;
      } catch (fallbackError: any) {
        return {
          success: false,
          error: fallbackError.message || error.message,
          provider: this.providerConfig.provider,
          generationId: generationId
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
      
      // Use DirectWorkflowBuilder to analyze user configuration requirements
      const builder = new DirectWorkflowBuilder();
      builder.setProvider(provider);
      result.workflow = builder.build(result.workflow);
      
      // Extract user configuration if exists
      if (result.workflow?.meta?.userConfigurationRequired) {
        result.userConfiguration = result.workflow.meta.userConfigurationRequired;
      }
      
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
  
  private async autoFixWorkflow(workflow: any, validationResult: any): Promise<any> {
    console.log('Auto-fixing workflow issues...');
    
    // Fix invalid node types
    for (const issue of validationResult.issues) {
      if (issue.issueType === 'invalid_node_type' && issue.suggestion) {
        const node = workflow.nodes.find((n: any) => 
          n.id === issue.nodeId || n.name === issue.nodeName
        );
        
        if (node && issue.suggestion.startsWith('Use ')) {
          const newType = issue.suggestion.replace('Use ', '').replace(' instead', '');
          console.log(`Fixing node "${node.name}": ${node.type} → ${newType}`);
          node.type = newType;
          
          // Fix type version if needed
          if (!node.typeVersion) {
            node.typeVersion = 1;
          }
        }
      }
    }
    
    // Fix disconnected nodes
    const disconnectedIssues = validationResult.issues.filter((i: any) => 
      i.issueType === 'disconnected_node'
    );
    
    if (disconnectedIssues.length > 0) {
      console.log(`Fixing ${disconnectedIssues.length} disconnected nodes...`);
      workflow = this.fixDisconnectedNodes(workflow, disconnectedIssues);
    }
    
    // Handle credential duplications (warnings)
    if (validationResult.credentialStats?.duplicates?.length > 0) {
      console.log('Warning: Duplicate credentials detected:', validationResult.credentialStats.duplicates);
      // In future, we could consolidate credentials here
    }
    
    return workflow;
  }

  private fixDisconnectedNodes(workflow: any, disconnectedIssues: any[]): any {
    const fixedWorkflow = { ...workflow };
    
    disconnectedIssues.forEach(issue => {
      const node = fixedWorkflow.nodes.find((n: any) => 
        n.name === issue.nodeName || n.id === issue.nodeId
      );
      if (!node) return;
      
      console.log(`Fixing disconnected node: ${node.name} (${node.type})`);
      
      // Fix disconnected trigger nodes
      if (node.type && (node.type.includes('cron') || node.type.includes('trigger') || 
          node.type.includes('webhook'))) {
        // Find the first function/processing node
        const targetNode = fixedWorkflow.nodes.find((n: any) => 
          (n.type === 'n8n-nodes-base.function' || 
           n.type === 'n8n-nodes-base.switch' ||
           n.type === 'n8n-nodes-base.if') &&
          n.name !== node.name
        );
        
        if (targetNode) {
          if (!fixedWorkflow.connections[node.name]) {
            fixedWorkflow.connections[node.name] = { main: [[]] };
          }
          fixedWorkflow.connections[node.name].main[0] = [{
            node: targetNode.name,
            type: 'main',
            index: 0
          }];
          console.log(`  Connected trigger "${node.name}" to "${targetNode.name}"`);
        }
      }
      
      // Fix disconnected error handler nodes
      if (node.type === 'n8n-nodes-base.errorTrigger' || 
          (node.name && node.name.toLowerCase().includes('error'))) {
        // Find error notification or email node
        const notificationNode = fixedWorkflow.nodes.find((n: any) => 
          n.name !== node.name &&
          (n.name.toLowerCase().includes('error') && 
           (n.name.toLowerCase().includes('notification') || 
            n.name.toLowerCase().includes('email') ||
            n.type.includes('sendEmail')))
        );
        
        if (notificationNode) {
          if (!fixedWorkflow.connections[node.name]) {
            fixedWorkflow.connections[node.name] = { main: [[]] };
          }
          fixedWorkflow.connections[node.name].main[0] = [{
            node: notificationNode.name,
            type: 'main',
            index: 0
          }];
          console.log(`  Connected error handler "${node.name}" to "${notificationNode.name}"`);
        }
      }
      
      // Fix other disconnected nodes based on position
      if (!node.type?.includes('trigger') && !node.type?.includes('errorTrigger')) {
        const parentNode = this.findSuitableParent(node, fixedWorkflow.nodes, fixedWorkflow.connections);
        if (parentNode) {
          const parentName = parentNode.name || parentNode.id;
          if (!fixedWorkflow.connections[parentName]) {
            fixedWorkflow.connections[parentName] = { main: [[]] };
          }
          if (!fixedWorkflow.connections[parentName].main[0]) {
            fixedWorkflow.connections[parentName].main[0] = [];
          }
          fixedWorkflow.connections[parentName].main[0].push({
            node: node.name,
            type: 'main',
            index: 0
          });
          console.log(`  Connected "${node.name}" to "${parentName}"`);
        }
      }
    });
    
    return fixedWorkflow;
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