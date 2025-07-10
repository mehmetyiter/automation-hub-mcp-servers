/**
 * Refactored Dynamic Code Generator with Dependency Injection
 */

import { 
  CodeGenerationRequest, 
  GeneratedCode, 
  CodeContext, 
  CodeEnvironment, 
  LogicPatterns 
} from './types';
import { 
  CodeGenerationError, 
  ValidationError, 
  SecurityError, 
  VersioningError,
  ErrorHandler 
} from './errors/custom-errors';
import { 
  ExecutionContext, 
  ValidationContext,
  CodeMetadata,
  RequestParameters 
} from './types/common-types';
import { ProfilingOptions, PerformanceProfile } from './performance/performance-profiler';
import { IServiceContainer, ServiceTokens } from './dependency-injection/container';
import { CodeContextAnalyzer } from './code-context-analyzer';
import { CodeValidationEngine } from './code-validation-engine';
import { CodeOptimizationEngine } from './code-optimization-engine';
import { CodeExecutionMonitor } from './code-execution-monitor';
import { PythonCodeAdapter } from './language-adapters/python-adapter';
import { SQLCodeAdapter } from './language-adapters/sql-adapter';
import { TypeScriptCodeAdapter } from './language-adapters/typescript-adapter';
import { RCodeAdapter } from './language-adapters/r-adapter';
import { AdvancedPerformanceMetrics } from './performance/advanced-metrics';
import { PerformanceProfiler } from './performance/performance-profiler';
import { AdvancedPromptingEngine } from './prompting/advanced-prompting-engine';
import { CodeVersionManager, VersionMetadata } from './versioning/code-version-manager';
import { AIService } from '../ai-service';

export class DynamicCodeGeneratorDI {
  private readonly aiService: AIService;
  private readonly contextAnalyzer: CodeContextAnalyzer;
  private readonly validationEngine: CodeValidationEngine;
  private readonly optimizationEngine: CodeOptimizationEngine;
  private readonly executionMonitor: CodeExecutionMonitor;
  private readonly pythonAdapter: PythonCodeAdapter;
  private readonly sqlAdapter: SQLCodeAdapter;
  private readonly typeScriptAdapter: TypeScriptCodeAdapter;
  private readonly rAdapter: RCodeAdapter;
  private readonly performanceMetrics: AdvancedPerformanceMetrics;
  private readonly performanceProfiler: PerformanceProfiler;
  private readonly promptingEngine: AdvancedPromptingEngine;
  private readonly versionManager: CodeVersionManager;
  private generatedCodeCache: Map<string, GeneratedCode>;

  constructor(private container: IServiceContainer) {
    // Resolve all dependencies from the container
    this.aiService = container.resolve<AIService>(ServiceTokens.AI_SERVICE);
    this.contextAnalyzer = container.resolve<CodeContextAnalyzer>(ServiceTokens.CODE_CONTEXT_ANALYZER);
    this.validationEngine = container.resolve<CodeValidationEngine>(ServiceTokens.CODE_VALIDATION_ENGINE);
    this.optimizationEngine = container.resolve<CodeOptimizationEngine>(ServiceTokens.CODE_OPTIMIZATION_ENGINE);
    this.executionMonitor = container.resolve<CodeExecutionMonitor>(ServiceTokens.CODE_EXECUTION_MONITOR);
    this.pythonAdapter = container.resolve<PythonCodeAdapter>(ServiceTokens.PYTHON_ADAPTER);
    this.sqlAdapter = container.resolve<SQLCodeAdapter>(ServiceTokens.SQL_ADAPTER);
    this.typeScriptAdapter = container.resolve<TypeScriptCodeAdapter>(ServiceTokens.TYPESCRIPT_ADAPTER);
    this.rAdapter = container.resolve<RCodeAdapter>(ServiceTokens.R_ADAPTER);
    this.performanceMetrics = container.resolve<AdvancedPerformanceMetrics>(ServiceTokens.PERFORMANCE_METRICS);
    this.performanceProfiler = container.resolve<PerformanceProfiler>(ServiceTokens.PERFORMANCE_PROFILER);
    this.promptingEngine = container.resolve<AdvancedPromptingEngine>(ServiceTokens.PROMPTING_ENGINE);
    this.versionManager = container.resolve<CodeVersionManager>(ServiceTokens.VERSION_MANAGER);
    this.generatedCodeCache = new Map();
  }

  /**
   * Create a new instance with dependency injection
   */
  static create(container: IServiceContainer): DynamicCodeGeneratorDI {
    return new DynamicCodeGeneratorDI(container);
  }

