import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createObjectCsvWriter } from 'csv-writer';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';
import { logger } from '../utils/logger';
import { UsageStorage } from '../storage/UsageStorage';
import { UsageMetrics, UsageEvent } from '../core/UsageTracker';

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  type: 'usage_summary' | 'user_behavior' | 'performance' | 'conversion' | 'custom';
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'html';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:MM format
    timezone: string;
    recipients: string[];
  };
  filters: {
    dateRange: {
      type: 'relative' | 'absolute';
      value: string; // '7d', '30d', 'custom'
      startDate?: Date;
      endDate?: Date;
    };
    segments?: {
      userId?: string[];
      country?: string[];
      platform?: string[];
      version?: string[];
    };
  };
  metrics: string[];
  visualizations: Array<{
    type: 'line' | 'bar' | 'pie' | 'table' | 'funnel' | 'heatmap';
    title: string;
    metric: string;
    config: Record<string, any>;
  }>;
  customSQL?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedReport {
  id: string;
  reportDefinitionId: string;
  name: string;
  format: string;
  generatedAt: number;
  generatedBy: string;
  filePath: string;
  fileSize: number;
  status: 'generating' | 'completed' | 'failed';
  error?: string;
  metadata: {
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    recordCount: number;
    generationTime: number;
  };
}

export class ReportGenerator extends EventEmitter {
  private usageStorage: UsageStorage;
  private reportDefinitions = new Map<string, ReportDefinition>();
  private generatedReports = new Map<string, GeneratedReport>();
  private chartRenderer: ChartJSNodeCanvas;
  private reportsDir: string;

  constructor(
    usageStorage: UsageStorage,
    private options: {
      reportsDirectory?: string;
      maxReportAge?: number; // days
      enableScheduledReports?: boolean;
      chartWidth?: number;
      chartHeight?: number;
    } = {}
  ) {
    super();
    
    this.usageStorage = usageStorage;
    
    this.options = {
      reportsDirectory: './reports',
      maxReportAge: 30,
      enableScheduledReports: true,
      chartWidth: 800,
      chartHeight: 600,
      ...options
    };

    this.reportsDir = this.options.reportsDirectory!;
    this.chartRenderer = new ChartJSNodeCanvas({
      width: this.options.chartWidth!,
      height: this.options.chartHeight!
    });

    this.initializeReportsDirectory();
    this.startPeriodicTasks();
  }

