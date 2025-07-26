// learning/system-rules.ts

/**
 * System rules and best practices from CLAUDE.md
 * These are used to initialize the learning system with domain knowledge
 * 
 * 🔄 IMPORTANT: Keep this file synchronized with CLAUDE.md!
 * When adding new rules to CLAUDE.md, update this file accordingly:
 * - Critical rules → SYSTEM_RULES.principles
 * - Best practices → SYSTEM_RULES.bestPractices
 * - Common errors → SYSTEM_RULES.avoidErrors
 * - Validation rules → SYSTEM_RULES.validationRules
 * 
 * This ensures the learning engine always has the latest system knowledge.
 */

export const SYSTEM_RULES = {
  // Core Principles
  principles: [
    {
      category: 'template_prevention',
      rule: 'NEVER use templates or hardcoded patterns',
      description: 'Every workflow must be generated uniquely based on user requirements',
      severity: 'critical',
      examples: {
        wrong: 'Using pre-defined workflow templates',
        correct: 'AI-driven generation based on user prompt'
      }
    },
    {
      category: 'excellence',
      rule: 'Excellence Over Shortcuts',
      description: 'Never return minimal or fallback responses when errors occur',
      severity: 'critical',
      examples: {
        wrong: 'return { nodes: [], connections: {} }',
        correct: 'Throw detailed error with context'
      }
    },
    {
      category: 'user_preference',
      rule: 'Always respect user provider choice',
      description: 'Never default to OpenAI or any specific provider',
      severity: 'critical',
      examples: {
        wrong: 'provider || "openai"',
        correct: 'Use user selected provider only'
      }
    }
  ],

  // Workflow Structure Requirements
  workflowRequirements: [
    {
      category: 'metadata',
      rule: 'All workflows must have complete metadata',
      fields: ['id', 'versionId', 'meta.instanceId', 'tags', 'pinData'],
      severity: 'critical'
    },
    {
      category: 'connections',
      rule: 'All non-trigger nodes must have incoming connections',
      severity: 'error',
      autoFixable: true
    },
    {
      category: 'naming',
      rule: 'Connections use node names, not IDs',
      severity: 'critical'
    },
    {
      category: 'node_parameters',
      rule: 'Node parameters must match n8n expected formats',
      description: 'emailSend.toRecipients must be array, merge.mergeByFields.values must be array, etc.',
      severity: 'critical',
      autoFixable: true,
      examples: {
        wrong: 'toRecipients: "email@example.com"',
        correct: 'toRecipients: ["email@example.com"]'
      }
    },
    {
      category: 'node_parameters',
      rule: 'HTTP Request parameters must use array format',
      description: 'headerParameters and queryParameters must be arrays of {name, value} objects',
      severity: 'critical',
      autoFixable: true,
      examples: {
        wrong: 'headerParameters: {"Content-Type": "application/json"}',
        correct: 'headerParameters: {parameters: [{name: "Content-Type", value: "application/json"}]}'
      }
    },
    {
      category: 'node_parameters',
      rule: 'Code nodes must use language-specific parameters',
      description: 'Use jsCode for JavaScript and pythonCode for Python',
      severity: 'critical',
      autoFixable: true,
      examples: {
        wrong: 'parameters: {code: "return items;"}',
        correct: 'parameters: {language: "javascript", jsCode: "return items;"}'
      }
    }
  ],

  // Validation Rules
  validationRules: [
    {
      category: 'branch_completion',
      rule: 'Each branch must reach a logical conclusion',
      validConclusions: [
        'Database save/update',
        'Email/notification send',
        'API call that completes an action',
        'File write operation',
        'Webhook response'
      ],
      severity: 'error'
    },
    {
      category: 'merge_nodes',
      rule: 'Only merge branches that need merging',
      description: 'Do not force-merge branches that already have proper conclusions',
      severity: 'warning'
    },
    {
      category: 'error_handling',
      rule: 'Critical operations should have error handling',
      severity: 'warning',
      examples: {
        criticalOperations: ['database operations', 'external API calls', 'file operations']
      }
    },
    {
      category: 'switch_nodes',
      rule: 'Switch nodes must have all output branches explicitly defined',
      description: 'Each case in a switch node must have its connections defined',
      severity: 'critical',
      examples: {
        wrong: 'Switch node with empty connections object',
        correct: 'Switch with connections for each case branch'
      }
    },
    {
      category: 'switch_nodes',
      rule: 'Switch node outputs must connect to meaningful nodes',
      description: 'Each switch output must lead to a node that processes that specific case',
      severity: 'error'
    },
    {
      category: 'section_connections',
      rule: 'Multi-section workflows must have explicit connections between sections',
      description: 'End nodes of one section must connect to start nodes of the next section',
      severity: 'critical',
      examples: {
        wrong: 'Sections generated independently without connections',
        correct: 'Each section explicitly connected to its dependencies'
      }
    }
  ],

  // Code Quality Rules
  codeQuality: [
    {
      category: 'dry_principle',
      rule: 'Never duplicate code',
      description: 'Extract common functionality to utilities',
      severity: 'error'
    },
    {
      category: 'function_returns',
      rule: 'Function nodes must return array format',
      examples: {
        wrong: 'return {json: data}',
        correct: 'return [{json: data}]'
      },
      severity: 'error',
      autoFixable: true
    }
  ],

  // Performance Guidelines
  performance: [
    {
      category: 'multi_step',
      rule: 'Use multi-step generation for complex workflows',
      threshold: 50, // nodes
      severity: 'warning'
    },
    {
      category: 'timeout',
      rule: 'Implement appropriate timeouts',
      defaults: {
        generation: 120000, // 2 minutes
        repair: 120000
      },
      severity: 'warning'
    }
  ],

  // Common Errors to Avoid
  avoidErrors: [
    'Disconnected nodes without connections',
    'Circular references in workflow structure',
    'Missing required parameters in nodes',
    'Invalid node types not in catalog',
    'Empty branches in switch nodes',
    'Hardcoded API keys or credentials',
    'Template-based generation',
    'Defaulting to specific providers',
    'Switch nodes without defined output connections',
    'Unconnected workflow sections in multi-step generation',
    'Dead-end nodes with no logical conclusion',
    'Missing connections between dependent sections',
    'String toRecipients in emailSend nodes (must be array)',
    'Non-array mergeByFields.values in merge nodes',
    'Incorrect documentId format in MongoDB nodes',
    'Missing mode/options in switch nodes',
    'Object headerParameters.parameters in httpRequest (must be array)',
    'Object queryParameters.parameters in httpRequest (must be array)',
    'Missing language parameter in code nodes',
    'Using "code" instead of "jsCode"/"pythonCode" in code nodes',
    'Non-array values.values in set nodes',
    'Non-array conditions.conditions in if/filter nodes',
    'Non-array rule.interval in scheduleTrigger nodes',
    'Non-array attachments in slack nodes',
    'Missing required operation parameter in operation-based nodes',
    'String values for array-type parameters'
  ],

  // Best Practices
  bestPractices: [
    'Validate workflow structure before returning',
    'Use QuickValidator for auto-fixing simple issues',
    'Track all errors for system improvement',
    'Preserve all n8n metadata fields',
    'Use node catalog for type validation',
    'Implement proper error handling',
    'Test with actual n8n instance',
    'Document complex logic in function nodes'
  ]
};

