import { EventEmitter } from 'events';
import { QualityMetrics, QualityReport, QualitySummary, QualityRecommendation, TrendAnalysis, BenchmarkComparison, ActionItem, GapAnalysis, QualityPrediction } from './quality-metrics';
import { LoggingService } from '../../src/observability/logging';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import * as PDFDocument from 'pdfkit';

const logger = LoggingService.getInstance();

export interface ReportConfiguration {
  template: ReportTemplate;
  output_formats: OutputFormat[];
  schedule: ReportSchedule;
  distribution: ReportDistribution;
  customization: ReportCustomization;
}

export interface ReportTemplate {
  name: string;
  type: 'executive' | 'technical' | 'trend' | 'security' | 'performance' | 'custom';
  sections: ReportSection[];
  layout: ReportLayout;
  branding: BrandingConfig;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'metrics' | 'trends' | 'recommendations' | 'charts' | 'tables' | 'text';
  content_filter: ContentFilter;
  visualization: VisualizationConfig;
  priority: number;
}

export interface ContentFilter {
  metrics: string[];
  time_range: TimeRangeFilter;
  severity_filter: SeverityFilter;
  category_filter: string[];
}

export interface TimeRangeFilter {
  type: 'last_n_days' | 'last_n_weeks' | 'last_n_months' | 'custom';
  value: number;
  start_date?: Date;
  end_date?: Date;
}

export interface SeverityFilter {
  include: ('critical' | 'high' | 'medium' | 'low')[];
  exclude: ('critical' | 'high' | 'medium' | 'low')[];
}

export interface VisualizationConfig {
  chart_type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'table';
  colors: string[];
  dimensions: { width: number; height: number };
  options: Record<string, any>;
}

export interface ReportLayout {
  page_size: 'A4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header: HeaderConfig;
  footer: FooterConfig;
}

export interface HeaderConfig {
  show_logo: boolean;
  show_title: boolean;
  show_date: boolean;
  custom_text?: string;
}

export interface FooterConfig {
  show_page_numbers: boolean;
  show_generation_info: boolean;
  custom_text?: string;
}

export interface BrandingConfig {
  logo_path?: string;
  company_name: string;
  color_scheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
    monospace: string;
  };
}

export interface OutputFormat {
  type: 'pdf' | 'html' | 'json' | 'csv' | 'xlsx' | 'png' | 'svg';
  options: Record<string, any>;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string; // HH:MM format
  day_of_week?: number; // 0-6 for weekly
  day_of_month?: number; // 1-31 for monthly
  timezone: string;
}

export interface ReportDistribution {
  email: EmailDistribution;
  slack: SlackDistribution;
  jira: JiraDistribution;
  webhook: WebhookDistribution;
  file_storage: FileStorageDistribution;
}

export interface EmailDistribution {
  enabled: boolean;
  recipients: string[];
  subject_template: string;
  body_template: string;
  attach_files: boolean;
}

export interface SlackDistribution {
  enabled: boolean;
  channel: string;
  webhook_url: string;
  message_template: string;
  attach_files: boolean;
}

export interface JiraDistribution {
  enabled: boolean;
  project_key: string;
  issue_type: string;
  create_for_regressions: boolean;
  update_existing: boolean;
}

export interface WebhookDistribution {
  enabled: boolean;
  urls: string[];
  headers: Record<string, string>;
  payload_template: string;
}

export interface FileStorageDistribution {
  enabled: boolean;
  path: string;
  retention_days: number;
  archive_old_reports: boolean;
}

export interface ReportCustomization {
  include_executive_summary: boolean;
  include_recommendations: boolean;
  include_action_items: boolean;
  include_trends: boolean;
  include_benchmarks: boolean;
  include_raw_data: boolean;
  custom_sections: CustomSection[];
}

export interface CustomSection {
  title: string;
  content: string;
  position: 'top' | 'bottom' | number;
  format: 'markdown' | 'html' | 'text';
}

export class QualityReportGenerator extends EventEmitter {
  private reportHistory: QualityReport[] = [];
  private templates: Map<string, ReportTemplate> = new Map();
  private configurations: Map<string, ReportConfiguration> = new Map();

  constructor() {
    super();
    this.setupDefaultTemplates();
  }

