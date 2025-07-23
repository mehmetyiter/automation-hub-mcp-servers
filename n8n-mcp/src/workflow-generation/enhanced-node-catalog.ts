// enhanced-node-catalog.ts
// Enhanced catalog with semantic matching and capability registry

import { SemanticNodeMatcher, NodeMatchResult } from './semantic-node-matcher.js';
import { NodeCapabilityRegistry } from './node-capability-registry.js';
import { n8nNodeCatalog, NodeDefinition } from './n8n-node-catalog.js';

export interface EnhancedNodeSelection {
  nodeType: string;
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
  alternatives?: Array<{
    nodeType: string;
    confidence: number;
  }>;
}

export class EnhancedNodeCatalog {
  private static instance: EnhancedNodeCatalog;
  private semanticMatcher = new SemanticNodeMatcher();
  private capabilityRegistry = new NodeCapabilityRegistry();
  
  public static getInstance(): EnhancedNodeCatalog {
    if (!EnhancedNodeCatalog.instance) {
      EnhancedNodeCatalog.instance = new EnhancedNodeCatalog();
    }
    return EnhancedNodeCatalog.instance;
  }

  /**
   * Find the best node for a given description with parameters
   */
  public findBestNode(
    description: string, 
    context?: any
  ): EnhancedNodeSelection {
    console.log(`Finding best node for: "${description}"`);
    
    // First try semantic matching
    const semanticMatch = this.semanticMatcher.findBestNodeType(description, context);
    
    // If semantic match has high confidence, use it
    if (semanticMatch.confidence > 0.7) {
      return this.createEnhancedSelection(semanticMatch, context);
    }
    
    // Otherwise, try capability-based matching
    const capabilityMatch = this.findByCapability(description);
    if (capabilityMatch) {
      return capabilityMatch;
    }
    
    // Fall back to original catalog search
    const catalogMatch = this.searchInCatalog(description);
    if (catalogMatch) {
      return this.convertCatalogMatch(catalogMatch, description);
    }
    
    // Use semantic match even with lower confidence
    return this.createEnhancedSelection(semanticMatch, context);
  }

  /**
   * Find node by capability requirements
   */
  private findByCapability(description: string): EnhancedNodeSelection | null {
    const normalizedDesc = description.toLowerCase();
    
    // Extract capability hints
    const capabilities = this.extractCapabilities(normalizedDesc);
    
    if (capabilities.length === 0) {
      return null;
    }
    
    // Find nodes that can handle these capabilities
    const candidateNodes = new Map<string, number>();
    
    for (const capability of capabilities) {
      const nodes = this.capabilityRegistry.findNodesByCapability(capability);
      for (const node of nodes) {
        candidateNodes.set(node, (candidateNodes.get(node) || 0) + 1);
      }
    }
    
    // Sort by match count
    const sortedNodes = Array.from(candidateNodes.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedNodes.length === 0) {
      return null;
    }
    
    const bestNode = sortedNodes[0][0];
    const parameters = this.generateParameters(bestNode, description);
    
    return {
      nodeType: bestNode,
      parameters,
      confidence: Math.min(sortedNodes[0][1] / capabilities.length, 1),
      reasoning: `Matched ${sortedNodes[0][1]} out of ${capabilities.length} capabilities`,
      alternatives: sortedNodes.slice(1, 3).map(([nodeType, count]) => ({
        nodeType,
        confidence: count / capabilities.length
      }))
    };
  }

  /**
   * Extract capabilities from description
   */
  private extractCapabilities(description: string): string[] {
    const capabilities: string[] = [];
    
    // IoT and hardware patterns
    if (/\b(sensor|iot|device|telemetry|mqtt)\b/i.test(description)) {
      capabilities.push('iot_communication', 'sensor_data');
    }
    if (/\b(gpio|pin|relay|actuator|control physical|hardware)\b/i.test(description)) {
      capabilities.push('gpio_control', 'hardware_interface');
    }
    
    // Communication patterns
    if (/\b(sms|text message|urgent alert|mobile)\b/i.test(description)) {
      capabilities.push('sms_sending', 'urgent_alerts');
    }
    if (/\b(whatsapp|instant message|chat)\b/i.test(description)) {
      capabilities.push('instant_messaging', 'customer_communication');
    }
    
    // Timing patterns
    if (/\b(schedule|cron|timer|periodic|hourly|daily|weekly)\b/i.test(description)) {
      capabilities.push('scheduled_execution', 'time_based_triggers');
    }
    
    // Data processing patterns
    if (/\b(transform|process|calculate|analyze|custom logic)\b/i.test(description)) {
      capabilities.push('data_processing', 'custom_logic');
    }
    
    return [...new Set(capabilities)];  // Remove duplicates
  }

