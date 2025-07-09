import { api } from '../services/api';
import { DeepAnalysis } from './types';
import { AIService } from './ai-service';
import { DatabaseService } from './database-service';

export class AIAnalyzer {
  private provider: string;
  private aiService: AIService;
  private databaseService: DatabaseService;
  private cache: Map<string, DeepAnalysis> = new Map();
  
  constructor(provider: string = 'openai') {
    this.provider = provider;
    this.aiService = new AIService(provider);
    this.databaseService = new DatabaseService();
  }

  async callAI(prompt: string): Promise<string> {
    return await this.aiService.callAI(prompt);
  }

  async analyzeRequest(userRequest: string): Promise<DeepAnalysis> {
    // Check cache first
    const cacheKey = this.generateCacheKey(userRequest);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check if we have a previous analysis for similar request
    const existingAnalysis = await this.databaseService.getAnalysisByRequest(userRequest);
    if (existingAnalysis) {
      this.cache.set(cacheKey, existingAnalysis);
      return existingAnalysis;
    }

    const analysisPrompt = `
TASK: Analyze this workflow request and extract ALL meaningful information for n8n workflow generation.

USER REQUEST: "${userRequest}"

Perform COMPREHENSIVE analysis and return JSON:
{
  "intent": {
    "primaryGoal": "What is the main goal?",
    "secondaryGoals": ["list", "of", "secondary", "objectives"],
    "businessContext": "What type of business/domain is this?",
    "urgency": "low|medium|high",
    "scope": "small|medium|large|enterprise"
  },
  "entities": {
    "actors": ["who are the people/roles involved?"],
    "systems": ["what external systems mentioned?"],
    "data": ["what data is being processed?"],
    "triggers": ["what events start this workflow?"],
    "outputs": ["what should be produced?"]
  },
  "workflow_characteristics": {
    "complexity": "simple|moderate|complex|enterprise",
    "parallel_processes": 3,
    "decision_points": 2,
    "external_integrations": ["list", "of", "integrations"],
    "estimated_steps": 15,
    "error_handling_needs": ["list", "of", "potential", "errors"],
    "compliance_requirements": ["any", "regulatory", "needs"]
  },
  "technical_requirements": {
    "data_flow_pattern": "linear|branching|circular|mesh",
    "scalability_needs": "low|medium|high",
    "real_time_requirements": true,
    "batch_processing": false,
    "notification_requirements": ["email", "sms", "slack"],
    "storage_requirements": ["database", "file", "api"]
  },
  "implicit_requirements": {
    "error_handling": "What error scenarios should be considered?",
    "logging_needs": "What should be logged?",
    "monitoring_needs": "What should be monitored?",
    "security_considerations": "What security measures needed?",
    "performance_requirements": "Any performance constraints?"
  },
  "innovation_opportunities": {
    "automation_potential": ["what", "can", "be", "automated"],
    "optimization_areas": ["where", "can", "we", "optimize"],
    "integration_possibilities": ["additional", "beneficial", "integrations"],
    "future_enhancements": ["potential", "future", "improvements"]
  },
  "confidence": 0.95,
  "uniqueness_factors": ["what", "makes", "this", "request", "unique"],
  "similar_patterns": ["any", "similar", "workflow", "patterns"],
  "technicalRequirements": ["specific", "technical", "needs"],
  "constraints": ["limitations", "or", "restrictions"],
  "potentialIssues": ["possible", "problems", "to", "watch", "for"],
  "complexityScore": 0.7
}

CRITICAL: Do NOT use templates. Analyze THIS SPECIFIC request in detail.`;

    try {
      const result = await this.aiService.getJSONResponse(analysisPrompt);
      
      // Ensure all required fields are present
      const analysis = this.validateAndEnrichAnalysis(result, userRequest);
      
      // Cache the result
      this.cache.set(cacheKey, analysis);
      
      // Save to database for future learning
      await this.databaseService.saveDeepAnalysis(analysis);
      
      return analysis;
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      // Return a basic analysis as fallback
      return this.createFallbackAnalysis(userRequest);
    }
  }

  async analyze(prompt: string): Promise<any> {
    try {
      const result = await this.aiService.getJSONResponse(prompt);
      return result;
    } catch (error) {
      // Fallback to text response
      const textResponse = await this.aiService.callAI(prompt);
      return this.parseResponse(textResponse);
    }
  }
  
