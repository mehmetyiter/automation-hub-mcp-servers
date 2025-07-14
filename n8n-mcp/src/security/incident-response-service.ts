import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

interface SecurityIncident {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'assigned' | 'investigating' | 'contained' | 'eradicated' | 'recovered' | 'closed';
  source: string;
  affectedSystems: string[];
  affectedUsers: string[];
  attackVectors: string[];
  indicatorsOfCompromise: string[];
  timeline: TimelineEntry[];
  responseActions: ResponseAction[];
  lessonsLearned?: string;
  damageAssessment?: DamageAssessment;
  assignedTo?: string;
  createdBy?: string;
  resolvedBy?: string;
  escalatedTo?: string;
  estimatedImpact?: 'minimal' | 'minor' | 'moderate' | 'major' | 'severe';
  actualImpact?: 'minimal' | 'minor' | 'moderate' | 'major' | 'severe';
  mttrMinutes?: number;
  costEstimate?: number;
  externalReference?: string;
  createdAt: Date;
  updatedAt: Date;
  firstDetectedAt: Date;
  incidentStartTime?: Date;
  incidentEndTime?: Date;
  resolvedAt?: Date;
}

interface TimelineEntry {
  timestamp: Date;
  action: string;
  actor: string;
  description: string;
  evidence?: any;
}

interface ResponseAction {
  id: string;
  action: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  notes?: string;
}

interface DamageAssessment {
  dataLoss: boolean;
  dataExfiltration: boolean;
  systemCompromise: boolean;
  financialLoss: number;
  reputationImpact: 'none' | 'low' | 'medium' | 'high' | 'severe';
  operationalImpact: 'none' | 'low' | 'medium' | 'high' | 'severe';
  legalImplications: boolean;
  affectedRecords: number;
  recoveryTime: number;
}

interface IncidentTemplate {
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  initialActions: string[];
  requiredRoles: string[];
  escalationCriteria: any;
}

export class IncidentResponseService extends EventEmitter {
  private db: Pool;
  private logger: typeof logger;
  private templates: Map<string, IncidentTemplate> = new Map();
  private escalationTimer: Map<string, NodeJS.Timeout> = new Map();

  constructor(db: Pool, loggerInstance: typeof logger) {
    super();
    this.db = db;
    this.logger = loggerInstance;
    
    this.initializeTemplates();
    this.startEscalationMonitor();
  }

  private initializeTemplates(): void {
    const templates: IncidentTemplate[] = [
      {
        type: 'data_breach',
        title: 'Data Breach Incident',
        description: 'Unauthorized access to sensitive data',
        severity: 'critical',
        priority: 'critical',
        initialActions: [
          'Isolate affected systems',
          'Preserve evidence',
          'Notify legal team',
          'Begin forensic analysis',
          'Assess data exposure'
        ],
        requiredRoles: ['security_lead', 'legal', 'ciso'],
        escalationCriteria: {
          timeLimit: 30,
          conditions: ['pii_exposed', 'financial_data', 'large_scale']
        }
      },
      {
        type: 'malware',
        title: 'Malware Detection',
        description: 'Malicious software detected on systems',
        severity: 'high',
        priority: 'high',
        initialActions: [
          'Isolate infected systems',
          'Run malware scans',
          'Identify infection vector',
          'Check for lateral movement',
          'Update security signatures'
        ],
        requiredRoles: ['security_analyst', 'sysadmin'],
        escalationCriteria: {
          timeLimit: 60,
          conditions: ['ransomware', 'spreading', 'critical_systems']
        }
      },
      {
        type: 'ddos',
        title: 'DDoS Attack',
        description: 'Distributed Denial of Service attack detected',
        severity: 'high',
        priority: 'high',
        initialActions: [
          'Enable DDoS mitigation',
          'Identify attack patterns',
          'Scale infrastructure',
          'Contact ISP',
          'Monitor service availability'
        ],
        requiredRoles: ['network_admin', 'security_analyst'],
        escalationCriteria: {
          timeLimit: 45,
          conditions: ['service_down', 'prolonged_attack']
        }
      },
      {
        type: 'account_compromise',
        title: 'Account Compromise',
        description: 'User account has been compromised',
        severity: 'medium',
        priority: 'high',
        initialActions: [
          'Disable compromised account',
          'Reset credentials',
          'Review account activity',
          'Check for privilege escalation',
          'Notify affected user'
        ],
        requiredRoles: ['security_analyst', 'identity_admin'],
        escalationCriteria: {
          timeLimit: 120,
          conditions: ['admin_account', 'multiple_accounts', 'data_access']
        }
      }
    ];

    for (const template of templates) {
      this.templates.set(template.type, template);
    }
  }

