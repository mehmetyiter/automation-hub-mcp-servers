/**
 * Comprehensive Workflow Generation Guidelines
 * 
 * This module provides detailed instructions for AI to generate better n8n workflows
 * with proper branch completion, intelligent merge usage, and clear endpoints.
 */

export interface WorkflowGuideline {
  category: string;
  rules: string[];
  examples: {
    good: string[];
    bad: string[];
  };
}

export class WorkflowGenerationGuidelines {
  
  /**
   * Core principles for workflow generation
   */
  static readonly CORE_PRINCIPLES = [
    "Every workflow branch must have a clear completion point",
    "Merge nodes should only be used when data aggregation is needed",
    "Each node should have a specific purpose in the workflow",
    "Avoid creating 'dead-end' branches that don't contribute to workflow goals",
    "Use appropriate node types for each task (e.g., HTTP Request for APIs, not Function nodes)",
    "Include error handling for critical operations",
    "Minimize unnecessary complexity - simpler is better"
  ];

  /**
   * Guidelines organized by category
   */
  static readonly GUIDELINES: Record<string, WorkflowGuideline> = {
    
    branchCompletion: {
      category: "Branch Completion",
      rules: [
        "Every branch must end with a concrete action (save data, send notification, update system)",
        "Notification branches (SMS, Email, WhatsApp) are complete after sending - don't merge them",
        "Data processing branches must save results to database or pass to next system",
        "Report generation branches must deliver the report (email, file storage, dashboard)",
        "Alert branches are complete after notification is sent",
        "Don't merge branches unless you need to combine their data"
      ],
      examples: {
        good: [
          "MQTT → Process → Critical? → Send SMS (END)",
          "Generate Report → Save to Database → Update Dashboard (END)",
          "Check Inventory → Low Stock? → Create Order → Send to Supplier (END)"
        ],
        bad: [
          "Send SMS → Merge (unnecessary merge)",
          "Generate Report → Merge (what happens to report?)",
          "Process Data → (no endpoint defined)"
        ]
      }
    },

    mergeNodeUsage: {
      category: "Merge Node Usage",
      rules: [
        "Use Merge nodes ONLY when you need to combine data from multiple sources",
        "Don't use Merge as a 'collection point' for unrelated branches",
        "Merge is appropriate for: creating summary reports, combining sensor readings, aggregating results",
        "Merge is NOT needed for: parallel notifications, independent operations, fire-and-forget tasks",
        "If branches don't share data, they shouldn't merge",
        "Consider if the workflow still makes sense without the merge - if yes, remove it"
      ],
      examples: {
        good: [
          "Multiple Sensors → Merge → Calculate Average → Save Summary",
          "Sales Data + Inventory Data → Merge → Generate Combined Report",
          "All Department Reports → Merge → Create Executive Summary"
        ],
        bad: [
          "Send SMS + Send Email → Merge (notifications are independent)",
          "Update Database + Send Alert → Merge (unrelated operations)",
          "All Branches → Merge → (no action after merge)"
        ]
      }
    },

    nodeNaming: {
      category: "Node Naming",
      rules: [
        "Use descriptive, action-oriented names",
        "Include the data or system being acted upon",
        "Avoid generic names like 'Process' or 'Handle'",
        "Use consistent naming patterns throughout the workflow",
        "Name should clearly indicate what the node does"
      ],
      examples: {
        good: [
          "Check Water pH Level",
          "Send Low Stock Alert to Manager",
          "Calculate Daily Energy Consumption",
          "Update Product Inventory in Database"
        ],
        bad: [
          "Process Data",
          "Node 1",
          "Handle Result",
          "Do Something"
        ]
      }
    },

    dataFlow: {
      category: "Data Flow",
      rules: [
        "Data should flow logically from source to destination",
        "Each transformation should have a clear purpose",
        "Avoid circular dependencies or infinite loops",
        "Use appropriate data formats for each node type",
        "Preserve important data throughout the flow",
        "Clean up unnecessary data to reduce payload size"
      ],
      examples: {
        good: [
          "Sensor → Validate → Transform → Store → Notify if abnormal",
          "API Data → Parse → Filter relevant fields → Process → Save",
          "Raw Data → Clean → Analyze → Generate Insights → Deliver"
        ],
        bad: [
          "Data → Process → Process → Process (unclear transformations)",
          "Sensor → Store → Retrieve → Store (redundant operations)",
          "API → Function → Function → Function (use specific nodes instead)"
        ]
      }
    },

    errorHandling: {
      category: "Error Handling",
      rules: [
        "Add error handling for external API calls",
        "Include fallback mechanisms for critical operations",
        "Log errors appropriately for debugging",
        "Don't let errors silently fail",
        "Notify administrators of critical failures",
        "Use Error Workflow nodes for global error catching"
      ],
      examples: {
        good: [
          "HTTP Request → On Error → Log Error → Send Admin Alert",
          "Database Insert → On Error → Retry 3x → If Still Fails → Queue for Manual Review",
          "Critical Operation → Try/Catch → Error? → Rollback → Notify"
        ],
        bad: [
          "API Call → (no error handling)",
          "Database Operation → Ignore Errors",
          "Critical Process → Fail Silently"
        ]
      }
    },

    workflowTypes: {
      category: "Workflow Types",
      rules: [
        "Monitoring workflows: Run continuously, process each event independently",
        "Batch workflows: Process multiple items, may need merge for summary",
        "Alert workflows: Fire quickly, complete after notification",
        "Report workflows: Gather data, process, deliver, done",
        "Integration workflows: Sync data between systems, confirm completion",
        "Automation workflows: Trigger → Action → Verification → Completion"
      ],
      examples: {
        good: [
          "Monitoring: Sensor → Check Threshold → Alert if exceeded → Log (repeat)",
          "Batch: Daily Sales → Process Each → Merge → Summary Report → Email",
          "Alert: Error Detected → Classify → Route to Team → Send Notification (END)"
        ],
        bad: [
          "Monitoring: All Sensors → Merge → Process (loses individual sensor context)",
          "Alert: Detect → Process → Merge with others (delays urgent alerts)",
          "Report: Generate → Merge → (no delivery mechanism)"
        ]
      }
    },

    nodeConfiguration: {
      category: "Node Configuration",
      rules: [
        "Always specify required parameters explicitly",
        "Use environment variables for sensitive data",
        "Configure appropriate timeouts for external calls",
        "Set retry policies for unreliable operations",
        "Use expressions ({{ }}) for dynamic values",
        "Validate inputs before processing"
      ],
      examples: {
        good: [
          "HTTP Request: method='POST', timeout=5000, retry=3",
          "Email: toEmail='{{ $json.manager_email }}', subject='Alert: {{ $json.alert_type }}'",
          "Function: Validate input types before processing"
        ],
        bad: [
          "HTTP Request: (no timeout or retry configuration)",
          "Email: toEmail='email@example.com' (hardcoded)",
          "Function: Assume data format without validation"
        ]
      }
    },

    workflowCompletion: {
      category: "Workflow Completion",
      rules: [
        "Every workflow execution path must reach a meaningful end state",
        "End states should represent completed business operations",
        "Include confirmation or logging at completion points",
        "Avoid 'hanging' branches that don't conclude",
        "Consider what 'success' means for each workflow path",
        "Document expected outcomes for each branch"
      ],
      examples: {
        good: [
          "Order Process: Order Received → Validate → Process Payment → Update Inventory → Send Confirmation → Log Completion",
          "Alert Flow: Detect Issue → Notify Team → Create Ticket → Confirm Delivery → Log Alert Sent",
          "Data Sync: Fetch Data → Transform → Validate → Update Target → Verify Sync → Log Success"
        ],
        bad: [
          "Order Process: Order Received → Validate → Process → (no confirmation)",
          "Alert Flow: Detect → Send → (no verification of delivery)",
          "Data Sync: Fetch → Update → (no validation or confirmation)"
        ]
      }
    }
  };

