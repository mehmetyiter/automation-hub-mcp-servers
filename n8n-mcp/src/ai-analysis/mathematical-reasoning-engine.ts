import { AIService } from '../ai-service.js';
import { BusinessDomain, MathematicalModel } from './business-logic-generator.js';

export interface MathProblemType {
  type: 'scoring_algorithm' | 'classification' | 'optimization' | 'prediction' | 'calculation';
  complexity: 'simple' | 'moderate' | 'complex';
  variables: number;
  constraints: string[];
}

export interface MathematicalApproach {
  algorithmName: string;
  mathematicalFoundation: string;
  formulaStructure: string;
  variableRelationships: string;
  calculationSteps: Array<{
    step: number;
    operation: string;
    businessPurpose: string;
    formula: string;
  }>;
  optimizationTechniques: string[];
  validationChecks: string[];
  performanceConsiderations: string[];
}

export interface CalculationRequirements {
  inputVariables?: Record<string, any>;
  outputExpectations?: string[];
  constraints?: string[];
  accuracy?: string;
}

export interface CalculationStrategy {
  approach: MathematicalApproach;
  implementation: string;
  testCases: Array<{
    input: any;
    expectedOutput: any;
    explanation: string;
  }>;
}

export class MathematicalReasoningEngine {
  constructor(private aiService: AIService) {}
  
  async detectMathematicalModel(
    domain: BusinessDomain, 
    request: any
  ): Promise<MathematicalModel> {
    const mathModelPrompt = `
TASK: Design the mathematical model for this business logic based on domain analysis.

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

REQUEST DETAILS:
${JSON.stringify(request, null, 2)}

Design comprehensive mathematical model and return JSON:

{
  "modelType": "linear|exponential|logarithmic|polynomial|statistical|ml|weighted|custom",
  "variables": {
    "inputVariables": [
      {
        "name": "variable_name",
        "type": "number|percentage|boolean|categorical|date",
        "range": "valid range or categories",
        "weight": "importance weight in calculations",
        "businessMeaning": "what this variable represents in business"
      }
    ],
    "outputVariables": [
      {
        "name": "output_name",
        "type": "number|percentage|category|score",
        "range": "expected output range",
        "businessMeaning": "business interpretation of output"
      }
    ]
  },
  "mathematicalOperations": {
    "primaryFormula": "main mathematical relationship",
    "weightingStrategy": "how variables are weighted",
    "normalizationMethods": ["how to normalize different data types"],
    "aggregationFunctions": ["how to combine multiple inputs"],
    "thresholdLogic": ["decision thresholds and their meanings"]
  },
  "algorithmDesign": {
    "stepByStepProcess": ["ordered steps of the algorithm"],
    "conditionalLogic": ["if-then rules based on business requirements"],
    "errorHandlingMath": ["mathematical approaches to handle errors"],
    "optimizationOpportunities": ["mathematical optimizations possible"]
  },
  "businessConstraints": {
    "mathematicalConstraints": ["mathematical limits based on business rules"],
    "regulatoryConstraints": ["mathematical implications of regulations"],
    "performanceConstraints": ["computational complexity considerations"]
  }
}

CRITICAL: Design SPECIFIC mathematical model for THIS business logic.
CRITICAL: Consider business meaning of every mathematical operation.
CRITICAL: Ensure mathematical approach aligns with business objectives.
CRITICAL: Include realistic constraints and edge case handling.`;

    const result = await this.aiService.getJSONResponse(mathModelPrompt);
    return this.validateMathematicalModel(result);
  }
  
  async designCalculationStrategy(
    domain: BusinessDomain, 
    requirements: CalculationRequirements
  ): Promise<CalculationStrategy> {
    
    // Analyze the type of mathematical problem
    const problemType = this.analyzeProblemType(requirements);
    
    // Design appropriate mathematical approach
    const approach = await this.designMathematicalApproach(problemType, domain);
    
    // Generate implementation code
    const implementation = await this.generateMathematicalImplementation(approach, domain);
    
    // Create test cases
    const testCases = await this.generateMathematicalTestCases(approach, domain);
    
    return {
      approach,
      implementation,
      testCases
    };
  }

