import { WorkflowPattern } from '../pattern-matcher.js';

export const crmPatterns: WorkflowPattern[] = [
  {
    id: 'contact-form-automation',
    name: 'Contact Form to CRM',
    description: 'Automatically process contact form submissions, send welcome emails, and add contacts to CRM',
    keywords: ['contact', 'form', 'crm', 'welcome', 'email', 'lead', 'submission', 'hubspot', 'salesforce'],
    category: 'crm',
    difficulty: 'simple',
    requiredServices: ['email', 'crm'],
    examples: [
      'When someone fills out my contact form, send them a welcome email and add them to my CRM',
      'Process form submissions and create CRM contacts',
      'Automate lead capture from website forms'
    ],
    tags: ['lead-capture', 'form-processing', 'email-automation'],
    platforms: {
      n8n: {
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
      }
    }
  }
];