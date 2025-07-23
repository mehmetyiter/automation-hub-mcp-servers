// semantic-node-matcher.ts
// Intelligent node type matching based on semantic understanding

export interface NodeMatchResult {
  nodeType: string;
  confidence: number;
  reasoning: string;
  alternativeNodes?: string[];
}

export class SemanticNodeMatcher {
  // Concept mappings for different node types
  private readonly conceptMappings = {
    // IoT and Hardware nodes
    'n8n-nodes-base.mqtt': {
      keywords: ['mqtt', 'broker', 'iot', 'sensor', 'device', 'telemetry', 'publish', 'subscribe', 'topic'],
      concepts: ['real_time_monitoring', 'device_communication', 'sensor_data_collection'],
      useCases: ['iot_integration', 'sensor_monitoring', 'device_control']
    },
    
    // Communication nodes
    'n8n-nodes-base.emailSend': {
      keywords: ['email', 'mail', 'send', 'notify', 'alert', 'report', 'message'],
      concepts: ['notification', 'alerting', 'reporting', 'communication'],
      useCases: ['send_alerts', 'send_reports', 'notify_users']
    },
    'n8n-nodes-base.twilio': {
      keywords: ['sms', 'text', 'message', 'phone', 'twilio', 'mobile', 'urgent'],
      concepts: ['urgent_notification', 'mobile_alert', 'sms_messaging'],
      useCases: ['critical_alerts', 'mobile_notifications', 'two_factor_auth']
    },
    'n8n-nodes-base.whatsappBusiness': {
      keywords: ['whatsapp', 'chat', 'instant', 'message', 'business', 'customer'],
      concepts: ['instant_messaging', 'customer_communication', 'chat_integration'],
      useCases: ['customer_support', 'instant_notifications', 'order_updates']
    },
    
    // Data processing nodes
    'n8n-nodes-base.httpRequest': {
      keywords: ['http', 'api', 'rest', 'webhook', 'request', 'fetch', 'get', 'post', 'web', 'gpio', 'relay', 'hardware', 'control'],
      concepts: ['api_integration', 'web_service', 'data_fetching', 'hardware_control_api'],
      useCases: ['api_calls', 'webhook_integration', 'external_service', 'gpio_control', 'relay_switching', 'hardware_interface']
    },
    'n8n-nodes-base.function': {
      keywords: ['function', 'code', 'process', 'calculate', 'transform', 'logic', 'custom'],
      concepts: ['data_processing', 'custom_logic', 'calculation'],
      useCases: ['data_transformation', 'complex_calculations', 'business_logic']
    },
    'n8n-nodes-base.code': {
      keywords: ['code', 'javascript', 'python', 'script', 'program', 'algorithm', 'model'],
      concepts: ['scripting', 'advanced_processing', 'ml_models'],
      useCases: ['machine_learning', 'complex_algorithms', 'data_analysis']
    },
    'n8n-nodes-base.executeCommand': {
      keywords: ['execute', 'command', 'shell', 'bash', 'script', 'gpio', 'pin', 'hardware', 'system', 'control'],
      concepts: ['system_control', 'shell_execution', 'hardware_control_script'],
      useCases: ['system_commands', 'script_execution', 'gpio_control', 'hardware_manipulation', 'sensor_reading']
    }
  };

  // Fuzzy matching algorithm
  private calculateSimilarity(text: string, keywords: string[]): number {
    const normalizedText = text.toLowerCase();
    let score = 0;
    let matchCount = 0;

    for (const keyword of keywords) {
      // Exact match
      if (normalizedText.includes(keyword)) {
        score += 10;
        matchCount++;
      }
      // Partial match (at least 70% of keyword)
      else if (this.partialMatch(normalizedText, keyword, 0.7)) {
        score += 5;
        matchCount++;
      }
      // Concept match (stemming)
      else if (this.stemMatch(normalizedText, keyword)) {
        score += 3;
        matchCount++;
      }
    }

    // Normalize score
    return keywords.length > 0 ? (score / (keywords.length * 10)) * 100 : 0;
  }

  // Partial string matching
  private partialMatch(text: string, keyword: string, threshold: number): boolean {
    const minLength = Math.floor(keyword.length * threshold);
    for (let i = 0; i <= text.length - minLength; i++) {
      const substring = text.substring(i, i + minLength);
      if (keyword.includes(substring) || substring.includes(keyword.substring(0, minLength))) {
        return true;
      }
    }
    return false;
  }

  // Basic stemming for concept matching
  private stemMatch(text: string, keyword: string): boolean {
    const stem = keyword.substring(0, Math.max(3, keyword.length - 2));
    return text.includes(stem);
  }

