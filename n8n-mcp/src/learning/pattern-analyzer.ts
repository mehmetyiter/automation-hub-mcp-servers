import { FeedbackData, WorkflowPattern, GenerationRecord } from './types.js';

export class PatternAnalyzer {
  analyzePatterns(feedbacks: FeedbackData[], generations: GenerationRecord[]): WorkflowPattern[] {
    const patterns: Map<string, WorkflowPattern> = new Map();
    
    // Group by workflow type
    const typeGroups = this.groupByType(feedbacks);
    
    typeGroups.forEach((group, type) => {
      const successful = group.filter(f => f.outcome === 'success');
      const failed = group.filter(f => f.outcome === 'failure');
      
      const pattern: WorkflowPattern = {
        type,
        frequency: group.length,
        successRate: successful.length / group.length,
        commonConfigurations: this.extractCommonConfigurations(successful, generations),
        commonErrors: this.extractCommonErrors(failed)
      };
      
      patterns.set(type, pattern);
    });
    
    // Add workflow structure patterns
    this.addStructurePatterns(patterns, generations);
    
    return Array.from(patterns.values());
  }
  
  private groupByType(feedbacks: FeedbackData[]): Map<string, FeedbackData[]> {
    const groups = new Map<string, FeedbackData[]>();
    
    feedbacks.forEach(feedback => {
      const group = groups.get(feedback.workflowType) || [];
      group.push(feedback);
      groups.set(feedback.workflowType, group);
    });
    
    return groups;
  }
  
  private extractCommonConfigurations(
    successful: FeedbackData[], 
    generations: GenerationRecord[]
  ): any[] {
    const configurations: any[] = [];
    
    // Find common node sequences in successful workflows
    const nodeSequences = new Map<string, number>();
    
    successful.forEach(feedback => {
      const generation = generations.find(g => 
        g.prompt.toLowerCase().includes(feedback.prompt.toLowerCase())
      );
      
      if (generation && generation.workflow && generation.workflow.nodes) {
        const sequence = generation.workflow.nodes
          .map((n: any) => n.type)
          .join(' -> ');
        
        const count = nodeSequences.get(sequence) || 0;
        nodeSequences.set(sequence, count + 1);
      }
    });
    
    // Extract most common sequences
    const sortedSequences = Array.from(nodeSequences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    sortedSequences.forEach(([sequence, count]) => {
      if (count > 1) {
        configurations.push({
          type: 'node_sequence',
          value: sequence,
          frequency: count
        });
      }
    });
    
    return configurations;
  }
  
  private extractCommonErrors(failed: FeedbackData[]): string[] {
    const errorMap = new Map<string, number>();
    
    failed.forEach(feedback => {
      if (feedback.errorMessage) {
        const error = this.normalizeError(feedback.errorMessage);
        const count = errorMap.get(error) || 0;
        errorMap.set(error, count + 1);
      }
    });
    
    return Array.from(errorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
  }
  
  private normalizeError(error: string): string {
    // Normalize common error patterns
    if (error.includes('disconnected') || error.includes('not connected')) {
      return 'Disconnected nodes';
    }
    if (error.includes('merge') && error.includes('input')) {
      return 'Merge node missing inputs';
    }
    if (error.includes('credential') || error.includes('authentication')) {
      return 'Missing credentials';
    }
    if (error.includes('timeout')) {
      return 'Operation timeout';
    }
    if (error.includes('rate limit')) {
      return 'Rate limit exceeded';
    }
    
    // Return first 50 chars of unique errors
    return error.substring(0, 50) + '...';
  }
  
  private addStructurePatterns(
    patterns: Map<string, WorkflowPattern>, 
    generations: GenerationRecord[]
  ): void {
    // Analyze common workflow structures
    const structures = {
      linear: 0,
      branching: 0,
      loop: 0,
      parallel: 0,
      complex: 0
    };
    
    generations.forEach(gen => {
      if (gen.workflow && gen.workflow.nodes && gen.workflow.connections) {
        const nodeCount = gen.workflow.nodes.length;
        // Fix: connections is an object, not an array
        const connectionCount = Object.keys(gen.workflow.connections || {}).length;
        
        // Detect structure type
        if (connectionCount === nodeCount - 1) {
          structures.linear++;
        } else if (gen.workflow.nodes.some((n: any) => n.type === 'n8n-nodes-base.switch')) {
          structures.branching++;
        } else if (gen.workflow.nodes.some((n: any) => n.type === 'n8n-nodes-base.splitInBatches')) {
          structures.loop++;
        } else if (connectionCount > nodeCount) {
          structures.parallel++;
        } else {
          structures.complex++;
        }
      }
    });
    
    // Add structure patterns
    Object.entries(structures).forEach(([structure, count]) => {
      if (count > 0) {
        patterns.set(`structure_${structure}`, {
          type: `structure_${structure}`,
          frequency: count,
          successRate: 0.7, // Would need actual success data
          commonConfigurations: [],
          commonErrors: []
        });
      }
    });
  }
  
  detectMergeNodeIssue(generations: GenerationRecord[]): number {
    let mergeIssueCount = 0;
    
    generations.forEach(gen => {
      if (gen.workflow && gen.workflow.nodes && gen.workflow.connections) {
        const mergeNodes = gen.workflow.nodes.filter((n: any) => 
          n.type === 'n8n-nodes-base.merge'
        );
        
        mergeNodes.forEach((mergeNode: any) => {
          // Count inputs to merge node (connections is an object, not array)
          let inputCount = 0;
          Object.values(gen.workflow.connections || {}).forEach((conns: any) => {
            if (Array.isArray(conns)) {
              conns.forEach((conn: any) => {
                if (conn.node === mergeNode.id) {
                  inputCount++;
                }
              });
            }
          });
          
          // Check if merge node has too many direct connections
          if (inputCount > 2) {
            mergeIssueCount++;
          }
        });
      }
    });
    
    return mergeIssueCount;
  }
}