  private initializeReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // Create subdirectories
    ['pdf', 'excel', 'csv', 'json', 'html', 'temp'].forEach(subDir => {
      const dirPath = path.join(this.reportsDir, subDir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  private startPeriodicTasks(): void {
    // Clean up old reports
    setInterval(() => this.cleanupOldReports(), 24 * 60 * 60 * 1000); // Daily
    
    // Process scheduled reports
    if (this.options.enableScheduledReports) {
      setInterval(() => this.processScheduledReports(), 60 * 1000); // Every minute
    }
  }

  // Create report definition
  async createReportDefinition(
    definition: Omit<ReportDefinition, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const reportId = uuidv4();
    const now = Date.now();

    const reportDefinition: ReportDefinition = {
      id: reportId,
      createdAt: now,
      updatedAt: now,
      ...definition
    };

    this.reportDefinitions.set(reportId, reportDefinition);

    this.emit('report_definition_created', reportDefinition);

    logger.info('Report definition created', {
      reportId,
      name: reportDefinition.name,
      type: reportDefinition.type
    });

    return reportId;
  }

  // Generate report
  async generateReport(
    reportDefinitionId: string,
    generatedBy: string,
    customFilters?: any
  ): Promise<string> {
    const reportDefinition = this.reportDefinitions.get(reportDefinitionId);
    if (!reportDefinition) {
      throw new Error(`Report definition not found: ${reportDefinitionId}`);
    }

    const reportId = uuidv4();
    const startTime = Date.now();

    const report: GeneratedReport = {
      id: reportId,
      reportDefinitionId,
      name: reportDefinition.name,
      format: reportDefinition.format,
      generatedAt: startTime,
      generatedBy,
      filePath: '',
      fileSize: 0,
      status: 'generating',
      metadata: {
        dateRange: this.calculateDateRange(reportDefinition.filters.dateRange),
        recordCount: 0,
        generationTime: 0
      }
    };

    this.generatedReports.set(reportId, report);

    try {
      // Get data based on report type
      const data = await this.gatherReportData(reportDefinition, customFilters);
      
      // Generate file based on format
      const filePath = await this.generateReportFile(reportDefinition, data, reportId);
      
      // Update report status
      report.status = 'completed';
      report.filePath = filePath;
      report.fileSize = fs.statSync(filePath).size;
      report.metadata.recordCount = Array.isArray(data) ? data.length : 0;
      report.metadata.generationTime = Date.now() - startTime;

      this.emit('report_generated', report);

      logger.info('Report generated successfully', {
        reportId,
        reportDefinitionId,
        format: reportDefinition.format,
        generationTime: report.metadata.generationTime
      });

      return reportId;

    } catch (error) {
      report.status = 'failed';
      report.error = error.message;

      this.emit('report_generation_failed', { reportId, error: error.message });

      logger.error('Report generation failed', {
        reportId,
        reportDefinitionId,
        error: error.message
      });

      throw error;
    }
  }

  // Generate dashboard report
  async generateDashboardReport(
    dateRange: { startDate: Date; endDate: Date },
    generatedBy: string
  ): Promise<string> {
    const reportId = uuidv4();
    const startTime = Date.now();

    try {
      // Get comprehensive usage metrics
      const metrics = await this.usageStorage.getUsageMetrics(
        dateRange.startDate.getTime(),
        dateRange.endDate.getTime()
      );

      // Generate PDF dashboard
      const filePath = await this.generateDashboardPDF(metrics, dateRange, reportId);

      const report: GeneratedReport = {
        id: reportId,
        reportDefinitionId: 'dashboard',
        name: 'Usage Dashboard',
        format: 'pdf',
        generatedAt: startTime,
        generatedBy,
        filePath,
        fileSize: fs.statSync(filePath).size,
        status: 'completed',
        metadata: {
          dateRange,
          recordCount: metrics.totalEvents,
          generationTime: Date.now() - startTime
        }
      };

      this.generatedReports.set(reportId, report);

      this.emit('report_generated', report);

      return reportId;

    } catch (error) {
      logger.error('Dashboard report generation failed', {
        reportId,
        error: error.message
      });
      throw error;
    }
  }

  // Get report definitions
  getReportDefinitions(): ReportDefinition[] {
    return Array.from(this.reportDefinitions.values());
  }

  // Get generated reports
  getGeneratedReports(limit: number = 50): GeneratedReport[] {
    return Array.from(this.generatedReports.values())
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, limit);
  }

  // Get report file
  getReportFile(reportId: string): { filePath: string; filename: string } | null {
    const report = this.generatedReports.get(reportId);
    if (!report || !fs.existsSync(report.filePath)) {
      return null;
    }

    const filename = `${report.name}_${format(new Date(report.generatedAt), 'yyyy-MM-dd_HH-mm')}.${this.getFileExtension(report.format)}`;
    
    return {
      filePath: report.filePath,
      filename
    };
  }

  private calculateDateRange(dateRange: ReportDefinition['filters']['dateRange']): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();

    if (dateRange.type === 'absolute' && dateRange.startDate && dateRange.endDate) {
      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };
    }

    // Relative date ranges
    switch (dateRange.value) {
      case '1d':
        return {
          startDate: startOfDay(subDays(now, 1)),
          endDate: endOfDay(subDays(now, 1))
        };
      case '7d':
        return {
          startDate: startOfDay(subDays(now, 7)),
          endDate: endOfDay(now)
        };
      case '30d':
        return {
          startDate: startOfDay(subDays(now, 30)),
          endDate: endOfDay(now)
        };
      case '3m':
        return {
          startDate: startOfDay(subMonths(now, 3)),
          endDate: endOfDay(now)
        };
      default:
        return {
          startDate: startOfDay(subDays(now, 7)),
          endDate: endOfDay(now)
        };
    }
  }

