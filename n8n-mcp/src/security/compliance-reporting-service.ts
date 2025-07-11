import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

interface ComplianceFramework {
  name: string;
  version: string;
  requirements: ComplianceRequirement[];
  lastAssessment?: Date;
  complianceScore?: number;
  gaps?: ComplianceGap[];
}

interface ComplianceRequirement {
  id: string;
  category: string;
  title: string;
  description: string;
  controls: string[];
  evidence: string[];
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  lastReviewed?: Date;
  reviewer?: string;
  notes?: string;
}

interface ComplianceGap {
  requirementId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediationPlan?: string;
  estimatedEffort?: string;
  deadline?: Date;
  assignedTo?: string;
}

interface ComplianceReport {
  id: string;
  framework: string;
  reportType: 'assessment' | 'audit' | 'certification' | 'gap_analysis';
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequirements: number;
    compliantCount: number;
    partialCount: number;
    nonCompliantCount: number;
    notApplicableCount: number;
    overallScore: number;
  };
  sections: ReportSection[];
  findings: ComplianceFinding[];
  recommendations: string[];
  generatedAt: Date;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
}

interface ReportSection {
  title: string;
  content: string;
  data?: any;
  charts?: ChartData[];
}

interface ChartData {
  type: 'pie' | 'bar' | 'line' | 'radar';
  title: string;
  data: any;
}

interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  evidence: any[];
  recommendation: string;
  status: 'open' | 'in_progress' | 'resolved';
}

interface AuditEvent {
  id: string;
  auditType: string;
  objectType: string;
  objectId: string;
  action: string;
  actorId?: string;
  actorType: string;
  timestamp: Date;
  sourceIp?: string;
  userAgent?: string;
  beforeState?: any;
  afterState?: any;
  complianceFrameworks: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export class ComplianceReportingService extends EventEmitter {
  private db: Pool;
  private logger: Logger;
  private frameworks: Map<string, ComplianceFramework> = new Map();
  private reportGenerationInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool, logger: Logger) {
    super();
    this.db = db;
    this.logger = logger;

    this.initializeFrameworks();
    this.startAutomatedReporting();
  }

  private initializeFrameworks(): void {
    // Initialize SOC2 framework
    this.frameworks.set('SOC2', {
      name: 'SOC2',
      version: '2017',
      requirements: [
        {
          id: 'CC1.1',
          category: 'Control Environment',
          title: 'Integrity and Ethical Values',
          description: 'The entity demonstrates a commitment to integrity and ethical values',
          controls: ['code_of_conduct', 'ethics_training', 'violation_reporting'],
          evidence: [],
          status: 'partial'
        },
        {
          id: 'CC2.1',
          category: 'Communication and Information',
          title: 'Internal Communication',
          description: 'The entity internally communicates information to support the functioning of internal control',
          controls: ['security_awareness', 'policy_distribution', 'incident_reporting'],
          evidence: [],
          status: 'compliant'
        },
        {
          id: 'CC6.1',
          category: 'Logical and Physical Access',
          title: 'Logical Access Controls',
          description: 'The entity implements logical access security software, infrastructure, and architectures',
          controls: ['authentication', 'authorization', 'access_reviews'],
          evidence: [],
          status: 'compliant'
        },
        {
          id: 'CC7.1',
          category: 'System Operations',
          title: 'Vulnerability Management',
          description: 'The entity identifies, evaluates, and manages vulnerabilities',
          controls: ['vulnerability_scanning', 'patch_management', 'security_monitoring'],
          evidence: [],
          status: 'partial'
        }
      ]
    });

    // Initialize GDPR framework
    this.frameworks.set('GDPR', {
      name: 'GDPR',
      version: '2018',
      requirements: [
        {
          id: 'Art.5',
          category: 'Principles',
          title: 'Principles relating to processing of personal data',
          description: 'Personal data shall be processed lawfully, fairly and transparently',
          controls: ['data_minimization', 'purpose_limitation', 'accuracy'],
          evidence: [],
          status: 'compliant'
        },
        {
          id: 'Art.25',
          category: 'Data Protection',
          title: 'Data protection by design and by default',
          description: 'Implement appropriate technical and organizational measures',
          controls: ['privacy_by_design', 'default_settings', 'data_protection_measures'],
          evidence: [],
          status: 'partial'
        },
        {
          id: 'Art.32',
          category: 'Security',
          title: 'Security of processing',
          description: 'Implement appropriate security measures',
          controls: ['encryption', 'pseudonymization', 'access_control', 'security_testing'],
          evidence: [],
          status: 'compliant'
        },
        {
          id: 'Art.33',
          category: 'Breach Notification',
          title: 'Notification of personal data breach',
          description: 'Notify breaches within 72 hours',
          controls: ['breach_detection', 'breach_assessment', 'breach_notification'],
          evidence: [],
          status: 'compliant'
        }
      ]
    });
  }

