export interface N8nNodeType {
  name: string;
  category: string;
  description: string;
  typicalUse: string[];
  canConnectTo?: string[];
  requiredNodes?: string[];
}

export interface N8nCapabilities {
  nodeTypes: N8nNodeType[];
  patterns: WorkflowPattern[];
  expansionRules: ExpansionRule[];
}

export interface WorkflowPattern {
  name: string;
  description: string;
  minNodes: number;
  suggestedNodes: string[];
}

export interface ExpansionRule {
  trigger: string;
  expansion: string[];
  minNodes: number;
}

export const N8N_NODE_CAPABILITIES: N8nCapabilities = {
  nodeTypes: [
    // Trigger Nodes
    {
      name: "Webhook Trigger",
      category: "trigger",
      description: "Receives HTTP requests to trigger workflows",
      typicalUse: ["API endpoints", "External system integration", "Real-time processing"],
      canConnectTo: ["validation", "processing", "response"]
    },
    {
      name: "Execute Workflow Trigger",
      category: "trigger", 
      description: "Triggers when called by another workflow",
      typicalUse: ["Modular workflows", "Reusable components", "Complex orchestration"],
      canConnectTo: ["any"]
    },
    {
      name: "Error Trigger",
      category: "trigger",
      description: "Activates when a workflow execution fails",
      typicalUse: ["Error handling", "Recovery processes", "Alerting"],
      canConnectTo: ["notification", "logging", "recovery"]
    },
    {
      name: "Chat Trigger",
      category: "trigger",
      description: "Handles chat interactions and conversations",
      typicalUse: ["Chatbots", "Conversational AI", "Interactive workflows"],
      canConnectTo: ["ai", "processing", "response"]
    },
    
    // Data Processing Nodes
    {
      name: "Code Node",
      category: "processing",
      description: "Execute custom JavaScript/Python code",
      typicalUse: ["Data transformation", "Complex calculations", "Custom logic"],
      canConnectTo: ["any"]
    },
    {
      name: "IF Node",
      category: "logic",
      description: "Conditional branching based on data values",
      typicalUse: ["Decision making", "Flow control", "Data routing"],
      canConnectTo: ["any"],
      requiredNodes: ["merge"]
    },
    {
      name: "Switch Node",
      category: "logic",
      description: "Multi-way branching for complex routing",
      typicalUse: ["Multiple conditions", "Complex routing", "State machines"],
      canConnectTo: ["any"],
      requiredNodes: ["merge"]
    },
    {
      name: "Merge Node",
      category: "processing",
      description: "Combines data from multiple sources",
      typicalUse: ["Join branches", "Aggregate data", "Synchronize flows"],
      canConnectTo: ["any"]
    },
    {
      name: "Loop Node",
      category: "processing",
      description: "Iterates over data items",
      typicalUse: ["Batch processing", "Item-by-item operations", "Recursive tasks"],
      canConnectTo: ["processing", "validation"]
    },
    {
      name: "Wait Node",
      category: "control",
      description: "Pauses workflow execution",
      typicalUse: ["Rate limiting", "Scheduled delays", "Synchronization"],
      canConnectTo: ["any"]
    },
    
    // HTTP & API Nodes
    {
      name: "HTTP Request",
      category: "communication",
      description: "Makes HTTP/API calls",
      typicalUse: ["API integration", "Data fetching", "External services"],
      canConnectTo: ["validation", "processing", "error-handling"]
    },
    {
      name: "Respond to Webhook",
      category: "response",
      description: "Sends responses back to webhook callers",
      typicalUse: ["API responses", "Webhook completion", "Status updates"],
      canConnectTo: []
    },
    
    // AI Nodes
    {
      name: "AI Agent",
      category: "ai",
      description: "AI agents with tool calling capabilities",
      typicalUse: ["Complex AI tasks", "Multi-step reasoning", "Tool orchestration"],
      canConnectTo: ["processing", "validation", "response"]
    },
    {
      name: "Chat Model",
      category: "ai",
      description: "LLM integrations for text generation",
      typicalUse: ["Text generation", "Conversations", "Content creation"],
      canConnectTo: ["processing", "validation", "response"]
    },
    
    // Database Nodes
    {
      name: "SQL",
      category: "database",
      description: "Database operations",
      typicalUse: ["Data storage", "Queries", "CRUD operations"],
      canConnectTo: ["processing", "validation", "transformation"]
    }
  ],
  
  patterns: [
    {
      name: "API Endpoint Pattern",
      description: "Complete API endpoint with validation and error handling",
      minNodes: 15,
      suggestedNodes: [
        "Webhook Trigger",
        "Code (Input Validation)",
        "IF (Check Auth)",
        "HTTP Request (Auth Service)",
        "IF (Auth Valid)",
        "Code (Parse Request)",
        "Switch (Route by Type)",
        "Code (Process Type A)",
        "Code (Process Type B)",
        "Merge",
        "Code (Format Response)",
        "Respond to Webhook",
        "Error Trigger",
        "Code (Log Error)",
        "Respond to Webhook (Error)"
      ]
    },
    {
      name: "Data Processing Pipeline",
      description: "Comprehensive data processing with validation and transformation",
      minNodes: 20,
      suggestedNodes: [
        "Trigger",
        "Code (Validate Input)",
        "IF (Valid Data)",
        "Code (Extract Fields)",
        "HTTP Request (Fetch Additional Data)",
        "Code (Transform Data)",
        "Loop (Process Items)",
        "Code (Item Processing)",
        "IF (Item Valid)",
        "Code (Enrich Item)",
        "HTTP Request (External API)",
        "Code (Merge Results)",
        "Merge (Loop End)",
        "Code (Aggregate)",
        "SQL (Store Results)",
        "Code (Generate Report)",
        "Email (Send Report)",
        "Error Trigger",
        "Code (Error Handler)",
        "Email (Error Notification)"
      ]
    }
  ],
  
  expansionRules: [
    {
      trigger: "API integration",
      expansion: [
        "HTTP Request (Auth)",
        "IF (Auth Success)",
        "Code (Parse Token)",
        "HTTP Request (API Call)",
        "Code (Validate Response)",
        "IF (Valid Response)",
        "Code (Transform Data)",
        "Code (Error Handler)",
        "Wait (Rate Limit)",
        "Merge"
      ],
      minNodes: 10
    },
    {
      trigger: "Database operation",
      expansion: [
        "Code (Build Query)",
        "SQL (Execute Query)",
        "IF (Query Success)",
        "Code (Process Results)",
        "Code (Transform Data)",
        "Code (Handle Error)",
        "Code (Log Operation)",
        "Merge"
      ],
      minNodes: 8
    },
    {
      trigger: "Notification",
      expansion: [
        "Code (Check Preferences)",
        "Switch (By Channel)",
        "Code (Format Email)",
        "Email (Send)",
        "Code (Format SMS)",
        "SMS (Send)",
        "Code (Format Push)",
        "Push (Send)",
        "Merge",
        "Code (Track Delivery)"
      ],
      minNodes: 10
    },
    {
      trigger: "Error handling",
      expansion: [
        "Error Trigger",
        "Code (Classify Error)",
        "Switch (Error Type)",
        "Code (Handle Type 1)",
        "Code (Handle Type 2)",
        "Code (Handle Type 3)",
        "Merge",
        "IF (Retry Needed)",
        "Wait (Backoff)",
        "Execute Workflow (Retry)",
        "Code (Log Error)",
        "Email (Alert Admin)"
      ],
      minNodes: 12
    },
    {
      trigger: "Data validation",
      expansion: [
        "Code (Schema Validation)",
        "IF (Valid Schema)",
        "Code (Type Checking)",
        "IF (Valid Types)",
        "Code (Business Rules)",
        "IF (Rules Pass)",
        "Code (Sanitize Data)",
        "Code (Log Validation)",
        "Merge (Validation Complete)"
      ],
      minNodes: 9
    }
  ]
};