  private setupDefaultTemplates(): void {
    // Executive Summary Template
    const executiveTemplate: ReportTemplate = {
      name: 'Executive Summary',
      type: 'executive',
      sections: [
        {
          id: 'summary',
          title: 'Quality Overview',
          type: 'summary',
          content_filter: {
            metrics: ['overall_score', 'test_coverage', 'security', 'reliability'],
            time_range: { type: 'last_n_days', value: 30 },
            severity_filter: { include: ['critical', 'high'], exclude: [] },
            category_filter: []
          },
          visualization: {
            chart_type: 'gauge',
            colors: ['#00C851', '#ffbb33', '#ff4444'],
            dimensions: { width: 400, height: 300 },
            options: {}
          },
          priority: 1
        },
        {
          id: 'trends',
          title: 'Quality Trends',
          type: 'trends',
          content_filter: {
            metrics: ['overall_score'],
            time_range: { type: 'last_n_weeks', value: 12 },
            severity_filter: { include: ['critical', 'high', 'medium', 'low'], exclude: [] },
            category_filter: []
          },
          visualization: {
            chart_type: 'line',
            colors: ['#007bff', '#28a745'],
            dimensions: { width: 800, height: 400 },
            options: { showTrendLine: true }
          },
          priority: 2
        },
        {
          id: 'recommendations',
          title: 'Key Recommendations',
          type: 'recommendations',
          content_filter: {
            metrics: [],
            time_range: { type: 'last_n_days', value: 7 },
            severity_filter: { include: ['critical', 'high'], exclude: [] },
            category_filter: []
          },
          visualization: {
            chart_type: 'table',
            colors: [],
            dimensions: { width: 800, height: 300 },
            options: { maxItems: 5 }
          },
          priority: 3
        }
      ],
      layout: {
        page_size: 'A4',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          show_logo: true,
          show_title: true,
          show_date: true
        },
        footer: {
          show_page_numbers: true,
          show_generation_info: true
        }
      },
      branding: {
        company_name: 'n8n-MCP Quality Assurance',
        color_scheme: {
          primary: '#007bff',
          secondary: '#6c757d',
          accent: '#28a745',
          background: '#ffffff',
          text: '#343a40'
        },
        fonts: {
          heading: 'Arial Bold',
          body: 'Arial',
          monospace: 'Courier New'
        }
      }
    };

    // Technical Report Template
    const technicalTemplate: ReportTemplate = {
      name: 'Technical Report',
      type: 'technical',
      sections: [
        {
          id: 'metrics_overview',
          title: 'Metrics Overview',
          type: 'metrics',
          content_filter: {
            metrics: ['test_coverage', 'code_quality', 'performance', 'security', 'reliability', 'maintainability'],
            time_range: { type: 'last_n_days', value: 7 },
            severity_filter: { include: ['critical', 'high', 'medium', 'low'], exclude: [] },
            category_filter: []
          },
          visualization: {
            chart_type: 'bar',
            colors: ['#007bff', '#28a745', '#ffc107', '#dc3545'],
            dimensions: { width: 800, height: 500 },
            options: {}
          },
          priority: 1
        },
        {
          id: 'code_quality_details',
          title: 'Code Quality Analysis',
          type: 'charts',
          content_filter: {
            metrics: ['complexity', 'technical_debt', 'code_smells', 'duplication'],
            time_range: { type: 'last_n_days', value: 30 },
            severity_filter: { include: ['critical', 'high', 'medium', 'low'], exclude: [] },
            category_filter: ['code_quality']
          },
          visualization: {
            chart_type: 'heatmap',
            colors: ['#00C851', '#ffbb33', '#ff4444'],
            dimensions: { width: 800, height: 400 },
            options: {}
          },
          priority: 2
        }
      ],
      layout: {
        page_size: 'A4',
        orientation: 'landscape',
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
        header: {
          show_logo: false,
          show_title: true,
          show_date: true
        },
        footer: {
          show_page_numbers: true,
          show_generation_info: true
        }
      },
      branding: {
        company_name: 'n8n-MCP Technical Analysis',
        color_scheme: {
          primary: '#343a40',
          secondary: '#6c757d',
          accent: '#007bff',
          background: '#f8f9fa',
          text: '#212529'
        },
        fonts: {
          heading: 'Arial Bold',
          body: 'Arial',
          monospace: 'Courier New'
        }
      }
    };

