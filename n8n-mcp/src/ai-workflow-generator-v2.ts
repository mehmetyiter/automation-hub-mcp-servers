import { AIProvider, AIProviderConfig } from './types/ai-provider.js';
import { ProviderFactory } from './providers/provider-factory.js';
import { QuickPromptParser } from './workflow-generation/quick-parser.js';
import { QuickWorkflowBuilder } from './workflow-generation/quick-builder.js';
import { QuickValidator } from './workflow-generation/quick-validator.js';
import { AdvancedPromptParser } from './workflow-generation/advanced-prompt-parser.js';
import { AdvancedWorkflowBuilder } from './workflow-generation/advanced-workflow-builder.js';
import { PromptCleaner } from './workflow-generation/prompt-cleaner.js';
import { WorkflowAnalyzer, WorkflowValidator } from './workflow-generation/workflow-analyzer.js';
import { DirectWorkflowBuilder } from './workflow-generation/direct-workflow-builder.js';
import { sanitizeWorkflow, validateWorkflowParameters } from './utils/workflow-sanitizer.js';

export interface WorkflowGenerationOptions {
  apiKey?: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIWorkflowGeneratorV2 {
  private providerConfig: AIProviderConfig;
  private parser = new QuickPromptParser();
  private builder = new QuickWorkflowBuilder();
  private validator = new QuickValidator();
  private advancedParser = new AdvancedPromptParser();
  private advancedBuilder = new AdvancedWorkflowBuilder();
  private directBuilder = new DirectWorkflowBuilder();
  private workflowAnalyzer = new WorkflowAnalyzer();
  private workflowValidator = new WorkflowValidator();
  private useAdvancedMode = false;

  constructor(options: WorkflowGenerationOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required');
    }
    
    if (!options.provider) {
      throw new Error('Provider is required');
    }

    this.providerConfig = {
      provider: options.provider,
      apiKey: options.apiKey,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
  }

  async generateFromPrompt(prompt: string, name: string): Promise<any> {
    console.log('=== AI Workflow Generation V2 Started ===');
    console.log('Original Prompt:', prompt);
    console.log('Name:', name);
    console.log('Provider:', this.providerConfig.provider);
    console.log('Model:', this.providerConfig.model || 'default');
    
    // Extract clean user requirements if this is an AI Assistant formatted prompt
    const cleanPrompt = PromptCleaner.extractUserRequirements(prompt);
    console.log('Clean Prompt:', cleanPrompt);
    
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      
      // Set provider for DirectWorkflowBuilder to enable post-processing
      this.directBuilder.setProvider(provider);
      
      const result = await provider.generateWorkflow(cleanPrompt, name);
      
      if (result.success && result.workflow) {
        // Check if workflow looks like a detailed prompt (text) instead of JSON
        if (typeof result.workflow === 'string' || 
            (result.workflow && result.workflow.prompt) ||
            (result.workflow && !result.workflow.nodes)) {
          
          console.log('Detected detailed prompt response, parsing and building workflow...');
          
          // Extract the actual prompt text
          let detailedPrompt = typeof result.workflow === 'string' 
            ? result.workflow 
            : result.workflow.prompt || JSON.stringify(result.workflow);
          
          // Clean the prompt to ensure only one workflow
          const promptValidation = PromptCleaner.validateSingleWorkflow(detailedPrompt);
          if (!promptValidation.isValid) {
            console.log(`Warning: Detected ${promptValidation.workflowCount} workflows in prompt`);
            console.log('Issues:', promptValidation.issues);
            detailedPrompt = PromptCleaner.cleanPrompt(detailedPrompt);
          }
          
          // Detect if we need advanced mode
          this.useAdvancedMode = this.detectAdvancedMode(detailedPrompt);
          
          // Parse the detailed prompt
          console.log(`Parsing prompt... (${this.useAdvancedMode ? 'Advanced' : 'Quick'} mode)`);
          const parsed = this.useAdvancedMode 
            ? this.advancedParser.parse(detailedPrompt)
            : this.parser.parse(detailedPrompt);
          parsed.workflowName = name || parsed.workflowName;
          
          // Build workflow from parsed data
          console.log('Building workflow...');
          let workflow = this.useAdvancedMode
            ? this.advancedBuilder.build(parsed)
            : this.builder.build(parsed);
          
          // Validate and auto-fix the workflow
          console.log('Validating workflow...');
          let validation = this.validator.validate(workflow);
          let fixAttempts = 0;
          const MAX_FIX_ATTEMPTS = 3;
          
          while (!validation.isValid && fixAttempts < MAX_FIX_ATTEMPTS) {
            console.log(`Validation failed with ${validation.errors.length} errors. Attempt ${fixAttempts + 1}/${MAX_FIX_ATTEMPTS}`);
            
            // First try auto-fix
            workflow = this.validator.autoFix(workflow);
            
            // Re-validate after auto-fix
            validation = this.validator.validate(workflow);
            
            // If still invalid and has critical errors, ask AI to fix
            if (!validation.isValid && validation.errors.length > 0) {
              console.log(`Auto-fix insufficient. Requesting AI correction for ${validation.errors.length} errors...`);
              
              // Prepare error context for AI
              const errorContext = validation.errors.map(e => e.message).join('\n');
              const fixPrompt = `Fix these workflow errors:\n${errorContext}\n\nCurrent workflow has ${workflow.nodes.length} nodes. Ensure all branches have proper conclusions.`;
              
              // Request AI fix (using same provider)
              const fixRequest = {
                workflow: workflow,
                issues: validation.errors.map((e: any) => ({
                  message: e.message,
                  node: e.nodeId,
                  type: e.type
                })),
                originalPrompt: prompt
              };
              
              console.log('Requesting AI fix for workflow issues...');
              const fixResult = await provider.fixWorkflow(fixRequest);
              
              if (fixResult.success && fixResult.workflow) {
                workflow = fixResult.workflow;
                console.log(`AI applied ${fixResult.fixesApplied?.length || 0} fixes, re-validating...`);
              } else {
                console.log('AI fix failed:', fixResult.error);
                break;
              }
            }
            
            fixAttempts++;
          }
          
          if (!validation.isValid) {
            console.log(`WARNING: Workflow still has ${validation.errors.length} errors after ${fixAttempts} fix attempts`);
            // Continue anyway but log the issues
          }
        } else if (result.workflow && result.workflow.nodes && result.workflow.connections) {
          
          console.log('Detected direct AI workflow JSON, using DirectWorkflowBuilder...');
          
          // Analyze the prompt to extract requirements and plan
          console.log('Analyzing prompt for requirements and validation...');
          const workflowPlan = this.workflowAnalyzer.analyzePrompt(prompt);
          
          // AI returned perfect JSON workflow, use it directly with workflow plan
          let workflow = this.directBuilder.build(result.workflow, workflowPlan);
          
          // Validate with analyzer
          console.log('Validating workflow against prompt requirements...');
          const workflowValidation = this.workflowValidator.validateImplementation(workflowPlan, workflow);
          console.log(`Workflow compliance score: ${(workflowValidation.score * 100).toFixed(1)}%`);
          console.log(`Implemented features: ${workflowValidation.implemented.join(', ')}`);
          
          if (workflowValidation.missing.length > 0) {
            console.log(`Missing features: ${workflowValidation.missing.join(', ')}`);
          }
          
          if (workflowValidation.issues.length > 0) {
            console.log('Validation issues found:');
            workflowValidation.issues.forEach(issue => {
              console.log(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
            });
          }
          
          console.log(`Generated workflow with ${workflow.nodes.length} nodes (AI details preserved)`);
          
          // Sanitize workflow parameters to prevent n8n errors
          workflow = sanitizeWorkflow(workflow);
          
          // Validate workflow parameters
          const paramValidation = validateWorkflowParameters(workflow);
          if (!paramValidation.valid) {
            console.warn('Workflow parameter issues:', paramValidation.errors);
          }
          
          // Run QuickValidator to check and fix connections
          console.log('Running connection validation...');
          const quickValidation = this.validator.validate(workflow);
          if (!quickValidation.isValid || quickValidation.warnings.length > 0) {
            console.log(`Connection validation: ${quickValidation.errors.length} errors, ${quickValidation.warnings.length} warnings`);
            workflow = this.validator.autoFix(workflow);
            const reValidation = this.validator.validate(workflow);
            console.log(`After auto-fix: ${reValidation.errors.length} errors, ${reValidation.warnings.length} warnings`);
          }
          
          result.workflow = workflow;
        } else {
          console.log('Unknown workflow format, applying fallback validation...');
          result.workflow = this.validateAndFixConnections(result.workflow);
        }
      } else {
        console.log('No workflow generated or validation failed');
      }
      
      return result;
    } catch (error: any) {
      console.error('Workflow generation failed:', error);
      return {
        success: false,
        error: error.message,
        provider: this.providerConfig.provider
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      return await provider.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const provider = ProviderFactory.createProvider(this.providerConfig);
      return await provider.getModels();
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  static getSupportedProviders(): AIProvider[] {
    return ProviderFactory.getActiveProviders();
  }

  private validateAndFixConnections(workflow: any): any {
    if (!workflow.connections) {
      workflow.connections = {};
    }

    // First normalize the connection format in case AI generated wrong format
    workflow.connections = this.normalizeConnectionFormat(workflow.connections);

    // Get all node IDs (removed unused vars)

    // Check each node has connections (except start nodes)
    workflow.nodes.forEach((node: any) => {
      const nodeName = node.name;
      
      // Skip if it's a trigger node and already has connections
      if (workflow.connections[nodeName]) {
        return;
      }

      // Find nodes that should connect to this node based on position
      const potentialSource = this.findPotentialSourceNode(node, workflow.nodes);
      if (potentialSource && !workflow.connections[potentialSource.name]) {
        workflow.connections[potentialSource.name] = {
          main: [[{
            node: nodeName,
            type: 'main',
            index: 0
          }]]
        };
      }
    });

    // Fix disconnected final/orchestration nodes
    const finalNodes = workflow.nodes.filter((n: any) => 
      n.name.toLowerCase().includes('final') || 
      n.name.toLowerCase().includes('orchestration') ||
      n.name.toLowerCase().includes('completion') ||
      n.name.toLowerCase().includes('track')
    );
    
    // Fix disconnected error handling nodes
    const errorNodes = workflow.nodes.filter((n: any) => 
      n.name.toLowerCase().includes('error') || 
      n.name.toLowerCase().includes('notification') ||
      n.name.toLowerCase().includes('alert')
    );

    finalNodes.forEach((finalNode: any) => {
      if (!this.hasIncomingConnections(finalNode.name, workflow.connections)) {
        // Find the last merge or set node to connect from
        const sourceNode = this.findBestSourceForFinalNode(finalNode, workflow);
        if (sourceNode) {
          if (!workflow.connections[sourceNode.name]) {
            workflow.connections[sourceNode.name] = { main: [[]] };
          }
          workflow.connections[sourceNode.name].main[0].push({
            node: finalNode.name,
            type: 'main',
            index: 0
          });
        }
      }
    });
    
    // Connect error handling nodes to appropriate sources
    errorNodes.forEach((errorNode: any) => {
      if (!this.hasIncomingConnections(errorNode.name, workflow.connections)) {
        // Find HTTP Request or Database nodes that might fail
        const criticalNodes = workflow.nodes.filter((n: any) => 
          n.type.includes('httpRequest') || 
          n.type.includes('database') || 
          n.type.includes('api') ||
          n.name.toLowerCase().includes('send') ||
          n.name.toLowerCase().includes('collect')
        );
        
        if (criticalNodes.length > 0) {
          // Connect error node to the first critical node found
          const sourceNode = criticalNodes[0];
          if (!workflow.connections[sourceNode.name]) {
            workflow.connections[sourceNode.name] = { main: [[]] };
          }
          // Add error output connection (index 1 for error branch)
          if (!workflow.connections[sourceNode.name].main[1]) {
            workflow.connections[sourceNode.name].main[1] = [];
          }
          workflow.connections[sourceNode.name].main[1].push({
            node: errorNode.name,
            type: 'main',
            index: 0
          });
        }
      }
    });

    return workflow;
  }

  private findPotentialSourceNode(targetNode: any, allNodes: any[]): any {
    // Find node that's positioned before this one
    const targetX = targetNode.position[0];
    const targetY = targetNode.position[1];

    return allNodes
      .filter(n => n.id !== targetNode.id)
      .filter(n => n.position[0] < targetX) // Must be to the left
      .sort((a, b) => {
        // Prefer nodes that are horizontally aligned
        const aDist = Math.abs(a.position[1] - targetY);
        const bDist = Math.abs(b.position[1] - targetY);
        return aDist - bDist;
      })[0];
  }

  private hasIncomingConnections(nodeName: string, connections: any): boolean {
    for (const [, targets] of Object.entries(connections)) {
      const targetsData = targets as any;
      if (targetsData.main) {
        for (const branch of targetsData.main) {
          if (branch.some((conn: any) => conn.node === nodeName)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private findBestSourceForFinalNode(finalNode: any, workflow: any): any {
    // Look for merge nodes first
    const mergeNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.merge' && n.id !== finalNode.id
    );
    
    if (mergeNodes.length > 0) {
      // Return the rightmost merge node
      return mergeNodes.sort((a: any, b: any) => b.position[0] - a.position[0])[0];
    }

    // Look for set nodes
    const setNodes = workflow.nodes.filter((n: any) => 
      n.type === 'n8n-nodes-base.set' && n.id !== finalNode.id
    );
    
    if (setNodes.length > 0) {
      return setNodes.sort((a: any, b: any) => b.position[0] - a.position[0])[0];
    }

    // Return any node that's to the left of the final node
    return this.findPotentialSourceNode(finalNode, workflow.nodes);
  }

  private normalizeConnectionFormat(connections: any): any {
    const normalized: any = {};
    
    Object.entries(connections).forEach(([sourceName, targets]: [string, any]) => {
      if (!targets || !targets.main) {
        return;
      }
      
      // Check if we have the wrong format (single array instead of double array)
      if (Array.isArray(targets.main) && targets.main.length > 0 && 
          typeof targets.main[0] === 'object' && targets.main[0].node) {
        // This is the incorrect format: main: [{"node": "...", "type": "main", "index": 0}]
        // Convert to correct format: main: [[{"node": "...", "type": "main", "index": 0}]]
        console.log(`Converting single array format to double array for ${sourceName}`);
        normalized[sourceName] = {
          main: [targets.main] // Wrap the single array in another array
        };
      } else {
        // Normal processing for correct format or other edge cases
        normalized[sourceName] = {
          main: targets.main.map((targetGroup: any) => {
            // If it's already in the correct format, keep it
            if (Array.isArray(targetGroup) && targetGroup.length > 0 && 
                typeof targetGroup[0] === 'object' && targetGroup[0].node) {
              return targetGroup;
            }
            
            // Convert string format to object format
            return targetGroup.map((target: any) => {
              if (typeof target === 'string') {
                return {
                  node: target,
                  type: 'main',
                  index: 0
                };
              }
              return target;
            });
          })
        };
      }
    });
    
    return normalized;
  }

  private detectAdvancedMode(detailedPrompt: string): boolean {
    console.log('Detecting workflow mode...');
    
    // Advanced mode indicators
    const advancedIndicators = [
      // Parallel execution patterns
      /parallel\s*(execution|processing)/gi,
      /simultaneously/gi,
      /at\s*the\s*same\s*time/gi,
      /concurrent(ly)?/gi,
      
      // Switch/routing patterns
      /switch\s*(between|based|on)/gi,
      /route\s*(to|based|on)/gi,
      /decision\s*(point|tree|logic)/gi,
      /condition(al)?\s*(branch|logic|routing)/gi,
      /multiple\s*branches/gi,
      
      // Merge patterns
      /merge\s*(results|data|branches)/gi,
      /combine\s*(outputs|results)/gi,
      /join\s*(parallel|branches)/gi,
      
      // Complex error handling
      /error\s*handling\s*for\s*(multiple|different|each)/gi,
      /catch\s*different\s*errors/gi,
      /error\s*branches/gi,
      
      // Multiple triggers
      /multiple\s*triggers/gi,
      /different\s*trigger\s*types/gi,
      
      // Complex workflows
      /complex\s*(workflow|process|logic)/gi,
      /advanced\s*(workflow|automation)/gi
    ];
    
    // Check for indicators
    let indicatorCount = 0;
    for (const pattern of advancedIndicators) {
      if (pattern.test(detailedPrompt)) {
        indicatorCount++;
        console.log(`Found advanced indicator: ${pattern.source}`);
      }
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
    }
    
    // Additional checks for specific patterns
    const hasParallelBranches = detailedPrompt.match(/\(parallel\)/gi) || 
                               detailedPrompt.match(/parallel.*branches/gi);
    const hasSwitchLogic = detailedPrompt.match(/branches?:\s*\n(?:\s*[-*]\s*.+\n)+/gi);
    const hasMultipleMerges = (detailedPrompt.match(/merge/gi) || []).length > 1;
    
    // Decision logic
    const useAdvanced = indicatorCount >= 2 || 
                       hasParallelBranches !== null || 
                       hasSwitchLogic !== null || 
                       hasMultipleMerges;
    
    console.log(`Advanced mode indicators found: ${indicatorCount}`);
    console.log(`Has parallel branches: ${hasParallelBranches !== null}`);
    console.log(`Has switch logic: ${hasSwitchLogic !== null}`);
    console.log(`Has multiple merges: ${hasMultipleMerges}`);
    console.log(`Using ${useAdvanced ? 'Advanced' : 'Quick'} mode`);
    
    return useAdvanced;
  }
}