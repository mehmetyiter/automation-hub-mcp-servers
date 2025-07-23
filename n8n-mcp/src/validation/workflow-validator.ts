import { n8nNodeCatalog } from '../workflow-generation/n8n-node-catalog.js';
import { FeedbackData } from '../learning/types.js';
import { FeedbackCollector } from '../learning/feedback-collector.js';

export interface ValidationIssue {
  nodeId: string;
  nodeName: string;
  issueType: 'invalid_node_type' | 'missing_credentials' | 'disconnected_node' | 'invalid_connection' | 'duplicate_credential';
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  nodeStats: {
    total: number;
    valid: number;
    invalid: number;
    byType: Record<string, number>;
  };
  credentialStats: {
    required: string[];
    duplicates: string[];
  };
}

export class WorkflowValidator {
  private feedbackCollector: FeedbackCollector;
  
  constructor(feedbackCollector?: FeedbackCollector) {
    this.feedbackCollector = feedbackCollector || new FeedbackCollector();
  }

  async validateWorkflow(workflow: any, workflowId?: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const nodeTypeCount: Record<string, number> = {};
    const credentialTypes = new Set<string>();
    const credentialUsage: Record<string, number> = {};
    
    let validNodeCount = 0;
    let invalidNodeCount = 0;

    // 1. Validate each node
    if (workflow.nodes && Array.isArray(workflow.nodes)) {
      for (const node of workflow.nodes) {
        const nodeValidation = this.validateNode(node);
        
        if (nodeValidation.isValid) {
          validNodeCount++;
          // Count node types
          nodeTypeCount[node.type] = (nodeTypeCount[node.type] || 0) + 1;
        } else {
          invalidNodeCount++;
          issues.push(...nodeValidation.issues);
        }
        
        warnings.push(...nodeValidation.warnings);
        
        // Check credentials
        if (node.credentials) {
          Object.keys(node.credentials).forEach(credType => {
            credentialTypes.add(credType);
            credentialUsage[credType] = (credentialUsage[credType] || 0) + 1;
          });
        }
      }
    }

    // 2. Check for disconnected nodes
    const disconnectedNodes = this.findDisconnectedNodes(workflow);
    disconnectedNodes.forEach(node => {
      issues.push({
        nodeId: node.id || 'unknown',
        nodeName: node.name || 'Unknown Node',
        issueType: 'disconnected_node',
        severity: 'error',
        message: `Node "${node.name}" is not connected to the workflow`,
        suggestion: 'Connect this node to other nodes in the workflow'
      });
    });

    // 3. Check for duplicate credentials
    const duplicateCredentials = Object.entries(credentialUsage)
      .filter(([_, count]) => count > 3) // More than 3 uses might indicate duplication
      .map(([type]) => type);

    duplicateCredentials.forEach(credType => {
      warnings.push({
        nodeId: 'workflow',
        nodeName: 'Workflow',
        issueType: 'duplicate_credential',
        severity: 'warning',
        message: `Credential type "${credType}" is used ${credentialUsage[credType]} times`,
        suggestion: 'Consider using a single credential instance for all nodes of the same type'
      });
    });

    // 4. Check for common anti-patterns
    const antiPatterns = this.detectAntiPatterns(workflow, nodeTypeCount);
    warnings.push(...antiPatterns);

    const result: ValidationResult = {
      isValid: issues.length === 0,
      issues,
      warnings,
      nodeStats: {
        total: validNodeCount + invalidNodeCount,
        valid: validNodeCount,
        invalid: invalidNodeCount,
        byType: nodeTypeCount
      },
      credentialStats: {
        required: Array.from(credentialTypes),
        duplicates: duplicateCredentials
      }
    };

    // 5. Automatically record issues to learning system
    if (workflowId && issues.length > 0) {
      await this.recordIssuesToLearningSystem(workflowId, workflow, result);
    }

    return result;
  }

