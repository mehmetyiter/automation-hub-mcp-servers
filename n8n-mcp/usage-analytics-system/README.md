# Usage Analytics and Reporting System

A comprehensive usage analytics and reporting platform for the n8n-MCP automation hub, providing real-time tracking, advanced analytics, and automated reporting capabilities.

## Features

### 📊 Usage Tracking
- **Real-time Event Tracking**: Track user interactions, page views, API calls, and workflow executions
- **Session Management**: Comprehensive session tracking with automatic timeout handling
- **Geographic Analytics**: IP-based geolocation with country, region, and city tracking
- **Device & Browser Analytics**: User agent parsing for device, browser, and OS analytics
- **Custom Event Support**: Track custom business events and conversions

### 🎯 Advanced Analytics
- **User Journey Analysis**: Track complete user paths and interaction sequences
- **Funnel Analysis**: Multi-step conversion funnel tracking and optimization
- **Cohort Analysis**: User retention and engagement analysis over time
- **Conversion Tracking**: Goal tracking and conversion rate optimization
- **Real-time Metrics**: Live dashboard with active users and current activity

### 📈 Reporting & Visualization
- **Automated Reports**: Scheduled PDF, Excel, CSV, and HTML reports
- **Interactive Dashboards**: Real-time web dashboards with customizable charts
- **Chart Generation**: Automated chart creation with Chart.js integration
- **Multi-format Export**: Support for PDF, Excel, CSV, JSON, and HTML exports
- **Custom Report Builder**: Flexible report creation with drag-and-drop interface

### 🔄 Real-time Features
- **WebSocket Support**: Live updates for dashboards and monitoring
- **Event Streaming**: Real-time event processing and broadcasting
- **Live Alerts**: Instant notifications for threshold breaches
- **Active User Monitoring**: Real-time active user and session tracking

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Usage Tracker  │    │ Report Generator│    │  Analytics API  │
│                 │    │                 │    │                 │
│ • Event Capture │◄──►│ • PDF Reports   │◄──►│ • REST API      │
│ • Session Mgmt  │    │ • Excel Export  │    │ • WebSocket     │
│ • Geolocation   │    │ • Chart Gen     │    │ • Real-time     │
│ • Device Parse  │    │ • Scheduling    │    │ • Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Usage Storage (PostgreSQL)                  │
│                                                                 │
│ • Events Table      • Sessions Table     • Daily Stats Table   │
│ • Page Analytics    • User Analytics     • Report Definitions  │
│ • Funnel Data       • Cohort Data        • Generated Reports   │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd usage-analytics-system
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Database Setup**
   ```bash
   createdb usage_analytics
   # Tables will be created automatically on startup
   ```

4. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

## Configuration

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=usage_analytics
DB_USERNAME=postgres
DB_PASSWORD=password
```

### Tracking Configuration
```env
ENABLE_REALTIME_PROCESSING=true
ENABLE_GEOLOCATION=true
ENABLE_USER_AGENT_PARSING=true
SESSION_TIMEOUT=1800000
ENABLE_CONVERSION_TRACKING=true
```

### Reporting Configuration
```env
REPORTS_DIRECTORY=./reports
ENABLE_SCHEDULED_REPORTS=true
CHART_WIDTH=800
CHART_HEIGHT=600
```

## API Usage

### Event Tracking

#### Track Page View
```bash
POST /api/events/page
Content-Type: application/json

{
  "sessionId": "session-123",
  "page": "/dashboard",
  "referrer": "/login",
  "metadata": {
    "source": "web"
  }
}
```

#### Track API Call
```bash
POST /api/events/api
Content-Type: application/json

{
  "sessionId": "session-123",
  "endpoint": "/api/workflows",
  "method": "POST",
  "statusCode": 201,
  "responseTime": 250
}
```

#### Track Workflow Execution
```bash
POST /api/events/workflow
Content-Type: application/json

{
  "sessionId": "session-123",
  "workflowId": "wf-456",
  "workflowName": "Data Sync",
  "executionId": "exec-789",
  "duration": 5000,
  "success": true
}
```

#### Track User Action
```bash
POST /api/events/user-action
Content-Type: application/json

