// workflow-generation/quick-parser.ts

import { findBestNode } from './n8n-node-catalog.js';
import { SemanticNodeMatcher } from './semantic-node-matcher.js';

export class QuickPromptParser {
  private semanticMatcher: SemanticNodeMatcher;

  constructor() {
    this.semanticMatcher = new SemanticNodeMatcher();
  }

  parse(detailedPrompt: string): any {
    console.log('QuickPromptParser: Starting to parse prompt...');
    
    // First, try to extract only the relevant workflow section
    // Stop at any secondary workflow definitions
    let relevantPrompt = detailedPrompt;
    
    // Check if there's a secondary workflow definition and cut it off
    // Look for patterns that indicate a new workflow is starting
    const secondaryPatterns = [
      /\n#{1,2}\s+(?!##)(?!Expected)(?!Required)(?!Workflow)(?!Additional)[A-Z][^#\n]+\n\n[A-Z][^#\n]+/,
      /\n\*\*Required Integrations:\*\*[^\n]+\n\*\*Error Handling:[^\n]+\n+### BRANCH/,
      /\n### ⚠️ Otomatik Sistem Uyarısı:/,
      /\nBu node'ları workflow'a eklemeyi düşünebilirsiniz\.\n+\*\*Required Integrations:/,
      /\n\n\n\n\*\*Required Integrations:\*\*/  // Multiple newlines before new workflow
    ];
    
    let earliestIndex = detailedPrompt.length;
    for (const pattern of secondaryPatterns) {
      const match = detailedPrompt.match(pattern);
      if (match && match.index && match.index < earliestIndex) {
        earliestIndex = match.index;
        console.log(`Found secondary pattern at index ${match.index}: ${pattern.source.substring(0, 50)}...`);
      }
    }
    
    if (earliestIndex < detailedPrompt.length) {
      console.log('Truncating prompt at secondary workflow definition...');
      relevantPrompt = detailedPrompt.substring(0, earliestIndex);
    }
    
    const branches = [];
    
    // First try to parse BRANCH format
    const branchMatches = relevantPrompt.matchAll(/### BRANCH \d+: (.+?)(?=### BRANCH|## Additional|$)/gs);
    
    let branchIndex = 0;
    for (const match of branchMatches) {
      branchIndex++;
      const branchText = match[0];
      const branchName = match[1].trim();
      console.log(`Parsing branch ${branchIndex}: ${branchName}`);
      
      const nodes = [];
      
      // Extract trigger
      const triggerMatch = branchText.match(/\*\*Trigger:\*\*\s*(.+?)$/m);
      const triggerType = triggerMatch ? triggerMatch[1].toLowerCase() : 'webhook';
      console.log(`  Trigger type: ${triggerType}`);
      
      // Extract nodes from Processing Flow section
      const flowMatch = branchText.match(/\*\*Processing Flow:\*\*([\s\S]*?)(?=\*\*|$)/);
      if (flowMatch) {
        const flowText = flowMatch[1];
        const nodeMatches = flowText.matchAll(/^\d+\.\s+(.+?)$/gm);
        
        for (const nodeMatch of nodeMatches) {
          const fullNodeText = nodeMatch[1];
          const nodeName = fullNodeText.split('(')[0].trim();
          const nodeType = this.guessNodeType(fullNodeText);
          
          console.log(`  Found node: "${nodeName}" -> ${nodeType}`);
          
          nodes.push({
            name: nodeName,
            type: nodeType,
            description: fullNodeText
          });
        }
      }
      
      branches.push({ 
        name: branchName,
        triggerType,
        nodes 
      });
      
      console.log(`  Total nodes in branch: ${nodes.length}`);
    }
    
    // If no branches found, try to parse numbered list format
    if (branches.length === 0) {
      console.log('No BRANCH format found, trying numbered list format...');
      
      // Parse workflow steps in the format:
      // 1. **Step Name**
      //    - **Node Type:** type
      //    - **Node:** description
      const nodes = [];
      let currentStep = null;
      
      const lines = relevantPrompt.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for numbered step
        const stepMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*/);
        if (stepMatch) {
          const stepNumber = stepMatch[1];
          const stepName = stepMatch[2].trim();
          
          console.log(`Found step ${stepNumber}: "${stepName}"`);
          
          // Look ahead for node details
          let nodeType = null;
          let nodeDescription = '';
          
          // Check next few lines for node details
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const detailLine = lines[j].trim();
            
            // Look for Node Type
            const typeMatch = detailLine.match(/\*\*Node Type:\*\*\s*(.+?)$/);
            if (typeMatch) {
              nodeType = typeMatch[1].trim();
              if (!nodeType.includes('.')) {
                nodeType = `n8n-nodes-base.${nodeType.toLowerCase().replace('n8n-nodes-base.', '')}`;
              }
            }
            
            // Look for Node description
            const nodeMatch = detailLine.match(/\*\*Node:\*\*\s*(.+?)$/);
            if (nodeMatch) {
              nodeDescription = nodeMatch[1].trim();
            }
            
            // Stop if we hit another numbered item
            if (detailLine.match(/^\d+\./)) break;
          }
          
          // Skip trigger nodes as they'll be added separately
          if (stepName.toLowerCase().includes('trigger') || 
              stepName.toLowerCase().includes('order received')) {
            continue;
          }
          
          // If no explicit node type, guess from name
          if (!nodeType) {
            nodeType = this.guessNodeType(stepName + ' ' + nodeDescription);
          }
          
          nodes.push({
            name: stepName,
            type: nodeType,
            description: nodeDescription || stepName
          });
        }
      }
      