  private async gatherReportData(
    definition: ReportDefinition,
    customFilters?: any
  ): Promise<any> {
    const dateRange = this.calculateDateRange(definition.filters.dateRange);
    const filters = { ...definition.filters.segments, ...customFilters };

    switch (definition.type) {
      case 'usage_summary':
        return this.usageStorage.getUsageMetrics(
          dateRange.startDate.getTime(),
          dateRange.endDate.getTime(),
          filters
        );

      case 'user_behavior':
        return this.generateUserBehaviorData(dateRange, filters);

      case 'performance':
        return this.generatePerformanceData(dateRange, filters);

      case 'conversion':
        return this.generateConversionData(dateRange, filters);

      case 'custom':
        if (definition.customSQL) {
          return this.executeCustomQuery(definition.customSQL, dateRange, filters);
        }
        throw new Error('Custom SQL query required for custom report type');

      default:
        throw new Error(`Unknown report type: ${definition.type}`);
    }
  }

  private async generateUserBehaviorData(
    dateRange: { startDate: Date; endDate: Date },
    filters: any
  ): Promise<any> {
    // Get user journey data, session patterns, etc.
    const { events } = await this.usageStorage.searchEvents({
      startTime: dateRange.startDate.getTime(),
      endTime: dateRange.endDate.getTime(),
      limit: 10000
    });

    // Analyze user behavior patterns
    const userSessions = this.analyzeUserSessions(events);
    const pageFlows = this.analyzePageFlows(events);
    const timeSpentAnalysis = this.analyzeTimeSpent(events);

    return {
      userSessions,
      pageFlows,
      timeSpentAnalysis,
      totalEvents: events.length
    };
  }

  private async generatePerformanceData(
    dateRange: { startDate: Date; endDate: Date },
    filters: any
  ): Promise<any> {
    const { events } = await this.usageStorage.searchEvents({
      category: 'api_call',
      startTime: dateRange.startDate.getTime(),
      endTime: dateRange.endDate.getTime(),
      limit: 10000
    });

    // Analyze API performance
    const responseTimeAnalysis = this.analyzeResponseTimes(events);
    const errorAnalysis = this.analyzeAPIErrors(events);
    const endpointPerformance = this.analyzeEndpointPerformance(events);

    return {
      responseTimeAnalysis,
      errorAnalysis,
      endpointPerformance,
      totalAPICalls: events.length
    };
  }

  private async generateConversionData(
    dateRange: { startDate: Date; endDate: Date },
    filters: any
  ): Promise<any> {
    // Define conversion funnel
    const funnelDefinition = {
      name: 'User Conversion Funnel',
      steps: [
        { step: 'Registration', event: 'user_registered' },
        { step: 'First Workflow', event: 'workflow_created' },
        { step: 'First Execution', event: 'workflow_executed' },
        { step: 'Integration Connected', event: 'integration_connected' }
      ]
    };

    const funnelAnalysis = await this.usageStorage.getFunnelAnalysis(
      funnelDefinition,
      dateRange.startDate.getTime(),
      dateRange.endDate.getTime(),
      filters
    );

    return {
      funnelAnalysis,
      conversionMetrics: this.calculateConversionMetrics(funnelAnalysis)
    };
  }

  private async executeCustomQuery(
    sql: string,
    dateRange: { startDate: Date; endDate: Date },
    filters: any
  ): Promise<any> {
    // This would execute custom SQL queries
    // For security, this should be heavily restricted and validated
    throw new Error('Custom SQL execution not implemented for security reasons');
  }

