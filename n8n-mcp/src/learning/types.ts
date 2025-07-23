export interface FeedbackData {
  workflowId: string;
  workflowType: string;
  prompt: string;
  outcome: 'success' | 'failure' | 'partial';
  executionTime?: number;
  errorMessage?: string;
  nodeCount: number;
  userRating?: number;
  improvements?: string[];
  timestamp: Date;
}

export interface WorkflowPattern {
  type: string;
  frequency: number;
  successRate: number;
  commonConfigurations: any[];
  commonErrors: string[];
}

export interface LearningContext {
  similarWorkflows: WorkflowSimilarity[];
  commonPatterns: WorkflowPattern[];
  avoidErrors: string[];
  bestPractices: string[];
}

export interface WorkflowSimilarity {
  workflowId: string;
  similarity: number;
  outcome: 'success' | 'failure' | 'partial';
  configuration: any;
}

export interface PerformanceMetric {
  workflowType: string;
  count: number;
  avgExecutionTime: number;
  successRate: number;
  lastUpdated: Date;
}

export interface GenerationRecord {
  id: string;
  prompt: string;
  workflow: any;
  provider: string;
  model?: string;
  timestamp: Date;
  nodeCount: number;
  connectionCount: number;
}