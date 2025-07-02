export interface PromptCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  platforms: string[];
  color: string;
}

export const promptCategories: PromptCategory[] = [
  {
    id: 'messaging-chatops',
    name: 'Messaging & ChatOps',
    description: 'Automate messaging platforms and team communication',
    icon: '💬',
    platforms: ['WhatsApp Business API', 'Telegram Bot API', 'Slack', 'Discord', 'MS Teams'],
    color: 'bg-blue-500'
  },
  {
    id: 'social-media',
    name: 'Social Media',
    description: 'Social media content management and automation',
    icon: '📱',
    platforms: ['Instagram', 'TikTok', 'Facebook Graph', 'X/Twitter API', 'LinkedIn', 'Pinterest'],
    color: 'bg-pink-500'
  },
  {
    id: 'email-marketing',
    name: 'Email & Marketing',
    description: 'Email campaigns and marketing automation',
    icon: '📧',
    platforms: ['Gmail', 'Outlook', 'SendGrid', 'Mailgun', 'Postmark', 'Brevo'],
    color: 'bg-green-500'
  },
  {
    id: 'sms-voice',
    name: 'SMS / Voice',
    description: 'SMS notifications and voice communication',
    icon: '📞',
    platforms: ['Twilio', 'Vapi', 'Plivo', 'Vonage', 'Sinch'],
    color: 'bg-yellow-500'
  },
  {
    id: 'crm-sales',
    name: 'CRM & Sales',
    description: 'Customer relationship and sales automation',
    icon: '💼',
    platforms: ['Salesforce', 'HubSpot CRM', 'Zoho CRM', 'Pipedrive'],
    color: 'bg-purple-500'
  },
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Task and project workflow automation',
    icon: '📋',
    platforms: ['Jira', 'Trello', 'Asana', 'Monday.com', 'Notion Databases'],
    color: 'bg-indigo-500'
  },
  {
    id: 'data-reporting',
    name: 'Data & Reporting',
    description: 'Data processing and automated reporting',
    icon: '📊',
    platforms: ['Google Sheets', 'Microsoft Excel 365', 'Airtable', 'BigQuery', 'Snowflake'],
    color: 'bg-cyan-500'
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Online store and order management',
    icon: '🛒',
    platforms: ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Square'],
    color: 'bg-orange-500'
  },
  {
    id: 'payment-systems',
    name: 'Payment Systems',
    description: 'Payment processing and subscription management',
    icon: '💳',
    platforms: ['Stripe', 'PayPal', 'Square', 'Adyen'],
    color: 'bg-red-500'
  },
  {
    id: 'support-ticketing',
    name: 'Support & Ticketing',
    description: 'Customer support automation',
    icon: '🎫',
    platforms: ['Zendesk', 'Freshdesk', 'Intercom', 'HelpScout'],
    color: 'bg-teal-500'
  },
  {
    id: 'developer-tools',
    name: 'Developer Tools',
    description: 'Development workflow automation',
    icon: '🛠️',
    platforms: ['GitHub', 'GitLab', 'Bitbucket', 'Sentry', 'PagerDuty'],
    color: 'bg-gray-600'
  },
  {
    id: 'cloud-devops',
    name: 'Cloud & DevOps',
    description: 'Cloud infrastructure automation',
    icon: '☁️',
    platforms: ['AWS', 'Azure', 'GCP', 'Docker Hub', 'Kubernetes'],
    color: 'bg-sky-500'
  },
  {
    id: 'meetings-webinar',
    name: 'Meetings / Webinar',
    description: 'Virtual meeting and webinar automation',
    icon: '🎥',
    platforms: ['Zoom', 'Google Meet', 'MS Teams', 'WebinarJam', 'Demio'],
    color: 'bg-violet-500'
  },
  {
    id: 'calendar-scheduling',
    name: 'Calendar & Scheduling',
    description: 'Calendar management and scheduling',
    icon: '📅',
    platforms: ['Google Calendar', 'Outlook Calendar', 'Calendly', 'Cron'],
    color: 'bg-lime-500'
  },
  {
    id: 'ai-nlp',
    name: 'AI & NLP',
    description: 'AI-powered automation workflows',
    icon: '🤖',
    platforms: ['OpenAI', 'Gemini Pro', 'Anthropic Claude', 'Hugging Face', 'Cohere'],
    color: 'bg-rose-500'
  },
  {
    id: 'file-storage',
    name: 'File & Storage',
    description: 'File management and cloud storage',
    icon: '📁',
    platforms: ['Google Drive', 'Dropbox', 'OneDrive', 'Box', 'AWS S3'],
    color: 'bg-amber-500'
  },
  {
    id: 'business-analytics',
    name: 'Business Analytics',
    description: 'Business intelligence automation',
    icon: '📈',
    platforms: ['Tableau', 'Power BI', 'Looker', 'Metabase', 'Superset'],
    color: 'bg-emerald-500'
  },
  {
    id: 'iot-smart-home',
    name: 'IoT & Smart Home',
    description: 'IoT device and smart home automation',
    icon: '🏠',
    platforms: ['Home Assistant', 'MQTT', 'Philips Hue', 'Tuya', 'Shelly API'],
    color: 'bg-fuchsia-500'
  },
  {
    id: 'travel-booking',
    name: 'Travel / Booking',
    description: 'Travel and booking automation',
    icon: '✈️',
    platforms: ['Booking.com', 'Airbnb', 'Skyscanner', 'Expedia'],
    color: 'bg-blue-600'
  },
  {
    id: 'health-medical',
    name: 'Health & Medical',
    description: 'Healthcare workflow automation',
    icon: '🏥',
    platforms: ['Epic', 'Cerner', 'FHIR API', 'Twilio Health'],
    color: 'bg-red-600'
  },
  {
    id: 'marketing-automation',
    name: 'Marketing Automation',
    description: 'Advanced marketing workflows',
    icon: '🎯',
    platforms: ['HubSpot Marketing', 'Marketo', 'ActiveCampaign', 'Klaviyo'],
    color: 'bg-pink-600'
  },
  {
    id: 'security-monitoring',
    name: 'Security & Monitoring',
    description: 'Security and system monitoring',
    icon: '🔒',
    platforms: ['Okta', 'Auth0', 'Splunk', 'Datadog', 'CrowdStrike'],
    color: 'bg-slate-600'
  },
  {
    id: 'blockchain-web3',
    name: 'Blockchain / Web3',
    description: 'Blockchain and Web3 automation',
    icon: '🔗',
    platforms: ['Metamask', 'Alchemy', 'Infura', 'Etherscan'],
    color: 'bg-purple-600'
  },
  {
    id: 'hr-payroll',
    name: 'HR & Payroll',
    description: 'Human resources automation',
    icon: '👥',
    platforms: ['Workday', 'BambooHR', 'Gusto', 'ADP'],
    color: 'bg-green-600'
  },
  {
    id: 'education-lms',
    name: 'Education & LMS',
    description: 'Educational platform automation',
    icon: '🎓',
    platforms: ['Moodle', 'Canvas', 'Teachable', 'LearnDash'],
    color: 'bg-indigo-600'
  }
];

export function getCategoryById(id: string): PromptCategory | undefined {
  return promptCategories.find(cat => cat.id === id);
}

export function getCategoriesByPlatform(platform: string): PromptCategory[] {
  return promptCategories.filter(cat => 
    cat.platforms.some(p => p.toLowerCase().includes(platform.toLowerCase()))
  );
}