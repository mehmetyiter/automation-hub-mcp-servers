// n8n-node-catalog.ts
// Comprehensive catalog of n8n nodes and their use cases

export interface NodeDefinition {
  type: string;
  category: string;
  description: string;
  commonNames: string[];
  useCases: string[];
  requiredParams?: string[];
  outputs?: number; // Number of outputs (1 for normal, 2 for IF nodes, etc.)
}

export const n8nNodeCatalog: Record<string, NodeDefinition> = {
  // Trigger Nodes
  'n8n-nodes-base.webhook': {
    type: 'n8n-nodes-base.webhook',
    category: 'trigger',
    description: 'Triggers workflow via HTTP webhook',
    commonNames: ['webhook', 'http trigger', 'api trigger', 'rest trigger'],
    useCases: ['receive http requests', 'api endpoint', 'external triggers', 'form submissions']
  },
  'n8n-nodes-base.scheduleTrigger': {
    type: 'n8n-nodes-base.scheduleTrigger',
    category: 'trigger',
    description: 'Triggers workflow on schedule',
    commonNames: ['schedule', 'cron', 'timer', 'periodic', 'daily', 'hourly'],
    useCases: ['scheduled tasks', 'recurring jobs', 'periodic checks', 'maintenance tasks']
  },
  'n8n-nodes-base.errorTrigger': {
    type: 'n8n-nodes-base.errorTrigger',
    category: 'trigger',
    description: 'Catches errors from other workflows',
    commonNames: ['error trigger', 'error handler', 'exception handler'],
    useCases: ['error handling', 'failure notifications', 'recovery workflows']
  },
  'n8n-nodes-base.manualTrigger': {
    type: 'n8n-nodes-base.manualTrigger',
    category: 'trigger',
    description: 'Manual workflow trigger',
    commonNames: ['manual', 'test trigger', 'debug trigger'],
    useCases: ['testing', 'manual execution', 'debugging']
  },

  // Communication Nodes
  'n8n-nodes-base.emailSend': {
    type: 'n8n-nodes-base.emailSend',
    category: 'communication',
    description: 'Send emails',
    commonNames: ['email', 'send email', 'mail', 'notification email', 'alert email'],
    useCases: ['email notifications', 'alerts', 'reports', 'confirmations']
  },
  'n8n-nodes-base.slack': {
    type: 'n8n-nodes-base.slack',
    category: 'communication',
    description: 'Slack integration',
    commonNames: ['slack', 'slack message', 'slack notification', 'slack alert'],
    useCases: ['team notifications', 'alerts', 'status updates', 'channel messages']
  },
  'n8n-nodes-base.telegram': {
    type: 'n8n-nodes-base.telegram',
    category: 'communication',
    description: 'Telegram messaging',
    commonNames: ['telegram', 'telegram message', 'telegram bot'],
    useCases: ['instant messaging', 'bot notifications', 'personal alerts']
  },
  'n8n-nodes-base.twilio': {
    type: 'n8n-nodes-base.twilio',
    category: 'communication',
    description: 'SMS and voice calls',
    commonNames: ['sms', 'text message', 'twilio', 'phone', 'call'],
    useCases: ['sms notifications', 'phone calls', 'two-factor auth', 'urgent alerts']
  },
  'n8n-nodes-base.discord': {
    type: 'n8n-nodes-base.discord',
    category: 'communication',
    description: 'Discord messaging',
    commonNames: ['discord', 'discord message', 'discord notification'],
    useCases: ['community notifications', 'gaming alerts', 'server updates']
  },

  // Data Processing
  'n8n-nodes-base.function': {
    type: 'n8n-nodes-base.function',
    category: 'data',
    description: 'Custom JavaScript code',
    commonNames: ['function', 'code', 'javascript', 'custom logic', 'process', 'transform'],
    useCases: ['data transformation', 'custom logic', 'calculations', 'data validation']
  },
  'n8n-nodes-base.code': {
    type: 'n8n-nodes-base.code',
    category: 'data',
    description: 'Execute code (JS/Python)',
    commonNames: ['code', 'script', 'execute', 'python', 'javascript'],
    useCases: ['complex transformations', 'api calls', 'data processing', 'custom operations']
  },
  'n8n-nodes-base.set': {
    type: 'n8n-nodes-base.set',
    category: 'data',
    description: 'Set or modify data',
    commonNames: ['set', 'set data', 'modify', 'update', 'prepare data'],
    useCases: ['data preparation', 'field mapping', 'data structuring', 'format data']
  },
  'n8n-nodes-base.merge': {
    type: 'n8n-nodes-base.merge',
    category: 'data',
    description: 'Merge multiple data streams',
    commonNames: ['merge', 'combine', 'join', 'union', 'collect results'],
    useCases: ['combine branches', 'aggregate data', 'collect results', 'join parallel flows'],
    outputs: 1
  },
  'n8n-nodes-base.splitInBatches': {
    type: 'n8n-nodes-base.splitInBatches',
    category: 'data',
    description: 'Process data in batches',
    commonNames: ['split', 'batch', 'chunk', 'paginate'],
    useCases: ['batch processing', 'large datasets', 'api rate limits', 'memory management']
  },

  // Flow Control
  'n8n-nodes-base.if': {
    type: 'n8n-nodes-base.if',
    category: 'flow',
    description: 'Conditional branching',
    commonNames: ['if', 'condition', 'check', 'validate', 'decision', 'branch'],
    useCases: ['conditional logic', 'validation', 'routing', 'decision making'],
    outputs: 2
  },
  'n8n-nodes-base.switch': {
    type: 'n8n-nodes-base.switch',
    category: 'flow',
    description: 'Multiple condition routing',
    commonNames: ['switch', 'router', 'route', 'multiple conditions', 'case'],
    useCases: ['multiple branches', 'complex routing', 'type-based routing', 'multi-path workflows'],
    outputs: 4 // Can have multiple outputs
  },
  'n8n-nodes-base.wait': {
    type: 'n8n-nodes-base.wait',
    category: 'flow',
    description: 'Pause workflow execution',
    commonNames: ['wait', 'delay', 'pause', 'sleep', 'timeout'],
    useCases: ['rate limiting', 'scheduled delays', 'webhook waiting', 'async operations']
  },

  // HTTP & APIs
  'n8n-nodes-base.httpRequest': {
    type: 'n8n-nodes-base.httpRequest',
    category: 'http',
    description: 'Make HTTP requests',
    commonNames: ['http', 'api', 'rest', 'request', 'fetch', 'call api', 'web request'],
    useCases: ['api calls', 'webhooks', 'rest apis', 'data fetching', 'external services']
  },
  'n8n-nodes-base.respondToWebhook': {
    type: 'n8n-nodes-base.respondToWebhook',
    category: 'http',
    description: 'Send webhook response',
    commonNames: ['respond', 'response', 'webhook response', 'return', 'reply'],
    useCases: ['api responses', 'webhook replies', 'http responses', 'acknowledgments']
  },
  'n8n-nodes-base.graphql': {
    type: 'n8n-nodes-base.graphql',
    category: 'http',
    description: 'GraphQL queries',
    commonNames: ['graphql', 'gql', 'query', 'mutation'],
    useCases: ['graphql apis', 'complex queries', 'data fetching', 'api integration']
  },

  // Databases
  'n8n-nodes-base.postgres': {
    type: 'n8n-nodes-base.postgres',
    category: 'database',
    description: 'PostgreSQL operations',
    commonNames: ['postgres', 'postgresql', 'sql', 'database', 'db', 'query'],
    useCases: ['database queries', 'data storage', 'sql operations', 'data retrieval']
  },
  'n8n-nodes-base.mysql': {
    type: 'n8n-nodes-base.mysql',
    category: 'database',
    description: 'MySQL operations',
    commonNames: ['mysql', 'mariadb', 'sql', 'database'],
    useCases: ['database queries', 'data storage', 'sql operations']
  },
  'n8n-nodes-base.mongoDb': {
    type: 'n8n-nodes-base.mongoDb',
    category: 'database',
    description: 'MongoDB operations',
    commonNames: ['mongodb', 'mongo', 'nosql', 'document db'],
    useCases: ['nosql operations', 'document storage', 'json data', 'flexible schemas']
  },
  'n8n-nodes-base.redis': {
    type: 'n8n-nodes-base.redis',
    category: 'database',
    description: 'Redis cache operations',
    commonNames: ['redis', 'cache', 'key-value', 'memory db'],
    useCases: ['caching', 'session storage', 'pub/sub', 'rate limiting']
  },

  // File Operations
  'n8n-nodes-base.readBinaryFile': {
    type: 'n8n-nodes-base.readBinaryFile',
    category: 'files',
    description: 'Read files from disk',
    commonNames: ['read file', 'load file', 'import file', 'file input'],
    useCases: ['file reading', 'data import', 'file processing', 'csv reading']
  },
  'n8n-nodes-base.writeBinaryFile': {
    type: 'n8n-nodes-base.writeBinaryFile',
    category: 'files',
    description: 'Write files to disk',
    commonNames: ['write file', 'save file', 'export file', 'file output'],
    useCases: ['file writing', 'data export', 'report generation', 'backup creation']
  },
  'n8n-nodes-base.spreadsheetFile': {
    type: 'n8n-nodes-base.spreadsheetFile',
    category: 'files',
    description: 'Work with spreadsheet files',
    commonNames: ['excel', 'spreadsheet', 'xlsx', 'csv'],
    useCases: ['excel processing', 'data import/export', 'report generation']
  },

  // Cloud Services
  'n8n-nodes-base.googleSheets': {
    type: 'n8n-nodes-base.googleSheets',
    category: 'cloud',
    description: 'Google Sheets operations',
    commonNames: ['google sheets', 'sheets', 'spreadsheet', 'google'],
    useCases: ['spreadsheet operations', 'data storage', 'collaborative data', 'reporting']
  },
  'n8n-nodes-base.googleDrive': {
    type: 'n8n-nodes-base.googleDrive',
    category: 'cloud',
    description: 'Google Drive operations',
    commonNames: ['google drive', 'drive', 'cloud storage', 'file storage'],
    useCases: ['file management', 'cloud storage', 'document sharing', 'backup']
  },
  'n8n-nodes-base.aws': {
    type: 'n8n-nodes-base.aws',
    category: 'cloud',
    description: 'AWS services',
    commonNames: ['aws', 'amazon', 's3', 'lambda', 'cloud'],
    useCases: ['cloud operations', 's3 storage', 'lambda functions', 'aws services']
  },

  // Utility Nodes
  'n8n-nodes-base.html': {
    type: 'n8n-nodes-base.html',
    category: 'utility',
    description: 'Generate HTML content',
    commonNames: ['html', 'template', 'render', 'generate html', 'format'],
    useCases: ['html generation', 'email templates', 'report formatting', 'web content']
  },
  'n8n-nodes-base.crypto': {
    type: 'n8n-nodes-base.crypto',
    category: 'utility',
    description: 'Cryptographic operations',
    commonNames: ['crypto', 'encrypt', 'decrypt', 'hash', 'sign'],
    useCases: ['encryption', 'hashing', 'digital signatures', 'security operations']
  },
  'n8n-nodes-base.dateTime': {
    type: 'n8n-nodes-base.dateTime',
    category: 'utility',
    description: 'Date and time operations',
    commonNames: ['date', 'time', 'datetime', 'timestamp', 'format date'],
    useCases: ['date formatting', 'time calculations', 'scheduling', 'timestamps']
  },

  // Integration Nodes
  'n8n-nodes-base.github': {
    type: 'n8n-nodes-base.github',
    category: 'integration',
    description: 'GitHub operations',
    commonNames: ['github', 'git', 'repository', 'pull request', 'issue'],
    useCases: ['repository management', 'issue tracking', 'ci/cd', 'code operations']
  },
  'n8n-nodes-base.gitlab': {
    type: 'n8n-nodes-base.gitlab',
    category: 'integration',
    description: 'GitLab operations',
    commonNames: ['gitlab', 'git', 'repository', 'merge request'],
    useCases: ['repository management', 'ci/cd', 'issue tracking', 'code operations']
  },
  'n8n-nodes-base.jira': {
    type: 'n8n-nodes-base.jira',
    category: 'integration',
    description: 'Jira issue tracking',
    commonNames: ['jira', 'issue', 'ticket', 'project management'],
    useCases: ['issue tracking', 'project management', 'ticket creation', 'workflow automation']
  },
  'n8n-nodes-base.notion': {
    type: 'n8n-nodes-base.notion',
    category: 'integration',
    description: 'Notion workspace',
    commonNames: ['notion', 'notes', 'wiki', 'knowledge base'],
    useCases: ['documentation', 'knowledge management', 'note taking', 'database operations']
  }
};

// Helper function to find best matching node
export function findBestNode(description: string): NodeDefinition | null {
  const lower = description.toLowerCase();
  let bestMatch: NodeDefinition | null = null;
  let highestScore = 0;

  for (const [nodeType, nodeDef] of Object.entries(n8nNodeCatalog)) {
    let score = 0;

    // Check common names
    for (const name of nodeDef.commonNames) {
      if (lower.includes(name)) {
        score += 10;
      }
    }

    // Check use cases
    for (const useCase of nodeDef.useCases) {
      if (lower.includes(useCase.toLowerCase())) {
        score += 5;
      }
    }

    // Check category
    if (lower.includes(nodeDef.category)) {
      score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = nodeDef;
    }
  }

  return highestScore > 0 ? bestMatch : null;
}

// Get nodes by category
export function getNodesByCategory(category: string): NodeDefinition[] {
  return Object.values(n8nNodeCatalog).filter(node => node.category === category);
}

// Get all categories
export function getCategories(): string[] {
  return [...new Set(Object.values(n8nNodeCatalog).map(node => node.category))];
}