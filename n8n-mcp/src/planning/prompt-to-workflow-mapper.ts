import { N8nKnowledgeBase } from '../knowledge/n8n-capabilities.js';

export interface WorkflowTask {
  id: string;
  description: string;
  requiredNodes: string[];
  dependencies: string[];
  status: 'pending' | 'in-progress' | 'completed';
  validationChecks: string[];
}

export interface PromptAnalysisResult {
  features: Map<string, string[]>; // feature -> required nodes
  tasks: WorkflowTask[];
  suggestedNodes: string[];
  validationChecklist: string[];
  missingCapabilities: string[];
}

export class PromptToWorkflowMapper {
  private knowledgeBase: N8nKnowledgeBase;
  
  constructor() {
    this.knowledgeBase = new N8nKnowledgeBase();
  }
  
  async analyzePrompt(prompt: string): Promise<PromptAnalysisResult> {
    const features = this.extractFeaturesFromPrompt(prompt);
    const tasks = this.generateWorkflowTasks(features);
    const suggestedNodes = this.mapFeaturesToNodes(features);
    const validationChecklist = this.generateValidationChecklist(features);
    const missingCapabilities = this.identifyMissingCapabilities(features);
    
    return {
      features,
      tasks,
      suggestedNodes,
      validationChecklist,
      missingCapabilities
    };
  }
  
