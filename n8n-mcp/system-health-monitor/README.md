# System Health Monitor

A comprehensive system health monitoring and infrastructure observability platform for the n8n-MCP automation hub, providing real-time health checks, system metrics collection, incident management, and intelligent alerting.

## Features

### 🔍 Health Monitoring
- **Multi-protocol Health Checks**: HTTP, TCP, Ping, Database, Service, and Custom checks
- **Real-time Monitoring**: Continuous health assessment with configurable intervals
- **Threshold-based Status**: Intelligent status determination with warning and critical thresholds
- **Automatic Retries**: Configurable retry logic for transient failures
- **Geographic Distribution**: Support for distributed health checks across regions

### 📊 System Metrics Collection
- **Infrastructure Monitoring**: CPU, Memory, Disk, Network, and Process metrics
- **Container Monitoring**: Docker container health and resource usage (optional)
- **Kubernetes Integration**: Pod, Node, and Service monitoring (optional)
- **Real-time Collection**: Configurable metrics collection intervals
- **Historical Data**: Time-series data storage for trend analysis

### 🚨 Intelligent Alerting
- **Rule-based Alerts**: Flexible alert rules with multiple conditions
- **Multi-channel Notifications**: Email, Slack, SMS, Webhooks, and PagerDuty
- **Alert Throttling**: Prevent alert spam with intelligent throttling
- **Scheduled Alerting**: Time-based alert scheduling with timezone support
- **Alert Escalation**: Automatic escalation for unresolved alerts

### 🎯 Incident Management
- **Automatic Incident Creation**: Auto-create incidents from critical failures
- **Incident Tracking**: Full lifecycle management with status updates
- **Assignment & Collaboration**: Assign incidents to team members
- **Timeline & Updates**: Complete incident timeline with status changes
- **MTTR Analytics**: Mean Time To Recovery tracking and optimization

### 📈 Analytics & Reporting
- **Health Summary**: Real-time overview of system health status
- **Performance Metrics**: Response time analysis and availability tracking
- **Trend Analysis**: Historical data analysis and pattern recognition
- **Dashboard Integration**: Real-time dashboards with WebSocket updates
- **Custom Reports**: Flexible reporting with multiple export formats

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Health Monitor │    │ Health Alerting │    │   Health API    │
│                 │    │                 │    │                 │
│ • HTTP Checks   │◄──►│ • Alert Rules   │◄──►│ • REST API      │
│ • TCP Checks    │    │ • Notifications │    │ • WebSocket     │
│ • Ping Checks   │    │ • Throttling    │    │ • Dashboard     │
│ • System Metrics│    │ • Scheduling    │    │ • Real-time     │
│ • Incidents     │    │ • Escalation    │    │ • Management    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Health Storage (PostgreSQL)                │
│                                                                 │
│ • Health Checks     • Check Results      • System Metrics     │
│ • Incidents         • Alert Rules        • Notifications      │
│ • Daily Stats       • Health Snapshots   • Dependencies       │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd system-health-monitor
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Database Setup**
   ```bash
   createdb health_monitor
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
DB_NAME=health_monitor
DB_USERNAME=postgres
DB_PASSWORD=password
```

### Monitoring Configuration
```env
ENABLE_SYSTEM_METRICS=true
ENABLE_DOCKER_METRICS=false
SYSTEM_METRICS_INTERVAL=30000
DEFAULT_CHECK_INTERVAL=60000
```

### Notification Configuration
```env
# Email (SMTP)
ENABLE_EMAIL_NOTIFICATIONS=true
SMTP_HOST=smtp.gmail.com
SMTP_USER=alerts@company.com
SMTP_PASS=app-password

# Slack
ENABLE_SLACK_NOTIFICATIONS=true
SLACK_TOKEN=xoxb-your-bot-token

# SMS (Twilio)
ENABLE_SMS_NOTIFICATIONS=true
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token

# Webhooks
ENABLE_WEBHOOK_NOTIFICATIONS=true
WEBHOOK_URL=https://your-webhook-url
```