  private analyzeProblemType(requirements: CalculationRequirements): MathProblemType {
    const typeAnalysis: MathProblemType = {
      type: 'calculation',
      complexity: 'simple',
      variables: 0,
      constraints: []
    };
    
    // Analyze requirement patterns
    const reqText = JSON.stringify(requirements).toLowerCase();
    
    if (reqText.includes('score') || reqText.includes('rating')) {
      typeAnalysis.type = 'scoring_algorithm';
    } else if (reqText.includes('classify') || reqText.includes('category')) {
      typeAnalysis.type = 'classification';
    } else if (reqText.includes('optimize') || reqText.includes('best')) {
      typeAnalysis.type = 'optimization';
    } else if (reqText.includes('predict') || reqText.includes('forecast')) {
      typeAnalysis.type = 'prediction';
    }
    
    // Determine complexity
    typeAnalysis.variables = Object.keys(requirements.inputVariables || {}).length;
    if (typeAnalysis.variables > 10) {
      typeAnalysis.complexity = 'complex';
    } else if (typeAnalysis.variables > 5) {
      typeAnalysis.complexity = 'moderate';
    }
    
    // Extract constraints
    typeAnalysis.constraints = requirements.constraints || [];
    
    return typeAnalysis;
  }

  private async designMathematicalApproach(
    problemType: MathProblemType, 
    domain: BusinessDomain
  ): Promise<MathematicalApproach> {
    
    const approachPrompt = `
TASK: Design specific mathematical approach for this business problem.

PROBLEM TYPE: ${JSON.stringify(problemType, null, 2)}
BUSINESS DOMAIN: ${JSON.stringify(domain, null, 2)}

Design mathematical solution and return JSON:

{
  "algorithmName": "descriptive name for the algorithm",
  "mathematicalFoundation": "mathematical principles being used",
  "formulaStructure": "structure of the main formula",
  "variableRelationships": "how variables mathematically relate",
  "calculationSteps": [
    {
      "step": 1,
      "operation": "what mathematical operation",
      "businessPurpose": "why this step is needed for business",
      "formula": "specific formula or calculation"
    }
  ],
  "optimizationTechniques": ["mathematical optimizations to apply"],
  "validationChecks": ["mathematical checks to ensure accuracy"],
  "performanceConsiderations": ["computational complexity notes"]
}

Focus on creating a SPECIFIC, IMPLEMENTABLE mathematical solution.`;

    const result = await this.aiService.getJSONResponse(approachPrompt);
    return result as MathematicalApproach;
  }
  
  private async generateMathematicalImplementation(
    approach: MathematicalApproach,
    domain: BusinessDomain
  ): Promise<string> {
    
    const implementationPrompt = `
TASK: Generate TypeScript implementation of the mathematical approach.

MATHEMATICAL APPROACH:
${JSON.stringify(approach, null, 2)}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

Generate production-ready TypeScript code that:
1. Implements the exact mathematical formulas
2. Includes proper error handling
3. Validates business constraints
4. Provides clear variable names
5. Includes comprehensive comments
6. Returns structured results

Generate the complete implementation:`;

    return await this.aiService.callAI(implementationPrompt);
  }
  
  private async generateMathematicalTestCases(
    approach: MathematicalApproach,
    domain: BusinessDomain
  ): Promise<Array<{ input: any; expectedOutput: any; explanation: string }>> {
    
    const testPrompt = `
TASK: Generate comprehensive test cases for the mathematical approach.

MATHEMATICAL APPROACH:
${JSON.stringify(approach, null, 2)}

BUSINESS DOMAIN:
${JSON.stringify(domain, null, 2)}

Generate test cases that cover:
1. Normal business scenarios
2. Edge cases
3. Invalid inputs
4. Boundary conditions
5. Real-world examples

Return JSON array of test cases:
{
  "testCases": [
    {
      "input": { "variable1": value1, "variable2": value2 },
      "expectedOutput": { "result": value },
      "explanation": "why this test case is important"
    }
  ]
}`;

    const result = await this.aiService.getJSONResponse(testPrompt);
    return result.testCases || [];
  }
  
