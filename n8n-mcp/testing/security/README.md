# Security Testing Automation Framework

A comprehensive security testing framework for the n8n-MCP automation platform, providing automated vulnerability scanning, continuous security monitoring, and CI/CD integration.

## Overview

This security testing framework enables systematic identification of security vulnerabilities, automated security testing in CI/CD pipelines, and continuous monitoring of security posture across the entire n8n-MCP platform.

## Features

### 🔍 Vulnerability Scanning
- **SQL Injection Detection**: Advanced payload testing with error pattern recognition
- **Cross-Site Scripting (XSS)**: Reflected and stored XSS vulnerability detection
- **Authentication Bypass**: Direct object reference and parameter manipulation testing
- **Authorization Flaws**: Privilege escalation and access control testing
- **Sensitive Data Exposure**: Pattern-based detection of exposed sensitive information
- **Security Headers Analysis**: Comprehensive security header validation
- **SSL/TLS Security**: Certificate validation and cipher suite analysis

### 🤖 Automation & CI/CD Integration
- **Scheduled Scanning**: Daily, weekly, and monthly automated scans
- **Baseline Management**: Security baseline creation and comparison
- **CI/CD Pipeline Integration**: Pre-deployment and pull request scanning
- **Failure Conditions**: Configurable scan failure criteria
- **Regression Detection**: Automatic detection of new vulnerabilities

### 📊 Reporting & Analytics
- **Multi-format Reports**: JSON, HTML, PDF, and XML report generation
- **Risk Scoring**: CVSS-based vulnerability scoring
- **Compliance Mapping**: OWASP Top 10 and security standards compliance
- **Trend Analysis**: Historical vulnerability trend tracking
- **Executive Dashboards**: High-level security posture visualization

### 🔗 Integrations
- **JIRA**: Automatic ticket creation for vulnerabilities
- **Slack**: Real-time security notifications
- **GitHub**: Security issue and advisory creation
- **SonarQube**: Code quality and security integration
- **Email/SMS**: Multi-channel alerting

## Architecture

```
├── security-scanner.ts       # Core vulnerability scanning engine
├── security-automation.ts    # Automation and scheduling framework
├── security-cli.ts          # Command-line interface
└── README.md                # Documentation
```

## Quick Start

### 1. Initialize the Security Framework

```bash
# Install dependencies
npm install

# Initialize with default configuration
npx ts-node testing/security/security-cli.ts init

# Initialize with custom configuration
npx ts-node testing/security/security-cli.ts init --config security-config.json
```

### 2. Generate Configuration File

```bash
# Generate sample configuration
npx ts-node testing/security/security-cli.ts config --output my-security-config.json
```

### 3. Run Your First Security Scan

```bash
# Quick web application scan
npx ts-node testing/security/security-cli.ts preset web-app http://localhost:3000

# API security scan
npx ts-node testing/security/security-cli.ts preset api http://localhost:8080/api

# Security headers check
npx ts-node testing/security/security-cli.ts preset headers https://myapp.com
```

### 4. Monitor Scan Progress

```bash
# Check active scans
npx ts-node testing/security/security-cli.ts scan status

# Get detailed scan status
npx ts-node testing/security/security-cli.ts scan status <scan-id>

# View scan history
npx ts-node testing/security/security-cli.ts scan list
```

## Security Scan Types

### 1. SQL Injection Testing

Comprehensive SQL injection vulnerability detection using:

- **Error-based injection**: Database error pattern recognition
- **Boolean-based blind**: Logic-based inference testing
- **Time-based blind**: Response time analysis
- **Union-based**: UNION query injection testing
- **Stacked queries**: Multiple query execution testing

```bash
npx ts-node testing/security/security-cli.ts scan start \
  --name "SQL Injection Test" \
  --type sql_injection \
  --url "http://localhost:3000/api/users" \
  --depth deep
```

### 2. Cross-Site Scripting (XSS)

XSS vulnerability detection covering:

- **Reflected XSS**: Input reflection in responses
- **Stored XSS**: Persistent payload injection
- **DOM-based XSS**: Client-side vulnerability detection
- **Filter bypass**: Encoding and filter evasion techniques

```bash
npx ts-node testing/security/security-cli.ts scan start \
  --name "XSS Security Test" \
  --type xss_scan \
  --url "http://localhost:3000/search" \
  --rate 3
```

### 3. Authentication & Authorization

Comprehensive access control testing:

- **Authentication bypass**: Login mechanism circumvention
- **Session management**: Session fixation and hijacking
- **Direct object references**: Unauthorized resource access
- **Privilege escalation**: Role-based access control flaws

```bash
npx ts-node testing/security/security-cli.ts scan start \
  --name "Auth Bypass Test" \
  --type authentication_bypass \
  --url "http://localhost:3000/admin" \
  --auth-type bearer \
  --auth-creds '{"token": "test-token"}'
```

