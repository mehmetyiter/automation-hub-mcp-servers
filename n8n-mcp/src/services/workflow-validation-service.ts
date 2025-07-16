import { N8nKnowledgeBase } from '../knowledge/n8n-capabilities.js';

interface NodeValidationResult {
  node: any;
  issues: string[];
  suggestions: string[];
  requiredParameters: string[];
}

interface WorkflowValidationResult {
  isValid: boolean;
  nodeIssues: NodeValidationResult[];
  workflowIssues: string[];
  improvements: string[];
  missingCapabilities: string[];
}

export class WorkflowValidationService {
  private knowledgeBase: N8nKnowledgeBase;
  
  // Correct n8n node type mappings based on knowledge base
  private nodeTypeCorrections: Record<string, string> = {
    // Trigger corrections
    'n8n-nodes-base.mqttTrigger': 'n8n-nodes-base.mqtt',
    'n8n-nodes-base.cronTrigger': 'n8n-nodes-base.cron',
    'n8n-nodes-base.webhookTrigger': 'n8n-nodes-base.webhook',
    
    // Integration corrections
    'n8n-nodes-base.whatsapp': 'n8n-nodes-base.whatsappBusiness',
    'n8n-nodes-base.gpio': 'n8n-nodes-raspberry.raspberryPi',
    'n8n-nodes-base.googleDrive': 'n8n-nodes-base.googleDrive',
    
    // Data processing corrections
    'n8n-nodes-base.function': 'n8n-nodes-base.code',
    'n8n-nodes-base.executeCommand': 'n8n-nodes-base.executeCommand',
    'n8n-nodes-base.html': 'n8n-nodes-base.html',
    
    // Communication corrections
    'n8n-nodes-base.email': 'n8n-nodes-base.emailSend',
    'n8n-nodes-base.sms': 'n8n-nodes-base.twilio'
  };
  
  // Node categories that require specific validations
  private nodeCategories = {
    triggers: ['webhook', 'cron', 'mqtt', 'errorTrigger', 'trigger'],
    dataProcessing: ['code', 'function', 'merge', 'split', 'if', 'switch'],
    communication: ['emailSend', 'twilio', 'whatsappBusiness', 'telegram', 'slack'],
    database: ['postgres', 'mysql', 'mongodb', 'redis', 'googleSheets'],
    ai: ['openAi', 'aiAgent', 'chatModel', 'textClassifier'],
    iot: ['mqtt', 'raspberryPi', 'httpRequest'],
    workflow: ['executeWorkflow', 'executeWorkflowTrigger', 'wait']
  };
  
  constructor() {
    this.knowledgeBase = new N8nKnowledgeBase();
  }
  
  /**
   * Validate entire workflow structure and nodes
   */
  async validateWorkflow(workflow: any): Promise<WorkflowValidationResult> {
    const result: WorkflowValidationResult = {
      isValid: true,
      nodeIssues: [],
      workflowIssues: [],
      improvements: [],
      missingCapabilities: []
    };
    
    // 1. Validate each node
    for (const node of workflow.nodes || []) {
      const nodeValidation = await this.validateNode(node, workflow);
      if (nodeValidation.issues.length > 0) {
        result.isValid = false;
        result.nodeIssues.push(nodeValidation);
      }
    }
    
    // 2. Validate workflow structure
    this.validateWorkflowStructure(workflow, result);
    
    // 3. Check for missing capabilities based on workflow purpose
    this.checkMissingCapabilities(workflow, result);
    
    // 4. Suggest improvements
    this.suggestImprovements(workflow, result);
    
    return result;
  }
  
  /**
   * Validate individual node
   */
  private async validateNode(node: any, workflow: any): Promise<NodeValidationResult> {
    const validation: NodeValidationResult = {
      node: node,
      issues: [],
      suggestions: [],
      requiredParameters: []
    };
    
    // 1. Check node type validity
    this.validateNodeType(node, validation);
    
    // 2. Check required parameters based on node type
    this.validateNodeParameters(node, validation);
    
    // 3. Check node connections
    this.validateNodeConnections(node, workflow, validation);
    
    // 4. Category-specific validations
    this.performCategoryValidation(node, workflow, validation);
    
    return validation;
  }
  
  /**
   * Validate and correct node types
   */
  private validateNodeType(node: any, validation: NodeValidationResult): void {
    // Check if node type needs correction
    const correctedType = this.nodeTypeCorrections[node.type];
    if (correctedType) {
      validation.issues.push(
        `Invalid node type '${node.type}'. Should be '${correctedType}'`
      );
      validation.suggestions.push(
        `Change node type from '${node.type}' to '${correctedType}'`
      );
      node.type = correctedType; // Auto-correct
    }
    
    // Check if it's a completely unknown node type
    const nodeCategory = this.getNodeCategory(node.type);
    if (!nodeCategory && !node.type.includes('nodes-base')) {
      validation.issues.push(
        `Unknown node type '${node.type}'. This might be a custom node that needs to be installed.`
      );
    }
  }
  
