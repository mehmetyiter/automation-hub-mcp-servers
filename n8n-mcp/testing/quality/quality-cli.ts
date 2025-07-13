#!/usr/bin/env ts-node

import { Command } from 'commander';
import { QualityMetricsCollector } from './quality-metrics';
import { QualityReportGenerator } from './quality-reporting';
import { LoggingService } from '../../src/observability/logging';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = LoggingService.getInstance();

class QualityCLI {
  private metricsCollector: QualityMetricsCollector;
  private reportGenerator: QualityReportGenerator;
  private program: Command;

  constructor() {
    this.metricsCollector = new QualityMetricsCollector();
    this.reportGenerator = new QualityReportGenerator();
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('quality')
      .description('Quality Metrics and Reporting CLI for n8n-MCP')
      .version('1.0.0');

    // Initialize command
    this.program
      .command('init')
      .description('Initialize quality metrics collection')
      .option('-i, --interval <minutes>', 'Collection interval in minutes', parseInt, 60)
      .action(async (options) => {
        try {
          await this.metricsCollector.startCollection(options.interval);
          console.log(`✅ Quality metrics collection started (interval: ${options.interval} minutes)`);
        } catch (error) {
          console.error('❌ Failed to initialize:', error.message);
          process.exit(1);
        }
      });

    // Metrics commands
    const metricsCmd = this.program
      .command('metrics')
      .description('Quality metrics commands');

    metricsCmd
      .command('collect')
      .description('Collect current quality metrics')
      .option('-s, --source <source>', 'Source type (automated|manual|continuous)', 'manual')
      .option('-t, --trigger <trigger>', 'Trigger description', 'manual_collection')
      .option('-e, --environment <env>', 'Environment name', process.env.NODE_ENV || 'development')
      .action(async (options) => {
        try {
          const metrics = await this.metricsCollector.collectMetrics({
            type: options.source as any,
            trigger: options.trigger,
            environment: options.environment
          });

          console.log('✅ Quality metrics collected successfully');
          console.log(`📊 Overall Score: ${metrics.overall_score.toFixed(1)}/100`);
          console.log(`🧪 Test Coverage: ${metrics.test_coverage.line_coverage.toFixed(1)}%`);
          console.log(`🔒 Security Score: ${metrics.security.vulnerability_score.toFixed(1)}/100`);
          console.log(`⚡ Performance Score: ${metrics.performance.efficiency.resource_efficiency.toFixed(1)}/100`);
          console.log(`🛠️ Maintainability: ${metrics.maintainability.maintainability_index.toFixed(1)}/100`);
        } catch (error) {
          console.error('❌ Failed to collect metrics:', error.message);
        }
      });

    metricsCmd
      .command('current')
      .description('Show current quality metrics')
      .option('-d, --detailed', 'Show detailed metrics breakdown')
      .action(async (options) => {
        try {
          const current = this.metricsCollector.getCurrentMetrics();
          
          if (!current) {
            console.log('No current metrics available. Run "quality metrics collect" first.');
            return;
          }

          console.log('\n📊 Current Quality Metrics:');
          console.log(`  Overall Score: ${current.overall_score.toFixed(1)}/100`);
          console.log(`  Collected: ${current.timestamp.toISOString()}`);
          console.log(`  Environment: ${current.source.environment}`);
          console.log(`  Version: ${current.source.version}`);

          if (options.detailed) {
            console.log('\n🧪 Test Coverage:');
            console.log(`  Line Coverage: ${current.test_coverage.line_coverage.toFixed(1)}%`);
            console.log(`  Branch Coverage: ${current.test_coverage.branch_coverage.toFixed(1)}%`);
            console.log(`  Function Coverage: ${current.test_coverage.function_coverage.toFixed(1)}%`);
            console.log(`  Test Cases: ${current.test_coverage.test_cases}`);
            console.log(`  Passing Tests: ${current.test_coverage.passing_tests}`);
            console.log(`  Failing Tests: ${current.test_coverage.failing_tests}`);

            console.log('\n💻 Code Quality:');
            console.log(`  Maintainability Index: ${current.code_quality.maintainability_index.toFixed(1)}`);
            console.log(`  Cyclomatic Complexity: ${current.code_quality.complexity.cyclomatic_complexity.toFixed(1)}`);
            console.log(`  Technical Debt: ${Math.round(current.code_quality.technical_debt.total_debt_minutes / 60)}h ${current.code_quality.technical_debt.total_debt_minutes % 60}m`);
            console.log(`  Code Smells: ${current.code_quality.code_smells.total_smells}`);
            console.log(`  Duplication Ratio: ${current.code_quality.duplication.duplication_ratio.toFixed(1)}%`);

            console.log('\n⚡ Performance:');
            console.log(`  P95 Response Time: ${current.performance.response_times.p95.toFixed(0)}ms`);
            console.log(`  P99 Response Time: ${current.performance.response_times.p99.toFixed(0)}ms`);
            console.log(`  Throughput: ${current.performance.throughput.requests_per_second.toFixed(0)} RPS`);
            console.log(`  CPU Usage: ${current.performance.resource_usage.cpu_usage.current.toFixed(1)}%`);
            console.log(`  Memory Usage: ${current.performance.resource_usage.memory_usage.current.toFixed(0)}MB`);

            console.log('\n🔒 Security:');
            console.log(`  Vulnerability Score: ${current.security.vulnerability_score.toFixed(1)}/100`);
            console.log(`  Security Rating: ${current.security.security_rating}`);
            console.log(`  Critical Vulnerabilities: ${current.security.vulnerabilities.critical}`);
            console.log(`  High Vulnerabilities: ${current.security.vulnerabilities.high}`);
            console.log(`  Medium Vulnerabilities: ${current.security.vulnerabilities.medium}`);
            console.log(`  Low Vulnerabilities: ${current.security.vulnerabilities.low}`);

            console.log('\n🔧 Reliability:');
            console.log(`  Uptime: ${current.reliability.uptime.toFixed(2)}%`);
            console.log(`  Availability: ${current.reliability.availability.toFixed(2)}%`);
            console.log(`  MTBF: ${current.reliability.mtbf.toFixed(0)} hours`);
            console.log(`  MTTR: ${current.reliability.mttr.toFixed(0)} minutes`);
            console.log(`  Error Rate: ${current.reliability.error_rate.toFixed(2)}%`);

            console.log('\n🛠️ Maintainability:');
            console.log(`  Maintainability Index: ${current.maintainability.maintainability_index.toFixed(1)}`);
            console.log(`  Change Frequency: ${current.maintainability.change_frequency.toFixed(1)} changes/week`);
            console.log(`  Time to Change: ${current.maintainability.time_to_change.toFixed(1)} hours`);
            console.log(`  Rollback Frequency: ${(current.maintainability.rollback_frequency * 100).toFixed(1)}%`);
            console.log(`  Hotspots: ${current.maintainability.hotspot_analysis.length}`);
          }

        } catch (error) {
          console.error('❌ Failed to get current metrics:', error.message);
        }
      });

    metricsCmd
      .command('history')
      .description('Show metrics history')
      .option('-l, --limit <limit>', 'Number of entries to show', parseInt, 10)
      .option('-f, --format <format>', 'Output format (table|json|csv)', 'table')
      .option('--start <date>', 'Start date (YYYY-MM-DD)')
      .option('--end <date>', 'End date (YYYY-MM-DD)')
      .action(async (options) => {
        try {
          let history = this.metricsCollector.getMetricsHistory();

          // Filter by date range if provided
          if (options.start || options.end) {
            const startDate = options.start ? new Date(options.start) : new Date(0);
            const endDate = options.end ? new Date(options.end) : new Date();
            history = this.metricsCollector.getMetricsByTimeRange(startDate, endDate);
          }

          // Limit results
          const limitedHistory = history.slice(-options.limit);

          if (limitedHistory.length === 0) {
            console.log('No metrics history available');
            return;
          }

          switch (options.format) {
            case 'table':
              console.table(limitedHistory.map(m => ({
                Timestamp: m.timestamp.toISOString().split('T')[0],
                'Overall Score': m.overall_score.toFixed(1),
                'Test Coverage': `${m.test_coverage.line_coverage.toFixed(1)}%`,
                'Security Score': m.security.vulnerability_score.toFixed(1),
                'Performance': m.performance.efficiency.resource_efficiency.toFixed(1),
                'Reliability': `${m.reliability.uptime.toFixed(2)}%`,
                Environment: m.source.environment
              })));
              break;

            case 'json':
              console.log(JSON.stringify(limitedHistory, null, 2));
              break;

            case 'csv':
              const csv = await this.metricsCollector.exportMetrics('csv', '');
              console.log(csv);
              break;
          }
        } catch (error) {
          console.error('❌ Failed to get metrics history:', error.message);
        }
      });

    metricsCmd
      .command('export')
      .description('Export metrics to file')
      .requiredOption('-o, --output <file>', 'Output file path')
      .option('-f, --format <format>', 'Export format (json|csv)', 'json')
      .action(async (options) => {
        try {
          await this.metricsCollector.exportMetrics(options.format, options.output);
          console.log(`✅ Metrics exported to ${options.output} in ${options.format} format`);
        } catch (error) {
          console.error('❌ Failed to export metrics:', error.message);
        }
      });

    // Report commands
    const reportCmd = this.program
      .command('report')
      .description('Quality reporting commands');

    reportCmd
      .command('generate')
      .description('Generate quality report')
      .option('-t, --template <template>', 'Report template (executive|technical)', 'executive')
      .option('-d, --days <days>', 'Number of days to include', parseInt, 30)
      .option('-f, --format <format>', 'Output format (html|pdf|json)', 'html')
      .option('-o, --output <file>', 'Output file path')
      .action(async (options) => {
        try {
          // Get metrics for the specified period
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - options.days * 24 * 60 * 60 * 1000);
          const metrics = this.metricsCollector.getMetricsByTimeRange(startDate, endDate);

          if (metrics.length === 0) {
            console.log('No metrics available for the specified period');
            return;
          }

          // Generate report
          const report = await this.reportGenerator.generateReport(
            metrics,
            options.template
          );

          console.log(`📋 Report generated: ${report.id}`);
          console.log(`📊 Overall Score: ${report.summary.overall_score.toFixed(1)}/100`);
          console.log(`📈 Score Change: ${report.summary.score_change >= 0 ? '+' : ''}${report.summary.score_change.toFixed(1)}`);
          console.log(`💡 Recommendations: ${report.recommendations.length}`);
          console.log(`📝 Action Items: ${report.action_items.length}`);

          // Export if output path specified
          if (options.output) {
            await this.exportReport(report, options.template, options.format, options.output);
            console.log(`💾 Report saved to: ${options.output}`);
          }

        } catch (error) {
          console.error('❌ Failed to generate report:', error.message);
        }
      });

