import { EventEmitter } from 'events';
import { CronJob } from 'cron';
import { SecurityScanner, SecurityScan, SecurityScanType, SecurityTarget, ScanConfiguration } from './security-scanner';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';
import { AlertingService } from '../../src/observability/alerting';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();
const alerting = AlertingService.getInstance();

export interface SecurityAutomationConfig {
  enabled: boolean;
  scan_schedule: ScanScheduleConfig;
  baseline_scans: BaselineScanConfig[];
  continuous_monitoring: ContinuousMonitoringConfig;
  integration: IntegrationConfig;
  notifications: NotificationConfig;
}

export interface ScanScheduleConfig {
  daily_scans: DailyScanConfig;
  weekly_scans: WeeklyScanConfig;
  monthly_scans: MonthlyScanConfig;
  ci_cd_integration: CICDIntegrationConfig;
}

export interface DailyScanConfig {
  enabled: boolean;
  time: string; // HH:MM format
  scan_types: SecurityScanType[];
  targets: string[];
}

export interface WeeklyScanConfig {
  enabled: boolean;
  day: number; // 0-6 (Sunday-Saturday)
  time: string;
  scan_types: SecurityScanType[];
  targets: string[];
}

export interface MonthlyScanConfig {
  enabled: boolean;
  day: number; // 1-31
  time: string;
  scan_types: SecurityScanType[];
  targets: string[];
}

export interface CICDIntegrationConfig {
  enabled: boolean;
  scan_on_deploy: boolean;
  scan_on_pr: boolean;
  fail_on_high_severity: boolean;
  fail_on_new_vulnerabilities: boolean;
  baseline_comparison: boolean;
}

export interface BaselineScanConfig {
  name: string;
  target: SecurityTarget;
  scan_types: SecurityScanType[];
  configuration: ScanConfiguration;
  baseline_file?: string;
}

export interface ContinuousMonitoringConfig {
  enabled: boolean;
  real_time_monitoring: boolean;
  behavioral_analysis: boolean;
  anomaly_detection: boolean;
  threat_intelligence: boolean;
}

export interface IntegrationConfig {
  jira: JiraIntegrationConfig;
  slack: SlackIntegrationConfig;
  github: GitHubIntegrationConfig;
  sonarqube: SonarQubeIntegrationConfig;
}

export interface JiraIntegrationConfig {
  enabled: boolean;
  url: string;
  username: string;
  api_token: string;
  project_key: string;
  create_tickets: boolean;
  severity_mapping: Record<string, string>;
}

export interface SlackIntegrationConfig {
  enabled: boolean;
  webhook_url: string;
  channel: string;
  notify_on_high_severity: boolean;
  notify_on_new_vulnerabilities: boolean;
}

export interface GitHubIntegrationConfig {
  enabled: boolean;
  token: string;
  repository: string;
  create_issues: boolean;
  create_security_advisories: boolean;
}

export interface SonarQubeIntegrationConfig {
  enabled: boolean;
  url: string;
  token: string;
  project_key: string;
  push_results: boolean;
}

export interface NotificationConfig {
  email: EmailNotificationConfig;
  sms: SMSNotificationConfig;
  webhook: WebhookNotificationConfig;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
  recipients: string[];
  severity_threshold: 'low' | 'medium' | 'high' | 'critical';
}

export interface SMSNotificationConfig {
  enabled: boolean;
  provider: 'twilio' | 'aws_sns';
  api_key: string;
  phone_numbers: string[];
  severity_threshold: 'high' | 'critical';
}

export interface WebhookNotificationConfig {
  enabled: boolean;
  urls: string[];
  headers: Record<string, string>;
  severity_threshold: 'medium' | 'high' | 'critical';
}

export interface ScanReport {
  id: string;
  scan_id: string;
  type: 'vulnerability' | 'compliance' | 'summary';
  generated_at: Date;
  format: 'json' | 'html' | 'pdf' | 'xml';
  content: any;
  file_path?: string;
}

export class SecurityAutomation extends EventEmitter {
  private scanner: SecurityScanner;
  private config: SecurityAutomationConfig;
  private scheduledJobs: Map<string, CronJob> = new Map();
  private scanBaselines: Map<string, SecurityScan> = new Map();
  private activeMonitoring = false;

