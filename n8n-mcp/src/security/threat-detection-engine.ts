import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

interface ThreatRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'pattern' | 'threshold' | 'anomaly' | 'geolocation' | 'time_based' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: any;
  actions: any;
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  falsePositiveCount: number;
  effectivenessScore: number;
}

interface ThreatDetection {
  ruleId: string;
  ruleName: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  eventIds: string[];
  evidence: any[];
  confidence: number;
  timestamp: Date;
}

interface PatternCondition {
  eventType?: string;
  patterns: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'regex' | 'in' | 'not_in';
    value: any;
  }>;
  requireAll?: boolean;
}

interface ThresholdCondition {
  eventType: string;
  threshold: number;
  timeWindow: string; // e.g., '5m', '1h'
  groupBy?: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
}

interface GeolocationCondition {
  checkUserLocationHistory: boolean;
  distanceThresholdKm: number;
  timeThresholdHours: number;
  blockedCountries?: string[];
  allowedCountries?: string[];
}

export class ThreatDetectionEngine extends EventEmitter {
  private db: Pool;
  private logger: Logger;
  private rules: Map<string, ThreatRule> = new Map();
  private ruleProcessors: Map<string, (rule: ThreatRule, event: any) => Promise<boolean>> = new Map();
  private eventBuffer: Map<string, any[]> = new Map();
  private bufferCleanupInterval: NodeJS.Timeout | null = null;

  constructor(db: Pool, logger: Logger) {
    super();
    this.db = db;
    this.logger = logger;

    this.initializeRuleProcessors();
    this.loadRules();
    this.startBufferCleanup();
  }

  private initializeRuleProcessors(): void {
    this.ruleProcessors.set('pattern', this.processPatternRule.bind(this));
    this.ruleProcessors.set('threshold', this.processThresholdRule.bind(this));
    this.ruleProcessors.set('anomaly', this.processAnomalyRule.bind(this));
    this.ruleProcessors.set('geolocation', this.processGeolocationRule.bind(this));
    this.ruleProcessors.set('time_based', this.processTimeBasedRule.bind(this));
    this.ruleProcessors.set('behavioral', this.processBehavioralRule.bind(this));
  }

  private async loadRules(): Promise<void> {
    try {
      const query = `
        SELECT * FROM threat_detection_rules
        WHERE enabled = true
        ORDER BY severity DESC, effectiveness_score DESC
      `;

      const result = await this.db.query(query);
      
      this.rules.clear();
      for (const row of result.rows) {
        this.rules.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description,
          ruleType: row.rule_type,
          severity: row.severity,
          conditions: row.conditions,
          actions: row.actions,
          enabled: row.enabled,
          lastTriggered: row.last_triggered,
          triggerCount: row.trigger_count,
          falsePositiveCount: row.false_positive_count,
          effectivenessScore: row.effectiveness_score
        });
      }

