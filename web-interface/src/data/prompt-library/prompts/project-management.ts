import { PromptTemplate } from '../types';

export const projectManagementPrompts: PromptTemplate[] = [
  {
    id: 'pm-001',
    category: 'project-management',
    title: 'Sprint Planning Automation',
    description: 'Automate sprint planning with story point estimation and capacity planning',
    prompt: `Create sprint planning automation that:
- Pulls unassigned stories from backlog
- Estimates story points using AI
- Calculates team capacity
- Assigns stories to sprint
- Creates sprint burndown chart
- Notifies team of sprint goals`,
    tags: ['jira', 'agile', 'sprint', 'planning', 'automation'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['jira'],
    useCase: 'Agile teams streamlining sprint planning with automated story assignment and capacity management'
  },
  {
    id: 'pm-002',
    category: 'project-management',
    title: 'Cross-Project Task Sync',
    description: 'Synchronize tasks between multiple project management tools',
    prompt: `Build task synchronization that:
- Syncs tasks between Jira and Trello
- Maps fields and statuses
- Handles two-way updates
- Prevents duplicate creation
- Logs sync activities
- Resolves conflicts automatically`,
    tags: ['jira', 'trello', 'sync', 'integration', 'tasks'],
    difficulty: 'advanced',
    estimatedTime: '50 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['jira', 'trello'],
    useCase: 'Teams using multiple PM tools needing to keep tasks synchronized across platforms'
  },
  {
    id: 'pm-003',
    category: 'project-management',
    title: 'Daily Standup Reporter',
    description: 'Automated daily standup collection and reporting',
    prompt: `Create standup automation that:
- Sends daily prompts to team
- Collects yesterday/today/blockers
- Compiles team report
- Posts to Slack channel
- Tracks participation
- Highlights blockers for review`,
    tags: ['standup', 'agile', 'slack', 'reporting', 'team'],
    difficulty: 'beginner',
    estimatedTime: '25 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['slack', 'project-tool'],
    useCase: 'Remote teams automating daily standup collection and distribution'
  },
  {
    id: 'pm-004',
    category: 'project-management',
    title: 'Project Health Dashboard',
    description: 'Real-time project health monitoring and alerting',
    prompt: `Build project health monitor that:
- Tracks key project metrics
- Monitors budget vs actual
- Checks milestone progress
- Calculates risk scores
- Sends health alerts
- Generates executive dashboards`,
    tags: ['monitoring', 'dashboard', 'metrics', 'alerts', 'reporting'],
    difficulty: 'advanced',
    estimatedTime: '55 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['jira', 'reporting-tool'],
    useCase: 'PMOs monitoring multiple project health metrics with automated alerting'
  },
  {
    id: 'pm-005',
    category: 'project-management',
    title: 'Bug Triage Automation',
    description: 'Automatically triage and assign bugs based on rules',
    prompt: `Create bug triage system that:
- Analyzes bug descriptions
- Assigns priority levels
- Routes to appropriate team
- Sets due dates by severity
- Notifies assignees
- Escalates critical bugs`,
    tags: ['bugs', 'triage', 'jira', 'automation', 'quality'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['jira'],
    useCase: 'QA teams automating bug triage and assignment based on severity and impact'
  },
  {
    id: 'pm-006',
    category: 'project-management',
    title: 'Resource Allocation Optimizer',
    description: 'Optimize team resource allocation across projects',
    prompt: `Build resource optimizer that:
- Analyzes team availability
- Reviews project demands
- Suggests optimal allocation
- Identifies overallocation
- Balances workloads
- Forecasts capacity needs`,
    tags: ['resources', 'allocation', 'optimization', 'capacity', 'planning'],
    difficulty: 'advanced',
    estimatedTime: '60 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['jira', 'calendar-tool'],
    useCase: 'Resource managers optimizing team allocation across multiple projects'
  },
  {
    id: 'pm-007',
    category: 'project-management',
    title: 'Release Notes Generator',
    description: 'Automatically generate release notes from completed tickets',
    prompt: `Create release notes automation that:
- Collects completed tickets
- Groups by feature/bug/improvement
- Generates formatted notes
- Includes contributor credits
- Posts to documentation
- Notifies stakeholders`,
    tags: ['release', 'documentation', 'automation', 'jira', 'communication'],
    difficulty: 'intermediate',
    estimatedTime: '30 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['jira', 'documentation-tool'],
    useCase: 'Development teams automating release notes generation from ticket data'
  },
  {
    id: 'pm-008',
    category: 'project-management',
    title: 'Meeting Action Item Tracker',
    description: 'Extract and track action items from meeting notes',
    prompt: `Build action item tracker that:
- Parses meeting notes
- Extracts action items
- Creates tasks in PM tool
- Assigns to mentioned people
- Sets follow-up reminders
- Tracks completion status`,
    tags: ['meetings', 'actions', 'tracking', 'automation', 'productivity'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['project-tool', 'calendar'],
    useCase: 'Teams ensuring meeting action items are captured and tracked automatically'
  },
  {
    id: 'pm-009',
    category: 'project-management',
    title: 'Project Template Cloner',
    description: 'Clone project templates with customization',
    prompt: `Create project cloner that:
- Duplicates template projects
- Customizes naming conventions
- Adjusts dates and deadlines
- Assigns team members
- Sets up integrations
- Creates project documentation`,
    tags: ['templates', 'automation', 'setup', 'standardization', 'efficiency'],
    difficulty: 'beginner',
    estimatedTime: '25 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['project-tool'],
    useCase: 'PMOs standardizing project creation with reusable templates'
  },
  {
    id: 'pm-010',
    category: 'project-management',
    title: 'Dependency Chain Monitor',
    description: 'Monitor and alert on project dependency chains',
    prompt: `Build dependency monitor that:
- Maps task dependencies
- Identifies critical paths
- Alerts on blocked tasks
- Calculates impact delays
- Suggests mitigation
- Updates stakeholders`,
    tags: ['dependencies', 'monitoring', 'alerts', 'critical-path', 'risk'],
    difficulty: 'advanced',
    estimatedTime: '45 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['jira'],
    useCase: 'Project managers tracking complex dependency chains and preventing delays'
  },
  {
    id: 'pm-011',
    category: 'project-management',
    title: 'Time Tracking Integration',
    description: 'Integrate time tracking with project management tools',
    prompt: `Create time tracking sync that:
- Imports time entries
- Maps to project tasks
- Calculates billable hours
- Generates timesheets
- Updates budgets
- Creates invoices`,
    tags: ['time-tracking', 'billing', 'integration', 'finance', 'productivity'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    targetPlatforms: ['n8n', 'make', 'zapier'],
    requiredCredentials: ['time-tracker', 'project-tool'],
    useCase: 'Consultancies syncing time tracking data with project management for accurate billing'
  },
  {
    id: 'pm-012',
    category: 'project-management',
    title: 'Retrospective Facilitator',
    description: 'Automate retrospective collection and action planning',
    prompt: `Build retrospective automation that:
- Sends retro surveys
- Collects anonymous feedback
- Groups similar items
- Facilitates voting
- Creates action items
- Tracks improvements`,
    tags: ['retrospective', 'agile', 'feedback', 'improvement', 'team'],
    difficulty: 'intermediate',
    estimatedTime: '35 minutes',
    targetPlatforms: ['n8n', 'make'],
    requiredCredentials: ['survey-tool', 'jira'],
    useCase: 'Agile teams conducting effective retrospectives with automated feedback collection'
  }
];