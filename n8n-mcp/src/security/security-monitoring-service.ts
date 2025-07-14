import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { logger } from '../utils/logger.js';
import { ThreatDetectionEngine } from './threat-detection-engine.js';
import { IncidentResponseService } from './incident-response-service.js';
import { AnomalyDetector } from './anomaly-detector.js';
import { ComplianceReportingService } from './compliance-reporting-service.js';
import { SecurityAuditManager } from './security-audit-manager.js';
import { createHash } from 'crypto';

interface SecurityEvent {
  id: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventCategory: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'network' | 'malware' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sourceIp?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  responseStatus?: number;
  geolocation?: {
    country?: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  };
  riskScore: number;
  confidenceScore: number;
  evidence: any[];
  metadata: Record<string, any>;
  timestamp: Date;
}

interface SecurityMetric {
  type: string;
  name: string;
  value: number;
  unit?: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  tags: Record<string, string>;
  metadata: Record<string, any>;
}

interface SecurityConfiguration {
  threatDetectionEnabled: boolean;
  anomalyDetectionSensitivity: number;
  incidentAutoAssignment: boolean;
  alertChannels: string[];
  complianceFrameworks: string[];
  securityMetricsRetentionDays: number;
  baselineUpdateFrequencyHours: number;
  incidentEscalationThresholdMinutes: number;
}

