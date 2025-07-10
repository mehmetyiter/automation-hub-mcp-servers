import { 
  CodeGenerationRequest, 
  GeneratedCode, 
  CodeContext, 
  CodeEnvironment, 
  LogicPatterns 
} from './types';
import { CodeContextAnalyzer } from './code-context-analyzer';
import { CodeValidationEngine } from './code-validation-engine';
import { CodeOptimizationEngine } from './code-optimization-engine';
import { CodeExecutionMonitor } from './code-execution-monitor';
import { PythonCodeAdapter } from './language-adapters/python-adapter';
import { AIService } from '../ai-service';

export class DynamicCodeGenerator {
  private aiService: AIService;
  private contextAnalyzer: CodeContextAnalyzer;
  private validationEngine: CodeValidationEngine;
  private optimizationEngine: CodeOptimizationEngine;
  private executionMonitor: CodeExecutionMonitor;
  private pythonAdapter: PythonCodeAdapter;
  private generatedCodeCache: Map<string, GeneratedCode>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.contextAnalyzer = new CodeContextAnalyzer(provider);
    this.validationEngine = new CodeValidationEngine(provider);
    this.optimizationEngine = new CodeOptimizationEngine(provider);
    this.executionMonitor = new CodeExecutionMonitor(provider);
    this.pythonAdapter = new PythonCodeAdapter(provider);
    this.generatedCodeCache = new Map();
  }

  async generateCode(request: CodeGenerationRequest): Promise<GeneratedCode> {
    console.log('🧠 AI-Driven Dynamic Code Generation Started...');
    
    try {
      // Phase 1: Deep Context Analysis
      console.log('📊 Analyzing code context...');
      const context = await this.contextAnalyzer.analyzeContext(request);
      
      // Phase 2: Language & Framework Detection
      console.log('🔍 Detecting environment...');
      const environment = await this.contextAnalyzer.detectEnvironment(context);
      
      // Phase 3: Logic Pattern Recognition
      console.log('🧩 Recognizing logic patterns...');
      const patterns = await this.contextAnalyzer.recognizeLogicPatterns(context);
      
      // Phase 4: Dynamic Code Generation
      console.log('⚡ Generating dynamic code...');
      const rawCode = await this.generateDynamicCode(context, environment, patterns, request);
      
      // Phase 5: Validation
      console.log('✅ Validating code...');
      const language = request.requirements?.language || 'javascript';
      const validationResult = await this.validationEngine.validateCode(rawCode, context, language);
      
      // Phase 6: Optimization (skip for Python for now)
      console.log('🚀 Optimizing code...');
      const optimizedCode = language === 'python' 
        ? rawCode 
        : await this.optimizationEngine.optimizeCode(rawCode, context);
      
      // Phase 7: Final Validation
      const finalValidation = await this.validationEngine.validateCode(optimizedCode, context, language);
      
      // Generate metadata
      const metadata = this.optimizationEngine.generateMetadata(optimizedCode, context);
      
      console.log('✨ Code generation completed successfully!');
      
      return {
        success: true,
        code: optimizedCode,
        context,
        metadata,
        validation: finalValidation
      };
    } catch (error: any) {
      console.error('❌ Code generation failed:', error);
      
      // Generate fallback code
      const fallbackCode = this.generateFallbackCode(request);
      const context = await this.contextAnalyzer.analyzeContext(request);
      
      return {
        success: false,
        code: fallbackCode,
        context,
        metadata: this.optimizationEngine.generateMetadata(fallbackCode, context),
        validation: {
          isValid: true,
          issues: [{
            type: 'logic',
            severity: 'warning',
            message: 'Fallback code generated due to error: ' + error.message
          }],
          suggestions: ['Review and customize the generated code']
        }
      };
    }
  }

  private async generateDynamicCode(
    context: CodeContext, 
    environment: CodeEnvironment, 
    patterns: LogicPatterns,
    request: CodeGenerationRequest
  ): Promise<string> {
    
    // Check if Python is requested
    if (request.requirements?.language === 'python') {
      return this.pythonAdapter.generatePythonCode(request, context);
    }
    
    // Default to JavaScript
    const codeGenerationPrompt = `
TASK: Generate production-ready JavaScript code for n8n Code Node based on detailed analysis.

USER REQUEST: "${request.description}"

CONTEXT ANALYSIS:
${JSON.stringify(context, null, 2)}

ENVIRONMENT:
${JSON.stringify(environment, null, 2)}

LOGIC PATTERNS:
${JSON.stringify(patterns, null, 2)}

WORKFLOW CONTEXT:
${JSON.stringify(request.workflowContext, null, 2)}

Generate complete, executable JavaScript code that:

1. **IMPLEMENTS SPECIFIC BUSINESS LOGIC** (not generic "return items")
2. **HANDLES INPUT DATA VALIDATION**
3. **PERFORMS REQUIRED CALCULATIONS/TRANSFORMATIONS**
4. **INCLUDES COMPREHENSIVE ERROR HANDLING**
5. **OPTIMIZES FOR PERFORMANCE**
6. **FOLLOWS n8n BEST PRACTICES**

CODE REQUIREMENTS:
- Use const/let appropriately (no var)
- Include detailed comments for complex logic
- Handle edge cases (empty input, null values, type mismatches)
- Validate input data structure
- Return proper n8n data structure: [{json: {...}}]
- Include error logging with context
- Optimize for readability and maintenance

CRITICAL GUIDELINES:
❌ DO NOT return generic "return items;"
❌ DO NOT use placeholder comments like "// Add your logic here"
❌ DO NOT skip error handling
❌ DO NOT ignore the specific request details
✅ DO implement actual business logic based on the request
✅ DO include specific calculations/transformations requested
✅ DO handle real data transformations
✅ DO provide production-ready code
✅ DO add meaningful variable names
✅ DO structure code logically

RESPONSE FORMAT:
Return ONLY the JavaScript code, no markdown formatting, no explanations.
The code should be ready to paste directly into n8n Code Node.

Based on the analysis, generate code that specifically addresses: ${context.intent.primaryFunction}`;

    const generatedCode = await this.aiService.callAI(codeGenerationPrompt);
    
    // Clean the generated code
    let cleanCode = generatedCode;
    
    // Remove markdown if present
    cleanCode = cleanCode.replace(/```javascript\n?/g, '');
    cleanCode = cleanCode.replace(/```\n?/g, '');
    cleanCode = cleanCode.trim();
    
    // Ensure the code has proper structure
    if (!cleanCode.includes('$input')) {
      cleanCode = this.addInputHandling(cleanCode);
    }
    
    if (!cleanCode.includes('return')) {
      cleanCode = this.addReturnStatement(cleanCode);
    }
    
    return cleanCode;
  }

  private addInputHandling(code: string): string {
    const inputHandling = `// Get input items
const inputItems = $input.all();

// Validate input
if (!inputItems || inputItems.length === 0) {
  return [];
}

`;
    
    return inputHandling + code;
  }

  private addReturnStatement(code: string): string {
    // Find the last processed data variable
    const processedVarMatch = code.match(/(?:const|let)\s+(\w*[Rr]esult\w*|\w*[Dd]ata\w*|\w*[Ii]tems\w*)\s*=/);
    
    if (processedVarMatch) {
      const varName = processedVarMatch[1];
      return code + `\n\n// Return processed items\nreturn ${varName};`;
    }
    
    return code + '\n\n// Return processed items\nreturn processedItems;';
  }

  private generateFallbackCode(request: CodeGenerationRequest): string {
    // Check if Python is requested
    if (request.requirements?.language === 'python') {
      return this.pythonAdapter.generatePythonFallbackCode(request);
    }
    
    // JavaScript fallback
    const description = request.description.toLowerCase();
    
    // Generate context-aware fallback code
    let code = `// Fallback code for: ${request.description}
// Please customize this code according to your specific needs

// Get input items from previous node
const inputItems = $input.all();

// Validate input
if (!inputItems || inputItems.length === 0) {
  console.log('No input items received');
  return [];
}

// Process each item
const processedItems = [];

for (const item of inputItems) {
  try {
    // Extract data from current item
    const data = item.json;
    
`;

    // Add specific logic based on keywords
    if (description.includes('calculate') || description.includes('sum') || description.includes('total')) {
      code += `    // Perform calculation
    const result = {
      ...data,
      // Add your calculation here
      calculated_value: 0, // Replace with actual calculation
      processed_at: new Date().toISOString()
    };
`;
    } else if (description.includes('filter')) {
      code += `    // Apply filter logic
    // Modify this condition based on your requirements
    if (data.someProperty) { // Replace with actual filter condition
      const result = {
        ...data,
        filtered: true,
        processed_at: new Date().toISOString()
      };
`;
    } else if (description.includes('transform') || description.includes('convert')) {
      code += `    // Transform data
    const result = {
      // Map your fields here
      id: data.id,
      // Add transformed fields
      transformed_field: data.originalField, // Replace with transformation
      processed_at: new Date().toISOString()
    };
`;
    } else if (description.includes('validate')) {
      code += `    // Validate data
    const isValid = data.requiredField !== undefined; // Replace with validation logic
    
    const result = {
      ...data,
      is_valid: isValid,
      validation_errors: isValid ? [] : ['Missing required field'],
      processed_at: new Date().toISOString()
    };
`;
    } else {
      code += `    // Process data
    const result = {
      ...data,
      // Add your processing logic here
      processed: true,
      processed_at: new Date().toISOString()
    };
`;
    }

    code += `
    // Add to processed items
    processedItems.push({
      json: result
    });
    
  } catch (error) {
    console.error('Error processing item:', item.json, error);
    
    // Add error item
    processedItems.push({
      json: {
        ...item.json,
        error: error.message,
        processing_failed: true
      }
    });
  }
}

// Return all processed items
return processedItems;`;

    return code;
  }

  async generateCodeForNode(nodeType: string, configuration: any): Promise<string> {
    // Generate code specific to n8n node types
    const request: CodeGenerationRequest = {
      description: `Generate code for ${nodeType} node with configuration: ${JSON.stringify(configuration)}`,
      nodeType,
      workflowContext: {
        workflowPurpose: 'Data processing'
      }
    };
    
    const result = await this.generateCode(request);
    
    // Cache the generated code with a unique ID
    const codeId = this.generateCodeId(request);
    this.generatedCodeCache.set(codeId, result);
    
    return result.code;
  }

  async executeGeneratedCode(
    codeId: string, 
    executionContext: any
  ): Promise<any> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      throw new Error(`Code with ID ${codeId} not found in cache`);
    }
    
    // Monitor the execution
    const executionResult = await this.executionMonitor.monitorExecution(
      codeId,
      {
        description: generatedCode.context.intent.primaryFunction,
        nodeType: 'code',
        workflowContext: {}
      },
      generatedCode.code,
      executionContext
    );
    
    if (!executionResult.success) {
      console.error('Code execution failed:', executionResult.error);
      throw new Error(executionResult.error || 'Code execution failed');
    }
    
    return executionResult.output;
  }

  async getExecutionStats(codeId: string) {
    return this.executionMonitor.getExecutionStats(codeId);
  }

  async provideFeedback(
    codeId: string, 
    feedback: {
      rating: number;
      worked: boolean;
      issues?: string[];
      suggestions?: string[];
    }
  ): Promise<void> {
    return this.executionMonitor.provideFeedback(codeId, feedback);
  }

  async getPerformanceReport(codeId: string): Promise<string> {
    return this.executionMonitor.generatePerformanceReport(codeId);
  }

  private generateCodeId(request: CodeGenerationRequest): string {
    const hash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
    
    return `code_${request.nodeType}_${hash.substring(0, 8)}_${Date.now()}`;
  }
}