  private extractFeaturesFromPrompt(prompt: string): Map<string, string[]> {
    const features = new Map<string, string[]>();
    const lowerPrompt = prompt.toLowerCase();
    
    // IoT/Sensor Features
    if (lowerPrompt.includes('sensor') || lowerPrompt.includes('mqtt') || 
        lowerPrompt.includes('iot') || lowerPrompt.includes('device')) {
      features.set('IoT/Sensor Management', [
        'Sensor data collection',
        'MQTT communication',
        'Device control',
        'Real-time monitoring'
      ]);
    }
    
    // Restaurant/Kitchen Features
    if (lowerPrompt.includes('restaurant') || lowerPrompt.includes('kitchen') ||
        lowerPrompt.includes('order') || lowerPrompt.includes('pos')) {
      features.set('Order Management', [
        'Order receiving',
        'Queue management',
        'Kitchen coordination',
        'Status tracking'
      ]);
    }
    
    // Safety/Security Features
    if (lowerPrompt.includes('gas') || lowerPrompt.includes('leak') ||
        lowerPrompt.includes('safety') || lowerPrompt.includes('security') ||
        lowerPrompt.includes('emergency')) {
      features.set('Safety Systems', [
        'Gas leak detection',
        'Emergency shutoff',
        'Alert notifications',
        'Automatic responses'
      ]);
    }
    
    // Inventory/Stock Features
    if (lowerPrompt.includes('inventory') || lowerPrompt.includes('stock') ||
        lowerPrompt.includes('supply') || lowerPrompt.includes('rfid')) {
      features.set('Inventory Management', [
        'Stock level tracking',
        'Automatic ordering',
        'RFID/barcode scanning',
        'Expiration tracking'
      ]);
    }
    
    // Energy/Efficiency Features
    if (lowerPrompt.includes('energy') || lowerPrompt.includes('power') ||
        lowerPrompt.includes('efficiency') || lowerPrompt.includes('consumption')) {
      features.set('Energy Management', [
        'Energy monitoring',
        'Usage optimization',
        'Cost tracking',
        'Automated controls'
      ]);
    }
    
    // YouTube/Video Platform Features
    if (lowerPrompt.includes('youtube') || lowerPrompt.includes('video')) {
      const youtubeFeatures = [];
      if (lowerPrompt.includes('comment') || lowerPrompt.includes('yorum')) {
        youtubeFeatures.push('Comment retrieval', 'Comment monitoring');
      }
      if (lowerPrompt.includes('analytic') || lowerPrompt.includes('analiz')) {
        youtubeFeatures.push('Analytics API', 'Data aggregation');
      }
      features.set('YouTube Integration', youtubeFeatures);
    }
    
    // Moderation Features
    if (lowerPrompt.includes('moderation') || lowerPrompt.includes('moderasyon') || 
        lowerPrompt.includes('spam') || lowerPrompt.includes('filter')) {
      features.set('Content Moderation', [
        'Spam detection',
        'Content filtering',
        'Auto-hide functionality',
        'Moderator notifications'
      ]);
    }
    
    // NLP/AI Features
    if (lowerPrompt.includes('sentiment') || lowerPrompt.includes('duygu') ||
        lowerPrompt.includes('nlp') || lowerPrompt.includes('analiz') ||
        lowerPrompt.includes('ai') || lowerPrompt.includes('machine learning')) {
      features.set('NLP Analysis', [
        'Sentiment analysis',
        'Language detection',
        'Keyword extraction',
        'Trend identification'
      ]);
    }
    
    // Notification Features
    if (lowerPrompt.includes('notification') || lowerPrompt.includes('bildirim') ||
        lowerPrompt.includes('alert') || lowerPrompt.includes('email') ||
        lowerPrompt.includes('sms') || lowerPrompt.includes('whatsapp')) {
      const notificationTypes = [];
      if (lowerPrompt.includes('email')) notificationTypes.push('Email notifications');
      if (lowerPrompt.includes('sms')) notificationTypes.push('SMS alerts');
      if (lowerPrompt.includes('slack')) notificationTypes.push('Slack integration');
      if (lowerPrompt.includes('whatsapp')) notificationTypes.push('WhatsApp messages');
      
      if (notificationTypes.length === 0) {
        notificationTypes.push('General notifications');
      }
      features.set('Notifications', notificationTypes);
    }
    
    // Database Features
    if (lowerPrompt.includes('database') || lowerPrompt.includes('veritabanı') ||
        lowerPrompt.includes('store') || lowerPrompt.includes('kaydet') ||
        lowerPrompt.includes('persist')) {
      features.set('Data Storage', [
        'Database operations',
        'Data persistence',
        'Query capabilities'
      ]);
    }
    
    // Reporting Features
    if (lowerPrompt.includes('report') || lowerPrompt.includes('rapor') ||
        lowerPrompt.includes('dashboard') || lowerPrompt.includes('analytic')) {
      features.set('Reporting', [
        'Report generation',
        'Data visualization',
        'Scheduled reports',
        'Export capabilities'
      ]);
    }
    
    // Scheduling Features
    if (lowerPrompt.includes('schedule') || lowerPrompt.includes('zamanla') ||
        lowerPrompt.includes('daily') || lowerPrompt.includes('günlük') ||
        lowerPrompt.includes('weekly') || lowerPrompt.includes('haftalık') ||
        lowerPrompt.includes('cron')) {
      features.set('Scheduling', [
        'Cron triggers',
        'Time-based execution',
        'Recurring tasks'
      ]);
    }
    
    // Real-time Features
    if (lowerPrompt.includes('real-time') || lowerPrompt.includes('gerçek zamanlı') ||
        lowerPrompt.includes('instant') || lowerPrompt.includes('webhook') ||
        lowerPrompt.includes('live')) {
      features.set('Real-time Processing', [
        'Webhook triggers',
        'Event-driven execution',
        'Instant responses'
      ]);
    }
    
    // Personnel/Staff Features
    if (lowerPrompt.includes('staff') || lowerPrompt.includes('personnel') ||
        lowerPrompt.includes('employee') || lowerPrompt.includes('nfc') ||
        lowerPrompt.includes('time tracking')) {
      features.set('Personnel Management', [
        'Time tracking',
        'Access control',
        'Shift management',
        'Performance monitoring'
      ]);
    }
    
    // Hygiene/Compliance Features
    if (lowerPrompt.includes('hygiene') || lowerPrompt.includes('handwash') ||
        lowerPrompt.includes('compliance') || lowerPrompt.includes('cold chain')) {
      features.set('Hygiene & Compliance', [
        'Hygiene monitoring',
        'Compliance tracking',
        'Temperature monitoring',
        'Alert systems'
      ]);
    }
    
    return features;
  }
  
