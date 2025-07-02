export interface WorkflowPattern {
  keywords: string[];
  nodes: any[];
  connections: any;
}

export const workflowPatterns: Record<string, WorkflowPattern> = {
  'telegram-rss': {
    keywords: ['telegram', 'rss', 'feed', 'monitor', 'channel', 'post'],
    nodes: [
      {
        id: 'schedule_trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.1,
        position: [250, 300],
        parameters: {
          rule: {
            interval: [
              {
                field: 'hours',
                hoursInterval: 1
              }
            ]
          }
        }
      },
      {
        id: 'rss_feed',
        name: 'RSS Feed Read',
        type: 'n8n-nodes-base.rssFeedRead',
        typeVersion: 1,
        position: [450, 300],
        parameters: {
          url: 'https://example.com/feed.xml'
        }
      },
      {
        id: 'filter_keywords',
        name: 'Filter by Keywords',
        type: 'n8n-nodes-base.filter',
        typeVersion: 1,
        position: [650, 300],
        parameters: {
          conditions: {
            string: [
              {
                value1: '={{$json["title"]}} {{$json["description"]}}',
                operation: 'contains',
                value2: 'keyword'
              }
            ]
          }
        }
      },
      {
        id: 'deduplicate',
        name: 'Remove Duplicates',
        type: 'n8n-nodes-base.removeDuplicates',
        typeVersion: 1,
        position: [850, 300],
        parameters: {
          propertyName: 'link',
          options: {}
        }
      },
      {
        id: 'format_message',
        name: 'Format Message',
        type: 'n8n-nodes-base.set',
        typeVersion: 3,
        position: [1050, 300],
        parameters: {
          assignments: {
            assignments: [
              {
                id: 'message',
                name: 'message',
                type: 'string',
                value: '📰 *{{$json["title"]}}*\\n\\n{{$json["description"]}}\\n\\n🔗 [Read More]({{$json["link"]}})\\n\\n#news #automation'
              }
            ]
          },
          options: {}
        }
      },
      {
        id: 'telegram',
        name: 'Send to Telegram',
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1.1,
        position: [1250, 300],
        parameters: {
          authentication: 'token',
          resource: 'message',
          operation: 'sendMessage',
          chatId: '@yourchannel',
          text: '={{$json["message"]}}',
          additionalFields: {
            parse_mode: 'Markdown'
          }
        }
      }
    ],
    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'RSS Feed Read', type: 'main', index: 0 }]]
      },
      'RSS Feed Read': {
        main: [[{ node: 'Filter by Keywords', type: 'main', index: 0 }]]
      },
      'Filter by Keywords': {
        main: [[{ node: 'Remove Duplicates', type: 'main', index: 0 }]]
      },
      'Remove Duplicates': {
        main: [[{ node: 'Format Message', type: 'main', index: 0 }]]
      },
      'Format Message': {
        main: [[{ node: 'Send to Telegram', type: 'main', index: 0 }]]
      }
    }
  },
  'email-automation': {
    keywords: ['email', 'send', 'gmail', 'outlook', 'mail', 'welcome', 'notification'],
    nodes: [
      {
        id: 'trigger',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          path: 'send-email',
          responseMode: 'onReceived',
          httpMethod: 'POST'
        }
      },
      {
        id: 'email',
        name: 'Send Email',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2.1,
        position: [450, 300],
        parameters: {
          fromEmail: 'noreply@example.com',
          toEmail: '={{$json["email"]}}',
          subject: 'Welcome!',
          emailType: 'html',
          message: '<h1>Welcome!</h1><p>Thank you for signing up.</p>'
        }
      }
    ],
    connections: {
      'Webhook Trigger': {
        main: [[{ node: 'Send Email', type: 'main', index: 0 }]]
      }
    }
  },
  'crm-automation': {
    keywords: ['crm', 'contact', 'form', 'welcome', 'add', 'customer', 'lead'],
    nodes: [
      {
        id: 'webhook',
        name: 'Form Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          path: 'contact-form',
          responseMode: 'onReceived',
          httpMethod: 'POST'
        }
      },
      {
        id: 'send_email',
        name: 'Send Welcome Email',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2.1,
        position: [450, 200],
        parameters: {
          fromEmail: '={{$env.COMPANY_EMAIL}}',
          toEmail: '={{$json["email"]}}',
          subject: 'Welcome to Our Service!',
          emailType: 'html',
          message: '<h1>Welcome {{$json["name"]}}!</h1><p>Thank you for contacting us. We will get back to you soon.</p>'
        }
      },
      {
        id: 'add_to_crm',
        name: 'Add to CRM',
        type: 'n8n-nodes-base.hubspot',
        typeVersion: 2,
        position: [450, 400],
        parameters: {
          resource: 'contact',
          operation: 'create',
          additionalFields: {
            email: '={{$json["email"]}}',
            firstname: '={{$json["firstName"]}}',
            lastname: '={{$json["lastName"]}}',
            phone: '={{$json["phone"]}}'
          }
        }
      },
      {
        id: 'respond',
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        position: [650, 300],
        parameters: {
          respondWith: 'json',
          responseBody: '{"success": true, "message": "Thank you for your submission!"}'
        }
      }
    ],
    connections: {
      'Form Webhook': {
        main: [[
          { node: 'Send Welcome Email', type: 'main', index: 0 },
          { node: 'Add to CRM', type: 'main', index: 0 }
        ]]
      },
      'Send Welcome Email': {
        main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]]
      },
      'Add to CRM': {
        main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]]
      }
    }
  },
  'spreadsheet-automation': {
    keywords: ['spreadsheet', 'sheets', 'google', 'excel', 'csv', 'data', 'call', 'leads'],
    nodes: [
      {
        id: 'trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [250, 300],
        parameters: {}
      },
      {
        id: 'sheets',
        name: 'Read Spreadsheet',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4,
        position: [450, 300],
        parameters: {
          operation: 'read',
          documentId: {
            __rl: true,
            mode: 'list',
            value: ''
          },
          sheetName: {
            __rl: true,
            mode: 'list',
            value: ''
          }
        }
      },
      {
        id: 'process',
        name: 'Process Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [650, 300],
        parameters: {
          language: 'javaScript',
          jsCode: 'return items.map(item => {\\n  // Process your data here\\n  return {\\n    json: item.json\\n  };\\n});'
        }
      }
    ],
    connections: {
      'Manual Trigger': {
        main: [[{ node: 'Read Spreadsheet', type: 'main', index: 0 }]]
      },
      'Read Spreadsheet': {
        main: [[{ node: 'Process Data', type: 'main', index: 0 }]]
      }
    }
  },
  'slack-notification': {
    keywords: ['slack', 'notification', 'message', 'alert', 'channel'],
    nodes: [
      {
        id: 'trigger',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          path: 'slack-notify',
          responseMode: 'onReceived'
        }
      },
      {
        id: 'slack',
        name: 'Send to Slack',
        type: 'n8n-nodes-base.slack',
        typeVersion: 2.1,
        position: [450, 300],
        parameters: {
          resource: 'message',
          operation: 'post',
          authentication: 'token',
          channel: '#general',
          text: '={{$json["message"]}}'
        }
      }
    ],
    connections: {
      'Webhook': {
        main: [[{ node: 'Send to Slack', type: 'main', index: 0 }]]
      }
    }
  }
}

export function findBestPattern(description: string): WorkflowPattern | null {
  const descLower = description.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [key, pattern] of Object.entries(workflowPatterns)) {
    let score = 0;
    
    // Check how many keywords match
    for (const keyword of pattern.keywords) {
      if (descLower.includes(keyword)) {
        score += 1;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  return bestMatch ? workflowPatterns[bestMatch] : null;
}