      // If we found nodes, create a single branch
      if (nodes.length > 0) {
        branches.push({
          name: 'Main Workflow',
          triggerType: 'webhook',
          nodes
        });
        console.log(`Created main branch with ${nodes.length} nodes`);
      }
    }
    
    // Extract workflow name
    const workflowName = relevantPrompt.match(/^#{1,2}\s+(.+?)$/m)?.[1] || 
                        relevantPrompt.match(/Name:\s*(.+?)$/m)?.[1] || 
                        'Workflow';
    
    // Extract expected complexity
    const complexityMatch = relevantPrompt.match(/Expected Complexity:\s*(\d+)-(\d+)\s*nodes/i);
    const expectedComplexity = complexityMatch ? {
      min: parseInt(complexityMatch[1]),
      max: parseInt(complexityMatch[2])
    } : null;
    
    console.log(`Parsed workflow: ${workflowName}`);
    console.log(`Expected complexity: ${expectedComplexity?.min}-${expectedComplexity?.max} nodes`);
    console.log(`Total branches: ${branches.length}`);
    
    return {
      workflowName,
      branches,
      expectedComplexity
    };
  }
  
  private guessNodeType(nodeText: string): string {
    // First try semantic matching for intelligent node selection
    const semanticMatch = this.semanticMatcher.findBestNodeType(nodeText);
    if (semanticMatch.confidence > 0.5) {
      console.log(`    Semantic match: "${nodeText}" -> ${semanticMatch.nodeType} (confidence: ${semanticMatch.confidence.toFixed(2)})`);
      console.log(`      Reasoning: ${semanticMatch.reasoning}`);
      if (semanticMatch.alternativeNodes && semanticMatch.alternativeNodes.length > 0) {
        console.log(`      Alternatives: ${semanticMatch.alternativeNodes.join(', ')}`);
      }
      return semanticMatch.nodeType;
    }
    
    // Fallback to catalog-based matching
    const bestMatch = findBestNode(nodeText);
    if (bestMatch) {
      console.log(`    Catalog match: "${nodeText}" -> ${bestMatch.type} (${bestMatch.category})`);
      return bestMatch.type;
    }
    
    // Final fallback to basic pattern matching for edge cases
    const lower = nodeText.toLowerCase();
    
    // Special cases that might not match well with catalog
    if (lower.includes('central router') || lower.includes('route based on')) {
      return 'n8n-nodes-base.switch';
    }
    
    if (lower.includes('collect') && lower.includes('results')) {
      return 'n8n-nodes-base.merge';
    }
    
    // Check if semantic match had low confidence alternatives
    if (semanticMatch.alternativeNodes && semanticMatch.alternativeNodes.length > 0) {
      console.log(`    Using low-confidence semantic match: ${semanticMatch.nodeType} (confidence: ${semanticMatch.confidence.toFixed(2)})`);
      return semanticMatch.nodeType;
    }
    
    // Default to function node for complex operations
    console.log(`    No confident match for: "${nodeText}", using function node`);
    return 'n8n-nodes-base.function';
  }
}