  private generateWorkflowTasks(features: Map<string, string[]>): WorkflowTask[] {
    const tasks: WorkflowTask[] = [];
    let taskId = 1;
    
    // Always start with trigger setup
    tasks.push({
      id: `task-${taskId++}`,
      description: 'Set up workflow trigger',
      requiredNodes: this.determineTriggerNodes(features),
      dependencies: [],
      status: 'pending',
      validationChecks: [
        'Trigger is properly configured',
        'Trigger can receive/fetch data'
      ]
    });
    
    // Add tasks for each feature
    for (const [feature, capabilities] of features) {
      switch (feature) {
        case 'YouTube Integration':
          tasks.push({
            id: `task-${taskId++}`,
            description: 'Configure YouTube API connection',
            requiredNodes: ['YouTube', 'HTTP Request'],
            dependencies: ['task-1'],
            status: 'pending',
            validationChecks: [
              'API credentials are set',
              'Can fetch YouTube data',
              'Rate limiting is handled'
            ]
          });
          
          if (capabilities.includes('Comment retrieval')) {
            tasks.push({
              id: `task-${taskId++}`,
              description: 'Implement comment fetching',
              requiredNodes: ['HTTP Request', 'Function'],
              dependencies: [`task-${taskId-1}`],
              status: 'pending',
              validationChecks: [
                'Comments are retrieved correctly',
                'Pagination is handled',
                'Comment data is structured properly'
              ]
            });
          }
          break;
          
        case 'Content Moderation':
          tasks.push({
            id: `task-${taskId++}`,
            description: 'Set up content moderation pipeline',
            requiredNodes: ['Function', 'IF', 'Switch'],
            dependencies: capabilities.includes('Comment retrieval') ? [`task-${taskId-1}`] : ['task-1'],
            status: 'pending',
            validationChecks: [
              'Spam detection logic is implemented',
              'Filtering rules are defined',
              'False positive handling exists'
            ]
          });
          break;
          
        case 'NLP Analysis':
          tasks.push({
            id: `task-${taskId++}`,
            description: 'Integrate NLP/AI analysis',
            requiredNodes: ['HTTP Request', 'Function', 'Set'],
            dependencies: [`task-${taskId-1}`],
            status: 'pending',
            validationChecks: [
              'NLP service is connected',
              'Analysis results are parsed correctly',
              'Error handling for API failures'
            ]
          });
          break;
          
        case 'Notifications':
          const notificationDeps = tasks.filter(t => 
            t.description.includes('moderation') || 
            t.description.includes('analysis')
          ).map(t => t.id);
          
          tasks.push({
            id: `task-${taskId++}`,
            description: 'Configure notification system',
            requiredNodes: this.getNotificationNodes(capabilities),
            dependencies: notificationDeps.length > 0 ? notificationDeps : ['task-1'],
            status: 'pending',
            validationChecks: [
              'Notification credentials are set',
              'Message templates are defined',
              'Delivery confirmation is tracked'
            ]
          });
          break;
          
        case 'Data Storage':
          tasks.push({
            id: `task-${taskId++}`,
            description: 'Set up data persistence',
            requiredNodes: ['Database', 'Function'],
            dependencies: [`task-${taskId-1}`],
            status: 'pending',
            validationChecks: [
              'Database connection is established',
              'Schema/structure is defined',
              'CRUD operations work correctly'
            ]
          });
          break;
          
        case 'Reporting':
          const reportDeps = tasks.filter(t => 
            t.description.includes('analysis') || 
            t.description.includes('storage')
          ).map(t => t.id);
          
          tasks.push({
            id: `task-${taskId++}`,
            description: 'Implement reporting functionality',
            requiredNodes: ['Function', 'HTML', 'Email'],
            dependencies: reportDeps.length > 0 ? reportDeps : ['task-1'],
            status: 'pending',
            validationChecks: [
              'Report data is aggregated correctly',
              'Report format is proper',
              'Scheduled delivery works'
            ]
          });
          break;
      }
    }
    
    // Always add error handling task
    tasks.push({
      id: `task-${taskId++}`,
      description: 'Implement comprehensive error handling',
      requiredNodes: ['Error Trigger', 'Function', 'Email'],
      dependencies: tasks.map(t => t.id),
      status: 'pending',
      validationChecks: [
        'All errors are caught',
        'Error notifications work',
        'Workflow can recover from failures'
      ]
    });
    
    return tasks;
  }
  
