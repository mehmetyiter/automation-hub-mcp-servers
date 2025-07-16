import { N8nKnowledgeBase } from '../knowledge/n8n-capabilities.js';

export interface WorkflowRequirement {
  feature: string;
  description: string;
  priority: 'critical' | 'important' | 'nice-to-have';
  suggestedImplementation: string[];
}

export interface WorkflowPlan {
  overview: string;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  requirements: WorkflowRequirement[];
  suggestedArchitecture: {
    triggers: string[];
    dataFlow: string[];
    integrations: string[];
    errorHandling: string[];
  };
  estimatedNodes: number;
  implementationNotes: string[];
}

export class WorkflowPlanner {
  private knowledgeBase: N8nKnowledgeBase;
  
  constructor() {
    this.knowledgeBase = new N8nKnowledgeBase();
  }
  
  async analyzeAndPlan(userPrompt: string): Promise<WorkflowPlan> {
    // Extract key requirements from the prompt
    const requirements = this.extractRequirements(userPrompt);
    
    // Determine complexity based on requirements
    const complexity = this.determineComplexity(requirements);
    
    // Build suggested architecture
    const architecture = this.buildArchitecture(requirements, userPrompt);
    
    // Estimate nodes based on actual needs
    const estimatedNodes = this.estimateNodeCount(requirements, architecture);
    
    // Generate implementation notes
    const implementationNotes = this.generateImplementationNotes(requirements, complexity);
    
    return {
      overview: this.generateOverview(userPrompt, requirements),
      estimatedComplexity: complexity,
      requirements,
      suggestedArchitecture: architecture,
      estimatedNodes,
      implementationNotes
    };
  }
  
  private extractRequirements(prompt: string): WorkflowRequirement[] {
    const requirements: WorkflowRequirement[] = [];
    const lowerPrompt = prompt.toLowerCase();
    
    // Check for data sources
    if (lowerPrompt.includes('api') || lowerPrompt.includes('external')) {
      requirements.push({
        feature: 'External API Integration',
        description: 'Connect to external services via API',
        priority: 'critical',
        suggestedImplementation: ['HTTP Request', 'Authentication', 'Response Validation', 'Error Handling']
      });
    }
    
    if (lowerPrompt.includes('database') || lowerPrompt.includes('sql')) {
      requirements.push({
        feature: 'Database Operations',
        description: 'Read/write data from/to database',
        priority: 'critical',
        suggestedImplementation: ['SQL Node', 'Query Builder', 'Result Processing']
      });
    }
    
    // Check for processing requirements
    if (lowerPrompt.includes('transform') || lowerPrompt.includes('process')) {
      requirements.push({
        feature: 'Data Transformation',
        description: 'Transform and process data',
        priority: 'important',
        suggestedImplementation: ['Function Node', 'Set Node', 'Data Mapping']
      });
    }
    
    if (lowerPrompt.includes('validate') || lowerPrompt.includes('check')) {
      requirements.push({
        feature: 'Data Validation',
        description: 'Validate input data and ensure quality',
        priority: 'important',
        suggestedImplementation: ['Function Node', 'IF Node', 'Error Trigger']
      });
    }
    
    // Check for control flow
    if (lowerPrompt.includes('condition') || lowerPrompt.includes('if') || lowerPrompt.includes('decision')) {
      requirements.push({
        feature: 'Conditional Logic',
        description: 'Make decisions based on data',
        priority: 'critical',
        suggestedImplementation: ['IF Node', 'Switch Node', 'Merge Node']
      });
    }
    
    if (lowerPrompt.includes('loop') || lowerPrompt.includes('batch') || lowerPrompt.includes('iterate')) {
      requirements.push({
        feature: 'Batch Processing',
        description: 'Process multiple items',
        priority: 'important',
        suggestedImplementation: ['Loop Node', 'SplitInBatches', 'Aggregate']
      });
    }
    
    // Check for notifications
    if (lowerPrompt.includes('email') || lowerPrompt.includes('notify') || lowerPrompt.includes('alert')) {
      requirements.push({
        feature: 'Notifications',
        description: 'Send notifications or alerts',
        priority: 'important',
        suggestedImplementation: ['Email Node', 'Webhook', 'Format Message']
      });
    }
    
    // Check for error handling
    if (lowerPrompt.includes('error') || lowerPrompt.includes('retry') || lowerPrompt.includes('fail')) {
      requirements.push({
        feature: 'Error Handling',
        description: 'Handle errors gracefully',
        priority: 'critical',
        suggestedImplementation: ['Error Trigger', 'Wait Node', 'Retry Logic']
      });
    }
    
    // Check for scheduling
    if (lowerPrompt.includes('schedule') || lowerPrompt.includes('cron') || lowerPrompt.includes('periodic')) {
      requirements.push({
        feature: 'Scheduled Execution',
        description: 'Run workflow on schedule',
        priority: 'important',
        suggestedImplementation: ['Cron Trigger', 'Time-based Logic']
      });
    }
    
    // Check for real-time processing
    if (lowerPrompt.includes('webhook') || lowerPrompt.includes('real-time') || lowerPrompt.includes('instant')) {
      requirements.push({
        feature: 'Real-time Processing',
        description: 'Process data in real-time',
        priority: 'critical',
        suggestedImplementation: ['Webhook Trigger', 'Respond to Webhook']
      });
    }
    
    // If no specific requirements found, add basic workflow
    if (requirements.length === 0) {
      requirements.push({
        feature: 'Basic Workflow',
        description: 'Simple automation workflow',
        priority: 'critical',
        suggestedImplementation: ['Trigger', 'Process', 'Output']
      });
    }
    
    return requirements;
  }
  
