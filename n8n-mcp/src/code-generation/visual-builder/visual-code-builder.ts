import { CodeGenerationRequest, GeneratedCode } from '../types';
import { DynamicCodeGenerator } from '../dynamic-code-generator';
import { AIService } from '../../ai-service';
import { 
  ValidationError,
  WorkflowError 
} from '../errors/custom-errors';

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
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_CLEANUP_THRESHOLD = 120;

  constructor(provider?: string) {
    this.dynamicCodeGenerator = new DynamicCodeGenerator(provider);
    this.aiService = new AIService(provider);
    this.blockTemplates = new Map();
    this.flowCache = new Map();
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
        language: flow.metadata.language
      },
      workflowContext: {
        visualFlow: flow
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
        : param.value;
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
        const typeTemplates = this.blockTemplates.get(suggestion.type) || [];
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
    return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}