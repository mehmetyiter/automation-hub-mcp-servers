import { PromptTemplate } from '../types';

export const smsVoicePrompts: PromptTemplate[] = [
  {
    id: 'sv-001',
    category: 'sms-voice',
    title: 'SMS Appointment Reminder System',
    description: 'Send automated SMS reminders for appointments with confirmation options',
    prompt: `Create an SMS reminder system that:
- Sends appointment reminders 24 hours and 1 hour before
- Includes appointment details (date, time, location)
- Allows recipients to confirm or reschedule via SMS
- Handles responses automatically
- Updates appointment status in the system
- Sends follow-up messages if no response`,
    tags: ['sms', 'twilio', 'reminders', 'appointments', 'healthcare'],
    difficulty: 'intermediate',
    estimatedTime: '30 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['twilio'],
    useCase: 'Healthcare providers and service businesses needing to reduce no-shows with automated SMS reminders'
  },
  {
    id: 'sv-002',
    category: 'sms-voice',
    title: 'Voice Call Alert System',
    description: 'Automated voice calls for critical alerts and emergencies',
    prompt: `Build a voice alert system that:
- Triggers voice calls for critical events
- Plays pre-recorded or text-to-speech messages
- Requires recipient confirmation via keypress
- Escalates to backup contacts if no response
- Logs all call attempts and outcomes
- Integrates with monitoring systems`,
    tags: ['voice', 'twilio', 'alerts', 'emergency', 'monitoring'],
    difficulty: 'advanced',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['twilio'],
    useCase: 'IT teams and emergency services needing reliable voice notifications for critical incidents'
  },
  {
    id: 'sv-003',
    category: 'sms-voice',
    title: 'Two-Factor Authentication SMS',
    description: 'Implement SMS-based 2FA for user authentication',
    prompt: `Create a 2FA system using SMS that:
- Generates unique 6-digit codes
- Sends codes via SMS on login attempts
- Validates codes with 5-minute expiry
- Implements rate limiting
- Provides backup codes option
- Logs authentication attempts`,
    tags: ['sms', 'security', '2fa', 'authentication', 'twilio'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['twilio'],
    useCase: 'Applications requiring additional security layer through SMS-based two-factor authentication'
  },
  {
    id: 'sv-004',
    category: 'sms-voice',
    title: 'AI Voice Assistant Integration',
    description: 'Connect Vapi AI voice assistant to handle customer inquiries',
    prompt: `Set up Vapi voice assistant that:
- Answers incoming calls with AI
- Understands customer intent
- Routes to appropriate department
- Collects customer information
- Creates support tickets
- Provides call transcripts and summaries`,
    tags: ['vapi', 'ai', 'voice', 'customer-service', 'automation'],
    difficulty: 'advanced',
    estimatedTime: '60 minutes',
    targetPlatforms: ['n8n', 'vapi'],
    requiredCredentials: ['vapi', 'openai'],
    useCase: 'Businesses wanting to automate customer service calls with AI-powered voice assistants'
  },
  {
    id: 'sv-005',
    category: 'sms-voice',
    title: 'SMS Marketing Campaign Manager',
    description: 'Automated SMS marketing campaigns with personalization',
    prompt: `Build SMS marketing automation that:
- Segments contacts based on preferences
- Sends personalized promotional messages
- Handles opt-in/opt-out management
- Tracks delivery and engagement rates
- A/B tests message variations
- Complies with SMS regulations`,
    tags: ['sms', 'marketing', 'campaigns', 'twilio', 'personalization'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['twilio'],
    useCase: 'Marketing teams running targeted SMS campaigns with compliance and personalization'
  },
  {
    id: 'sv-006',
    category: 'sms-voice',
    title: 'Voice Survey Collector',
    description: 'Collect customer feedback through automated voice surveys',
    prompt: `Create voice survey system that:
- Calls customers after service completion
- Asks rating questions (1-5 scale)
- Records voice feedback
- Transcribes responses
- Analyzes sentiment
- Generates survey reports`,
    tags: ['voice', 'survey', 'feedback', 'twilio', 'analytics'],
    difficulty: 'advanced',
    estimatedTime: '50 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['twilio', 'speech-to-text'],
    useCase: 'Customer service teams collecting post-interaction feedback through automated voice calls'
  },
  {
    id: 'sv-007',
    category: 'sms-voice',
    title: 'Emergency Broadcast System',
    description: 'Mass SMS alerts for emergency notifications',
    prompt: `Implement emergency broadcast that:
- Sends mass SMS to all contacts
- Prioritizes by location/group
- Tracks delivery status
- Provides read receipts
- Includes emergency instructions
- Generates compliance reports`,
    tags: ['sms', 'emergency', 'broadcast', 'alerts', 'mass-messaging'],
    difficulty: 'advanced',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['twilio'],
    useCase: 'Organizations needing to quickly communicate emergency information to large groups'
  },
  {
    id: 'sv-008',
    category: 'sms-voice',
    title: 'SMS Order Status Updates',
    description: 'Automated order tracking notifications via SMS',
    prompt: `Build order notification system that:
- Sends order confirmation SMS
- Updates on shipping status
- Provides tracking links
- Notifies of delivery
- Handles delivery issues
- Collects delivery feedback`,
    tags: ['sms', 'ecommerce', 'tracking', 'notifications', 'orders'],
    difficulty: 'beginner',
    estimatedTime: '25 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['twilio'],
    useCase: 'E-commerce businesses keeping customers informed about order status via SMS'
  },
  {
    id: 'sv-009',
    category: 'sms-voice',
    title: 'Voice-to-CRM Data Entry',
    description: 'Convert voice calls into CRM records automatically',
    prompt: `Create voice-to-CRM system that:
- Records customer calls
- Transcribes conversations
- Extracts key information
- Creates/updates CRM records
- Tags important topics
- Generates follow-up tasks`,
    tags: ['voice', 'crm', 'transcription', 'ai', 'automation'],
    difficulty: 'advanced',
    estimatedTime: '55 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['twilio', 'speech-to-text', 'crm'],
    useCase: 'Sales teams automating CRM data entry from phone conversations'
  },
  {
    id: 'sv-010',
    category: 'sms-voice',
    title: 'SMS Payment Reminders',
    description: 'Automated payment reminder system with SMS',
    prompt: `Build payment reminder workflow that:
- Sends SMS before due dates
- Includes payment links
- Offers payment plan options
- Confirms payment receipt
- Escalates overdue accounts
- Maintains compliance`,
    tags: ['sms', 'payments', 'reminders', 'finance', 'collections'],
    difficulty: 'intermediate',
    estimatedTime: '30 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['twilio', 'payment-gateway'],
    useCase: 'Finance teams automating payment collection with SMS reminders and payment links'
  },
  {
    id: 'sv-011',
    category: 'sms-voice',
    title: 'Voice Authentication System',
    description: 'Secure voice biometric authentication for sensitive operations',
    prompt: `Implement voice authentication that:
- Captures voice samples
- Verifies speaker identity
- Integrates with access systems
- Provides fallback options
- Logs authentication attempts
- Meets security standards`,
    tags: ['voice', 'security', 'biometrics', 'authentication', 'ai'],
    difficulty: 'advanced',
    estimatedTime: '60 minutes',
    targetPlatforms: ['n8n', 'vapi'],
    requiredCredentials: ['vapi', 'voice-biometrics'],
    useCase: 'High-security applications requiring voice-based biometric authentication'
  },
  {
    id: 'sv-012',
    category: 'sms-voice',
    title: 'SMS Chatbot for Support',
    description: 'AI-powered SMS chatbot for customer support',
    prompt: `Create SMS support bot that:
- Understands customer queries
- Provides instant responses
- Escalates complex issues
- Accesses knowledge base
- Updates ticket status
- Collects satisfaction ratings`,
    tags: ['sms', 'chatbot', 'ai', 'support', 'automation'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['twilio', 'openai'],
    useCase: 'Support teams providing 24/7 automated assistance through SMS chatbot'
  }
];