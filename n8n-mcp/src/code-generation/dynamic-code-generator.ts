import { 
  CodeGenerationRequest, 
  GeneratedCode, 
  CodeContext, 
  CodeEnvironment, 
  LogicPatterns 
} from './types.js';
import { CodeContextAnalyzer } from './code-context-analyzer.js';
import { CodeValidationEngine } from './code-validation-engine.js';
import { CodeOptimizationEngine } from './code-optimization-engine.js';
import { CodeExecutionMonitor } from './code-execution-monitor.js';
import { PythonCodeAdapter } from './language-adapters/python-adapter.js';
import { SQLCodeAdapter } from './language-adapters/sql-adapter.js';
import { TypeScriptCodeAdapter } from './language-adapters/typescript-adapter.js';
import { RCodeAdapter } from './language-adapters/r-adapter.js';
import { AdvancedPerformanceMetrics } from './performance/advanced-metrics.js';
import { PerformanceProfiler } from './performance/performance-profiler.js';
import { AdvancedPromptingEngine } from './prompting/advanced-prompting-engine.js';
import { CodeVersionManager, VersionMetadata } from './versioning/code-version-manager.js';
import { AIService } from '../ai-service.js';
import { 
  CodeGenerationError, 
  ValidationError, 
  SecurityError, 
  AIServiceError,
  LanguageAdapterError,
  VersioningError,
  ErrorHandler 
} from './errors/custom-errors.js';
import { 
  ExecutionContext, 
  ValidationContext,
  CodeMetadata,
  RequestParameters 
} from './types/common-types.js';
import { ProfilingOptions, PerformanceProfile } from './performance/performance-profiler.js';

export class DynamicCodeGenerator {
  private aiService: AIService;
  private contextAnalyzer: CodeContextAnalyzer;
  private validationEngine: CodeValidationEngine;
  private optimizationEngine: CodeOptimizationEngine;
  private executionMonitor: CodeExecutionMonitor;
  private pythonAdapter: PythonCodeAdapter;
  private sqlAdapter: SQLCodeAdapter;
  private typeScriptAdapter: TypeScriptCodeAdapter;
  private rAdapter: RCodeAdapter;
  private performanceMetrics: AdvancedPerformanceMetrics;
  private performanceProfiler: PerformanceProfiler;
  private promptingEngine: AdvancedPromptingEngine;
  private versionManager: CodeVersionManager;
  private generatedCodeCache: Map<string, GeneratedCode>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.contextAnalyzer = new CodeContextAnalyzer(provider);
    this.validationEngine = new CodeValidationEngine(provider);
    this.optimizationEngine = new CodeOptimizationEngine(provider);
    this.executionMonitor = new CodeExecutionMonitor(provider);
    this.pythonAdapter = new PythonCodeAdapter(provider);
    this.sqlAdapter = new SQLCodeAdapter(provider);
    this.typeScriptAdapter = new TypeScriptCodeAdapter(provider);
    this.rAdapter = new RCodeAdapter(provider);
    this.performanceMetrics = new AdvancedPerformanceMetrics(provider);
    this.performanceProfiler = new PerformanceProfiler(provider);
    this.promptingEngine = new AdvancedPromptingEngine(provider);
    this.versionManager = new CodeVersionManager(provider);
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
      