  private mapFeaturesToNodes(features: Map<string, string[]>): string[] {
    const nodes = new Set<string>();
    
    // Always include basics
    nodes.add('Function');
    
    for (const [feature, capabilities] of features) {
      switch (feature) {
        case 'YouTube Integration':
          nodes.add('HTTP Request');
          nodes.add('OAuth2');
          break;
          
        case 'Content Moderation':
          nodes.add('IF');
          nodes.add('Switch');
          nodes.add('Function');
          break;
          
        case 'NLP Analysis':
          nodes.add('HTTP Request');
          nodes.add('Function');
          nodes.add('Set');
          break;
          
        case 'Notifications':
          capabilities.forEach(cap => {
            if (cap.includes('Email')) nodes.add('Send Email');
            if (cap.includes('SMS')) nodes.add('Twilio');
            if (cap.includes('Slack')) nodes.add('Slack');
            if (cap.includes('WhatsApp')) nodes.add('WhatsApp Business');
          });
          break;
          
        case 'Data Storage':
          nodes.add('Postgres');
          nodes.add('MySQL');
          nodes.add('MongoDB');
          break;
          
        case 'Reporting':
          nodes.add('HTML');
          nodes.add('Function');
          nodes.add('Send Email');
          break;
          
        case 'Scheduling':
          nodes.add('Cron');
          break;
          
        case 'Real-time Processing':
          nodes.add('Webhook');
          nodes.add('Respond to Webhook');
          break;
      }
    }
    
    // Always include error handling
    nodes.add('Error Trigger');
    
    return Array.from(nodes);
  }
  
  private generateValidationChecklist(features: Map<string, string[]>): string[] {
    const checklist: string[] = [
      '✓ Workflow has appropriate trigger',
      '✓ All nodes are properly connected',
      '✓ Error handling is comprehensive',
      '✓ Data flow is logical and efficient'
    ];
    
    // Add feature-specific checks
    if (features.has('YouTube Integration')) {
      checklist.push('✓ YouTube API credentials are configured');
      checklist.push('✓ Rate limiting is handled');
    }
    
    if (features.has('Content Moderation')) {
      checklist.push('✓ Moderation rules are clearly defined');
      checklist.push('✓ False positive handling exists');
    }
    
    if (features.has('NLP Analysis')) {
      checklist.push('✓ NLP service is properly integrated');
      checklist.push('✓ Analysis results are actionable');
    }
    
    if (features.has('Notifications')) {
      checklist.push('✓ All notification channels are tested');
      checklist.push('✓ Message templates are appropriate');
    }
    
    if (features.has('Data Storage')) {
      checklist.push('✓ Database schema supports all requirements');
      checklist.push('✓ Data retention policies are defined');
    }
    
    if (features.has('Reporting')) {
      checklist.push('✓ Reports contain all required data');
      checklist.push('✓ Report scheduling works correctly');
    }
    
    return checklist;
  }
  
  private identifyMissingCapabilities(features: Map<string, string[]>): string[] {
    const missing: string[] = [];
    
    // Check for common missing elements
    if (!features.has('Scheduling') && !features.has('Real-time Processing')) {
      missing.push('No trigger mechanism defined - workflow needs either scheduling or real-time trigger');
    }
    
    if (features.has('YouTube Integration') && !features.has('Data Storage')) {
      missing.push('Consider adding data storage for historical tracking');
    }
    
    if (features.has('Content Moderation') && !features.has('Notifications')) {
      missing.push('No notification system for moderation alerts');
    }
    
    if (features.has('NLP Analysis') && !features.has('Reporting')) {
      missing.push('Analysis results should be reported/visualized');
    }
    
    return missing;
  }
  