  private validateNode(node: any): { isValid: boolean; issues: ValidationIssue[]; warnings: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Check if node type is valid
    if (!node.type) {
      issues.push({
        nodeId: node.id || 'unknown',
        nodeName: node.name || 'Unknown Node',
        issueType: 'invalid_node_type',
        severity: 'error',
        message: 'Node has no type specified'
      });
      return { isValid: false, issues, warnings };
    }

    // Check against catalog
    const isValidType = this.isValidNodeType(node.type);
    if (!isValidType) {
      // Try to find correct type
      const suggestion = this.suggestCorrectNodeType(node.type, node.name);
      
      issues.push({
        nodeId: node.id || 'unknown',
        nodeName: node.name || 'Unknown Node',
        issueType: 'invalid_node_type',
        severity: 'error',
        message: `Invalid node type: ${node.type}`,
        suggestion: suggestion ? `Use ${suggestion} instead` : undefined
      });
    }

    // Check for common naming issues
    if (node.name) {
      const namingIssue = this.checkNodeNaming(node.name, node.type);
      if (namingIssue) {
        warnings.push(namingIssue);
      }
    }

    return { isValid: isValidType, issues, warnings };
  }

  private isValidNodeType(nodeType: string): boolean {
    // Check if it's in our catalog
    if (n8nNodeCatalog[nodeType]) {
      return true;
    }

    // Check common valid patterns not in catalog
    const validPatterns = [
      /^n8n-nodes-base\./,
      /^n8n-nodes-/,
      /^@[^/]+\/n8n-nodes-/
    ];

    return validPatterns.some(pattern => pattern.test(nodeType));
  }

  private suggestCorrectNodeType(invalidType: string, nodeName?: string): string | null {
    // Common mistakes mapping - EXPANDED
    const commonMistakes: Record<string, string> = {
      // Error handling
      'errorWorkflow': 'n8n-nodes-base.errorTrigger',
      'errorTrigger': 'n8n-nodes-base.errorTrigger',
      'n8n-nodes-base.errorWorkflow': 'n8n-nodes-base.errorTrigger',
      
      // Email nodes
      'emailSend': 'n8n-nodes-base.sendEmail',
      'emailSendSmtp': 'n8n-nodes-base.sendEmail',
      'n8n-nodes-base.emailSend': 'n8n-nodes-base.sendEmail',
      'n8n-nodes-base.emailSendSmtp': 'n8n-nodes-base.sendEmail',
      
      // Database nodes
      'mongoDb': 'n8n-nodes-base.mongoDb',
      'mongodb': 'n8n-nodes-base.mongoDb',
      
      // HTTP nodes
      'httpGet': 'n8n-nodes-base.httpRequest',
      'httpPost': 'n8n-nodes-base.httpRequest',
      'apiRequest': 'n8n-nodes-base.httpRequest',
      
      // WhatsApp
      'whatsApp': 'n8n-nodes-base.whatsappBusiness',
      'whatsapp': 'n8n-nodes-base.whatsappBusiness'
    };

    // Direct mapping
    if (commonMistakes[invalidType]) {
      return commonMistakes[invalidType];
    }

    // Try to infer from node name
    if (nodeName) {
      const nameLower = nodeName.toLowerCase();
      
      if (nameLower.includes('error') && nameLower.includes('trigger')) {
        return 'n8n-nodes-base.errorTrigger';
      }
      
      if (nameLower.includes('email') || nameLower.includes('mail')) {
        return 'n8n-nodes-base.sendEmail';
      }
      
      if (nameLower.includes('record') || nameLower.includes('log') || 
          nameLower.includes('store') || nameLower.includes('save')) {
        return 'n8n-nodes-base.httpRequest';
      }
    }

    return null;
  }

  private checkNodeNaming(nodeName: string, nodeType: string): ValidationIssue | null {
    const nameLower = nodeName.toLowerCase();
    
    // Check for misleading names
    if ((nameLower.includes('email') || nameLower.includes('send')) && 
        !nodeType.includes('email') && !nodeType.includes('send')) {
      return {
        nodeId: 'naming',
        nodeName: nodeName,
        issueType: 'invalid_node_type',
        severity: 'warning',
        message: `Node named "${nodeName}" but type is ${nodeType}`,
        suggestion: 'Node name and type should match'
      };
    }

    return null;
  }

