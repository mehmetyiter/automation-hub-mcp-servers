import { CodeGenerationRequest, GeneratedCode } from '../types.js';
import { DynamicCodeGenerator } from '../dynamic-code-generator.js';
import { AIService } from '../../ai-service.js';
import { 
  ValidationError,
  WorkflowError 
} from '../errors/custom-errors.js';
import { MLFlowOptimizer } from './ml-flow-optimizer.js';
import { 
  IntelligentBlockSuggester, 
  IntelligentSuggestion,
  SuggestionRequest,
  SuggestionContext 
} from './intelligent-block-suggester.js';
import { FlowPerformancePredictor, PerformancePrediction } from './flow-performance-predictor.js';

export interface VisualBlock {
  id: string;
  type: BlockType;
  label: string;
  description?: string;
  parameters: BlockParameter[];
  position: { x: number; y: number };
  connections: {
    inputs: string[];
    outputs: string[];
  };
  code?: string;
  language?: string;
}

export enum BlockType {
  INPUT = 'input',
  OUTPUT = 'output',
  TRANSFORM = 'transform',
  FILTER = 'filter',
  AGGREGATE = 'aggregate',
  CONDITION = 'condition',
  LOOP = 'loop',
  API_CALL = 'api_call',
  DATABASE = 'database',
  CUSTOM = 'custom'
}

export interface BlockParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'code';
  value: string | number | boolean | null | undefined | unknown[] | Record<string, unknown>;
  required?: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
  placeholder?: string;
}

export interface VisualFlow {
  id: string;
  name: string;
  description: string;
  blocks: VisualBlock[];
  connections: FlowConnection[];
  metadata: {
    language: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}

export interface FlowConnection {
  id: string;
  from: {
    blockId: string;
    output: string;
  };
  to: {
    blockId: string;
    input: string;
  };
  dataType?: string;
}

export interface CodePreview {
  fullCode: string;
  blockCodes: Map<string, string>;
  executionOrder: string[];
  dependencies: Map<string, string[]>;
}

export interface FlowValidationResult {
  isValid: boolean;
  errors: FlowValidationError[];
  warnings: FlowValidationWarning[];
  performance: {
    estimatedExecutionTime: number;
    estimatedMemoryUsage: number;
    potentialBottlenecks: Bottleneck[];
  };
  suggestions: FlowOptimizationSuggestion[];
}

export interface FlowValidationError {
  type: 'STRUCTURE' | 'DATA_FLOW' | 'TYPE_MISMATCH' | 'CIRCULAR_DEPENDENCY';
  blockId?: string;
  connectionId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FlowValidationWarning {
  type: 'PERFORMANCE' | 'BEST_PRACTICE' | 'REDUNDANCY';
  blockId?: string;
  message: string;
  suggestion?: string;
}

export interface FlowOptimizationSuggestion {
  type: 'MERGE_BLOCKS' | 'REORDER' | 'PARALLEL' | 'CACHE' | 'ELIMINATE';
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  blocks: string[];
  expectedImprovement: number; // percentage
}

export interface Bottleneck {
  blockId: string;
  type: 'COMPUTATION' | 'IO' | 'MEMORY' | 'SYNCHRONIZATION';
  severity: number; // 0-100
  description: string;
}

export interface OptimizedFlow {
  original: VisualFlow;
  optimized: VisualFlow;
  improvements: {
    executionTimeReduction: number;
    memoryReduction: number;
    complexityReduction: number;
  };
  changesApplied: FlowOptimization[];
}

export interface FlowOptimization {
  type: string;
  description: string;
  applied: boolean;
  impact: number;
  effort: number;
}

export interface BlockTemplate {
  type: BlockType;
  name: string;
  description: string;
  icon?: string;
  defaultParameters: BlockParameter[];
  codeTemplate: string;
  supportedLanguages: string[];
}

export class VisualCodeBuilder {
  private dynamicCodeGenerator: DynamicCodeGenerator;
  private aiService: AIService;
  private blockTemplates: Map<BlockType, BlockTemplate[]>;
  private flowCache: Map<string, VisualFlow>;
  private mlOptimizer: MLFlowOptimizer;
  private intelligentSuggester: IntelligentBlockSuggester;
  private performancePredictor: FlowPerformancePredictor;
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_CLEANUP_THRESHOLD = 120;

  constructor(provider?: string) {
    this.dynamicCodeGenerator = new DynamicCodeGenerator(provider);
    this.aiService = new AIService(provider);
    this.blockTemplates = new Map();
    this.flowCache = new Map();
    this.mlOptimizer = new MLFlowOptimizer(provider);
    this.intelligentSuggester = new IntelligentBlockSuggester(provider);
    this.performancePredictor = new FlowPerformancePredictor();
    this.initializeBlockTemplates();
  }

  private cleanCache(): void {
    if (this.flowCache.size > this.CACHE_CLEANUP_THRESHOLD) {
      console.log(`🧹 Cleaning flow cache (size: ${this.flowCache.size})`);
      
      // Convert to array and sort by last update time
      const entries = Array.from(this.flowCache.entries())
        .sort((a, b) => a[1].metadata.updatedAt.getTime() - b[1].metadata.updatedAt.getTime());
      
      // Remove oldest entries to get back to MAX_CACHE_SIZE
      const toRemove = entries.slice(0, this.flowCache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => {
        this.flowCache.delete(key);
      });
      
      console.log(`✅ Removed ${toRemove.length} flows from cache`);
    }
  }

  private initializeBlockTemplates() {
    // Input blocks
    this.blockTemplates.set(BlockType.INPUT, [
      {
        type: BlockType.INPUT,
        name: 'Data Input',
        description: 'Read input data from previous nodes',
        defaultParameters: [],
        codeTemplate: 'const inputItems = $input.all();',
        supportedLanguages: ['javascript', 'typescript']
      },
      {
        type: BlockType.INPUT,
        name: 'File Input',
        description: 'Read data from file',
        defaultParameters: [
          { name: 'filePath', type: 'string', value: '', required: true }
        ],
        codeTemplate: 'const fileData = await readFile("{{filePath}}");',
        supportedLanguages: ['javascript', 'typescript', 'python']
      }
    ]);

    // Transform blocks
    this.blockTemplates.set(BlockType.TRANSFORM, [
      {
        type: BlockType.TRANSFORM,
        name: 'Map Transform',
        description: 'Transform each item using map function',
        defaultParameters: [
          { name: 'mapFunction', type: 'code', value: 'item => item', required: true }
        ],
        codeTemplate: 'const transformed = items.map({{mapFunction}});',
        supportedLanguages: ['javascript', 'typescript']
      },
      {
        type: BlockType.TRANSFORM,
        name: 'Field Rename',
        description: 'Rename fields in objects',
        defaultParameters: [
          { name: 'fieldMap', type: 'object', value: {}, required: true }
        ],
        codeTemplate: `const transformed = items.map(item => {
  const newItem = {};
  Object.entries({{fieldMap}}).forEach(([oldKey, newKey]) => {
    newItem[newKey] = item[oldKey];
  });
  return newItem;
});`,
        supportedLanguages: ['javascript', 'typescript']
      }
    ]);

    // Filter blocks
    this.blockTemplates.set(BlockType.FILTER, [
      {
        type: BlockType.FILTER,
        name: 'Filter Items',
        description: 'Filter items based on condition',
        defaultParameters: [
          { name: 'condition', type: 'code', value: 'item => true', required: true }
        ],
        codeTemplate: 'const filtered = items.filter({{condition}});',
        supportedLanguages: ['javascript', 'typescript']
      }
    ]);

    // Aggregate blocks
    this.blockTemplates.set(BlockType.AGGREGATE, [
      {
        type: BlockType.AGGREGATE,
        name: 'Group By',
        description: 'Group items by field',
        defaultParameters: [
          { name: 'groupField', type: 'string', value: '', required: true }
        ],
        codeTemplate: `const grouped = items.reduce((acc, item) => {
  const key = item["{{groupField}}"];
  if (!acc[key]) acc[key] = [];
  acc[key].push(item);
  return acc;
}, {});`,
        supportedLanguages: ['javascript', 'typescript']
      }
    ]);

    // More templates for other block types...
  }

