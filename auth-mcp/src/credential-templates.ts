export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea' | 'json';
  required: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
  defaultValue?: any;
}

export interface CredentialTemplate {
  id: string;
  name: string;
  platform: string;
  category: string;
  description?: string;
  fields: CredentialField[];
  icon?: string;
}

export const credentialTemplates: CredentialTemplate[] = [
  // Automation Platforms
  {
    id: 'n8n',
    name: 'n8n',
    platform: 'n8n',
    category: 'Automation',
    description: 'Connect to your n8n instance',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'http://localhost:5678' },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, description: 'Found in n8n Settings > API' }
    ]
  },
  {
    id: 'zapier',
    name: 'Zapier',
    platform: 'zapier',
    category: 'Automation',
    description: 'Connect to Zapier automation platform',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, description: 'Get from https://zapier.com/app/settings/integrations' }
    ]
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    platform: 'make',
    category: 'Automation',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'region', label: 'Region', type: 'select', required: true, options: ['eu1', 'eu2', 'us1', 'us2'], defaultValue: 'eu1' }
    ]
  },
  
  // Communication Platforms
  {
    id: 'slack',
    name: 'Slack',
    platform: 'slack',
    category: 'Communication',
    description: 'Connect to Slack workspace',
    fields: [
      { key: 'botToken', label: 'Bot User OAuth Token', type: 'password', required: true, placeholder: 'xoxb-...' },
      { key: 'appToken', label: 'App-Level Token', type: 'password', required: false, placeholder: 'xapp-...', description: 'Required for Socket Mode' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password', required: false, description: 'For webhook verification' }
    ]
  },
  {
    id: 'discord',
    name: 'Discord',
    platform: 'discord',
    category: 'Communication',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true },
      { key: 'clientId', label: 'Application ID', type: 'text', required: true },
      { key: 'guildId', label: 'Guild ID', type: 'text', required: false, description: 'For guild-specific commands' }
    ]
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    platform: 'telegram',
    category: 'Communication',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: '123456:ABC-DEF...', description: 'Get from @BotFather' }
    ]
  },
  {
    id: 'whatsapp_business',
    name: 'WhatsApp Business',
    platform: 'whatsapp',
    category: 'Communication',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', required: true },
      { key: 'webhookVerifyToken', label: 'Webhook Verify Token', type: 'password', required: false }
    ]
  },
  
  // Email Services
  {
    id: 'gmail',
    name: 'Gmail',
    platform: 'gmail',
    category: 'Email',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
      { key: 'email', label: 'Email Address', type: 'text', required: true }
    ]
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    platform: 'sendgrid',
    category: 'Email',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'fromEmail', label: 'Default From Email', type: 'text', required: false },
      { key: 'fromName', label: 'Default From Name', type: 'text', required: false }
    ]
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    platform: 'mailgun',
    category: 'Email',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'domain', label: 'Domain', type: 'text', required: true },
      { key: 'region', label: 'Region', type: 'select', required: true, options: ['US', 'EU'], defaultValue: 'US' }
    ]
  },
  {
    id: 'smtp',
    name: 'SMTP',
    platform: 'smtp',
    category: 'Email',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'number', required: true, defaultValue: 587 },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'secure', label: 'Use TLS/SSL', type: 'boolean', required: false, defaultValue: true }
    ]
  },
  
  // AI Services
  {
    id: 'openai',
    name: 'OpenAI',
    platform: 'openai',
    category: 'AI',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'organizationId', label: 'Organization ID', type: 'text', required: false },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'https://api.openai.com/v1', description: 'Custom endpoint (optional)' }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    platform: 'anthropic',
    category: 'AI',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' }
    ]
  },
  {
    id: 'google_ai',
    name: 'Google AI (Gemini)',
    platform: 'google_ai',
    category: 'AI',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'model', label: 'Default Model', type: 'text', required: false, defaultValue: 'gemini-pro' }
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    platform: 'huggingface',
    category: 'AI',
    fields: [
      { key: 'apiKey', label: 'API Token', type: 'password', required: true },
      { key: 'endpointUrl', label: 'Endpoint URL', type: 'text', required: false, description: 'For custom endpoints' }
    ]
  },
  {
    id: 'replicate',
    name: 'Replicate',
    platform: 'replicate',
    category: 'AI',
    fields: [
      { key: 'apiToken', label: 'API Token', type: 'password', required: true }
    ]
  },
  
  // Voice & Phone
  {
    id: 'vapi',
    name: 'Vapi',
    platform: 'vapi',
    category: 'Voice',
    description: 'Voice AI platform',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', required: false },
      { key: 'assistantId', label: 'Default Assistant ID', type: 'text', required: false }
    ]
  },
  {
    id: 'twilio',
    name: 'Twilio',
    platform: 'twilio',
    category: 'Voice',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', required: true },
      { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
      { key: 'phoneNumber', label: 'Phone Number', type: 'text', required: false, placeholder: '+1234567890' }
    ]
  },
  {
    id: 'vonage',
    name: 'Vonage (Nexmo)',
    platform: 'vonage',
    category: 'Voice',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { key: 'applicationId', label: 'Application ID', type: 'text', required: false },
      { key: 'privateKey', label: 'Private Key', type: 'textarea', required: false }
    ]
  },
  
  // Cloud Providers
  {
    id: 'aws',
    name: 'Amazon Web Services',
    platform: 'aws',
    category: 'Cloud',
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'region', label: 'Default Region', type: 'text', required: true, defaultValue: 'us-east-1' },
      { key: 'sessionToken', label: 'Session Token', type: 'password', required: false, description: 'For temporary credentials' }
    ]
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    platform: 'gcp',
    category: 'Cloud',
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'text', required: true },
      { key: 'serviceAccountKey', label: 'Service Account Key (JSON)', type: 'json', required: true },
      { key: 'region', label: 'Default Region', type: 'text', required: false }
    ]
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    platform: 'azure',
    category: 'Cloud',
    fields: [
      { key: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true }
    ]
  },
  
  // Databases
  {
    id: 'mongodb',
    name: 'MongoDB',
    platform: 'mongodb',
    category: 'Database',
    fields: [
      { key: 'connectionString', label: 'Connection String', type: 'password', required: true, placeholder: 'mongodb://...' }
    ]
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    platform: 'postgresql',
    category: 'Database',
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'number', required: true, defaultValue: 5432 },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Use SSL', type: 'boolean', required: false, defaultValue: false }
    ]
  },
  {
    id: 'mysql',
    name: 'MySQL',
    platform: 'mysql',
    category: 'Database',
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'number', required: true, defaultValue: 3306 },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true }
    ]
  },
  {
    id: 'redis',
    name: 'Redis',
    platform: 'redis',
    category: 'Database',
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'number', required: true, defaultValue: 6379 },
      { key: 'password', label: 'Password', type: 'password', required: false },
      { key: 'database', label: 'Database Number', type: 'number', required: false, defaultValue: 0 }
    ]
  },
  
  // CRM & Marketing
  {
    id: 'hubspot',
    name: 'HubSpot',
    platform: 'hubspot',
    category: 'CRM',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'portalId', label: 'Portal ID', type: 'text', required: false }
    ]
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    platform: 'salesforce',
    category: 'CRM',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
      { key: 'instanceUrl', label: 'Instance URL', type: 'text', required: true, placeholder: 'https://yourcompany.salesforce.com' }
    ]
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    platform: 'mailchimp',
    category: 'Marketing',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'server', label: 'Server Prefix', type: 'text', required: true, placeholder: 'us1', description: 'Found at the end of your API key' }
    ]
  },
  
  // Payment Processing
  {
    id: 'stripe',
    name: 'Stripe',
    platform: 'stripe',
    category: 'Payment',
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: 'sk_...' },
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', required: false, placeholder: 'pk_...' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false }
    ]
  },
  {
    id: 'paypal',
    name: 'PayPal',
    platform: 'paypal',
    category: 'Payment',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'environment', label: 'Environment', type: 'select', required: true, options: ['sandbox', 'production'], defaultValue: 'sandbox' }
    ]
  },
  
  // Analytics
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    platform: 'google_analytics',
    category: 'Analytics',
    fields: [
      { key: 'propertyId', label: 'Property ID', type: 'text', required: true },
      { key: 'serviceAccountKey', label: 'Service Account Key', type: 'json', required: true }
    ]
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    platform: 'mixpanel',
    category: 'Analytics',
    fields: [
      { key: 'projectToken', label: 'Project Token', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true }
    ]
  },
  
  // Social Media
  {
    id: 'twitter',
    name: 'Twitter/X',
    platform: 'twitter',
    category: 'Social',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'text', required: true },
      { key: 'accessTokenSecret', label: 'Access Token Secret', type: 'password', required: true }
    ]
  },
  {
    id: 'facebook',
    name: 'Facebook',
    platform: 'facebook',
    category: 'Social',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text', required: true },
      { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true }
    ]
  },
  {
    id: 'instagram',
    name: 'Instagram',
    platform: 'instagram',
    category: 'Social',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', required: true }
    ]
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    platform: 'linkedin',
    category: 'Social',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true }
    ]
  },
  
  // Other Services
  {
    id: 'github',
    name: 'GitHub',
    platform: 'github',
    category: 'Development',
    fields: [
      { key: 'personalAccessToken', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'organization', label: 'Default Organization', type: 'text', required: false }
    ]
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    platform: 'gitlab',
    category: 'Development',
    fields: [
      { key: 'personalAccessToken', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'instanceUrl', label: 'Instance URL', type: 'text', required: false, defaultValue: 'https://gitlab.com' }
    ]
  },
  {
    id: 'jira',
    name: 'Jira',
    platform: 'jira',
    category: 'Project Management',
    fields: [
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'apiToken', label: 'API Token', type: 'password', required: true },
      { key: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'your-domain.atlassian.net' }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    platform: 'notion',
    category: 'Productivity',
    fields: [
      { key: 'apiKey', label: 'Integration Token', type: 'password', required: true }
    ]
  },
  {
    id: 'airtable',
    name: 'Airtable',
    platform: 'airtable',
    category: 'Database',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'baseId', label: 'Default Base ID', type: 'text', required: false }
    ]
  },
  {
    id: 'webhook',
    name: 'Generic Webhook',
    platform: 'webhook',
    category: 'Other',
    fields: [
      { key: 'url', label: 'Webhook URL', type: 'text', required: true },
      { key: 'method', label: 'HTTP Method', type: 'select', required: true, options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], defaultValue: 'POST' },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', required: false },
      { key: 'secret', label: 'Secret/Token', type: 'password', required: false }
    ]
  },
  {
    id: 'custom_api',
    name: 'Custom API',
    platform: 'custom',
    category: 'Other',
    fields: [
      { key: 'name', label: 'API Name', type: 'text', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true },
      { key: 'authType', label: 'Auth Type', type: 'select', required: true, options: ['none', 'apiKey', 'bearer', 'basic', 'oauth2'], defaultValue: 'apiKey' },
      { key: 'credentials', label: 'Credentials (JSON)', type: 'json', required: false, description: 'Auth credentials based on type' }
    ]
  }
];