// workflow-generation/workflow-analyzer.ts

import { WorkflowGenerationGuidelines } from './workflow-generation-guidelines.js';

export interface WorkflowRequirement {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  connections: string[];
  errorHandling: boolean;
  parallel: boolean;
  required: boolean;
}

export interface WorkflowPlan {
  requirements: WorkflowRequirement[];
  connections: ConnectionPlan[];
  errorHandling: ErrorHandlingPlan;
  parallelBranches: ParallelBranch[];
  missingFeatures: string[];
  workflowType?: string;
  specificGuidelines?: string[];
}

export interface ConnectionPlan {
  from: string;
  to: string;
  type: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export interface ErrorHandlingPlan {
  globalErrorNode: boolean;
  nodeErrorHandling: { [nodeId: string]: boolean };
  errorNotifications: string[];
}

export interface ParallelBranch {
  name: string;
  nodes: string[];
  mergePoint: string;
}

export class WorkflowAnalyzer {
  analyzePrompt(prompt: string): WorkflowPlan {
    console.log('WorkflowAnalyzer: Analyzing prompt for requirements...');
    
    const requirements = this.extractRequirements(prompt);
    const connections = this.extractConnections(prompt);
    const errorHandling = this.extractErrorHandling(prompt);
    const parallelBranches = this.extractParallelBranches(prompt);
    const missingFeatures = this.findMissingFeatures(prompt, requirements);
    
    // Analyze workflow type and get specific guidelines
    const workflowType = this.detectWorkflowType(prompt);
    const specificGuidelines = WorkflowGenerationGuidelines.getGuidelinesForWorkflowType(workflowType);
    console.log(`Detected workflow type: ${workflowType}`);
    console.log('Specific guidelines:', specificGuidelines);
    
    return {
      requirements,
      connections,
      errorHandling,
      parallelBranches,
      missingFeatures,
      workflowType,
      specificGuidelines
    };
  }
  
  private detectWorkflowType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('monitor') || lowerPrompt.includes('sensor') || lowerPrompt.includes('real-time')) {
      return 'monitoring';
    }
    if (lowerPrompt.includes('alert') || lowerPrompt.includes('notification') || lowerPrompt.includes('warning')) {
      return 'alert';
    }
    if (lowerPrompt.includes('report') || lowerPrompt.includes('analytics') || lowerPrompt.includes('summary')) {
      return 'report';
    }
    if (lowerPrompt.includes('sync') || lowerPrompt.includes('integration') || lowerPrompt.includes('migrate')) {
      return 'integration';
    }
    if (lowerPrompt.includes('batch') || lowerPrompt.includes('schedule') || lowerPrompt.includes('periodic')) {
      return 'batch';
    }
    
