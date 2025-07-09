// AI-Driven Dynamic Prompt Generation System Types

export interface DeepAnalysis {
  intent: {
    primaryGoal: string;
    secondaryGoals: string[];
    businessContext: string;
    urgency: 'low' | 'medium' | 'high';
    scope: 'small' | 'medium' | 'large' | 'enterprise';
  };
  entities: {
    actors: string[];
    systems: string[];
    data: string[];
    triggers: string[];
    outputs: string[];
  };
  workflow_characteristics: {
    complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    parallel_processes: number;
    decision_points: number;
    external_integrations: string[];
    estimated_steps: number;
    error_handling_needs: string[];
    compliance_requirements: string[];
  };
  technical_requirements: {
    data_flow_pattern: 'linear' | 'branching' | 'circular' | 'mesh';
    scalability_needs: 'low' | 'medium' | 'high';
    real_time_requirements: boolean;
    batch_processing: boolean;
    notification_requirements: string[];
    storage_requirements: string[];
  };
  implicit_requirements: {
    error_handling: string;
    logging_needs: string;
    monitoring_needs: string;
    security_considerations: string;
    performance_requirements: string;
  };
  innovation_opportunities: {
    automation_potential: string[];
    optimization_areas: string[];
    integration_possibilities: string[];
    future_enhancements: string[];
  };
  confidence: number;
  uniqueness_factors: string[];
  similar_patterns: string[];
  adaptations?: string[];
}

export interface RecognizedPatterns {
  workflowPatterns: {
    architecture_patterns: string[];
    branch_patterns: string[];
    flow_patterns: string[];
    completion_patterns: string[];
  };
  integrationPatterns: {
    connection_strategies: string[];
    data_transformation: string[];
    authentication_patterns: string[];
    error_recovery: string[];
  };
  errorPatterns: {
    common_failure_points: string[];
    recovery_strategies: string[];
    prevention_measures: string[];
    monitoring_strategies: string[];
  };
  optimizationPatterns: {
    performance_optimizations: string[];
    scalability_approaches: string[];
    resource_efficiency: string[];
    maintainability_practices: string[];
  };
  confidence: number;
}

export interface WorkflowArchitecture {
  mainFlow: {
    entry_point: string;
    core_processes: ProcessNode[];
    exit_points: string[];
  };
  parallelBranches: ParallelBranch[];
  decisionPoints: DecisionPoint[];
  integrationPoints: IntegrationPoint[];
  errorHandlingStrategy: ErrorStrategy;
  monitoringPoints: MonitoringPoint[];
}

export interface ProcessNode {
  id: string;
  name: string;
  type: string;
  description: string;
  inputs: string[];
  outputs: string[];
  parameters: Record<string, any>;
}

export interface ParallelBranch {
  name: string;
  trigger: string;
  processes: ProcessNode[];
  merge_point: string;
}

export interface DecisionPoint {
  id: string;
  condition: string;
  true_branch: string;
  false_branch: string;
}

export interface IntegrationPoint {
  system: string;
  method: string;
  authentication: string;
  error_handling: string;
}

export interface ErrorStrategy {
  global_handler: boolean;
  branch_specific_handlers: Record<string, string>;
  retry_policies: Record<string, RetryPolicy>;
}

export interface RetryPolicy {
  max_attempts: number;
  backoff_type: 'linear' | 'exponential';
  initial_delay: number;
}

export interface MonitoringPoint {
  location: string;
  metrics: string[];
  alerts: string[];
}

export interface DynamicPromptResult {
  success: boolean;
  dynamicPrompt: string;
  analysis: DeepAnalysis;
  architecture: WorkflowArchitecture;
  confidence: number;
  uniqueness: number;
  adaptations: string[];
}

export interface WorkflowOutcome {
  success: boolean;
  workflow_id: string;
  execution_time: number;
  nodes_created: number;
  errors: string[];
  performance_metrics: Record<string, number>;
  user_satisfaction?: number;
}

export interface Learning {
  timestamp: Date;
  request: string;
  analysis: DeepAnalysis;
  prompt: string;
  outcome: WorkflowOutcome;
  learnings: {
    successful_patterns: Record<string, any>;
    failed_patterns: Record<string, any>;
    optimizations: string[];
  };
}