  constructor(config: SecurityAutomationConfig) {
    super();
    this.config = config;
    this.scanner = new SecurityScanner();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing security automation');

    if (this.config.enabled) {
      await this.loadBaselines();
      await this.setupScheduledScans();
      
      if (this.config.continuous_monitoring.enabled) {
        await this.startContinuousMonitoring();
      }
    }

    logger.info('Security automation initialized');
  }

  private setupEventHandlers(): void {
    this.scanner.on('scan_completed', async (scan: SecurityScan) => {
      await this.processScanResults(scan);
    });

    this.scanner.on('scan_failed', async ({ scan, error }) => {
      await this.handleScanFailure(scan, error);
    });
  }

  // Scheduled Scanning
  private async setupScheduledScans(): Promise<void> {
    const schedule = this.config.scan_schedule;

    // Daily scans
    if (schedule.daily_scans.enabled) {
      const [hour, minute] = schedule.daily_scans.time.split(':');
      const cronPattern = `${minute} ${hour} * * *`;
      
      const dailyJob = new CronJob(cronPattern, async () => {
        await this.runDailyScans();
      });

      this.scheduledJobs.set('daily', dailyJob);
      dailyJob.start();
      logger.info('Daily security scans scheduled', { time: schedule.daily_scans.time });
    }

    // Weekly scans
    if (schedule.weekly_scans.enabled) {
      const [hour, minute] = schedule.weekly_scans.time.split(':');
      const cronPattern = `${minute} ${hour} * * ${schedule.weekly_scans.day}`;
      
      const weeklyJob = new CronJob(cronPattern, async () => {
        await this.runWeeklyScans();
      });

      this.scheduledJobs.set('weekly', weeklyJob);
      weeklyJob.start();
      logger.info('Weekly security scans scheduled', { 
        day: schedule.weekly_scans.day, 
        time: schedule.weekly_scans.time 
      });
    }

    // Monthly scans
    if (schedule.monthly_scans.enabled) {
      const [hour, minute] = schedule.monthly_scans.time.split(':');
      const cronPattern = `${minute} ${hour} ${schedule.monthly_scans.day} * *`;
      
      const monthlyJob = new CronJob(cronPattern, async () => {
        await this.runMonthlyScans();
      });

      this.scheduledJobs.set('monthly', monthlyJob);
      monthlyJob.start();
      logger.info('Monthly security scans scheduled', { 
        day: schedule.monthly_scans.day, 
        time: schedule.monthly_scans.time 
      });
    }
  }

  private async runDailyScans(): Promise<void> {
    logger.info('Running daily security scans');
    const config = this.config.scan_schedule.daily_scans;

    for (const target of config.targets) {
      for (const scanType of config.scan_types) {
        await this.runAutomatedScan('daily', scanType, target);
      }
    }
  }

  private async runWeeklyScans(): Promise<void> {
    logger.info('Running weekly security scans');
    const config = this.config.scan_schedule.weekly_scans;

    for (const target of config.targets) {
      for (const scanType of config.scan_types) {
        await this.runAutomatedScan('weekly', scanType, target);
      }
    }
  }

  private async runMonthlyScans(): Promise<void> {
    logger.info('Running monthly security scans');
    const config = this.config.scan_schedule.monthly_scans;

    for (const target of config.targets) {
      for (const scanType of config.scan_types) {
        await this.runAutomatedScan('monthly', scanType, target);
      }
    }
  }

  private async runAutomatedScan(
    schedule: string, 
    scanType: SecurityScanType, 
    target: string
  ): Promise<void> {
    try {
      const scanTarget: SecurityTarget = {
        type: 'web_application',
        endpoints: [target]
      };

      const scanConfig: ScanConfiguration = {
        scan_types: [scanType],
        depth: 'medium',
        rate_limiting: {
          requests_per_second: 5,
          concurrent_requests: 2,
          delay_between_requests: 200
        }
      };

      const scanId = await this.scanner.startScan(
        `${schedule}-${scanType}-${Date.now()}`,
        scanType,
        scanTarget,
        scanConfig
      );

      logger.info('Automated scan started', { schedule, scanType, target, scanId });
    } catch (error) {
      logger.error('Failed to start automated scan', { 
        schedule, scanType, target, error: error.message 
      });
    }
  }