  private determineTriggerNodes(features: Map<string, string[]>): string[] {
    if (features.has('Scheduling')) {
      return ['Cron'];
    } else if (features.has('Real-time Processing')) {
      return ['Webhook'];
    } else if (features.has('YouTube Integration')) {
      return ['Cron', 'YouTube Trigger'];
    }
    return ['Manual Trigger'];
  }
  
  private getNotificationNodes(capabilities: string[]): string[] {
    const nodes: string[] = [];
    capabilities.forEach(cap => {
      if (cap.includes('Email')) nodes.push('Send Email');
      if (cap.includes('SMS')) nodes.push('Twilio');
      if (cap.includes('Slack')) nodes.push('Slack');
      if (cap.includes('WhatsApp')) nodes.push('WhatsApp Business');
    });
    if (nodes.length === 0) nodes.push('Send Email'); // Default
    return nodes;
  }
  
  createWorkflowPlan(analysis: PromptAnalysisResult): string {
    let plan = '## Workflow Implementation Plan\n\n';
    
    // Add orchestration requirement if multiple features
    if (analysis.features.size > 1) {
      plan += '### 🚨 CRITICAL ORCHESTRATION REQUIRED 🚨\n';
      plan += 'This workflow has multiple features that MUST be orchestrated together.\n\n';
      plan += '**MANDATORY ARCHITECTURE:**\n';
      plan += '1. **Main Entry Point** (Webhook/Trigger)\n';
      plan += '2. **Central Router** (Switch/IF node) to route between features\n';
      plan += '3. **Feature Branches** (implement each feature separately)\n';
      plan += '4. **Central Merge Node** (combine all branch results)\n';
      plan += '5. **Final Processing/Response**\n\n';
      plan += '**CRITICAL:** ALL FEATURES MUST CONNECT - NO ISOLATED CHAINS!\n\n';
    }
    
    // Features overview
    plan += '### Identified Features:\n';
    for (const [feature, capabilities] of analysis.features) {
      plan += `\n**${feature}:**\n`;
      capabilities.forEach(cap => plan += `- ${cap}\n`);
    }
    
    // Task breakdown
    plan += '\n### Implementation Tasks:\n';
    analysis.tasks.forEach((task, index) => {
      plan += `\n${index + 1}. **${task.description}**\n`;
      plan += `   - Required Nodes: ${task.requiredNodes.join(', ')}\n`;
      if (task.dependencies.length > 0) {
        plan += `   - Dependencies: ${task.dependencies.join(', ')}\n`;
      }
      plan += `   - Validation:\n`;
      task.validationChecks.forEach(check => plan += `     - ${check}\n`);
    });
    
    // Suggested nodes
    plan += '\n### Suggested n8n Nodes:\n';
    if (analysis.features.size > 1) {
      plan += '**ORCHESTRATION NODES (REQUIRED):**\n';
      plan += '- Switch (for central routing)\n';
      plan += '- Merge (for combining branches)\n';
      plan += '- Set (for data preparation)\n\n';
    }
    analysis.suggestedNodes.forEach(node => plan += `- ${node}\n`);
    
    // Validation checklist
    plan += '\n### Final Validation Checklist:\n';
    analysis.validationChecklist.forEach(check => plan += `${check}\n`);
    if (analysis.features.size > 1) {
      plan += '✅ All features connected through central orchestration\n';
      plan += '✅ No isolated node chains exist\n';
      plan += '✅ Central router properly routes to all features\n';
      plan += '✅ All branches merge back to central flow\n';
    }
    
    // Missing capabilities
    if (analysis.missingCapabilities.length > 0) {
      plan += '\n### Considerations:\n';
      analysis.missingCapabilities.forEach(missing => plan += `⚠️ ${missing}\n`);
    }
    
    return plan;
  }
}