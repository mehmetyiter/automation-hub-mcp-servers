import { WorkflowCredentialMapping } from '../types/credential.types.js';
export interface AIServiceConfig {
    provider: 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
    temperature?: number;
}
export interface AIGenerationResult {
    workflow: any;
    explanation: string;
    confidence: number;
    credentialMappings?: WorkflowCredentialMapping[];
    requiredCredentials?: any[];
    suggestedImprovements?: string[];
}
export declare class AIService {
    private config;
    constructor(config: AIServiceConfig);
    generateWorkflow(platform: string, userPrompt: string, name: string): Promise<AIGenerationResult>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private findRelevantExamples;
    private generateWithOpenAI;
    private generateWithAnthropic;
    private generateWithRules;
    addTrainingExample(platform: string, userPrompt: string, generatedWorkflow: any, userFeedback: any): Promise<void>;
    getTrainingData(platform: string): Promise<any[]>;
    private analyzeWorkflow;
}
//# sourceMappingURL=ai-service-enhanced.d.ts.map