  /**
   * Search in the original catalog
   */
  private searchInCatalog(description: string): NodeDefinition | null {
    const normalizedDesc = description.toLowerCase();
    let bestMatch: { node: NodeDefinition; score: number } | null = null;
    
    for (const [nodeType, nodeDef] of Object.entries(n8nNodeCatalog)) {
      let score = 0;
      
      // Check common names
      for (const name of nodeDef.commonNames) {
        if (normalizedDesc.includes(name)) {
          score += 10;
        }
      }
      
      // Check use cases
      for (const useCase of nodeDef.useCases) {
        const words = useCase.split(' ');
        let matchCount = 0;
        for (const word of words) {
          if (normalizedDesc.includes(word)) {
            matchCount++;
          }
        }
        if (matchCount >= words.length * 0.5) {
          score += 5;
        }
      }
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { node: nodeDef, score };
      }
    }
    
    return bestMatch?.node || null;
  }

  /**
   * Create enhanced selection from semantic match
   */
  private createEnhancedSelection(
    semanticMatch: NodeMatchResult,
    context?: any
  ): EnhancedNodeSelection {
    const parameters = this.generateParameters(semanticMatch.nodeType, context?.description || '');
    
    return {
      nodeType: semanticMatch.nodeType,
      parameters,
      confidence: semanticMatch.confidence,
      reasoning: semanticMatch.reasoning,
      alternatives: semanticMatch.alternativeNodes?.map(nodeType => ({
        nodeType,
        confidence: 0.5  // Default lower confidence for alternatives
      }))
    };
  }

  /**
   * Convert catalog match to enhanced selection
   */
  private convertCatalogMatch(
    catalogNode: NodeDefinition,
    description: string
  ): EnhancedNodeSelection {
    const parameters = this.generateParameters(catalogNode.type, description);
    
    return {
      nodeType: catalogNode.type,
      parameters,
      confidence: 0.6,  // Moderate confidence for catalog matches
      reasoning: `Matched from node catalog based on use cases`,
      alternatives: []
    };
  }

  /**
   * Generate parameters for a node based on context
   */
  public generateParameters(
    nodeType: string,
    description: string
  ): Record<string, any> {
    const defaults = this.capabilityRegistry.getParameterDefaults(nodeType);
    const required = this.capabilityRegistry.getRequiredParameters(nodeType);
    const parameters = { ...defaults, ...required };
    
    // Special handling for specific node types
    switch (nodeType) {
      case 'n8n-nodes-base.cron':
        const timePattern = this.semanticMatcher.matchTimePattern(description);
        parameters.triggerTimes = {
          item: [{
            mode: 'custom',
            cronExpression: timePattern.expression
          }]
        };
        break;
        
      case 'n8n-nodes-base.mqtt':
        // Extract topic from description if possible
        const topicMatch = description.match(/topic[:\s]+([^\s,]+)/i);
        if (topicMatch) {
          parameters.topic = topicMatch[1];
        }
        break;
        
      case 'n8n-nodes-base.httpRequest':
        // Detect HTTP method
        if (/\b(get|fetch|retrieve|read)\b/i.test(description)) {
          parameters.method = 'GET';
        } else if (/\b(post|send|submit|create)\b/i.test(description)) {
          parameters.method = 'POST';
        } else if (/\b(update|put|modify)\b/i.test(description)) {
          parameters.method = 'PUT';
        } else if (/\b(delete|remove)\b/i.test(description)) {
          parameters.method = 'DELETE';
        }
        break;
        
      case 'n8n-nodes-base.emailSend':
        // Extract email patterns
        const subjectMatch = description.match(/subject[:\s]+([^,\n]+)/i);
        if (subjectMatch) {
          parameters.subject = subjectMatch[1].trim();
        }
        break;
    }
    
    return parameters;
  }

  /**
   * Validate node parameters
   */
  public validateNodeParameters(
    nodeType: string,
    parameters: Record<string, any>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    return this.capabilityRegistry.validateParameters(nodeType, parameters);
  }

  /**
   * Get alternative nodes
   */
  public getAlternatives(nodeType: string): string[] {
    return this.capabilityRegistry.getAlternativeNodes(nodeType);
  }

  /**
   * Get recommended connections
   */
  public getRecommendedConnections(nodeType: string): {
    input: string[];
    output: string[];
  } {
    return this.capabilityRegistry.getRecommendedConnections(nodeType);
  }
}