      this.logger.info(`Loaded ${this.rules.size} threat detection rules`);
    } catch (error) {
      this.logger.error('Failed to load threat detection rules', { error });
    }
  }

  private startBufferCleanup(): void {
    this.bufferCleanupInterval = setInterval(() => {
      this.cleanupEventBuffer();
    }, 60000); // Clean up every minute
  }

  private cleanupEventBuffer(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [key, events] of this.eventBuffer.entries()) {
      const filteredEvents = events.filter(event => 
        now - event.timestamp.getTime() < maxAge
      );

      if (filteredEvents.length === 0) {
        this.eventBuffer.delete(key);
      } else {
        this.eventBuffer.set(key, filteredEvents);
      }
    }
  }

  async analyzeEvent(event: any): Promise<void> {
    // Add event to buffer for threshold analysis
    this.bufferEvent(event);

    // Process event against all rules
    const detections: ThreatDetection[] = [];

    for (const [ruleId, rule] of this.rules) {
      try {
        const processor = this.ruleProcessors.get(rule.ruleType);
        if (!processor) {
          this.logger.warn(`No processor for rule type: ${rule.ruleType}`);
          continue;
        }

        const matched = await processor(rule, event);
        
        if (matched) {
          const detection = await this.createThreatDetection(rule, event);
          detections.push(detection);
          
          // Update rule statistics
          await this.updateRuleStatistics(ruleId);
          
          // Execute rule actions
          await this.executeRuleActions(rule, detection);
        }
      } catch (error) {
        this.logger.error(`Error processing rule ${ruleId}`, { error, event });
      }
    }

    // Correlate detections
    if (detections.length > 0) {
      await this.correlateDetections(detections);
    }
  }

  private bufferEvent(event: any): void {
    const key = `${event.eventType}:${event.userId || 'anonymous'}`;
    
    if (!this.eventBuffer.has(key)) {
      this.eventBuffer.set(key, []);
    }
    
    this.eventBuffer.get(key)!.push(event);
  }

  private async processPatternRule(rule: ThreatRule, event: any): Promise<boolean> {
    const conditions = rule.conditions as PatternCondition;

    // Check event type if specified
    if (conditions.eventType && event.eventType !== conditions.eventType) {
      return false;
    }

    // Check patterns
    const matchResults = conditions.patterns.map(pattern => {
      const fieldValue = this.getFieldValue(event, pattern.field);
      
      switch (pattern.operator) {
        case 'equals':
          return fieldValue === pattern.value;
        case 'contains':
          return String(fieldValue).includes(pattern.value);
        case 'regex':
          return new RegExp(pattern.value).test(String(fieldValue));
        case 'in':
          return Array.isArray(pattern.value) && pattern.value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(pattern.value) && !pattern.value.includes(fieldValue);
        default:
          return false;
      }
    });

    // Check if all patterns must match or any
    return conditions.requireAll 
      ? matchResults.every(result => result)
      : matchResults.some(result => result);
  }

  private async processThresholdRule(rule: ThreatRule, event: any): Promise<boolean> {
    const conditions = rule.conditions as ThresholdCondition;

    // Check event type
    if (event.eventType !== conditions.eventType) {
      return false;
    }

    // Apply filters
    if (conditions.filters) {
      const passesFilters = conditions.filters.every(filter => {
        const fieldValue = this.getFieldValue(event, filter.field);
        return this.evaluateFilter(fieldValue, filter.operator, filter.value);
      });

      if (!passesFilters) return false;
    }

    // Get relevant events from buffer
    const timeWindow = this.parseTimeWindow(conditions.timeWindow);
    const cutoffTime = Date.now() - timeWindow;
    
    const key = conditions.groupBy 
      ? `${event.eventType}:${this.getFieldValue(event, conditions.groupBy)}`
      : `${event.eventType}:${event.userId || 'anonymous'}`;

    const relevantEvents = (this.eventBuffer.get(key) || [])
      .filter(e => e.timestamp.getTime() > cutoffTime);

    return relevantEvents.length >= conditions.threshold;
  }

  private async processAnomalyRule(rule: ThreatRule, event: any): Promise<boolean> {
    const conditions = rule.conditions;

    // Get baseline for comparison
    const baseline = await this.getUserBaseline(event.userId, event.eventType);
    if (!baseline) return false;

    // Calculate deviation
    const deviation = this.calculateDeviation(event, baseline);
    
    return deviation > (conditions.deviation_threshold || 3);
  }

  private async processGeolocationRule(rule: ThreatRule, event: any): Promise<boolean> {
    const conditions = rule.conditions as GeolocationCondition;

    if (!event.geolocation || !event.userId) return false;

    // Check blocked/allowed countries
    if (conditions.blockedCountries?.includes(event.geolocation.country)) {
      return true;
    }

    if (conditions.allowedCountries && !conditions.allowedCountries.includes(event.geolocation.country)) {
      return true;
    }

    // Check user location history
    if (conditions.checkUserLocationHistory) {
      const lastLocation = await this.getLastUserLocation(event.userId);
      
      if (lastLocation) {
        const distance = this.calculateDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          event.geolocation.latitude,
          event.geolocation.longitude
        );

        const timeDiff = (event.timestamp.getTime() - lastLocation.timestamp.getTime()) / 3600000; // hours

        // Impossible travel detection
        if (distance > conditions.distanceThresholdKm && timeDiff < conditions.timeThresholdHours) {
          return true;
        }
      }
    }

    return false;
  }

  private async processTimeBasedRule(rule: ThreatRule, event: any): Promise<boolean> {
    const conditions = rule.conditions;
    const eventTime = new Date(event.timestamp);
    const hours = eventTime.getHours();
    const dayOfWeek = eventTime.getDay();

    // Check business hours
    if (conditions.business_hours) {
      const startHour = parseInt(conditions.business_hours.start.split(':')[0]);
      const endHour = parseInt(conditions.business_hours.end.split(':')[0]);

      const outsideBusinessHours = hours < startHour || hours >= endHour;

      if (outsideBusinessHours) {
        // Check if it's a weekend
        if (conditions.check_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
          return true;
        }
        // Weekday outside business hours
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          return true;
        }
      }
    }

    return false;
  }

  private async processBehavioralRule(rule: ThreatRule, event: any): Promise<boolean> {
    // This would implement complex behavioral analysis
    // For now, return false
    return false;
  }

  private getFieldValue(obj: any, field: string): any {
    const parts = field.split('.');
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

  private evaluateFilter(fieldValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'contains':
        return String(fieldValue).includes(value);
      default:
        return false;
    }
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([mhd])$/);
    if (!match) return 300000; // Default 5 minutes

    const [, num, unit] = match;
    const value = parseInt(num);

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 300000;
    }
  }

  private async getUserBaseline(userId: string, behaviorType: string): Promise<any> {
    if (!userId) return null;

    const query = `
      SELECT baseline_data 
      FROM user_behavior_baselines
      WHERE user_id = $1 AND behavior_type = $2
        AND valid_until > NOW()
    `;

    const result = await this.db.query(query, [userId, behaviorType]);
    return result.rows[0]?.baseline_data;
  }

  private calculateDeviation(event: any, baseline: any): number {
    // Simple deviation calculation - would be more complex in production
    const metrics = ['requestCount', 'dataVolume', 'errorRate'];
    let totalDeviation = 0;

    for (const metric of metrics) {
      if (baseline[metric] && event[metric]) {
        const mean = baseline[metric].mean || 0;
        const stdDev = baseline[metric].stdDev || 1;
        const deviation = Math.abs(event[metric] - mean) / stdDev;
        totalDeviation += deviation;
      }
    }

    return totalDeviation / metrics.length;
  }

  private async getLastUserLocation(userId: string): Promise<any> {
    const query = `
      SELECT geolocation, created_at as timestamp
      FROM security_events_enhanced
      WHERE user_id = $1 
        AND geolocation IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [userId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row.geolocation,
      timestamp: row.timestamp
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async createThreatDetection(rule: ThreatRule, event: any): Promise<ThreatDetection> {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.ruleType,
      severity: rule.severity,
      title: `${rule.name} - ${event.eventType}`,
      description: this.generateThreatDescription(rule, event),
      eventIds: [event.id],
      evidence: [event],
      confidence: this.calculateConfidence(rule, event),
      timestamp: new Date()
    };
  }

  private generateThreatDescription(rule: ThreatRule, event: any): string {
    const templates: Record<string, string> = {
      pattern: `Pattern-based threat detected: ${rule.description}`,
      threshold: `Threshold exceeded: ${rule.description}`,
      anomaly: `Anomalous behavior detected: ${rule.description}`,
      geolocation: `Suspicious geographic activity: ${rule.description}`,
      time_based: `Suspicious timing detected: ${rule.description}`,
      behavioral: `Behavioral anomaly detected: ${rule.description}`
    };

    return templates[rule.ruleType] || rule.description;
  }

  private calculateConfidence(rule: ThreatRule, event: any): number {
    let confidence = 0.5;

    // Adjust based on rule effectiveness
    confidence *= rule.effectivenessScore;

    // Adjust based on event risk score
    if (event.riskScore) {
      confidence *= (event.riskScore / 100);
    }

    // Adjust based on false positive rate
    const falsePositiveRate = rule.falsePositiveCount / (rule.triggerCount || 1);
    confidence *= (1 - falsePositiveRate);

    return Math.min(1, Math.max(0, confidence));
  }

  private async updateRuleStatistics(ruleId: string): Promise<void> {
    const query = `
      UPDATE threat_detection_rules
      SET trigger_count = trigger_count + 1,
          last_triggered = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [ruleId]);

    // Update local cache
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.triggerCount++;
      rule.lastTriggered = new Date();
    }
  }

  private async executeRuleActions(rule: ThreatRule, detection: ThreatDetection): Promise<void> {
    const actions = rule.actions;

    if (actions.alert) {
      this.emit('threat-detected', detection);
    }

    if (actions.block_ip && detection.evidence[0]?.sourceIp) {
      await this.blockIp(detection.evidence[0].sourceIp);
    }

    if (actions.require_mfa && detection.evidence[0]?.userId) {
      await this.requireMfa(detection.evidence[0].userId);
    }

    if (actions.escalate) {
      await this.escalateThreat(detection);
    }

    if (actions.audit_log) {
      await this.auditLog(detection);
    }
  }

  private async blockIp(ip: string): Promise<void> {
    // Implementation would add IP to blocklist
    this.logger.info(`Blocking IP: ${ip}`);
  }

  private async requireMfa(userId: string): Promise<void> {
    // Implementation would flag user for MFA requirement
    this.logger.info(`Requiring MFA for user: ${userId}`);
  }

  private async escalateThreat(detection: ThreatDetection): Promise<void> {
    // Implementation would create high-priority incident
    this.logger.info(`Escalating threat: ${detection.title}`);
  }

  private async auditLog(detection: ThreatDetection): Promise<void> {
    const query = `
      INSERT INTO compliance_audit_trail (
        audit_type, object_type, object_id, action,
        risk_level, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await this.db.query(query, [
      'threat_detection',
      'security_event',
      detection.eventIds[0],
      'threat_detected',
      detection.severity,
      JSON.stringify(detection)
    ]);
  }

  private async correlateDetections(detections: ThreatDetection[]): Promise<void> {
    // Group detections by severity and type
    const highSeverityDetections = detections.filter(d => 
      d.severity === 'high' || d.severity === 'critical'
    );

    if (highSeverityDetections.length >= 2) {
      // Multiple high-severity threats indicate a coordinated attack
      const correlatedThreat: ThreatDetection = {
        ruleId: 'correlation',
        ruleName: 'Correlated Threat Pattern',
        type: 'correlation',
        severity: 'critical',
        title: 'Multiple High-Severity Threats Detected',
        description: `${highSeverityDetections.length} high-severity threats detected simultaneously`,
        eventIds: detections.flatMap(d => d.eventIds),
        evidence: detections,
        confidence: 0.9,
        timestamp: new Date()
      };

      this.emit('threat-detected', correlatedThreat);
    }
  }

  async reportFalsePositive(ruleId: string, eventId: string): Promise<void> {
    const query = `
      UPDATE threat_detection_rules
      SET false_positive_count = false_positive_count + 1,
          effectiveness_score = GREATEST(0, effectiveness_score - 0.05)
      WHERE id = $1
    `;

    await this.db.query(query, [ruleId]);

    // Update event status
    await this.db.query(
      `UPDATE security_events_enhanced 
       SET status = 'false_positive' 
       WHERE id = $1`,
      [eventId]
    );

    // Reload rules if effectiveness dropped too low
    const rule = this.rules.get(ruleId);
    if (rule && rule.effectivenessScore <= 0.3) {
      await this.loadRules();
    }
  }

  async addRule(rule: Omit<ThreatRule, 'id' | 'lastTriggered' | 'triggerCount' | 'falsePositiveCount' | 'effectivenessScore'>): Promise<string> {
    const query = `
      INSERT INTO threat_detection_rules (
        name, description, rule_type, severity,
        conditions, actions, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const result = await this.db.query(query, [
      rule.name,
      rule.description,
      rule.ruleType,
      rule.severity,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      rule.enabled
    ]);

    await this.loadRules();
    return result.rows[0].id;
  }

  async stop(): Promise<void> {
    if (this.bufferCleanupInterval) {
      clearInterval(this.bufferCleanupInterval);
    }
  }
}