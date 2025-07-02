import { PromptTemplate } from '../types';

export const ecommercePrompts: PromptTemplate[] = [
  {
    id: 'ec-001',
    category: 'ecommerce',
    title: 'Abandoned Cart Recovery',
    description: 'Automated email sequence for abandoned cart recovery',
    prompt: `Create abandoned cart recovery that:
- Detects cart abandonment after 1 hour
- Sends personalized email with cart items
- Offers time-limited discount code
- Follows up at 24h and 72h intervals
- Tracks recovery rates
- Stops sequence on purchase`,
    tags: ['shopify', 'email', 'recovery', 'sales', 'automation'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['shopify', 'email-service'],
    useCase: 'E-commerce stores recovering lost sales from abandoned shopping carts'
  },
  {
    id: 'ec-002',
    category: 'ecommerce',
    title: 'Product Review Collector',
    description: 'Automatically request and collect product reviews',
    prompt: `Build review collection system that:
- Triggers 7 days after delivery
- Sends personalized review requests
- Provides one-click rating links
- Incentivizes with loyalty points
- Publishes approved reviews
- Handles negative feedback privately`,
    tags: ['reviews', 'customer-feedback', 'shopify', 'reputation', 'email'],
    difficulty: 'beginner',
    estimatedTime: '30 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['ecommerce-platform', 'email-service'],
    useCase: 'Online stores building social proof through automated review collection'
  },
  {
    id: 'ec-003',
    category: 'ecommerce',
    title: 'Dynamic Pricing Engine',
    description: 'Adjust prices based on demand and competition',
    prompt: `Create dynamic pricing system that:
- Monitors competitor prices
- Analyzes demand patterns
- Adjusts prices within set ranges
- Tests price sensitivity
- Tracks margin impact
- Notifies of significant changes`,
    tags: ['pricing', 'competition', 'optimization', 'shopify', 'strategy'],
    difficulty: 'advanced',
    estimatedTime: '55 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['shopify', 'price-monitoring-tool'],
    useCase: 'E-commerce businesses optimizing prices based on market conditions'
  },
  {
    id: 'ec-004',
    category: 'ecommerce',
    title: 'Inventory Sync Multi-Channel',
    description: 'Sync inventory across multiple sales channels',
    prompt: `Build inventory sync that:
- Monitors stock levels in real-time
- Syncs across Shopify, Amazon, eBay
- Prevents overselling
- Reserves stock for orders
- Updates all channels on sales
- Alerts on sync failures`,
    tags: ['inventory', 'multi-channel', 'sync', 'shopify', 'amazon'],
    difficulty: 'advanced',
    estimatedTime: '50 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['shopify', 'amazon-seller', 'ebay'],
    useCase: 'Multi-channel sellers maintaining accurate inventory across platforms'
  },
  {
    id: 'ec-005',
    category: 'ecommerce',
    title: 'Customer Loyalty Program',
    description: 'Automated loyalty points and rewards system',
    prompt: `Create loyalty program that:
- Awards points for purchases
- Tracks customer point balance
- Sends milestone rewards
- Offers birthday bonuses
- Enables point redemption
- Generates loyalty reports`,
    tags: ['loyalty', 'rewards', 'customer-retention', 'gamification', 'crm'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['ecommerce-platform', 'crm'],
    useCase: 'Retailers building customer loyalty through automated rewards programs'
  },
  {
    id: 'ec-006',
    category: 'ecommerce',
    title: 'Order Fraud Detection',
    description: 'Identify and flag potentially fraudulent orders',
    prompt: `Build fraud detection that:
- Analyzes order patterns
- Checks shipping/billing mismatch
- Verifies high-value orders
- Scores fraud probability
- Flags suspicious orders
- Notifies security team`,
    tags: ['security', 'fraud', 'risk-management', 'shopify', 'payments'],
    difficulty: 'advanced',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['shopify', 'fraud-detection-service'],
    useCase: 'E-commerce stores protecting against fraudulent transactions'
  },
  {
    id: 'ec-007',
    category: 'ecommerce',
    title: 'Product Launch Automation',
    description: 'Coordinate all aspects of new product launches',
    prompt: `Create product launch workflow that:
- Publishes product at scheduled time
- Updates all sales channels
- Sends launch emails to subscribers
- Posts on social media
- Notifies influencers
- Monitors initial sales`,
    tags: ['product-launch', 'marketing', 'coordination', 'shopify', 'social'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['shopify', 'email', 'social-media'],
    useCase: 'E-commerce teams coordinating synchronized product launches'
  },
  {
    id: 'ec-008',
    category: 'ecommerce',
    title: 'WooCommerce Order Processor',
    description: 'Advanced order processing for WooCommerce stores',
    prompt: `Build order processor that:
- Validates order data
- Calculates shipping costs
- Applies tax rules
- Processes payments
- Generates invoices
- Updates inventory`,
    tags: ['woocommerce', 'orders', 'processing', 'wordpress', 'automation'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['woocommerce', 'payment-gateway'],
    useCase: 'WooCommerce stores automating complex order processing workflows'
  },
  {
    id: 'ec-009',
    category: 'ecommerce',
    title: 'Dropshipping Automation',
    description: 'Automate supplier orders for dropshipping business',
    prompt: `Create dropshipping automation that:
- Receives customer orders
- Forwards to appropriate supplier
- Tracks supplier inventory
- Monitors order fulfillment
- Updates tracking information
- Handles supplier issues`,
    tags: ['dropshipping', 'suppliers', 'fulfillment', 'automation', 'orders'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['shopify', 'supplier-api'],
    useCase: 'Dropshipping businesses automating supplier order management'
  },
  {
    id: 'ec-010',
    category: 'ecommerce',
    title: 'Seasonal Campaign Manager',
    description: 'Manage seasonal sales campaigns automatically',
    prompt: `Build campaign automation that:
- Schedules seasonal promotions
- Updates product prices
- Changes store banners
- Sends campaign emails
- Adjusts ad budgets
- Tracks campaign performance`,
    tags: ['campaigns', 'seasonal', 'promotions', 'marketing', 'sales'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['ecommerce-platform', 'email', 'ad-platforms'],
    useCase: 'E-commerce marketers running automated seasonal campaigns'
  },
  {
    id: 'ec-011',
    category: 'ecommerce',
    title: 'Return & Refund Handler',
    description: 'Streamline return and refund processes',
    prompt: `Create return handler that:
- Processes return requests
- Generates return labels
- Tracks return shipments
- Inspects returned items
- Processes refunds/exchanges
- Updates inventory`,
    tags: ['returns', 'refunds', 'customer-service', 'logistics', 'shopify'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['shopify', 'shipping-service'],
    useCase: 'E-commerce operations streamlining return and refund processes'
  },
  {
    id: 'ec-012',
    category: 'ecommerce',
    title: 'Personalized Upsell Engine',
    description: 'AI-powered product recommendations and upsells',
    prompt: `Build upsell engine that:
- Analyzes purchase history
- Identifies upsell opportunities
- Personalizes recommendations
- Times offers strategically
- A/B tests approaches
- Measures revenue impact`,
    tags: ['upsell', 'personalization', 'ai', 'revenue', 'recommendations'],
    difficulty: 'advanced',
    estimatedTime: '50 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['ecommerce-platform', 'recommendation-engine'],
    useCase: 'E-commerce stores increasing average order value through intelligent upsells'
  }
];