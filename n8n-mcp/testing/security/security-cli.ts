#!/usr/bin/env ts-node

import { Command } from 'commander';
import { SecurityScanner, SecurityScanType, SecurityTarget, ScanConfiguration } from './security-scanner';
import { SecurityAutomation, SecurityAutomationConfig } from './security-automation';
import { LoggingService } from '../../src/observability/logging';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = LoggingService.getInstance();

class SecurityCLI {
  private scanner: SecurityScanner;
  private automation: SecurityAutomation | null = null;
  private program: Command;

  constructor() {
    this.scanner = new SecurityScanner();
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('security')
      .description('Security Testing CLI for n8n-MCP')
      .version('1.0.0');

    // Initialize command
    this.program
      .command('init')
      .description('Initialize security testing framework')
      .option('-c, --config <file>', 'Configuration file path')
      .action(async (options) => {
        try {
          if (options.config) {
            const configData = await fs.readFile(options.config, 'utf-8');
            const config = JSON.parse(configData);
            this.automation = new SecurityAutomation(config);
            await this.automation.initialize();
            console.log('✅ Security automation initialized with config');
          } else {
            console.log('✅ Security scanner initialized');
          }
        } catch (error) {
          console.error('❌ Failed to initialize:', error.message);
          process.exit(1);
        }
      });

    // Scan commands
    const scanCmd = this.program
      .command('scan')
      .description('Security scanning commands');

    scanCmd
      .command('start')
      .description('Start a security scan')
      .requiredOption('-n, --name <name>', 'Scan name')
      .requiredOption('-t, --type <type>', 'Scan type')
      .requiredOption('-u, --url <url>', 'Target URL')
      .option('-d, --depth <depth>', 'Scan depth (surface|medium|deep)', 'medium')
      .option('-r, --rate <rate>', 'Requests per second', parseInt, 5)
      .option('--auth-type <type>', 'Authentication type')
      .option('--auth-creds <creds>', 'Authentication credentials (JSON)')
      .action(async (options) => {
        try {
          const target: SecurityTarget = {
            type: 'web_application',
            endpoints: [options.url]
          };

          if (options.authCreds) {
            target.credentials = JSON.parse(options.authCreds);
          }

          const config: ScanConfiguration = {
            scan_types: [options.type as SecurityScanType],
            depth: options.depth,
            rate_limiting: {
              requests_per_second: options.rate,
              concurrent_requests: Math.max(1, Math.floor(options.rate / 2)),
              delay_between_requests: Math.floor(1000 / options.rate)
            }
          };

          if (options.authType && options.authCreds) {
            config.authentication = {
              method: options.authType,
              credentials: JSON.parse(options.authCreds)
            };
          }

          const scanId = await this.scanner.startScan(
            options.name,
            options.type as SecurityScanType,
            target,
            config
          );

          console.log(`🚀 Security scan started`);
          console.log(`  Scan ID: ${scanId}`);
          console.log(`  Name: ${options.name}`);
          console.log(`  Type: ${options.type}`);
          console.log(`  Target: ${options.url}`);
          console.log('\nUse "security scan status <scanId>" to monitor progress');
        } catch (error) {
          console.error('❌ Failed to start scan:', error.message);
        }
      });

    scanCmd
      .command('status [scanId]')
      .description('Show scan status (all active if no ID provided)')
      .action(async (scanId) => {
        try {
          if (scanId) {
            const scan = this.scanner.getScan(scanId);
            if (!scan) {
              console.error(`❌ Scan ${scanId} not found`);
              return;
            }

            console.log('\n🔍 Scan Status:');
            console.log(`  ID: ${scan.id}`);
            console.log(`  Name: ${scan.name}`);
            console.log(`  Type: ${scan.type}`);
            console.log(`  Status: ${this.getStatusEmoji(scan.status)} ${scan.status}`);
            console.log(`  Started: ${scan.started_at.toISOString()}`);
            
            if (scan.completed_at) {
              const duration = scan.completed_at.getTime() - scan.started_at.getTime();
              console.log(`  Duration: ${Math.round(duration / 1000)}s`);
            }

            console.log('\n📊 Progress:');
            console.log(`  Requests: ${scan.results.summary.total_requests}`);
            console.log(`  Successful: ${scan.results.summary.successful_requests}`);
            console.log(`  Failed: ${scan.results.summary.failed_requests}`);
            console.log(`  Vulnerabilities: ${scan.results.vulnerabilities.length}`);

            if (scan.results.vulnerabilities.length > 0) {
              const severityCounts = this.countBySeverity(scan.results.vulnerabilities);
              console.log('\n🚨 Vulnerabilities by Severity:');
              Object.entries(severityCounts).forEach(([severity, count]) => {
                if (count > 0) {
                  console.log(`  ${severity}: ${count}`);
                }
              });
            }

            if (scan.status === 'completed') {
              console.log(`\n💯 Risk Score: ${scan.results.summary.risk_score}/100`);
            }
          } else {
            const activeScans = this.scanner.getActiveScans();
            
            if (activeScans.length === 0) {
              console.log('No active scans');
              return;
            }

            console.log('\n🏃 Active Scans:');
            console.table(activeScans.map(scan => ({
              ID: scan.id.substring(0, 8),
              Name: scan.name,
              Type: scan.type,
              Status: scan.status,
              Started: scan.started_at.toISOString().split('T')[1].split('.')[0],
              Requests: scan.results.summary.total_requests,
              Vulnerabilities: scan.results.vulnerabilities.length
            })));
          }
        } catch (error) {
          console.error('❌ Failed to get scan status:', error.message);
        }
      });

    scanCmd
      .command('list')
      .description('List all scans')
      .option('-l, --limit <limit>', 'Limit number of results', parseInt, 10)
      .option('-t, --type <type>', 'Filter by scan type')
      .option('-s, --status <status>', 'Filter by status')
      .action(async (options) => {
        try {
          let scans = this.scanner.getScanHistory();
          
          if (options.type) {
            scans = scans.filter(scan => scan.type === options.type);
          }
          
          if (options.status) {
            scans = scans.filter(scan => scan.status === options.status);
          }

          scans = scans.slice(-options.limit);

          if (scans.length === 0) {
            console.log('No scans found');
            return;
          }

          console.table(scans.map(scan => ({
            ID: scan.id.substring(0, 8),
            Name: scan.name,
            Type: scan.type,
            Status: scan.status,
            Started: scan.started_at.toISOString().split('T')[0],
            Vulnerabilities: scan.results.vulnerabilities.length,
            RiskScore: scan.results.summary.risk_score
          })));
        } catch (error) {
          console.error('❌ Failed to list scans:', error.message);
        }
      });

    scanCmd
      .command('cancel <scanId>')
      .description('Cancel a running scan')
      .action(async (scanId) => {
        try {
          await this.scanner.cancelScan(scanId);
          console.log(`🛑 Scan ${scanId} cancelled`);
        } catch (error) {
          console.error('❌ Failed to cancel scan:', error.message);
        }
      });

    // Report commands
    const reportCmd = this.program
      .command('report')
      .description('Generate security reports');

    reportCmd
      .command('vulnerabilities <scanId>')
      .description('Show detailed vulnerability report')
      .option('-s, --severity <severity>', 'Filter by severity')
      .option('-f, --format <format>', 'Output format (table|json|csv)', 'table')
      .action(async (scanId, options) => {
        try {
          const scan = this.scanner.getScan(scanId);
          if (!scan) {
            console.error(`❌ Scan ${scanId} not found`);
            return;
          }

          let vulnerabilities = scan.results.vulnerabilities;
          
          if (options.severity) {
            vulnerabilities = vulnerabilities.filter(v => v.severity === options.severity);
          }

          if (vulnerabilities.length === 0) {
            console.log('No vulnerabilities found');
            return;
          }

          switch (options.format) {
            case 'table':
              console.table(vulnerabilities.map(vuln => ({
                Type: vuln.type,
                Severity: vuln.severity.toUpperCase(),
                Title: vuln.title,
                URL: vuln.url,
                Parameter: vuln.parameter || '-'
              })));
              break;
            
            case 'json':
              console.log(JSON.stringify(vulnerabilities, null, 2));
              break;
            
            case 'csv':
              console.log('Type,Severity,Title,URL,Parameter,Description');
              vulnerabilities.forEach(vuln => {
                console.log([
                  vuln.type,
                  vuln.severity,
                  `"${vuln.title}"`,
                  vuln.url,
                  vuln.parameter || '',
                  `"${vuln.description}"`
                ].join(','));
              });
              break;
          }
        } catch (error) {
          console.error('❌ Failed to generate report:', error.message);
        }
      });

    reportCmd
      .command('summary <scanId>')
      .description('Show scan summary report')
      .action(async (scanId) => {
        try {
          const scan = this.scanner.getScan(scanId);
          if (!scan) {
            console.error(`❌ Scan ${scanId} not found`);
            return;
          }

          const summary = scan.results.summary;
          const severityCounts = this.countBySeverity(scan.results.vulnerabilities);

          console.log('\n📋 Scan Summary:');
          console.log(`  Scan ID: ${scan.id}`);
          console.log(`  Name: ${scan.name}`);
          console.log(`  Type: ${scan.type}`);
          console.log(`  Status: ${scan.status}`);
          console.log(`  Duration: ${Math.round(summary.scan_duration / 1000)}s`);
          
          console.log('\n📊 Statistics:');
          console.log(`  Total Requests: ${summary.total_requests}`);
          console.log(`  Successful: ${summary.successful_requests}`);
          console.log(`  Failed: ${summary.failed_requests}`);
          console.log(`  Success Rate: ${Math.round((summary.successful_requests / summary.total_requests) * 100)}%`);
          
          console.log('\n🚨 Vulnerabilities:');
          console.log(`  Total: ${summary.vulnerabilities_found}`);
          Object.entries(severityCounts).forEach(([severity, count]) => {
            if (count > 0) {
              console.log(`  ${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${count}`);
            }
          });
          
          console.log(`\n💯 Risk Score: ${summary.risk_score}/100`);
          
          if (scan.results.recommendations.length > 0) {
            console.log('\n💡 Top Recommendations:');
            scan.results.recommendations.slice(0, 3).forEach((rec, i) => {
              console.log(`  ${i + 1}. ${rec.title} (Priority: ${rec.priority})`);
            });
          }
        } catch (error) {
          console.error('❌ Failed to generate summary:', error.message);
        }
      });

    // Quick scan presets
    const presetCmd = this.program
      .command('preset')
      .description('Run predefined security scan presets');

    presetCmd
      .command('web-app <url>')
      .description('Comprehensive web application security scan')
      .option('-n, --name <name>', 'Scan name')
      .action(async (url, options) => {
        try {
          const name = options.name || `web-app-scan-${Date.now()}`;
          const scanId = await this.runWebAppPreset(name, url);
          console.log(`🚀 Web application security scan started: ${scanId}`);
        } catch (error) {
          console.error('❌ Failed to start web app scan:', error.message);
        }
      });

    presetCmd
      .command('api <url>')
      .description('API security scan')
      .option('-n, --name <name>', 'Scan name')
      .option('--auth <auth>', 'Authentication (JSON)')
      .action(async (url, options) => {
        try {
          const name = options.name || `api-scan-${Date.now()}`;
          const scanId = await this.runAPIPreset(name, url, options.auth);
          console.log(`🚀 API security scan started: ${scanId}`);
        } catch (error) {
          console.error('❌ Failed to start API scan:', error.message);
        }
      });

    presetCmd
      .command('headers <url>')
      .description('Security headers scan')
      .option('-n, --name <name>', 'Scan name')
      .action(async (url, options) => {
        try {
          const name = options.name || `headers-scan-${Date.now()}`;
          const scanId = await this.runHeadersPreset(name, url);
          console.log(`🚀 Security headers scan started: ${scanId}`);
        } catch (error) {
          console.error('❌ Failed to start headers scan:', error.message);
        }
      });

    // Automation commands (if automation is initialized)
    const autoCmd = this.program
      .command('auto')
      .description('Security automation commands');

    autoCmd
      .command('baseline <name>')
      .description('Create or run baseline scan')
      .option('-c, --create', 'Create new baseline')
      .action(async (name, options) => {
        if (!this.automation) {
          console.error('❌ Automation not initialized. Use --config option with init command');
          return;
        }

        try {
          if (options.create) {
            await this.automation.createBaseline(name);
            console.log(`✅ Baseline '${name}' created`);
          } else {
            // Run comparison with baseline
            console.log(`Running baseline comparison for '${name}'`);
          }
        } catch (error) {
          console.error('❌ Failed to process baseline:', error.message);
        }
      });

    autoCmd
      .command('cicd')
      .description('Run CI/CD security scan')
      .requiredOption('-c, --context <context>', 'Context (deploy|pr)')
      .option('-e, --endpoints <endpoints>', 'Endpoints to scan (comma-separated)')
      .option('-m, --metadata <metadata>', 'Metadata (JSON)')
      .action(async (options) => {
        if (!this.automation) {
          console.error('❌ Automation not initialized. Use --config option with init command');
          return;
        }

        try {
          const metadata = {
            endpoints: options.endpoints ? options.endpoints.split(',') : ['http://localhost:3000'],
            ...options.metadata ? JSON.parse(options.metadata) : {}
          };

          const passed = await this.automation.runCICDScan(options.context, metadata);
          
          if (passed) {
            console.log('✅ CI/CD security scan passed');
            process.exit(0);
          } else {
            console.log('❌ CI/CD security scan failed');
            process.exit(1);
          }
        } catch (error) {
          console.error('❌ CI/CD scan failed:', error.message);
          process.exit(1);
        }
      });

    // Configuration commands
    this.program
      .command('config')
      .description('Generate sample configuration file')
      .option('-o, --output <file>', 'Output file path', 'security-config.json')
      .action(async (options) => {
        try {
          const sampleConfig = this.generateSampleConfig();
          await fs.writeFile(options.output, JSON.stringify(sampleConfig, null, 2));
          console.log(`✅ Sample configuration written to ${options.output}`);
        } catch (error) {
          console.error('❌ Failed to generate config:', error.message);
        }
      });

    // Cleanup command
    this.program
      .command('cleanup')
      .description('Cleanup security scanner resources')
      .action(async () => {
        try {
          await this.scanner.cleanup();
          if (this.automation) {
            await this.automation.cleanup();
          }
          console.log('✅ Cleanup completed');
        } catch (error) {
          console.error('❌ Cleanup failed:', error.message);
        }
      });
  }