    reportCmd
      .command('list')
      .description('List generated reports')
      .option('-l, --limit <limit>', 'Number of reports to show', parseInt, 10)
      .action(async (options) => {
        try {
          const reports = this.reportGenerator.getReportHistory().slice(-options.limit);

          if (reports.length === 0) {
            console.log('No reports available');
            return;
          }

          console.table(reports.map(report => ({
            ID: report.id.substring(0, 12),
            Generated: report.generated_at.toISOString().split('T')[0],
            'Overall Score': report.summary.overall_score.toFixed(1),
            'Score Change': `${report.summary.score_change >= 0 ? '+' : ''}${report.summary.score_change.toFixed(1)}`,
            Recommendations: report.recommendations.length,
            'Action Items': report.action_items.length,
            'Metrics Count': report.metrics.length
          })));
        } catch (error) {
          console.error('❌ Failed to list reports:', error.message);
        }
      });

    reportCmd
      .command('show <reportId>')
      .description('Show detailed report information')
      .option('-s, --section <section>', 'Show specific section (summary|recommendations|actions|trends)')
      .action(async (reportId, options) => {
        try {
          const report = this.reportGenerator.getReport(reportId);
          
          if (!report) {
            console.error(`❌ Report ${reportId} not found`);
            return;
          }

          if (!options.section || options.section === 'summary') {
            console.log('\n📋 Report Summary:');
            console.log(`  ID: ${report.id}`);
            console.log(`  Generated: ${report.generated_at.toISOString()}`);
            console.log(`  Period: ${report.period.start.toDateString()} - ${report.period.end.toDateString()}`);
            console.log(`  Overall Score: ${report.summary.overall_score.toFixed(1)}/100`);
            console.log(`  Score Change: ${report.summary.score_change >= 0 ? '+' : ''}${report.summary.score_change.toFixed(1)}`);
            
            if (report.summary.achievements.length > 0) {
              console.log('\n🏆 Achievements:');
              report.summary.achievements.forEach(achievement => {
                console.log(`  • ${achievement}`);
              });
            }

            if (report.summary.key_improvements.length > 0) {
              console.log('\n✅ Key Improvements:');
              report.summary.key_improvements.forEach(improvement => {
                console.log(`  • ${improvement}`);
              });
            }

            if (report.summary.key_regressions.length > 0) {
              console.log('\n⚠️ Key Regressions:');
              report.summary.key_regressions.forEach(regression => {
                console.log(`  • ${regression}`);
              });
            }

            if (report.summary.critical_issues.length > 0) {
              console.log('\n🚨 Critical Issues:');
              report.summary.critical_issues.forEach(issue => {
                console.log(`  • ${issue}`);
              });
            }
          }

          if (!options.section || options.section === 'recommendations') {
            console.log('\n💡 Recommendations:');
            report.recommendations.forEach((rec, index) => {
              console.log(`\n  ${index + 1}. ${rec.title}`);
              console.log(`     Priority: ${rec.priority.toUpperCase()}`);
              console.log(`     Category: ${rec.category}`);
              console.log(`     Effort: ${rec.effort}`);
              console.log(`     Description: ${rec.description}`);
              console.log(`     Timeline: ${rec.timeline}`);
            });
          }

          if (!options.section || options.section === 'actions') {
            console.log('\n📝 Action Items:');
            report.action_items.forEach((item, index) => {
              console.log(`\n  ${index + 1}. ${item.title}`);
              console.log(`     Priority: ${item.priority.toUpperCase()}`);
              console.log(`     Category: ${item.category}`);
              console.log(`     Status: ${item.status.replace('_', ' ')}`);
              console.log(`     Due Date: ${item.due_date?.toDateString() || 'Not set'}`);
              console.log(`     Description: ${item.description}`);
            });
          }

          if (!options.section || options.section === 'trends') {
            console.log('\n📈 Trend Analysis:');
            console.log(`  Overall Trend: ${report.trends.overall_trend.direction} (${report.trends.overall_trend.confidence.toFixed(1)}% confidence)`);
            console.log(`  Test Coverage: ${report.trends.test_coverage_trend.direction}`);
            console.log(`  Code Quality: ${report.trends.code_quality_trend.direction}`);
            console.log(`  Performance: ${report.trends.performance_trend.direction}`);
            console.log(`  Security: ${report.trends.security_trend.direction}`);
            console.log(`  Reliability: ${report.trends.reliability_trend.direction}`);

            console.log('\n🔮 Prediction (30 days):');
            console.log(`  Predicted Score: ${report.trends.prediction.predicted_score.toFixed(1)}`);
            console.log(`  Confidence Interval: ${report.trends.prediction.confidence_interval[0].toFixed(1)} - ${report.trends.prediction.confidence_interval[1].toFixed(1)}`);
          }

        } catch (error) {
          console.error('❌ Failed to show report:', error.message);
        }
      });