export class SecurityMonitoringService extends EventEmitter {
  private db: Pool;
  private logger: typeof logger;
  private threatEngine: ThreatDetectionEngine;
  private incidentService: IncidentResponseService;
  private anomalyDetector: AnomalyDetector;
  private complianceService: ComplianceReportingService;
  private auditManager: SecurityAuditManager;
  private config: SecurityConfiguration;
  private metricsBuffer: SecurityMetric[] = [];
  private metricsFlushInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool, loggerInstance: typeof logger) {
    super();
    this.db = db;
    this.logger = loggerInstance;

    // Initialize sub-services
    this.threatEngine = new ThreatDetectionEngine(db, loggerInstance);
    this.incidentService = new IncidentResponseService(db, loggerInstance);
    this.anomalyDetector = new AnomalyDetector(db, loggerInstance);
    this.complianceService = new ComplianceReportingService(db, loggerInstance);
    this.auditManager = new SecurityAuditManager(db, loggerInstance);

    // Load configuration
    this.config = {
      threatDetectionEnabled: true,
      anomalyDetectionSensitivity: 0.7,
      incidentAutoAssignment: true,
      alertChannels: ['email', 'slack'],
      complianceFrameworks: ['SOC2', 'GDPR'],
      securityMetricsRetentionDays: 90,
      baselineUpdateFrequencyHours: 24,
      incidentEscalationThresholdMinutes: 60
    };

    this.setupEventHandlers();
    this.startMetricsFlush();
  }

  private setupEventHandlers(): void {
    // Listen to threat detection events
    this.threatEngine.on('threat-detected', (threat) => {
      this.handleThreatDetected(threat);
    });

    // Listen to anomaly detection events
    this.anomalyDetector.on('anomaly-detected', (anomaly) => {
      this.handleAnomalyDetected(anomaly);
    });

    // Listen to incident events
    this.incidentService.on('incident-created', (incident) => {
      this.emit('security-incident', incident);
    });

    this.incidentService.on('incident-escalated', (incident) => {
      this.emit('incident-escalated', incident);
    });
  }

  private startMetricsFlush(): void {
    this.metricsFlushInterval = setInterval(() => {
      this.flushMetrics();
    }, 60000); // Flush every minute
  }

  async processSecurityEvent(event: Partial<SecurityEvent>): Promise<SecurityEvent> {
    try {
      // Enrich event data
      const enrichedEvent = await this.enrichSecurityEvent(event);

      // Store event
      const storedEvent = await this.storeSecurityEvent(enrichedEvent);

      // Analyze for threats
      if (this.config.threatDetectionEnabled) {
        await this.threatEngine.analyzeEvent(storedEvent);
      }

      // Check for anomalies
      await this.anomalyDetector.analyzeEvent(storedEvent);

      // Update security metrics
      this.updateSecurityMetrics(storedEvent);

      // Emit event for other services
      this.emit('security-event', storedEvent);

      return storedEvent;
    } catch (error) {
      this.logger.error('Failed to process security event', { error, event });
      throw error;
    }
  }

  private async enrichSecurityEvent(event: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const enriched: SecurityEvent = {
      id: event.id || this.generateEventId(),
      userId: event.userId,
      sessionId: event.sessionId,
      eventType: event.eventType || 'unknown',
      eventCategory: event.eventCategory || 'data_access',
      severity: event.severity || 'low',
      title: event.title || 'Security Event',
      description: event.description || '',
      sourceIp: event.sourceIp,
      userAgent: event.userAgent,
      requestPath: event.requestPath,
      requestMethod: event.requestMethod,
      responseStatus: event.responseStatus,
      geolocation: event.geolocation,
      riskScore: event.riskScore || 0,
      confidenceScore: event.confidenceScore || 0,
      evidence: event.evidence || [],
      metadata: event.metadata || {},
      timestamp: event.timestamp || new Date()
    };

    // Enrich with geolocation if IP is provided
    if (enriched.sourceIp && !enriched.geolocation) {
      enriched.geolocation = await this.getGeolocation(enriched.sourceIp);
    }

    // Calculate risk score if not provided
    if (!event.riskScore) {
      enriched.riskScore = await this.calculateRiskScore(enriched);
    }

    return enriched;
  }

  private async storeSecurityEvent(event: SecurityEvent): Promise<SecurityEvent> {
    const query = `
      INSERT INTO security_events_enhanced (
        id, user_id, session_id, event_type, event_category,
        severity, status, title, description, source_ip,
        user_agent, request_path, request_method, response_status,
        geolocation, risk_score, confidence_score, evidence,
        metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const values = [
      event.id,
      event.userId,
      event.sessionId,
      event.eventType,
      event.eventCategory,
      event.severity,
      'open',
      event.title,
      event.description,
      event.sourceIp,
      event.userAgent,
      event.requestPath,
      event.requestMethod,
      event.responseStatus,
      JSON.stringify(event.geolocation),
      event.riskScore,
      event.confidenceScore,
      JSON.stringify(event.evidence),
      JSON.stringify(event.metadata),
      event.timestamp
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  private async calculateRiskScore(event: SecurityEvent): Promise<number> {
    let score = 0;

    // Base score by severity
    const severityScores = {
      low: 20,
      medium: 40,
      high: 70,
      critical: 90
    };
    score = severityScores[event.severity];

    // Adjust based on event category
    const categoryMultipliers = {
      authentication: 1.2,
      authorization: 1.3,
      data_access: 1.0,
      configuration: 1.4,
      network: 1.1,
      malware: 1.5,
      policy_violation: 1.2
    };
    score *= categoryMultipliers[event.eventCategory];

    // Adjust based on user history
    if (event.userId) {
      const userRisk = await this.getUserRiskLevel(event.userId);
      score *= userRisk;
    }

    // Adjust based on source IP reputation
    if (event.sourceIp) {
      const ipRisk = await this.getIpRiskLevel(event.sourceIp);
      score *= ipRisk;
    }

    return Math.min(100, Math.round(score));
  }

  private async getUserRiskLevel(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as event_count,
             SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) as high_severity_count
      FROM security_events_enhanced
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '30 days'
    `;

    const result = await this.db.query(query, [userId]);
    const { event_count, high_severity_count } = result.rows[0];

    if (high_severity_count > 5) return 1.5;
    if (high_severity_count > 2) return 1.2;
    if (event_count > 100) return 1.1;
    return 1.0;
  }

  private async getIpRiskLevel(ip: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as event_count,
             AVG(risk_score) as avg_risk_score
      FROM security_events_enhanced
      WHERE source_ip = $1
        AND created_at > NOW() - INTERVAL '7 days'
    `;

    const result = await this.db.query(query, [ip]);
    const { event_count, avg_risk_score } = result.rows[0];

    if (avg_risk_score > 70) return 1.4;
    if (avg_risk_score > 50) return 1.2;
    if (event_count > 50) return 1.1;
    return 1.0;
  }

  private async getGeolocation(ip: string): Promise<any> {
    // In a real implementation, this would call a geolocation API
    // For now, return mock data
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown'
    };
  }

  private updateSecurityMetrics(event: SecurityEvent): void {
    // Track event count by type
    this.addMetric({
      type: 'security_events',
      name: `events_${event.eventType}`,
      value: 1,
      unit: 'count',
      period: 'hourly',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 3600000),
      tags: {
        severity: event.severity,
        category: event.eventCategory
      },
      metadata: {}
    });

    // Track risk scores
    this.addMetric({
      type: 'risk_score',
      name: 'average_risk_score',
      value: event.riskScore,
      unit: 'score',
      period: 'hourly',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 3600000),
      tags: {
        severity: event.severity
      },
      metadata: {}
    });
  }

  private addMetric(metric: SecurityMetric): void {
    this.metricsBuffer.push(metric);

    // Flush if buffer is large
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const query = `
        INSERT INTO security_metrics (
          metric_type, metric_name, metric_value, metric_unit,
          measurement_period, period_start, period_end, tags, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (metric_type, metric_name, period_start, period_end)
        DO UPDATE SET 
          metric_value = security_metrics.metric_value + EXCLUDED.metric_value,
          tags = EXCLUDED.tags,
          metadata = EXCLUDED.metadata
      `;

      for (const metric of metrics) {
        await this.db.query(query, [
          metric.type,
          metric.name,
          metric.value,
          metric.unit,
          metric.period,
          metric.periodStart,
          metric.periodEnd,
          JSON.stringify(metric.tags),
          JSON.stringify(metric.metadata)
        ]);
      }
    } catch (error) {
      this.logger.error('Failed to flush security metrics', { error });
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }

  private async handleThreatDetected(threat: any): Promise<void> {
    this.logger.warn('Threat detected', { threat });

    // Create or update incident
    const incident = await this.incidentService.createOrUpdateIncident({
      title: threat.title,
      description: threat.description,
      type: threat.type,
      severity: threat.severity,
      eventIds: threat.eventIds
    });

    // Send alerts
    await this.sendSecurityAlert({
      type: 'threat_detected',
      title: `Threat Detected: ${threat.title}`,
      message: threat.description,
      severity: threat.severity,
      incidentId: incident.id
    });
  }

  private async handleAnomalyDetected(anomaly: any): Promise<void> {
    this.logger.warn('Anomaly detected', { anomaly });

    // Create security event for the anomaly
    await this.processSecurityEvent({
      eventType: 'anomaly_detected',
      eventCategory: 'policy_violation',
      severity: anomaly.severity || 'medium',
      title: `Anomaly Detected: ${anomaly.type}`,
      description: anomaly.description,
      userId: anomaly.userId,
      riskScore: anomaly.score,
      evidence: [anomaly],
      metadata: anomaly.metadata
    });
  }

  private async sendSecurityAlert(alert: any): Promise<void> {
    const query = `
      INSERT INTO security_alerts (
        alert_type, title, message, severity, source,
        target_audience, delivery_channels, related_incident_id,
        metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `;

    const values = [
      alert.type,
      alert.title,
      alert.message,
      alert.severity,
      'security_monitoring',
      'security_team',
      JSON.stringify(this.config.alertChannels),
      alert.incidentId,
      JSON.stringify(alert.metadata || {})
    ];

    await this.db.query(query, values);

    // Emit alert for delivery
    this.emit('security-alert', alert);
  }

  async getSecurityDashboard(): Promise<any> {
    const [
      criticalEvents,
      openIncidents,
      recentAlerts,
      metrics,
      topThreats,
      userRiskScores
    ] = await Promise.all([
      this.getCriticalEvents(),
      this.getOpenIncidents(),
      this.getRecentAlerts(),
      this.getSecurityMetrics(),
      this.getTopThreats(),
      this.getTopUserRiskScores()
    ]);

    return {
      summary: {
        criticalEventsCount: criticalEvents.length,
        openIncidentsCount: openIncidents.length,
        alertsLast24h: recentAlerts.length,
        overallRiskLevel: this.calculateOverallRiskLevel(metrics)
      },
      criticalEvents,
      openIncidents,
      recentAlerts,
      metrics,
      topThreats,
      userRiskScores
    };
  }

  private async getCriticalEvents(): Promise<any[]> {
    const query = `
      SELECT * FROM v_critical_security_events
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private async getOpenIncidents(): Promise<any[]> {
    const query = `
      SELECT * FROM v_incident_summary
      WHERE status NOT IN ('closed', 'resolved')
      ORDER BY priority DESC, created_at DESC
      LIMIT 10
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private async getRecentAlerts(): Promise<any[]> {
    const query = `
      SELECT * FROM security_alerts
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private async getSecurityMetrics(): Promise<any> {
    const query = `
      SELECT metric_type, metric_name, 
             SUM(metric_value) as total_value,
             AVG(metric_value) as avg_value
      FROM security_metrics
      WHERE period_start > NOW() - INTERVAL '24 hours'
      GROUP BY metric_type, metric_name
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private async getTopThreats(): Promise<any[]> {
    const query = `
      SELECT rule_id, tr.name as rule_name, 
             COUNT(*) as trigger_count,
             AVG(se.risk_score) as avg_risk_score
      FROM security_events_enhanced se
      JOIN threat_detection_rules tr ON se.rule_id = tr.id
      WHERE se.created_at > NOW() - INTERVAL '7 days'
      GROUP BY rule_id, tr.name
      ORDER BY trigger_count DESC
      LIMIT 5
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private async getTopUserRiskScores(): Promise<any[]> {
    const query = `
      SELECT u.id, u.email,
             COUNT(se.id) as event_count,
             AVG(se.risk_score) as avg_risk_score,
             MAX(se.risk_score) as max_risk_score
      FROM users u
      JOIN security_events_enhanced se ON u.id = se.user_id
      WHERE se.created_at > NOW() - INTERVAL '30 days'
      GROUP BY u.id, u.email
      HAVING AVG(se.risk_score) > 50
      ORDER BY avg_risk_score DESC
      LIMIT 10
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  private calculateOverallRiskLevel(metrics: any[]): string {
    const riskMetrics = metrics.filter(m => m.metric_type === 'risk_score');
    if (riskMetrics.length === 0) return 'low';

    const avgRisk = riskMetrics.reduce((sum, m) => sum + m.avg_value, 0) / riskMetrics.length;

    if (avgRisk > 70) return 'critical';
    if (avgRisk > 50) return 'high';
    if (avgRisk > 30) return 'medium';
    return 'low';
  }

  private generateEventId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  async updateConfiguration(updates: Partial<SecurityConfiguration>): Promise<void> {
    this.config = { ...this.config, ...updates };

    // Store configuration updates
    for (const [key, value] of Object.entries(updates)) {
      await this.db.query(
        `INSERT INTO security_configuration (config_key, config_value, config_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (config_key) DO UPDATE 
         SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
        [key, JSON.stringify(value), typeof value]
      );
    }

    // Apply configuration changes
    if (updates.anomalyDetectionSensitivity !== undefined) {
      this.anomalyDetector.setSensitivity(updates.anomalyDetectionSensitivity);
    }
  }

  async stop(): Promise<void> {
    if (this.metricsFlushInterval) {
      clearInterval(this.metricsFlushInterval);
    }
    await this.flushMetrics();
  }
}