  private findDisconnectedNodes(workflow: any): any[] {
    const disconnected: any[] = [];
    
    if (!workflow.nodes || !workflow.connections) {
      return disconnected;
    }

    const nodesByName = new Map<string, any>();
    const nodesById = new Map<string, any>();
    
    // Create lookup maps
    workflow.nodes.forEach((node: any) => {
      if (node.name) nodesByName.set(node.name, node);
      if (node.id) nodesById.set(node.id, node);
    });
    
    // Check each node for connections
    workflow.nodes.forEach((node: any) => {
      const isTrigger = node.type && (
        node.type.includes('Trigger') || 
        node.type.includes('trigger') ||
        node.type.includes('cron') ||
        node.type.includes('webhook') ||
        node.type.includes('schedule')
      );
      
      // Check if node has incoming connections
      let hasIncomingConnection = false;
      Object.entries(workflow.connections).forEach(([sourceNode, targets]: [string, any]) => {
        if (targets.main && Array.isArray(targets.main)) {
          targets.main.forEach((targetGroup: any[]) => {
            if (Array.isArray(targetGroup)) {
              targetGroup.forEach((connection: any) => {
                if (connection.node === node.name || connection.node === node.id) {
                  hasIncomingConnection = true;
                }
              });
            }
          });
        }
      });
      
      // Check if node has outgoing connections
      const hasOutgoingConnection = workflow.connections[node.name] || workflow.connections[node.id];
      
      // Determine if node is disconnected
      if (isTrigger) {
        // Triggers only need outgoing connections
        if (!hasOutgoingConnection) {
          disconnected.push(node);
        }
      } else if (node.type === 'n8n-nodes-base.respondToWebhook') {
        // Webhook response only needs incoming connections
        if (!hasIncomingConnection) {
          disconnected.push(node);
        }
      } else {
        // Regular nodes need either incoming or outgoing (or both)
        if (!hasIncomingConnection && !hasOutgoingConnection) {
          disconnected.push(node);
        }
      }
    });

    return disconnected;
  }

  private detectAntiPatterns(workflow: any, nodeTypeCount: Record<string, number>): ValidationIssue[] {
    const warnings: ValidationIssue[] = [];

    // Check for MongoDB overuse
    const mongoCount = nodeTypeCount['n8n-nodes-base.mongoDb'] || 0;
    if (mongoCount > 5) {
      warnings.push({
        nodeId: 'pattern',
        nodeName: 'Workflow Pattern',
        issueType: 'invalid_node_type',
        severity: 'warning',
        message: `Excessive MongoDB usage (${mongoCount} nodes)`,
        suggestion: 'Consider using HTTP Request for simple logging/recording operations'
      });
    }

    // Check for missing error handling
    const hasErrorTrigger = nodeTypeCount['n8n-nodes-base.errorTrigger'] || 0;
    if (workflow.nodes && workflow.nodes.length > 20 && hasErrorTrigger === 0) {
      warnings.push({
        nodeId: 'pattern',
        nodeName: 'Workflow Pattern',
        issueType: 'missing_credentials',
        severity: 'warning',
        message: 'Complex workflow without error handling',
        suggestion: 'Add Error Trigger node for better error management'
      });
    }

    // Check for too many parallel branches without merge
    const switchCount = (nodeTypeCount['n8n-nodes-base.switch'] || 0) + 
                       (nodeTypeCount['n8n-nodes-base.if'] || 0);
    const mergeCount = nodeTypeCount['n8n-nodes-base.merge'] || 0;
    
    if (switchCount > 3 && mergeCount === 0) {
      warnings.push({
        nodeId: 'pattern',
        nodeName: 'Workflow Pattern',
        issueType: 'invalid_connection',
        severity: 'warning',
        message: 'Multiple branches without merge nodes',
        suggestion: 'Use Merge nodes to combine results from parallel branches'
      });
    }

    return warnings;
  }

  private async recordIssuesToLearningSystem(
    workflowId: string, 
    workflow: any, 
    validationResult: ValidationResult
  ): Promise<void> {
    // Create feedback based on validation issues
    const feedback: Partial<FeedbackData> = {
      workflowId: workflowId,
      workflowType: 'validation',
      outcome: validationResult.isValid ? 'success' : 'failure',
      nodeCount: validationResult.nodeStats.total,
      errorMessage: validationResult.issues.map(i => i.message).join('; '),
      improvements: validationResult.issues.map(i => i.suggestion || i.message)
    };

    try {
      await this.feedbackCollector.collectFeedback(feedback as FeedbackData);
      console.log(`Validation issues recorded for workflow ${workflowId}`);
    } catch (error) {
      console.error('Failed to record validation issues:', error);
    }
  }
}