import { PromptTemplate } from '../types';

export const paymentSystemsPrompts: PromptTemplate[] = [
  {
    id: 'ps-001',
    category: 'payment-systems',
    title: 'Stripe Subscription Manager',
    description: 'Automate subscription lifecycle management in Stripe',
    prompt: `Create subscription automation that:
- Handles new subscriptions
- Processes upgrades/downgrades
- Manages payment failures
- Sends renewal reminders
- Handles cancellations
- Generates subscription reports`,
    tags: ['stripe', 'subscriptions', 'recurring', 'billing', 'saas'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['stripe'],
    useCase: 'SaaS companies automating subscription management and billing workflows'
  },
  {
    id: 'ps-002',
    category: 'payment-systems',
    title: 'Payment Failure Recovery',
    description: 'Automated dunning process for failed payments',
    prompt: `Build payment recovery system that:
- Detects failed payments
- Retries with smart scheduling
- Sends payment update requests
- Offers alternative payment methods
- Pauses services if needed
- Tracks recovery success`,
    tags: ['dunning', 'recovery', 'stripe', 'billing', 'retention'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['stripe', 'email-service'],
    useCase: 'Subscription businesses recovering revenue from failed payments'
  },
  {
    id: 'ps-003',
    category: 'payment-systems',
    title: 'PayPal Integration Hub',
    description: 'Comprehensive PayPal payment processing automation',
    prompt: `Create PayPal integration that:
- Processes payments securely
- Handles IPN notifications
- Manages refunds/disputes
- Syncs with accounting
- Generates invoices
- Tracks transaction fees`,
    tags: ['paypal', 'payments', 'integration', 'accounting', 'invoicing'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['paypal'],
    useCase: 'Businesses integrating PayPal payments with their systems'
  },
  {
    id: 'ps-004',
    category: 'payment-systems',
    title: 'Multi-Gateway Router',
    description: 'Route payments through multiple payment gateways',
    prompt: `Build payment router that:
- Selects optimal gateway by rules
- Balances transaction load
- Handles gateway failures
- Routes by card type/region
- Minimizes transaction fees
- Provides unified reporting`,
    tags: ['payments', 'routing', 'optimization', 'multi-gateway', 'failover'],
    difficulty: 'advanced',
    estimatedTime: '55 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['stripe', 'paypal', 'payment-gateways'],
    useCase: 'High-volume merchants optimizing payment routing across gateways'
  },
  {
    id: 'ps-005',
    category: 'payment-systems',
    title: 'Invoice Automation System',
    description: 'Generate and manage invoices automatically',
    prompt: `Create invoice automation that:
- Generates invoices from orders
- Applies tax calculations
- Sends to customers
- Tracks payment status
- Sends payment reminders
- Integrates with accounting`,
    tags: ['invoicing', 'billing', 'accounting', 'automation', 'stripe'],
    difficulty: 'beginner',
    estimatedTime: '30 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['stripe', 'accounting-software'],
    useCase: 'Businesses automating invoice generation and payment tracking'
  },
  {
    id: 'ps-006',
    category: 'payment-systems',
    title: 'Fraud Detection Pipeline',
    description: 'Real-time payment fraud detection and prevention',
    prompt: `Build fraud detection that:
- Analyzes transaction patterns
- Scores fraud risk
- Blocks suspicious payments
- Requires additional verification
- Notifies security team
- Updates fraud rules`,
    tags: ['fraud', 'security', 'risk', 'payments', 'stripe'],
    difficulty: 'advanced',
    estimatedTime: '50 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['stripe', 'fraud-detection-service'],
    useCase: 'Payment processors preventing fraudulent transactions in real-time'
  },
  {
    id: 'ps-007',
    category: 'payment-systems',
    title: 'Payout Automation',
    description: 'Automate vendor and affiliate payouts',
    prompt: `Create payout system that:
- Calculates commission/earnings
- Batches payouts efficiently
- Handles multiple currencies
- Manages tax withholding
- Sends payout notifications
- Generates 1099 forms`,
    tags: ['payouts', 'affiliates', 'vendors', 'stripe', 'accounting'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['stripe', 'paypal'],
    useCase: 'Marketplaces automating vendor and affiliate payment distributions'
  },
  {
    id: 'ps-008',
    category: 'payment-systems',
    title: 'Subscription Analytics',
    description: 'Track and analyze subscription metrics',
    prompt: `Build subscription analytics that:
- Calculates MRR/ARR
- Tracks churn rates
- Monitors LTV
- Analyzes cohort retention
- Identifies at-risk customers
- Generates investor reports`,
    tags: ['analytics', 'subscriptions', 'metrics', 'stripe', 'reporting'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['stripe', 'analytics-tool'],
    useCase: 'SaaS companies tracking subscription health and growth metrics'
  },
  {
    id: 'ps-009',
    category: 'payment-systems',
    title: 'Payment Link Generator',
    description: 'Create and manage secure payment links',
    prompt: `Create payment link system that:
- Generates secure payment URLs
- Sets expiration dates
- Tracks link usage
- Customizes payment pages
- Handles partial payments
- Sends receipts automatically`,
    tags: ['payment-links', 'stripe', 'invoicing', 'secure', 'convenience'],
    difficulty: 'beginner',
    estimatedTime: '25 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['stripe'],
    useCase: 'Service providers sending secure payment links to customers'
  },
  {
    id: 'ps-010',
    category: 'payment-systems',
    title: 'Refund Processor',
    description: 'Streamline refund processing and tracking',
    prompt: `Build refund automation that:
- Processes refund requests
- Validates refund eligibility
- Calculates refund amounts
- Processes partial refunds
- Updates inventory/services
- Notifies all parties`,
    tags: ['refunds', 'customer-service', 'stripe', 'paypal', 'automation'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['payment-gateway'],
    useCase: 'Customer service teams streamlining refund processing'
  },
  {
    id: 'ps-011',
    category: 'payment-systems',
    title: 'Crypto Payment Gateway',
    description: 'Accept and process cryptocurrency payments',
    prompt: `Create crypto payment system that:
- Accepts multiple cryptocurrencies
- Converts to fiat instantly
- Manages wallet addresses
- Tracks exchange rates
- Handles confirmations
- Generates tax reports`,
    tags: ['cryptocurrency', 'bitcoin', 'payments', 'blockchain', 'conversion'],
    difficulty: 'advanced',
    estimatedTime: '60 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['crypto-gateway', 'exchange-api'],
    useCase: 'Businesses accepting cryptocurrency payments with automatic conversion'
  },
  {
    id: 'ps-012',
    category: 'payment-systems',
    title: 'Payment Reconciliation',
    description: 'Automated payment reconciliation with accounting',
    prompt: `Build reconciliation system that:
- Matches payments to invoices
- Identifies discrepancies
- Handles currency conversion
- Reconciles fees and taxes
- Updates accounting records
- Generates exception reports`,
    tags: ['reconciliation', 'accounting', 'automation', 'finance', 'accuracy'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['payment-gateway', 'accounting-software'],
    useCase: 'Finance teams automating payment reconciliation processes'
  }
];