    this.templates.set('executive', executiveTemplate);
    this.templates.set('technical', technicalTemplate);
  }

  async generateReport(
    metrics: QualityMetrics[],
    templateName: string,
    customConfig?: Partial<ReportConfiguration>
  ): Promise<QualityReport> {
    logger.info('Generating quality report', { 
      templateName, 
      metricsCount: metrics.length 
    });

    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const report: QualityReport = {
      id: reportId,
      generated_at: new Date(),
      period: {
        start: new Date(Math.min(...metrics.map(m => m.timestamp.getTime()))),
        end: new Date(Math.max(...metrics.map(m => m.timestamp.getTime())))
      },
      metrics,
      summary: await this.generateSummary(metrics),
      recommendations: await this.generateRecommendations(metrics),
      trends: await this.generateTrendAnalysis(metrics),
      benchmarks: await this.generateBenchmarkComparison(metrics),
      action_items: await this.generateActionItems(metrics)
    };

    // Store report
    this.reportHistory.push(report);

    // Keep only last 100 reports
    if (this.reportHistory.length > 100) {
      this.reportHistory = this.reportHistory.slice(-100);
    }

    logger.info('Quality report generated', {
      reportId,
      overallScore: report.summary.overall_score,
      recommendationsCount: report.recommendations.length,
      actionItemsCount: report.action_items.length
    });

    this.emit('report_generated', report);

    return report;
  }

  private async generateSummary(metrics: QualityMetrics[]): Promise<QualitySummary> {
    if (metrics.length === 0) {
      return {
        overall_score: 0,
        previous_score: 0,
        score_change: 0,
        key_improvements: [],
        key_regressions: [],
        critical_issues: [],
        achievements: []
      };
    }

    const latest = metrics[metrics.length - 1];
    const previous = metrics.length > 1 ? metrics[metrics.length - 2] : latest;

    const scoreChange = latest.overall_score - previous.overall_score;

    const improvements: string[] = [];
    const regressions: string[] = [];
    const criticalIssues: string[] = [];
    const achievements: string[] = [];

    // Analyze test coverage improvements
    if (latest.test_coverage.line_coverage > previous.test_coverage.line_coverage + 5) {
      improvements.push(`Test coverage increased by ${(latest.test_coverage.line_coverage - previous.test_coverage.line_coverage).toFixed(1)}%`);
    } else if (latest.test_coverage.line_coverage < previous.test_coverage.line_coverage - 5) {
      regressions.push(`Test coverage decreased by ${(previous.test_coverage.line_coverage - latest.test_coverage.line_coverage).toFixed(1)}%`);
    }

    // Analyze security improvements
    if (latest.security.vulnerabilities.critical === 0 && previous.security.vulnerabilities.critical > 0) {
      achievements.push('All critical security vulnerabilities resolved');
    } else if (latest.security.vulnerabilities.critical > previous.security.vulnerabilities.critical) {
      criticalIssues.push(`New critical security vulnerabilities: ${latest.security.vulnerabilities.critical - previous.security.vulnerabilities.critical}`);
    }

    // Analyze performance
    if (latest.performance.response_times.p95 < previous.performance.response_times.p95 * 0.9) {
      improvements.push('Response time improved significantly');
    } else if (latest.performance.response_times.p95 > previous.performance.response_times.p95 * 1.2) {
      regressions.push('Response time degraded significantly');
    }

    // Check for achievements
    if (latest.test_coverage.line_coverage >= 90) {
      achievements.push('Achieved 90%+ test coverage');
    }
    if (latest.security.vulnerability_score >= 95) {
      achievements.push('Achieved excellent security score');
    }
    if (latest.reliability.uptime >= 99.9) {
      achievements.push('Achieved 99.9%+ uptime');
    }

    return {
      overall_score: latest.overall_score,
      previous_score: previous.overall_score,
      score_change: scoreChange,
      key_improvements: improvements,
      key_regressions: regressions,
      critical_issues: criticalIssues,
      achievements: achievements
    };
  }

  private async generateRecommendations(metrics: QualityMetrics[]): Promise<QualityRecommendation[]> {
    if (metrics.length === 0) return [];

    const latest = metrics[metrics.length - 1];
    const recommendations: QualityRecommendation[] = [];

    // Test coverage recommendations
    if (latest.test_coverage.line_coverage < 80) {
      recommendations.push({
        id: `rec-coverage-${Date.now()}`,
        category: 'Test Coverage',
        priority: 'high',
        title: 'Improve Test Coverage',
        description: `Current test coverage is ${latest.test_coverage.line_coverage.toFixed(1)}%, which is below the 80% target.`,
        impact: 'Improved test coverage will reduce bugs and increase confidence in releases.',
        effort: 'medium',
        implementation_steps: [
          'Identify uncovered code sections',
          'Write unit tests for critical functions',
          'Add integration tests for API endpoints',
          'Set up coverage reporting in CI/CD pipeline'
        ],
        success_criteria: [
          'Achieve 80%+ line coverage',
          'Achieve 70%+ branch coverage',
          'All new code has 90%+ coverage'
        ],
        timeline: '2-3 weeks'
      });
    }

    // Security recommendations
    if (latest.security.vulnerabilities.critical > 0 || latest.security.vulnerabilities.high > 5) {
      recommendations.push({
        id: `rec-security-${Date.now()}`,
        category: 'Security',
        priority: 'critical',
        title: 'Address Security Vulnerabilities',
        description: `Found ${latest.security.vulnerabilities.critical} critical and ${latest.security.vulnerabilities.high} high severity vulnerabilities.`,
        impact: 'Reducing security vulnerabilities prevents potential breaches and compliance issues.',
        effort: 'high',
        implementation_steps: [
          'Review and prioritize security findings',
          'Update vulnerable dependencies',
          'Fix code-level security issues',
          'Implement additional security controls'
        ],
        success_criteria: [
          'Zero critical vulnerabilities',
          'Less than 3 high severity vulnerabilities',
          'Security score above 90'
        ],
        timeline: '1-2 weeks'
      });
    }

    // Performance recommendations
    if (latest.performance.response_times.p95 > 1000) {
      recommendations.push({
        id: `rec-performance-${Date.now()}`,
        category: 'Performance',
        priority: 'medium',
        title: 'Optimize Response Times',
        description: `95th percentile response time is ${latest.performance.response_times.p95}ms, which exceeds the 1000ms target.`,
        impact: 'Faster response times improve user experience and system scalability.',
        effort: 'medium',
        implementation_steps: [
          'Profile slow endpoints',
          'Optimize database queries',
          'Implement caching strategies',
          'Review and optimize algorithms'
        ],
        success_criteria: [
          'P95 response time under 500ms',
          'P99 response time under 1000ms',
          'No endpoints with >2s response time'
        ],
        timeline: '2-4 weeks'
      });
    }

    // Code quality recommendations
    if (latest.code_quality.technical_debt.total_debt_minutes > 2000) {
      recommendations.push({
        id: `rec-debt-${Date.now()}`,
        category: 'Code Quality',
        priority: 'medium',
        title: 'Reduce Technical Debt',
        description: `Technical debt is ${Math.round(latest.code_quality.technical_debt.total_debt_minutes / 60)} hours, which impacts maintainability.`,
        impact: 'Reducing technical debt improves code maintainability and developer productivity.',
        effort: 'high',
        implementation_steps: [
          'Prioritize debt items by impact',
          'Allocate 20% of sprint capacity to debt reduction',
          'Refactor complex methods and classes',
          'Improve code documentation'
        ],
        success_criteria: [
          'Reduce debt by 25%',
          'Maintainability index above 80',
          'Code smells under 30'
        ],
        timeline: '6-8 weeks'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async generateTrendAnalysis(metrics: QualityMetrics[]): Promise<TrendAnalysis> {
    if (metrics.length < 3) {
      return {
        test_coverage_trend: { direction: 'stable', rate: 0, confidence: 0, next_milestone: 'N/A' },
        code_quality_trend: { direction: 'stable', rate: 0, confidence: 0, next_milestone: 'N/A' },
        performance_trend: { direction: 'stable', rate: 0, confidence: 0, next_milestone: 'N/A' },
        security_trend: { direction: 'stable', rate: 0, confidence: 0, next_milestone: 'N/A' },
        reliability_trend: { direction: 'stable', rate: 0, confidence: 0, next_milestone: 'N/A' },
        overall_trend: { direction: 'stable', rate: 0, confidence: 0, next_milestone: 'N/A' },
        prediction: {
          timeframe: '1 month',
          predicted_score: metrics[metrics.length - 1]?.overall_score || 0,
          confidence_interval: [0, 100],
          assumptions: [],
          risks: []
        }
      };
    }

    const calculateTrend = (values: number[]) => {
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const y = values;
      
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
      const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const correlation = this.calculateCorrelation(x, y);
      
      const direction = slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable';
      const confidence = Math.abs(correlation) * 100;
      
      return { direction, rate: Math.abs(slope), confidence, slope };
    };

    const overallScores = metrics.map(m => m.overall_score);
    const testCoverageScores = metrics.map(m => m.test_coverage.line_coverage);
    const codeQualityScores = metrics.map(m => m.code_quality.maintainability_index);
    const performanceScores = metrics.map(m => 100 - (m.performance.response_times.p95 / 10));
    const securityScores = metrics.map(m => m.security.vulnerability_score);
    const reliabilityScores = metrics.map(m => m.reliability.uptime);

    const overallTrend = calculateTrend(overallScores);
    const prediction = this.generatePrediction(metrics, overallTrend);

    return {
      test_coverage_trend: {
        ...calculateTrend(testCoverageScores),
        next_milestone: this.getNextMilestone('test_coverage', testCoverageScores[testCoverageScores.length - 1])
      },
      code_quality_trend: {
        ...calculateTrend(codeQualityScores),
        next_milestone: this.getNextMilestone('code_quality', codeQualityScores[codeQualityScores.length - 1])
      },
      performance_trend: {
        ...calculateTrend(performanceScores),
        next_milestone: this.getNextMilestone('performance', performanceScores[performanceScores.length - 1])
      },
      security_trend: {
        ...calculateTrend(securityScores),
        next_milestone: this.getNextMilestone('security', securityScores[securityScores.length - 1])
      },
      reliability_trend: {
        ...calculateTrend(reliabilityScores),
        next_milestone: this.getNextMilestone('reliability', reliabilityScores[reliabilityScores.length - 1])
      },
      overall_trend: {
        ...overallTrend,
        next_milestone: this.getNextMilestone('overall', overallScores[overallScores.length - 1])
      },
      prediction
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private getNextMilestone(category: string, currentValue: number): string {
    const milestones = {
      test_coverage: [70, 80, 90, 95],
      code_quality: [70, 80, 85, 90],
      performance: [70, 80, 90, 95],
      security: [80, 90, 95, 98],
      reliability: [95, 99, 99.5, 99.9],
      overall: [70, 80, 85, 90]
    };

    const categoryMilestones = milestones[category as keyof typeof milestones] || [70, 80, 90, 95];
    const nextMilestone = categoryMilestones.find(milestone => milestone > currentValue);
    
    return nextMilestone ? `${nextMilestone}%` : 'Excellent level achieved';
  }

  private generatePrediction(metrics: QualityMetrics[], trend: any): QualityPrediction {
    const latest = metrics[metrics.length - 1];
    const predictedScore = Math.max(0, Math.min(100, latest.overall_score + (trend.slope * 30))); // 30-day prediction
    
    const confidenceRange = trend.confidence / 100 * 10; // ±10 points at 100% confidence
    
    return {
      timeframe: '30 days',
      predicted_score: predictedScore,
      confidence_interval: [
        Math.max(0, predictedScore - confidenceRange),
        Math.min(100, predictedScore + confidenceRange)
      ],
      assumptions: [
        'Current development practices continue',
        'No major architectural changes',
        'Team size remains stable'
      ],
      risks: [
        'Major security vulnerabilities discovered',
        'Performance degradation due to increased load',
        'Technical debt accumulation'
      ]
    };
  }

  private async generateBenchmarkComparison(metrics: QualityMetrics[]): Promise<BenchmarkComparison> {
    if (metrics.length === 0) {
      return {
        industry_average: 75,
        best_in_class: 90,
        team_average: 0,
        percentile_rank: 0,
        competitive_position: 'Unknown',
        gap_analysis: []
      };
    }

    const latest = metrics[metrics.length - 1];
    const teamAverage = metrics.reduce((sum, m) => sum + m.overall_score, 0) / metrics.length;
    
    // Industry benchmarks (would be sourced from external data)
    const industryAverage = 75;
    const bestInClass = 90;
    
    const percentileRank = this.calculatePercentileRank(latest.overall_score, industryAverage);
    const competitivePosition = this.getCompetitivePosition(percentileRank);
    
    const gapAnalysis: GapAnalysis[] = [
      {
        metric: 'Test Coverage',
        current_value: latest.test_coverage.line_coverage,
        target_value: 85,
        gap: 85 - latest.test_coverage.line_coverage,
        priority: latest.test_coverage.line_coverage < 70 ? 'high' : 'medium',
        recommendations: ['Increase unit test coverage', 'Add integration tests']
      },
      {
        metric: 'Security Score',
        current_value: latest.security.vulnerability_score,
        target_value: 95,
        gap: 95 - latest.security.vulnerability_score,
        priority: latest.security.vulnerability_score < 80 ? 'high' : 'low',
        recommendations: ['Regular security audits', 'Automated vulnerability scanning']
      }
    ];

    return {
      industry_average: industryAverage,
      best_in_class: bestInClass,
      team_average: teamAverage,
      percentile_rank: percentileRank,
      competitive_position: competitivePosition,
      gap_analysis: gapAnalysis
    };
  }

  private calculatePercentileRank(score: number, average: number): number {
    // Simplified percentile calculation
    const standardDeviation = 15; // Assumed
    const zScore = (score - average) / standardDeviation;
    return Math.max(0, Math.min(100, 50 + (zScore * 20)));
  }

  private getCompetitivePosition(percentileRank: number): string {
    if (percentileRank >= 90) return 'Best in class';
    if (percentileRank >= 75) return 'Above average';
    if (percentileRank >= 50) return 'Average';
    if (percentileRank >= 25) return 'Below average';
    return 'Needs improvement';
  }

  private async generateActionItems(metrics: QualityMetrics[]): Promise<ActionItem[]> {
    if (metrics.length === 0) return [];

    const latest = metrics[metrics.length - 1];
    const actionItems: ActionItem[] = [];

    // Critical security action items
    if (latest.security.vulnerabilities.critical > 0) {
      actionItems.push({
        id: `action-security-critical-${Date.now()}`,
        title: 'Address Critical Security Vulnerabilities',
        description: `Resolve ${latest.security.vulnerabilities.critical} critical security vulnerabilities immediately`,
        category: 'Security',
        priority: 'critical',
        effort: 'high',
        impact: 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        status: 'open',
        dependencies: [],
        success_criteria: ['All critical vulnerabilities resolved', 'Security scan passes']
      });
    }

    // Test coverage action items
    if (latest.test_coverage.line_coverage < 70) {
      actionItems.push({
        id: `action-coverage-${Date.now()}`,
        title: 'Improve Test Coverage',
        description: 'Increase test coverage to meet minimum 70% threshold',
        category: 'Quality',
        priority: 'high',
        effort: 'medium',
        impact: 'medium',
        due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks
        status: 'open',
        dependencies: [],
        success_criteria: ['Line coverage above 70%', 'Branch coverage above 60%']
      });
    }

    // Performance action items
    if (latest.performance.response_times.p95 > 1000) {
      actionItems.push({
        id: `action-performance-${Date.now()}`,
        title: 'Optimize API Performance',
        description: 'Reduce 95th percentile response time below 1000ms',
        category: 'Performance',
        priority: 'medium',
        effort: 'medium',
        impact: 'high',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        status: 'open',
        dependencies: ['Performance profiling completed'],
        success_criteria: ['P95 response time under 1000ms', 'No endpoints over 2000ms']
      });
    }

    return actionItems.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // Report output generation
  async generateHTMLReport(report: QualityReport, template: ReportTemplate): Promise<string> {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quality Report - ${report.id}</title>
        <style>
            ${this.getReportCSS(template)}
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
        <div class="header">
            <h1>Quality Report</h1>
            <div class="meta">
                <span>Generated: ${report.generated_at.toISOString()}</span>
                <span>Period: ${report.period.start.toDateString()} - ${report.period.end.toDateString()}</span>
            </div>
        </div>

        <div class="summary">
            <h2>Executive Summary</h2>
            <div class="score-card">
                <div class="overall-score">
                    <span class="score">${report.summary.overall_score.toFixed(1)}</span>
                    <span class="label">Overall Quality Score</span>
                    <span class="change ${report.summary.score_change >= 0 ? 'positive' : 'negative'}">
                        ${report.summary.score_change >= 0 ? '+' : ''}${report.summary.score_change.toFixed(1)}
                    </span>
                </div>
            </div>
            
            ${report.summary.achievements.length > 0 ? `
            <div class="achievements">
                <h3>🏆 Achievements</h3>
                <ul>
                    ${report.summary.achievements.map(achievement => `<li>${achievement}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            ${report.summary.key_improvements.length > 0 ? `
            <div class="improvements">
                <h3>✅ Key Improvements</h3>
                <ul>
                    ${report.summary.key_improvements.map(improvement => `<li>${improvement}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            ${report.summary.key_regressions.length > 0 ? `
            <div class="regressions">
                <h3>⚠️ Key Regressions</h3>
                <ul>
                    ${report.summary.key_regressions.map(regression => `<li>${regression}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>

        <div class="metrics">
            <h2>Quality Metrics</h2>
            <div class="metrics-grid">
                ${this.generateMetricsCards(report.metrics[report.metrics.length - 1])}
            </div>
        </div>

        <div class="recommendations">
            <h2>Recommendations</h2>
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <h3>${rec.title}</h3>
                    <div class="meta">
                        <span class="priority">${rec.priority.toUpperCase()}</span>
                        <span class="effort">Effort: ${rec.effort}</span>
                        <span class="category">${rec.category}</span>
                    </div>
                    <p>${rec.description}</p>
                    <div class="implementation">
                        <h4>Implementation Steps:</h4>
                        <ol>
                            ${rec.implementation_steps.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="action-items">
            <h2>Action Items</h2>
            <table class="action-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Priority</th>
                        <th>Category</th>
                        <th>Due Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.action_items.map(item => `
                        <tr class="${item.priority}">
                            <td>${item.title}</td>
                            <td><span class="priority-badge ${item.priority}">${item.priority}</span></td>
                            <td>${item.category}</td>
                            <td>${item.due_date?.toDateString() || 'Not set'}</td>
                            <td><span class="status-badge ${item.status}">${item.status.replace('_', ' ')}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>Generated by n8n-MCP Quality Assurance System</p>
            <p>Report ID: ${report.id}</p>
        </div>
    </body>
    </html>
    `;

    return html;
  }

  private getReportCSS(template: ReportTemplate): string {
    const colors = template.branding.color_scheme;
    
    return `
        body {
            font-family: ${template.branding.fonts.body};
            color: ${colors.text};
            background-color: ${colors.background};
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }

        .header {
            background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-family: ${template.branding.fonts.heading};
        }

        .meta {
            margin-top: 10px;
            opacity: 0.9;
        }

        .meta span {
            margin-right: 20px;
        }

        .summary {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .score-card {
            text-align: center;
            margin: 30px 0;
        }

        .overall-score {
            display: inline-block;
            background: linear-gradient(135deg, ${colors.accent}, ${colors.primary});
            color: white;
            padding: 30px;
            border-radius: 50%;
            min-width: 150px;
            min-height: 150px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .overall-score .score {
            font-size: 3em;
            font-weight: bold;
            line-height: 1;
        }

        .overall-score .label {
            font-size: 0.9em;
            margin-top: 5px;
        }

        .overall-score .change {
            font-size: 1.2em;
            margin-top: 10px;
        }

        .change.positive { color: #28a745; }
        .change.negative { color: #dc3545; }

        .achievements, .improvements, .regressions {
            margin: 20px 0;
        }

        .achievements h3 { color: #ffc107; }
        .improvements h3 { color: #28a745; }
        .regressions h3 { color: #dc3545; }

        .metrics {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .metric-card {
            background: ${colors.background};
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid ${colors.accent};
        }

        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: ${colors.primary};
        }

        .metric-label {
            color: ${colors.secondary};
            font-size: 0.9em;
        }

        .recommendations {
            margin-bottom: 30px;
        }

        .recommendation {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            border-left: 4px solid;
        }

        .recommendation.critical { border-left-color: #dc3545; }
        .recommendation.high { border-left-color: #fd7e14; }
        .recommendation.medium { border-left-color: #ffc107; }
        .recommendation.low { border-left-color: #28a745; }

        .recommendation .meta {
            margin-bottom: 15px;
        }

        .priority, .effort, .category {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 10px;
        }

        .action-items {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .action-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .action-table th,
        .action-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        .action-table th {
            background-color: ${colors.primary};
            color: white;
        }

        .priority-badge,
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            color: white;
        }

        .priority-badge.critical { background-color: #dc3545; }
        .priority-badge.high { background-color: #fd7e14; }
        .priority-badge.medium { background-color: #ffc107; color: #212529; }
        .priority-badge.low { background-color: #28a745; }

        .status-badge.open { background-color: #6c757d; }
        .status-badge.in_progress { background-color: #007bff; }
        .status-badge.completed { background-color: #28a745; }

        .footer {
            text-align: center;
            margin-top: 50px;
            padding: 20px;
            color: ${colors.secondary};
            border-top: 1px solid #ddd;
        }

        h2 {
            color: ${colors.primary};
            font-family: ${template.branding.fonts.heading};
            border-bottom: 2px solid ${colors.primary};
            padding-bottom: 10px;
        }

        @media print {
            body { background: white; }
            .summary, .metrics, .action-items { box-shadow: none; }
        }
    `;
  }

  private generateMetricsCards(metrics: QualityMetrics): string {
    return `
        <div class="metric-card">
            <div class="metric-value">${metrics.test_coverage.line_coverage.toFixed(1)}%</div>
            <div class="metric-label">Test Coverage</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.code_quality.maintainability_index.toFixed(1)}</div>
            <div class="metric-label">Code Quality</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.performance.response_times.p95.toFixed(0)}ms</div>
            <div class="metric-label">P95 Response Time</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.security.vulnerability_score.toFixed(1)}</div>
            <div class="metric-label">Security Score</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.reliability.uptime.toFixed(2)}%</div>
            <div class="metric-label">Uptime</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.maintainability.maintainability_index.toFixed(1)}</div>
            <div class="metric-label">Maintainability</div>
        </div>
    `;
  }

  async generatePDFReport(report: QualityReport, template: ReportTemplate): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: template.layout.page_size,
          margins: template.layout.margins 
        });
        
        const chunks: Buffer[] = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add content to PDF
        this.addPDFContent(doc, report, template);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addPDFContent(doc: any, report: QualityReport, template: ReportTemplate): void {
    const colors = template.branding.color_scheme;

    // Header
    doc.fontSize(24)
       .fillColor(colors.primary)
       .text('Quality Report', 50, 50);

    doc.fontSize(12)
       .fillColor(colors.text)
       .text(`Generated: ${report.generated_at.toISOString()}`, 50, 80)
       .text(`Period: ${report.period.start.toDateString()} - ${report.period.end.toDateString()}`, 50, 95);

    // Overall Score
    doc.fontSize(48)
       .fillColor(colors.accent)
       .text(report.summary.overall_score.toFixed(1), 300, 120);
    
    doc.fontSize(14)
       .fillColor(colors.text)
       .text('Overall Quality Score', 300, 170);

    // Summary section
    let yPosition = 220;
    
    doc.fontSize(18)
       .fillColor(colors.primary)
       .text('Executive Summary', 50, yPosition);
    
    yPosition += 30;

    if (report.summary.achievements.length > 0) {
      doc.fontSize(14)
         .fillColor(colors.text)
         .text('Achievements:', 50, yPosition);
      yPosition += 20;
      
      report.summary.achievements.forEach(achievement => {
        doc.fontSize(12)
           .text(`• ${achievement}`, 70, yPosition);
        yPosition += 15;
      });
      yPosition += 10;
    }

    // Recommendations section
    if (yPosition > 600) {
      doc.addPage();
      yPosition = 50;
    }

    doc.fontSize(18)
       .fillColor(colors.primary)
       .text('Key Recommendations', 50, yPosition);
    
    yPosition += 30;

    report.recommendations.slice(0, 5).forEach(rec => {
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(14)
         .fillColor(colors.text)
         .text(rec.title, 50, yPosition);
      
      doc.fontSize(10)
         .fillColor(colors.secondary)
         .text(`Priority: ${rec.priority} | Category: ${rec.category}`, 50, yPosition + 15);
      
      doc.fontSize(11)
         .fillColor(colors.text)
         .text(rec.description, 50, yPosition + 30, { width: 500 });
      
      yPosition += 70;
    });
  }

  async exportReportData(report: QualityReport, format: 'json' | 'csv'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
      return this.convertReportToCSV(report);
    }
    
    throw new Error(`Unsupported format: ${format}`);
  }

  private convertReportToCSV(report: QualityReport): string {
    const headers = ['Timestamp', 'Overall Score', 'Test Coverage', 'Security Score', 'Performance Score'];
    
    const rows = report.metrics.map(m => [
      m.timestamp.toISOString(),
      m.overall_score,
      m.test_coverage.line_coverage,
      m.security.vulnerability_score,
      m.performance.efficiency.resource_efficiency
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  // Public API
  getReportHistory(): QualityReport[] {
    return this.reportHistory;
  }

  getReport(reportId: string): QualityReport | undefined {
    return this.reportHistory.find(report => report.id === reportId);
  }

  addTemplate(template: ReportTemplate): void {
    this.templates.set(template.name, template);
    logger.info('Report template added', { name: template.name, type: template.type });
  }

  removeTemplate(templateName: string): boolean {
    const removed = this.templates.delete(templateName);
    if (removed) {
      logger.info('Report template removed', { name: templateName });
    }
    return removed;
  }

  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  async cleanup(): Promise<void> {
    this.reportHistory = [];
    this.templates.clear();
    this.configurations.clear();
    this.removeAllListeners();
    logger.info('Quality report generator cleaned up');
  }
}