  // Preset scan implementations
  private async runWebAppPreset(name: string, url: string): Promise<string> {
    const target: SecurityTarget = {
      type: 'web_application',
      endpoints: [url]
    };

    const config: ScanConfiguration = {
      scan_types: [
        'vulnerability_scan',
        'sql_injection',
        'xss_scan',
        'security_headers',
        'sensitive_data_exposure'
      ],
      depth: 'medium',
      rate_limiting: {
        requests_per_second: 5,
        concurrent_requests: 3,
        delay_between_requests: 200
      }
    };

    return await this.scanner.startScan(name, 'vulnerability_scan', target, config);
  }

  private async runAPIPreset(name: string, url: string, auth?: string): Promise<string> {
    const target: SecurityTarget = {
      type: 'api',
      endpoints: [url]
    };

    if (auth) {
      target.credentials = JSON.parse(auth);
    }

    const config: ScanConfiguration = {
      scan_types: [
        'api_security_scan',
        'authentication_bypass',
        'authorization_scan',
        'sql_injection'
      ],
      depth: 'deep',
      rate_limiting: {
        requests_per_second: 10,
        concurrent_requests: 5,
        delay_between_requests: 100
      }
    };

    return await this.scanner.startScan(name, 'api_security_scan', target, config);
  }

  private async runHeadersPreset(name: string, url: string): Promise<string> {
    const target: SecurityTarget = {
      type: 'web_application',
      endpoints: [url]
    };

    const config: ScanConfiguration = {
      scan_types: ['security_headers'],
      depth: 'surface',
      rate_limiting: {
        requests_per_second: 1,
        concurrent_requests: 1,
        delay_between_requests: 1000
      }
    };

    return await this.scanner.startScan(name, 'security_headers', target, config);
  }