/**
 * Get rules by category
 */
export function getRulesByCategory(category: string): any[] {
  const allRules = [
    ...SYSTEM_RULES.principles,
    ...SYSTEM_RULES.workflowRequirements,
    ...SYSTEM_RULES.validationRules,
    ...SYSTEM_RULES.codeQuality,
    ...SYSTEM_RULES.performance
  ];
  
  return allRules.filter(rule => rule.category === category);
}

/**
 * Get all critical rules
 */
export function getCriticalRules(): any[] {
  const allRules = [
    ...SYSTEM_RULES.principles,
    ...SYSTEM_RULES.workflowRequirements,
    ...SYSTEM_RULES.validationRules,
    ...SYSTEM_RULES.codeQuality,
    ...SYSTEM_RULES.performance
  ];
  
  return allRules.filter(rule => rule.severity === 'critical');
}

/**
 * Get auto-fixable rules
 */
export function getAutoFixableRules(): any[] {
  const allRules = [
    ...SYSTEM_RULES.workflowRequirements,
    ...SYSTEM_RULES.validationRules,
    ...SYSTEM_RULES.codeQuality
  ];
  
  return allRules.filter(rule => 'autoFixable' in rule && rule.autoFixable === true);
}

/**
 * Convert rules to learning context format
 */
export function rulesToLearningContext(): {
  avoidErrors: string[];
  bestPractices: string[];
} {
  // Combine avoid errors with critical rule violations
  const avoidErrors = [
    ...SYSTEM_RULES.avoidErrors,
    ...getCriticalRules().map(rule => rule.rule)
  ];
  
  // Combine best practices with important rules
  const bestPractices = [
    ...SYSTEM_RULES.bestPractices,
    ...SYSTEM_RULES.principles.map(p => p.rule),
    ...SYSTEM_RULES.workflowRequirements
      .filter(r => r.severity === 'critical')
      .map(r => r.rule)
  ];
  
  return {
    avoidErrors: [...new Set(avoidErrors)], // Remove duplicates
    bestPractices: [...new Set(bestPractices)]
  };
}