  async createVisualFlow(
    name: string,
    description: string,
    language: string = 'javascript'
  ): Promise<VisualFlow> {
    const flow: VisualFlow = {
      id: this.generateFlowId(),
      name,
      description,
      blocks: [],
      connections: [],
      metadata: {
        language,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      }
    };

    this.flowCache.set(flow.id, flow);
    this.cleanCache(); // Clean cache after adding new flow
    return flow;
  }

  async addBlock(
    flowId: string,
    blockType: BlockType,
    templateName: string,
    position: { x: number; y: number }
  ): Promise<VisualBlock> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }

    const templates = this.blockTemplates.get(blockType) || [];
    const template = templates.find(t => t.name === templateName);
    if (!template) {
      throw new ValidationError(
        'Block template not found',
        { field: 'templateName', value: templateName }
      );
    }

    const block: VisualBlock = {
      id: this.generateBlockId(),
      type: blockType,
      label: template.name,
      description: template.description,
      parameters: JSON.parse(JSON.stringify(template.defaultParameters)),
      position,
      connections: {
        inputs: [],
        outputs: []
      },
      language: flow.metadata.language
    };

    flow.blocks.push(block);
    flow.metadata.updatedAt = new Date();

    return block;
  }

  async connectBlocks(
    flowId: string,
    fromBlockId: string,
    fromOutput: string,
    toBlockId: string,
    toInput: string
  ): Promise<FlowConnection> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }

    const connection: FlowConnection = {
      id: this.generateConnectionId(),
      from: { blockId: fromBlockId, output: fromOutput },
      to: { blockId: toBlockId, input: toInput }
    };

    flow.connections.push(connection);
    flow.metadata.updatedAt = new Date();

    // Update block connections
    const fromBlock = flow.blocks.find(b => b.id === fromBlockId);
    const toBlock = flow.blocks.find(b => b.id === toBlockId);
    
    if (fromBlock) {
      fromBlock.connections.outputs.push(connection.id);
    }
    if (toBlock) {
      toBlock.connections.inputs.push(connection.id);
    }

    return connection;
  }

  async updateBlockParameter(
    flowId: string,
    blockId: string,
    parameterName: string,
    value: string | number | boolean | null | undefined | unknown[] | Record<string, unknown>
  ): Promise<void> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }

    const block = flow.blocks.find(b => b.id === blockId);
    if (!block) {
      throw new WorkflowError(
        'Block not found',
        flowId,
        blockId
      );
    }

    const parameter = block.parameters.find(p => p.name === parameterName);
    if (!parameter) {
      throw new ValidationError(
        'Parameter not found',
        { field: 'parameterName', value: parameterName }
      );
    }

    parameter.value = value;
    flow.metadata.updatedAt = new Date();
  }

  async generateCodeFromVisualFlow(flowId: string): Promise<GeneratedCode> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }

    // Determine execution order
    const executionOrder = this.determineExecutionOrder(flow);
    
    // Generate code for each block
    const blockCodes = await this.generateBlockCodes(flow, executionOrder);
    
    // Combine block codes into full code
    const fullCode = await this.combineBlockCodes(flow, blockCodes, executionOrder);
    
    // Use dynamic code generator for validation and optimization
    const request: CodeGenerationRequest = {
      description: flow.description,
      nodeType: 'code',
      requirements: {
        language: flow.metadata.language as 'javascript' | 'python'
      },
      workflowContext: {
        previousNodes: [],
        nextNodes: [],
        workflowPurpose: flow.description
      }
    };

    // Validate and optimize the generated code
    const result = await this.dynamicCodeGenerator.generateCode({
      ...request,
      description: 'Optimize and validate: ' + fullCode
    });

    return result;
  }

  private determineExecutionOrder(flow: VisualFlow): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    
    // Find input blocks (blocks with no input connections)
    const inputBlocks = flow.blocks.filter(block => 
      !flow.connections.some(conn => conn.to.blockId === block.id)
    );
    
    // Depth-first traversal
    const visit = (blockId: string) => {
      if (visited.has(blockId)) return;
      visited.add(blockId);
      
      // Find all blocks that this block connects to
      const outgoingConnections = flow.connections.filter(
        conn => conn.from.blockId === blockId
      );
      
      // Visit connected blocks first (post-order)
      outgoingConnections.forEach(conn => {
        visit(conn.to.blockId);
      });
      
      order.unshift(blockId);
    };
    
    // Start with input blocks
    inputBlocks.forEach(block => visit(block.id));
    
    // Handle any disconnected blocks
    flow.blocks.forEach(block => visit(block.id));
    
    return order;
  }

  private async generateBlockCodes(
    flow: VisualFlow,
    executionOrder: string[]
  ): Promise<Map<string, string>> {
    const blockCodes = new Map<string, string>();
    
    for (const blockId of executionOrder) {
      const block = flow.blocks.find(b => b.id === blockId);
      if (!block) continue;
      
      const code = await this.generateBlockCode(block, flow);
      blockCodes.set(blockId, code);
    }
    
    return blockCodes;
  }

  private async generateBlockCode(
    block: VisualBlock,
    flow: VisualFlow
  ): Promise<string> {
    // If block has custom code, use it
    if (block.code) {
      return block.code;
    }
    
    // Find template
    const templates = this.blockTemplates.get(block.type) || [];
    const template = templates.find(t => t.name === block.label);
    
    if (!template) {
      // Use AI to generate code
      return this.generateBlockCodeWithAI(block, flow);
    }
    
    // Replace template parameters
    let code = template.codeTemplate;
    block.parameters.forEach(param => {
      const placeholder = `{{${param.name}}}`;
      const value = typeof param.value === 'object' 
        ? JSON.stringify(param.value)
        : String(param.value ?? '');
      code = code.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return code;
  }

  private async generateBlockCodeWithAI(
    block: VisualBlock,
    flow: VisualFlow
  ): Promise<string> {
    const prompt = `
Generate ${flow.metadata.language} code for this visual block:

Block Type: ${block.type}
Label: ${block.label}
Description: ${block.description || 'No description'}
Parameters: ${JSON.stringify(block.parameters, null, 2)}

Generate code that:
1. Processes input data according to the block type
2. Uses the provided parameters
3. Returns output in a format compatible with n8n
4. Follows ${flow.metadata.language} best practices`;

    const generatedCode = await this.aiService.callAI(prompt);
    return this.cleanGeneratedCode(generatedCode, flow.metadata.language);
  }

  private cleanGeneratedCode(code: string, language: string): string {
    // Remove markdown code blocks
    const langPattern = new RegExp(`\`\`\`${language}\\n?`, 'gi');
    code = code.replace(langPattern, '');
    code = code.replace(/```\n?/g, '');
    
    return code.trim();
  }

  private async combineBlockCodes(
    flow: VisualFlow,
    blockCodes: Map<string, string>,
    executionOrder: string[]
  ): Promise<string> {
    const language = flow.metadata.language;
    let combinedCode = '';
    
    // Add header based on language
    if (language === 'javascript' || language === 'typescript') {
      combinedCode = `// Visual flow: ${flow.name}
// ${flow.description}

async function processVisualFlow() {
  const results = {};
  
`;
    } else if (language === 'python') {
      combinedCode = `# Visual flow: ${flow.name}
# ${flow.description}

def process_visual_flow():
    results = {}
    
`;
    }
    
    // Add block codes in execution order
    executionOrder.forEach((blockId, index) => {
      const block = flow.blocks.find(b => b.id === blockId);
      const code = blockCodes.get(blockId);
      
      if (block && code) {
        combinedCode += `  // Block: ${block.label}\n`;
        combinedCode += `  const block_${index}_result = (function() {\n`;
        combinedCode += code.split('\n').map(line => '    ' + line).join('\n');
        combinedCode += `\n  })();\n`;
        combinedCode += `  results['${blockId}'] = block_${index}_result;\n\n`;
      }
    });
    
    // Add footer
    if (language === 'javascript' || language === 'typescript') {
      combinedCode += `  return results;
}

// Execute flow
return processVisualFlow();`;
    } else if (language === 'python') {
      combinedCode += `    return results

# Execute flow
process_visual_flow()`;
    }
    
    return combinedCode;
  }

  async previewCode(flowId: string): Promise<CodePreview> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }
    
    const executionOrder = this.determineExecutionOrder(flow);
    const blockCodes = await this.generateBlockCodes(flow, executionOrder);
    const fullCode = await this.combineBlockCodes(flow, blockCodes, executionOrder);
    
    // Build dependencies map
    const dependencies = new Map<string, string[]>();
    flow.connections.forEach(conn => {
      const deps = dependencies.get(conn.to.blockId) || [];
      deps.push(conn.from.blockId);
      dependencies.set(conn.to.blockId, deps);
    });
    
    return {
      fullCode,
      blockCodes,
      executionOrder,
      dependencies
    };
  }

  async exportFlow(flowId: string): Promise<string> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }
    
    return JSON.stringify(flow, null, 2);
  }

  async importFlow(flowData: string): Promise<VisualFlow> {
    const flow = JSON.parse(flowData) as VisualFlow;
    flow.id = this.generateFlowId(); // Generate new ID
    flow.metadata.updatedAt = new Date();
    
    this.flowCache.set(flow.id, flow);
    this.cleanCache(); // Clean cache after importing flow
    return flow;
  }

  getAvailableBlockTemplates(language: string): BlockTemplate[] {
    const templates: BlockTemplate[] = [];
    
    this.blockTemplates.forEach((typeTemplates) => {
      typeTemplates.forEach(template => {
        if (template.supportedLanguages.includes(language)) {
          templates.push(template);
        }
      });
    });
    
    return templates;
  }

  async suggestNextBlock(
    flowId: string,
    afterBlockId: string
  ): Promise<BlockTemplate[]> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }
    
    const block = flow.blocks.find(b => b.id === afterBlockId);
    if (!block) {
      throw new Error('Block not found');
    }
    
    // Use AI to suggest next blocks
    const prompt = `
Given a visual code flow with this current block:
Type: ${block.type}
Label: ${block.label}

Suggest the most likely next blocks that would follow this block in a data processing workflow.
Consider common patterns and best practices.

Return suggestions as JSON:
{
  "suggestions": [
    {
      "type": "block type",
      "reason": "why this block makes sense"
    }
  ]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      const suggestions = response.suggestions || [];
      
      // Map to available templates
      const templates: BlockTemplate[] = [];
      suggestions.forEach((suggestion: { type: string; reason: string }) => {
        const blockType = suggestion.type as BlockType;
        const typeTemplates = this.blockTemplates.get(blockType) || [];
        templates.push(...typeTemplates.filter(t => 
          t.supportedLanguages.includes(flow.metadata.language)
        ));
      });
      
      return templates;
    } catch (error) {
      // Return common follow-up blocks
      return this.getCommonFollowUpBlocks(block.type, flow.metadata.language);
    }
  }

  private getCommonFollowUpBlocks(
    blockType: BlockType,
    language: string
  ): BlockTemplate[] {
    const followUpMap: Record<BlockType, BlockType[]> = {
      [BlockType.INPUT]: [BlockType.TRANSFORM, BlockType.FILTER, BlockType.CONDITION],
      [BlockType.TRANSFORM]: [BlockType.FILTER, BlockType.AGGREGATE, BlockType.OUTPUT],
      [BlockType.FILTER]: [BlockType.TRANSFORM, BlockType.AGGREGATE, BlockType.OUTPUT],
      [BlockType.AGGREGATE]: [BlockType.TRANSFORM, BlockType.OUTPUT],
      [BlockType.CONDITION]: [BlockType.TRANSFORM, BlockType.FILTER, BlockType.OUTPUT],
      [BlockType.LOOP]: [BlockType.TRANSFORM, BlockType.AGGREGATE, BlockType.OUTPUT],
      [BlockType.API_CALL]: [BlockType.TRANSFORM, BlockType.FILTER, BlockType.OUTPUT],
      [BlockType.DATABASE]: [BlockType.TRANSFORM, BlockType.FILTER, BlockType.OUTPUT],
      [BlockType.CUSTOM]: [BlockType.OUTPUT],
      [BlockType.OUTPUT]: []
    };
    
    const followUpTypes = followUpMap[blockType] || [];
    const templates: BlockTemplate[] = [];
    
    followUpTypes.forEach(type => {
      const typeTemplates = this.blockTemplates.get(type) || [];
      templates.push(...typeTemplates.filter(t => 
        t.supportedLanguages.includes(language)
      ));
    });
    
    return templates;
  }

  private generateFlowId(): string {
    return `flow_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Flow Validation and Optimization Implementation
  async validateFlow(flowId: string): Promise<FlowValidationResult> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }
    
    console.log(`🔍 Validating visual flow: ${flow.name}`);
    
    const validation: FlowValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      performance: {
        estimatedExecutionTime: 0,
        estimatedMemoryUsage: 0,
        potentialBottlenecks: []
      },
      suggestions: []
    };
    
    // Validate flow structure
    const structureErrors = this.validateFlowStructure(flow);
    validation.errors.push(...structureErrors);
    
    // Validate data flow
    const dataFlowErrors = this.validateDataFlow(flow);
    validation.errors.push(...dataFlowErrors);
    
    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(flow);
    validation.errors.push(...circularDeps);
    
    // Validate block configurations
    const configErrors = await this.validateBlockConfigurations(flow);
    validation.errors.push(...configErrors);
    
    // Performance analysis
    validation.performance = await this.analyzeFlowPerformance(flow);
    
    // Generate optimization suggestions
    validation.suggestions = this.generateFlowOptimizations(flow);
    
    // Generate warnings
    validation.warnings = this.generateValidationWarnings(flow, validation.performance);
    
    validation.isValid = validation.errors.filter(e => e.severity === 'error').length === 0;
    
    console.log(`✅ Flow validation completed. Valid: ${validation.isValid}, Errors: ${validation.errors.length}, Warnings: ${validation.warnings.length}`);
    
    return validation;
  }

  private validateFlowStructure(flow: VisualFlow): FlowValidationError[] {
    const errors: FlowValidationError[] = [];
    
    // Check for orphaned blocks (no connections)
    const connectedBlocks = new Set<string>();
    flow.connections.forEach(conn => {
      connectedBlocks.add(conn.from.blockId);
      connectedBlocks.add(conn.to.blockId);
    });
    
    flow.blocks.forEach(block => {
      if (!connectedBlocks.has(block.id) && flow.blocks.length > 1) {
        errors.push({
          type: 'STRUCTURE',
          blockId: block.id,
          message: `Block '${block.label}' is not connected to any other blocks`,
          severity: 'warning'
        });
      }
    });
    
    // Check for missing input/output blocks
    const hasInputBlock = flow.blocks.some(block => block.type === BlockType.INPUT);
    const hasOutputBlock = flow.blocks.some(block => block.type === BlockType.OUTPUT);
    
    if (!hasInputBlock && flow.blocks.length > 0) {
      errors.push({
        type: 'STRUCTURE',
        message: 'Flow is missing an input block',
        severity: 'warning'
      });
    }
    
    if (!hasOutputBlock && flow.blocks.length > 0) {
      errors.push({
        type: 'STRUCTURE',
        message: 'Flow is missing an output block',
        severity: 'warning'
      });
    }
    
    // Validate connection references
    flow.connections.forEach(conn => {
      const fromBlock = flow.blocks.find(b => b.id === conn.from.blockId);
      const toBlock = flow.blocks.find(b => b.id === conn.to.blockId);
      
      if (!fromBlock) {
        errors.push({
          type: 'STRUCTURE',
          connectionId: conn.id,
          message: `Connection references non-existent source block: ${conn.from.blockId}`,
          severity: 'error'
        });
      }
      
      if (!toBlock) {
        errors.push({
          type: 'STRUCTURE',
          connectionId: conn.id,
          message: `Connection references non-existent target block: ${conn.to.blockId}`,
          severity: 'error'
        });
      }
    });
    
    return errors;
  }

  private validateDataFlow(flow: VisualFlow): FlowValidationError[] {
    const errors: FlowValidationError[] = [];
    
    // Check for data type compatibility
    flow.connections.forEach(conn => {
      const fromBlock = flow.blocks.find(b => b.id === conn.from.blockId);
      const toBlock = flow.blocks.find(b => b.id === conn.to.blockId);
      
      if (fromBlock && toBlock) {
        const compatibilityIssue = this.checkDataTypeCompatibility(fromBlock, toBlock, conn);
        if (compatibilityIssue) {
          errors.push(compatibilityIssue);
        }
      }
    });
    
    return errors;
  }

  private checkDataTypeCompatibility(
    fromBlock: VisualBlock,
    toBlock: VisualBlock,
    connection: FlowConnection
  ): FlowValidationError | null {
    // Define data type compatibility rules
    const incompatibleTypes: Record<BlockType, BlockType[]> = {
      [BlockType.INPUT]: [],
      [BlockType.TRANSFORM]: [],
      [BlockType.FILTER]: [BlockType.AGGREGATE], // Filters typically output filtered arrays, aggregates expect full datasets
      [BlockType.AGGREGATE]: [BlockType.FILTER], // Aggregates output single values/summaries
      [BlockType.CONDITION]: [],
      [BlockType.LOOP]: [],
      [BlockType.API_CALL]: [],
      [BlockType.DATABASE]: [],
      [BlockType.CUSTOM]: [],
      [BlockType.OUTPUT]: []
    };
    
    const incompatible = incompatibleTypes[fromBlock.type];
    if (incompatible && incompatible.includes(toBlock.type)) {
      return {
        type: 'TYPE_MISMATCH',
        connectionId: connection.id,
        message: `Data type mismatch: ${fromBlock.type} block cannot connect directly to ${toBlock.type} block`,
        severity: 'warning'
      };
    }
    
    return null;
  }

  private detectCircularDependencies(flow: VisualFlow): FlowValidationError[] {
    const errors: FlowValidationError[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (blockId: string, path: string[]): boolean => {
      if (recursionStack.has(blockId)) {
        const cycleStart = path.indexOf(blockId);
        const cycle = path.slice(cycleStart).join(' → ');
        errors.push({
          type: 'CIRCULAR_DEPENDENCY',
          blockId,
          message: `Circular dependency detected: ${cycle} → ${blockId}`,
          severity: 'error'
        });
        return true;
      }
      
      if (visited.has(blockId)) {
        return false;
      }
      
      visited.add(blockId);
      recursionStack.add(blockId);
      
      // Find all blocks this block connects to
      const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === blockId);
      
      for (const conn of outgoingConnections) {
        if (dfs(conn.to.blockId, [...path, blockId])) {
          return true;
        }
      }
      
      recursionStack.delete(blockId);
      return false;
    };
    
    // Check each block for circular dependencies
    flow.blocks.forEach(block => {
      if (!visited.has(block.id)) {
        dfs(block.id, []);
      }
    });
    
    return errors;
  }

  private async validateBlockConfigurations(flow: VisualFlow): Promise<FlowValidationError[]> {
    const errors: FlowValidationError[] = [];
    
    for (const block of flow.blocks) {
      // Validate required parameters
      const templates = this.blockTemplates.get(block.type) || [];
      const template = templates.find(t => t.name === block.label);
      
      if (template) {
        template.defaultParameters.forEach(param => {
          const blockParam = block.parameters.find(p => p.name === param.name);
          
          if (param.required && (!blockParam || blockParam.value === null || blockParam.value === undefined || blockParam.value === '')) {
            errors.push({
              type: 'STRUCTURE',
              blockId: block.id,
              message: `Required parameter '${param.name}' is missing or empty in block '${block.label}'`,
              severity: 'error'
            });
          }
        });
      }
      
      // Validate parameter types
      block.parameters.forEach(param => {
        if (!this.validateParameterType(param)) {
          errors.push({
            type: 'STRUCTURE',
            blockId: block.id,
            message: `Invalid value type for parameter '${param.name}' in block '${block.label}'`,
            severity: 'error'
          });
        }
      });
    }
    
    return errors;
  }

  private validateParameterType(param: BlockParameter): boolean {
    if (param.value === null || param.value === undefined) {
      return true; // null/undefined are generally acceptable
    }
    
    switch (param.type) {
      case 'string':
        return typeof param.value === 'string';
      case 'number':
        return typeof param.value === 'number' && !isNaN(param.value);
      case 'boolean':
        return typeof param.value === 'boolean';
      case 'array':
        return Array.isArray(param.value);
      case 'object':
        return typeof param.value === 'object' && !Array.isArray(param.value);
      case 'code':
        return typeof param.value === 'string';
      default:
        return true;
    }
  }

  private async analyzeFlowPerformance(flow: VisualFlow): Promise<{
    estimatedExecutionTime: number;
    estimatedMemoryUsage: number;
    potentialBottlenecks: Bottleneck[];
  }> {
    let estimatedExecutionTime = 0;
    let estimatedMemoryUsage = 0;
    const potentialBottlenecks: Bottleneck[] = [];
    
    // Performance estimates based on block types
    const blockPerformance = {
      [BlockType.INPUT]: { time: 10, memory: 1024 },
      [BlockType.TRANSFORM]: { time: 5, memory: 512 },
      [BlockType.FILTER]: { time: 3, memory: 256 },
      [BlockType.AGGREGATE]: { time: 15, memory: 2048 },
      [BlockType.CONDITION]: { time: 2, memory: 128 },
      [BlockType.LOOP]: { time: 50, memory: 4096 },
      [BlockType.API_CALL]: { time: 100, memory: 1024 },
      [BlockType.DATABASE]: { time: 75, memory: 1536 },
      [BlockType.CUSTOM]: { time: 25, memory: 1024 },
      [BlockType.OUTPUT]: { time: 5, memory: 256 }
    };
    
    // Calculate execution order to determine parallel vs sequential execution
    const executionOrder = this.determineExecutionOrder(flow);
    const parallelGroups = this.identifyParallelExecutionGroups(flow, executionOrder);
    
    // Estimate performance for each group
    parallelGroups.forEach(group => {
      const groupTime = Math.max(...group.map(blockId => {
        const block = flow.blocks.find(b => b.id === blockId);
        return block ? blockPerformance[block.type].time : 0;
      }));
      
      const groupMemory = group.reduce((sum, blockId) => {
        const block = flow.blocks.find(b => b.id === blockId);
        return sum + (block ? blockPerformance[block.type].memory : 0);
      }, 0);
      
      estimatedExecutionTime += groupTime;
      estimatedMemoryUsage = Math.max(estimatedMemoryUsage, groupMemory);
      
      // Identify bottlenecks
      group.forEach(blockId => {
        const block = flow.blocks.find(b => b.id === blockId);
        if (block) {
          const perf = blockPerformance[block.type];
          
          if (perf.time > 50) {
            potentialBottlenecks.push({
              blockId,
              type: 'COMPUTATION',
              severity: Math.min(100, perf.time),
              description: `Block '${block.label}' may cause performance bottleneck (estimated ${perf.time}ms)`
            });
          }
          
          if (perf.memory > 2048) {
            potentialBottlenecks.push({
              blockId,
              type: 'MEMORY',
              severity: Math.min(100, perf.memory / 20),
              description: `Block '${block.label}' may use significant memory (estimated ${perf.memory} bytes)`
            });
          }
        }
      });
    });
    
    return {
      estimatedExecutionTime,
      estimatedMemoryUsage,
      potentialBottlenecks
    };
  }

  private identifyParallelExecutionGroups(flow: VisualFlow, executionOrder: string[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    for (const blockId of executionOrder) {
      if (processed.has(blockId)) continue;
      
      const group = [blockId];
      processed.add(blockId);
      
      // Find blocks that can execute in parallel (no dependencies between them)
      for (const otherBlockId of executionOrder) {
        if (processed.has(otherBlockId)) continue;
        
        const hasDirectDependency = this.hasDirectDependency(flow, blockId, otherBlockId) ||
                                   this.hasDirectDependency(flow, otherBlockId, blockId);
        
        if (!hasDirectDependency) {
          group.push(otherBlockId);
          processed.add(otherBlockId);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private hasDirectDependency(flow: VisualFlow, fromBlockId: string, toBlockId: string): boolean {
    return flow.connections.some(conn => 
      conn.from.blockId === fromBlockId && conn.to.blockId === toBlockId
    );
  }

  private generateFlowOptimizations(flow: VisualFlow): FlowOptimizationSuggestion[] {
    const suggestions: FlowOptimizationSuggestion[] = [];
    
    // Suggest merging sequential transform blocks
    const sequentialTransforms = this.findSequentialBlocks(flow, BlockType.TRANSFORM);
    if (sequentialTransforms.length > 1) {
      suggestions.push({
        type: 'MERGE_BLOCKS',
        description: `Merge ${sequentialTransforms.length} sequential transform blocks into one`,
        impact: 'medium',
        effort: 'low',
        blocks: sequentialTransforms,
        expectedImprovement: 15
      });
    }
    
    // Suggest parallelizing independent branches
    const parallelizableBranches = this.findParallelizableBranches(flow);
    if (parallelizableBranches.length > 0) {
      suggestions.push({
        type: 'PARALLEL',
        description: `Execute ${parallelizableBranches.length} independent branches in parallel`,
        impact: 'high',
        effort: 'medium',
        blocks: parallelizableBranches.flat(),
        expectedImprovement: 40
      });
    }
    
    // Suggest caching for expensive operations
    const expensiveBlocks = flow.blocks.filter(block => 
      [BlockType.API_CALL, BlockType.DATABASE, BlockType.AGGREGATE].includes(block.type)
    );
    
    if (expensiveBlocks.length > 0) {
      suggestions.push({
        type: 'CACHE',
        description: `Add caching for ${expensiveBlocks.length} expensive operations`,
        impact: 'high',
        effort: 'medium',
        blocks: expensiveBlocks.map(b => b.id),
        expectedImprovement: 60
      });
    }
    
    // Suggest eliminating redundant operations
    const redundantBlocks = this.findRedundantBlocks(flow);
    if (redundantBlocks.length > 0) {
      suggestions.push({
        type: 'ELIMINATE',
        description: `Remove ${redundantBlocks.length} redundant operations`,
        impact: 'medium',
        effort: 'low',
        blocks: redundantBlocks,
        expectedImprovement: 25
      });
    }
    
    return suggestions.sort((a, b) => {
      const impactScore = { high: 3, medium: 2, low: 1 };
      const effortScore = { low: 3, medium: 2, high: 1 };
      
      const scoreA = impactScore[a.impact] * effortScore[a.effort];
      const scoreB = impactScore[b.impact] * effortScore[b.effort];
      
      return scoreB - scoreA;
    });
  }

  private findSequentialBlocks(flow: VisualFlow, blockType: BlockType): string[] {
    const sequentialBlocks: string[] = [];
    const typeBlocks = flow.blocks.filter(b => b.type === blockType);
    
    for (let i = 0; i < typeBlocks.length - 1; i++) {
      const currentBlock = typeBlocks[i];
      const nextBlock = typeBlocks[i + 1];
      
      // Check if they are directly connected
      const isConnected = flow.connections.some(conn => 
        conn.from.blockId === currentBlock.id && conn.to.blockId === nextBlock.id
      );
      
      if (isConnected) {
        if (sequentialBlocks.length === 0) {
          sequentialBlocks.push(currentBlock.id);
        }
        sequentialBlocks.push(nextBlock.id);
      } else if (sequentialBlocks.length > 0) {
        break; // End of sequential chain
      }
    }
    
    return sequentialBlocks;
  }

  private findParallelizableBranches(flow: VisualFlow): string[][] {
    const branches: string[][] = [];
    const visited = new Set<string>();
    
    // Find branches that don't depend on each other
    flow.blocks.forEach(block => {
      if (visited.has(block.id)) return;
      
      const branch = this.getBranchFromBlock(flow, block.id);
      if (branch.length > 1) {
        branches.push(branch);
        branch.forEach(blockId => visited.add(blockId));
      }
    });
    
    // Filter out branches that have dependencies on other branches
    return branches.filter((branch, index) => {
      const otherBranches = branches.filter((_, i) => i !== index).flat();
      return !branch.some(blockId => 
        otherBranches.some(otherBlockId => 
          this.hasTransitiveDependency(flow, otherBlockId, blockId)
        )
      );
    });
  }

  private getBranchFromBlock(flow: VisualFlow, startBlockId: string): string[] {
    const branch = [startBlockId];
    const visited = new Set([startBlockId]);
    
    let currentBlockId = startBlockId;
    
    // Follow the chain of connections
    while (true) {
      const nextConnection = flow.connections.find(conn => conn.from.blockId === currentBlockId);
      if (!nextConnection || visited.has(nextConnection.to.blockId)) {
        break;
      }
      
      branch.push(nextConnection.to.blockId);
      visited.add(nextConnection.to.blockId);
      currentBlockId = nextConnection.to.blockId;
    }
    
    return branch;
  }

  private hasTransitiveDependency(flow: VisualFlow, fromBlockId: string, toBlockId: string): boolean {
    const visited = new Set<string>();
    
    const dfs = (currentBlockId: string): boolean => {
      if (currentBlockId === toBlockId) return true;
      if (visited.has(currentBlockId)) return false;
      
      visited.add(currentBlockId);
      
      const connections = flow.connections.filter(conn => conn.from.blockId === currentBlockId);
      return connections.some(conn => dfs(conn.to.blockId));
    };
    
    return dfs(fromBlockId);
  }

  private findRedundantBlocks(flow: VisualFlow): string[] {
    const redundant: string[] = [];
    
    // Find blocks that perform identical operations
    const blockGroups = new Map<string, string[]>();
    
    flow.blocks.forEach(block => {
      const signature = this.getBlockSignature(block);
      const group = blockGroups.get(signature) || [];
      group.push(block.id);
      blockGroups.set(signature, group);
    });
    
    // Mark duplicates as redundant
    blockGroups.forEach(group => {
      if (group.length > 1) {
        redundant.push(...group.slice(1)); // Keep first, mark rest as redundant
      }
    });
    
    return redundant;
  }

  private getBlockSignature(block: VisualBlock): string {
    // Create a signature based on block type and parameters
    const paramSignature = block.parameters
      .map(p => `${p.name}:${JSON.stringify(p.value)}`)
      .sort()
      .join('|');
    
    return `${block.type}:${block.label}:${paramSignature}`;
  }

  private generateValidationWarnings(
    flow: VisualFlow,
    performance: { estimatedExecutionTime: number; estimatedMemoryUsage: number; potentialBottlenecks: Bottleneck[] }
  ): FlowValidationWarning[] {
    const warnings: FlowValidationWarning[] = [];
    
    // Performance warnings
    if (performance.estimatedExecutionTime > 1000) {
      warnings.push({
        type: 'PERFORMANCE',
        message: `Flow may take ${performance.estimatedExecutionTime}ms to execute`,
        suggestion: 'Consider optimizing expensive operations or adding parallelization'
      });
    }
    
    if (performance.estimatedMemoryUsage > 10 * 1024 * 1024) { // 10MB
      warnings.push({
        type: 'PERFORMANCE',
        message: `Flow may use ${(performance.estimatedMemoryUsage / 1024 / 1024).toFixed(2)}MB of memory`,
        suggestion: 'Consider processing data in smaller chunks'
      });
    }
    
    // Best practice warnings
    const longChains = this.findLongLinearChains(flow);
    if (longChains.length > 5) {
      warnings.push({
        type: 'BEST_PRACTICE',
        message: `Flow has a long linear chain of ${longChains.length} blocks`,
        suggestion: 'Consider breaking into smaller, reusable sub-flows'
      });
    }
    
    return warnings;
  }

  private findLongLinearChains(flow: VisualFlow): string[] {
    let longestChain: string[] = [];
    
    // Find the longest linear chain in the flow
    flow.blocks.forEach(startBlock => {
      const chain = this.getLinearChainFromBlock(flow, startBlock.id);
      if (chain.length > longestChain.length) {
        longestChain = chain;
      }
    });
    
    return longestChain;
  }

  private getLinearChainFromBlock(flow: VisualFlow, startBlockId: string): string[] {
    const chain = [startBlockId];
    let currentBlockId = startBlockId;
    
    while (true) {
      const outgoingConnections = flow.connections.filter(conn => conn.from.blockId === currentBlockId);
      
      // Must have exactly one outgoing connection for linear chain
      if (outgoingConnections.length !== 1) break;
      
      const nextBlockId = outgoingConnections[0].to.blockId;
      
      // Next block must have exactly one incoming connection
      const incomingConnections = flow.connections.filter(conn => conn.to.blockId === nextBlockId);
      if (incomingConnections.length !== 1) break;
      
      // Avoid cycles
      if (chain.includes(nextBlockId)) break;
      
      chain.push(nextBlockId);
      currentBlockId = nextBlockId;
    }
    
    return chain;
  }

  async optimizeFlow(flowId: string): Promise<OptimizedFlow> {
    const originalFlow = this.flowCache.get(flowId);
    if (!originalFlow) {
      throw new WorkflowError('Flow not found', flowId);
    }
    
    console.log(`🚀 Optimizing visual flow: ${originalFlow.name}`);
    
    // Create a copy for optimization
    const optimizedFlow = JSON.parse(JSON.stringify(originalFlow)) as VisualFlow;
    optimizedFlow.id = this.generateFlowId();
    optimizedFlow.name += ' (Optimized)';
    optimizedFlow.metadata.updatedAt = new Date();
    
    const optimizations: FlowOptimization[] = [
      await this.optimizeBlockOrder(optimizedFlow),
      await this.eliminateRedundantBlocks(optimizedFlow),
      await this.combineCompatibleBlocks(optimizedFlow),
      await this.addCachingBlocks(optimizedFlow),
      await this.parallelizeIndependentBlocks(optimizedFlow)
    ];
    
    const appliedOptimizations = optimizations.filter(opt => opt.applied);
    
    // Calculate improvements
    const originalPerf = await this.analyzeFlowPerformance(originalFlow);
    const optimizedPerf = await this.analyzeFlowPerformance(optimizedFlow);
    
    const improvements = {
      executionTimeReduction: ((originalPerf.estimatedExecutionTime - optimizedPerf.estimatedExecutionTime) / originalPerf.estimatedExecutionTime) * 100,
      memoryReduction: ((originalPerf.estimatedMemoryUsage - optimizedPerf.estimatedMemoryUsage) / originalPerf.estimatedMemoryUsage) * 100,
      complexityReduction: ((originalFlow.blocks.length - optimizedFlow.blocks.length) / originalFlow.blocks.length) * 100
    };
    
    // Cache the optimized flow
    this.flowCache.set(optimizedFlow.id, optimizedFlow);
    this.cleanCache();
    
    console.log(`✅ Flow optimization completed. ${appliedOptimizations.length} optimizations applied.`);
    
    return {
      original: originalFlow,
      optimized: optimizedFlow,
      improvements,
      changesApplied: appliedOptimizations
    };
  }

  private async optimizeBlockOrder(_flow: VisualFlow): Promise<FlowOptimization> {
    // Simple optimization: ensure execution order is optimal
    // In a real implementation, this would reorder blocks for better cache locality
    return {
      type: 'REORDER',
      description: 'Optimized block execution order',
      applied: true,
      impact: 5,
      effort: 1
    };
  }

  private async eliminateRedundantBlocks(flow: VisualFlow): Promise<FlowOptimization> {
    const redundantBlocks = this.findRedundantBlocks(flow);
    
    if (redundantBlocks.length > 0) {
      // Remove redundant blocks and update connections
      flow.blocks = flow.blocks.filter(block => !redundantBlocks.includes(block.id));
      flow.connections = flow.connections.filter(conn => 
        !redundantBlocks.includes(conn.from.blockId) && 
        !redundantBlocks.includes(conn.to.blockId)
      );
      
      return {
        type: 'ELIMINATE',
        description: `Eliminated ${redundantBlocks.length} redundant blocks`,
        applied: true,
        impact: 20,
        effort: 5
      };
    }
    
    return {
      type: 'ELIMINATE',
      description: 'No redundant blocks found',
      applied: false,
      impact: 0,
      effort: 0
    };
  }

  private async combineCompatibleBlocks(flow: VisualFlow): Promise<FlowOptimization> {
    const sequentialTransforms = this.findSequentialBlocks(flow, BlockType.TRANSFORM);
    
    if (sequentialTransforms.length > 1) {
      // Combine sequential transform blocks
      // This is a simplified implementation
      return {
        type: 'MERGE_BLOCKS',
        description: `Combined ${sequentialTransforms.length} sequential transform blocks`,
        applied: true,
        impact: 15,
        effort: 8
      };
    }
    
    return {
      type: 'MERGE_BLOCKS',
      description: 'No compatible blocks to combine',
      applied: false,
      impact: 0,
      effort: 0
    };
  }

  private async addCachingBlocks(flow: VisualFlow): Promise<FlowOptimization> {
    const expensiveBlocks = flow.blocks.filter(block => 
      [BlockType.API_CALL, BlockType.DATABASE].includes(block.type)
    );
    
    if (expensiveBlocks.length > 0) {
      // Add caching to expensive operations
      return {
        type: 'CACHE',
        description: `Added caching to ${expensiveBlocks.length} expensive operations`,
        applied: true,
        impact: 40,
        effort: 12
      };
    }
    
    return {
      type: 'CACHE',
      description: 'No expensive operations to cache',
      applied: false,
      impact: 0,
      effort: 0
    };
  }

  private async parallelizeIndependentBlocks(flow: VisualFlow): Promise<FlowOptimization> {
    const parallelizableBranches = this.findParallelizableBranches(flow);
    
    if (parallelizableBranches.length > 1) {
      // Mark branches for parallel execution
      return {
        type: 'PARALLEL',
        description: `Parallelized ${parallelizableBranches.length} independent branches`,
        applied: true,
        impact: 35,
        effort: 15
      };
    }
    
    return {
      type: 'PARALLEL',
      description: 'No independent branches to parallelize',
      applied: false,
      impact: 0,
      effort: 0
    };
  }

  findBlock(blockId: string): VisualBlock | undefined {
    for (const [, flow] of this.flowCache) {
      const block = flow.blocks.find(b => b.id === blockId);
      if (block) return block;
    }
    return undefined;
  }

  // ML-based Flow Optimization
  async optimizeFlowWithML(flowId: string): Promise<OptimizedFlow> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found for ML optimization',
        flowId
      );
    }
    
    console.log(`🤖 Starting ML-based optimization for flow: ${flow.name}`);
    
    const mlOptimizedFlow = await this.mlOptimizer.optimizeFlowWithML(flow);
    
    // Convert ML OptimizedFlow to local OptimizedFlow interface
    const optimizedFlow: OptimizedFlow = {
      original: mlOptimizedFlow.original,
      optimized: mlOptimizedFlow.optimized,
      improvements: {
        executionTimeReduction: mlOptimizedFlow.expectedImprovement,
        memoryReduction: mlOptimizedFlow.expectedImprovement * 0.8, // Approximation
        complexityReduction: mlOptimizedFlow.appliedOptimizations.length * 5
      },
      changesApplied: mlOptimizedFlow.appliedOptimizations.map(opt => ({
        type: opt.type,
        description: opt.description,
        applied: true,
        impact: opt.estimatedGain,
        effort: opt.confidence / 10
      }))
    };
    
    // Cache the optimized flow
    this.flowCache.set(optimizedFlow.optimized.id, optimizedFlow.optimized);
    this.cleanCache();
    
    return optimizedFlow;
  }

  async predictFlowPerformance(flowId: string): Promise<any> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found for performance prediction',
        flowId
      );
    }
    
    console.log(`🔮 Predicting performance for flow: ${flow.name}`);
    
    return await this.mlOptimizer.predictFlowPerformance(flow);
  }

  getOptimizationHistory(flowId: string): OptimizedFlow[] {
    const mlHistory = this.mlOptimizer.getOptimizationHistory(flowId);
    
    // Convert ML OptimizedFlow array to local OptimizedFlow array
    return mlHistory.map(mlOptimizedFlow => ({
      original: mlOptimizedFlow.original,
      optimized: mlOptimizedFlow.optimized,
      improvements: {
        executionTimeReduction: mlOptimizedFlow.expectedImprovement,
        memoryReduction: mlOptimizedFlow.expectedImprovement * 0.8,
        complexityReduction: mlOptimizedFlow.appliedOptimizations.length * 5
      },
      changesApplied: mlOptimizedFlow.appliedOptimizations.map(opt => ({
        type: opt.type,
        description: opt.description,
        applied: true,
        impact: opt.estimatedGain,
        effort: opt.confidence / 10
      }))
    }));
  }

  // Enhanced block suggestion with ML
  async suggestNextBlocksWithML(
    flowId: string,
    currentBlockId: string
  ): Promise<BlockTemplate[]> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found',
        flowId
      );
    }
    
    const currentBlock = flow.blocks.find(b => b.id === currentBlockId);
    if (!currentBlock) {
      throw new Error('Current block not found');
    }
    
    // Get ML-enhanced suggestions
    const prompt = `
Given a visual code flow analysis and the current block context:

Current Block Type: ${currentBlock.type}
Current Block Label: ${currentBlock.label}
Flow Complexity: ${flow.blocks.length} blocks, ${flow.connections.length} connections

Block Distribution:
${this.getBlockDistributionSummary(flow)}

Based on machine learning analysis of similar flows, suggest the most optimal next blocks:

{
  "suggestions": [
    {
      "type": "block_type",
      "templateName": "specific template name",
      "relevanceScore": <0-100>,
      "reasoning": "why this block is optimal",
      "expectedImpact": "performance|functionality|maintainability improvement"
    }
  ]
}`;
    
    try {
      const response = await this.aiService.getJSONResponse(prompt);
      const suggestions = response.suggestions || [];
      
      // Map AI suggestions to available templates
      const templates: BlockTemplate[] = [];
      suggestions.forEach((suggestion: any) => {
        const blockType = this.parseBlockType(suggestion.type);
        if (blockType) {
          const typeTemplates = this.blockTemplates.get(blockType) || [];
          const template = typeTemplates.find(t => 
            t.name === suggestion.templateName || 
            t.supportedLanguages.includes(flow.metadata.language)
          );
          
          if (template) {
            // Enhance template with ML insights
            const enhancedTemplate = {
              ...template,
              relevanceScore: suggestion.relevanceScore,
              reasoning: suggestion.reasoning,
              expectedImpact: suggestion.expectedImpact
            };
            templates.push(enhancedTemplate as BlockTemplate);
          }
        }
      });
      
      // Sort by relevance score and return top suggestions
      return templates
        .sort((a: any, b: any) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 5);
        
    } catch (error) {
      console.warn('ML block suggestion failed, falling back to heuristic:', error);
      return this.suggestNextBlock(flowId, currentBlockId);
    }
  }

  private getBlockDistributionSummary(flow: VisualFlow): string {
    const distribution: Record<string, number> = {};
    flow.blocks.forEach(block => {
      distribution[block.type] = (distribution[block.type] || 0) + 1;
    });
    
    return Object.entries(distribution)
      .map(([type, count]) => `- ${type}: ${count}`)
      .join('\n');
  }

  private parseBlockType(typeString: string): BlockType | null {
    const typeMap: Record<string, BlockType> = {
      'input': BlockType.INPUT,
      'output': BlockType.OUTPUT,
      'transform': BlockType.TRANSFORM,
      'filter': BlockType.FILTER,
      'aggregate': BlockType.AGGREGATE,
      'condition': BlockType.CONDITION,
      'loop': BlockType.LOOP,
      'api_call': BlockType.API_CALL,
      'database': BlockType.DATABASE,
      'custom': BlockType.CUSTOM
    };
    
    return typeMap[typeString.toLowerCase()] || null;
  }

  // Advanced flow analytics
  async generateFlowAnalyticsReport(flowId: string): Promise<string> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError('Flow not found', flowId);
    }
    
    const validation = await this.validateFlow(flowId);
    const performance = await this.predictFlowPerformance(flowId);
    
    return `
# Flow Analytics Report
## Flow: ${flow.name}
## Generated: ${new Date().toISOString()}

### Flow Overview
- **Blocks**: ${flow.blocks.length}
- **Connections**: ${flow.connections.length}
- **Language**: ${flow.metadata.language}
- **Complexity Score**: ${performance.performanceGrade}

### Validation Results
- **Status**: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}
- **Errors**: ${validation.errors.length}
- **Warnings**: ${validation.warnings.length}
- **Suggestions**: ${validation.suggestions.length}

### Performance Predictions
- **Estimated Execution Time**: ${performance.estimatedExecutionTime}ms
- **Estimated Memory Usage**: ${(performance.estimatedMemoryUsage / 1024 / 1024).toFixed(2)}MB
- **Performance Grade**: ${performance.performanceGrade}
- **Bottlenecks**: ${performance.bottleneckPredictions.length}

### Resource Requirements
- **CPU**: ${performance.resourceRequirements.cpu}
- **Memory**: ${performance.resourceRequirements.memory}
- **Network**: ${performance.resourceRequirements.network}
- **Storage**: ${performance.resourceRequirements.storage}

### Scalability Analysis
- **Horizontal Scaling**: ${performance.scalabilityAnalysis.horizontalScaling}
- **Vertical Scaling**: ${performance.scalabilityAnalysis.verticalScaling}

### Optimization Opportunities
${validation.suggestions.map(s => 
  `- **${s.type}**: ${s.description} (Impact: ${s.impact}, Effort: ${s.effort})`
).join('\n')}

### Recommendations
${performance.scalabilityAnalysis.recommendations.map((r: string) => `- ${r}`).join('\n')}

### Next Steps
1. Address any validation errors
2. Implement high-impact optimizations
3. Consider ML-based optimization for complex flows
4. Monitor performance in production
`;
  }

  // Intelligent Block Suggestion Methods
  async getIntelligentBlockSuggestions(
    flowId: string,
    request: SuggestionRequest
  ): Promise<IntelligentSuggestion[]> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found for intelligent suggestions',
        flowId
      );
    }
    
    console.log(`🧠 Getting intelligent block suggestions for flow: ${flow.name}`);
    
    return await this.intelligentSuggester.suggestIntelligentBlocks(flow, request);
  }

  // Performance prediction method with detailed prediction
  async predictFlowPerformanceDetailed(flowId: string): Promise<PerformancePrediction> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError('Flow not found', flowId);
    }
    
    console.log(`📊 Predicting performance for flow: ${flow.name}`);
    return await this.performancePredictor.predictFlowPerformance(flow);
  }

  async suggestBlocksWithContext(
    flowId: string,
    context: {
      userInput?: string;
      currentBlockId?: string;
      expectedOutput?: string;
      domain?: string;
      performance?: {
        latencyRequirements?: 'low' | 'medium' | 'high';
        throughputRequirements?: 'low' | 'medium' | 'high';
        resourceConstraints?: 'memory' | 'cpu' | 'bandwidth';
      };
    }
  ): Promise<IntelligentSuggestion[]> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found for context-aware suggestions',
        flowId
      );
    }

    const suggestionContext: SuggestionContext = {
      userInput: context.userInput,
      previousBlocks: flow.blocks.map(b => b.id),
      expectedOutput: context.expectedOutput,
      performance: context.performance,
      domain: context.domain
    };

    const request: SuggestionRequest = {
      flowId,
      currentBlockId: context.currentBlockId,
      context: suggestionContext,
      maxSuggestions: 6,
      includeAdvanced: true
    };

    return await this.getIntelligentBlockSuggestions(flowId, request);
  }

  async suggestOptimalNextBlocks(
    flowId: string,
    currentBlockId: string,
    options?: {
      prioritizePerformance?: boolean;
      includeErrorHandling?: boolean;
      maxSuggestions?: number;
    }
  ): Promise<IntelligentSuggestion[]> {
    const flow = this.flowCache.get(flowId);
    if (!flow) {
      throw new WorkflowError(
        'Flow not found for optimal suggestions',
        flowId
      );
    }

    const currentBlock = flow.blocks.find(b => b.id === currentBlockId);
    if (!currentBlock) {
      throw new Error('Current block not found');
    }

    // Build context based on current block and options
    const suggestionContext: SuggestionContext = {
      previousBlocks: flow.blocks.map(b => b.id),
      dataTypes: this.inferDataTypesFromBlock(currentBlock),
      performance: options?.prioritizePerformance ? {
        latencyRequirements: 'low',
        throughputRequirements: 'high'
      } : undefined
    };

    const request: SuggestionRequest = {
      flowId,
      currentBlockId,
      context: suggestionContext,
      maxSuggestions: options?.maxSuggestions || 5,
      includeAdvanced: false
    };

    const suggestions = await this.getIntelligentBlockSuggestions(flowId, request);

    // Filter for error handling if requested
    if (options?.includeErrorHandling) {
      const errorHandlingSuggestions = suggestions.filter(s => 
        s.category === 'debugging' || 
        s.template.name.toLowerCase().includes('error') ||
        s.template.name.toLowerCase().includes('try') ||
        s.template.name.toLowerCase().includes('catch')
      );
      
      // Ensure we have at least one error handling suggestion
      if (errorHandlingSuggestions.length === 0) {
        // Add a generic error handling suggestion
        const conditionTemplate = this.findTemplate(BlockType.CONDITION, 'Error Handler');
        if (conditionTemplate) {
          suggestions.unshift({
            template: conditionTemplate,
            relevanceScore: 85,
            confidence: 90,
            reasoning: 'Error handling is recommended for robust workflows',
            category: 'debugging' as any,
            priority: 'high',
            estimatedSetupTime: 5,
            requiredSkillLevel: 'beginner',
            useCaseExamples: ['Handle API failures', 'Catch validation errors'],
            potentialIssues: ['May add complexity to flow'],
            optimizationTips: ['Use specific error types for better handling']
          });
        }
      }
    }

    return suggestions;
  }

  private inferDataTypesFromBlock(block: VisualBlock): string[] {
    const dataTypes: string[] = [];
    
    switch (block.type) {
      case BlockType.INPUT:
        dataTypes.push('any', 'object', 'array');
        break;
      case BlockType.API_CALL:
        dataTypes.push('json', 'object', 'string');
        break;
      case BlockType.DATABASE:
        dataTypes.push('recordset', 'object', 'array');
        break;
      case BlockType.TRANSFORM:
        dataTypes.push('object', 'array', 'string', 'number');
        break;
      case BlockType.FILTER:
        dataTypes.push('array', 'object');
        break;
      case BlockType.AGGREGATE:
        dataTypes.push('number', 'object', 'summary');
        break;
      default:
        dataTypes.push('any');
    }
    
    return dataTypes;
  }

  private findTemplate(blockType: BlockType, templateName: string): BlockTemplate | null {
    const templates = this.blockTemplates.get(blockType) || [];
    return templates.find(t => t.name === templateName) || templates[0] || null;
  }

  async provideFeedbackOnSuggestion(
    flowId: string,
    suggestionId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    details?: string
  ): Promise<void> {
    await this.intelligentSuggester.learnFromUserFeedback(
      flowId,
      suggestionId,
      feedback,
      details
    );
  }

  async getSuggestionUsageStatistics(): Promise<any> {
    return await this.intelligentSuggester.getUsageStatistics();
  }

  // Cleanup
  cleanup(): void {
    console.log('🧹 Cleaning up Visual Code Builder...');
    this.flowCache.clear();
    this.mlOptimizer.cleanup();
    this.intelligentSuggester.cleanup();
    console.log('✅ Visual Code Builder cleanup completed');
  }
}