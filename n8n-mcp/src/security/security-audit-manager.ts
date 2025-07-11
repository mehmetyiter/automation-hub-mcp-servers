import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

interface AuditLog {
  id: string;
  timestamp: Date;
  actorId?: string;
  actorType: 'user' | 'system' | 'api' | 'admin';
  action: string;
  resourceType: string;
  resourceId: string;
  details: {
    method?: string;
    endpoint?: string;
    ipAddress?: string;
    userAgent?: string;
    requestBody?: any;
    responseStatus?: number;
    duration?: number;
    changes?: ChangeRecord[];
    error?: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  sessionId?: string;
  correlationId?: string;
}

interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  sensitive?: boolean;
}

interface AuditRule {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  actions: string[];
  conditions: AuditCondition[];
  alerting: {
    enabled: boolean;
    channels: string[];
    threshold?: number;
    timeWindow?: string;
  };
  retention: {
    days: number;
    archiveAfterDays?: number;
  };
}

interface AuditCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'in' | 'not_in';
  value: any;
}

interface AuditReport {
  id: string;
  title: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    criticalEvents: number;
    suspiciousActivities: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; eventCount: number }>;
  };
  findings: AuditFinding[];
  recommendations: string[];
  generatedAt: Date;
}

interface AuditFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  evidence: AuditLog[];
  pattern?: string;
  affectedUsers?: string[];
  timeRange?: { start: Date; end: Date };
}

interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
  resourceType?: string;
  action?: string;
  riskLevel?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export class SecurityAuditManager extends EventEmitter {
  private db: Pool;
  private logger: Logger;
  private auditRules: Map<string, AuditRule> = new Map();
  private auditBuffer: AuditLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool, logger: Logger) {
    super();
    this.db = db;
    this.logger = logger;

    this.initializeAuditRules();
    this.startBufferFlush();
    this.startAuditAnalysis();
  }

  private initializeAuditRules(): void {
    const rules: AuditRule[] = [
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Detection',
        description: 'Detect attempts to escalate privileges',
        resourceTypes: ['user', 'role', 'permission'],
        actions: ['update', 'grant', 'assign'],
        conditions: [
          {
            field: 'details.changes.field',
            operator: 'in',
            value: ['role', 'permissions', 'isAdmin']
          }
        ],
        alerting: {
          enabled: true,
          channels: ['email', 'slack'],
          threshold: 1
        },
        retention: {
          days: 365,
          archiveAfterDays: 90
        }
      },
      {
        id: 'data_exfiltration',
        name: 'Data Exfiltration Detection',
        description: 'Detect potential data exfiltration attempts',
        resourceTypes: ['data', 'export', 'report'],
        actions: ['export', 'download', 'bulk_read'],
        conditions: [
          {
            field: 'details.responseSize',
            operator: 'equals',
            value: 'large'
          }
        ],
        alerting: {
          enabled: true,
          channels: ['security_team'],
          threshold: 5,
          timeWindow: '1h'
        },
        retention: {
          days: 180
        }
      },
      {
        id: 'suspicious_access',
        name: 'Suspicious Access Pattern',
        description: 'Detect suspicious access patterns',
        resourceTypes: ['*'],
        actions: ['*'],
        conditions: [
          {
            field: 'riskLevel',
            operator: 'in',
            value: ['high', 'critical']
          }
        ],
        alerting: {
          enabled: true,
          channels: ['soc'],
          threshold: 3,
          timeWindow: '15m'
        },
        retention: {
          days: 90
        }
      }
    ];

    for (const rule of rules) {
      this.auditRules.set(rule.id, rule);
    }
  }

  private startBufferFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushAuditBuffer();
    }, 5000); // Flush every 5 seconds
  }

  private startAuditAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.analyzeRecentAudits();
    }, 60000); // Analyze every minute
  }

  async logAudit(audit: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditLog: AuditLog = {
      ...audit,
      id: this.generateAuditId(),
      timestamp: new Date()
    };

    // Sanitize sensitive data
    auditLog.details = this.sanitizeDetails(auditLog.details);

    // Add to buffer
    this.auditBuffer.push(auditLog);

    // Check against rules for immediate alerting
    await this.checkAuditRules(auditLog);

    // Flush if buffer is large
    if (this.auditBuffer.length >= 100) {
      await this.flushAuditBuffer();
    }
  }

  private sanitizeDetails(details: any): any {
    const sanitized = { ...details };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
    
    if (sanitized.requestBody) {
      sanitized.requestBody = this.removeSensitiveFields(sanitized.requestBody, sensitiveFields);
    }

    if (sanitized.changes) {
      sanitized.changes = sanitized.changes.map((change: ChangeRecord) => {
        if (change.sensitive || sensitiveFields.some(field => change.field.toLowerCase().includes(field))) {
          return {
            ...change,
            oldValue: '[REDACTED]',
            newValue: '[REDACTED]',
            sensitive: true
          };
        }
        return change;
      });
    }

    return sanitized;
  }

  private removeSensitiveFields(obj: any, fields: string[]): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    const cleaned = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in cleaned) {
      if (fields.some(field => key.toLowerCase().includes(field))) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof cleaned[key] === 'object') {
        cleaned[key] = this.removeSensitiveFields(cleaned[key], fields);
      }
    }

    return cleaned;
  }

  private async flushAuditBuffer(): Promise<void> {
    if (this.auditBuffer.length === 0) return;

    const audits = [...this.auditBuffer];
    this.auditBuffer = [];

    try {
      const query = `
        INSERT INTO compliance_audit_trail (
          id, audit_type, object_type, object_id, action,
          actor_id, actor_type, timestamp, source_ip, user_agent,
          before_state, after_state, risk_level, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      for (const audit of audits) {
        await this.db.query(query, [
          audit.id,
          'security_audit',
          audit.resourceType,
          audit.resourceId,
          audit.action,
          audit.actorId,
          audit.actorType,
          audit.timestamp,
          audit.details.ipAddress,
          audit.details.userAgent,
          JSON.stringify(this.extractBeforeState(audit)),
          JSON.stringify(this.extractAfterState(audit)),
          audit.riskLevel,
          JSON.stringify({
            details: audit.details,
            tags: audit.tags,
            sessionId: audit.sessionId,
            correlationId: audit.correlationId
          })
        ]);
      }

      this.logger.info(`Flushed ${audits.length} audit logs`);
    } catch (error) {
      this.logger.error('Failed to flush audit buffer', { error });
      // Re-add to buffer for retry
      this.auditBuffer.unshift(...audits);
    }
  }

  private extractBeforeState(audit: AuditLog): any {
    if (!audit.details.changes || audit.details.changes.length === 0) return null;

    const beforeState: any = {};
    for (const change of audit.details.changes) {
      beforeState[change.field] = change.oldValue;
    }
    return beforeState;
  }

  private extractAfterState(audit: AuditLog): any {
    if (!audit.details.changes || audit.details.changes.length === 0) return null;

    const afterState: any = {};
    for (const change of audit.details.changes) {
      afterState[change.field] = change.newValue;
    }
    return afterState;
  }

  private async checkAuditRules(audit: AuditLog): Promise<void> {
    for (const [ruleId, rule] of this.auditRules) {
      if (this.matchesRule(audit, rule)) {
        await this.handleRuleMatch(audit, rule);
      }
    }
  }

  private matchesRule(audit: AuditLog, rule: AuditRule): boolean {
    // Check resource type
    if (!rule.resourceTypes.includes('*') && !rule.resourceTypes.includes(audit.resourceType)) {
      return false;
    }

    // Check action
    if (!rule.actions.includes('*') && !rule.actions.includes(audit.action)) {
      return false;
    }

    // Check conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(audit, condition)) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(audit: AuditLog, condition: AuditCondition): boolean {
    const value = this.getFieldValue(audit, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return false;
    }
  }

  private getFieldValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private async handleRuleMatch(audit: AuditLog, rule: AuditRule): Promise<void> {
    this.logger.warn(`Audit rule matched: ${rule.name}`, { audit, rule });

    if (rule.alerting.enabled) {
      // Check threshold
      if (rule.alerting.threshold) {
        const recentMatches = await this.countRecentRuleMatches(
          rule.id,
          rule.alerting.timeWindow || '1h'
        );

        if (recentMatches >= rule.alerting.threshold) {
          await this.sendAuditAlert(audit, rule);
        }
      } else {
        await this.sendAuditAlert(audit, rule);
      }
    }

    this.emit('audit-rule-matched', { audit, rule });
  }

  private async countRecentRuleMatches(ruleId: string, timeWindow: string): Promise<number> {
    const windowMinutes = this.parseTimeWindow(timeWindow);
    
    const query = `
      SELECT COUNT(*) as count
      FROM compliance_audit_trail
      WHERE metadata->>'ruleId' = $1
        AND timestamp > NOW() - INTERVAL '${windowMinutes} minutes'
    `;

    const result = await this.db.query(query, [ruleId]);
    return parseInt(result.rows[0].count);
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([mhd])$/);
    if (!match) return 60; // Default 1 hour

    const [, num, unit] = match;
    const value = parseInt(num);

    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 24 * 60;
      default: return 60;
    }
  }

  private async sendAuditAlert(audit: AuditLog, rule: AuditRule): Promise<void> {
    const alert = {
      type: 'audit_rule_violation',
      title: `Security Audit Alert: ${rule.name}`,
      message: `${rule.description}\n\nAction: ${audit.action} on ${audit.resourceType}`,
      severity: audit.riskLevel,
      source: 'audit_manager',
      channels: rule.alerting.channels,
      metadata: {
        audit,
        rule
      }
    };

    this.emit('security-alert', alert);
  }

  private async analyzeRecentAudits(): Promise<void> {
    try {
      // Analyze patterns in recent audits
      const suspiciousPatterns = await this.detectSuspiciousPatterns();
      
      for (const pattern of suspiciousPatterns) {
        const finding: AuditFinding = {
          id: this.generateFindingId(),
          severity: pattern.severity,
          type: pattern.type,
          description: pattern.description,
          evidence: pattern.evidence,
          pattern: pattern.pattern,
          affectedUsers: pattern.affectedUsers,
          timeRange: pattern.timeRange
        };

        this.emit('suspicious-activity-detected', finding);
      }
    } catch (error) {
      this.logger.error('Failed to analyze recent audits', { error });
    }
  }

  private async detectSuspiciousPatterns(): Promise<any[]> {
    const patterns: any[] = [];

    // Pattern 1: Rapid fire API calls
    const rapidFireQuery = `
      SELECT actor_id, COUNT(*) as count, 
             MIN(timestamp) as start_time,
             MAX(timestamp) as end_time
      FROM compliance_audit_trail
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
      GROUP BY actor_id
      HAVING COUNT(*) > 100
    `;

    const rapidFireResults = await this.db.query(rapidFireQuery);
    
    for (const row of rapidFireResults.rows) {
      patterns.push({
        type: 'rapid_fire_requests',
        severity: 'high',
        description: `User ${row.actor_id} made ${row.count} requests in 5 minutes`,
        evidence: [],
        affectedUsers: [row.actor_id],
        timeRange: {
          start: row.start_time,
          end: row.end_time
        }
      });
    }

    // Pattern 2: After hours access
    const afterHoursQuery = `
      SELECT DISTINCT actor_id, COUNT(*) as count
      FROM compliance_audit_trail
      WHERE timestamp > NOW() - INTERVAL '24 hours'
        AND (EXTRACT(HOUR FROM timestamp) < 6 OR EXTRACT(HOUR FROM timestamp) > 22)
      GROUP BY actor_id
      HAVING COUNT(*) > 10
    `;

    const afterHoursResults = await this.db.query(afterHoursQuery);
    
    for (const row of afterHoursResults.rows) {
      patterns.push({
        type: 'after_hours_access',
        severity: 'medium',
        description: `User ${row.actor_id} accessed system ${row.count} times after hours`,
        evidence: [],
        affectedUsers: [row.actor_id]
      });
    }

    // Pattern 3: Privilege escalation attempts
    const privEscQuery = `
      SELECT actor_id, COUNT(*) as count, 
             array_agg(object_id) as targets
      FROM compliance_audit_trail
      WHERE action IN ('grant', 'assign', 'elevate')
        AND object_type IN ('role', 'permission', 'user')
        AND timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY actor_id
      HAVING COUNT(*) > 3
    `;

    const privEscResults = await this.db.query(privEscQuery);
    
    for (const row of privEscResults.rows) {
      patterns.push({
        type: 'privilege_escalation_pattern',
        severity: 'critical',
        description: `User ${row.actor_id} attempted ${row.count} privilege changes`,
        evidence: [],
        affectedUsers: [row.actor_id],
        pattern: `Multiple permission changes targeting: ${row.targets.join(', ')}`
      });
    }

    return patterns;
  }

  async queryAudits(query: AuditQuery): Promise<AuditLog[]> {
    let sql = 'SELECT * FROM compliance_audit_trail WHERE audit_type = $1';
    const params: any[] = ['security_audit'];
    let paramCount = 1;

    if (query.startDate) {
      sql += ` AND timestamp >= $${++paramCount}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND timestamp <= $${++paramCount}`;
      params.push(query.endDate);
    }

    if (query.actorId) {
      sql += ` AND actor_id = $${++paramCount}`;
      params.push(query.actorId);
    }

    if (query.resourceType) {
      sql += ` AND object_type = $${++paramCount}`;
      params.push(query.resourceType);
    }

    if (query.action) {
      sql += ` AND action = $${++paramCount}`;
      params.push(query.action);
    }

    if (query.riskLevel) {
      sql += ` AND risk_level = $${++paramCount}`;
      params.push(query.riskLevel);
    }

    if (query.tags && query.tags.length > 0) {
      sql += ` AND metadata->'tags' ?| $${++paramCount}`;
      params.push(query.tags);
    }

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ` LIMIT $${++paramCount}`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET $${++paramCount}`;
      params.push(query.offset);
    }

    const result = await this.db.query(sql, params);
    
    return result.rows.map(row => this.parseAuditLog(row));
  }

  private parseAuditLog(row: any): AuditLog {
    const metadata = row.metadata || {};
    
    return {
      id: row.id,
      timestamp: row.timestamp,
      actorId: row.actor_id,
      actorType: row.actor_type,
      action: row.action,
      resourceType: row.object_type,
      resourceId: row.object_id,
      details: metadata.details || {},
      riskLevel: row.risk_level,
      tags: metadata.tags || [],
      sessionId: metadata.sessionId,
      correlationId: metadata.correlationId
    };
  }

  async generateAuditReport(period: { start: Date; end: Date }): Promise<AuditReport> {
    const summary = await this.generateAuditSummary(period);
    const findings = await this.generateAuditFindings(period);
    const recommendations = this.generateRecommendations(findings);

    const report: AuditReport = {
      id: this.generateReportId(),
      title: `Security Audit Report: ${period.start.toDateString()} - ${period.end.toDateString()}`,
      period,
      summary,
      findings,
      recommendations,
      generatedAt: new Date()
    };

    this.emit('audit-report-generated', report);
    return report;
  }

  private async generateAuditSummary(period: { start: Date; end: Date }): Promise<any> {
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT actor_id) as unique_users,
        COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_events,
        COUNT(CASE WHEN metadata->>'suspicious' = 'true' THEN 1 END) as suspicious_activities
      FROM compliance_audit_trail
      WHERE timestamp BETWEEN $1 AND $2
        AND audit_type = 'security_audit'
    `;

    const topActionsQuery = `
      SELECT action, COUNT(*) as count
      FROM compliance_audit_trail
      WHERE timestamp BETWEEN $1 AND $2
        AND audit_type = 'security_audit'
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `;

    const topUsersQuery = `
      SELECT actor_id as userId, COUNT(*) as eventCount
      FROM compliance_audit_trail
      WHERE timestamp BETWEEN $1 AND $2
        AND audit_type = 'security_audit'
        AND actor_id IS NOT NULL
      GROUP BY actor_id
      ORDER BY eventCount DESC
      LIMIT 10
    `;

    const [summaryResult, topActionsResult, topUsersResult] = await Promise.all([
      this.db.query(summaryQuery, [period.start, period.end]),
      this.db.query(topActionsQuery, [period.start, period.end]),
      this.db.query(topUsersQuery, [period.start, period.end])
    ]);

    return {
      ...summaryResult.rows[0],
      topActions: topActionsResult.rows,
      topUsers: topUsersResult.rows
    };
  }

  private async generateAuditFindings(period: { start: Date; end: Date }): Promise<AuditFinding[]> {
    const findings: AuditFinding[] = [];

    // Finding 1: High-risk activities
    const highRiskQuery = `
      SELECT * FROM compliance_audit_trail
      WHERE timestamp BETWEEN $1 AND $2
        AND risk_level IN ('high', 'critical')
        AND audit_type = 'security_audit'
      ORDER BY timestamp DESC
    `;

    const highRiskResult = await this.db.query(highRiskQuery, [period.start, period.end]);
    
    if (highRiskResult.rows.length > 0) {
      findings.push({
        id: this.generateFindingId(),
        severity: 'high',
        type: 'high_risk_activities',
        description: `${highRiskResult.rows.length} high-risk activities detected`,
        evidence: highRiskResult.rows.map(row => this.parseAuditLog(row))
      });
    }

    // Finding 2: Failed authentication attempts
    const failedAuthQuery = `
      SELECT actor_id, COUNT(*) as count
      FROM compliance_audit_trail
      WHERE timestamp BETWEEN $1 AND $2
        AND action = 'authentication_failed'
      GROUP BY actor_id
      HAVING COUNT(*) > 5
    `;

    const failedAuthResult = await this.db.query(failedAuthQuery, [period.start, period.end]);
    
    for (const row of failedAuthResult.rows) {
      findings.push({
        id: this.generateFindingId(),
        severity: 'medium',
        type: 'excessive_failed_auth',
        description: `User ${row.actor_id} had ${row.count} failed authentication attempts`,
        evidence: [],
        affectedUsers: [row.actor_id]
      });
    }

    // Finding 3: Privilege changes
    const privChangeQuery = `
      SELECT * FROM compliance_audit_trail
      WHERE timestamp BETWEEN $1 AND $2
        AND action IN ('grant', 'revoke', 'elevate')
        AND object_type IN ('role', 'permission')
      ORDER BY timestamp DESC
    `;

    const privChangeResult = await this.db.query(privChangeQuery, [period.start, period.end]);
    
    if (privChangeResult.rows.length > 0) {
      findings.push({
        id: this.generateFindingId(),
        severity: 'high',
        type: 'privilege_changes',
        description: `${privChangeResult.rows.length} privilege changes detected`,
        evidence: privChangeResult.rows.map(row => this.parseAuditLog(row))
      });
    }

    return findings;
  }

  private generateRecommendations(findings: AuditFinding[]): string[] {
    const recommendations: string[] = [];

    const highRiskFindings = findings.filter(f => f.severity === 'high' || f.severity === 'critical');
    const authFindings = findings.filter(f => f.type === 'excessive_failed_auth');
    const privFindings = findings.filter(f => f.type === 'privilege_changes');

    if (highRiskFindings.length > 0) {
      recommendations.push('Review and investigate all high-risk activities immediately');
      recommendations.push('Implement additional monitoring for critical operations');
    }

    if (authFindings.length > 0) {
      recommendations.push('Enable account lockout policies for repeated failed authentications');
      recommendations.push('Implement CAPTCHA or rate limiting for authentication endpoints');
      recommendations.push('Review accounts with excessive failed login attempts');
    }

    if (privFindings.length > 0) {
      recommendations.push('Implement approval workflow for privilege changes');
      recommendations.push('Conduct quarterly access reviews');
      recommendations.push('Enable alerts for all privilege escalations');
    }

    // General recommendations
    recommendations.push('Regularly review audit logs for suspicious patterns');
    recommendations.push('Implement automated anomaly detection for audit events');
    recommendations.push('Ensure audit log retention meets compliance requirements');

    return recommendations;
  }

  async exportAuditLogs(query: AuditQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const audits = await this.queryAudits(query);

    if (format === 'json') {
      return JSON.stringify(audits, null, 2);
    } else {
      // CSV format
      const headers = [
        'id', 'timestamp', 'actorId', 'actorType', 'action',
        'resourceType', 'resourceId', 'riskLevel', 'ipAddress',
        'duration', 'status'
      ];

      const rows = audits.map(audit => [
        audit.id,
        audit.timestamp.toISOString(),
        audit.actorId || '',
        audit.actorType,
        audit.action,
        audit.resourceType,
        audit.resourceId,
        audit.riskLevel,
        audit.details.ipAddress || '',
        audit.details.duration || '',
        audit.details.responseStatus || ''
      ]);

      return [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${v}"`).join(','))
      ].join('\n');
    }
  }

  async archiveOldAudits(): Promise<number> {
    // Archive audits based on retention rules
    let archivedCount = 0;

    for (const [ruleId, rule] of this.auditRules) {
      if (rule.retention.archiveAfterDays) {
        const archiveQuery = `
          INSERT INTO audit_archive
          SELECT * FROM compliance_audit_trail
          WHERE metadata->>'ruleId' = $1
            AND timestamp < NOW() - INTERVAL '${rule.retention.archiveAfterDays} days'
            AND audit_type = 'security_audit'
        `;

        const deleteQuery = `
          DELETE FROM compliance_audit_trail
          WHERE metadata->>'ruleId' = $1
            AND timestamp < NOW() - INTERVAL '${rule.retention.archiveAfterDays} days'
            AND audit_type = 'security_audit'
        `;

        try {
          await this.db.query('BEGIN');
          const archiveResult = await this.db.query(archiveQuery, [ruleId]);
          await this.db.query(deleteQuery, [ruleId]);
          await this.db.query('COMMIT');
          
          archivedCount += archiveResult.rowCount || 0;
        } catch (error) {
          await this.db.query('ROLLBACK');
          this.logger.error('Failed to archive audits', { error, ruleId });
        }
      }
    }

    this.logger.info(`Archived ${archivedCount} audit logs`);
    return archivedCount;
  }

  private generateAuditId(): string {
    return `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFindingId(): string {
    return `FND-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async stop(): Promise<void> {
    // Flush remaining audits
    await this.flushAuditBuffer();

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}