### 4. API Security Testing

Specialized API security assessment:

- **Input validation**: Parameter manipulation and injection
- **Rate limiting**: API abuse and DoS testing
- **Authentication**: Token validation and bypass attempts
- **Data exposure**: Sensitive information leakage

```bash
npx ts-node testing/security/security-cli.ts scan start \
  --name "API Security Scan" \
  --type api_security_scan \
  --url "http://localhost:8080/api/v1" \
  --depth deep \
  --rate 10
```

## Automation Configuration

### Scheduled Scanning

Configure automated security scans:

```json
{
  "scan_schedule": {
    "daily_scans": {
      "enabled": true,
      "time": "02:00",
      "scan_types": ["security_headers", "sensitive_data_exposure"],
      "targets": ["http://localhost:3000"]
    },
    "weekly_scans": {
      "enabled": true,
      "day": 1,
      "time": "03:00",
      "scan_types": ["vulnerability_scan", "sql_injection", "xss_scan"],
      "targets": ["http://localhost:3000"]
    }
  }
}
```

### CI/CD Integration

Integrate security scanning into your deployment pipeline:

```bash
# Pre-deployment security scan
npx ts-node testing/security/security-cli.ts auto cicd \
  --context deploy \
  --endpoints "http://staging.myapp.com" \
  --metadata '{"version": "1.2.3", "environment": "staging"}'

# Pull request security scan
npx ts-node testing/security/security-cli.ts auto cicd \
  --context pr \
  --endpoints "http://pr-123.myapp.com" \
  --metadata '{"pr": "123", "branch": "feature/new-api"}'
```

### Baseline Management

Create and maintain security baselines:

```bash
# Create initial baseline
npx ts-node testing/security/security-cli.ts auto baseline main --create

# Compare current state with baseline
npx ts-node testing/security/security-cli.ts auto baseline main
```

## CLI Commands Reference

### Scanning Commands

```bash
# Start a custom scan
security scan start --name <name> --type <type> --url <url> [options]

# Check scan status
security scan status [scan-id]

# List all scans
security scan list [--limit <n>] [--type <type>] [--status <status>]

# Cancel running scan
security scan cancel <scan-id>
```

### Preset Scans

```bash
# Web application security scan
security preset web-app <url> [--name <name>]

# API security scan
security preset api <url> [--name <name>] [--auth <json>]

# Security headers scan
security preset headers <url> [--name <name>]
```

### Reporting Commands

```bash
# Vulnerability report
security report vulnerabilities <scan-id> [--severity <level>] [--format <format>]

# Scan summary
security report summary <scan-id>
```

### Automation Commands

```bash
# Baseline management
security auto baseline <name> [--create]

# CI/CD integration
security auto cicd --context <deploy|pr> [options]
```

## Integration Examples

### GitHub Actions

```yaml
name: Security Scan
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Initialize security scanner
        run: npx ts-node testing/security/security-cli.ts init --config .github/security-config.json
        
      - name: Run security scan
        run: |
          npx ts-node testing/security/security-cli.ts auto cicd \
            --context pr \
            --endpoints "http://localhost:3000" \
            --metadata '{"pr": "${{ github.event.number }}", "sha": "${{ github.sha }}"}'
```

### Docker Integration

```dockerfile
# Security scanning stage
FROM node:18 AS security-scan
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Run security scan
RUN npx ts-node testing/security/security-cli.ts preset web-app http://localhost:3000
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Security Scan') {
            steps {
                sh '''
                    npx ts-node testing/security/security-cli.ts init --config jenkins-security-config.json
                    npx ts-node testing/security/security-cli.ts auto cicd \
                        --context deploy \
                        --endpoints "${DEPLOYMENT_URL}" \
                        --metadata '{"build": "${BUILD_NUMBER}", "branch": "${GIT_BRANCH}"}'
                '''
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'security-reports/*.json'
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'security-reports',
                reportFiles: '*.html',
                reportName: 'Security Scan Report'
            ])
        }
    }
}
```

## Configuration Examples

### Basic Configuration

```json
{
  "enabled": true,
  "scan_schedule": {
    "daily_scans": {
      "enabled": true,
      "time": "02:00",
      "scan_types": ["security_headers"],
      "targets": ["http://localhost:3000"]
    },
    "ci_cd_integration": {
      "enabled": true,
      "scan_on_deploy": true,
      "fail_on_high_severity": true
    }
  },
  "baseline_scans": [
    {
      "name": "main",
      "target": {
        "type": "web_application",
        "endpoints": ["http://localhost:3000"]
      },
      "scan_types": ["vulnerability_scan"],
      "configuration": {
        "scan_types": ["vulnerability_scan"],
        "depth": "medium"
      }
    }
  ]
}
```

### Advanced Configuration with Integrations

