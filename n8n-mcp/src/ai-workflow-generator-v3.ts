import { AIWorkflowGenerator } from './ai-workflow-generator';
import { DynamicCodeGenerator } from './code-generation/dynamic-code-generator';
import { CodeGenerationLearningEngine } from './code-generation/code-generation-learning-engine';
import { CodeGenerationRequest } from './code-generation/types';

export class AIWorkflowGeneratorV3 extends AIWorkflowGenerator {
  private learningEngine: CodeGenerationLearningEngine;
  private workflowGenerationStats: Map<string, any>;

  constructor(options?: any) {
    super(options);
    this.learningEngine = new CodeGenerationLearningEngine(this.provider);
    this.workflowGenerationStats = new Map();
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    console.log('=== AI Workflow Generation V3 with Real-time Learning ===');
    
    const startTime = Date.now();
    
    // Call parent generation method
    const result = await super.generateFromPrompt(prompt, name);
    
    if (result.success && result.workflow) {
      // Enhance code nodes with real-time learning
      await this.enhanceCodeNodesWithLearning(result.workflow, prompt);
      
      // Track generation statistics
      this.trackGenerationStats(prompt, name, result, Date.now() - startTime);
      
      // Learn from successful generation
      await this.learnFromWorkflowGeneration(prompt, result.workflow);
    }
    
    return result;
  }