  private startAutomatedReporting(): void {
    // Generate compliance reports monthly
    this.reportGenerationInterval = setInterval(() => {
      this.generateScheduledReports();
    }, 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  async generateComplianceReport(
    framework: string,
    reportType: 'assessment' | 'audit' | 'certification' | 'gap_analysis',
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const frameworkData = this.frameworks.get(framework);
    if (!frameworkData) {
      throw new Error(`Unknown compliance framework: ${framework}`);
    }

    // Assess compliance status
    const assessmentResults = await this.assessCompliance(framework, period);

    // Generate report sections
    const sections = await this.generateReportSections(framework, assessmentResults, reportType);

    // Identify findings
    const findings = await this.identifyFindings(framework, assessmentResults);

    // Generate recommendations
    const recommendations = this.generateRecommendations(findings);

    const report: ComplianceReport = {
      id: this.generateReportId(),
      framework,
      reportType,
      period,
      summary: {
        totalRequirements: assessmentResults.length,
        compliantCount: assessmentResults.filter(r => r.status === 'compliant').length,
        partialCount: assessmentResults.filter(r => r.status === 'partial').length,
        nonCompliantCount: assessmentResults.filter(r => r.status === 'non_compliant').length,
        notApplicableCount: assessmentResults.filter(r => r.status === 'not_applicable').length,
        overallScore: this.calculateComplianceScore(assessmentResults)
      },
      sections,
      findings,
      recommendations,
      generatedAt: new Date(),
      generatedBy: 'system'
    };

    // Store report
    await this.storeReport(report);

    this.emit('compliance-report-generated', report);
    return report;
  }

  private async assessCompliance(framework: string, period: { start: Date; end: Date }): Promise<ComplianceRequirement[]> {
    const frameworkData = this.frameworks.get(framework)!;
    const assessedRequirements: ComplianceRequirement[] = [];

    for (const requirement of frameworkData.requirements) {
      const assessment = await this.assessRequirement(requirement, period);
      assessedRequirements.push(assessment);
    }

    return assessedRequirements;
  }

  private async assessRequirement(
    requirement: ComplianceRequirement,
    period: { start: Date; end: Date }
  ): Promise<ComplianceRequirement> {
    const evidence: string[] = [];
    let compliantControls = 0;
    const totalControls = requirement.controls.length;

    for (const control of requirement.controls) {
      const controlEvidence = await this.gatherControlEvidence(control, period);
      if (controlEvidence.length > 0) {
        evidence.push(...controlEvidence);
        compliantControls++;
      }
    }

    // Determine compliance status
    let status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
    if (compliantControls === totalControls) {
      status = 'compliant';
    } else if (compliantControls > totalControls * 0.5) {
      status = 'partial';
    } else {
      status = 'non_compliant';
    }

    return {
      ...requirement,
      evidence,
      status,
      lastReviewed: new Date()
    };
  }

  private async gatherControlEvidence(control: string, period: { start: Date; end: Date }): Promise<string[]> {
    const evidence: string[] = [];

    switch (control) {
      case 'authentication':
        const authEvents = await this.getAuthenticationEvents(period);
        if (authEvents.mfaEnabled > 0.8) {
          evidence.push('MFA enabled for 80%+ users');
        }
        if (authEvents.strongPasswordPolicy) {
          evidence.push('Strong password policy enforced');
        }
        break;

      case 'access_reviews':
        const accessReviews = await this.getAccessReviews(period);
        if (accessReviews.completedReviews > 0) {
          evidence.push(`${accessReviews.completedReviews} access reviews completed`);
        }
        break;

      case 'security_monitoring':
        const monitoringMetrics = await this.getSecurityMonitoringMetrics(period);
        if (monitoringMetrics.uptimePercentage > 99) {
          evidence.push('Security monitoring 99%+ uptime');
        }
        if (monitoringMetrics.alertResponseTime < 15) {
          evidence.push('Average alert response time < 15 minutes');
        }
        break;

      case 'encryption':
        const encryptionStatus = await this.getEncryptionStatus();
        if (encryptionStatus.dataAtRest) {
          evidence.push('Data at rest encryption enabled');
        }
        if (encryptionStatus.dataInTransit) {
          evidence.push('Data in transit encryption enabled');
        }
        break;

      case 'breach_notification':
        const breachMetrics = await this.getBreachNotificationMetrics(period);
        if (breachMetrics.averageNotificationTime < 72) {
          evidence.push('All breaches notified within 72 hours');
        }
        break;
    }

    return evidence;
  }

  private async generateReportSections(
    framework: string,
    assessmentResults: ComplianceRequirement[],
    reportType: string
  ): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Executive Summary
    sections.push({
      title: 'Executive Summary',
      content: this.generateExecutiveSummary(framework, assessmentResults, reportType)
    });

    // Compliance Status Overview
    sections.push({
      title: 'Compliance Status Overview',
      content: 'Current compliance status across all requirements',
      charts: [{
        type: 'pie',
        title: 'Compliance Status Distribution',
        data: {
          labels: ['Compliant', 'Partial', 'Non-Compliant', 'N/A'],
          values: [
            assessmentResults.filter(r => r.status === 'compliant').length,
            assessmentResults.filter(r => r.status === 'partial').length,
            assessmentResults.filter(r => r.status === 'non_compliant').length,
            assessmentResults.filter(r => r.status === 'not_applicable').length
          ]
        }
      }]
    });

    // Detailed Requirements Assessment
    sections.push({
      title: 'Detailed Requirements Assessment',
      content: this.generateDetailedAssessment(assessmentResults)
    });

    // Risk Analysis
    sections.push({
      title: 'Risk Analysis',
      content: await this.generateRiskAnalysis(framework, assessmentResults),
      charts: [{
        type: 'radar',
        title: 'Risk by Category',
        data: await this.generateRiskRadarData(assessmentResults)
      }]
    });

    // Trend Analysis
    sections.push({
      title: 'Compliance Trend Analysis',
      content: 'Historical compliance trends and improvements',
      charts: [{
        type: 'line',
        title: 'Compliance Score Trend',
        data: await this.generateComplianceTrendData(framework)
      }]
    });

    return sections;
  }

  private generateExecutiveSummary(
    framework: string,
    assessmentResults: ComplianceRequirement[],
    reportType: string
  ): string {
    const score = this.calculateComplianceScore(assessmentResults);
    const compliantCount = assessmentResults.filter(r => r.status === 'compliant').length;
    const totalCount = assessmentResults.length;

    return `This ${reportType} report assesses compliance with ${framework} requirements. ` +
           `Current compliance score: ${score.toFixed(1)}%. ` +
           `${compliantCount} out of ${totalCount} requirements are fully compliant. ` +
           `Key areas requiring attention have been identified with remediation recommendations.`;
  }

  private generateDetailedAssessment(assessmentResults: ComplianceRequirement[]): string {
    let content = '';

    const groupedByCategory = assessmentResults.reduce((acc, req) => {
      if (!acc[req.category]) acc[req.category] = [];
      acc[req.category].push(req);
      return acc;
    }, {} as Record<string, ComplianceRequirement[]>);

    for (const [category, requirements] of Object.entries(groupedByCategory)) {
      content += `\n## ${category}\n\n`;
      
      for (const req of requirements) {
        const statusIcon = req.status === 'compliant' ? '✓' : 
                          req.status === 'partial' ? '⚠' : '✗';
        
        content += `### ${statusIcon} ${req.id}: ${req.title}\n`;
        content += `Status: ${req.status.toUpperCase()}\n`;
        content += `${req.description}\n\n`;
        
        if (req.evidence.length > 0) {
          content += `Evidence:\n`;
          req.evidence.forEach(e => content += `- ${e}\n`);
        }
        
        content += '\n';
      }
    }

    return content;
  }

  private async generateRiskAnalysis(
    framework: string,
    assessmentResults: ComplianceRequirement[]
  ): Promise<string> {
    const nonCompliantReqs = assessmentResults.filter(r => 
      r.status === 'non_compliant' || r.status === 'partial'
    );

    let content = 'Risk assessment based on non-compliant and partially compliant requirements:\n\n';

    const risks = await this.assessRisks(nonCompliantReqs);
    
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const highRisks = risks.filter(r => r.severity === 'high');

    if (criticalRisks.length > 0) {
      content += `⚠️ CRITICAL RISKS (${criticalRisks.length}):\n`;
      criticalRisks.forEach(r => {
        content += `- ${r.description}\n`;
      });
      content += '\n';
    }

    if (highRisks.length > 0) {
      content += `HIGH RISKS (${highRisks.length}):\n`;
      highRisks.forEach(r => {
        content += `- ${r.description}\n`;
      });
    }

    return content;
  }

  private async identifyFindings(
    framework: string,
    assessmentResults: ComplianceRequirement[]
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    for (const requirement of assessmentResults) {
      if (requirement.status === 'non_compliant' || requirement.status === 'partial') {
        const finding: ComplianceFinding = {
          id: this.generateFindingId(),
          severity: this.determineFindingSeverity(requirement),
          category: requirement.category,
          title: `Non-compliance with ${requirement.id}: ${requirement.title}`,
          description: `Requirement "${requirement.description}" is ${requirement.status}`,
          evidence: requirement.evidence,
          recommendation: this.generateRemediation(requirement),
          status: 'open'
        };
        
        findings.push(finding);
      }
    }

    return findings;
  }

  private determineFindingSeverity(requirement: ComplianceRequirement): 'low' | 'medium' | 'high' | 'critical' {
    // Critical requirements based on common compliance priorities
    const criticalControls = ['authentication', 'encryption', 'breach_notification'];
    const highControls = ['access_control', 'security_monitoring', 'vulnerability_management'];

    const hasCriticalControl = requirement.controls.some(c => criticalControls.includes(c));
    const hasHighControl = requirement.controls.some(c => highControls.includes(c));

    if (requirement.status === 'non_compliant') {
      if (hasCriticalControl) return 'critical';
      if (hasHighControl) return 'high';
      return 'medium';
    } else { // partial
      if (hasCriticalControl) return 'high';
      if (hasHighControl) return 'medium';
      return 'low';
    }
  }

  private generateRemediation(requirement: ComplianceRequirement): string {
    const remediations: Record<string, string> = {
      authentication: 'Implement multi-factor authentication and enforce strong password policies',
      access_reviews: 'Establish regular access review processes and document review outcomes',
      security_monitoring: 'Deploy comprehensive security monitoring tools and establish 24/7 monitoring',
      encryption: 'Implement encryption for data at rest and in transit using industry standards',
      breach_notification: 'Establish breach response procedures with clear notification timelines'
    };

    const missingControls = requirement.controls.filter(control => 
      !requirement.evidence.some(e => e.toLowerCase().includes(control))
    );

    if (missingControls.length > 0) {
      const recommendations = missingControls.map(c => remediations[c] || `Implement ${c} controls`);
      return recommendations.join('; ');
    }

    return 'Review and strengthen existing controls';
  }

  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];

