export interface AnalyzedIntent {
  action: string;
  category?: string;
  platforms?: string[];
  services?: string[];
  entities?: Record<string, any>;
  triggers?: string[];
  conditions?: string[];
  outputs?: string[];
  complexity?: 'simple' | 'intermediate' | 'complex';
  tags?: string[];
  confidence: number;
}

export class IntentAnalyzer {
  private actionKeywords = {
    create: ['create', 'build', 'make', 'generate', 'set up', 'establish'],
    monitor: ['monitor', 'track', 'watch', 'observe', 'check'],
    notify: ['notify', 'alert', 'send', 'email', 'message', 'inform'],
    sync: ['sync', 'synchronize', 'update', 'mirror', 'replicate'],
    automate: ['automate', 'automatic', 'schedule', 'trigger'],
    analyze: ['analyze', 'analyse', 'evaluate', 'assess', 'measure'],
    integrate: ['integrate', 'connect', 'link', 'combine', 'merge'],
    transform: ['transform', 'convert', 'change', 'modify', 'process']
  };

  private categoryKeywords = {
    'crm': ['crm', 'customer', 'lead', 'contact', 'deal', 'opportunity', 'sales'],
    'social-media': ['social', 'twitter', 'facebook', 'instagram', 'linkedin', 'post', 'tweet'],
    'ecommerce': ['shop', 'product', 'order', 'cart', 'payment', 'inventory', 'customer'],
    'communication': ['email', 'sms', 'call', 'message', 'notification', 'slack', 'teams'],
    'data-processing': ['data', 'spreadsheet', 'csv', 'database', 'transform', 'etl'],
    'ai-assistant': ['bot', 'assistant', 'ai', 'chat', 'conversation', 'support'],
    'analytics': ['analytics', 'report', 'dashboard', 'metrics', 'kpi', 'insights'],
    'devops': ['deploy', 'ci/cd', 'build', 'test', 'monitor', 'server', 'docker'],
    'finance': ['invoice', 'payment', 'expense', 'accounting', 'billing', 'transaction'],
    'hr': ['employee', 'onboarding', 'leave', 'timesheet', 'recruitment', 'hr'],
    'marketing': ['campaign', 'email', 'newsletter', 'audience', 'segment', 'funnel'],
    'support': ['ticket', 'support', 'help', 'issue', 'problem', 'customer service']
  };

  private serviceKeywords = {
    'email': ['email', 'gmail', 'outlook', 'sendgrid', 'mailchimp'],
    'crm': ['hubspot', 'salesforce', 'pipedrive', 'zoho', 'crm'],
    'social-media': ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'],
    'ai': ['openai', 'gpt', 'claude', 'ai', 'machine learning'],
    'voice': ['call', 'phone', 'voice', 'twilio', 'vapi'],
    'calendar': ['calendar', 'google calendar', 'outlook calendar', 'scheduling'],
    'database': ['database', 'mysql', 'postgres', 'mongodb', 'airtable'],
    'payment': ['stripe', 'paypal', 'payment', 'checkout', 'billing'],
    'analytics': ['google analytics', 'mixpanel', 'amplitude', 'analytics'],
    'notification': ['slack', 'discord', 'webhook', 'notification', 'alert']
  };

  private triggerKeywords = {
    'webhook': ['webhook', 'api call', 'http', 'request'],
    'schedule': ['schedule', 'cron', 'daily', 'weekly', 'monthly', 'every'],
    'email': ['email received', 'new email', 'email arrives'],
    'form': ['form', 'submission', 'filled out', 'submitted'],
    'file': ['file uploaded', 'new file', 'file created'],
    'database': ['new record', 'database change', 'row added'],
    'manual': ['manual', 'button', 'on demand', 'when i']
  };

  async analyze(description: string): Promise<AnalyzedIntent> {
    const descLower = description.toLowerCase();
    
    // Extract main action
    const action = this.extractAction(descLower);
    
    // Determine category
    const category = this.extractCategory(descLower);
    
    // Extract services mentioned
    const services = this.extractServices(descLower);
    
    // Extract triggers
    const triggers = this.extractTriggers(descLower);
    
    // Extract entities (specific values like emails, URLs, etc.)
    const entities = this.extractEntities(description);
    
    // Determine complexity
    const complexity = this.determineComplexity(description, services, triggers);
    
    // Generate tags
    const tags = this.generateTags(descLower, category, services);
    
    // Calculate confidence
    const confidence = this.calculateConfidence({
      hasAction: !!action,
      hasCategory: !!category,
      servicesCount: services.length,
      triggersCount: triggers.length,
      entitiesCount: Object.keys(entities).length
    });

    return {
      action,
      category,
      services,
      triggers,
      entities,
      complexity,
      tags,
      confidence
    };
  }

