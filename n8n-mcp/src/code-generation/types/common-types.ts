/**
 * Common type definitions to replace 'any' types throughout the code generation system
 */

// Execution context types
export interface ExecutionContext {
  $input: {
    all: () => InputItem[];
    first: () => InputItem | undefined;
    last: () => InputItem | undefined;
    item: (index: number) => InputItem | undefined;
  };
  $json: Record<string, unknown>;
  $node: NodeContext;
  $workflow: WorkflowContext;
  $item: ItemContext;
  $binary?: BinaryDataContext;
  $(): NodeContext;
  $env?: Record<string, string>;
  $parameter?: Record<string, unknown>;
}

export interface InputItem {
  json: Record<string, unknown>;
  binary?: Record<string, BinaryData>;
  pairedItem?: PairedItem;
}

export interface BinaryData {
  data: string;
  mimeType: string;
  fileName?: string;
  directory?: string;
  fileExtension?: string;
}

export interface PairedItem {
  item: number;
  input?: number;
}

export interface NodeContext {
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
}

export interface WorkflowContext {
  id?: string;
  name: string;
  active: boolean;
  [key: string]: unknown;
}

export interface ItemContext {
  index: number;
  [key: string]: unknown;
}

export interface BinaryDataContext {
  [key: string]: BinaryData;
}

// AI Service types
export interface AIResponse {
  content: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

export interface AIError {
  message: string;
  type: string;
  code?: string;
  status?: number;
}

// Database row types
export interface DatabaseRow {
  [column: string]: string | number | boolean | null | Buffer;
}

export interface CodePatternRow extends DatabaseRow {
  id: string;
  name: string;
  description: string | null;
  pattern_type: string;
  category: string | null;
  language: string;
  pattern: string;
  success_count: number;
  failure_count: number;
  performance_score: number;
  reliability_score: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionMetricsRow extends DatabaseRow {
  id: number;
  code_id: string;
  execution_time: number;
  memory_usage: number;
  success: number;
  error_details: string | null;
  input_size: number | null;
  output_size: number | null;
  performance_issues: string | null;
  timestamp: string;
}

export interface LearningDataRow extends DatabaseRow {
  id: number;
  request_hash: string;
  request: string;
  generated_code: string;
  execution_result: string;
  user_feedback: string | null;
  patterns: string;
  timestamp: string;
}

export interface CodeVersionRow extends DatabaseRow {
  id: string;
  code_id: string;
  version_number: number;
  code: string;
  metadata: string;
  performance: string;
  quality: string;
  timestamp: string;
}

export interface UserFeedbackRow extends DatabaseRow {
  id: number;
  code_id: string;
  rating: number;
  worked: number;
  issues: string | null;
  suggestions: string | null;
  timestamp: string;
}

// Validation types
export interface ValidationIssue {
  type: 'syntax' | 'logic' | 'security' | 'performance' | 'style';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
}

export interface ValidationContext extends Record<string, unknown> {
  intent: {
    primaryFunction: string;
    expectedInputs: string[];
    expectedOutputs: string[];
    requirements: string[];
  };
  environment?: {
    nodeVersion?: string;
    dependencies?: string[];
  };
}

// Performance types
export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  detail?: unknown;
}

// Code metadata types
export interface CodeMetadata {
  generatedAt: string;
  generatorVersion: string;
  language: string;
  framework?: string;
  dependencies?: string[];
  complexity?: {
    cyclomatic: number;
    cognitive: number;
    halstead: {
      difficulty: number;
      volume: number;
      effort: number;
    };
  };
  metrics?: {
    loc: number;
    sloc: number;
    comments: number;
    blanks: number;
  };
  tags?: string[];
}

// Request parameter types
export type ParameterValue = string | number | boolean | null | undefined | ParameterValue[] | { [key: string]: ParameterValue };

export interface RequestParameters extends Record<string, ParameterValue> {
  language?: string;
  framework?: string;
  style?: string;
  performanceLevel?: 'standard' | 'optimized' | 'maximum';
  errorHandling?: 'basic' | 'comprehensive' | 'minimal';
  includeComments?: boolean;
  includeTests?: boolean;
  targetEnvironment?: string;
}

// Pattern usage types
export interface PatternUsage {
  context: string;
  frequency: number;
  lastUsed: string;
  successRate: number;
}

// Error context types
export interface ErrorContext extends Record<string, unknown> {
  code?: string;
  operation?: string;
  input?: unknown;
  stack?: string;
  timestamp?: string;
}

// SQL specific types
export interface SQLQueryParams extends Record<string, string | number | boolean | null> {}

export interface SQLDialectInfo {
  jsonExtract: string;
  jsonArray: string;
  stringAgg: string;
  limitSyntax: string;
  dateFormat: string;
}

// Version metadata types
export interface VersionChangeInfo {
  description: string;
  changeType: 'major' | 'minor' | 'patch' | 'rollback';
  changes: string[];
  context: ValidationContext;
  request: RequestParameters;
  improvements: string[];
  regressions: string[];
}

// Cache types
export type CacheValue = string | number | boolean | null | CacheObject | CacheArray;
export interface CacheObject extends Record<string, CacheValue> {}
export interface CacheArray extends Array<CacheValue> {}

// Event types for event-driven architecture
export interface CodeGenerationEvent {
  type: 'generation_started' | 'generation_completed' | 'generation_failed' | 
        'validation_started' | 'validation_completed' | 'validation_failed' |
        'optimization_started' | 'optimization_completed' | 'optimization_failed' |
        'version_created' | 'version_activated' | 'version_rollback' |
        'performance_profile_started' | 'performance_profile_completed' | 'performance_threshold_exceeded' |
        'cache_hit' | 'cache_miss' | 'cache_cleared' |
        'database_connected' | 'database_disconnected' | 'database_error' |
        'feedback_received' | 'feedback_processed' |
        'security_scan_started' | 'security_scan_completed' | 'security_issue_detected' |
        'error_occurred' | 'error_recovered';
  timestamp: string;
  codeId?: string;
  data: Record<string, unknown>;
}

export interface EventHandler {
  (event: CodeGenerationEvent): void | Promise<void>;
}

// Dependency injection types
export interface ServiceContainer {
  register<T>(token: string, factory: () => T): void;
  resolve<T>(token: string): T;
  singleton<T>(token: string, factory: () => T): void;
}

export interface Injectable<T = unknown> {
  token: string;
  factory: () => T;
  singleton?: boolean;
}

// Type guards
export function isValidationIssue(obj: unknown): obj is ValidationIssue {
  return typeof obj === 'object' && obj !== null &&
    'type' in obj && 'severity' in obj && 'message' in obj;
}

export function isExecutionContext(obj: unknown): obj is ExecutionContext {
  return typeof obj === 'object' && obj !== null &&
    '$input' in obj && '$json' in obj && '$node' in obj;
}

export function isDatabaseRow(obj: unknown): obj is DatabaseRow {
  return typeof obj === 'object' && obj !== null;
}

export function isAIResponse(obj: unknown): obj is AIResponse {
  return typeof obj === 'object' && obj !== null &&
    'content' in obj && typeof (obj as AIResponse).content === 'string';
}