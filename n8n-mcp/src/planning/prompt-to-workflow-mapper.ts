import { N8nKnowledgeBase } from '../knowledge/n8n-capabilities.js';

export interface WorkflowTask {
  id: string;
  description: string;
  requiredNodes: string[];
  dependencies: string[];
  status: 'pending' | 'in-progress' | 'completed';
  validationChecks: string[];
}

export interface PromptAnalysisResult {
  features: Map<string, string[]>; // feature -> capabilities
  tasks: WorkflowTask[];
  suggestedNodes: string[];
  validationChecklist: string[];
  missingCapabilities: string[];
}

export class PromptToWorkflowMapper {
  private knowledgeBase: N8nKnowledgeBase;
  
  constructor() {
    this.knowledgeBase = new N8nKnowledgeBase();
  }
  
  async analyzePrompt(prompt: string): Promise<PromptAnalysisResult> {
    const features = this.extractFeaturesFromPrompt(prompt);
    const tasks = this.generateWorkflowTasks(features);
    const suggestedNodes = this.mapFeaturesToNodes(features);
    const validationChecklist = this.generateValidationChecklist(features);
    const missingCapabilities = this.identifyMissingCapabilities(features);
    
    return {
      features,
      tasks,
      suggestedNodes,
      validationChecklist,
      missingCapabilities
    };
  }
  
  private extractFeaturesFromPrompt(prompt: string): Map<string, string[]> {
    const features = new Map<string, string[]>();
    const lowerPrompt = prompt.toLowerCase();
    
    // Dynamic feature extraction based on actual prompt content
    // NO TEMPLATES - analyze what the user actually needs
    
    // Look for timing/scheduling needs
    if (lowerPrompt.includes('daily') || lowerPrompt.includes('schedule') || 
        lowerPrompt.includes('cron') || lowerPrompt.includes('recurring')) {
      features.set('Scheduling', [
        'Time-based triggers needed',
        'Recurring execution required'
      ]);
    }
    
    // Look for notification/alert needs
    if (lowerPrompt.includes('notification') || lowerPrompt.includes('alert') ||
        lowerPrompt.includes('email') || lowerPrompt.includes('sms')) {
      features.set('Notifications', [
        'Alert system required',
        'Multi-channel communication needed'
      ]);
    }
    
    // Look for data processing needs
    if (lowerPrompt.includes('analysis') || lowerPrompt.includes('process') ||
        lowerPrompt.includes('transform') || lowerPrompt.includes('calculate')) {
      features.set('Data Processing', [
        'Data transformation required',
        'Analysis capabilities needed'
      ]);
    }
    
    // Look for integration needs - be generic, not specific
    if (lowerPrompt.includes('api') || lowerPrompt.includes('integration') ||
        lowerPrompt.includes('connect') || lowerPrompt.includes('external')) {
      features.set('External Integration', [
        'API connections required',
        'Third-party service integration needed'
      ]);
    }
    
    // Look for conditional logic needs
    if (lowerPrompt.includes('if') || lowerPrompt.includes('when') ||
        lowerPrompt.includes('condition') || lowerPrompt.includes('decision')) {
      features.set('Conditional Logic', [
        'Decision points required',
        'Branching logic needed'
      ]);
    }
    
    // Look for parallel processing needs
    if (lowerPrompt.includes('parallel') || lowerPrompt.includes('simultaneous') ||
        lowerPrompt.includes('multiple') || lowerPrompt.includes('concurrent')) {
      features.set('Parallel Processing', [
        'Concurrent execution required',
        'Multiple path processing needed'
      ]);
    }
    
    // Don't pre-define specific domains or use cases
    // Let the AI figure out the specific implementation based on the prompt
    
    return features;
  }
  
  private generateWorkflowTasks(features: Map<string, string[]>): WorkflowTask[] {
    // Simplified task generation - no templates
    const tasks: WorkflowTask[] = [];
    
    // Basic workflow structure task
    tasks.push({
      id: 'task-1',
      description: 'Define workflow structure based on requirements',
      requiredNodes: [],
      dependencies: [],
      status: 'pending',
      validationChecks: ['Workflow meets specified requirements']
    });
    
    return tasks;
  }
  
  private mapFeaturesToNodes(features: Map<string, string[]>): string[] {
    // Return minimal set - let AI decide specific nodes
    const nodes = new Set<string>();
    
    // Just add basic node types that might be needed
    if (features.has('Scheduling')) {
      nodes.add('Schedule Trigger');
    }
    
    if (features.has('External Integration')) {
      nodes.add('HTTP Request');
    }
    
    if (features.has('Conditional Logic')) {
      nodes.add('IF');
    }
    
    // Always suggest function node for flexibility
    nodes.add('Function');
    
    return Array.from(nodes);
  }
  
  private generateValidationChecklist(features: Map<string, string[]>): string[] {
    // Minimal validation - let AI handle specifics
    return [
      'Workflow is complete and functional',
      'All requirements are addressed'
    ];
  }
  
  private identifyMissingCapabilities(features: Map<string, string[]>): string[] {
    // No pre-defined missing capabilities
    return [];
  }
  
  private determineTriggerNodes(features: Map<string, string[]>): string[] {
    const triggers = [];
    
    if (features.has('Scheduling')) {
      triggers.push('Schedule Trigger');
    }
    
    if (features.has('Real-time Processing')) {
      triggers.push('Webhook');
    }
    
    // Default to manual trigger if nothing specific
    if (triggers.length === 0) {
      triggers.push('Manual Trigger');
    }
    
    return triggers;
  }
  
  private getNotificationNodes(capabilities: string[]): string[] {
    // Simplified - return general notification nodes
    return ['Send Email', 'HTTP Request'];
  }
}