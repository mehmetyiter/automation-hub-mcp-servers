"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformContexts = void 0;
exports.getPlatformContext = getPlatformContext;
exports.translateUserIntent = translateUserIntent;
exports.platformContexts = {
    n8n: {
        platform: 'n8n',
        terminology: {
            workflow: 'A visual flow connecting nodes to automate processes',
            node: 'Building block representing an integration or operation',
            trigger: 'Node that initiates workflow execution',
            credential: 'Stored authentication for services',
            execution: 'Individual run of a workflow',
            expression: 'Dynamic value using {{}} syntax',
            pinData: 'Sample data for testing nodes',
            webhook: 'HTTP endpoint that triggers workflows',
            'code node': 'Node for custom JavaScript/Python logic',
            'if node': 'Conditional logic branching',
            'merge node': 'Combines data from multiple branches',
            'split in batches': 'Processes items in chunks'
        },
        concepts: [
            'Visual workflow design with drag-and-drop',
            'Node-based architecture',
            'Self-hosting capabilities',
            'Community node ecosystem',
            'Error handling and retry logic',
            'Manual and automatic executions',
            'Webhook and schedule triggers',
            'JavaScript expressions for dynamic values',
            'Binary data handling',
            'Sub-workflow execution'
        ],
        patterns: [
            'webhook → process → respond',
            'schedule → fetch → transform → store',
            'trigger → validate → branch → action',
            'api → paginate → aggregate → notify',
            'form → validate → create → email',
            'monitor → alert → escalate',
            'extract → transform → load (ETL)',
            'approval → action → notification'
        ],
        constraints: [
            'Nodes must have unique IDs',
            'Connections flow from output to input',
            'Credentials are referenced by ID',
            'Workflow must have at least one trigger',
            'Node positions use [x, y] coordinates',
            'Binary data requires special handling',
            'Expression syntax uses double curly braces',
            'Error outputs are separate connections'
        ],
        examples: {
            webhook_node: {
                type: 'n8n-nodes-base.webhook',
                parameters: {
                    httpMethod: 'POST',
                    path: 'webhook-path',
                    responseMode: 'lastNode'
                }
            },
            code_node: {
                type: 'n8n-nodes-base.code',
                parameters: {
                    jsCode: '// Process items\nreturn items;'
                }
            },
            if_node: {
                type: 'n8n-nodes-base.if',
                parameters: {
                    conditions: {
                        number: [{
                                value1: '={{$json["value"]}}',
                                operation: 'larger',
                                value2: 100
                            }]
                    }
                }
            }
        }
    },
    make: {
        platform: 'make',
        terminology: {
            scenario: 'Automated workflow in Make',
            module: 'Individual action within a scenario',
            app: 'Custom integration for Make platform',
            connection: 'Authentication configuration for an app',
            webhook: 'HTTP trigger for scenarios',
            'data store': 'Built-in database functionality',
            bundle: 'Data packet passed between modules',
            operation: 'Specific action a module can perform',
            filter: 'Condition to control data flow',
            router: 'Splits scenario into multiple paths',
            aggregator: 'Combines multiple bundles',
            iterator: 'Processes arrays item by item'
        },
        concepts: [
            'Visual scenario builder',
            'Component-based app architecture',
            'Real-time and scheduled execution',
            'Data transformation tools',
            'Error handling with resume',
            'Team collaboration features',
            'Version control for apps',
            'Multi-environment support',
            'Built-in data persistence',
            'Advanced scheduling options'
        ],
        patterns: [
            'webhook → router → parallel processing → aggregator',
            'watch → filter → transform → action',
            'schedule → search → iterate → update',
            'receive → validate → store → respond',
            'poll → compare → notify',
            'batch → process → report',
            'sync source → transform → sync target',
            'monitor → analyze → alert'
        ],
        constraints: [
            'Scenarios have execution order',
            'Modules process bundles sequentially',
            'Connections must be authorized',
            'Data stores have size limits',
            'Webhooks require unique URLs',
            'Filters use Make formula syntax',
            'Maximum execution time limits',
            'API rate limits per organization'
        ],
        examples: {
            webhook_module: {
                type: 'webhook',
                name: 'Receive Data',
                webhookUrl: 'https://hook.make.com/xxx'
            },
            http_module: {
                type: 'http',
                name: 'Make API Request',
                method: 'POST',
                url: 'https://api.example.com',
                headers: {},
                body: {}
            },
            router_module: {
                type: 'router',
                routes: [
                    { filter: 'condition1', label: 'Path 1' },
                    { filter: 'condition2', label: 'Path 2' }
                ]
            }
        }
    },
    vapi: {
        platform: 'vapi',
        terminology: {
            assistant: 'AI voice agent configuration',
            call: 'Voice conversation session',
            message: 'Conversation turn between user and AI',
            transcript: 'Text record of voice conversation',
            function: 'Server-side webhook for custom logic',
            provider: 'Voice or AI model service',
            voice: 'Text-to-speech configuration',
            model: 'LLM configuration for conversations',
            'say command': 'Programmatic speech injection',
            'end call': 'Terminate conversation',
            'transfer call': 'Hand off to another number'
        },
        concepts: [
            'Real-time voice AI interactions',
            'Sub-600ms response latency',
            'Natural conversation handling',
            'Interruption management',
            'Silence detection',
            'Multi-modal SDK support',
            'Phone call integration',
            'Custom function calling',
            'Streaming transcription',
            'Voice cloning capabilities'
        ],
        patterns: [
            'initiate → converse → function → respond',
            'incoming call → identify → route → assist',
            'voice input → transcribe → process → synthesize',
            'qualify lead → collect info → schedule → confirm',
            'greet → understand → act → conclude',
            'listen → analyze sentiment → adapt tone',
            'start recording → process → save transcript',
            'authenticate → verify → proceed'
        ],
        constraints: [
            'WebRTC connection required for web',
            'Phone calls need provider setup',
            'Functions must respond within timeout',
            'Audio format requirements',
            'Rate limits on API calls',
            'Transcript storage limits',
            'Voice provider selection affects latency',
            'Model token limits apply'
        ],
        examples: {
            assistant_config: {
                model: {
                    provider: 'openai',
                    model: 'gpt-4',
                    temperature: 0.7
                },
                voice: {
                    provider: 'elevenlabs',
                    voiceId: 'voice-id-here'
                },
                firstMessage: 'Hello! How can I help you today?'
            },
            function_call: {
                name: 'lookupInfo',
                description: 'Look up customer information',
                parameters: {
                    type: 'object',
                    properties: {
                        customerId: { type: 'string' }
                    }
                }
            }
        }
    },
    zapier: {
        platform: 'zapier',
        terminology: {
            zap: 'Automated workflow',
            trigger: 'Event that starts a Zap',
            action: 'Task performed by a Zap',
            filter: 'Conditional logic in Zaps',
            formatter: 'Data transformation step',
            path: 'Conditional branching',
            webhook: 'Custom HTTP trigger',
            'custom request': 'API call action',
            task: 'Single execution of a Zap',
            'task history': 'Log of Zap executions'
        },
        concepts: [
            'No-code automation builder',
            'Extensive app ecosystem',
            'Multi-step workflows',
            'Conditional logic paths',
            'Data formatting tools',
            'Schedule-based triggers',
            'Instant vs polling triggers',
            'Team collaboration',
            'Version history',
            'Built-in testing tools'
        ],
        patterns: [
            'trigger → filter → action',
            'new item → format → create record',
            'webhook → path → multiple actions',
            'schedule → search → update',
            'form → validate → multi-step process',
            'monitor → filter → alert',
            'collect → transform → distribute',
            'event → enrich → notify'
        ],
        constraints: [
            'Linear workflow execution',
            'No loops or complex logic',
            'API-driven integrations only',
            'Rate limits per plan',
            'Execution time limits',
            'No code execution environment',
            'Limited data transformation',
            'Webhook URLs are permanent'
        ],
        examples: {
            trigger_config: {
                app: 'gmail',
                event: 'new_email',
                account: 'user@example.com'
            },
            action_config: {
                app: 'slack',
                event: 'send_message',
                channel: '#general',
                message: 'New email received'
            }
        }
    }
};
function getPlatformContext(platform) {
    return exports.platformContexts[platform.toLowerCase()] || null;
}
function translateUserIntent(userDescription, platform) {
    const context = getPlatformContext(platform);
    if (!context) {
        return {
            enhancedPrompt: userDescription,
            suggestedNodes: [],
            workflowPattern: ''
        };
    }
    // Analyze user intent
    const lowerDesc = userDescription.toLowerCase();
    const suggestedNodes = [];
    let workflowPattern = '';
    // Platform-specific intent analysis
    switch (platform) {
        case 'n8n':
            if (lowerDesc.includes('webhook') || lowerDesc.includes('api')) {
                suggestedNodes.push('webhook', 'http request', 'respond to webhook');
                workflowPattern = 'webhook → process → respond';
            }
            if (lowerDesc.includes('schedule') || lowerDesc.includes('daily') || lowerDesc.includes('cron')) {
                suggestedNodes.push('schedule trigger', 'cron');
                workflowPattern = 'schedule → fetch → transform → store';
            }
            if (lowerDesc.includes('email')) {
                suggestedNodes.push('email trigger', 'send email', 'email send');
                if (lowerDesc.includes('sendgrid'))
                    suggestedNodes.push('sendgrid');
                if (lowerDesc.includes('gmail'))
                    suggestedNodes.push('gmail');
            }
            if (lowerDesc.includes('sms') || lowerDesc.includes('twilio')) {
                suggestedNodes.push('twilio');
            }
            if (lowerDesc.includes('if') || lowerDesc.includes('condition')) {
                suggestedNodes.push('if', 'switch');
            }
            if (lowerDesc.includes('database') || lowerDesc.includes('sql')) {
                suggestedNodes.push('postgres', 'mysql', 'mongodb');
            }
            break;
        case 'make':
            if (lowerDesc.includes('webhook')) {
                suggestedNodes.push('webhook', 'custom webhook');
                workflowPattern = 'webhook → router → parallel processing';
            }
            if (lowerDesc.includes('schedule') || lowerDesc.includes('interval')) {
                suggestedNodes.push('schedule', 'watch records');
                workflowPattern = 'schedule → search → iterate → update';
            }
            if (lowerDesc.includes('router') || lowerDesc.includes('branch')) {
                suggestedNodes.push('router', 'filter');
            }
            if (lowerDesc.includes('aggregate') || lowerDesc.includes('combine')) {
                suggestedNodes.push('aggregator', 'array aggregator');
            }
            if (lowerDesc.includes('iterate') || lowerDesc.includes('loop')) {
                suggestedNodes.push('iterator', 'repeater');
            }
            break;
        case 'vapi':
            if (lowerDesc.includes('call') || lowerDesc.includes('phone')) {
                suggestedNodes.push('inbound call', 'outbound call', 'transfer call');
                workflowPattern = 'incoming call → identify → route → assist';
            }
            if (lowerDesc.includes('qualify') || lowerDesc.includes('lead')) {
                suggestedNodes.push('assistant', 'function call', 'end call');
                workflowPattern = 'qualify lead → collect info → schedule → confirm';
            }
            if (lowerDesc.includes('voice') || lowerDesc.includes('speech')) {
                suggestedNodes.push('voice configuration', 'speech recognition');
            }
            if (lowerDesc.includes('function') || lowerDesc.includes('webhook')) {
                suggestedNodes.push('custom function', 'server webhook');
            }
            break;
    }
    // Enhance the prompt with platform-specific language
    const enhancedPrompt = enhancePromptForPlatform(userDescription, context, workflowPattern);
    return {
        enhancedPrompt,
        suggestedNodes: [...new Set(suggestedNodes)], // Remove duplicates
        workflowPattern
    };
}
function enhancePromptForPlatform(userDescription, context, pattern) {
    const platformName = context.platform.toUpperCase();
    let enhanced = `Create a ${platformName} ${context.platform === 'n8n' ? 'workflow' :
        context.platform === 'make' ? 'scenario' :
            context.platform === 'vapi' ? 'assistant configuration' :
                'automation'} with the following requirements:\n\n`;
    enhanced += `USER REQUEST: ${userDescription}\n\n`;
    if (pattern) {
        enhanced += `SUGGESTED PATTERN: ${pattern}\n\n`;
    }
    enhanced += `PLATFORM-SPECIFIC REQUIREMENTS:\n`;
    // Add platform-specific enhancements
    switch (context.platform) {
        case 'n8n':
            enhanced += `- Use proper node types (e.g., n8n-nodes-base.webhook)\n`;
            enhanced += `- Include error handling with "Continue On Fail" where appropriate\n`;
            enhanced += `- Use expressions with {{}} syntax for dynamic values\n`;
            enhanced += `- Set proper node positions for visual clarity\n`;
            enhanced += `- Reference credentials by type (e.g., 'sendGridApi')\n`;
            break;
        case 'make':
            enhanced += `- Structure as a scenario with modules\n`;
            enhanced += `- Use routers for branching logic\n`;
            enhanced += `- Include filters for conditional processing\n`;
            enhanced += `- Use aggregators to combine data from multiple paths\n`;
            enhanced += `- Set up proper error handling with resume capability\n`;
            break;
        case 'vapi':
            enhanced += `- Configure assistant with appropriate model and voice\n`;
            enhanced += `- Set up function calls for custom logic\n`;
            enhanced += `- Include proper error handling messages\n`;
            enhanced += `- Configure interruption and silence settings\n`;
            enhanced += `- Set appropriate temperature for response creativity\n`;
            break;
    }
    return enhanced;
}
//# sourceMappingURL=platform-ai-context.js.map