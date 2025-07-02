"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const n8n_enhanced_prompt_js_1 = require("./n8n-enhanced-prompt.js");
const make_knowledge_base_js_1 = require("../platforms/make/make-knowledge-base.js");
const zapier_knowledge_base_js_1 = require("../platforms/zapier/zapier-knowledge-base.js");
const credential_manager_js_1 = require("./credential-manager.js");
const workflow_fixer_js_1 = require("./workflow-fixer.js");
const platform_ai_context_js_1 = require("./platform-ai-context.js");
class AIService {
    config;
    constructor(config) {
        this.config = config;
    }
    async generateWorkflow(platform, userPrompt, name) {
        const context = (0, platform_ai_context_js_1.getPlatformContext)(platform);
        if (!context) {
            throw new Error(`Platform ${platform} not supported`);
        }
        // Build the system prompt with platform-specific training
        const systemPrompt = this.buildSystemPrompt(platform, context);
        // Build the user prompt with examples
        const enhancedUserPrompt = this.buildUserPrompt(userPrompt, context);
        try {
            if (this.config.provider === 'openai') {
                return await this.generateWithOpenAI(systemPrompt, enhancedUserPrompt, name);
            }
            else if (this.config.provider === 'anthropic') {
                return await this.generateWithAnthropic(systemPrompt, enhancedUserPrompt, name);
            }
            else {
                // Fallback to rule-based generation
                return this.generateWithRules(platform, userPrompt, name);
            }
        }
        catch (error) {
            console.error('AI generation failed, falling back to rules:', error);
            return this.generateWithRules(platform, userPrompt, name);
        }
    }
    buildSystemPrompt(platform, context) {
        // Use specialized knowledge base for supported platforms
        if (platform === 'n8n') {
            return (0, n8n_enhanced_prompt_js_1.generateEnhancedN8nSystemPrompt)();
        }
        if (platform === 'make') {
            return (0, make_knowledge_base_js_1.generateMakeSystemPrompt)();
        }
        if (platform === 'zapier') {
            return (0, zapier_knowledge_base_js_1.generateZapierSystemPrompt)();
        }
        // Default system prompt for other platforms
        return `You are an expert ${platform.toUpperCase()} workflow automation specialist.

PLATFORM TERMINOLOGY:
${Object.entries(context.terminology).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

PLATFORM CONCEPTS:
${context.concepts.map((c) => `- ${c}`).join('\n')}

PLATFORM PATTERNS:
${context.patterns.map((p) => `- ${p}`).join('\n')}

PLATFORM CONSTRAINTS:
${context.constraints.map((c) => `- ${c}`).join('\n')}

Your task is to generate a complete, working ${platform} workflow based on the user's description.

IMPORTANT RULES:
1. Return ONLY valid JSON that matches the ${platform} workflow format
2. Include all necessary nodes/modules/components
3. Ensure proper connections between components
4. Add error handling where appropriate
5. Use platform-specific node types and parameters
6. Include descriptive names and comments

${platform === 'make' ? `
For Make specifically:
- Create scenario with modules array
- Each module needs: type, name, parameters
- Use routers for branching logic
- Include filters for conditional processing
` : ''}

${platform === 'vapi' ? `
For Vapi specifically:
- Configure assistant with model and voice settings
- Include function definitions for custom logic
- Set up proper error handling messages
- Configure interruption and silence detection
` : ''}

Return the workflow as JSON without any markdown formatting or explanation.`;
    }
    buildUserPrompt(userPrompt, context) {
        // Find relevant examples from context
        const relevantExamples = this.findRelevantExamples(userPrompt, context);
        return `Create a workflow for: ${userPrompt}

${relevantExamples.length > 0 ? `
Consider these similar examples:
${relevantExamples.map((ex) => JSON.stringify(ex, null, 2)).join('\n\n')}
` : ''}

Generate a complete, production-ready workflow.`;
    }
    findRelevantExamples(userPrompt, context) {
        const examples = [];
        const promptLower = userPrompt.toLowerCase();
        // Check if prompt contains keywords that match our examples
        if (promptLower.includes('webhook') && context.examples.webhook_node) {
            examples.push(context.examples.webhook_node);
        }
        if (promptLower.includes('email') && context.examples.email_node) {
            examples.push(context.examples.email_node);
        }
        if (promptLower.includes('condition') || promptLower.includes('if')) {
            examples.push(context.examples.if_node || context.examples.router_module);
        }
        return examples;
    }
    async generateWithOpenAI(systemPrompt, userPrompt, name) {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in environment.');
        }
        try {
            const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: this.config.temperature || 0.7,
                    response_format: { type: 'json_object' },
                    max_tokens: 4000
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
            }
            const data = await response.json();
            let workflowJson = JSON.parse(data.choices[0].message.content);
            // Extract workflow if nested
            if (workflowJson.workflow) {
                workflowJson = workflowJson.workflow;
            }
            // Fix and enhance the workflow
            workflowJson = (0, workflow_fixer_js_1.fixAIGeneratedWorkflow)(workflowJson);
            workflowJson.name = name;
            // Analyze credentials
            const credentialMappings = await credential_manager_js_1.credentialManager.analyzeWorkflowCredentials(workflowJson);
            return {
                workflow: workflowJson,
                explanation: 'Generated using OpenAI GPT',
                confidence: 0.9,
                credentialMappings,
                suggestedImprovements: this.analyzeWorkflow(workflowJson)
            };
        }
        catch (error) {
            console.error('OpenAI generation failed:', error);
            throw error;
        }
    }
    async generateWithAnthropic(systemPrompt, userPrompt, name) {
        if (!this.config.apiKey) {
            throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY in environment.');
        }
        try {
            const response = await (0, node_fetch_1.default)('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'claude-3-sonnet-20240229',
                    max_tokens: 4000,
                    messages: [
                        { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
                    ],
                    temperature: this.config.temperature || 0.7
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
            }
            const data = await response.json();
            const content = data.content[0].text;
            // Extract JSON from the response
            let workflowJson;
            try {
                workflowJson = JSON.parse(content);
            }
            catch {
                // Try to extract JSON from markdown code blocks
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    workflowJson = JSON.parse(jsonMatch[1]);
                }
                else {
                    throw new Error('Could not extract valid JSON from AI response');
                }
            }
            // Extract workflow if nested
            if (workflowJson.workflow) {
                workflowJson = workflowJson.workflow;
            }
            // Fix and enhance the workflow
            workflowJson = (0, workflow_fixer_js_1.fixAIGeneratedWorkflow)(workflowJson);
            workflowJson.name = name;
            // Analyze credentials
            const credentialMappings = await credential_manager_js_1.credentialManager.analyzeWorkflowCredentials(workflowJson);
            return {
                workflow: workflowJson,
                explanation: 'Generated using Anthropic Claude',
                confidence: 0.9,
                credentialMappings,
                suggestedImprovements: this.analyzeWorkflow(workflowJson)
            };
        }
        catch (error) {
            console.error('Anthropic generation failed:', error);
            throw error;
        }
    }
    generateWithRules(platform, userPrompt, name) {
        const promptLower = userPrompt.toLowerCase();
        // Enhanced rule-based generation
        if (platform === 'n8n' && (promptLower.includes('appointment') || promptLower.includes('notification'))) {
            // Return our detailed appointment notification workflow
            return Promise.resolve({
                workflow: {
                    name: name,
                    nodes: [
                        {
                            id: 'webhook_1',
                            name: 'Appointment Webhook',
                            type: 'n8n-nodes-base.webhook',
                            typeVersion: 2,
                            position: [250, 300],
                            parameters: {
                                httpMethod: 'POST',
                                path: 'appointment-notification',
                                responseMode: 'responseNode'
                            }
                        },
                        {
                            id: 'validate_1',
                            name: 'Validate Data',
                            type: 'n8n-nodes-base.if',
                            typeVersion: 2,
                            position: [450, 300],
                            parameters: {
                                conditions: {
                                    options: { version: 2 },
                                    conditions: [
                                        {
                                            id: 'check-data',
                                            leftValue: '={{ $json.patient_id }}',
                                            rightValue: '',
                                            operator: { type: 'string', operation: 'exists' }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            id: 'http_1',
                            name: 'Get Patient Info',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 4.2,
                            position: [650, 200],
                            parameters: {
                                method: 'GET',
                                url: '=https://api.clinic.com/patients/{{ $json.patient_id }}',
                                authentication: 'genericCredentialType',
                                genericAuthType: 'httpHeaderAuth'
                            }
                        },
                        {
                            id: 'code_1',
                            name: 'Prepare Messages',
                            type: 'n8n-nodes-base.code',
                            typeVersion: 2,
                            position: [850, 200],
                            parameters: {
                                jsCode: `// Prepare notification messages
const patient = $input.item.json;
const appointment = $('Appointment Webhook').item.json;

return {
  json: {
    email_subject: \`Appointment Reminder - \${appointment.date}\`,
    email_body: \`Dear \${patient.name}, you have an appointment on \${appointment.date} at \${appointment.time}.\`,
    sms_message: \`Reminder: Appointment on \${appointment.date} at \${appointment.time}. Reply CONFIRM to confirm.\`,
    patient_email: patient.email,
    patient_phone: patient.phone
  }
};`
                            }
                        },
                        {
                            id: 'email_1',
                            name: 'Send Email',
                            type: 'n8n-nodes-base.emailSend',
                            typeVersion: 2.1,
                            position: [1050, 100],
                            parameters: {
                                fromEmail: 'noreply@clinic.com',
                                toEmail: '={{ $json.patient_email }}',
                                subject: '={{ $json.email_subject }}',
                                emailType: 'text',
                                message: '={{ $json.email_body }}'
                            }
                        },
                        {
                            id: 'sms_1',
                            name: 'Send SMS',
                            type: 'n8n-nodes-base.twilio',
                            typeVersion: 1,
                            position: [1050, 300],
                            parameters: {
                                from: '+1234567890',
                                to: '={{ $json.patient_phone }}',
                                message: '={{ $json.sms_message }}'
                            }
                        },
                        {
                            id: 'respond_1',
                            name: 'Send Response',
                            type: 'n8n-nodes-base.respondToWebhook',
                            typeVersion: 1.1,
                            position: [1250, 200],
                            parameters: {
                                respondWith: 'json',
                                responseBody: '={{ { "success": true, "message": "Notifications sent" } }}'
                            }
                        }
                    ],
                    connections: {
                        'Appointment Webhook': {
                            main: [[{ node: 'Validate Data', type: 'main', index: 0 }]]
                        },
                        'Validate Data': {
                            main: [
                                [{ node: 'Get Patient Info', type: 'main', index: 0 }],
                                [{ node: 'Send Response', type: 'main', index: 0 }]
                            ]
                        },
                        'Get Patient Info': {
                            main: [[{ node: 'Prepare Messages', type: 'main', index: 0 }]]
                        },
                        'Prepare Messages': {
                            main: [[
                                    { node: 'Send Email', type: 'main', index: 0 },
                                    { node: 'Send SMS', type: 'main', index: 0 }
                                ]]
                        },
                        'Send Email': {
                            main: [[{ node: 'Send Response', type: 'main', index: 0 }]]
                        },
                        'Send SMS': {
                            main: [[{ node: 'Send Response', type: 'main', index: 0 }]]
                        }
                    },
                    settings: {},
                    active: false
                },
                explanation: 'Created appointment notification workflow with email and SMS channels',
                confidence: 0.8,
                suggestedImprovements: [
                    'Add push notification channel',
                    'Implement retry logic for failed notifications',
                    'Add logging for audit trail',
                    'Include appointment confirmation handling'
                ]
            });
        }
        // Default fallback
        return Promise.resolve({
            workflow: {
                name: name,
                nodes: [{
                        id: 'manual_1',
                        name: 'Manual Trigger',
                        type: 'n8n-nodes-base.manualTrigger',
                        typeVersion: 1,
                        position: [250, 300],
                        parameters: {}
                    }],
                connections: {}
            },
            explanation: 'Could not generate specific workflow, created basic template',
            confidence: 0.3,
            suggestedImprovements: ['Add trigger node', 'Add action nodes', 'Connect nodes with workflow logic']
        });
    }
    // Training data management
    async addTrainingExample(platform, userPrompt, generatedWorkflow, userFeedback) {
        // This would store training examples for fine-tuning
        // In a real implementation, this would save to a database
        console.log(`Training example added for ${platform}:`, {
            prompt: userPrompt,
            workflow: generatedWorkflow,
            feedback: userFeedback
        });
    }
    async getTrainingData(platform) {
        // This would retrieve training data for analysis
        console.log(`Retrieving training data for ${platform}`);
        return [];
    }
    analyzeWorkflow(workflow) {
        const suggestions = [];
        if (workflow.nodes?.length < 2) {
            suggestions.push('Consider adding more nodes to create a complete workflow');
        }
        // Check for error handling
        const hasErrorHandling = workflow.nodes?.some((n) => n.continueOnFail === true || n.type?.includes('errorTrigger'));
        if (!hasErrorHandling && workflow.nodes?.length > 3) {
            suggestions.push('Add error handling with continueOnFail or Error Trigger nodes');
        }
        // Check for data validation
        const hasValidation = workflow.nodes?.some((n) => n.type === 'n8n-nodes-base.if' || n.type === 'n8n-nodes-base.switch');
        if (!hasValidation && workflow.nodes?.length > 2) {
            suggestions.push('Consider adding data validation with IF or Switch nodes');
        }
        // Check for logging
        const hasLogging = workflow.nodes?.some((n) => n.type === 'n8n-nodes-base.writeBinaryFile' || n.name?.toLowerCase().includes('log'));
        if (!hasLogging && workflow.nodes?.length > 5) {
            suggestions.push('Add logging for better debugging and monitoring');
        }
        return suggestions;
    }
}
exports.AIService = AIService;
//# sourceMappingURL=ai-service-enhanced.js.map