// Dynamic Code Generation System Types

export interface CodeGenerationRequest {
  description: string;
  nodeType: string;
  workflowContext: {
    previousNodes?: NodeContext[];
    nextNodes?: NodeContext[];
    workflowPurpose?: string;
    availableData?: DataStructure[];
  };
  requirements?: {
    language?: 'javascript' | 'python';
    performanceLevel?: 'standard' | 'optimized' | 'extreme';
    errorHandling?: 'basic' | 'comprehensive' | 'enterprise';
  };
}

export interface NodeContext {
  id: string;
  type: string;
  outputData?: DataStructure;
  configuration?: Record<string, any>;
}

export interface DataStructure {
  name: string;
  type: string;
  schema?: Record<string, any>;
  example?: any;
}

export interface CodeContext {
  intent: {
    primaryFunction: string;
    dataTransformation: string;
    businessLogic: string;
    integrationNeeds: string;
    performanceRequirements: string;
  };
  technicalRequirements: {
    inputDataStructure: string;
    outputDataStructure: string;
    errorHandling: string;
    validation: string;
    algorithms: string;
  };
  codeComplexity: {
    level: 'simple' | 'moderate' | 'complex' | 'advanced';
    estimatedLines: number;
    requiredLibraries: string[];
    asyncOperations: boolean;
    errorProneParts: string[];
  };
  optimizationOpportunities: {
    performance: string[];
    readability: string[];
    maintainability: string[];
    security: string[];
  };
}

export interface CodeEnvironment {
  runtime: 'node' | 'browser';
  version: string;
  availableLibraries: string[];
  restrictions: string[];
  bestPractices: string[];
}

export interface LogicPatterns {
  dataProcessing: string[];
  algorithmicPatterns: string[];
  errorHandlingPatterns: string[];
  optimizationPatterns: string[];
}

export interface GeneratedCode {
  success: boolean;
  code: string;
  context: CodeContext;
  metadata: CodeMetadata;
  validation?: ValidationResult;
}

export interface CodeMetadata {
  language: string;
  estimatedExecutionTime: number;
  memoryFootprint: string;
  complexity: number;
  maintainabilityScore: number;
  securityScore: number;
  generatedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
  securityWarnings?: string[];
}

export interface ValidationIssue {
  type: 'syntax' | 'logic' | 'security' | 'performance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
}

export interface CodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  logs?: string[];
  performanceIssues?: PerformanceIssue[];
}

export interface ExecutionMetrics {
  codeId: string;
  executionTime: number;
  memoryUsed: number;
  success: boolean;
  error?: string;
  timestamp: string;
  inputSize: number;
  outputSize: number;
}

export interface PerformanceIssue {
  type: 'slow_execution' | 'high_memory' | 'data_explosion' | 'runtime_error';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  suggestion: string;
}

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  usage: string[];
  performance: number;
  reliability: number;
  category: 'validation' | 'calculation' | 'transformation' | 'integration';
}

export interface LearningData {
  request: CodeGenerationRequest;
  generatedCode: string;
  executionResult: CodeExecutionResult;
  userFeedback?: {
    satisfaction: number;
    issues?: string[];
    improvements?: string[];
  };
  patterns: CodePattern[];
  timestamp: string;
}