  /**
   * Validate node parameters based on type
   */
  private validateNodeParameters(node: any, validation: NodeValidationResult): void {
    if (!node.parameters) {
      node.parameters = {};
    }
    
    const nodeType = node.type.split('.').pop() || '';
    
    // General parameter requirements based on node type
    switch (true) {
      case nodeType.includes('webhook'):
        if (!node.parameters.path && !node.webhookId) {
          validation.requiredParameters.push('path or webhookId');
          validation.suggestions.push('Add webhook path for receiving requests');
        }
        break;
        
      case nodeType.includes('httpRequest'):
        if (!node.parameters.url) {
          validation.requiredParameters.push('url');
          validation.suggestions.push('Add target URL for HTTP requests');
        }
        if (!node.parameters.method) {
          node.parameters.method = 'GET'; // Sensible default
        }
        break;
        
      case nodeType.includes('cron'):
        if (!node.parameters.cronTimes) {
          validation.requiredParameters.push('cronTimes');
          validation.suggestions.push('Configure schedule for cron trigger');
        }
        break;
        
      case nodeType.includes('if'):
      case nodeType.includes('switch'):
        if (!node.parameters.conditions && !node.parameters.rules) {
          validation.requiredParameters.push('conditions or rules');
          validation.suggestions.push(
            `Add conditional logic: Define when this ${nodeType} should route to different branches`
          );
        }
        break;
        
      case nodeType.includes('code'):
      case nodeType.includes('function'):
        if (!node.parameters.jsCode && !node.parameters.pythonCode && !node.parameters.functionCode) {
          validation.requiredParameters.push('code implementation');
          validation.suggestions.push(
            'Add code to process data. Use $input.all() to access input items'
          );
        }
        break;
        
      case nodeType.includes('merge'):
        if (!node.parameters.mode) {
          node.parameters.mode = 'combine'; // Sensible default
          validation.suggestions.push('Merge mode set to "combine" by default');
        }
        break;
        
      case nodeType.includes('emailSend'):
        if (!node.parameters.toEmail) {
          validation.requiredParameters.push('toEmail');
        }
        if (!node.parameters.subject) {
          validation.requiredParameters.push('subject');
        }
        break;
        
      case nodeType.includes('mqtt'):
        if (!node.parameters.broker) {
          validation.requiredParameters.push('broker URL');
        }
        if (!node.parameters.topic && !node.parameters.topics) {
          validation.requiredParameters.push('topic(s)');
        }
        break;
        
      case nodeType.includes('raspberryPi'):
      case nodeType.includes('gpio'):
        if (!node.parameters.pin && !node.parameters.gpioPin) {
          validation.requiredParameters.push('GPIO pin number');
          validation.suggestions.push(
            'Specify which GPIO pin to control (e.g., pin 17 for relay control)'
          );
        }
        break;
    }
    
    // Add generic suggestion for empty parameters
    if (Object.keys(node.parameters).length === 0) {
      validation.suggestions.push(
        `Configure ${node.name} parameters based on your specific requirements`
      );
    }
  }
  
  /**
   * Validate node connections in workflow
   */
  private validateNodeConnections(node: any, workflow: any, validation: NodeValidationResult): void {
    const connections = workflow.connections || {};
    const nodeNames = (workflow.nodes || []).map((n: any) => n.name);
    
    // Check if node appears in connections (either as source or target)
    const isSource = connections[node.name];
    const isTarget = Object.values(connections).some((conn: any) => 
      conn.main?.some((outputs: any[]) => 
        outputs.some((output: any) => output.node === node.name)
      )
    );
    
    const nodeType = node.type.split('.').pop() || '';
    const isTrigger = this.nodeCategories.triggers.some(t => nodeType.includes(t));
    
    // Triggers should not have incoming connections
    if (isTrigger && isTarget) {
      validation.issues.push(
        `Trigger node '${node.name}' should not have incoming connections`
      );
    }
    
    // Non-trigger nodes should have incoming connections
    if (!isTrigger && !isTarget && nodeNames.indexOf(node.name) > 0) {
      validation.issues.push(
        `Node '${node.name}' is not connected to any previous node`
      );
      validation.suggestions.push(
        `Connect '${node.name}' to receive data from a previous node`
      );
    }
    
    // IF and Switch nodes should have multiple outputs
    if ((nodeType.includes('if') || nodeType.includes('switch')) && isSource) {
      const outputs = connections[node.name]?.main || [];
      if (outputs.length < 2) {
        validation.suggestions.push(
          `${nodeType.toUpperCase()} node should have multiple output branches for different conditions`
        );
      }
    }
  }
  