export class N8nKnowledgeBase {
  getNodesByCategory(category: string): N8nNodeType[] {
    return N8N_NODE_CAPABILITIES.nodeTypes.filter(node => node.category === category);
  }
  
  getExpansionForFeature(feature: string): ExpansionRule | undefined {
    const lowerFeature = feature.toLowerCase();
    return N8N_NODE_CAPABILITIES.expansionRules.find(rule => 
      lowerFeature.includes(rule.trigger.toLowerCase())
    );
  }
  
  suggestNodesForUseCase(useCase: string): string[] {
    const suggestions: string[] = [];
    const lowerUseCase = useCase.toLowerCase();
    
    // Find relevant nodes based on use case
    N8N_NODE_CAPABILITIES.nodeTypes.forEach(node => {
      if (node.typicalUse.some(use => lowerUseCase.includes(use.toLowerCase()))) {
        suggestions.push(node.name);
      }
    });
    
    // Find relevant patterns
    N8N_NODE_CAPABILITIES.patterns.forEach(pattern => {
      if (lowerUseCase.includes(pattern.name.toLowerCase())) {
        suggestions.push(...pattern.suggestedNodes);
      }
    });
    
    return [...new Set(suggestions)];
  }
  
  calculateRecommendedNodes(features: string[]): number {
    let totalNodes = 3; // Base nodes (trigger, process, response)
    
    features.forEach(feature => {
      const expansion = this.getExpansionForFeature(feature);
      if (expansion) {
        totalNodes += expansion.minNodes;
      } else {
        // Default estimation for unknown features
        totalNodes += 5;
      }
    });
    
    return totalNodes; // Return actual needed nodes, no minimum
  }
}