    return 'automation';
  }
  
  private extractRequirements(prompt: string): WorkflowRequirement[] {
    const requirements: WorkflowRequirement[] = [];
    
    // Extract main features from different sections
    const featurePatterns = [
      /(?:Feature|Branch|Node).*?:\s*\*\*(.+?)\*\*[\s\S]*?Purpose:\*\*\s*(.+?)$/gm,
      /(?:## User Requirements:|### Feature)[\s\S]*?-\s*(.+?)(?:\n|$)/gm,
      /\*\*Node:\*\*\s*`(.+?)`[\s\S]*?\*\*Purpose:\*\*\s*(.+?)$/gm
    ];
    
    featurePatterns.forEach(pattern => {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        const name = match[1]?.trim() || '';
        const description = match[2]?.trim() || '';
        if (name && description) {
          requirements.push({
            id: this.generateId(name),
            name,
            description,
            nodeType: this.extractNodeType(match[0]),
            connections: this.extractNodeConnections(match[0]),
            errorHandling: match[0].includes('errorTrigger') || match[0].includes('error handling'),
            parallel: match[0].includes('parallel') || match[0].includes('concurrent'),
            required: true
          });
        }
      }
    });
    
    // Add specific banking features that might be mentioned
    const bankingFeatures = [
      'AML', 'Anti-Money Laundering', 'KYC', 'sanctions', 'compliance',
      'fraud prevention', 'risk scoring', 'audit trail', 'regulatory reporting',
      'customer due diligence', 'pattern detection', 'transaction monitoring'
    ];
    
    bankingFeatures.forEach(feature => {
      const regex = new RegExp(`\\b${feature}\\b`, 'gi');
      if (regex.test(prompt) && !requirements.some(r => r.name.toLowerCase().includes(feature.toLowerCase()))) {
        requirements.push({
          id: this.generateId(feature),
          name: feature.replace(/\\b/g, '').replace(/\\/g, ''),
          description: `${feature} processing and validation`,
          nodeType: this.inferNodeType(feature),
          connections: [],
          errorHandling: true,
          parallel: false,
          required: true
        });
      }
    });
    
    return requirements;
  }
  
  private extractConnections(prompt: string): ConnectionPlan[] {
    const connections: ConnectionPlan[] = [];
    
    // Extract explicit connections
    const connectionPatterns = [
      /Connection:\s*(.+?)\s*->\s*(.+?)(?:\n|$)/gm,
      /(.+?)\s*->\s*(.+?)(?:\n|$)/gm
    ];
    
    connectionPatterns.forEach(pattern => {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        const from = match[1]?.trim();
        const to = match[2]?.trim();
        if (from && to && from !== to) {
          connections.push({
            from,
            to,
            type: this.inferConnectionType(match[0]),
            condition: this.extractCondition(match[0])
          });
        }
      }
    });
    
    return connections;
  }
  
  private extractErrorHandling(prompt: string): ErrorHandlingPlan {
    const globalErrorNode = prompt.includes('Global Error') || prompt.includes('errorTrigger');
    const errorNotifications = [];
    
    if (prompt.includes('compliance officer')) {
      errorNotifications.push('compliance officer');
    }
    if (prompt.includes('alert') || prompt.includes('notification')) {
      errorNotifications.push('system alerts');
    }
    
    return {
      globalErrorNode,
      nodeErrorHandling: {},
      errorNotifications
    };
  }
  
  private extractParallelBranches(prompt: string): ParallelBranch[] {
    const branches: ParallelBranch[] = [];
    
    // Look for parallel execution indicators
    const parallelPatterns = [
      /parallel|concurrent|simultaneously|same time/gi,
      /multiple.*branches/gi,
      /all.*branches.*merge/gi
    ];
    
    if (parallelPatterns.some(pattern => pattern.test(prompt))) {
      // Try to identify parallel sections
      const branchMatches = prompt.matchAll(/\*\*([A-Z])\.\s*(.+?)\*\*/g);
      let currentBranch: string[] = [];
      
      for (const match of branchMatches) {
        const branchName = match[2];
        if (branchName) {
          currentBranch.push(branchName);
        }
      }
      
      if (currentBranch.length > 1) {
        branches.push({
          name: 'Main Processing Branches',
          nodes: currentBranch,
          mergePoint: 'Central Merge Node'
        });
      }
    }
    
    return branches;
  }
  
  private findMissingFeatures(prompt: string, requirements: WorkflowRequirement[]): string[] {
    const missing: string[] = [];
    
    // Check for mentioned but not implemented features
    const mentionedFeatures = [
      'customer due diligence',
      'transaction freeze',
      'compliance notification',
      'audit logging',
      'regulatory reporting',
      'fraud detection',
      'risk assessment'
    ];
    
    mentionedFeatures.forEach(feature => {
      if (prompt.toLowerCase().includes(feature.toLowerCase())) {
        const implemented = requirements.some(r => 
          r.name.toLowerCase().includes(feature.toLowerCase()) ||
          r.description.toLowerCase().includes(feature.toLowerCase())
        );
        if (!implemented) {
          missing.push(feature);
        }
      }
    });
    
    return missing;
  }
  
  private extractNodeType(text: string): string {
    if (text.includes('n8n-nodes-base.')) {
      const match = text.match(/n8n-nodes-base\.([a-zA-Z]+)/);
      return match ? `n8n-nodes-base.${match[1]}` : 'n8n-nodes-base.function';
    }
    
    // Infer from context
    if (text.includes('webhook') || text.includes('trigger')) return 'n8n-nodes-base.webhook';
    if (text.includes('email') || text.includes('notification')) return 'n8n-nodes-base.emailSend';
    if (text.includes('api') || text.includes('http')) return 'n8n-nodes-base.httpRequest';
    if (text.includes('database') || text.includes('query')) return 'n8n-nodes-base.postgres';
    if (text.includes('code') || text.includes('logic')) return 'n8n-nodes-base.code';
    if (text.includes('switch') || text.includes('router')) return 'n8n-nodes-base.switch';
    if (text.includes('merge') || text.includes('combine')) return 'n8n-nodes-base.merge';
    
    return 'n8n-nodes-base.function';
  }
  
  private inferNodeType(feature: string): string {
    const nodeMapping: { [key: string]: string } = {
      'aml': 'n8n-nodes-base.code',
      'kyc': 'n8n-nodes-base.httpRequest',
      'sanctions': 'n8n-nodes-base.httpRequest',
      'compliance': 'n8n-nodes-base.emailSend',
      'fraud prevention': 'n8n-nodes-base.code',
      'risk scoring': 'n8n-nodes-base.code',
      'audit trail': 'n8n-nodes-base.postgres',
      'regulatory reporting': 'n8n-nodes-base.httpRequest',
      'customer due diligence': 'n8n-nodes-base.httpRequest',
      'pattern detection': 'n8n-nodes-base.httpRequest',
      'transaction monitoring': 'n8n-nodes-base.webhook'
    };
    
    return nodeMapping[feature.toLowerCase()] || 'n8n-nodes-base.function';
  }
  
  private extractNodeConnections(text: string): string[] {
    const connections: string[] = [];
    const connectionMatch = text.match(/Connection:\s*(.+)/);
    if (connectionMatch) {
      const parts = connectionMatch[1].split('->');
      parts.forEach(part => {
        const cleaned = part.trim();
        if (cleaned) connections.push(cleaned);
      });
    }
    return connections;
  }
  
  private inferConnectionType(text: string): 'sequential' | 'parallel' | 'conditional' {
    if (text.includes('switch') || text.includes('if') || text.includes('condition')) {
      return 'conditional';
    }
    if (text.includes('parallel') || text.includes('concurrent')) {
      return 'parallel';
    }
    return 'sequential';
  }
  
  private extractCondition(text: string): string | undefined {
    const conditionMatch = text.match(/if\s+(.+?)(?:\n|$)/i);
    return conditionMatch ? conditionMatch[1].trim() : undefined;
  }
  
  private generateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
}