  // Helper methods
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      pending: '⏳',
      running: '🏃',
      completed: '✅',
      failed: '❌',
      cancelled: '🛑'
    };
    return emojis[status] || '❓';
  }

  private countBySeverity(vulnerabilities: any[]): Record<string, number> {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    vulnerabilities.forEach(vuln => {
      if (counts.hasOwnProperty(vuln.severity)) {
        counts[vuln.severity]++;
      }
    });
    return counts;
  }

  private generateSampleConfig(): SecurityAutomationConfig {
    return {
      enabled: true,
      scan_schedule: {
        daily_scans: {
          enabled: true,
          time: "02:00",
          scan_types: ["security_headers", "sensitive_data_exposure"],
          targets: ["http://localhost:3000"]
        },
        weekly_scans: {
          enabled: true,
          day: 1,
          time: "03:00",
          scan_types: ["vulnerability_scan", "sql_injection", "xss_scan"],
          targets: ["http://localhost:3000"]
        },
        monthly_scans: {
          enabled: true,
          day: 1,
          time: "04:00",
          scan_types: ["vulnerability_scan"],
          targets: ["http://localhost:3000"]
        },
        ci_cd_integration: {
          enabled: true,
          scan_on_deploy: true,
          scan_on_pr: true,
          fail_on_high_severity: true,
          fail_on_new_vulnerabilities: true,
          baseline_comparison: true
        }
      },
      baseline_scans: [
        {
          name: "main",
          target: {
            type: "web_application",
            endpoints: ["http://localhost:3000"]
          },
          scan_types: ["vulnerability_scan"],
          configuration: {
            scan_types: ["vulnerability_scan"],
            depth: "medium"
          },
          baseline_file: "./baselines/main-baseline.json"
        }
      ],
      continuous_monitoring: {
        enabled: false,
        real_time_monitoring: false,
        behavioral_analysis: false,
        anomaly_detection: false,
        threat_intelligence: false
      },
      integration: {
        jira: {
          enabled: false,
          url: "",
          username: "",
          api_token: "",
          project_key: "",
          create_tickets: false,
          severity_mapping: {
            "critical": "Highest",
            "high": "High",
            "medium": "Medium",
            "low": "Low"
          }
        },
        slack: {
          enabled: false,
          webhook_url: "",
          channel: "#security",
          notify_on_high_severity: true,
          notify_on_new_vulnerabilities: true
        },
        github: {
          enabled: false,
          token: "",
          repository: "",
          create_issues: false,
          create_security_advisories: false
        },
        sonarqube: {
          enabled: false,
          url: "",
          token: "",
          project_key: "",
          push_results: false
        }
      },
      notifications: {
        email: {
          enabled: false,
          smtp_host: "",
          smtp_port: 587,
          username: "",
          password: "",
          recipients: [],
          severity_threshold: "high"
        },
        sms: {
          enabled: false,
          provider: "twilio",
          api_key: "",
          phone_numbers: [],
          severity_threshold: "critical"
        },
        webhook: {
          enabled: false,
          urls: [],
          headers: {},
          severity_threshold: "high"
        }
      }
    };
  }

  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error('❌ CLI Error:', error.message);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const cli = new SecurityCLI();
  cli.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { SecurityCLI };