  // Main matching function
  public findBestNodeType(description: string, context?: any): NodeMatchResult {
    const matches: Array<{nodeType: string, score: number, reasoning: string}> = [];

    // Score each node type
    for (const [nodeType, mapping] of Object.entries(this.conceptMappings)) {
      const keywordScore = this.calculateSimilarity(description, mapping.keywords);
      const conceptScore = this.calculateConceptMatch(description, mapping.concepts);
      const useCaseScore = this.calculateUseCaseMatch(description, mapping.useCases);
      
      // Weighted average
      const totalScore = (keywordScore * 0.5) + (conceptScore * 0.3) + (useCaseScore * 0.2);
      
      if (totalScore > 0) {
        matches.push({
          nodeType,
          score: totalScore,
          reasoning: this.generateReasoning(description, mapping, totalScore)
        });
      }
    }

    // Sort by score
    matches.sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        nodeType: 'n8n-nodes-base.httpRequest',  // Default fallback
        confidence: 0.3,
        reasoning: 'No specific match found, defaulting to HTTP Request for general integration'
      };
    }

    // Return best match with alternatives
    const bestMatch = matches[0];
    const alternatives = matches.slice(1, 4).map(m => m.nodeType);

    return {
      nodeType: bestMatch.nodeType,
      confidence: bestMatch.score / 100,
      reasoning: bestMatch.reasoning,
      alternativeNodes: alternatives.length > 0 ? alternatives : undefined
    };
  }

  // Match against conceptual understanding
  private calculateConceptMatch(description: string, concepts: string[]): number {
    let score = 0;
    const normalizedDesc = description.toLowerCase();

    for (const concept of concepts) {
      const conceptWords = concept.split('_');
      let conceptMatch = true;
      
      for (const word of conceptWords) {
        if (!normalizedDesc.includes(word)) {
          conceptMatch = false;
          break;
        }
      }
      
      if (conceptMatch) {
        score += 100 / concepts.length;
      }
    }

    return score;
  }

  // Match against use cases
  private calculateUseCaseMatch(description: string, useCases: string[]): number {
    let score = 0;
    const normalizedDesc = description.toLowerCase();

    for (const useCase of useCases) {
      const useCaseWords = useCase.split('_');
      let matchCount = 0;
      
      for (const word of useCaseWords) {
        if (normalizedDesc.includes(word)) {
          matchCount++;
        }
      }
      
      if (matchCount >= useCaseWords.length * 0.6) {
        score += 100 / useCases.length;
      }
    }

    return score;
  }

  // Generate human-readable reasoning
  private generateReasoning(description: string, mapping: any, score: number): string {
    const matchedKeywords = mapping.keywords.filter((k: string) => 
      description.toLowerCase().includes(k)
    );
    
    if (matchedKeywords.length > 0) {
      return `Matched keywords: ${matchedKeywords.join(', ')} (confidence: ${score.toFixed(1)}%)`;
    } else {
      return `Conceptual match based on use case similarity (confidence: ${score.toFixed(1)}%)`;
    }
  }

  // Special handler for time-based triggers
  public matchTimePattern(description: string): { pattern: string; expression: string } {
    const timePatterns = [
      { pattern: 'every minute', expression: '* * * * *' },
      { pattern: 'every hour', expression: '0 * * * *' },
      { pattern: 'hourly', expression: '0 * * * *' },
      { pattern: 'every day', expression: '0 0 * * *' },
      { pattern: 'daily', expression: '0 0 * * *' },
      { pattern: 'every monday', expression: '0 0 * * 1' },
      { pattern: 'every week', expression: '0 0 * * 0' },
      { pattern: 'weekly', expression: '0 0 * * 0' },
      { pattern: 'every month', expression: '0 0 1 * *' },
      { pattern: 'monthly', expression: '0 0 1 * *' }
    ];

    const normalizedDesc = description.toLowerCase();
    
    for (const { pattern, expression } of timePatterns) {
      if (normalizedDesc.includes(pattern)) {
        return { pattern, expression };
      }
    }

    // Advanced parsing for specific times
    const timeMatch = normalizedDesc.match(/at (\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3];
      
      if (meridiem?.toLowerCase() === 'pm' && hour !== 12) {
        hour += 12;
      } else if (meridiem?.toLowerCase() === 'am' && hour === 12) {
        hour = 0;
      }
      
      return {
        pattern: `at ${timeMatch[0]}`,
        expression: `${minute} ${hour} * * *`
      };
    }

    return { pattern: 'every hour', expression: '0 * * * *' };  // Default
  }
}