export class WorkflowValidator {
  validateImplementation(plan: WorkflowPlan, workflow: any): ValidationResult {
    const issues: ValidationIssue[] = [];
    const missing: string[] = [];
    const implemented: string[] = [];
    
    // Check if all requirements are implemented
    plan.requirements.forEach(req => {
      const found = workflow.nodes.some((node: any) => 
        node.name.toLowerCase().includes(req.name.toLowerCase()) ||
        node.type === req.nodeType
      );
      
      if (found) {
        implemented.push(req.name);
      } else if (req.required) {
        missing.push(req.name);
        issues.push({
          type: 'missing_feature',
          severity: 'error',
          message: `Required feature "${req.name}" not implemented`,
          suggestion: `Add ${req.nodeType} node for ${req.name}`
        });
      }
    });
    
    // Check error handling
    if (plan.errorHandling.globalErrorNode) {
      const hasErrorTrigger = workflow.nodes.some((node: any) => 
        node.type === 'n8n-nodes-base.errorTrigger'
      );
      if (!hasErrorTrigger) {
        issues.push({
          type: 'missing_error_handling',
          severity: 'warning',
          message: 'Global error handling not implemented',
          suggestion: 'Add n8n-nodes-base.errorTrigger node'
        });
      }
    }
    
    // Check parallel branches
    if (plan.parallelBranches.length > 0) {
      const hasMergeNode = workflow.nodes.some((node: any) => 
        node.type === 'n8n-nodes-base.merge'
      );
      if (!hasMergeNode) {
        issues.push({
          type: 'missing_merge',
          severity: 'warning',
          message: 'Parallel branches detected but no merge node found',
          suggestion: 'Add n8n-nodes-base.merge node to combine parallel results'
        });
      }
    }
    
    // Calculate score safely to avoid NaN
    const totalRequirements = plan.requirements.length;
    const score = totalRequirements > 0 ? implemented.length / totalRequirements : 1.0;
    
    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: score,
      issues,
      missing,
      implemented,
      recommendations: this.generateRecommendations(plan, workflow)
    };
  }
  
  private generateRecommendations(plan: WorkflowPlan, workflow: any): string[] {
    const recommendations: string[] = [];
    
    // Missing features
    if (plan.missingFeatures.length > 0) {
      recommendations.push(`Add missing features: ${plan.missingFeatures.join(', ')}`);
    }
    
    // Error handling
    if (plan.errorHandling.globalErrorNode && !workflow.nodes.some((n: any) => n.type === 'n8n-nodes-base.errorTrigger')) {
      recommendations.push('Add global error trigger node');
    }
    
    // Parallel processing
    if (plan.parallelBranches.length > 0) {
      recommendations.push('Consider implementing parallel branches for better performance');
    }
    
    return recommendations;
  }
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  missing: string[];
  implemented: string[];
  recommendations: string[];
}

export interface ValidationIssue {
  type: 'missing_feature' | 'missing_error_handling' | 'missing_merge' | 'connection_error';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
}