```json
{
  "enabled": true,
  "scan_schedule": {
    "daily_scans": {
      "enabled": true,
      "time": "02:00",
      "scan_types": ["security_headers", "sensitive_data_exposure"],
      "targets": ["http://production.myapp.com"]
    },
    "weekly_scans": {
      "enabled": true,
      "day": 1,
      "time": "03:00",
      "scan_types": ["vulnerability_scan"],
      "targets": ["http://production.myapp.com"]
    }
  },
  "integration": {
    "jira": {
      "enabled": true,
      "url": "https://mycompany.atlassian.net",
      "username": "security-bot@mycompany.com",
      "api_token": "${JIRA_API_TOKEN}",
      "project_key": "SEC",
      "create_tickets": true,
      "severity_mapping": {
        "critical": "Highest",
        "high": "High",
        "medium": "Medium",
        "low": "Low"
      }
    },
    "slack": {
      "enabled": true,
      "webhook_url": "${SLACK_WEBHOOK_URL}",
      "channel": "#security-alerts",
      "notify_on_high_severity": true,
      "notify_on_new_vulnerabilities": true
    }
  },
  "notifications": {
    "email": {
      "enabled": true,
      "smtp_host": "smtp.mycompany.com",
      "smtp_port": 587,
      "username": "${SMTP_USERNAME}",
      "password": "${SMTP_PASSWORD}",
      "recipients": ["security-team@mycompany.com"],
      "severity_threshold": "high"
    }
  }
}
```

## Security Scan Reports

### Vulnerability Report Structure

```json
{
  "id": "vuln-001",
  "type": "sql_injection",
  "severity": "high",
  "title": "SQL Injection in User Search",
  "description": "Application appears vulnerable to SQL injection attacks",
  "url": "http://localhost:3000/api/users/search",
  "parameter": "q",
  "payload": "' OR '1'='1",
  "evidence": "MySQL error: You have an error in your SQL syntax...",
  "cvss_score": 8.2,
  "cve_ids": ["CVE-2021-12345"],
  "remediation": "Use parameterized queries and input validation",
  "references": [
    "https://owasp.org/www-project-top-ten/2017/A1_2017-Injection"
  ],
  "discovered_at": "2024-01-07T10:30:00Z"
}
```

### Compliance Report

```json
{
  "owasp_top_10": [
    {
      "requirement": "A1: Injection",
      "status": "fail",
      "details": "SQL injection vulnerabilities found"
    },
    {
      "requirement": "A7: Cross-Site Scripting (XSS)",
      "status": "pass",
      "details": "No XSS vulnerabilities detected"
    }
  ],
  "overall_score": 75
}
```

## Best Practices

### 1. Scan Strategy

- **Start with baseline scans** to establish security posture
- **Implement progressive scanning** (surface → medium → deep)
- **Schedule regular scans** during low-traffic periods
- **Use CI/CD integration** for continuous security validation

### 2. Rate Limiting

```json
{
  "rate_limiting": {
    "requests_per_second": 5,
    "concurrent_requests": 2,
    "delay_between_requests": 200
  }
}
```

### 3. Authentication Configuration

```json
{
  "authentication": {
    "method": "bearer",
    "credentials": {
      "token": "${API_TOKEN}"
    },
    "login_endpoint": "/api/auth/login"
  }
}
```

### 4. Exclusion Management

```json
{
  "exclusions": {
    "urls": ["/api/health", "/metrics"],
    "parameters": ["csrf_token"],
    "status_codes": [404, 429]
  }
}
```

## Troubleshooting

### Common Issues

1. **High False Positive Rate**
   - Adjust scan depth and exclusions
   - Fine-tune payload configurations
   - Review authentication settings

2. **Performance Impact**
   - Reduce scan rate and concurrency
   - Schedule scans during off-peak hours
   - Use targeted scanning for critical paths

3. **Authentication Failures**
   - Verify credential configuration
   - Check token expiration
   - Validate authentication endpoints

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
export SECURITY_LOG_LEVEL=debug
export SECURITY_DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add security scan modules
4. Write comprehensive tests
5. Submit a pull request

### Adding New Scan Types

1. Extend the `SecurityScanType` enum
2. Implement the scan logic in `SecurityScanner`
3. Add CLI commands
4. Create test cases
5. Update documentation

## Security Considerations

- **Production scanning**: Use caution when scanning production systems
- **Rate limiting**: Implement appropriate request throttling
- **Data protection**: Ensure scan data is handled securely
- **Access control**: Restrict scanner access to authorized personnel
- **Incident response**: Have procedures for critical vulnerability findings

## License

This security testing framework is part of the n8n-MCP project and follows the same license terms.

## Support

For questions, issues, or contributions:

- Create GitHub issues for bugs
- Submit feature requests via pull requests
- Review the troubleshooting guide
- Contact the security team for urgent issues

---

**⚠️ Warning**: Security scanning can impact system performance and may trigger security monitoring systems. Always coordinate security testing activities with your operations and security teams.