{
  "sessionId": "session-123",
  "action": "button_click",
  "target": "create_workflow_button",
  "value": null
}
```

#### Batch Event Tracking
```bash
POST /api/events/batch
Content-Type: application/json

{
  "events": [
    {
      "sessionId": "session-123",
      "event": "page_view",
      "category": "page_view",
      "properties": { "page": "/workflows" }
    },
    {
      "sessionId": "session-123",
      "event": "button_click",
      "category": "user_action",
      "properties": { "action": "create", "target": "workflow" }
    }
  ]
}
```

### Session Management

#### Create Session
```bash
POST /api/sessions/create
Content-Type: application/json

{
  "userId": "user-123",
  "context": {
    "timezone": "America/New_York",
    "language": "en"
  }
}

# Response
{
  "sessionId": "session-456",
  "message": "Session created successfully"
}
```

#### End Session
```bash
POST /api/sessions/{sessionId}/end
```

### Analytics Queries

#### Get Usage Metrics
```bash
GET /api/analytics/metrics?startTime=1640995200000&endTime=1641081600000&country=US

# Response
{
  "totalEvents": 15420,
  "totalSessions": 1250,
  "totalUsers": 890,
  "activeUsers": {
    "last24Hours": 145,
    "last7Days": 654,
    "last30Days": 1230
  },
  "pageViews": {
    "total": 8750,
    "unique": 6230,
    "topPages": [...]
  },
  "apiUsage": {
    "totalCalls": 4560,
    "averageResponseTime": 245,
    "errorRate": 0.023
  }
}
```

#### Get Real-time Analytics
```bash
GET /api/analytics/real-time

# Response
{
  "activeSessions": 23,
  "activeUsers": 18,
  "recentEvents": [...],
  "topPages": [...]
}
```

#### Get Funnel Analysis
```bash
GET /api/analytics/funnel?name=Registration+Funnel&steps=[...]&startTime=...&endTime=...

# Response
{
  "funnelId": "funnel-123",
  "name": "Registration Funnel",
  "steps": [
    {
      "step": "Registration",
      "event": "user_registered",
      "users": 1000,
      "conversionRate": 100,
      "dropOffRate": 0
    },
    {
      "step": "First Workflow",
      "event": "workflow_created",
      "users": 650,
      "conversionRate": 65,
      "dropOffRate": 35
    }
  ],
  "totalUsers": 1000,
  "overallConversionRate": 45
}
```

#### Get User Journey
```bash
GET /api/analytics/user-journey/user-123?limit=100

# Response
[
  {
    "id": "event-1",
    "event": "page_view",
    "timestamp": 1640995200000,
    "properties": { "page": "/login" }
  },
  {
    "id": "event-2",
    "event": "user_login",
    "timestamp": 1640995230000,
    "properties": { "method": "email" }
  }
]
```

### Reporting

#### Create Report Definition
```bash
POST /api/reports/definitions
Content-Type: application/json

{
  "name": "Weekly Usage Report",
  "description": "Weekly summary of platform usage",
  "type": "usage_summary",
  "format": "pdf",
  "schedule": {
    "frequency": "weekly",
    "time": "09:00",
    "timezone": "UTC",
    "recipients": ["admin@company.com"]
  },
  "filters": {
    "dateRange": {
      "type": "relative",
      "value": "7d"
    }
  },
  "metrics": ["totalEvents", "totalUsers", "pageViews"],
  "visualizations": [
    {
      "type": "line",
      "title": "Daily Active Users",
      "metric": "activeUsers",
      "config": {}
    }
  ],
  "createdBy": "admin"
}
```

#### Generate Report
```bash
POST /api/reports/generate/{definitionId}
Content-Type: application/json

{
  "generatedBy": "admin",
  "filters": {
    "country": "US"
  }
}

# Response
{
  "reportId": "report-123",
  "message": "Report generation started"
}
```

#### Download Report
```bash
GET /api/reports/download/{reportId}
# Returns file download
```

### Dashboard Data

#### Get Dashboard Overview
```bash
GET /api/dashboard/overview?startTime=...&endTime=...