  private validateMathematicalModel(model: any): MathematicalModel {
    // Validate and sanitize the mathematical model
    if (!model.modelType) {
      throw new Error('Mathematical model must specify model type');
    }
    
    if (!model.variables || !model.variables.inputVariables) {
      throw new Error('Mathematical model must define input variables');
    }
    
    if (!model.variables.outputVariables || model.variables.outputVariables.length === 0) {
      throw new Error('Mathematical model must define output variables');
    }
    
    // Ensure all required fields are present
    const validatedModel: MathematicalModel = {
      modelType: model.modelType,
      variables: {
        inputVariables: model.variables.inputVariables.map((v: any) => ({
          name: v.name || '',
          type: v.type || 'number',
          range: v.range || '',
          weight: v.weight || '1',
          businessMeaning: v.businessMeaning || ''
        })),
        outputVariables: model.variables.outputVariables.map((v: any) => ({
          name: v.name || '',
          type: v.type || 'number',
          range: v.range || '',
          businessMeaning: v.businessMeaning || ''
        }))
      },
      mathematicalOperations: {
        primaryFormula: model.mathematicalOperations?.primaryFormula || '',
        weightingStrategy: model.mathematicalOperations?.weightingStrategy || '',
        normalizationMethods: model.mathematicalOperations?.normalizationMethods || [],
        aggregationFunctions: model.mathematicalOperations?.aggregationFunctions || [],
        thresholdLogic: model.mathematicalOperations?.thresholdLogic || []
      },
      algorithmDesign: {
        stepByStepProcess: model.algorithmDesign?.stepByStepProcess || [],
        conditionalLogic: model.algorithmDesign?.conditionalLogic || [],
        errorHandlingMath: model.algorithmDesign?.errorHandlingMath || [],
        optimizationOpportunities: model.algorithmDesign?.optimizationOpportunities || []
      },
      businessConstraints: {
        mathematicalConstraints: model.businessConstraints?.mathematicalConstraints || [],
        regulatoryConstraints: model.businessConstraints?.regulatoryConstraints || [],
        performanceConstraints: model.businessConstraints?.performanceConstraints || []
      }
    };
    
    return validatedModel;
  }
  
  optimizeForBusiness(approach: MathematicalApproach, domain: BusinessDomain): MathematicalApproach {
    // Apply business-specific optimizations
    const optimized = { ...approach };
    
    // Add industry-specific optimizations
    if (domain.businessDomain.industry === 'finance') {
      optimized.optimizationTechniques.push('regulatory_compliance_checks');
      optimized.validationChecks.push('risk_threshold_validation');
    }
    
    if (domain.businessDomain.industry === 'sales') {
      optimized.optimizationTechniques.push('real_time_scoring');
      optimized.validationChecks.push('lead_quality_bounds');
    }
    
    if (domain.businessDomain.industry === 'hr') {
      optimized.optimizationTechniques.push('bias_detection');
      optimized.validationChecks.push('fairness_metrics');
    }
    
    if (domain.businessDomain.industry === 'healthcare') {
      optimized.optimizationTechniques.push('patient_safety_checks');
      optimized.validationChecks.push('clinical_guideline_compliance');
    }
    
    // Add complexity-based optimizations
    if (approach.calculationSteps.length > 10) {
      optimized.optimizationTechniques.push('parallel_processing');
      optimized.performanceConsiderations.push('Consider GPU acceleration for matrix operations');
    }
    
    return optimized;
  }

  // Additional helper methods for mathematical operations
  
  async detectPatterns(data: any[], domain: BusinessDomain): Promise<string[]> {
    const patternPrompt = `
TASK: Detect mathematical patterns in the data for ${domain.businessDomain.industry} domain.

DATA SAMPLE: ${JSON.stringify(data.slice(0, 5))}
DATA SIZE: ${data.length} records

Identify patterns such as:
- Linear relationships
- Exponential growth/decay
- Seasonal patterns
- Clustering patterns
- Anomalies

Return array of detected patterns.`;

    const result = await this.aiService.getJSONResponse(patternPrompt);
    return result.patterns || [];
  }

  calculateComplexity(model: MathematicalModel): { timeComplexity: string; spaceComplexity: string } {
    const inputCount = model.variables.inputVariables.length;
    const hasLoops = model.algorithmDesign.stepByStepProcess.some(step => 
      step.includes('iterate') || step.includes('loop') || step.includes('for each')
    );
    const hasRecursion = model.algorithmDesign.stepByStepProcess.some(step => 
      step.includes('recursive') || step.includes('repeat until')
    );
    
    let timeComplexity = 'O(1)';
    let spaceComplexity = 'O(1)';
    
    if (hasRecursion) {
      timeComplexity = 'O(2^n)';
      spaceComplexity = 'O(n)';
    } else if (hasLoops) {
      if (model.modelType === 'polynomial') {
        timeComplexity = 'O(n^2)';
      } else {
        timeComplexity = 'O(n)';
      }
      spaceComplexity = 'O(n)';
    } else if (inputCount > 10) {
      timeComplexity = 'O(n)';
      spaceComplexity = `O(${inputCount})`;
    }
    
    return { timeComplexity, spaceComplexity };
  }
}

// Export convenience function
export function createMathematicalReasoningEngine(aiProvider?: string): MathematicalReasoningEngine {
  return new MathematicalReasoningEngine(new AIService(aiProvider));
}