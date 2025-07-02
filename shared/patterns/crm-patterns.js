"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmPatterns = void 0;
exports.crmPatterns = [
    {
        id: 'lead-nurturing-campaign',
        name: 'Complete Lead Nurturing Campaign',
        description: 'Automated lead nurturing with scoring, segmentation, and personalized follow-ups',
        keywords: ['lead', 'nurture', 'campaign', 'score', 'segment', 'follow-up', 'drip', 'email', 'crm'],
        category: 'crm',
        difficulty: 'complex',
        requiredServices: ['crm', 'email', 'analytics'],
        examples: [
            'Create a lead nurturing campaign that scores leads based on engagement',
            'Set up automated follow-ups based on lead behavior and score',
            'Build a multi-stage email drip campaign with personalization'
        ],
        tags: ['sales', 'marketing', 'automation', 'leadgen'],
        platforms: {
            n8n: {
                nodes: [
                    {
                        id: 'webhook_lead',
                        name: 'New Lead Webhook',
                        type: 'n8n-nodes-base.webhook',
                        position: [250, 300],
                        parameters: {
                            path: 'new-lead',
                            responseMode: 'onReceived'
                        }
                    },
                    {
                        id: 'enrich_lead',
                        name: 'Enrich Lead Data',
                        type: 'n8n-nodes-base.httpRequest',
                        position: [450, 300],
                        parameters: {
                            method: 'GET',
                            url: 'https://api.clearbit.com/v2/people/find',
                            queryParameters: {
                                parameters: [
                                    {
                                        name: 'email',
                                        value: '={{$json["email"]}}'
                                    }
                                ]
                            }
                        }
                    },
                    {
                        id: 'score_lead',
                        name: 'Calculate Lead Score',
                        type: 'n8n-nodes-base.code',
                        position: [650, 300],
                        parameters: {
                            jsCode: `
                const lead = items[0].json;
                let score = 0;
                
                // Company size scoring
                if (lead.company?.employees > 100) score += 20;
                else if (lead.company?.employees > 50) score += 10;
                
                // Job title scoring
                if (lead.role?.includes('Director') || lead.role?.includes('VP')) score += 30;
                else if (lead.role?.includes('Manager')) score += 20;
                
                // Engagement scoring
                if (lead.pageViews > 5) score += 10;
                if (lead.downloadedContent) score += 15;
                if (lead.attendedWebinar) score += 25;
                
                return [{
                  json: {
                    ...lead,
                    leadScore: score,
                    segment: score > 60 ? 'hot' : score > 30 ? 'warm' : 'cold'
                  }
                }];
              `
                        }
                    },
                    {
                        id: 'route_by_score',
                        name: 'Route by Score',
                        type: 'n8n-nodes-base.switch',
                        position: [850, 300],
                        parameters: {
                            dataType: 'string',
                            value1: '={{$json["segment"]}}',
                            rules: {
                                rules: [
                                    {
                                        value2: 'hot',
                                        output: 0
                                    },
                                    {
                                        value2: 'warm',
                                        output: 1
                                    },
                                    {
                                        value2: 'cold',
                                        output: 2
                                    }
                                ]
                            }
                        }
                    },
                    {
                        id: 'hot_lead_action',
                        name: 'Hot Lead Action',
                        type: 'n8n-nodes-base.slack',
                        position: [1050, 200],
                        parameters: {
                            channel: '#sales-team',
                            text: '🔥 Hot Lead Alert! {{$json["name"]}} from {{$json["company"]["name"]}} (Score: {{$json["leadScore"]}})'
                        }
                    },
                    {
                        id: 'add_to_crm',
                        name: 'Add to CRM',
                        type: 'n8n-nodes-base.hubspot',
                        position: [1250, 300],
                        parameters: {
                            resource: 'contact',
                            operation: 'create',
                            additionalFields: {
                                email: '={{$json["email"]}}',
                                firstname: '={{$json["firstName"]}}',
                                lastname: '={{$json["lastName"]}}',
                                company: '={{$json["company"]["name"]}}',
                                jobtitle: '={{$json["role"]}}',
                                lead_score: '={{$json["leadScore"]}}'
                            }
                        }
                    },
                    {
                        id: 'start_drip_campaign',
                        name: 'Start Drip Campaign',
                        type: 'n8n-nodes-base.activeCampaign',
                        position: [1450, 300],
                        parameters: {
                            resource: 'contact',
                            operation: 'create',
                            email: '={{$json["email"]}}',
                            updateIfExists: true,
                            additionalFields: {
                                fieldValues: [
                                    {
                                        fieldId: 'segment',
                                        fieldValue: '={{$json["segment"]}}'
                                    }
                                ],
                                listId: '={{$json["segment"]}}_nurture_list'
                            }
                        }
                    }
                ],
                connections: {
                    'New Lead Webhook': {
                        main: [[{ node: 'Enrich Lead Data', type: 'main', index: 0 }]]
                    },
                    'Enrich Lead Data': {
                        main: [[{ node: 'Calculate Lead Score', type: 'main', index: 0 }]]
                    },
                    'Calculate Lead Score': {
                        main: [[{ node: 'Route by Score', type: 'main', index: 0 }]]
                    },
                    'Route by Score': {
                        main: [
                            [{ node: 'Hot Lead Action', type: 'main', index: 0 }],
                            [{ node: 'Add to CRM', type: 'main', index: 0 }],
                            [{ node: 'Add to CRM', type: 'main', index: 0 }]
                        ]
                    },
                    'Hot Lead Action': {
                        main: [[{ node: 'Add to CRM', type: 'main', index: 0 }]]
                    },
                    'Add to CRM': {
                        main: [[{ node: 'Start Drip Campaign', type: 'main', index: 0 }]]
                    }
                }
            },
            make: {
                // Make.com scenario structure
                scenario: {
                    name: 'Lead Nurturing Campaign',
                    description: 'Automated lead scoring and nurturing',
                    modules: [
                        {
                            id: 1,
                            type: 'webhook',
                            name: 'New Lead',
                            parameters: {}
                        },
                        {
                            id: 2,
                            type: 'clearbit',
                            name: 'Enrich Data',
                            parameters: {
                                email: '{{1.email}}'
                            }
                        },
                        {
                            id: 3,
                            type: 'tools',
                            name: 'Calculate Score',
                            parameters: {
                                formula: 'Complex scoring logic here'
                            }
                        }
                    ]
                }
            },
            zapier: {
                // Zapier zap structure
                zap: {
                    name: 'Lead Nurturing Campaign',
                    trigger: {
                        app: 'webhooks',
                        event: 'catch_hook'
                    },
                    actions: [
                        {
                            app: 'clearbit',
                            action: 'find_person'
                        },
                        {
                            app: 'code',
                            action: 'javascript'
                        },
                        {
                            app: 'hubspot',
                            action: 'create_contact'
                        }
                    ]
                }
            }
        }
    },
    {
        id: 'contact-form-to-crm',
        name: 'Contact Form to CRM with Welcome Series',
        description: 'Capture form submissions, add to CRM, and trigger welcome email series',
        keywords: ['contact', 'form', 'crm', 'welcome', 'email', 'series', 'hubspot', 'salesforce'],
        category: 'crm',
        difficulty: 'simple',
        requiredServices: ['crm', 'email'],
        examples: [
            'When someone fills out my contact form, add them to CRM and send welcome emails',
            'Capture website form and create CRM contact with tags',
            'Form submission to CRM with automated follow-up'
        ],
        tags: ['forms', 'email', 'onboarding'],
        platforms: {
            n8n: {
            // Already implemented in workflow-patterns.ts
            }
        }
    },
    {
        id: 'deal-stage-automation',
        name: 'Deal Stage Automation',
        description: 'Automate actions based on deal stage changes in CRM',
        keywords: ['deal', 'stage', 'pipeline', 'sales', 'crm', 'opportunity'],
        category: 'crm',
        difficulty: 'intermediate',
        requiredServices: ['crm', 'email', 'slack'],
        examples: [
            'When deal moves to negotiation, notify sales manager and create tasks',
            'Automate follow-ups based on deal stage',
            'Update deal probability and send alerts on stage change'
        ],
        tags: ['sales', 'pipeline', 'notifications'],
        platforms: {
            n8n: {
                nodes: [
                    {
                        id: 'crm_trigger',
                        name: 'CRM Deal Updated',
                        type: 'n8n-nodes-base.hubspotTrigger',
                        position: [250, 300],
                        parameters: {
                            eventsUi: {
                                eventValues: [
                                    {
                                        name: 'deal.propertyChange'
                                    }
                                ]
                            },
                            additionalFields: {
                                propertyName: 'dealstage'
                            }
                        }
                    },
                    {
                        id: 'get_deal_details',
                        name: 'Get Deal Details',
                        type: 'n8n-nodes-base.hubspot',
                        position: [450, 300],
                        parameters: {
                            resource: 'deal',
                            operation: 'get',
                            dealId: '={{$json["objectId"]}}'
                        }
                    },
                    {
                        id: 'check_stage',
                        name: 'Check Stage',
                        type: 'n8n-nodes-base.switch',
                        position: [650, 300],
                        parameters: {
                            dataType: 'string',
                            value1: '={{$json["properties"]["dealstage"]["value"]}}',
                            rules: {
                                rules: [
                                    {
                                        value2: 'qualifiedtobuy',
                                        output: 0
                                    },
                                    {
                                        value2: 'presentationscheduled',
                                        output: 1
                                    },
                                    {
                                        value2: 'decisionmakerboughtin',
                                        output: 2
                                    },
                                    {
                                        value2: 'contractsent',
                                        output: 3
                                    },
                                    {
                                        value2: 'closedwon',
                                        output: 4
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    }
];
//# sourceMappingURL=crm-patterns.js.map