# Response
{
  "metrics": { ... },
  "realTime": { ... },
  "timeRange": { ... }
}
```

#### Get Dashboard Charts
```bash
GET /api/dashboard/charts?chartTypes=pageViews,apiCalls,workflows

# Response
{
  "pageViews": {
    "type": "bar",
    "title": "Top Pages",
    "data": [...]
  },
  "apiCalls": {
    "type": "line",
    "title": "API Usage",
    "data": [...]
  }
}
```

## WebSocket Events

### Client Connection
```javascript
const socket = io('http://localhost:3008');

// Subscribe to analytics updates
socket.emit('subscribe_analytics', { 
  type: 'real_time',
  filters: { userId: 'user-123' }
});

// Subscribe to report updates
socket.emit('subscribe_reports', { 
  reportId: 'report-123' 
});
```

### Server Events
```javascript
// Real-time event tracking
socket.on('event_tracked', (event) => {
  console.log('New event:', event);
});

// Real-time analytics updates
socket.on('real_time_analytics', (analytics) => {
  console.log('Live analytics:', analytics);
});

// Session events
socket.on('session_created', (session) => {
  console.log('New session:', session);
});

socket.on('session_ended', (session) => {
  console.log('Session ended:', session);
});

// Report events
socket.on('report_generated', (report) => {
  console.log('Report ready:', report);
});

socket.on('report_status', (status) => {
  console.log('Report status:', status);
});
```

## Report Types

### Usage Summary Report
- Total events, sessions, and users
- Active user metrics
- Page view analytics
- API usage statistics
- Geographic distribution

### User Behavior Report
- User journey analysis
- Page flow patterns
- Session duration analysis
- Bounce rate metrics
- Conversion path analysis

### Performance Report
- API response time analysis
- Error rate tracking
- Endpoint performance metrics
- System load analysis
- Performance trends

### Conversion Report
- Funnel analysis
- Conversion rate optimization
- Cohort retention analysis
- Goal completion tracking
- Revenue attribution

## Advanced Features

### Custom Event Tracking
```javascript
// Track custom business events
await analytics.trackEvent(sessionId, 'subscription_upgraded', 'conversion', {
  plan: 'premium',
  value: 99.99,
  previousPlan: 'basic'
});
```

### A/B Testing Integration
```javascript
// Track experiment participation
await analytics.trackEvent(sessionId, 'experiment_viewed', 'user_action', {
  experimentId: 'button_color_test',
  variant: 'red_button',
  conversionGoal: 'signup'
});
```

### Cohort Analysis
```javascript
// Analyze user retention by signup cohort
const cohortAnalysis = await analytics.getCohortAnalysis('weekly', startTime, endTime);
```

## Data Privacy & Compliance

### GDPR Compliance
- User consent management
- Data anonymization options
- Right to be forgotten implementation
- Data export capabilities

### IP Anonymization
```env
IP_ANONYMIZATION=true
DATA_ANONYMIZATION=true
GDPR_COMPLIANCE=true
```

## Performance Optimization

### Sampling
```env
ENABLE_SAMPLING=true
SAMPLING_RATE=0.1  # Track 10% of events
```

### Caching
```env
ENABLE_CACHING=true
CACHE_TTL=3600  # 1 hour cache
```

### Compression
```env
ENABLE_COMPRESSION=true
```

## Monitoring & Health

### Health Check
```bash
GET /health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-07T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Metrics Endpoint
Built-in Prometheus metrics for monitoring system health and performance.

## Development

### Running in Development
```bash
npm run dev
```

### Testing
```bash
npm test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Production Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3008
CMD ["npm", "start"]
```

### Environment Variables
```env
NODE_ENV=production
LOG_LEVEL=info
DB_SSL=true
ENABLE_CACHING=true
ENABLE_COMPRESSION=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add comprehensive tests
5. Update documentation
6. Submit a pull request

## License

MIT License - see LICENSE file for details.