  /**
   * Generate a comprehensive prompt enhancement for workflow generation
   */
  static generatePromptEnhancement(): string {
    return `
IMPORTANT WORKFLOW GENERATION GUIDELINES:

${this.CORE_PRINCIPLES.map((p, i) => `${i + 1}. ${p}`).join('\n')}

DETAILED RULES BY CATEGORY:

${Object.entries(this.GUIDELINES).map(([key, guideline]) => `
${guideline.category.toUpperCase()}:
${guideline.rules.map(r => `- ${r}`).join('\n')}

Good Examples:
${guideline.examples.good.map(e => `  ✓ ${e}`).join('\n')}

Bad Examples:
${guideline.examples.bad.map(e => `  ✗ ${e}`).join('\n')}
`).join('\n')}

WORKFLOW COMPLETION CHECKLIST:
- [ ] Every branch has a clear endpoint
- [ ] Merge nodes are used only for data aggregation
- [ ] Each node has a specific purpose
- [ ] Error handling is included for external operations
- [ ] Data flows logically from source to destination
- [ ] All paths lead to meaningful completion
- [ ] Node names clearly describe their function

Remember: A good workflow should be self-documenting through clear node names and logical flow structure.
`;
  }

  /**
   * Analyze a workflow plan and suggest improvements
   */
  static analyzeWorkflowPlan(workflowDescription: string): {
    issues: string[];
    suggestions: string[];
    improvedDescription: string;
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let improvedDescription = workflowDescription;

    // Check for merge node overuse
    if (workflowDescription.toLowerCase().includes('merge all')) {
      issues.push("Unnecessary merge of all branches detected");
      suggestions.push("Only merge branches that need data aggregation");
    }

    // Check for undefined endpoints
    if (!workflowDescription.includes('save') && 
        !workflowDescription.includes('send') && 
        !workflowDescription.includes('update') &&
        !workflowDescription.includes('store')) {
      issues.push("No clear data persistence or delivery endpoints");
      suggestions.push("Add specific actions for data storage or notification delivery");
    }

    // Check for generic node names
    const genericTerms = ['process', 'handle', 'do something', 'node'];
    genericTerms.forEach(term => {
      if (workflowDescription.toLowerCase().includes(term)) {
        issues.push(`Generic term '${term}' used`);
        suggestions.push(`Replace '${term}' with specific action description`);
      }
    });

    // Generate improved description
    if (issues.length > 0) {
      improvedDescription = workflowDescription
        .replace(/merge all branches/gi, 'combine data where needed')
        .replace(/process data/gi, 'analyze and transform data')
        .replace(/handle/gi, 'manage')
        .replace(/do something/gi, 'perform specific action');
    }

    return { issues, suggestions, improvedDescription };
  }