    // Analysis commands
    const analyzeCmd = this.program
      .command('analyze')
      .description('Quality analysis commands');

    analyzeCmd
      .command('trends')
      .description('Analyze quality trends')
      .option('-d, --days <days>', 'Number of days to analyze', parseInt, 30)
      .option('-m, --metric <metric>', 'Specific metric to analyze (overall|coverage|security|performance)')
      .action(async (options) => {
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - options.days * 24 * 60 * 60 * 1000);
          const metrics = this.metricsCollector.getMetricsByTimeRange(startDate, endDate);

          if (metrics.length < 3) {
            console.log('Not enough data for trend analysis (minimum 3 data points required)');
            return;
          }

          const metricValues = metrics.map(m => {
            switch (options.metric) {
              case 'coverage': return m.test_coverage.line_coverage;
              case 'security': return m.security.vulnerability_score;
              case 'performance': return m.performance.efficiency.resource_efficiency;
              default: return m.overall_score;
            }
          });

          const trendDirection = this.calculateTrendDirection(metricValues);
          const trendStrength = this.calculateTrendStrength(metricValues);

          console.log(`\n📈 Trend Analysis (${options.days} days):`);
          console.log(`  Metric: ${options.metric || 'overall'}`);
          console.log(`  Direction: ${trendDirection}`);
          console.log(`  Strength: ${trendStrength.toFixed(2)}`);
          console.log(`  Data Points: ${metricValues.length}`);
          console.log(`  Current Value: ${metricValues[metricValues.length - 1].toFixed(1)}`);
          console.log(`  Previous Value: ${metricValues[metricValues.length - 2].toFixed(1)}`);
          console.log(`  Change: ${(metricValues[metricValues.length - 1] - metricValues[metricValues.length - 2]).toFixed(1)}`);

        } catch (error) {
          console.error('❌ Failed to analyze trends:', error.message);
        }
      });

    analyzeCmd
      .command('compare')
      .description('Compare metrics between time periods')
      .option('--period1-start <date>', 'Period 1 start date (YYYY-MM-DD)')
      .option('--period1-end <date>', 'Period 1 end date (YYYY-MM-DD)')
      .option('--period2-start <date>', 'Period 2 start date (YYYY-MM-DD)')
      .option('--period2-end <date>', 'Period 2 end date (YYYY-MM-DD)')
      .action(async (options) => {
        try {
          if (!options.period1Start || !options.period1End || !options.period2Start || !options.period2End) {
            console.error('❌ All period dates must be specified');
            return;
          }

          const period1Metrics = this.metricsCollector.getMetricsByTimeRange(
            new Date(options.period1Start),
            new Date(options.period1End)
          );

          const period2Metrics = this.metricsCollector.getMetricsByTimeRange(
            new Date(options.period2Start),
            new Date(options.period2End)
          );

          if (period1Metrics.length === 0 || period2Metrics.length === 0) {
            console.log('No metrics available for one or both periods');
            return;
          }

          const avg1 = this.calculateAverageMetrics(period1Metrics);
          const avg2 = this.calculateAverageMetrics(period2Metrics);

          console.log('\n📊 Period Comparison:');
          console.log(`  Period 1: ${options.period1Start} to ${options.period1End} (${period1Metrics.length} data points)`);
          console.log(`  Period 2: ${options.period2Start} to ${options.period2End} (${period2Metrics.length} data points)`);
          
          console.log('\n📈 Average Metrics:');
          console.log(`  Overall Score: ${avg1.overall.toFixed(1)} → ${avg2.overall.toFixed(1)} (${(avg2.overall - avg1.overall >= 0 ? '+' : '')}${(avg2.overall - avg1.overall).toFixed(1)})`);
          console.log(`  Test Coverage: ${avg1.coverage.toFixed(1)}% → ${avg2.coverage.toFixed(1)}% (${(avg2.coverage - avg1.coverage >= 0 ? '+' : '')}${(avg2.coverage - avg1.coverage).toFixed(1)}%)`);
          console.log(`  Security Score: ${avg1.security.toFixed(1)} → ${avg2.security.toFixed(1)} (${(avg2.security - avg1.security >= 0 ? '+' : '')}${(avg2.security - avg1.security).toFixed(1)})`);
          console.log(`  Performance: ${avg1.performance.toFixed(1)} → ${avg2.performance.toFixed(1)} (${(avg2.performance - avg1.performance >= 0 ? '+' : '')}${(avg2.performance - avg1.performance).toFixed(1)})`);
          console.log(`  Reliability: ${avg1.reliability.toFixed(1)}% → ${avg2.reliability.toFixed(1)}% (${(avg2.reliability - avg1.reliability >= 0 ? '+' : '')}${(avg2.reliability - avg1.reliability).toFixed(1)}%)`);

        } catch (error) {
          console.error('❌ Failed to compare periods:', error.message);
        }
      });

    // Dashboard command
    this.program
      .command('dashboard')
      .description('Launch quality metrics dashboard')
      .option('-p, --port <port>', 'Dashboard port', parseInt, 3001)
      .option('-r, --refresh <seconds>', 'Auto-refresh interval in seconds', parseInt, 30)
      .action(async (options) => {
        console.log('🚀 Quality dashboard feature coming soon!');
        console.log(`Would launch on port ${options.port} with ${options.refresh}s refresh interval`);
      });

    // Cleanup command
    this.program
      .command('cleanup')
      .description('Cleanup quality metrics and reports')
      .action(async () => {
        try {
          await this.metricsCollector.cleanup();
          await this.reportGenerator.cleanup();
          console.log('✅ Cleanup completed');
        } catch (error) {
          console.error('❌ Cleanup failed:', error.message);
        }
      });
  }

  // Helper methods
  private async exportReport(report: any, template: string, format: string, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    switch (format) {
      case 'html':
        const htmlContent = await this.reportGenerator.generateHTMLReport(
          report,
          this.reportGenerator.getTemplates().find(t => t.name === template)!
        );
        await fs.writeFile(outputPath, htmlContent);
        break;

      case 'json':
        const jsonContent = await this.reportGenerator.exportReportData(report, 'json');
        await fs.writeFile(outputPath, jsonContent);
        break;

      case 'pdf':
        console.log('PDF export coming soon!');
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private calculateTrendDirection(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (change > 2) return 'improving';
    if (change < -2) return 'declining';
    return 'stable';
  }

  private calculateTrendStrength(values: number[]): number {
    if (values.length < 3) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return Math.abs(slope);
  }

  private calculateAverageMetrics(metrics: any[]): any {
    const avg = {
      overall: 0,
      coverage: 0,
      security: 0,
      performance: 0,
      reliability: 0
    };

    metrics.forEach(m => {
      avg.overall += m.overall_score;
      avg.coverage += m.test_coverage.line_coverage;
      avg.security += m.security.vulnerability_score;
      avg.performance += m.performance.efficiency.resource_efficiency;
      avg.reliability += m.reliability.uptime;
    });

    const count = metrics.length;
    return {
      overall: avg.overall / count,
      coverage: avg.coverage / count,
      security: avg.security / count,
      performance: avg.performance / count,
      reliability: avg.reliability / count
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
  const cli = new QualityCLI();
  cli.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { QualityCLI };