## API Usage

### Health Checks Management

#### Create Health Check
```bash
POST /api/health-checks
Content-Type: application/json

{
  "name": "API Endpoint",
  "type": "http",
  "target": "https://api.example.com/health",
  "config": {
    "timeout": 5000,
    "interval": 60000,
    "retries": 3,
    "expectedStatus": 200,
    "headers": {
      "Authorization": "Bearer token"
    }
  },
  "thresholds": {
    "responseTime": {
      "warning": 1000,
      "critical": 5000
    },
    "availability": {
      "warning": 95,
      "critical": 90
    }
  },
  "enabled": true,
  "tags": ["api", "production"]
}
```

#### Get Health Checks
```bash
GET /api/health-checks

# Response
[
  {
    "id": "check-123",
    "name": "API Endpoint",
    "type": "http",
    "target": "https://api.example.com/health",
    "enabled": true,
    "tags": ["api", "production"],
    "createdAt": 1640995200000,
    "updatedAt": 1640995200000
  }
]
```

#### Execute Health Check
```bash
POST /api/health-checks/check-123/execute

# Response
{
  "id": "result-456",
  "checkId": "check-123",
  "timestamp": 1640995200000,
  "status": "healthy",
  "responseTime": 245,
  "success": true,
  "message": "HTTP check successful",
  "metadata": {
    "httpStatus": 200,
    "responseSize": 1024
  }
}
```

### System Metrics

#### Get Current System Metrics
```bash
GET /api/system-metrics/current

# Response
{
  "timestamp": 1640995200000,
  "cpu": {
    "usage": 45.2,
    "loadAverage": [1.2, 1.5, 1.8],
    "cores": 8
  },
  "memory": {
    "total": 16777216000,
    "used": 8388608000,
    "free": 8388608000,
    "usagePercent": 50.0,
    "swap": {
      "total": 2147483648,
      "used": 0,
      "free": 2147483648
    }
  },
  "disk": {
    "total": 1073741824000,
    "used": 536870912000,
    "free": 536870912000,
    "usagePercent": 50.0,
    "disks": [...]
  }
}
```

### Health Summary

#### Get Health Overview
```bash
GET /api/health-summary

# Response
{
  "overall": "healthy",
  "lastUpdated": 1640995200000,
  "checks": {
    "total": 10,
    "healthy": 8,
    "warning": 1,
    "critical": 1,
    "unknown": 0
  },
  "services": {
    "total": 5,
    "healthy": 4,
    "unhealthy": 1
  },
  "infrastructure": {
    "cpu": "healthy",
    "memory": "warning",
    "disk": "healthy",
    "network": "healthy"
  },
  "uptime": {
    "system": 86400,
    "application": 3600
  },
  "incidents": {
    "active": 2,
    "resolved24h": 5,
    "mttr": 1800000
  }
}
```

### Incident Management

#### Create Incident
```bash
POST /api/incidents
Content-Type: application/json

{
  "title": "Database Connection Issues",
  "description": "Unable to connect to primary database",
  "severity": "critical",
  "status": "investigating",
  "affectedServices": ["user-api", "payment-service"],
  "checkIds": ["check-123", "check-456"],
  "assignedTo": "devops-team",
  "tags": ["database", "production"]
}
```

#### Update Incident
```bash
PUT /api/incidents/incident-123
Content-Type: application/json

{
  "status": "identified",
  "message": "Root cause identified - database connection pool exhausted",
  "updatedBy": "john.doe"
}
```

### Alert Rules Management