  private startEscalationMonitor(): void {
    setInterval(() => {
      this.checkEscalations();
    }, 60000); // Check every minute
  }

  private async checkEscalations(): Promise<void> {
    const query = `
      SELECT * FROM security_incidents
      WHERE status IN ('new', 'assigned', 'investigating')
        AND severity IN ('high', 'critical')
        AND created_at < NOW() - INTERVAL '1 hour'
        AND escalated_to IS NULL
    `;

    const result = await this.db.query(query);

    for (const incident of result.rows) {
      const minutesOpen = Math.floor(
        (Date.now() - new Date(incident.created_at).getTime()) / 60000
      );

      const template = this.templates.get(incident.incident_type);
      const escalationTime = template?.escalationCriteria?.timeLimit || 60;

      if (minutesOpen > escalationTime) {
        await this.escalateIncident(incident.id, 'Time threshold exceeded');
      }
    }
  }

  async createIncident(data: Partial<SecurityIncident>): Promise<SecurityIncident> {
    const incidentNumber = await this.generateIncidentNumber();
    const template = data.incidentType ? this.templates.get(data.incidentType) : undefined;

    const incident: Partial<SecurityIncident> = {
      incidentNumber,
      title: data.title || template?.title || 'Security Incident',
      description: data.description || template?.description || '',
      incidentType: data.incidentType || 'unknown',
      severity: data.severity || template?.severity || 'medium',
      priority: data.priority || template?.priority || 'medium',
      status: 'new',
      source: data.source || 'security_monitoring',
      affectedSystems: data.affectedSystems || [],
      affectedUsers: data.affectedUsers || [],
      attackVectors: data.attackVectors || [],
      indicatorsOfCompromise: data.indicatorsOfCompromise || [],
      timeline: [{
        timestamp: new Date(),
        action: 'incident_created',
        actor: 'system',
        description: 'Incident created'
      }],
      responseActions: template?.initialActions?.map(action => ({
        id: this.generateActionId(),
        action,
        status: 'pending'
      })) || [],
      createdBy: data.createdBy,
      firstDetectedAt: data.firstDetectedAt || new Date(),
      incidentStartTime: data.incidentStartTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const query = `
      INSERT INTO security_incidents (
        incident_number, title, description, incident_type,
        severity, priority, status, source, affected_systems,
        affected_users, attack_vectors, indicators_of_compromise,
        timeline, response_actions, created_by, first_detected_at,
        incident_start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      incident.incidentNumber,
      incident.title,
      incident.description,
      incident.incidentType,
      incident.severity,
      incident.priority,
      incident.status,
      incident.source,
      JSON.stringify(incident.affectedSystems),
      JSON.stringify(incident.affectedUsers),
      JSON.stringify(incident.attackVectors),
      JSON.stringify(incident.indicatorsOfCompromise),
      JSON.stringify(incident.timeline),
      JSON.stringify(incident.responseActions),
      incident.createdBy,
      incident.firstDetectedAt,
      incident.incidentStartTime
    ];

    const result = await this.db.query(query, values);
    const createdIncident = this.parseIncident(result.rows[0]);

    // Auto-assign if configured
    const config = await this.getConfiguration();
    if (config.incidentAutoAssignment) {
      await this.autoAssignIncident(createdIncident);
    }

    // Set escalation timer for critical incidents
    if (createdIncident.severity === 'critical') {
      this.setEscalationTimer(createdIncident.id, 30); // 30 minutes for critical
    }

    this.emit('incident-created', createdIncident);
    return createdIncident;
  }

  async createOrUpdateIncident(data: {
    title: string;
    description: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    eventIds: string[];
  }): Promise<SecurityIncident> {
    // Check if similar incident exists
    const existingIncident = await this.findSimilarIncident(data);

    if (existingIncident) {
      // Update existing incident
      return this.updateIncident(existingIncident.id, {
        severity: this.getHigherSeverity(existingIncident.severity, data.severity)
      });
    } else {
      // Create new incident
      return this.createIncident({
        title: data.title,
        description: data.description,
        incidentType: data.type,
        severity: data.severity
      });
    }
  }

  private async findSimilarIncident(data: any): Promise<any> {
    const query = `
      SELECT * FROM security_incidents
      WHERE incident_type = $1
        AND status NOT IN ('closed', 'resolved')
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [data.type]);
    return result.rows[0] ? this.parseIncident(result.rows[0]) : null;
  }

