import { PromptTemplate } from '../types';

export const dataReportingPrompts: PromptTemplate[] = [
  {
    id: 'dr-001',
    category: 'data-reporting',
    title: 'Daily Sales Report Generator',
    description: 'Automatically generate and distribute daily sales reports',
    prompt: `Create sales reporting automation that:
- Pulls data from multiple sources
- Calculates daily metrics (revenue, units, AOV)
- Compares to targets and previous periods
- Generates visual charts
- Formats executive summary
- Emails to stakeholders`,
    tags: ['reporting', 'sales', 'analytics', 'automation', 'dashboards'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['database', 'email'],
    useCase: 'Sales teams needing automated daily performance reports with insights'
  },
  {
    id: 'dr-002',
    category: 'data-reporting',
    title: 'Google Sheets Data Pipeline',
    description: 'Build automated data pipeline to Google Sheets',
    prompt: `Build data pipeline that:
- Extracts data from APIs/databases
- Transforms and cleans data
- Loads into Google Sheets
- Updates pivot tables
- Refreshes charts
- Maintains data history`,
    tags: ['google-sheets', 'etl', 'pipeline', 'automation', 'data'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['google-sheets', 'data-source'],
    useCase: 'Teams building automated data pipelines to Google Sheets for reporting'
  },
  {
    id: 'dr-003',
    category: 'data-reporting',
    title: 'BigQuery Analytics Automation',
    description: 'Automate complex BigQuery analytics and reporting',
    prompt: `Create BigQuery automation that:
- Schedules complex queries
- Processes large datasets
- Performs data aggregation
- Exports results to dashboards
- Sends anomaly alerts
- Manages query costs`,
    tags: ['bigquery', 'analytics', 'sql', 'automation', 'google-cloud'],
    difficulty: 'advanced',
    estimatedTime: '50 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['google-cloud', 'bigquery'],
    useCase: 'Data teams automating BigQuery analytics workflows and cost management'
  },
  {
    id: 'dr-004',
    category: 'data-reporting',
    title: 'KPI Dashboard Updater',
    description: 'Real-time KPI dashboard updates from multiple sources',
    prompt: `Build KPI dashboard system that:
- Collects metrics from various APIs
- Calculates KPIs in real-time
- Updates dashboard widgets
- Tracks goal progress
- Sends achievement alerts
- Provides drill-down data`,
    tags: ['kpi', 'dashboard', 'metrics', 'real-time', 'monitoring'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['dashboard-tool', 'data-sources'],
    useCase: 'Executives monitoring real-time KPIs from multiple business systems'
  },
  {
    id: 'dr-005',
    category: 'data-reporting',
    title: 'Data Quality Monitor',
    description: 'Monitor and alert on data quality issues',
    prompt: `Create data quality monitor that:
- Validates data completeness
- Checks for anomalies
- Identifies duplicates
- Monitors data freshness
- Alerts on quality issues
- Generates quality reports`,
    tags: ['data-quality', 'monitoring', 'validation', 'alerts', 'governance'],
    difficulty: 'advanced',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['database', 'monitoring-tool'],
    useCase: 'Data teams ensuring data quality across multiple systems and pipelines'
  },
  {
    id: 'dr-006',
    category: 'data-reporting',
    title: 'Customer Analytics Report',
    description: 'Comprehensive customer behavior analytics and reporting',
    prompt: `Build customer analytics that:
- Analyzes purchase patterns
- Calculates customer lifetime value
- Segments customer base
- Tracks retention metrics
- Identifies churn risks
- Generates actionable insights`,
    tags: ['customer', 'analytics', 'segmentation', 'retention', 'insights'],
    difficulty: 'advanced',
    estimatedTime: '55 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['crm', 'analytics-tool'],
    useCase: 'Marketing teams analyzing customer behavior for targeted campaigns'
  },
  {
    id: 'dr-007',
    category: 'data-reporting',
    title: 'Financial Report Compiler',
    description: 'Compile financial reports from multiple data sources',
    prompt: `Create financial reporting that:
- Consolidates financial data
- Generates P&L statements
- Creates balance sheets
- Calculates key ratios
- Formats for compliance
- Distributes to stakeholders`,
    tags: ['finance', 'reporting', 'accounting', 'compliance', 'automation'],
    difficulty: 'advanced',
    estimatedTime: '60 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['accounting-system', 'reporting-tool'],
    useCase: 'Finance teams automating monthly financial report generation'
  },
  {
    id: 'dr-008',
    category: 'data-reporting',
    title: 'Website Analytics Digest',
    description: 'Daily website analytics summary and insights',
    prompt: `Build analytics digest that:
- Pulls data from Google Analytics
- Summarizes traffic metrics
- Highlights top content
- Tracks conversion goals
- Identifies traffic sources
- Sends daily email digest`,
    tags: ['analytics', 'website', 'google-analytics', 'reporting', 'marketing'],
    difficulty: 'beginner',
    estimatedTime: '25 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['google-analytics'],
    useCase: 'Marketing teams receiving daily website performance summaries'
  },
  {
    id: 'dr-009',
    category: 'data-reporting',
    title: 'Inventory Level Reporter',
    description: 'Real-time inventory reporting and low-stock alerts',
    prompt: `Create inventory reporting that:
- Monitors stock levels
- Calculates reorder points
- Alerts on low inventory
- Tracks inventory turnover
- Predicts stockouts
- Generates purchase orders`,
    tags: ['inventory', 'supply-chain', 'alerts', 'forecasting', 'operations'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['inventory-system'],
    useCase: 'Operations teams managing inventory with automated reporting and alerts'
  },
  {
    id: 'dr-010',
    category: 'data-reporting',
    title: 'Social Media Analytics Hub',
    description: 'Consolidated social media performance reporting',
    prompt: `Build social analytics hub that:
- Aggregates data from all platforms
- Tracks engagement metrics
- Analyzes post performance
- Monitors competitor activity
- Identifies trending content
- Creates weekly reports`,
    tags: ['social-media', 'analytics', 'reporting', 'marketing', 'engagement'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['social-platforms'],
    useCase: 'Social media managers tracking performance across multiple platforms'
  },
  {
    id: 'dr-011',
    category: 'data-reporting',
    title: 'API Usage Analytics',
    description: 'Monitor and report on API usage patterns',
    prompt: `Create API analytics that:
- Tracks API call volumes
- Monitors response times
- Identifies usage patterns
- Calculates cost per endpoint
- Detects anomalies
- Generates billing reports`,
    tags: ['api', 'monitoring', 'analytics', 'performance', 'billing'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['api-gateway', 'monitoring-tool'],
    useCase: 'DevOps teams monitoring API usage and performance metrics'
  },
  {
    id: 'dr-012',
    category: 'data-reporting',
    title: 'Employee Performance Dashboard',
    description: 'Automated employee performance tracking and reporting',
    prompt: `Build performance dashboard that:
- Collects productivity metrics
- Tracks goal completion
- Calculates performance scores
- Compares team averages
- Identifies top performers
- Generates review reports`,
    tags: ['hr', 'performance', 'employee', 'metrics', 'dashboard'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['hr-system', 'productivity-tools'],
    useCase: 'HR teams automating performance tracking and review preparation'
  }
];