#### Create Alert Rule
```bash
POST /api/alert-rules
Content-Type: application/json

{
  "name": "High Response Time Alert",
  "description": "Alert when API response time exceeds thresholds",
  "enabled": true,
  "conditions": [
    {
      "type": "response_time_threshold",
      "operator": "gt",
      "value": 2000,
      "consecutiveFailures": 3
    }
  ],
  "actions": [
    {
      "type": "email",
      "config": {
        "recipients": ["team@company.com"],
        "subject": "High Response Time Alert"
      }
    },
    {
      "type": "slack",
      "config": {
        "channel": "#alerts",
        "username": "Health Monitor"
      }
    }
  ],
  "filters": {
    "checkTypes": ["http"],
    "tags": ["production"]
  },
  "throttling": {
    "enabled": true,
    "windowMinutes": 15,
    "maxAlerts": 3
  }
}
```

#### Get Alert Rules
```bash
GET /api/alert-rules

# Response
[
  {
    "id": "rule-123",
    "name": "High Response Time Alert",
    "enabled": true,
    "conditions": [...],
    "actions": [...],
    "createdAt": 1640995200000
  }
]
```

### Notification Channels

#### Create Notification Channel
```bash
POST /api/notification-channels
Content-Type: application/json

{
  "type": "slack",
  "name": "DevOps Slack",
  "enabled": true,
  "config": {
    "token": "xoxb-your-slack-token",
    "defaultChannel": "#devops-alerts"
  }
}
```

#### Test Notification Channel
```bash
POST /api/notification-channels/channel-123/test

# Response
{
  "success": true,
  "message": "Test notification sent successfully"
}
```

### Dashboard Data

#### Get Dashboard Overview
```bash
GET /api/dashboard/overview?timeRange=24h

# Response
{
  "healthSummary": {...},
  "systemMetrics": {...},
  "activeAlerts": 3,
  "timestamp": 1640995200000
}
```

#### Get Dashboard Charts
```bash
GET /api/dashboard/charts?timeRange=7d

# Response
{
  "responseTime": [
    {"timestamp": 1640995200000, "value": 245},
    {"timestamp": 1640995260000, "value": 278}
  ],
  "successRate": [
    {"timestamp": 1640995200000, "value": 99.5},
    {"timestamp": 1640995260000, "value": 98.2}
  ]
}
```

## WebSocket Events

### Client Connection
```javascript
const socket = io('http://localhost:3009');

// Subscribe to health updates
socket.emit('subscribe_health_updates');

// Subscribe to alerts
socket.emit('subscribe_alerts');
```

### Server Events
```javascript
// Health check events
socket.on('health_check_completed', (result) => {
  console.log('Health check completed:', result);
});

socket.on('health_check_failed', (result) => {
  console.log('Health check failed:', result);
});

// System metrics events
socket.on('system_metrics_updated', (metrics) => {
  console.log('System metrics updated:', metrics);
});

// Incident events
socket.on('incident_created', (incident) => {
  console.log('New incident:', incident);
});

// Alert events
socket.on('alert_created', (alert) => {
  console.log('New alert:', alert);
});

socket.on('alert_resolved', (alert) => {
  console.log('Alert resolved:', alert);
});
```

## Health Check Types

### HTTP Health Checks
Monitor web services, APIs, and websites:
```json
{
  "type": "http",
  "target": "https://api.example.com/health",
  "config": {
    "method": "GET",
    "expectedStatus": 200,
    "expectedResponse": "OK",
    "headers": {"Authorization": "Bearer token"},
    "timeout": 5000,
    "authentication": {
      "type": "basic",
      "credentials": {
        "username": "user",
        "password": "pass"
      }
    }
  }
}
```

### TCP Health Checks
Monitor network services and ports:
```json
{
  "type": "tcp",
  "target": "database.example.com:5432",
  "config": {
    "timeout": 3000
  }
}
```

### Ping Health Checks
Monitor network connectivity:
```json
{
  "type": "ping",
  "target": "8.8.8.8",
  "config": {
    "timeout": 5000
  }
}
```

### Database Health Checks
Monitor database connectivity and performance:
```json
{
  "type": "database",
  "target": "postgresql://user:pass@host:5432/db",
  "config": {
    "query": "SELECT 1",
    "timeout": 5000
  }
}
```