  private async enhanceCodeNodesWithLearning(
    workflow: any, 
    originalPrompt: string
  ): Promise<void> {
    console.log('🧠 Enhancing code nodes with AI-driven generation...');
    
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.code') {
        try {
          // Create detailed code generation request
          const codeRequest: CodeGenerationRequest = {
            description: this.extractCodePurpose(node, originalPrompt),
            nodeType: 'code',
            workflowContext: {
              workflowPurpose: originalPrompt,
              previousNodes: this.getPreviousNodes(workflow, node),
              nextNodes: this.getNextNodes(workflow, node)
            },
            requirements: {
              language: node.parameters?.language === 'python' ? 'python' : 'javascript',
              performanceLevel: 'optimized',
              errorHandling: 'comprehensive'
            }
          };
          
          // Generate enhanced code
          const codeResult = await this.codeGenerator.generateCode(codeRequest);
          
          if (codeResult.success) {
            // Update node with AI-generated code
            if (node.parameters.language === 'python') {
              node.parameters.pythonCode = codeResult.code;
            } else {
              node.parameters.jsCode = codeResult.code;
            }
            
            // Store code generation ID for monitoring
            node.codeGenerationId = this.generateCodeId(node.id);
            
            // Record successful generation for learning
            await this.learningEngine.recordSuccessfulGeneration(
              codeRequest,
              codeResult
            );
            
            console.log(`✅ Enhanced code node: ${node.name}`);
          }
        } catch (error) {
          console.error(`Failed to enhance code node ${node.name}:`, error);
          // Keep existing code on failure
        }
      }
    }
  }

  private extractCodePurpose(node: any, workflowPrompt: string): string {
    // Extract purpose from node name and workflow context
    const nodeName = node.name || '';
    const nodePosition = node.position || [0, 0];
    
    // Try to understand the node's purpose from its name
    if (nodeName) {
      return `${nodeName} - Part of workflow: ${workflowPrompt}`;
    }
    
    // Default description based on workflow
    return `Process data for ${workflowPrompt}`;
  }

  private getPreviousNodes(workflow: any, currentNode: any): any[] {
    const previousNodes: any[] = [];
    
    // Find nodes that connect TO this node
    Object.entries(workflow.connections || {}).forEach(([nodeName, connections]: any) => {
      Object.values(connections || {}).forEach((mainConnections: any) => {
        mainConnections.forEach((connectionList: any[]) => {
          connectionList.forEach((conn: any) => {
            if (conn.node === currentNode.name) {
              const prevNode = workflow.nodes.find((n: any) => n.name === nodeName);
              if (prevNode) {
                previousNodes.push({
                  id: prevNode.id,
                  type: prevNode.type,
                  outputData: {} // Would be populated in real execution
                });
              }
            }
          });
        });
      });
    });
    
    return previousNodes;
  }

  private getNextNodes(workflow: any, currentNode: any): any[] {
    const nextNodes: any[] = [];
    
    // Find nodes that this node connects TO
    const connections = workflow.connections[currentNode.name];
    if (connections && connections.main) {
      connections.main.forEach((connectionList: any[]) => {
        connectionList.forEach((conn: any) => {
          const nextNode = workflow.nodes.find((n: any) => n.name === conn.node);
          if (nextNode) {
            nextNodes.push({
              id: nextNode.id,
              type: nextNode.type,
              configuration: nextNode.parameters
            });
          }
        });
      });
    }
    
    return nextNodes;
  }

  private async learnFromWorkflowGeneration(
    prompt: string,
    workflow: any
  ): Promise<void> {
    console.log('📚 Learning from workflow generation...');
    
    try {
      // Extract patterns from the generated workflow
      const patterns = this.extractWorkflowPatterns(workflow);
      
      // Store workflow generation data for learning
      const learningData = {
        prompt,
        workflow: {
          nodeCount: workflow.nodes.length,
          nodeTypes: this.getNodeTypes(workflow),
          connectionPatterns: this.getConnectionPatterns(workflow),
          codeNodeCount: workflow.nodes.filter((n: any) => n.type === 'n8n-nodes-base.code').length
        },
        patterns,
        timestamp: new Date().toISOString()
      };
      
      // This could be saved to database for future analysis
      console.log('📊 Workflow learning data:', learningData);
      
    } catch (error) {
      console.error('Failed to learn from workflow generation:', error);
    }
  }

  private extractWorkflowPatterns(workflow: any): any[] {
    const patterns: any[] = [];
    
    // Extract node sequence patterns
    const nodeSequence = workflow.nodes.map((n: any) => n.type);
    patterns.push({
      type: 'node_sequence',
      pattern: nodeSequence,
      description: 'Common node sequence pattern'
    });
    
    // Extract branching patterns
    const branchNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.if' || 
      n.type === 'n8n-nodes-base.switch'
    );
    
    if (branchNodes.length > 0) {
      patterns.push({
        type: 'branching',
        count: branchNodes.length,
        description: 'Workflow uses conditional branching'
      });
    }
    
    // Extract merge patterns
    const mergeNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.merge'
    );
    
    if (mergeNodes.length > 0) {
      patterns.push({
        type: 'merging',
        count: mergeNodes.length,
        description: 'Workflow merges data streams'
      });
    }
    
    return patterns;
  }

  private getNodeTypes(workflow: any): Record<string, number> {
    const nodeTypes: Record<string, number> = {};
    
    workflow.nodes.forEach((node: any) => {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    });
    
    return nodeTypes;
  }

  private getConnectionPatterns(workflow: any): any[] {
    const patterns: any[] = [];
    
    // Analyze connection patterns
    let linearConnections = 0;
    let branchingConnections = 0;
    let mergingConnections = 0;
    
    Object.values(workflow.connections || {}).forEach((connections: any) => {
      Object.values(connections || {}).forEach((mainConnections: any) => {
        if (Array.isArray(mainConnections)) {
          if (mainConnections.length === 1 && mainConnections[0].length === 1) {
            linearConnections++;
          } else if (mainConnections.length > 1) {
            branchingConnections++;
          }
        }
      });
    });
    
    // Count nodes with multiple inputs (merging)
    const nodeInputCounts: Record<string, number> = {};
    Object.values(workflow.connections || {}).forEach((connections: any) => {
      Object.values(connections || {}).forEach((mainConnections: any) => {
        mainConnections.forEach((connectionList: any[]) => {
          connectionList.forEach((conn: any) => {
            nodeInputCounts[conn.node] = (nodeInputCounts[conn.node] || 0) + 1;
          });
        });
      });
    });
    
    Object.values(nodeInputCounts).forEach(count => {
      if (count > 1) mergingConnections++;
    });
    
    patterns.push({
      linear: linearConnections,
      branching: branchingConnections,
      merging: mergingConnections
    });
    
    return patterns;
  }

  private trackGenerationStats(
    prompt: string,
    name: string,
    result: any,
    duration: number
  ): void {
    const stats = {
      prompt,
      name,
      success: result.success,
      duration,
      nodeCount: result.workflow?.nodes?.length || 0,
      codeNodeCount: result.workflow?.nodes?.filter((n: any) => 
        n.type === 'n8n-nodes-base.code'
      ).length || 0,
      timestamp: new Date().toISOString()
    };
    
    this.workflowGenerationStats.set(`${name}_${Date.now()}`, stats);
    
    console.log('📈 Generation stats:', stats);
  }

  private generateCodeId(nodeId: string): string {
    return `code_${nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getGenerationStats(): Promise<any> {
    const stats = Array.from(this.workflowGenerationStats.values());
    
    return {
      totalGenerations: stats.length,
      successRate: (stats.filter(s => s.success).length / stats.length) * 100,
      avgDuration: stats.reduce((sum, s) => sum + s.duration, 0) / stats.length,
      avgNodeCount: stats.reduce((sum, s) => sum + s.nodeCount, 0) / stats.length,
      avgCodeNodeCount: stats.reduce((sum, s) => sum + s.codeNodeCount, 0) / stats.length
    };
  }
}