  // Baseline Management
  private async loadBaselines(): Promise<void> {
    for (const baselineConfig of this.config.baseline_scans) {
      if (baselineConfig.baseline_file && 
          await this.fileExists(baselineConfig.baseline_file)) {
        try {
          const baselineData = await fs.readFile(baselineConfig.baseline_file, 'utf-8');
          const baseline = JSON.parse(baselineData) as SecurityScan;
          this.scanBaselines.set(baselineConfig.name, baseline);
          logger.info('Loaded security baseline', { name: baselineConfig.name });
        } catch (error) {
          logger.error('Failed to load baseline', { 
            name: baselineConfig.name, 
            file: baselineConfig.baseline_file,
            error: error.message 
          });
        }
      }
    }
  }

  async createBaseline(name: string): Promise<void> {
    const baselineConfig = this.config.baseline_scans.find(b => b.name === name);
    if (!baselineConfig) {
      throw new Error(`Baseline configuration not found: ${name}`);
    }

    logger.info('Creating security baseline', { name });

    const scanId = await this.scanner.startScan(
      `baseline-${name}`,
      baselineConfig.scan_types[0], // Use first scan type for baseline
      baselineConfig.target,
      baselineConfig.configuration
    );

    // Wait for scan completion
    const scan = await this.waitForScanCompletion(scanId);
    
    // Save baseline
    this.scanBaselines.set(name, scan);
    
    if (baselineConfig.baseline_file) {
      await fs.writeFile(
        baselineConfig.baseline_file, 
        JSON.stringify(scan, null, 2)
      );
    }

    logger.info('Security baseline created', { name, scanId });
  }

