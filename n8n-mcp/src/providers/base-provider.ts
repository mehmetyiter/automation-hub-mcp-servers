import { AIProvider, AIProviderConfig, AIProviderInterface } from '../types/ai-provider.js';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BaseAIProvider implements AIProviderInterface {
  protected config: AIProviderConfig;
  protected trainingData: any;
  abstract name: AIProvider;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.loadTrainingData();
  }

  private loadTrainingData() {
    try {
      const trainingDataPath = path.join(process.cwd(), 'training-data', 'n8n-workflow-patterns.json');
      
      if (fs.existsSync(trainingDataPath)) {
        const content = fs.readFileSync(trainingDataPath, 'utf-8');
        this.trainingData = JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    }
  }

  abstract generateWorkflow(prompt: string, name: string): Promise<any>;
  abstract testConnection(): Promise<boolean>;
  abstract getModels(): Promise<string[]>;

  protected buildSystemPrompt(): string {
    const universalPrinciples = this.trainingData?.universal_workflow_principles || {};
    
    return `You are an n8n workflow generation expert. Generate a complete n8n workflow based on the user's request.

${JSON.stringify(universalPrinciples, null, 2)}

CRITICAL RULES:
1. Return ONLY a valid JSON object with this structure:
{
  "name": "workflow name",
  "nodes": [...],
  "connections": {...},
  "settings": {...}
}

2. Every node MUST appear in the connections object
3. Use object format for connections: {"node": "NodeName", "type": "main", "index": 0}
4. Ensure all branches eventually converge or complete meaningfully
5. Add error handling for external services
6. Include success confirmations and logging`;
  }

  protected validateWorkflowStructure(workflow: any): boolean {
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      console.error('Invalid workflow: missing nodes array');
      return false;
    }

    if (!workflow.connections || typeof workflow.connections !== 'object') {
      console.error('Invalid workflow: missing connections object');
      return false;
    }

    // Check all nodes are connected
    const nodeIds = new Set(workflow.nodes.map((n: any) => n.id));
    const connectedNodes = new Set(Object.keys(workflow.connections));
    
    for (const nodeId of nodeIds) {
      if (!connectedNodes.has(String(nodeId)) && workflow.nodes.find((n: any) => n.id === nodeId)?.type !== 'n8n-nodes-base.start') {
        console.warn(`Node ${String(nodeId)} has no outgoing connections`);
      }
    }

    return true;
  }

  protected parseAIResponse(response: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(response);
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try to find JSON object in the response
      const objectMatch = response.match(/\{[\s\S]*"nodes"[\s\S]*"connections"[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      
      throw new Error('Could not parse AI response as valid workflow JSON');
    }
  }
}