  /**
   * Get specific guidelines for a workflow type
   */
  static getGuidelinesForWorkflowType(workflowType: string): string[] {
    const normalizedType = workflowType.toLowerCase();
    const guidelines: string[] = [];

    if (normalizedType.includes('monitor') || normalizedType.includes('sensor')) {
      guidelines.push(
        "Process each sensor reading independently",
        "Don't merge sensor data unless calculating aggregates",
        "Include threshold checking and alerting",
        "Log abnormal readings for analysis",
        "Each sensor branch should complete independently"
      );
    }

    if (normalizedType.includes('alert') || normalizedType.includes('notification')) {
      guidelines.push(
        "Alerts should be sent immediately without waiting",
        "Don't merge notification branches",
        "Include delivery confirmation if critical",
        "Log alert sending for audit trail",
        "Each alert type can have its own path"
      );
    }

    if (normalizedType.includes('report') || normalizedType.includes('analytics')) {
      guidelines.push(
        "Gather all necessary data first",
        "Use merge nodes to combine data sources",
        "Transform and aggregate data appropriately",
        "Deliver report via email/storage/dashboard",
        "Archive reports for future reference"
      );
    }

    if (normalizedType.includes('sync') || normalizedType.includes('integration')) {
      guidelines.push(
        "Validate data before syncing",
        "Include error handling and retry logic",
        "Log sync operations for troubleshooting",
        "Verify successful data transfer",
        "Handle conflicts appropriately"
      );
    }

    return guidelines;
  }

  /**
   * Generate node-specific code based on guidelines
   */
  static generateNodeCode(nodeName: string, nodeType: string): string {
    const purposeMap: Record<string, string> = {
      validate: "Validate input data format and required fields",
      transform: "Transform data to target format",
      aggregate: "Combine and summarize multiple data points",
      alert: "Check conditions and trigger notifications",
      save: "Persist data to storage system",
      report: "Generate formatted report from data"
    };

    const purpose = Object.entries(purposeMap).find(([key]) => 
      nodeName.toLowerCase().includes(key)
    )?.[1] || "Process data according to business logic";

    return `// ${purpose}
// Node: ${nodeName}

const items = $input.all();

try {
  const processedItems = items.map(item => {
    const data = item.json;
    
    // TODO: Implement ${nodeName} logic
    // ${purpose}
    
    return {
      json: {
        ...data,
        _processed: true,
        _processedBy: '${nodeName}',
        _timestamp: new Date().toISOString()
      }
    };
  });
  
  return processedItems;
} catch (error) {
  throw new Error(\`Error in ${nodeName}: \${error.message}\`);
}`;
  }
}

/**
 * Export enhanced prompt for workflow generation
 */
export const ENHANCED_WORKFLOW_PROMPT = WorkflowGenerationGuidelines.generatePromptEnhancement();