### Service Health Checks
Monitor system services and processes:
```json
{
  "type": "service",
  "target": "nginx",
  "config": {
    "expectedStatus": "running"
  }
}
```

## Alert Conditions

### Health Check Failure
```json
{
  "type": "health_check_failed",
  "operator": "eq",
  "value": "critical"
}
```

### Response Time Threshold
```json
{
  "type": "response_time_threshold",
  "operator": "gt",
  "value": 2000,
  "consecutiveFailures": 3
}
```

### System Metric Threshold
```json
{
  "type": "system_metric",
  "field": "cpu.usage",
  "operator": "gt",
  "value": 80,
  "timeWindow": 300000
}
```

### Uptime Threshold
```json
{
  "type": "uptime_threshold",
  "operator": "lt",
  "value": 95,
  "timeWindow": 3600000
}
```

## Notification Types

### Email Notifications
Rich HTML email alerts with detailed information:
- Alert summary and severity
- Health check details and metrics
- System information and context
- Direct links to dashboard

### Slack Notifications
Formatted Slack messages with:
- Color-coded severity indicators
- Interactive buttons for actions
- Thread updates for incident progress
- Channel-specific routing

### SMS Notifications
Concise text messages for critical alerts:
- Alert title and severity
- Affected service information
- Timestamp and basic details

### Webhook Notifications
Flexible webhook integration:
- Custom JSON payloads
- Configurable HTTP methods
- Custom headers and authentication
- Integration with external systems

### PagerDuty Integration
Professional incident management:
- Automatic incident creation
- Escalation policies
- On-call scheduling integration
- Resolution tracking

## Performance & Scalability

### Horizontal Scaling
- Stateless API design
- WebSocket clustering support
- Database connection pooling
- Load balancer compatibility

### Optimization Features
- Intelligent check scheduling
- Result caching and aggregation
- Efficient database indexing
- Compression and rate limiting

### Resource Management
- Configurable check intervals
- Resource usage monitoring
- Automatic cleanup processes
- Memory optimization

## Monitoring & Observability

### Built-in Monitoring
- Self-health checks
- Performance metrics
- Error tracking
- Resource usage monitoring

### Prometheus Integration
Built-in Prometheus metrics:
- Health check success/failure rates
- Response time distributions
- System resource usage
- Alert processing metrics

### Logging
Structured logging with:
- Multiple log levels
- JSON format for parsing
- Request/response logging
- Error tracking with stack traces

## Security

### API Security
- Helmet.js security headers
- CORS configuration
- Rate limiting
- Request validation

### Data Protection
- Sensitive data encryption
- Secure credential storage
- IP anonymization options
- Audit logging

### Authentication & Authorization
- API key authentication
- Role-based access control
- Session management
- OAuth2 integration (planned)

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

### Linting and Type Checking
```bash
npm run lint
npm run type-check
```

### Database Migrations
```bash
# Tables are created automatically
# Manual migration scripts in migrations/ folder
```

## Production Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3009
CMD ["npm", "start"]
```

### Environment Variables
```env
NODE_ENV=production
LOG_LEVEL=info
DB_SSL=true
ENABLE_COMPRESSION=true
ENABLE_RATE_LIMIT=true
```

### Load Balancing
- Support for multiple instances
- Session affinity for WebSocket
- Health check endpoint for LB
- Graceful shutdown handling

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   - Verify database credentials
   - Check network connectivity
   - Ensure database exists

2. **High Memory Usage**
   - Check data retention settings
   - Monitor system metrics collection
   - Review check intervals

3. **Alert Spam**
   - Configure alert throttling
   - Review alert conditions
   - Implement alert scheduling

### Debug Mode
Enable debug logging:
```env
LOG_LEVEL=debug
```

### Health Check Endpoint
Monitor the service health:
```bash
GET /health
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