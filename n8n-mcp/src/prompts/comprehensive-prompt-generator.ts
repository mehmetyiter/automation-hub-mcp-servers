import { PromptToWorkflowMapper } from '../planning/prompt-to-workflow-mapper.js';
import { LearningContext } from '../learning/types.js';
import { EnhancedPromptGenerator as OriginalPromptGenerator } from '../ai-analysis/enhanced-prompt-generator.js';

export class ComprehensivePromptGenerator {
  private mapper: PromptToWorkflowMapper;

  constructor() {
    this.mapper = new PromptToWorkflowMapper();
  }

  async generateEnhancedPrompt(
    userPrompt: string,
    workflowName: string,
    learningContext?: LearningContext
  ): Promise<string> {
    // Analyze user prompt to extract features
    const analysis = await this.mapper.analyzePrompt(userPrompt);
    
    // Build comprehensive prompt with all details
    let enhancedPrompt = `Create a comprehensive n8n workflow for: ${workflowName}

## User Requirements:
${userPrompt}

## Workflow Architecture Plan:

### Core Features Detected:
${this.formatFeatures(analysis.features)}

### Workflow Structure:
${this.generateWorkflowStructure(analysis)}

### Node Implementation Details:

#### 1. Entry Points
${this.generateEntryPointsSection(analysis)}

#### 2. Data Processing Flow
${this.generateDataFlowSection(analysis)}

#### 3. Business Logic Implementation
${this.generateBusinessLogicSection(analysis)}

#### 4. Integration Points
${this.generateIntegrationSection(analysis)}

#### 5. Error Handling Strategy
${this.generateErrorHandlingSection()}

### Connection Requirements:
- Every node must be connected (no isolated nodes)
- Use proper connection types (main/error outputs)
- Implement parallel processing where beneficial
- Add merge nodes for converging paths

### Best Practices to Follow:
${this.generateBestPractices(learningContext)}

### Output Requirements:
- Valid n8n JSON workflow format
- All nodes properly configured
- Meaningful node names and descriptions
- Complete connection mappings
- No disconnected or isolated nodes`;

    return enhancedPrompt;
  }

  private formatFeatures(features: Record<string, any>): string {
    const enabledFeatures = Object.entries(features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => `- ${this.humanizeFeature(feature)}`)
      .join('\n');
    
    return enabledFeatures || '- General automation workflow';
  }

  private humanizeFeature(feature: string): string {
    const featureMap: Record<string, string> = {
      hasIoT: 'IoT/Sensor Data Management',
      hasOrderManagement: 'Order Processing & Management',
      hasSafetyFeatures: 'Safety Monitoring & Alerts',
      hasContentModeration: 'Content Review & Moderation',
      hasNLPAnalysis: 'Natural Language Processing',
      hasNotifications: 'Multi-channel Notifications',
      hasDataStorage: 'Data Persistence & Storage',
      hasScheduling: 'Time-based Scheduling',
      hasRealtimeProcessing: 'Real-time Data Processing',
      hasDataTransformation: 'Data Transformation & Mapping',
      hasConditionalLogic: 'Conditional Branching Logic',
      hasErrorHandling: 'Comprehensive Error Handling',
      hasAuthentication: 'Authentication & Security',
      hasRateLimiting: 'Rate Limiting & Throttling',
      hasLogging: 'Activity Logging & Audit'
    };
    
    return featureMap[feature] || feature;
  }

  private generateWorkflowStructure(analysis: any): string {
    const { features, complexity } = analysis;
    
    if (complexity === 'simple') {
      return `- Sequential processing flow
- Single trigger point
- Linear data transformation
- Basic error handling`;
    } else if (complexity === 'moderate') {
      return `- Multiple entry points with webhook triggers
- Conditional routing based on data
- Parallel processing branches
- Data validation and transformation
- Merge points for unified output
- Comprehensive error handling`;
    } else {
      return `- Complex multi-trigger architecture
- Advanced routing with Switch nodes
- Multiple parallel processing paths
- Sub-workflows for modular design
- Advanced data aggregation with Merge nodes
- State management and persistence
- Retry logic and circuit breakers
- Comprehensive monitoring and logging`;
    }
  }