  private async generateReportFile(
    definition: ReportDefinition,
    data: any,
    reportId: string
  ): Promise<string> {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const filename = `${definition.name}_${timestamp}_${reportId}`;

    switch (definition.format) {
      case 'pdf':
        return this.generatePDFReport(definition, data, filename);
      case 'excel':
        return this.generateExcelReport(definition, data, filename);
      case 'csv':
        return this.generateCSVReport(definition, data, filename);
      case 'json':
        return this.generateJSONReport(definition, data, filename);
      case 'html':
        return this.generateHTMLReport(definition, data, filename);
      default:
        throw new Error(`Unsupported report format: ${definition.format}`);
    }
  }

  private async generatePDFReport(
    definition: ReportDefinition,
    data: any,
    filename: string
  ): Promise<string> {
    const filePath = path.join(this.reportsDir, 'pdf', `${filename}.pdf`);
    const doc = new PDFDocument();
    
    doc.pipe(fs.createWriteStream(filePath));

    // Title page
    doc.fontSize(20).text(definition.name, 50, 50);
    doc.fontSize(12).text(`Generated on: ${new Date().toISOString()}`, 50, 80);
    doc.text(`Report Type: ${definition.type}`, 50, 100);

    // Add data sections
    if (data.totalEvents !== undefined) {
      doc.addPage();
      doc.fontSize(16).text('Usage Summary', 50, 50);
      doc.fontSize(12);
      doc.text(`Total Events: ${data.totalEvents}`, 50, 80);
      doc.text(`Total Sessions: ${data.totalSessions}`, 50, 100);
      doc.text(`Total Users: ${data.totalUsers}`, 50, 120);
    }

    // Generate charts if visualizations are defined
    for (const viz of definition.visualizations) {
      const chartBuffer = await this.generateChart(viz, data);
      doc.addPage();
      doc.fontSize(14).text(viz.title, 50, 50);
      doc.image(chartBuffer, 50, 80, { width: 500 });
    }

    doc.end();

    return filePath;
  }

  private async generateDashboardPDF(
    metrics: UsageMetrics,
    dateRange: { startDate: Date; endDate: Date },
    reportId: string
  ): Promise<string> {
    const filename = `dashboard_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}_${reportId}`;
    const filePath = path.join(this.reportsDir, 'pdf', `${filename}.pdf`);
    
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    // Title page
    doc.fontSize(24).text('Usage Analytics Dashboard', 50, 50);
    doc.fontSize(14).text(`Period: ${format(dateRange.startDate, 'MMM dd, yyyy')} - ${format(dateRange.endDate, 'MMM dd, yyyy')}`, 50, 100);
    doc.fontSize(12).text(`Generated on: ${new Date().toISOString()}`, 50, 120);

    // Overview metrics
    doc.addPage();
    doc.fontSize(18).text('Overview', 50, 50);
    doc.fontSize(12);
    
    const overviewY = 100;
    doc.text(`Total Events: ${metrics.totalEvents.toLocaleString()}`, 50, overviewY);
    doc.text(`Total Sessions: ${metrics.totalSessions.toLocaleString()}`, 50, overviewY + 20);
    doc.text(`Total Users: ${metrics.totalUsers.toLocaleString()}`, 50, overviewY + 40);
    doc.text(`Page Views: ${metrics.pageViews.total.toLocaleString()}`, 50, overviewY + 60);

    // Active users
    doc.fontSize(14).text('Active Users', 50, overviewY + 100);
    doc.fontSize(12);
    doc.text(`Last 24 Hours: ${metrics.activeUsers.last24Hours.toLocaleString()}`, 50, overviewY + 120);
    doc.text(`Last 7 Days: ${metrics.activeUsers.last7Days.toLocaleString()}`, 50, overviewY + 140);
    doc.text(`Last 30 Days: ${metrics.activeUsers.last30Days.toLocaleString()}`, 50, overviewY + 160);

    // Top pages
    if (metrics.pageViews.topPages.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('Top Pages', 50, 50);
      doc.fontSize(12);
      
      let y = 80;
      metrics.pageViews.topPages.slice(0, 10).forEach((page, index) => {
        doc.text(`${index + 1}. ${page.page}: ${page.views.toLocaleString()} views`, 50, y);
        y += 20;
      });
    }

    // Technology breakdown
    if (metrics.technology.browsers.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('Technology Breakdown', 50, 50);
      
      doc.fontSize(14).text('Browsers', 50, 100);
      doc.fontSize(12);
      let y = 120;
      metrics.technology.browsers.slice(0, 5).forEach(browser => {
        doc.text(`${browser.browser}: ${browser.percentage.toFixed(1)}%`, 50, y);
        y += 20;
      });

      doc.fontSize(14).text('Operating Systems', 300, 100);
      doc.fontSize(12);
      y = 120;
      metrics.technology.operatingSystems.slice(0, 5).forEach(os => {
        doc.text(`${os.os}: ${os.percentage.toFixed(1)}%`, 300, y);
        y += 20;
      });
    }

    doc.end();
    return filePath;
  }