  private extractAction(text: string): string {
    for (const [action, keywords] of Object.entries(this.actionKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return action;
      }
    }
    return 'automate'; // Default action
  }

  private extractCategory(text: string): string | undefined {
    let bestMatch: { category: string; score: number } | null = null;

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      const score = keywords.filter(keyword => text.includes(keyword)).length;
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { category, score };
      }
    }

    return bestMatch?.category;
  }

  private extractServices(text: string): string[] {
    const services: string[] = [];

    for (const [service, keywords] of Object.entries(this.serviceKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        services.push(service);
      }
    }

    return [...new Set(services)];
  }

  private extractTriggers(text: string): string[] {
    const triggers: string[] = [];

    for (const [trigger, keywords] of Object.entries(this.triggerKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        triggers.push(trigger);
      }
    }

    // Default to webhook if no trigger found
    if (triggers.length === 0) {
      triggers.push('webhook');
    }

    return triggers;
  }

  private extractEntities(text: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails) {
      entities.emails = emails;
    }

    // Extract URLs
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const urls = text.match(urlRegex);
    if (urls) {
      entities.urls = urls;
    }

    // Extract time patterns
    const timePatterns = [
      /every\s+(\d+)\s+(hours?|minutes?|days?|weeks?|months?)/gi,
      /at\s+(\d{1,2}:\d{2})\s*(am|pm)?/gi,
      /(\d{1,2}:\d{2})\s*(am|pm)?/gi
    ];
    
    for (const pattern of timePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.timePatterns = matches;
        break;
      }
    }

    // Extract numbers
    const numbers = text.match(/\b\d+\b/g);
    if (numbers) {
      entities.numbers = numbers.map(n => parseInt(n));
    }

    // Extract quoted strings
    const quotedStrings = text.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedStrings) {
      entities.quotedStrings = quotedStrings.map(s => s.slice(1, -1));
    }

    // Platform-specific entities
    if (text.includes('channel')) {
      const channelMatch = text.match(/@?#?[\w-]+\s+channel/i);
      if (channelMatch) {
        entities.channel = channelMatch[0].replace(/channel/i, '').trim();
      }
    }

    return entities;
  }

  private determineComplexity(
    text: string,
    services: string[],
    triggers: string[]
  ): 'simple' | 'intermediate' | 'complex' {
    // Count complexity indicators
    let complexityScore = 0;

    // Multiple services increase complexity
    complexityScore += services.length * 2;

    // Multiple triggers increase complexity
    complexityScore += (triggers.length - 1) * 2;

    // Conditional keywords
    const conditionalKeywords = ['if', 'when', 'unless', 'based on', 'depending'];
    complexityScore += conditionalKeywords.filter(k => text.includes(k)).length * 3;

    // Loop/iteration keywords
    const loopKeywords = ['for each', 'loop', 'iterate', 'all', 'every'];
    complexityScore += loopKeywords.filter(k => text.includes(k)).length * 3;

    // Integration keywords
    const integrationKeywords = ['integrate', 'sync', 'connect', 'combine'];
    complexityScore += integrationKeywords.filter(k => text.includes(k)).length * 2;

    // Determine complexity level
    if (complexityScore >= 10) return 'complex';
    if (complexityScore >= 5) return 'intermediate';
    return 'simple';
  }

  private generateTags(text: string, category?: string, services?: string[]): string[] {
    const tags: string[] = [];

    // Add category as tag
    if (category) {
      tags.push(category);
    }

    // Add services as tags
    if (services) {
      tags.push(...services);
    }

    // Add action-based tags
    if (text.includes('automat')) tags.push('automation');
    if (text.includes('integrat')) tags.push('integration');
    if (text.includes('notif') || text.includes('alert')) tags.push('notification');
    if (text.includes('sync')) tags.push('synchronization');
    if (text.includes('report') || text.includes('analyt')) tags.push('analytics');
    if (text.includes('schedul')) tags.push('scheduling');

    // Add workflow type tags
    if (text.includes('real-time') || text.includes('realtime')) tags.push('realtime');
    if (text.includes('batch')) tags.push('batch-processing');
    if (text.includes('api')) tags.push('api-integration');

    return [...new Set(tags)];
  }

  private calculateConfidence(factors: {
    hasAction: boolean;
    hasCategory: boolean;
    servicesCount: number;
    triggersCount: number;
    entitiesCount: number;
  }): number {
    let confidence = 0.5; // Base confidence

    if (factors.hasAction) confidence += 0.1;
    if (factors.hasCategory) confidence += 0.15;
    if (factors.servicesCount > 0) confidence += Math.min(factors.servicesCount * 0.1, 0.2);
    if (factors.triggersCount > 0) confidence += 0.1;
    if (factors.entitiesCount > 0) confidence += Math.min(factors.entitiesCount * 0.05, 0.15);

    return Math.min(confidence, 1.0);
  }
}