  private generateEntryPointsSection(analysis: any): string {
    const triggers = [];
    
    if (analysis.features.hasScheduling) {
      triggers.push('- Schedule Trigger for time-based execution');
    }
    if (analysis.features.hasWebhooks || analysis.features.hasIoT) {
      triggers.push('- Webhook nodes for external data reception');
    }
    if (analysis.features.hasRealtimeProcessing) {
      triggers.push('- SSE Trigger for real-time events');
    }
    
    if (triggers.length === 0) {
      triggers.push('- Manual trigger or webhook for workflow initiation');
    }
    
    return triggers.join('\n');
  }

  private generateDataFlowSection(analysis: any): string {
    const flows = [];
    
    if (analysis.features.hasDataTransformation) {
      flows.push('- Function nodes for data transformation');
      flows.push('- Set nodes for data structuring');
    }
    
    if (analysis.features.hasConditionalLogic) {
      flows.push('- IF nodes for conditional branching');
      flows.push('- Switch nodes for multi-path routing');
    }
    
    if (analysis.features.hasDataStorage) {
      flows.push('- Database nodes for data persistence');
      flows.push('- Cache management for performance');
    }
    
    return flows.join('\n') || '- Linear data processing with validation';
  }

  private generateBusinessLogicSection(analysis: any): string {
    const logic = [];
    
    if (analysis.features.hasNLPAnalysis) {
      logic.push('- AI/NLP nodes for text analysis');
    }
    
    if (analysis.features.hasContentModeration) {
      logic.push('- Content filtering and validation logic');
    }
    
    if (analysis.features.hasOrderManagement) {
      logic.push('- Order validation and processing rules');
      logic.push('- Inventory management integration');
    }
    
    if (analysis.features.hasSafetyFeatures) {
      logic.push('- Safety threshold monitoring');
      logic.push('- Alert escalation logic');
    }
    
    return logic.join('\n') || '- Core business logic implementation';
  }

  private generateIntegrationSection(analysis: any): string {
    const integrations = [];
    
    if (analysis.features.hasNotifications) {
      integrations.push('- Email Send nodes for notifications');
      integrations.push('- Messaging integrations (Slack, Telegram, etc.)');
    }
    
    if (analysis.features.hasAuthentication) {
      integrations.push('- OAuth2 authentication flows');
      integrations.push('- API key management');
    }
    
    if (analysis.features.hasDataStorage) {
      integrations.push('- Database connections (PostgreSQL, MySQL, etc.)');
      integrations.push('- Cloud storage integrations');
    }
    
    return integrations.join('\n') || '- HTTP Request nodes for external APIs';
  }

  private generateErrorHandlingSection(): string {
    return `- Error Trigger nodes for each major branch
- Structured error logging with context
- Notification system for critical failures
- Graceful degradation strategies
- Retry logic for transient failures
- Dead letter queue for failed items`;
  }

  private generateBestPractices(context?: LearningContext): string {
    const practices = [
      '- Use meaningful node names that describe their purpose',
      '- Add descriptions to complex Function nodes',
      '- Implement proper error boundaries',
      '- Validate data early in the workflow',
      '- Use environment variables for configuration',
      '- Implement idempotency where needed'
    ];
    
    // Add learning context best practices
    if (context?.bestPractices) {
      practices.push(...context.bestPractices.map(p => `- ${p}`));
    }
    
    // Add common error avoidance
    if (context?.avoidErrors) {
      practices.push('\n### Common Pitfalls to Avoid:');
      practices.push(...context.avoidErrors.map(e => `- ${e}`));
    }
    
    return practices.join('\n');
  }

  // Quick mode still needs comprehensive prompt, just simplified presentation
  async generateQuickPrompt(userPrompt: string, workflowName: string, learningContext?: LearningContext): Promise<string> {
    // Analyze user prompt to extract features
    const analysis = await this.mapper.analyzePrompt(userPrompt);
    
    // Use the same comprehensive generation but return it directly
    return this.generateEnhancedPrompt(userPrompt, workflowName, learningContext);
  }
}