  private determineComplexity(requirements: WorkflowRequirement[]): 'simple' | 'medium' | 'complex' {
    const criticalCount = requirements.filter(r => r.priority === 'critical').length;
    const totalCount = requirements.length;
    
    if (totalCount <= 2 && criticalCount <= 1) {
      return 'simple';
    } else if (totalCount <= 5 && criticalCount <= 3) {
      return 'medium';
    } else {
      return 'complex';
    }
  }
  
  private buildArchitecture(requirements: WorkflowRequirement[], prompt: string): any {
    const architecture = {
      triggers: [] as string[],
      dataFlow: [] as string[],
      integrations: [] as string[],
      errorHandling: [] as string[]
    };
    
    // Determine triggers
    const hasWebhook = requirements.some(r => r.feature.includes('Real-time'));
    const hasSchedule = requirements.some(r => r.feature.includes('Scheduled'));
    
    if (hasWebhook) {
      architecture.triggers.push('Webhook Trigger');
    } else if (hasSchedule) {
      architecture.triggers.push('Cron Trigger');
    } else {
      architecture.triggers.push('Manual Trigger');
    }
    
    // Build data flow
    architecture.dataFlow.push('Input Reception');
    
    if (requirements.some(r => r.feature.includes('Validation'))) {
      architecture.dataFlow.push('Data Validation');
    }
    
    if (requirements.some(r => r.feature.includes('Transformation'))) {
      architecture.dataFlow.push('Data Transformation');
    }
    
    if (requirements.some(r => r.feature.includes('Conditional'))) {
      architecture.dataFlow.push('Conditional Routing');
    }
    
    if (requirements.some(r => r.feature.includes('Batch'))) {
      architecture.dataFlow.push('Batch Processing');
    }
    
    architecture.dataFlow.push('Output Generation');
    
    // Identify integrations
    requirements.forEach(req => {
      if (req.feature.includes('API')) {
        architecture.integrations.push('External API');
      }
      if (req.feature.includes('Database')) {
        architecture.integrations.push('Database');
      }
      if (req.feature.includes('Notification')) {
        architecture.integrations.push('Notification Service');
      }
    });
    
    // Error handling strategy
    if (requirements.some(r => r.feature.includes('Error'))) {
      architecture.errorHandling.push('Error Capture');
      architecture.errorHandling.push('Retry Logic');
      architecture.errorHandling.push('Fallback Processing');
    } else {
      architecture.errorHandling.push('Basic Error Logging');
    }
    
    return architecture;
  }
  
  private estimateNodeCount(requirements: WorkflowRequirement[], architecture: any): number {
    let nodeCount = 0;
    
    // Count trigger nodes
    nodeCount += architecture.triggers.length;
    
    // Count data flow nodes
    nodeCount += architecture.dataFlow.length * 2; // Each step might need 2 nodes on average
    
    // Count integration nodes
    architecture.integrations.forEach((integration: string) => {
      if (integration === 'External API') {
        nodeCount += 4; // Auth, Request, Validate, Transform
      } else if (integration === 'Database') {
        nodeCount += 3; // Query, Process, Handle Results
      } else {
        nodeCount += 2; // Basic integration
      }
    });
    
    // Count error handling nodes
    nodeCount += architecture.errorHandling.length;
    
    // Add nodes for specific requirements
    requirements.forEach(req => {
      if (req.feature.includes('Batch')) {
        nodeCount += 3; // Split, Process, Merge
      }
      if (req.feature.includes('Conditional')) {
        nodeCount += 2; // Decision + Merge
      }
    });
    
    return nodeCount;
  }
  
  private generateImplementationNotes(requirements: WorkflowRequirement[], complexity: string): string[] {
    const notes: string[] = [];
    
    // General notes based on complexity
    if (complexity === 'simple') {
      notes.push('This is a straightforward workflow that can be implemented with basic nodes');
      notes.push('Focus on clarity and maintainability over complex features');
    } else if (complexity === 'medium') {
      notes.push('This workflow requires careful planning of data flow');
      notes.push('Consider using sub-workflows for better organization');
    } else {
      notes.push('This is a complex workflow that may benefit from modular design');
      notes.push('Implement comprehensive logging and monitoring');
      notes.push('Consider performance optimization for large data volumes');
    }
    
    // Specific notes based on requirements
    if (requirements.some(r => r.feature.includes('API'))) {
      notes.push('Implement proper API authentication and rate limiting');
      notes.push('Add retry logic for API failures');
    }
    
    if (requirements.some(r => r.feature.includes('Database'))) {
      notes.push('Use parameterized queries to prevent SQL injection');
      notes.push('Implement connection pooling for better performance');
    }
    
    if (requirements.some(r => r.feature.includes('Batch'))) {
      notes.push('Process data in manageable chunks to avoid memory issues');
      notes.push('Implement progress tracking for long-running batches');
    }
    
    return notes;
  }
  
  private generateOverview(prompt: string, requirements: WorkflowRequirement[]): string {
    const features = requirements.map(r => r.feature).join(', ');
    return `This workflow implements ${features} based on the user's requirements. ` +
           `The design focuses on reliability, efficiency, and maintainability.`;
  }
}