  /**
   * Perform category-specific validations
   */
  private performCategoryValidation(node: any, workflow: any, validation: NodeValidationResult): void {
    const nodeType = node.type.split('.').pop() || '';
    
    // IoT-specific validations
    if (this.isIoTNode(nodeType)) {
      if (nodeType.includes('mqtt') && node.parameters.broker) {
        validation.suggestions.push(
          'Ensure MQTT broker is accessible and credentials are configured'
        );
      }
      
      if (nodeType.includes('raspberryPi')) {
        validation.suggestions.push(
          'Note: Raspberry Pi nodes require n8n to be running on a Raspberry Pi with GPIO access'
        );
      }
    }
    
    // AI node validations
    if (this.isAINode(nodeType)) {
      validation.suggestions.push(
        'Ensure AI service credentials are configured in n8n credentials'
      );
      
      if (!node.parameters.model && nodeType.includes('openAi')) {
        validation.suggestions.push(
          'Consider specifying the AI model for consistent results'
        );
      }
    }
    
    // Database node validations
    if (this.isDatabaseNode(nodeType)) {
      if (!node.parameters.operation) {
        validation.requiredParameters.push('operation type (insert/update/select/delete)');
      }
      validation.suggestions.push(
        'Configure database credentials in n8n credentials section'
      );
    }
  }
  
  /**
   * Validate overall workflow structure
   */
  private validateWorkflowStructure(workflow: any, result: WorkflowValidationResult): void {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};
    
    // Check for trigger nodes
    const triggerNodes = nodes.filter((n: any) => 
      this.nodeCategories.triggers.some(t => n.type.includes(t))
    );
    
    if (triggerNodes.length === 0) {
      result.workflowIssues.push(
        'No trigger node found. Workflow needs at least one trigger to start execution'
      );
    }
    
    // Check for orphaned nodes
    const connectedNodes = new Set<string>();
    Object.entries(connections).forEach(([source, targets]: [string, any]) => {
      connectedNodes.add(source);
      if (targets.main) {
        targets.main.forEach((outputs: any[]) => {
          outputs.forEach((output: any) => {
            connectedNodes.add(output.node);
          });
        });
      }
    });
    
    const orphanedNodes = nodes.filter((n: any) => 
      !connectedNodes.has(n.name) && 
      !this.nodeCategories.triggers.some(t => n.type.includes(t))
    );
    
    if (orphanedNodes.length > 0) {
      result.workflowIssues.push(
        `Found ${orphanedNodes.length} disconnected nodes: ${orphanedNodes.map((n: any) => n.name).join(', ')}`
      );
    }
    
    // Check for error handling
    const hasErrorHandling = nodes.some((n: any) => n.type.includes('errorTrigger'));
    const hasExternalIntegrations = nodes.some((n: any) => 
      n.type.includes('httpRequest') || 
      n.type.includes('database') ||
      this.isExternalServiceNode(n.type)
    );
    
    if (hasExternalIntegrations && !hasErrorHandling) {
      result.improvements.push(
        'Consider adding error handling for external service failures'
      );
    }
    