  private async generateExcelReport(
    definition: ReportDefinition,
    data: any,
    filename: string
  ): Promise<string> {
    const filePath = path.join(this.reportsDir, 'excel', `${filename}.xlsx`);
    
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    if (data.totalEvents !== undefined) {
      const summaryData = [
        ['Metric', 'Value'],
        ['Total Events', data.totalEvents],
        ['Total Sessions', data.totalSessions],
        ['Total Users', data.totalUsers],
        ['Average Session Duration', data.sessions?.averageDuration || 0],
        ['Bounce Rate', data.sessions?.bounceRate || 0]
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // Top pages sheet
    if (data.pageViews?.topPages) {
      const pagesData = [
        ['Page', 'Views', 'Unique Views'],
        ...data.pageViews.topPages.map((page: any) => [page.page, page.views, page.uniqueViews])
      ];
      
      const pagesSheet = XLSX.utils.aoa_to_sheet(pagesData);
      XLSX.utils.book_append_sheet(workbook, pagesSheet, 'Top Pages');
    }

    XLSX.writeFile(workbook, filePath);
    return filePath;
  }

  private async generateCSVReport(
    definition: ReportDefinition,
    data: any,
    filename: string
  ): Promise<string> {
    const filePath = path.join(this.reportsDir, 'csv', `${filename}.csv`);
    
    // Convert data to CSV format
    let csvData: any[] = [];
    
    if (Array.isArray(data)) {
      csvData = data;
    } else if (data.pageViews?.topPages) {
      csvData = data.pageViews.topPages;
    } else {
      // Convert object to CSV
      csvData = Object.entries(data).map(([key, value]) => ({ metric: key, value }));
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: Object.keys(csvData[0] || {}).map(key => ({ id: key, title: key }))
    });

    await csvWriter.writeRecords(csvData);
    return filePath;
  }

  private async generateJSONReport(
    definition: ReportDefinition,
    data: any,
    filename: string
  ): Promise<string> {
    const filePath = path.join(this.reportsDir, 'json', `${filename}.json`);
    
    const reportData = {
      reportDefinition: definition,
      generatedAt: new Date().toISOString(),
      data
    };
    
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
    return filePath;
  }

  private async generateHTMLReport(
    definition: ReportDefinition,
    data: any,
    filename: string
  ): Promise<string> {
    const filePath = path.join(this.reportsDir, 'html', `${filename}.html`);
    
    const html = this.generateHTMLContent(definition, data);
    fs.writeFileSync(filePath, html);
    
    return filePath;
  }

  private generateHTMLContent(definition: ReportDefinition, data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${definition.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .metric { margin: 10px 0; }
        .chart { margin: 20px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${definition.name}</h1>
        <p>Generated on: ${new Date().toISOString()}</p>
        <p>Report Type: ${definition.type}</p>
    </div>
    
    <div class="content">
        ${this.generateHTMLMetrics(data)}
        ${this.generateHTMLTables(data)}
    </div>
</body>
</html>
    `;
  }

  private generateHTMLMetrics(data: any): string {
    if (!data.totalEvents) return '';
    
    return `
        <h2>Summary Metrics</h2>
        <div class="metric">Total Events: ${data.totalEvents.toLocaleString()}</div>
        <div class="metric">Total Sessions: ${data.totalSessions.toLocaleString()}</div>
        <div class="metric">Total Users: ${data.totalUsers.toLocaleString()}</div>
    `;
  }

  private generateHTMLTables(data: any): string {
    let tables = '';
    
    if (data.pageViews?.topPages) {
      tables += `
        <h2>Top Pages</h2>
        <table>
            <tr><th>Page</th><th>Views</th><th>Unique Views</th></tr>
            ${data.pageViews.topPages.map((page: any) => 
              `<tr><td>${page.page}</td><td>${page.views}</td><td>${page.uniqueViews}</td></tr>`
            ).join('')}
        </table>
      `;
    }
    
    return tables;
  }

  private async generateChart(visualization: any, data: any): Promise<Buffer> {
    const chartConfig = {
      type: visualization.type,
      data: this.prepareChartData(visualization, data),
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: visualization.title
          }
        },
        ...visualization.config
      }
    };

    return this.chartRenderer.renderToBuffer(chartConfig);
  }

  private prepareChartData(visualization: any, data: any): any {
    // Prepare chart data based on visualization type and metric
    switch (visualization.metric) {
      case 'topPages':
        if (data.pageViews?.topPages) {
          return {
            labels: data.pageViews.topPages.map((p: any) => p.page),
            datasets: [{
              label: 'Page Views',
              data: data.pageViews.topPages.map((p: any) => p.views),
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }]
          };
        }
        break;
      
      default:
        return { labels: [], datasets: [] };
    }
  }

  // Helper methods for data analysis
  private analyzeUserSessions(events: UsageEvent[]): any {
    const sessions = new Map<string, any>();
    
    events.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, {
          sessionId: event.sessionId,
          userId: event.userId,
          startTime: event.timestamp,
          endTime: event.timestamp,
          eventCount: 0,
          pageViews: 0
        });
      }
      
      const session = sessions.get(event.sessionId);
      session.endTime = Math.max(session.endTime, event.timestamp);
      session.eventCount++;
      
      if (event.category === 'page_view') {
        session.pageViews++;
      }
    });
    
    return Array.from(sessions.values());
  }

  private analyzePageFlows(events: UsageEvent[]): any {
    const pageViews = events.filter(e => e.category === 'page_view');
    const flows = new Map<string, number>();
    
    const sessionPages = new Map<string, string[]>();
    
    pageViews.forEach(event => {
      const page = event.properties.page;
      if (!page) return;
      
      if (!sessionPages.has(event.sessionId)) {
        sessionPages.set(event.sessionId, []);
      }
      sessionPages.get(event.sessionId)!.push(page);
    });
    
    // Analyze page transitions
    sessionPages.forEach(pages => {
      for (let i = 0; i < pages.length - 1; i++) {
        const flow = `${pages[i]} → ${pages[i + 1]}`;
        flows.set(flow, (flows.get(flow) || 0) + 1);
      }
    });
    
    return Array.from(flows.entries())
      .map(([flow, count]) => ({ flow, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private analyzeTimeSpent(events: UsageEvent[]): any {
    const timeByPage = new Map<string, number[]>();
    
    events.filter(e => e.duration).forEach(event => {
      const page = event.properties.page || event.event;
      if (!timeByPage.has(page)) {
        timeByPage.set(page, []);
      }
      timeByPage.get(page)!.push(event.duration!);
    });
    
    return Array.from(timeByPage.entries()).map(([page, times]) => ({
      page,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      totalTime: times.reduce((a, b) => a + b, 0),
      sessions: times.length
    })).sort((a, b) => b.averageTime - a.averageTime);
  }

  private analyzeResponseTimes(events: UsageEvent[]): any {
    const responseTimes = events
      .filter(e => e.properties.responseTime)
      .map(e => e.properties.responseTime);
    
    if (responseTimes.length === 0) {
      return { average: 0, median: 0, p95: 0, p99: 0 };
    }
    
    responseTimes.sort((a, b) => a - b);
    
    return {
      average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      median: responseTimes[Math.floor(responseTimes.length / 2)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99: responseTimes[Math.floor(responseTimes.length * 0.99)]
    };
  }

  private analyzeAPIErrors(events: UsageEvent[]): any {
    const errors = events.filter(e => 
      e.properties.statusCode && e.properties.statusCode >= 400
    );
    
    const errorsByCode = new Map<number, number>();
    const errorsByEndpoint = new Map<string, number>();
    
    errors.forEach(error => {
      const code = error.properties.statusCode;
      const endpoint = error.properties.endpoint;
      
      errorsByCode.set(code, (errorsByCode.get(code) || 0) + 1);
      if (endpoint) {
        errorsByEndpoint.set(endpoint, (errorsByEndpoint.get(endpoint) || 0) + 1);
      }
    });
    
    return {
      totalErrors: errors.length,
      errorRate: errors.length / events.length,
      errorsByCode: Array.from(errorsByCode.entries()),
      errorsByEndpoint: Array.from(errorsByEndpoint.entries())
    };
  }

  private analyzeEndpointPerformance(events: UsageEvent[]): any {
    const endpointMetrics = new Map<string, any>();
    
    events.forEach(event => {
      const endpoint = event.properties.endpoint;
      if (!endpoint) return;
      
      if (!endpointMetrics.has(endpoint)) {
        endpointMetrics.set(endpoint, {
          endpoint,
          totalCalls: 0,
          responseTimes: [],
          errors: 0
        });
      }
      
      const metrics = endpointMetrics.get(endpoint);
      metrics.totalCalls++;
      
      if (event.properties.responseTime) {
        metrics.responseTimes.push(event.properties.responseTime);
      }
      
      if (event.properties.statusCode >= 400) {
        metrics.errors++;
      }
    });
    
    return Array.from(endpointMetrics.values()).map(metrics => ({
      endpoint: metrics.endpoint,
      totalCalls: metrics.totalCalls,
      averageResponseTime: metrics.responseTimes.length > 0 ? 
        metrics.responseTimes.reduce((a: number, b: number) => a + b, 0) / metrics.responseTimes.length : 0,
      errorRate: metrics.errors / metrics.totalCalls,
      errors: metrics.errors
    })).sort((a, b) => b.totalCalls - a.totalCalls);
  }

  private calculateConversionMetrics(funnelAnalysis: any): any {
    return {
      totalConversions: funnelAnalysis.steps[funnelAnalysis.steps.length - 1]?.users || 0,
      conversionRate: funnelAnalysis.overallConversionRate,
      biggestDropOff: funnelAnalysis.bottleneck,
      stepsCompleted: funnelAnalysis.steps.length
    };
  }

  private processScheduledReports(): void {
    // Process scheduled reports - this would check for reports that need to be generated
    // based on their schedule and generate them automatically
    logger.debug('Processing scheduled reports...');
  }

  private cleanupOldReports(): void {
    const maxAge = this.options.maxReportAge! * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    
    let cleanedCount = 0;
    
    for (const [reportId, report] of this.generatedReports.entries()) {
      if (report.generatedAt < cutoff) {
        // Delete file
        if (fs.existsSync(report.filePath)) {
          fs.unlinkSync(report.filePath);
        }
        
        // Remove from memory
        this.generatedReports.delete(reportId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('Cleaned up old reports', { cleanedCount });
    }
  }

  private getFileExtension(format: string): string {
    const extensions: Record<string, string> = {
      pdf: 'pdf',
      excel: 'xlsx',
      csv: 'csv',
      json: 'json',
      html: 'html'
    };
    
    return extensions[format] || 'txt';
  }

  destroy(): void {
    this.removeAllListeners();
    this.reportDefinitions.clear();
    this.generatedReports.clear();
  }
}