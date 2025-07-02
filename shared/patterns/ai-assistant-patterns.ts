import { WorkflowPattern } from './index';

export const aiAssistantPatterns: WorkflowPattern[] = [
  {
    id: 'customer-support-bot',
    name: 'AI Customer Support Assistant',
    description: 'Intelligent support bot with knowledge base, escalation, and ticket creation',
    keywords: ['support', 'customer', 'bot', 'ai', 'assistant', 'help', 'ticket', 'chat'],
    category: 'ai-assistant',
    difficulty: 'complex',
    requiredServices: ['ai', 'knowledge-base', 'ticketing', 'chat'],
    examples: [
      'Create a customer support bot that can answer questions and create tickets',
      'Build an AI assistant for handling support inquiries with escalation',
      'Set up intelligent chatbot with knowledge base integration'
    ],
    tags: ['support', 'ai', 'chatbot', 'automation'],
    platforms: {
      vapi: {
        assistant: {
          name: 'Customer Support Assistant',
          firstMessage: 'Hello! I\'m here to help you with any questions or issues. How can I assist you today?',
          context: 'You are a helpful customer support assistant. Be friendly, professional, and try to resolve issues quickly.',
          voice: {
            provider: 'elevenlabs',
            voiceId: 'rachel',
            stability: 0.8,
            similarityBoost: 0.75
          },
          model: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7
          },
          functions: [
            {
              name: 'searchKnowledgeBase',
              description: 'Search the company knowledge base for answers',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query'
                  }
                },
                required: ['query']
              }
            },
            {
              name: 'createTicket',
              description: 'Create a support ticket when issue cannot be resolved',
              parameters: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Ticket title'
                  },
                  description: {
                    type: 'string',
                    description: 'Detailed issue description'
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'urgent']
                  },
                  customerEmail: {
                    type: 'string'
                  }
                },
                required: ['title', 'description', 'priority']
              }
            },
            {
              name: 'escalateToHuman',
              description: 'Escalate the conversation to a human agent',
              parameters: {
                type: 'object',
                properties: {
                  reason: {
                    type: 'string',
                    description: 'Reason for escalation'
                  },
                  summary: {
                    type: 'string',
                    description: 'Summary of the conversation so far'
                  }
                },
                required: ['reason', 'summary']
              }
            }
          ],
          endCallFunctionEnabled: true,
          endCallMessage: 'Thank you for contacting support. Have a great day!',
          serverUrl: 'https://your-webhook-url.com/vapi',
          silenceTimeoutSeconds: 30,
          responseDelaySeconds: 0.5,
          llmRequestDelaySeconds: 0.1,
          numWordsToInterruptAssistant: 2
        }
      },
      n8n: {
        nodes: [
          {
            id: 'webhook',
            name: 'Chat Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [250, 300],
            parameters: {
              path: 'chat-support',
              responseMode: 'responseNode'
            }
          },
          {
            id: 'process_message',
            name: 'Process Message',
            type: 'n8n-nodes-base.openAi',
            position: [450, 300],
            parameters: {
              resource: 'chat',
              model: 'gpt-4',
              messages: {
                values: [
                  {
                    role: 'system',
                    content: 'You are a helpful customer support assistant.'
                  },
                  {
                    role: 'user',
                    content: '={{$json["message"]}}'
                  }
                ]
              }
            }
          },
          {
            id: 'check_intent',
            name: 'Check Intent',
            type: 'n8n-nodes-base.if',
            position: [650, 300],
            parameters: {
              conditions: {
                string: [
                  {
                    value1: '={{$json["intent"]}}',
                    operation: 'equals',
                    value2: 'create_ticket'
                  }
                ]
              }
            }
          }
        ]
      }
    }
  },
  {
    id: 'sales-qualification-bot',
    name: 'Sales Lead Qualification Bot',
    description: 'AI-powered bot that qualifies leads through conversational interface',
    keywords: ['sales', 'lead', 'qualification', 'bot', 'ai', 'call', 'qualify'],
    category: 'ai-assistant',
    difficulty: 'intermediate',
    requiredServices: ['ai', 'voice', 'crm'],
    examples: [
      'Call leads from my spreadsheet and qualify them based on a script',
      'Create a bot that qualifies leads and updates CRM',
      'Build an AI sales assistant for lead qualification'
    ],
    tags: ['sales', 'ai', 'voice', 'leadgen'],
    platforms: {
      vapi: {
        assistant: {
          name: 'Sales Qualification Assistant',
          firstMessage: 'Hi! This is Sarah from [Company]. I noticed you showed interest in our solution. Do you have a few minutes to chat?',
          context: `You are a professional sales qualification assistant. Your goal is to:
            1. Qualify leads based on BANT (Budget, Authority, Need, Timeline)
            2. Be conversational and friendly
            3. Ask open-ended questions
            4. Take notes on important information
            5. Schedule a follow-up meeting if qualified`,
          voice: {
            provider: 'elevenlabs',
            voiceId: 'sarah',
            stability: 0.85,
            similarityBoost: 0.8
          },
          model: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.8
          },
          functions: [
            {
              name: 'updateLeadScore',
              description: 'Update the lead qualification score',
              parameters: {
                type: 'object',
                properties: {
                  leadId: { type: 'string' },
                  score: { type: 'number', minimum: 0, maximum: 100 },
                  notes: { type: 'string' }
                }
              }
            },
            {
              name: 'scheduleFollowUp',
              description: 'Schedule a follow-up meeting',
              parameters: {
                type: 'object',
                properties: {
                  leadId: { type: 'string' },
                  proposedTime: { type: 'string' },
                  meetingType: { type: 'string', enum: ['demo', 'discovery', 'proposal'] }
                }
              }
            },
            {
              name: 'updateCRM',
              description: 'Update lead information in CRM',
              parameters: {
                type: 'object',
                properties: {
                  leadId: { type: 'string' },
                  budget: { type: 'string' },
                  authority: { type: 'string' },
                  need: { type: 'string' },
                  timeline: { type: 'string' },
                  additionalNotes: { type: 'string' }
                }
              }
            }
          ]
        }
      }
    }
  },
  {
    id: 'appointment-scheduler-bot',
    name: 'AI Appointment Scheduling Assistant',
    description: 'Intelligent bot that handles appointment scheduling with calendar integration',
    keywords: ['appointment', 'schedule', 'calendar', 'booking', 'ai', 'assistant'],
    category: 'ai-assistant',
    difficulty: 'intermediate',
    requiredServices: ['ai', 'calendar', 'notification'],
    examples: [
      'Create a bot that schedules appointments and sends confirmations',
      'Build an AI assistant for managing calendar bookings',
      'Set up automated appointment scheduling with availability checking'
    ],
    tags: ['scheduling', 'calendar', 'ai', 'automation'],
    platforms: {
      vapi: {
        assistant: {
          name: 'Appointment Scheduler',
          firstMessage: 'Hello! I can help you schedule an appointment. What type of appointment would you like to book?',
          context: 'You are a professional appointment scheduling assistant. Check availability, suggest times, and confirm appointments.',
          functions: [
            {
              name: 'checkAvailability',
              description: 'Check calendar availability',
              parameters: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  duration: { type: 'number' },
                  serviceType: { type: 'string' }
                }
              }
            },
            {
              name: 'bookAppointment',
              description: 'Book the appointment',
              parameters: {
                type: 'object',
                properties: {
                  customerName: { type: 'string' },
                  customerEmail: { type: 'string' },
                  customerPhone: { type: 'string' },
                  date: { type: 'string' },
                  time: { type: 'string' },
                  serviceType: { type: 'string' },
                  notes: { type: 'string' }
                }
              }
            }
          ]
        }
      },
      n8n: {
        nodes: [
          {
            id: 'calendar_check',
            name: 'Check Calendar',
            type: 'n8n-nodes-base.googleCalendar',
            position: [450, 300],
            parameters: {
              resource: 'event',
              operation: 'getAll',
              calendar: 'primary',
              timeMin: '={{$json["date"]}}T00:00:00',
              timeMax: '={{$json["date"]}}T23:59:59'
            }
          }
        ]
      }
    }
  },
  {
    id: 'personal-shopping-assistant',
    name: 'AI Personal Shopping Assistant',
    description: 'E-commerce bot that helps customers find products and make purchases',
    keywords: ['shopping', 'ecommerce', 'products', 'recommendation', 'ai', 'assistant'],
    category: 'ai-assistant',
    difficulty: 'complex',
    requiredServices: ['ai', 'ecommerce', 'payment', 'inventory'],
    examples: [
      'Create a shopping assistant that recommends products',
      'Build an AI bot for e-commerce customer service',
      'Set up conversational commerce assistant'
    ],
    tags: ['ecommerce', 'ai', 'shopping', 'retail'],
    platforms: {
      vapi: {
        assistant: {
          name: 'Shopping Assistant',
          firstMessage: 'Welcome to our store! I\'m here to help you find exactly what you\'re looking for. What can I help you with today?',
          context: `You are a knowledgeable shopping assistant. Help customers:
            1. Find products based on their needs
            2. Compare different options
            3. Answer product questions
            4. Process orders
            5. Handle returns and exchanges`,
          functions: [
            {
              name: 'searchProducts',
              description: 'Search for products in inventory',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  category: { type: 'string' },
                  priceRange: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' }
                    }
                  },
                  attributes: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            {
              name: 'getProductDetails',
              description: 'Get detailed information about a product',
              parameters: {
                type: 'object',
                properties: {
                  productId: { type: 'string' }
                }
              }
            },
            {
              name: 'addToCart',
              description: 'Add product to shopping cart',
              parameters: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                  customerId: { type: 'string' }
                }
              }
            },
            {
              name: 'processOrder',
              description: 'Process the order',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' },
                  shippingAddress: { type: 'object' },
                  paymentMethod: { type: 'string' }
                }
              }
            }
          ]
        }
      }
    }
  }
];