    // Check for parallel branches without merge
    const parallelBranches = this.detectParallelBranches(workflow);
    if (parallelBranches.length > 0) {
      const hasMergeNode = nodes.some((n: any) => n.type.includes('merge'));
      if (!hasMergeNode) {
        result.improvements.push(
          'Detected parallel branches. Consider adding a Merge node to combine results'
        );
      }
    }
  }
  
  /**
   * Check for missing capabilities based on workflow analysis
   */
  private checkMissingCapabilities(workflow: any, result: WorkflowValidationResult): void {
    const nodes = workflow.nodes || [];
    
    // Check for data persistence
    const hasDataProcessing = nodes.some((n: any) => 
      n.type.includes('code') || n.type.includes('function')
    );
    const hasDatabase = nodes.some((n: any) => this.isDatabaseNode(n.type));
    
    if (hasDataProcessing && !hasDatabase) {
      result.missingCapabilities.push(
        'No data persistence detected. Consider adding database nodes for storing results'
      );
    }
    
    // Check for scheduling capabilities
    const hasScheduling = nodes.some((n: any) => n.type.includes('cron'));
    const workflowName = workflow.name?.toLowerCase() || '';
    
    if ((workflowName.includes('daily') || workflowName.includes('scheduled')) && !hasScheduling) {
      result.missingCapabilities.push(
        'Workflow name suggests scheduling but no Cron trigger found'
      );
    }
    
    // Check for notification capabilities
    const hasNotification = nodes.some((n: any) => 
      n.type.includes('email') || 
      n.type.includes('slack') || 
      n.type.includes('telegram')
    );
    
    if (nodes.length > 10 && !hasNotification) {
      result.missingCapabilities.push(
        'Complex workflow without notifications. Consider adding status notifications'
      );
    }
  }
  
  /**
   * Suggest general improvements
   */
  private suggestImprovements(workflow: any, result: WorkflowValidationResult): void {
    const nodes = workflow.nodes || [];
    
    // Suggest modularization for complex workflows
    if (nodes.length > 20) {
      result.improvements.push(
        'Consider breaking this workflow into sub-workflows for better maintainability'
      );
    }
    
    // Suggest wait nodes for time-sensitive operations
    const hasTimeBasedLogic = nodes.some((n: any) => 
      n.name?.toLowerCase().includes('wait') || 
      n.name?.toLowerCase().includes('delay')
    );
    const hasWaitNode = nodes.some((n: any) => n.type.includes('wait'));
    
    if (hasTimeBasedLogic && !hasWaitNode) {
      result.improvements.push(
        'Consider using Wait nodes for time-based delays instead of code-based delays'
      );
    }
    
    // Suggest data validation
    const hasExternalInput = nodes.some((n: any) => 
      n.type.includes('webhook') || 
      n.type.includes('form')
    );
    const hasValidation = nodes.some((n: any) => 
      n.type.includes('if') || 
      n.type.includes('switch') ||
      (n.parameters?.functionCode?.includes('validate') || n.parameters?.jsCode?.includes('validate'))
    );
    
    if (hasExternalInput && !hasValidation) {
      result.improvements.push(
        'Add data validation for external inputs to ensure data quality'
      );
    }
  }
  
  // Helper methods
  private getNodeCategory(nodeType: string): string | undefined {
    const type = nodeType.split('.').pop() || '';
    
    for (const [category, types] of Object.entries(this.nodeCategories)) {
      if (types.some(t => type.includes(t))) {
        return category;
      }
    }
    
    return undefined;
  }
  
  private isIoTNode(nodeType: string): boolean {
    return this.nodeCategories.iot.some(t => nodeType.includes(t));
  }
  
  private isAINode(nodeType: string): boolean {
    return this.nodeCategories.ai.some(t => nodeType.includes(t));
  }
  
  private isDatabaseNode(nodeType: string): boolean {
    return this.nodeCategories.database.some(t => nodeType.includes(t));
  }
  
  private isExternalServiceNode(nodeType: string): boolean {
    return nodeType.includes('api') || 
           nodeType.includes('http') || 
           nodeType.includes('webhook') ||
           nodeType.includes('cloud');
  }
  
  private detectParallelBranches(workflow: any): string[] {
    const connections = workflow.connections || {};
    const parallelSources: string[] = [];
    
    Object.entries(connections).forEach(([source, targets]: [string, any]) => {
      if (targets.main && targets.main[0] && targets.main[0].length > 1) {
        parallelSources.push(source);
      }
    });
    
    return parallelSources;
  }
  
  /**
   * Generate validation report
   */
  generateValidationReport(result: WorkflowValidationResult): string {
    let report = '## Workflow Validation Report\n\n';
    
    report += `**Status**: ${result.isValid ? '✅ Valid' : '❌ Has Issues'}\n\n`;
    
    if (result.nodeIssues.length > 0) {
      report += '### Node Issues\n\n';
      result.nodeIssues.forEach(nodeIssue => {
        report += `**${nodeIssue.node.name}** (${nodeIssue.node.type})\n`;
        
        if (nodeIssue.issues.length > 0) {
          report += '❌ Issues:\n';
          nodeIssue.issues.forEach(issue => report += `- ${issue}\n`);
        }
        
        if (nodeIssue.requiredParameters.length > 0) {
          report += '⚠️ Required Parameters:\n';
          nodeIssue.requiredParameters.forEach(param => report += `- ${param}\n`);
        }
        
        if (nodeIssue.suggestions.length > 0) {
          report += '💡 Suggestions:\n';
          nodeIssue.suggestions.forEach(suggestion => report += `- ${suggestion}\n`);
        }
        
        report += '\n';
      });
    }
    
    if (result.workflowIssues.length > 0) {
      report += '### Workflow Structure Issues\n\n';
      result.workflowIssues.forEach(issue => report += `- ${issue}\n`);
      report += '\n';
    }
    
    if (result.improvements.length > 0) {
      report += '### Suggested Improvements\n\n';
      result.improvements.forEach(improvement => report += `- ${improvement}\n`);
      report += '\n';
    }
    
    if (result.missingCapabilities.length > 0) {
      report += '### Missing Capabilities\n\n';
      result.missingCapabilities.forEach(capability => report += `- ${capability}\n`);
    }
    
    return report;
  }
}