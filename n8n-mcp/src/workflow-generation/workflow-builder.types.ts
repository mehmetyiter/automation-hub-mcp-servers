// workflow-generation/workflow-builder.types.ts

export interface WorkflowBuilderConfig {
  startPosition?: [number, number];
  nodeSpacing?: {
    horizontal: number;
    vertical: number;
  };
  branchSpacing?: number;
  parallelSpacing?: number;
}

export interface BuildContext {
  currentPosition: [number, number];
  nodeMap: Map<string, any>;
  nodeIdMap: Map<string, string>; // Maps parsed IDs to n8n IDs
  nodeIdCounter: number;
  errors: BuildError[];
  branches: Map<string, BranchInfo>;
  mergePoints: Map<string, MergePointInfo>;
}

export interface BuildError {
  nodeId?: string;
  error: string;
  severity: 'warning' | 'error';
}

export interface BranchInfo {
  id: string;
  name: string;
  startNodeId: string;
  endNodeId: string;
  yPosition: number;
  nodes: string[];
}

export interface MergePointInfo {
  id: string;
  sourceNodes: string[];
  mergeNodeId: string;
  type: 'merge' | 'if' | 'switch';
}

export interface n8nWorkflow {
  name: string;
  nodes: n8nNode[];
  connections: n8nConnections;
  active: boolean;
  settings: any;
  versionId: string;
  meta: {
    instanceId: string;
  };
  id: string;
  tags: string[];
  pinData?: any;
}

export interface n8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: any;
  webhookId?: string;
  credentials?: any;
  disabled?: boolean;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
}

export interface n8nConnections {
  [nodeId: string]: {
    main: Array<Array<{
      node: string;
      type: 'main';
      index: number;
    }>>;
  };
}

export interface NodeCreationConfig {
  id: string;
  name: string;
  position: [number, number];
  configuration: any;
  credentials?: any;
}

export interface ParallelBranch {
  nodes: string[];
  endNode?: string;
}

export interface SwitchBranch {
  condition: string;
  nodes: string[];
}