  private parseResponse(content: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { content };
    } catch (error) {
      return { content };
    }
  }

  private validateAndEnrichAnalysis(result: any, userRequest: string): DeepAnalysis {
    // Ensure all required fields exist with defaults
    return {
      intent: result.intent || {
        primaryGoal: this.extractPrimaryGoal(userRequest),
        secondaryGoals: [],
        businessContext: 'General',
        urgency: 'medium',
        scope: 'medium'
      },
      entities: result.entities || {
        actors: [],
        systems: [],
        data: [],
        triggers: ['Manual'],
        outputs: []
      },
      workflow_characteristics: result.workflow_characteristics || {
        complexity: 'moderate',
        parallel_processes: 0,
        decision_points: 0,
        external_integrations: [],
        estimated_steps: 5,
        error_handling_needs: [],
        compliance_requirements: []
      },
      technical_requirements: result.technical_requirements || {
        data_flow_pattern: 'linear',
        scalability_needs: 'low',
        real_time_requirements: false,
        batch_processing: false,
        notification_requirements: [],
        storage_requirements: []
      },
      implicit_requirements: result.implicit_requirements || {
        error_handling: 'Basic error handling',
        logging_needs: 'Standard logging',
        monitoring_needs: 'Basic monitoring',
        security_considerations: 'Standard security',
        performance_requirements: 'Normal performance'
      },
      innovation_opportunities: result.innovation_opportunities || {
        automation_potential: [],
        optimization_areas: [],
        integration_possibilities: [],
        future_enhancements: []
      },
      confidence: result.confidence || 0.7,
      uniqueness_factors: result.uniqueness_factors || [],
      similar_patterns: result.similar_patterns || [],
      technicalRequirements: result.technicalRequirements || [],
      constraints: result.constraints || [],
      potentialIssues: result.potentialIssues || [],
      complexityScore: result.complexityScore || 0.5
    };
  }
  
  private createFallbackAnalysis(userRequest: string): DeepAnalysis {
    return {
      intent: {
        primaryGoal: this.extractPrimaryGoal(userRequest),
        secondaryGoals: [],
        businessContext: 'General',
        urgency: 'medium',
        scope: 'medium'
      },
      entities: {
        actors: ['User'],
        systems: this.extractSystems(userRequest),
        data: [],
        triggers: ['Manual trigger'],
        outputs: ['Workflow result']
      },
      workflow_characteristics: {
        complexity: 'moderate',
        parallel_processes: 0,
        decision_points: 1,
        external_integrations: [],
        estimated_steps: 5,
        error_handling_needs: ['Basic error handling'],
        compliance_requirements: []
      },
      technical_requirements: {
        data_flow_pattern: 'linear',
        scalability_needs: 'medium',
        real_time_requirements: false,
        batch_processing: false,
        notification_requirements: [],
        storage_requirements: []
      },
      implicit_requirements: {
        error_handling: 'Implement basic error handling',
        logging_needs: 'Log all operations',
        monitoring_needs: 'Monitor workflow execution',
        security_considerations: 'Ensure data security',
        performance_requirements: 'Optimize for reliability'
      },
      innovation_opportunities: {
        automation_potential: ['Full automation possible'],
        optimization_areas: ['Performance optimization'],
        integration_possibilities: [],
        future_enhancements: ['Add more features']
      },
      confidence: 0.5,
      uniqueness_factors: [],
      similar_patterns: [],
      technicalRequirements: ['n8n workflow'],
      constraints: [],
      potentialIssues: ['Configuration needed'],
      complexityScore: 0.5
    };
  }
  
  private extractPrimaryGoal(request: string): string {
    // Simple extraction logic
    const verbs = ['create', 'send', 'process', 'analyze', 'generate', 'update', 'fetch', 'transform'];
    const words = request.toLowerCase().split(' ');
    
    for (const verb of verbs) {
      const index = words.indexOf(verb);
      if (index !== -1) {
        return words.slice(index, Math.min(index + 5, words.length)).join(' ');
      }
    }
    
    return request.substring(0, 50);
  }
  
  private extractSystems(request: string): string[] {
    const systems = [];
    const knownSystems = [
      'email', 'database', 'api', 'webhook', 'slack', 'discord',
      'google sheets', 'airtable', 'notion', 'trello', 'jira',
      'salesforce', 'hubspot', 'mailchimp', 'twilio', 'stripe'
    ];
    
    const lowerRequest = request.toLowerCase();
    for (const system of knownSystems) {
      if (lowerRequest.includes(system)) {
        systems.push(system);
      }
    }
    
    return systems.length > 0 ? systems : ['External system'];
  }
  
  private generateCacheKey(request: string): string {
    // Create a hash-based cache key
    return btoa(request.substring(0, 100)).replace(/[^a-zA-Z0-9]/g, '');
  }
}