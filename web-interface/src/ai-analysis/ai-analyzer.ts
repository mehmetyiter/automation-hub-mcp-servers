import { api } from '../services/api';
import { DeepAnalysis } from './types';

export class AIAnalyzer {
  private provider: string;

  constructor(provider: string = 'openai') {
    this.provider = provider;
  }

  async callAI(prompt: string): Promise<string> {
    try {
      const response = await api.post('/n8n/api/ai-providers/chat/completion', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI analyzer specializing in workflow analysis and prompt generation. Always respond with valid JSON when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        provider: this.provider,
        useSpecificProvider: true,
        temperature: 0.7,
        max_tokens: 4000
      });

      return response.data.content || response.data.message;
    } catch (error: any) {
      console.error('AI Analyzer error:', error);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  async analyzeRequest(userRequest: string): Promise<DeepAnalysis> {
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
    "parallel_processes": number,
    "decision_points": number,
    "external_integrations": ["list", "of", "integrations"],
    "estimated_steps": number,
    "error_handling_needs": ["list", "of", "potential", "errors"],
    "compliance_requirements": ["any", "regulatory", "needs"]
  },
  "technical_requirements": {
    "data_flow_pattern": "linear|branching|circular|mesh",
    "scalability_needs": "low|medium|high",
    "real_time_requirements": boolean,
    "batch_processing": boolean,
    "notification_requirements": ["email", "sms", "slack", "etc"],
    "storage_requirements": ["database", "file", "api", "etc"]
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
  "similar_patterns": ["any", "similar", "workflow", "patterns"]
}

CRITICAL: Do NOT use templates or predefined categories. Analyze THIS SPECIFIC request in detail.
CRITICAL: Consider implicit requirements that user didn't explicitly mention.
CRITICAL: Think about edge cases and error scenarios.
CRITICAL: Consider scalability and future growth.`;

    const result = await this.callAI(analysisPrompt);
    
    try {
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to parse AI analysis:', error);
      throw new Error('AI analysis returned invalid JSON');
    }
  }
}