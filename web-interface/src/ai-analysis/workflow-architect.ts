import { DeepAnalysis, RecognizedPatterns, WorkflowArchitecture } from './types';
import { AIAnalyzer } from './ai-analyzer';

export class WorkflowArchitect {
  private aiAnalyzer: AIAnalyzer;

  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
  }

  async designArchitecture(
    analysis: DeepAnalysis, 
    patterns: RecognizedPatterns
  ): Promise<WorkflowArchitecture> {
    const architecturePrompt = `
TASK: Design a comprehensive workflow architecture based on analysis and patterns.

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

RECOGNIZED PATTERNS:
${JSON.stringify(patterns, null, 2)}

Design a complete workflow architecture:

{
  "mainFlow": {
    "entry_point": "describe the main entry point and trigger",
    "core_processes": [
      {
        "id": "process_1",
        "name": "Process Name",
        "type": "n8n node type",
        "description": "what this process does",
        "inputs": ["required inputs"],
        "outputs": ["expected outputs"],
        "parameters": {
          "key": "value"
        }
      }
    ],
    "exit_points": ["how the workflow completes"]
  },
  "parallelBranches": [
    {
      "name": "Branch Name",
      "trigger": "what triggers this branch",
      "processes": [
        {
          "id": "branch_process_1",
          "name": "Process Name",
          "type": "n8n node type",
          "description": "what this does",
          "inputs": ["inputs"],
          "outputs": ["outputs"],
          "parameters": {}
        }
      ],
      "merge_point": "where this branch merges back"
    }
  ],
  "decisionPoints": [
    {
      "id": "decision_1",
      "condition": "decision condition",
      "true_branch": "process_id if true",
      "false_branch": "process_id if false"
    }
  ],
  "integrationPoints": [
    {
      "system": "external system name",
      "method": "API/Database/etc",
      "authentication": "auth method",
      "error_handling": "how errors are handled"
    }
  ],
  "errorHandlingStrategy": {
    "global_handler": true,
    "branch_specific_handlers": {
      "branch_name": "handler description"
    },
    "retry_policies": {
      "integration_name": {
        "max_attempts": 3,
        "backoff_type": "exponential",
        "initial_delay": 1000
      }
    }
  },
  "monitoringPoints": [
    {
      "location": "where to monitor",
      "metrics": ["what to measure"],
      "alerts": ["when to alert"]
    }
  ]
}

CRITICAL: Design for the SPECIFIC requirements in the analysis.
CRITICAL: Include all necessary error handling and recovery.
CRITICAL: Ensure scalability and maintainability.
CRITICAL: Consider all edge cases and failure scenarios.`;

    const result = await this.aiAnalyzer.callAI(architecturePrompt);
    
    try {
      // Remove markdown code blocks if present
      const cleanedResult = result.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
      return JSON.parse(cleanedResult);
    } catch (error) {
      console.error('Failed to parse architecture design:', error);
      // Return a basic architecture if parsing fails
      return this.createBasicArchitecture(analysis);
    }
  }

  private createBasicArchitecture(analysis: DeepAnalysis): WorkflowArchitecture {
    return {
      mainFlow: {
        entry_point: analysis.entities.triggers[0] || 'Manual trigger',
        core_processes: [
          {
            id: 'start',
            name: 'Start Process',
            type: 'n8n-nodes-base.start',
            description: 'Workflow entry point',
            inputs: [],
            outputs: ['trigger data'],
            parameters: {}
          },
          {
            id: 'process_data',
            name: 'Process Data',
            type: 'n8n-nodes-base.function',
            description: 'Main data processing',
            inputs: ['trigger data'],
            outputs: ['processed data'],
            parameters: {
              functionCode: 'return items;'
            }
          }
        ],
        exit_points: ['Success completion with logging']
      },
      parallelBranches: [],
      decisionPoints: [],
      integrationPoints: analysis.workflow_characteristics.external_integrations.map(integration => ({
        system: integration,
        method: 'API',
        authentication: 'API Key',
        error_handling: 'Retry with exponential backoff'
      })),
      errorHandlingStrategy: {
        global_handler: true,
        branch_specific_handlers: {},
        retry_policies: {
          default: {
            max_attempts: 3,
            backoff_type: 'exponential',
            initial_delay: 1000
          }
        }
      },
      monitoringPoints: [
        {
          location: 'Workflow completion',
          metrics: ['execution time', 'success rate'],
          alerts: ['failure', 'timeout']
        }
      ]
    };
  }
}