import { CodeGenerationRequest, CodeContext, CodeEnvironment, LogicPatterns } from './types';
import { AIService } from '../ai-service';

export class CodeContextAnalyzer {
  private aiService: AIService;
  private contextCache: Map<string, CodeContext> = new Map();

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
  }

  async analyzeContext(request: CodeGenerationRequest): Promise<CodeContext> {
    const cacheKey = this.generateCacheKey(request);
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }

    const analysisPrompt = `
TASK: Analyze this code generation request and extract comprehensive technical context.

REQUEST: "${request.description}"
NODE TYPE: "${request.nodeType}"
WORKFLOW CONTEXT: ${JSON.stringify(request.workflowContext, null, 2)}

Perform DEEP technical analysis and return JSON:

{
  "intent": {
    "primaryFunction": "What is the main function this code should perform?",
    "dataTransformation": "What data transformations are needed?",
    "businessLogic": "What business rules should be implemented?",
    "integrationNeeds": "What external systems need integration?",
    "performanceRequirements": "What performance constraints exist?"
  },
  "technicalRequirements": {
    "inputDataStructure": "What input data structure is expected?",
    "outputDataStructure": "What output data structure should be produced?",
    "errorHandling": "What error scenarios need handling?",
    "validation": "What validation rules are needed?",
    "algorithms": "What algorithms or calculations are required?"
  },
  "codeComplexity": {
    "level": "simple|moderate|complex|advanced",
    "estimatedLines": number,
    "requiredLibraries": ["list", "of", "libraries"],
    "asyncOperations": boolean,
    "errorProneParts": ["potential", "error", "areas"]
  },
  "optimizationOpportunities": {
    "performance": ["performance", "optimization", "opportunities"],
    "readability": ["readability", "improvements"],
    "maintainability": ["maintainability", "enhancements"],
    "security": ["security", "considerations"]
  }
}

CRITICAL: Analyze the SPECIFIC request, not general patterns.
CRITICAL: Consider the workflow context and preceding/following nodes.
CRITICAL: Think about edge cases and error scenarios.
CRITICAL: Consider data flow patterns and transformation needs.

Examples of analysis:
- If request mentions "calculate", determine exact calculations needed
- If request mentions "validate", identify specific validation rules
- If request mentions "transform", specify exact transformations
- If request mentions "filter", determine filter criteria
- If request mentions "aggregate", identify aggregation logic`;

    try {
      const result = await this.aiService.getJSONResponse(analysisPrompt);
      const context = this.validateAndEnrichContext(result, request);
      
      // Cache the result
      this.contextCache.set(cacheKey, context);
      
      return context;
    } catch (error) {
      console.error('Context analysis failed:', error);
      return this.createFallbackContext(request);
    }
  }

  async detectEnvironment(context: CodeContext): Promise<CodeEnvironment> {
    // Determine the runtime environment based on context
    const environment: CodeEnvironment = {
      runtime: 'node',
      version: '18.x',
      availableLibraries: this.getAvailableLibraries(context),
      restrictions: this.getRestrictions(context),
      bestPractices: this.getBestPractices(context)
    };

    return environment;
  }

  async recognizeLogicPatterns(context: CodeContext): Promise<LogicPatterns> {
    const patternPrompt = `
Based on this code context, identify the most appropriate logic patterns:

CONTEXT: ${JSON.stringify(context, null, 2)}

Return specific patterns that should be used:
{
  "dataProcessing": ["specific data processing patterns needed"],
  "algorithmicPatterns": ["algorithmic approaches to use"],
  "errorHandlingPatterns": ["error handling strategies"],
  "optimizationPatterns": ["optimization techniques to apply"]
}

Consider:
- Data volume and processing needs
- Performance requirements
- Error scenarios
- Code maintainability`;

    try {
      const patterns = await this.aiService.getJSONResponse(patternPrompt);
      return this.validatePatterns(patterns);
    } catch (error) {
      return this.getDefaultPatterns(context);
    }
  }

  private validateAndEnrichContext(result: any, request: CodeGenerationRequest): CodeContext {
    // Ensure all required fields exist
    const context: CodeContext = {
      intent: {
        primaryFunction: result.intent?.primaryFunction || this.extractPrimaryFunction(request.description),
        dataTransformation: result.intent?.dataTransformation || 'Process input data',
        businessLogic: result.intent?.businessLogic || 'Apply business rules',
        integrationNeeds: result.intent?.integrationNeeds || 'None',
        performanceRequirements: result.intent?.performanceRequirements || 'Standard performance'
      },
      technicalRequirements: {
        inputDataStructure: result.technicalRequirements?.inputDataStructure || 'Array of items',
        outputDataStructure: result.technicalRequirements?.outputDataStructure || 'Processed items',
        errorHandling: result.technicalRequirements?.errorHandling || 'Basic error handling',
        validation: result.technicalRequirements?.validation || 'Input validation',
        algorithms: result.technicalRequirements?.algorithms || 'Standard processing'
      },
      codeComplexity: {
        level: result.codeComplexity?.level || 'moderate',
        estimatedLines: result.codeComplexity?.estimatedLines || 50,
        requiredLibraries: result.codeComplexity?.requiredLibraries || [],
        asyncOperations: result.codeComplexity?.asyncOperations || false,
        errorProneParts: result.codeComplexity?.errorProneParts || []
      },
      optimizationOpportunities: {
        performance: result.optimizationOpportunities?.performance || [],
        readability: result.optimizationOpportunities?.readability || [],
        maintainability: result.optimizationOpportunities?.maintainability || [],
        security: result.optimizationOpportunities?.security || []
      }
    };

    return context;
  }

  private createFallbackContext(request: CodeGenerationRequest): CodeContext {
    return {
      intent: {
        primaryFunction: this.extractPrimaryFunction(request.description),
        dataTransformation: 'Transform data as needed',
        businessLogic: 'Implement requested logic',
        integrationNeeds: 'None identified',
        performanceRequirements: 'Standard performance'
      },
      technicalRequirements: {
        inputDataStructure: 'n8n items array',
        outputDataStructure: 'Processed items array',
        errorHandling: 'Try-catch blocks for each item',
        validation: 'Validate input data',
        algorithms: 'Standard processing algorithms'
      },
      codeComplexity: {
        level: 'moderate',
        estimatedLines: 30,
        requiredLibraries: [],
        asyncOperations: false,
        errorProneParts: ['Data validation', 'External calls']
      },
      optimizationOpportunities: {
        performance: ['Use efficient loops', 'Minimize operations'],
        readability: ['Clear variable names', 'Add comments'],
        maintainability: ['Modular structure', 'Error handling'],
        security: ['Input validation', 'Sanitize data']
      }
    };
  }

  private extractPrimaryFunction(description: string): string {
    const keywords = {
      calculate: 'Perform calculations',
      transform: 'Transform data',
      filter: 'Filter data',
      validate: 'Validate input',
      aggregate: 'Aggregate data',
      process: 'Process data',
      generate: 'Generate output',
      parse: 'Parse input',
      format: 'Format data',
      convert: 'Convert data'
    };

    const lowerDesc = description.toLowerCase();
    for (const [keyword, func] of Object.entries(keywords)) {
      if (lowerDesc.includes(keyword)) {
        return `${func} based on: ${description.substring(0, 100)}`;
      }
    }

    return description.substring(0, 100);
  }

  private getAvailableLibraries(context: CodeContext): string[] {
    const libraries = ['lodash', 'moment', 'crypto'];
    
    if (context.intent.dataTransformation.includes('JSON')) {
      libraries.push('json5');
    }
    
    if (context.intent.businessLogic.includes('calculation')) {
      libraries.push('mathjs');
    }
    
    return libraries;
  }

  private getRestrictions(context: CodeContext): string[] {
    return [
      'No eval() or Function() constructor',
      'No file system access',
      'No network requests in Code node',
      'Memory limit: 512MB',
      'Execution timeout: 120 seconds'
    ];
  }

  private getBestPractices(context: CodeContext): string[] {
    const practices = [
      'Use const/let instead of var',
      'Handle errors for each item',
      'Validate input data',
      'Return proper n8n item structure'
    ];

    if (context.codeComplexity.asyncOperations) {
      practices.push('Use async/await for asynchronous operations');
    }

    if (context.codeComplexity.level === 'complex' || context.codeComplexity.level === 'advanced') {
      practices.push('Break complex logic into functions');
      practices.push('Add detailed comments');
    }

    return practices;
  }

  private validatePatterns(patterns: any): LogicPatterns {
    return {
      dataProcessing: Array.isArray(patterns.dataProcessing) ? patterns.dataProcessing : ['Sequential processing'],
      algorithmicPatterns: Array.isArray(patterns.algorithmicPatterns) ? patterns.algorithmicPatterns : ['Standard algorithms'],
      errorHandlingPatterns: Array.isArray(patterns.errorHandlingPatterns) ? patterns.errorHandlingPatterns : ['Try-catch blocks'],
      optimizationPatterns: Array.isArray(patterns.optimizationPatterns) ? patterns.optimizationPatterns : ['Basic optimization']
    };
  }

  private getDefaultPatterns(context: CodeContext): LogicPatterns {
    return {
      dataProcessing: ['Iterate through items', 'Process each item'],
      algorithmicPatterns: ['Sequential processing', 'Data validation'],
      errorHandlingPatterns: ['Try-catch per item', 'Log errors'],
      optimizationPatterns: ['Early returns', 'Efficient loops']
    };
  }

  private generateCacheKey(request: CodeGenerationRequest): string {
    const key = `${request.description}_${request.nodeType}_${JSON.stringify(request.requirements)}`;
    return Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }
}