// workflow-generation/advanced-prompt-parser.ts

import { QuickPromptParser } from './quick-parser.js';

export class AdvancedPromptParser extends QuickPromptParser {
  parse(detailedPrompt: string): any {
    // First use base parser
    const result = super.parse(detailedPrompt);
    
    // Enhance with advanced analysis
    this.analyzeParallelExecution(result, detailedPrompt);
    this.analyzeSwitchNodes(result, detailedPrompt);
    this.analyzeErrorHandling(result, detailedPrompt);
    
    return result;
  }
  
  private analyzeParallelExecution(result: any, prompt: string): void {
    // Look for parallel execution indicators
    const parallelPatterns = [
      /parallel\s*execution/gi,
      /parallel\s*processing/gi,
      /\(parallel\)/gi,
      /simultaneously/gi,
      /at\s*the\s*same\s*time/gi
    ];
    
    result.branches.forEach((branch: any) => {
      branch.nodes.forEach((node: any, index: number) => {
        const nodeContext = this.getNodeContext(prompt, node.name);
        
        // Check if this node or its context mentions parallel execution
        for (const pattern of parallelPatterns) {
          if (pattern.test(nodeContext)) {
            console.log(`Detected parallel execution for: ${node.name}`);
            node._parallel = true;
            
            // Try to identify parallel branches
            const parallelBranches = this.extractParallelBranches(nodeContext);
            if (parallelBranches.length > 0) {
              node._parallelBranches = parallelBranches;
            }
            break;
          }
        }
      });
    });
  }
  
  private analyzeSwitchNodes(result: any, prompt: string): void {
    result.branches.forEach((branch: any) => {
      branch.nodes.forEach((node: any) => {
        const nodeName = node.name.toLowerCase();
        const nodeDesc = (node.description || '').toLowerCase();
        
        // Enhanced switch detection
        if (nodeName.includes('switch') || 
            nodeName.includes('route') || 
            nodeName.includes('decision') ||
            nodeName.includes('evaluation') ||
            nodeDesc.includes('condition') ||
            nodeDesc.includes('branches:')) {
          
          console.log(`Detected switch/decision node: ${node.name}`);
          node._switch = true;
          
          // Extract conditions
          const conditions = this.extractSwitchConditions(prompt, node.name);
          if (conditions.length > 0) {
            node._conditions = conditions;
          }
        }
      });
    });
  }
  
  private analyzeErrorHandling(result: any, prompt: string): void {
    // Check for global error handling
    if (prompt.match(/error\s*handling/gi) || 
        prompt.match(/error\s*trigger/gi) ||
        prompt.match(/catch.*errors/gi)) {
      
      result.hasErrorHandling = true;
      
      // Add error handling requirement
      if (!result.globalRequirements) {
        result.globalRequirements = [];
      }
      
      result.globalRequirements.push({
        type: 'error-handling',
        requirement: 'Global error handling with notifications'
      });
    }
  }
  
  private getNodeContext(prompt: string, nodeName: string): string {
    // Get surrounding context for a node (±3 lines)
    const lines = prompt.split('\n');
    const nodeLineIndex = lines.findIndex(line => line.includes(nodeName));
    
    if (nodeLineIndex === -1) return '';
    
    const start = Math.max(0, nodeLineIndex - 3);
    const end = Math.min(lines.length, nodeLineIndex + 4);
    
    return lines.slice(start, end).join('\n');
  }
  
  private extractParallelBranches(context: string): string[] {
    const branches: string[] = [];
    
    // Look for payment methods
    if (context.match(/stripe/i)) branches.push('Stripe');
    if (context.match(/paypal/i)) branches.push('PayPal');
    if (context.match(/crypto/i)) branches.push('Crypto');
    
    // Look for notification channels
    if (context.match(/email/i) && context.match(/sms/i)) {
      branches.push('Email', 'SMS');
    }
    
    // Look for shipping options
    if (context.match(/dhl/i)) branches.push('DHL');
    if (context.match(/ups/i)) branches.push('UPS');
    if (context.match(/fedex/i)) branches.push('FedEx');
    
    return branches;
  }
  
  private extractSwitchConditions(prompt: string, nodeName: string): string[] {
    const conditions: string[] = [];
    const context = this.getNodeContext(prompt, nodeName);
    
    // Look for conditions pattern
    const conditionMatches = context.matchAll(/(?:condition|branch|case)s?:\s*\n((?:\s*[-*]\s*.+\n)+)/gi);
    
    for (const match of conditionMatches) {
      const conditionBlock = match[1];
      const conditionLines = conditionBlock.split('\n').filter(line => line.trim());
      
      conditionLines.forEach(line => {
        const condition = line.replace(/^\s*[-*]\s*/, '').trim();
        if (condition) {
          conditions.push(condition);
        }
      });
    }
    
    // Also check for inline conditions
    const inlineMatch = context.match(/\(([^)]+)\)/g);
    if (inlineMatch) {
      inlineMatch.forEach(match => {
        const content = match.slice(1, -1);
        if (content.includes(',')) {
          conditions.push(...content.split(',').map(c => c.trim()));
        }
      });
    }
    
    return conditions;
  }
}