  private getHigherSeverity(sev1: string, sev2: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    return severityOrder[sev1] > severityOrder[sev2] ? sev1 as any : sev2 as any;
  }

  async updateIncident(id: string, updates: Partial<SecurityIncident>): Promise<SecurityIncident> {
    // Add timeline entry for the update
    const timelineEntry: TimelineEntry = {
      timestamp: new Date(),
      action: 'incident_updated',
      actor: updates.assignedTo || 'system',
      description: `Updated: ${Object.keys(updates).join(', ')}`
    };

    const currentIncident = await this.getIncident(id);
    const newTimeline = [...(currentIncident.timeline || []), timelineEntry];

    const query = `
      UPDATE security_incidents
      SET ${this.buildUpdateSet(updates)},
          timeline = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, JSON.stringify(newTimeline), ...Object.values(updates)];
    const result = await this.db.query(query, values);

    const updatedIncident = this.parseIncident(result.rows[0]);

    // Check if status changed
    if (updates.status && updates.status !== currentIncident.status) {
      this.handleStatusChange(updatedIncident, currentIncident.status);
    }

    this.emit('incident-updated', updatedIncident);
    return updatedIncident;
  }

  private buildUpdateSet(updates: any): string {
    const fields = Object.keys(updates);
    return fields.map((field, index) => `${this.camelToSnake(field)} = $${index + 3}`).join(', ');
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private handleStatusChange(incident: SecurityIncident, previousStatus: string): void {
    switch (incident.status) {
      case 'contained':
        this.logger.info(`Incident ${incident.incidentNumber} contained`);
        break;
      case 'closed':
        this.calculateMTTR(incident);
        this.emit('incident-closed', incident);
        break;
      case 'investigating':
        if (previousStatus === 'new') {
          this.startInvestigationTimer(incident.id);
        }
        break;
    }
  }

  private async calculateMTTR(incident: SecurityIncident): Promise<void> {
    if (incident.firstDetectedAt && incident.resolvedAt) {
      const mttrMinutes = Math.floor(
        (incident.resolvedAt.getTime() - incident.firstDetectedAt.getTime()) / 60000
      );

      await this.db.query(
        'UPDATE security_incidents SET mttr_minutes = $1 WHERE id = $2',
        [mttrMinutes, incident.id]
      );
    }
  }

  async assignIncident(incidentId: string, userId: string): Promise<SecurityIncident> {
    return this.updateIncident(incidentId, {
      assignedTo: userId,
      status: 'assigned'
    });
  }

  private async autoAssignIncident(incident: SecurityIncident): Promise<void> {
    // Get available security team members
    const query = `
      SELECT u.id, COUNT(si.id) as active_incidents
      FROM users u
      LEFT JOIN security_incidents si ON u.id = si.assigned_to
        AND si.status IN ('assigned', 'investigating')
      WHERE u.role LIKE '%security%'
      GROUP BY u.id
      ORDER BY active_incidents ASC
      LIMIT 1
    `;

    const result = await this.db.query(query);
    
    if (result.rows.length > 0) {
      await this.assignIncident(incident.id, result.rows[0].id);
    }
  }

  async addResponseAction(incidentId: string, action: Omit<ResponseAction, 'id'>): Promise<void> {
    const incident = await this.getIncident(incidentId);
    const actionWithId = {
      ...action,
      id: this.generateActionId()
    };

    const updatedActions = [...(incident.responseActions || []), actionWithId];
    
    await this.db.query(
      'UPDATE security_incidents SET response_actions = $1 WHERE id = $2',
      [JSON.stringify(updatedActions), incidentId]
    );

    this.emit('response-action-added', { incidentId, action: actionWithId });
  }

  async updateResponseAction(incidentId: string, actionId: string, updates: Partial<ResponseAction>): Promise<void> {
    const incident = await this.getIncident(incidentId);
    const updatedActions = (incident.responseActions || []).map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    );

    await this.db.query(
      'UPDATE security_incidents SET response_actions = $1 WHERE id = $2',
      [JSON.stringify(updatedActions), incidentId]
    );

    if (updates.status === 'completed') {
      await this.checkIncidentCompletion(incidentId);
    }
  }

  private async checkIncidentCompletion(incidentId: string): Promise<void> {
    const incident = await this.getIncident(incidentId);
    const allActionsComplete = (incident.responseActions || [])
      .every(action => action.status === 'completed');

    if (allActionsComplete && incident.status === 'investigating') {
      await this.updateIncident(incidentId, { status: 'contained' });
    }
  }

  async escalateIncident(incidentId: string, reason: string): Promise<void> {
    const incident = await this.getIncident(incidentId);

    // Determine escalation target based on severity
    const escalationTargets = {
      low: 'security_lead',
      medium: 'security_manager',
      high: 'ciso',
      critical: 'executive_team'
    };

    const escalatedTo = escalationTargets[incident.severity];

    await this.updateIncident(incidentId, {
      escalatedTo,
      priority: 'critical'
    });

    // Add timeline entry
    const timelineEntry: TimelineEntry = {
      timestamp: new Date(),
      action: 'incident_escalated',
      actor: 'system',
      description: `Escalated to ${escalatedTo}: ${reason}`
    };

    await this.addTimelineEntry(incidentId, timelineEntry);

    // Send notification
    this.emit('incident-escalated', {
      incident,
      escalatedTo,
      reason
    });

    this.logger.warn(`Incident ${incident.incidentNumber} escalated to ${escalatedTo}`, { reason });
  }

  private async addTimelineEntry(incidentId: string, entry: TimelineEntry): Promise<void> {
    const incident = await this.getIncident(incidentId);
    const updatedTimeline = [...(incident.timeline || []), entry];

    await this.db.query(
      'UPDATE security_incidents SET timeline = $1 WHERE id = $2',
      [JSON.stringify(updatedTimeline), incidentId]
    );
  }

  async addEvidence(incidentId: string, eventIds: string[]): Promise<void> {
    const query = `
      INSERT INTO incident_events (incident_id, event_id, relationship_type, added_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (incident_id, event_id) DO NOTHING
    `;

    for (const eventId of eventIds) {
      await this.db.query(query, [incidentId, eventId, 'evidence', 'system']);
    }
  }

  async performDamageAssessment(incidentId: string, assessment: DamageAssessment): Promise<void> {
    await this.updateIncident(incidentId, {
      damageAssessment: assessment,
      actualImpact: this.calculateImpactLevel(assessment),
      costEstimate: assessment.financialLoss
    });
  }

  private calculateImpactLevel(assessment: DamageAssessment): 'minimal' | 'minor' | 'moderate' | 'major' | 'severe' {
    let score = 0;

    if (assessment.dataLoss) score += 3;
    if (assessment.dataExfiltration) score += 4;
    if (assessment.systemCompromise) score += 3;
    if (assessment.financialLoss > 100000) score += 4;
    if (assessment.reputationImpact === 'severe') score += 4;
    if (assessment.operationalImpact === 'severe') score += 4;
    if (assessment.legalImplications) score += 2;

    if (score >= 15) return 'severe';
    if (score >= 10) return 'major';
    if (score >= 6) return 'moderate';
    if (score >= 3) return 'minor';
    return 'minimal';
  }

  async addLessonsLearned(incidentId: string, lessons: string): Promise<void> {
    await this.updateIncident(incidentId, { lessonsLearned: lessons });

    // Create knowledge base entry
    await this.db.query(
      `INSERT INTO incident_knowledge_base (incident_id, lessons_learned, created_at)
       VALUES ($1, $2, NOW())`,
      [incidentId, lessons]
    );
  }

  async getIncident(id: string): Promise<SecurityIncident> {
    const query = 'SELECT * FROM security_incidents WHERE id = $1';
    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error(`Incident not found: ${id}`);
    }

    return this.parseIncident(result.rows[0]);
  }

  async getIncidentsByStatus(status: string): Promise<SecurityIncident[]> {
    const query = 'SELECT * FROM security_incidents WHERE status = $1 ORDER BY priority DESC, created_at DESC';
    const result = await this.db.query(query, [status]);
    return result.rows.map(row => this.parseIncident(row));
  }

  async getIncidentMetrics(period: string = '30d'): Promise<any> {
    const periodDays = parseInt(period) || 30;

    const metricsQuery = `
      SELECT 
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count,
        AVG(mttr_minutes) as avg_mttr,
        SUM(cost_estimate) as total_cost
      FROM security_incidents
      WHERE created_at > NOW() - INTERVAL '${periodDays} days'
    `;

    const trendsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        AVG(CASE WHEN mttr_minutes IS NOT NULL THEN mttr_minutes END) as avg_mttr
      FROM security_incidents
      WHERE created_at > NOW() - INTERVAL '${periodDays} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    const [metrics, trends] = await Promise.all([
      this.db.query(metricsQuery),
      this.db.query(trendsQuery)
    ]);

    return {
      summary: metrics.rows[0],
      trends: trends.rows
    };
  }

  private parseIncident(row: any): SecurityIncident {
    return {
      id: row.id,
      incidentNumber: row.incident_number,
      title: row.title,
      description: row.description,
      incidentType: row.incident_type,
      severity: row.severity,
      priority: row.priority,
      status: row.status,
      source: row.source,
      affectedSystems: row.affected_systems || [],
      affectedUsers: row.affected_users || [],
      attackVectors: row.attack_vectors || [],
      indicatorsOfCompromise: row.indicators_of_compromise || [],
      timeline: row.timeline || [],
      responseActions: row.response_actions || [],
      lessonsLearned: row.lessons_learned,
      damageAssessment: row.damage_assessment,
      assignedTo: row.assigned_to,
      createdBy: row.created_by,
      resolvedBy: row.resolved_by,
      escalatedTo: row.escalated_to,
      estimatedImpact: row.estimated_impact,
      actualImpact: row.actual_impact,
      mttrMinutes: row.mttr_minutes,
      costEstimate: row.cost_estimate,
      externalReference: row.external_reference,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      firstDetectedAt: row.first_detected_at,
      incidentStartTime: row.incident_start_time,
      incidentEndTime: row.incident_end_time,
      resolvedAt: row.resolved_at
    };
  }

  private async generateIncidentNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM security_incidents 
      WHERE incident_number LIKE $1
    `;

    const result = await this.db.query(countQuery, [`INC-${year}${month}%`]);
    const count = parseInt(result.rows[0].count) + 1;

    return `INC-${year}${month}-${String(count).padStart(4, '0')}`;
  }

  private generateActionId(): string {
    return `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setEscalationTimer(incidentId: string, minutes: number): void {
    const timer = setTimeout(() => {
      this.escalateIncident(incidentId, 'Response time exceeded');
    }, minutes * 60000);

    this.escalationTimer.set(incidentId, timer);
  }

  private startInvestigationTimer(incidentId: string): void {
    // Track investigation time for metrics
    this.db.query(
      `UPDATE security_incidents 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'), 
         '{investigation_started}', 
         to_jsonb(NOW())
       )
       WHERE id = $1`,
      [incidentId]
    );
  }

  private async getConfiguration(): Promise<any> {
    const query = `
      SELECT config_key, config_value 
      FROM security_configuration 
      WHERE config_key IN ('incident_auto_assignment', 'incident_escalation_threshold_minutes')
    `;

    const result = await this.db.query(query);
    const config: any = {};

    for (const row of result.rows) {
      config[this.snakeToCamel(row.config_key)] = JSON.parse(row.config_value);
    }

    return config;
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  async stop(): Promise<void> {
    // Clear all escalation timers
    for (const timer of this.escalationTimer.values()) {
      clearTimeout(timer);
    }
    this.escalationTimer.clear();
  }
}