  private async waitForScanCompletion(scanId: string): Promise<SecurityScan> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const scan = this.scanner.getScan(scanId);
        if (scan) {
          if (scan.status === 'completed') {
            clearInterval(checkInterval);
            resolve(scan);
          } else if (scan.status === 'failed') {
            clearInterval(checkInterval);
            reject(new Error('Scan failed'));
          }
        }
      }, 5000);

      // Timeout after 30 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Scan timeout'));
      }, 30 * 60 * 1000);
    });
  }

  async compareWithBaseline(scanId: string, baselineName: string): Promise<any> {
    const scan = this.scanner.getScan(scanId);
    const baseline = this.scanBaselines.get(baselineName);

    if (!scan || !baseline) {
      throw new Error('Scan or baseline not found');
    }

    const comparison = {
      baseline_vulnerabilities: baseline.results.vulnerabilities.length,
      current_vulnerabilities: scan.results.vulnerabilities.length,
      new_vulnerabilities: [],
      resolved_vulnerabilities: [],
      regression_detected: false
    };

    // Find new vulnerabilities
    const baselineVulnSignatures = new Set(
      baseline.results.vulnerabilities.map(v => `${v.type}-${v.url}-${v.parameter}`)
    );

    const currentVulnSignatures = new Set(
      scan.results.vulnerabilities.map(v => `${v.type}-${v.url}-${v.parameter}`)
    );

    comparison.new_vulnerabilities = scan.results.vulnerabilities.filter(v => 
      !baselineVulnSignatures.has(`${v.type}-${v.url}-${v.parameter}`)
    );

    comparison.resolved_vulnerabilities = baseline.results.vulnerabilities.filter(v => 
      !currentVulnSignatures.has(`${v.type}-${v.url}-${v.parameter}`)
    );

    comparison.regression_detected = comparison.new_vulnerabilities.length > 0;

    return comparison;
  }

  // CI/CD Integration
  async runCICDScan(context: 'deploy' | 'pr', metadata: any): Promise<boolean> {
    const cicdConfig = this.config.scan_schedule.ci_cd_integration;
    
    if (!cicdConfig.enabled) {
      return true;
    }

    if ((context === 'deploy' && !cicdConfig.scan_on_deploy) ||
        (context === 'pr' && !cicdConfig.scan_on_pr)) {
      return true;
    }

    logger.info('Running CI/CD security scan', { context, metadata });

    const scanTarget: SecurityTarget = {
      type: 'web_application',
      endpoints: metadata.endpoints || ['http://localhost:3000']
    };

    const scanConfig: ScanConfiguration = {
      scan_types: ['vulnerability_scan', 'security_headers', 'sensitive_data_exposure'],
      depth: 'medium',
      rate_limiting: {
        requests_per_second: 10,
        concurrent_requests: 5,
        delay_between_requests: 100
      }
    };

    const scanId = await this.scanner.startScan(
      `cicd-${context}-${Date.now()}`,
      'vulnerability_scan',
      scanTarget,
      scanConfig
    );

    try {
      const scan = await this.waitForScanCompletion(scanId);
      
      // Check failure conditions
      const highSeverityVulns = scan.results.vulnerabilities.filter(
        v => v.severity === 'high' || v.severity === 'critical'
      ).length;

      let shouldFail = false;

      if (cicdConfig.fail_on_high_severity && highSeverityVulns > 0) {
        shouldFail = true;
        logger.warn('CI/CD scan failed due to high severity vulnerabilities', {
          count: highSeverityVulns
        });
      }

      if (cicdConfig.baseline_comparison && cicdConfig.fail_on_new_vulnerabilities) {
        const baseline = this.scanBaselines.get('main');
        if (baseline) {
          const comparison = await this.compareWithBaseline(scanId, 'main');
          if (comparison.new_vulnerabilities.length > 0) {
            shouldFail = true;
            logger.warn('CI/CD scan failed due to new vulnerabilities', {
              count: comparison.new_vulnerabilities.length
            });
          }
        }
      }

      // Generate CI/CD report
      await this.generateCICDReport(scan, context, metadata);

      return !shouldFail;

    } catch (error) {
      logger.error('CI/CD security scan failed', { error: error.message });
      return false;
    }
  }

  private async generateCICDReport(scan: SecurityScan, context: string, metadata: any): Promise<void> {
    const report = {
      scan_id: scan.id,
      context,
      metadata,
      timestamp: new Date(),
      summary: scan.results.summary,
      vulnerabilities: scan.results.vulnerabilities,
      recommendations: scan.results.recommendations
    };

    const reportPath = path.join(
      process.cwd(), 
      'security-reports', 
      `cicd-${context}-${scan.id}.json`
    );

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    logger.info('CI/CD security report generated', { path: reportPath });
  }

  // Results Processing
  private async processScanResults(scan: SecurityScan): Promise<void> {
    logger.info('Processing scan results', { 
      scanId: scan.id, 
      vulnerabilities: scan.results.vulnerabilities.length 
    });

    // Check severity thresholds for notifications
    const criticalVulns = scan.results.vulnerabilities.filter(v => v.severity === 'critical');
    const highVulns = scan.results.vulnerabilities.filter(v => v.severity === 'high');

    if (criticalVulns.length > 0) {
      await this.sendCriticalAlert(scan, criticalVulns);
    }

    if (highVulns.length > 0) {
      await this.sendHighSeverityAlert(scan, highVulns);
    }

    // Integration processing
    await this.processIntegrations(scan);

    // Generate reports
    await this.generateReports(scan);

    // Update metrics
    this.updateSecurityMetrics(scan);
  }

  private async sendCriticalAlert(scan: SecurityScan, vulnerabilities: any[]): Promise<void> {
    const message = `Critical security vulnerabilities found in scan ${scan.id}:\n` +
      vulnerabilities.map(v => `- ${v.title} (${v.url})`).join('\n');

    await alerting.sendAlert({
      level: 'critical',
      message,
      metadata: {
        scan_id: scan.id,
        vulnerability_count: vulnerabilities.length,
        scan_type: scan.type
      }
    });

    logger.error('Critical security vulnerabilities detected', {
      scanId: scan.id,
      count: vulnerabilities.length
    });
  }

  private async sendHighSeverityAlert(scan: SecurityScan, vulnerabilities: any[]): Promise<void> {
    const message = `High severity security vulnerabilities found in scan ${scan.id}:\n` +
      vulnerabilities.map(v => `- ${v.title} (${v.url})`).join('\n');

    await alerting.sendAlert({
      level: 'warning',
      message,
      metadata: {
        scan_id: scan.id,
        vulnerability_count: vulnerabilities.length,
        scan_type: scan.type
      }
    });
  }

  private async processIntegrations(scan: SecurityScan): Promise<void> {
    const integrations = this.config.integration;

    // Jira integration
    if (integrations.jira.enabled) {
      await this.createJiraTickets(scan);
    }

    // Slack integration
    if (integrations.slack.enabled) {
      await this.sendSlackNotification(scan);
    }

    // GitHub integration
    if (integrations.github.enabled) {
      await this.createGitHubIssues(scan);
    }

    // SonarQube integration
    if (integrations.sonarqube.enabled) {
      await this.pushToSonarQube(scan);
    }
  }

  private async createJiraTickets(scan: SecurityScan): Promise<void> {
    const jiraConfig = this.config.integration.jira;
    
    for (const vuln of scan.results.vulnerabilities) {
      if (vuln.severity === 'critical' || vuln.severity === 'high') {
        // Implementation would create JIRA tickets
        logger.info('Would create JIRA ticket', { 
          vulnerability: vuln.title,
          severity: vuln.severity 
        });
      }
    }
  }

  private async sendSlackNotification(scan: SecurityScan): Promise<void> {
    const slackConfig = this.config.integration.slack;
    
    if (slackConfig.notify_on_high_severity) {
      const highSeverityCount = scan.results.vulnerabilities.filter(
        v => v.severity === 'high' || v.severity === 'critical'
      ).length;

      if (highSeverityCount > 0) {
        // Implementation would send Slack notification
        logger.info('Would send Slack notification', { 
          count: highSeverityCount 
        });
      }
    }
  }

  private async createGitHubIssues(scan: SecurityScan): Promise<void> {
    const githubConfig = this.config.integration.github;
    
    if (githubConfig.create_issues) {
      // Implementation would create GitHub issues
      logger.info('Would create GitHub issues', { 
        vulnerabilities: scan.results.vulnerabilities.length 
      });
    }
  }

  private async pushToSonarQube(scan: SecurityScan): Promise<void> {
    const sonarConfig = this.config.integration.sonarqube;
    
    if (sonarConfig.push_results) {
      // Implementation would push to SonarQube
      logger.info('Would push results to SonarQube', { 
        scanId: scan.id 
      });
    }
  }

  private async generateReports(scan: SecurityScan): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'security-reports');
    await fs.mkdir(reportsDir, { recursive: true });

    // JSON report
    const jsonReport: ScanReport = {
      id: `${scan.id}-json`,
      scan_id: scan.id,
      type: 'vulnerability',
      generated_at: new Date(),
      format: 'json',
      content: scan.results,
      file_path: path.join(reportsDir, `scan-${scan.id}.json`)
    };

    await fs.writeFile(jsonReport.file_path!, JSON.stringify(scan.results, null, 2));

    // HTML report
    const htmlReport = await this.generateHTMLReport(scan);
    const htmlPath = path.join(reportsDir, `scan-${scan.id}.html`);
    await fs.writeFile(htmlPath, htmlReport);

    logger.info('Security reports generated', { 
      scanId: scan.id,
      reports: ['json', 'html']
    });
  }

  private async generateHTMLReport(scan: SecurityScan): Promise<string> {
    // Basic HTML report template
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Security Scan Report - ${scan.id}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
            .vulnerability { border: 1px solid #ddd; margin: 10px 0; padding: 15px; }
            .critical { border-left: 5px solid #d32f2f; }
            .high { border-left: 5px solid #f57c00; }
            .medium { border-left: 5px solid #fbc02d; }
            .low { border-left: 5px solid #388e3c; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Security Scan Report</h1>
            <p><strong>Scan ID:</strong> ${scan.id}</p>
            <p><strong>Type:</strong> ${scan.type}</p>
            <p><strong>Started:</strong> ${scan.started_at.toISOString()}</p>
            <p><strong>Completed:</strong> ${scan.completed_at?.toISOString()}</p>
            <p><strong>Vulnerabilities Found:</strong> ${scan.results.vulnerabilities.length}</p>
            <p><strong>Risk Score:</strong> ${scan.results.summary.risk_score}</p>
        </div>

        <h2>Vulnerabilities</h2>
        ${scan.results.vulnerabilities.map(vuln => `
            <div class="vulnerability ${vuln.severity}">
                <h3>${vuln.title}</h3>
                <p><strong>Severity:</strong> ${vuln.severity.toUpperCase()}</p>
                <p><strong>URL:</strong> ${vuln.url}</p>
                <p><strong>Description:</strong> ${vuln.description}</p>
                <p><strong>Remediation:</strong> ${vuln.remediation}</p>
            </div>
        `).join('')}

        <h2>Recommendations</h2>
        ${scan.results.recommendations.map(rec => `
            <div class="vulnerability">
                <h4>${rec.title}</h4>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p><strong>Description:</strong> ${rec.description}</p>
                <p><strong>Implementation:</strong> ${rec.implementation}</p>
            </div>
        `).join('')}
    </body>
    </html>
    `;
  }

  private updateSecurityMetrics(scan: SecurityScan): void {
    metrics.setGauge('security_vulnerabilities_total', scan.results.vulnerabilities.length);
    metrics.setGauge('security_risk_score', scan.results.summary.risk_score);
    
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    scan.results.vulnerabilities.forEach(vuln => {
      severityCounts[vuln.severity]++;
    });

    Object.entries(severityCounts).forEach(([severity, count]) => {
      metrics.setGauge(`security_vulnerabilities_${severity}`, count);
    });
  }

  private async handleScanFailure(scan: SecurityScan, error: any): Promise<void> {
    logger.error('Security scan failed', { 
      scanId: scan.id, 
      error: error.message 
    });

    await alerting.sendAlert({
      level: 'warning',
      message: `Security scan ${scan.id} failed: ${error.message}`,
      metadata: { scan_id: scan.id, scan_type: scan.type }
    });
  }

  // Continuous Monitoring
  private async startContinuousMonitoring(): Promise<void> {
    if (this.activeMonitoring) return;

    this.activeMonitoring = true;
    logger.info('Starting continuous security monitoring');

    // Implementation would set up real-time monitoring
    // This could include:
    // - File system monitoring for configuration changes
    // - Network traffic analysis
    // - Log analysis for security events
    // - Behavioral anomaly detection
  }

  private async stopContinuousMonitoring(): Promise<void> {
    this.activeMonitoring = false;
    logger.info('Stopping continuous security monitoring');
  }

  // Utility methods
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Public API
  async runAdHocScan(
    name: string,
    scanType: SecurityScanType,
    target: SecurityTarget,
    config?: Partial<ScanConfiguration>
  ): Promise<string> {
    const defaultConfig: ScanConfiguration = {
      scan_types: [scanType],
      depth: 'medium',
      rate_limiting: {
        requests_per_second: 5,
        concurrent_requests: 2,
        delay_between_requests: 200
      }
    };

    const scanConfig = { ...defaultConfig, ...config };
    
    return await this.scanner.startScan(name, scanType, target, scanConfig);
  }

  getActiveScans(): SecurityScan[] {
    return this.scanner.getActiveScans();
  }

  getScanHistory(): SecurityScan[] {
    return this.scanner.getScanHistory();
  }

  async updateConfig(newConfig: Partial<SecurityAutomationConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduled jobs if needed
    if (newConfig.scan_schedule) {
      await this.stopScheduledScans();
      await this.setupScheduledScans();
    }
  }

  private async stopScheduledScans(): Promise<void> {
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      logger.info('Stopped scheduled scan', { name });
    }
    this.scheduledJobs.clear();
  }

  async cleanup(): Promise<void> {
    await this.stopScheduledScans();
    await this.stopContinuousMonitoring();
    await this.scanner.cleanup();
    this.removeAllListeners();
    logger.info('Security automation cleaned up');
  }
}