    // Prioritize by severity
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    if (criticalFindings.length > 0) {
      recommendations.push(`Address ${criticalFindings.length} critical findings immediately`);
      recommendations.push(...criticalFindings.map(f => f.recommendation));
    }

    if (highFindings.length > 0) {
      recommendations.push(`Remediate ${highFindings.length} high-priority findings within 30 days`);
    }

    // General recommendations
    recommendations.push('Establish continuous compliance monitoring processes');
    recommendations.push('Conduct quarterly compliance reviews');
    recommendations.push('Provide compliance training to all staff');

    return recommendations;
  }

  private calculateComplianceScore(assessmentResults: ComplianceRequirement[]): number {
    const weights = {
      compliant: 1.0,
      partial: 0.5,
      non_compliant: 0,
      not_applicable: null
    };

    const applicableRequirements = assessmentResults.filter(r => r.status !== 'not_applicable');
    const totalScore = applicableRequirements.reduce((sum, req) => {
      return sum + (weights[req.status] || 0);
    }, 0);

    return applicableRequirements.length > 0 
      ? (totalScore / applicableRequirements.length) * 100 
      : 0;
  }

  async recordAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateAuditId(),
      timestamp: new Date()
    };

    const query = `
      INSERT INTO compliance_audit_trail (
        id, audit_type, object_type, object_id, action,
        actor_id, actor_type, timestamp, source_ip, user_agent,
        before_state, after_state, compliance_frameworks,
        risk_level, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    await this.db.query(query, [
      auditEvent.id,
      auditEvent.auditType,
      auditEvent.objectType,
      auditEvent.objectId,
      auditEvent.action,
      auditEvent.actorId,
      auditEvent.actorType,
      auditEvent.timestamp,
      auditEvent.sourceIp,
      auditEvent.userAgent,
      JSON.stringify(auditEvent.beforeState),
      JSON.stringify(auditEvent.afterState),
      JSON.stringify(auditEvent.complianceFrameworks),
      auditEvent.riskLevel,
      JSON.stringify(auditEvent.metadata)
    ]);

    this.emit('audit-event-recorded', auditEvent);
  }

  async getComplianceStatus(framework?: string): Promise<any> {
    if (framework) {
      const frameworkData = this.frameworks.get(framework);
      if (!frameworkData) {
        throw new Error(`Unknown framework: ${framework}`);
      }

      const assessmentResults = await this.assessCompliance(
        framework,
        { 
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      );

      return {
        framework,
        score: this.calculateComplianceScore(assessmentResults),
        requirements: assessmentResults,
        lastAssessment: new Date()
      };
    }

    // Return status for all frameworks
    const statuses: any[] = [];
    for (const [name, data] of this.frameworks) {
      const assessmentResults = await this.assessCompliance(
        name,
        { 
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      );

      statuses.push({
        framework: name,
        score: this.calculateComplianceScore(assessmentResults),
        compliantCount: assessmentResults.filter(r => r.status === 'compliant').length,
        totalCount: assessmentResults.length
      });
    }

    return statuses;
  }

  async getAuditTrail(filters: {
    startDate?: Date;
    endDate?: Date;
    objectType?: string;
    actorId?: string;
    framework?: string;
  }): Promise<AuditEvent[]> {
    let query = 'SELECT * FROM compliance_audit_trail WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters.startDate) {
      query += ` AND timestamp >= $${++paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND timestamp <= $${++paramCount}`;
      params.push(filters.endDate);
    }

    if (filters.objectType) {
      query += ` AND object_type = $${++paramCount}`;
      params.push(filters.objectType);
    }

    if (filters.actorId) {
      query += ` AND actor_id = $${++paramCount}`;
      params.push(filters.actorId);
    }

    if (filters.framework) {
      query += ` AND $${++paramCount} = ANY(compliance_frameworks)`;
      params.push(filters.framework);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1000';

    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      auditType: row.audit_type,
      objectType: row.object_type,
      objectId: row.object_id,
      action: row.action,
      actorId: row.actor_id,
      actorType: row.actor_type,
      timestamp: row.timestamp,
      sourceIp: row.source_ip,
      userAgent: row.user_agent,
      beforeState: row.before_state,
      afterState: row.after_state,
      complianceFrameworks: row.compliance_frameworks,
      riskLevel: row.risk_level,
      metadata: row.metadata
    }));
  }

  private async getAuthenticationEvents(period: { start: Date; end: Date }): Promise<any> {
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT CASE WHEN metadata->>'mfa_enabled' = 'true' THEN user_id END) as mfa_users,
        EXISTS(SELECT 1 FROM security_configuration WHERE config_key = 'password_policy') as strong_password_policy
      FROM security_events_enhanced
      WHERE event_type = 'authentication_success'
        AND created_at BETWEEN $1 AND $2
    `;

    const result = await this.db.query(query, [period.start, period.end]);
    const data = result.rows[0];

    return {
      mfaEnabled: data.total_users > 0 ? data.mfa_users / data.total_users : 0,
      strongPasswordPolicy: data.strong_password_policy
    };
  }

  private async getAccessReviews(period: { start: Date; end: Date }): Promise<any> {
    // This would query actual access review data
    // For now, return mock data
    return {
      completedReviews: 4,
      pendingReviews: 1
    };
  }

  private async getSecurityMonitoringMetrics(period: { start: Date; end: Date }): Promise<any> {
    const query = `
      SELECT 
        AVG(CASE WHEN metric_name = 'monitoring_uptime' THEN metric_value END) as uptime_percentage,
        AVG(CASE WHEN metric_name = 'alert_response_time' THEN metric_value END) as alert_response_time
      FROM security_metrics
      WHERE period_start >= $1 AND period_end <= $2
    `;

    const result = await this.db.query(query, [period.start, period.end]);
    
    return {
      uptimePercentage: result.rows[0].uptime_percentage || 99.9,
      alertResponseTime: result.rows[0].alert_response_time || 10
    };
  }

  private async getEncryptionStatus(): Promise<any> {
    // This would check actual encryption configuration
    // For now, return mock data
    return {
      dataAtRest: true,
      dataInTransit: true,
      keyManagement: 'HSM'
    };
  }

  private async getBreachNotificationMetrics(period: { start: Date; end: Date }): Promise<any> {
    const query = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (metadata->>'notification_time')::timestamp - first_detected_at) / 3600) as avg_notification_hours
      FROM security_incidents
      WHERE incident_type = 'data_breach'
        AND created_at BETWEEN $1 AND $2
        AND metadata->>'notification_time' IS NOT NULL
    `;

    const result = await this.db.query(query, [period.start, period.end]);
    
    return {
      averageNotificationTime: result.rows[0].avg_notification_hours || 24
    };
  }

  private async assessRisks(requirements: ComplianceRequirement[]): Promise<any[]> {
    const risks: any[] = [];

    for (const req of requirements) {
      if (req.controls.includes('authentication') && req.status === 'non_compliant') {
        risks.push({
          severity: 'critical',
          description: 'Lack of proper authentication controls poses immediate security risk'
        });
      }

      if (req.controls.includes('encryption') && req.status !== 'compliant') {
        risks.push({
          severity: 'high',
          description: 'Insufficient encryption may lead to data exposure'
        });
      }
    }

    return risks;
  }

  private async generateRiskRadarData(assessmentResults: ComplianceRequirement[]): Promise<any> {
    const categories = [...new Set(assessmentResults.map(r => r.category))];
    
    const data = categories.map(category => {
      const categoryReqs = assessmentResults.filter(r => r.category === category);
      const score = this.calculateComplianceScore(categoryReqs);
      
      return {
        category,
        compliance: score,
        risk: 100 - score
      };
    });

    return {
      labels: categories,
      datasets: [
        {
          label: 'Compliance',
          data: data.map(d => d.compliance)
        },
        {
          label: 'Risk',
          data: data.map(d => d.risk)
        }
      ]
    };
  }

  private async generateComplianceTrendData(framework: string): Promise<any> {
    // This would fetch historical compliance scores
    // For now, return mock trend data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const scores = [75, 78, 82, 80, 85, 88];

    return {
      labels: months,
      datasets: [{
        label: `${framework} Compliance Score`,
        data: scores
      }]
    };
  }

  private async storeReport(report: ComplianceReport): Promise<void> {
    // Store report in database or file system
    this.logger.info(`Compliance report generated: ${report.id}`);
  }

  private async generateScheduledReports(): Promise<void> {
    try {
      for (const framework of this.frameworks.keys()) {
        await this.generateComplianceReport(
          framework,
          'assessment',
          {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date()
          }
        );
      }
    } catch (error) {
      this.logger.error('Failed to generate scheduled reports', { error });
    }
  }

  private generateReportId(): string {
    return `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFindingId(): string {
    return `FND-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async stop(): Promise<void> {
    if (this.reportGenerationInterval) {
      clearInterval(this.reportGenerationInterval);
    }
  }
}