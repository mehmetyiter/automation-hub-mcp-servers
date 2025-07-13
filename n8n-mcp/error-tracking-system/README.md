# Error Tracking and Alerting System

A comprehensive error tracking and alerting system for the n8n-MCP platform, providing real-time error monitoring, intelligent grouping, multi-channel notifications, and escalation management.

## Features

### 🔍 Error Tracking
- **Real-time Error Capture**: Capture and process errors as they occur
- **Intelligent Grouping**: Automatically group similar errors using fingerprinting
- **Breadcrumb Trail**: Track user actions leading up to errors
- **Performance Metrics**: Monitor system performance alongside errors
- **Source Map Support**: Enhanced stack traces with source map integration

### 🚨 Alert Management
- **Smart Alerting**: Create alerts based on error patterns and thresholds
- **Rule-based Processing**: Configurable alert rules with conditions and actions
- **Escalation Engine**: Automatic escalation with configurable levels
- **Throttling & Suppression**: Prevent alert fatigue with intelligent filtering

### 📢 Multi-Channel Notifications
- **Email**: SMTP-based email notifications with rich formatting
- **Slack**: Native Slack integration with blocks and attachments
- **Discord**: Discord webhooks with embedded messages
- **SMS**: Twilio-powered SMS notifications
- **Webhooks**: Custom webhook integrations
- **Push Notifications**: Mobile and web push notifications

### 📊 Analytics & Reporting
- **Real-time Dashboard**: Live metrics and visualizations
- **Trend Analysis**: Error patterns and frequency analysis
- **Health Scoring**: System health metrics and scoring
- **Performance Tracking**: Response times and system metrics

### 🔗 External Integrations
- **Sentry**: Forward errors to Sentry for additional analysis
- **Datadog**: Send metrics and logs to Datadog
- **New Relic**: Application performance monitoring integration
- **Elasticsearch**: Store and search errors in Elasticsearch

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Error Tracker │    │  Alert Manager  │    │ Notification    │
│                 │    │                 │    │ Service         │
│ • Capture       │◄──►│ • Rules         │◄──►│ • Email         │
│ • Group         │    │ • Escalation    │    │ • Slack         │
│ • Analyze       │    │ • Throttling    │    │ • SMS           │
└─────────────────┘    └─────────────────┘    │ • Discord       │
         │                       │             │ • Webhooks      │
         ▼                       ▼             └─────────────────┘
┌─────────────────┐    ┌─────────────────┐              │
│  Error Storage  │    │  Alert Storage  │              ▼
│                 │    │                 │    ┌─────────────────┐
│ • PostgreSQL    │    │ • PostgreSQL    │    │ External        │
│ • Indexing      │    │ • Rules         │    │ Integrations    │
│ • Cleanup       │    │ • History       │    │                 │
└─────────────────┘    └─────────────────┘    │ • Sentry        │
                                              │ • Datadog       │
                                              │ • New Relic     │
                                              │ • Elasticsearch │
                                              └─────────────────┘
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd error-tracking-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb error_tracking
   
   # The application will create tables automatically on startup
   ```

5. **Build the application**
   ```bash
   npm run build
   ```

6. **Start the application**
   ```bash
   npm start
   ```

## Configuration

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=error_tracking
DB_USERNAME=postgres
DB_PASSWORD=password
DB_SSL=false
```

### Notification Channels

#### Email (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

#### Slack
```env
SLACK_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#alerts
```

#### Discord
```env
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CHANNEL=channel-id
```

#### SMS (Twilio)
```env
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

## API Usage

### Capture an Error
```bash
POST /api/errors
Content-Type: application/json

{
  "error": "Database connection failed",
  "context": {
    "workflowId": "workflow-123",
    "nodeId": "node-456",
    "userId": "user-789"
  },
  "metadata": {
    "tags": ["database", "connection"],
    "extra": {
      "query": "SELECT * FROM users"
    }
  },
  "level": "error"
}
```

### Add Breadcrumb
```bash
POST /api/breadcrumbs
Content-Type: application/json

{
  "category": "navigation",
  "message": "User navigated to dashboard",
  "level": "info",
  "data": {
    "url": "/dashboard",
    "method": "GET"
  }
}
```

### Get Error Statistics
```bash
GET /api/analytics/stats

# Response
{
  "errorTracking": {
    "totalErrors": 1250,
    "errorRate": 0.025,
    "errorGroups": 45,
    "resolvedErrors": 30,
    "criticalErrors": 5,
    "healthScore": 85
  },
  "alerting": {
    "totalAlerts": 125,
    "openAlerts": 12,
    "acknowledgedAlerts": 8,
    "resolvedAlerts": 105,
    "avgResolutionTime": 1800000,
    "escalationRate": 0.15
  }
}
```

### Search Errors
```bash
GET /api/errors?level=error&workflowId=workflow-123&limit=50&offset=0

# Response
{
  "errors": [...],
  "total": 123
}
```

## WebSocket Events

The system provides real-time updates via WebSocket connections:

### Client Subscription
```javascript
const socket = io('http://localhost:3007');

// Subscribe to all errors
socket.emit('subscribe_errors', { workflowId: 'all' });

// Subscribe to specific workflow errors
socket.emit('subscribe_errors', { workflowId: 'workflow-123' });

// Subscribe to alerts
socket.emit('subscribe_alerts', { severity: 'critical' });
```

### Server Events
```javascript
// New error captured
socket.on('error_captured', (data) => {
  console.log('New error:', data);
});

// New alert created
socket.on('alert_created', (alert) => {
  console.log('New alert:', alert);
});

// Alert escalated
socket.on('alert_escalated', (escalation) => {
  console.log('Alert escalated:', escalation);
});
```

## Error Group Management

### Resolve Error Group
```bash
POST /api/error-groups/{fingerprint}/resolve
Content-Type: application/json

{
  "resolvedBy": "user-123",
  "resolution": "Fixed database connection timeout issue by increasing connection pool size"
}
```

## Alert Rules

Create custom alert rules to automatically respond to error patterns:

```javascript
const alertRule = {
  name: "Critical Error Alert",
  description: "Alert on any critical errors",
  enabled: true,
  conditions: [
    {
      type: "threshold",
      field: "level",
      operator: "eq",
      value: "critical"
    }
  ],
  actions: [
    {
      type: "notify",
      config: {
        channels: ["email", "slack"],
        users: ["admin@company.com"],
        delay: 0
      }
    },
    {
      type: "escalate",
      config: {
        delay: 300000 // 5 minutes
      }
    }
  ],
  throttle: {
    window: 300000, // 5 minutes
    maxAlerts: 3
  }
};
```

## Monitoring & Health Checks

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

### Performance Metrics
The system tracks performance metrics including:
- Error processing time
- Memory usage
- CPU usage
- Queue sizes
- Database response times

## Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Type Checking
```bash
npm run type-check
```

## Production Deployment

### Docker Support
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY logs ./logs

EXPOSE 3007
CMD ["npm", "start"]
```

### Environment Variables for Production
```env
NODE_ENV=production
LOG_LEVEL=info
API_PORT=3007

# Use connection pooling and SSL in production
DB_SSL=true
DB_MAX_CONNECTIONS=50

# Enable all security features
ENABLE_REALTIME_ALERTS=true
ENABLE_ERROR_GROUPING=true
RATE_LIMIT_MAX=1000
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see LICENSE file for details.