  /**
   * Get a scoped instance with isolated dependencies
   */
  static createScoped(container: IServiceContainer): DynamicCodeGeneratorDI {
    const scopedContainer = container.createScope();
    return new DynamicCodeGeneratorDI(scopedContainer);
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
      
      // Create code version
      const codeId = this.generateCodeId(request);
      const versionMetadata: VersionMetadata = {
        description: `Generated code for: ${request.description}`,
        changeType: 'major',
        changes: ['Initial code generation'],
        context,
        request,
        improvements: [],
        regressions: []
      };
      
      await this.versionManager.createVersion(
        codeId,
        optimizedCode,
        versionMetadata,
        'ai_generator'
      );
      
      console.log('✨ Code generation completed successfully!');
      
      return {
        success: true,
        code: optimizedCode,
        context,
        metadata,
        validation: finalValidation
      };
    } catch (error) {
      const customError = ErrorHandler.handle(error);
      console.error('❌ Code generation failed:', customError);
      
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
            message: `Fallback code generated due to error: ${customError.message} (${customError.code})`
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
    
    const language = request.requirements?.language?.toLowerCase() || 'javascript';
    
    // Route to appropriate language adapter
    switch (language) {
      case 'python':
        return this.pythonAdapter.generatePythonCode(request, context);
        
      case 'sql':
      case 'mysql':
      case 'postgresql':
      case 'sqlite':
      case 'mssql':
      case 'oracle':
        const dialect = language === 'sql' ? 'postgresql' : language;
        return this.sqlAdapter.generateSQLCode(request, context, {
          dialect: dialect as 'mysql' | 'postgresql' | 'sqlite' | 'mssql' | 'oracle',
          includeTransactions: request.requirements?.includeTransactions,
          includeErrorHandling: true,
          outputFormat: (request.requirements?.outputFormat as 'json' | 'table' | 'csv') || 'json',
          performanceOptimized: request.requirements?.performanceLevel === 'optimized'
        });
        
      case 'typescript':
      case 'ts':
        return this.typeScriptAdapter.generateTypeScriptCode(request, context, {
          strict: request.requirements?.strict ?? true,
          targetES: (request.requirements?.targetES as 'ES2015' | 'ES2016' | 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext') || 'ES2020',
          moduleSystem: (request.requirements?.moduleSystem as 'commonjs' | 'es6' | 'amd' | 'umd' | 'system') || 'commonjs',
          includeTypes: true,
          asyncAwait: true,
          errorHandling: (request.requirements?.errorHandling as 'try-catch' | 'promise' | 'async-await' | 'callback') || 'try-catch'
        });
        
      case 'r':
        return this.rAdapter.generateRCode(request, context, {
          libraries: request.requirements?.libraries,
          tidyverse: request.requirements?.tidyverse ?? true,
          includeVisualization: request.requirements?.includeVisualization,
          outputFormat: (request.requirements?.outputFormat as 'json' | 'csv' | 'dataframe') || 'json',
          statisticalAnalysis: request.requirements?.statisticalAnalysis,
          parallel: request.requirements?.parallel
        });
        
      case 'javascript':
      case 'js':
      default:
        // Use advanced prompting engine for JavaScript
        const enhancedPrompt = await this.promptingEngine.generateContextAwarePrompt(request);
        const formattedPrompt = this.promptingEngine.formatPromptForAI(enhancedPrompt, request);
        
        // Generate code using enhanced prompt
        console.log('🎯 Using advanced prompting strategy...');
        const generatedCode = await this.aiService.callAI(formattedPrompt);
        
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
  }

  // ... Rest of the methods remain the same but use injected dependencies ...

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
    const language = request.requirements?.language?.toLowerCase() || 'javascript';
    
    // Route to appropriate fallback generator
    switch (language) {
      case 'python':
        return this.pythonAdapter.generatePythonFallbackCode(request);
        
      case 'sql':
      case 'mysql':
      case 'postgresql':
      case 'sqlite':
      case 'mssql':
      case 'oracle':
        const dialect = language === 'sql' ? 'postgresql' : language;
        return this.sqlAdapter.generateSQLFallbackCode(request, dialect);
        
      case 'typescript':
      case 'ts':
        return this.typeScriptAdapter.generateTypeScriptFallbackCode(request, {
          strict: true,
          includeTypes: true,
          errorHandling: 'try-catch'
        });
        
      case 'r':
        return this.rAdapter.generateRFallbackCode(request, {
          tidyverse: true,
          outputFormat: 'json'
        });
        
      case 'javascript':
      case 'js':
      default:
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
  }

  private generateCodeId(request: CodeGenerationRequest): string {
    const hash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
    
    return `code_${request.nodeType}_${hash.substring(0, 8)}_${Date.now()}`;
  }
}