      // Create code version
      const codeId = this.generateCodeId(request);
      const versionMetadata: VersionMetadata = {
        description: `Generated code for: ${request.description}`,
        changeType: 'major',
        changes: ['Initial code generation'],
        context: context as unknown as Record<string, unknown>,
        request: request as unknown as Record<string, unknown>,
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
          outputFormat: (request.requirements?.outputFormat === 'table' ? 'table' : request.requirements?.outputFormat as 'json' | 'table' | 'csv') || 'json',
          performanceOptimized: request.requirements?.performanceLevel === 'optimized'
        });
        
      case 'typescript':
      case 'ts':
        return this.typeScriptAdapter.generateTypeScriptCode(request, context, {
          strict: request.requirements?.strict ?? true,
          targetES: (['ES2020', 'ES2021', 'ES2022', 'ESNext'].includes(request.requirements?.targetES as string) ? request.requirements?.targetES as 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext' : 'ES2020'),
          moduleSystem: (request.requirements?.moduleSystem === 'es6' ? 'esm' : 'commonjs') as 'commonjs' | 'esm',
          includeTypes: true,
          asyncAwait: true,
          errorHandling: 'try-catch' as 'try-catch' | 'result-type' | 'promises'
        });
        
      case 'r':
        return this.rAdapter.generateRCode(request, context, {
          libraries: request.requirements?.libraries,
          tidyverse: request.requirements?.tidyverse ?? true,
          includeVisualization: request.requirements?.includeVisualization,
          outputFormat: (request.requirements?.outputFormat === 'table' ? 'dataframe' : request.requirements?.outputFormat as 'json' | 'csv' | 'dataframe' | 'list') || 'json',
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
    executionContext: ExecutionContext
  ): Promise<unknown> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      throw new ValidationError(
        `Code with ID ${codeId} not found in cache`,
        { field: 'codeId', value: codeId }
      );
    }
    
    // Validate code security before execution
    const securityCheck = this.validateCodeSecurity(generatedCode.code);
    if (!securityCheck.isSecure) {
      console.error('Security validation failed:', securityCheck.issues);
      throw new SecurityError(
        'Code execution blocked due to security issues',
        securityCheck.issues,
        'critical'
      );
    }
    
    // Monitor the execution in sandbox
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
      throw new CodeGenerationError(
        executionResult.error || 'Code execution failed',
        'EXECUTION_ERROR',
        { codeId, executionContext }
      );
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

  async collectAdvancedMetrics(
    codeId: string,
    executionContext?: ExecutionContext
  ): Promise<{
    metrics: unknown;
    report: string;
  }> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      throw new ValidationError(
        `Code with ID ${codeId} not found in cache`,
        { field: 'codeId', value: codeId }
      );
    }
    
    // Collect detailed performance metrics
    const detailedMetrics = await this.performanceMetrics.collectDetailedMetrics(
      codeId,
      generatedCode.code,
      executionContext || this.createDefaultExecutionContext()
    );
    
    // Generate comprehensive report
    const report = await this.performanceMetrics.generateMetricsReport(codeId);
    
    return {
      metrics: detailedMetrics,
      report
    };
  }

  async getCodeQualityScore(codeId: string): Promise<number> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      return 0;
    }
    
    const metrics = await this.performanceMetrics.collectDetailedMetrics(
      codeId,
      generatedCode.code,
      this.createDefaultExecutionContext()
    );
    
    // Calculate overall quality score
    const qualityFactors = [
      metrics.codeQuality.maintainabilityIndex,
      metrics.codeQuality.readabilityScore,
      metrics.codeQuality.documentationScore,
      metrics.security.securityScore,
      100 - metrics.codeQuality.cyclomaticComplexity * 5
    ];
    
    return Math.round(
      qualityFactors.reduce((sum, score) => sum + score, 0) / qualityFactors.length
    );
  }

  private createDefaultExecutionContext(): ExecutionContext {
    return {
      $input: {
        all: () => [
          { json: { id: 1, data: 'test' } }
        ],
        first: () => ({ json: { id: 1, data: 'test' } }),
        last: () => ({ json: { id: 1, data: 'test' } }),
        item: (index: number) => ({ json: { id: 1, data: 'test' } })
      },
      $json: {},
      $node: {
        name: 'DefaultNode',
        type: 'code',
        typeVersion: 1,
        position: [0, 0] as [number, number],
        parameters: {}
      },
      $workflow: {
        name: 'DefaultWorkflow',
        active: true
      },
      $item: { index: 0 },
      $: () => ({
        name: 'DefaultNode',
        type: 'code',
        typeVersion: 1,
        position: [0, 0] as [number, number],
        parameters: {}
      })
    };
  }

  private validateCodeSecurity(code: string): { isSecure: boolean; issues: string[] } {
    const issues: string[] = [];
    const dangerousPatterns = [
      { pattern: /\beval\s*\(/g, message: 'eval() function detected - high security risk' },
      { pattern: /new\s+Function\s*\(/g, message: 'Function constructor detected - potential security risk' },
      { pattern: /\bsetTimeout\s*\([^,]+,/g, message: 'setTimeout with string argument detected' },
      { pattern: /\bsetInterval\s*\([^,]+,/g, message: 'setInterval with string argument detected' },
      { pattern: /\brequire\s*\(\s*[^'"]/g, message: 'Dynamic require detected - potential security risk' },
      { pattern: /\bprocess\.env/g, message: 'Environment variable access detected' },
      { pattern: /\bchild_process/g, message: 'Child process execution detected' },
      { pattern: /\bfs\s*\.\s*(unlink|rmdir|rm)/g, message: 'File deletion operation detected' },
      { pattern: /\b__dirname/g, message: 'Directory path access detected' },
      { pattern: /\b__filename/g, message: 'File path access detected' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }

    return {
      isSecure: issues.length === 0,
      issues
    };
  }

  async executeInSandbox(code: string, context: ExecutionContext): Promise<unknown> {
    // Validate code security first
    const securityCheck = this.validateCodeSecurity(code);
    
    if (!securityCheck.isSecure) {
      throw new SecurityError(
        'Code security validation failed',
        securityCheck.issues,
        'high'
      );
    }

    try {
      // Create a restricted context
      const safeContext = {
        ...context,
        // Block dangerous globals
        eval: undefined,
        Function: undefined,
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
        require: undefined,
        process: undefined,
        __dirname: undefined,
        __filename: undefined
      };

      // Execute in restricted environment
      const fn = new Function(...Object.keys(safeContext), code);
      return await fn(...Object.values(safeContext));
    } catch (error) {
      const customError = ErrorHandler.handle(error);
      throw new CodeGenerationError(
        `Code execution failed: ${customError.message}`,
        'SANDBOX_EXECUTION_ERROR',
        { originalError: customError }
      );
    }
  }

  async getCodeVersions(codeId: string) {
    return this.versionManager.getVersionHistory(codeId);
  }

  async compareCodeVersions(codeId: string, versionAId: string, versionBId: string) {
    return this.versionManager.compareVersions(codeId, versionAId, versionBId);
  }

  async rollbackCode(codeId: string, targetVersionId: string, reason: string) {
    return this.versionManager.rollback({
      codeId,
      targetVersion: targetVersionId,
      reason
    });
  }

  async getActiveCodeVersion(codeId: string) {
    return this.versionManager.getActiveVersion(codeId);
  }

  async autoSelectBestVersion(codeId: string) {
    return this.versionManager.autoSelectBestVersion(codeId);
  }

  async deployCodeVersion(codeId: string, versionId: string, environment: string) {
    return this.versionManager.deployVersion(codeId, versionId, environment);
  }

  async generateVersionReport(codeId: string) {
    return this.versionManager.generateVersionReport(codeId);
  }

  async improveCode(codeId: string, improvements: string[], reason: string) {
    // Get the active version
    const activeVersion = await this.versionManager.getActiveVersion(codeId);
    if (!activeVersion) {
      throw new VersioningError(
        'No active version found',
        codeId,
        'getActiveVersion'
      );
    }
    
    // Generate improved code based on feedback
    const improvementRequest = `
Improve this code based on the following feedback:

Current Code:
${activeVersion.code}

Improvements requested:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

Reason for improvements: ${reason}

Generate the improved code maintaining all existing functionality while addressing the requested improvements.`;

    const improvedCode = await this.aiService.callAI(improvementRequest);
    
    // Clean the improved code
    let cleanCode = improvedCode;
    cleanCode = cleanCode.replace(/```javascript\n?/g, '');
    cleanCode = cleanCode.replace(/```\n?/g, '');
    cleanCode = cleanCode.trim();
    
    // Create new version with improvements
    const versionMetadata: VersionMetadata = {
      description: `Improvements based on feedback: ${reason}`,
      changeType: 'minor',
      changes: improvements,
      context: activeVersion.metadata.context,
      request: activeVersion.metadata.request,
      improvements: improvements,
      regressions: []
    };
    
    const newVersion = await this.versionManager.createVersion(
      codeId,
      cleanCode,
      versionMetadata,
      'improvement_system'
    );
    
    return newVersion;
  }

  async profileCode(
    codeId: string,
    options?: ProfilingOptions
  ): Promise<PerformanceProfile> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      throw new ValidationError(
        `Code with ID ${codeId} not found in cache`,
        { field: 'codeId', value: codeId }
      );
    }
    
    // Profile the code execution
    const profile = await this.performanceProfiler.profileCodeExecution(
      codeId,
      generatedCode.code,
      this.createDefaultExecutionContext(),
      options
    );
    
    return profile;
  }

  async optimizeCodeWithProfile(
    codeId: string,
    profileId?: string
  ): Promise<{
    originalProfile: PerformanceProfile;
    optimizedProfile: PerformanceProfile;
    comparison: unknown;
    newVersion: unknown;
  }> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      throw new ValidationError(
        `Code with ID ${codeId} not found in cache`,
        { field: 'codeId', value: codeId }
      );
    }
    
    // Get or create performance profile
    let profile;
    if (profileId) {
      // Use existing profile
      profile = await this.getProfile(profileId);
    } else {
      // Create new profile
      profile = await this.profileCode(codeId);
    }
    
    // Optimize code based on profile
    const optimizedCode = await this.performanceProfiler.optimizeCode(
      codeId,
      generatedCode.code,
      profile
    );
    
    // Create new version with optimized code
    const versionMetadata: VersionMetadata = {
      description: `Performance optimization based on profiling`,
      changeType: 'minor',
      changes: profile.optimizationSuggestions.map(s => s.description),
      context: generatedCode.context as unknown as Record<string, unknown>,
      request: { description: 'Performance optimization', nodeType: 'code', workflowContext: {} } as Record<string, unknown>,
      improvements: profile.optimizationSuggestions.map(s => 
        `${s.description} (${s.expectedImprovement}% improvement)`
      ),
      regressions: []
    };
    
    const newVersion = await this.versionManager.createVersion(
      codeId,
      optimizedCode,
      versionMetadata,
      'performance_optimizer'
    );
    
    // Update cache with optimized code
    generatedCode.code = optimizedCode;
    this.generatedCodeCache.set(codeId, generatedCode);
    
    // Re-profile to measure improvement
    const newProfile = await this.profileCode(codeId);
    
    // Compare profiles
    const comparison = await this.performanceProfiler.compareProfiles(
      profile.id,
      newProfile.id
    );
    
    return {
      originalProfile: profile,
      optimizedProfile: newProfile,
      comparison,
      newVersion
    };
  }

  async getProfile(profileId: string): Promise<PerformanceProfile> {
    // This would retrieve from cache or database
    throw new CodeGenerationError(
      'Profile retrieval not implemented',
      'NOT_IMPLEMENTED',
      { profileId }
    );
  }

  async generatePerformanceReport(codeId: string): Promise<string> {
    const generatedCode = this.generatedCodeCache.get(codeId);
    
    if (!generatedCode) {
      throw new ValidationError(
        `Code with ID ${codeId} not found in cache`,
        { field: 'codeId', value: codeId }
      );
    }
    
    // Profile the code
    const profile = await this.profileCode(codeId);
    
    // Generate report
    return this.performanceProfiler.generatePerformanceReport(profile);
  }

  async compareCodePerformance(
    codeId1: string,
    codeId2: string
  ): Promise<unknown> {
    // Profile both codes
    const [profile1, profile2] = await Promise.all([
      this.profileCode(codeId1),
      this.profileCode(codeId2)
    ]);
    
    // Compare profiles
    return this.performanceProfiler.compareProfiles(profile1.id, profile2.id);
  }

  private generateCodeId(request: CodeGenerationRequest): string {
    const hash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
    
    return `code_${request.nodeType}_${hash.substring(0, 8)}_${Date.now()}`;
  }
}