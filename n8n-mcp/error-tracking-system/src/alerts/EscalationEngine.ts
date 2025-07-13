import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { Alert } from './AlertManager';

export interface EscalationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: EscalationTrigger[];
  escalationLevels: EscalationLevel[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface EscalationTrigger {
  type: 'time_based' | 'condition_based' | 'manual';
  conditions: {
    noResponseTime?: number; // milliseconds
    alertSeverity?: string[];
    alertType?: string[];
    alertSource?: string[];
    customConditions?: Record<string, any>;
  };
}

export interface EscalationLevel {
  level: number;
  name: string;
  delay: number; // milliseconds from previous level
  recipients: {
    users: string[];
    groups: string[];
    channels: string[];
    integrations: string[];
  };
  actions: {
    notify: boolean;
    escalateAfter?: number; // auto-escalate after this time
    requireAcknowledgment: boolean;
    customActions?: string[];
  };
  stopConditions: {
    onAcknowledgment: boolean;
    onResolution: boolean;
    maxRetries: number;
  };
}

export interface EscalationInstance {
  id: string;
  alertId: string;
  ruleId: string;
  currentLevel: number;
  maxLevel: number;
  startedAt: number;
  lastEscalatedAt?: number;
  nextEscalationAt?: number;
  status: 'active' | 'paused' | 'stopped' | 'completed';
  escalationHistory: EscalationEvent[];
  metadata: Record<string, any>;
}

export interface EscalationEvent {
  id: string;
  type: 'started' | 'escalated' | 'acknowledged' | 'resolved' | 'stopped' | 'failed';
  level: number;
  timestamp: number;
  recipients: string[];
  metadata?: Record<string, any>;
}

export class EscalationEngine extends EventEmitter {
  private escalationRules = new Map<string, EscalationRule>();
  private activeEscalations = new Map<string, EscalationInstance>();
  private scheduledEscalations = new Map<string, NodeJS.Timeout>();
  
  private readonly MAX_ESCALATION_LEVEL = 10;
  private readonly DEFAULT_ESCALATION_DELAY = 30 * 60 * 1000; // 30 minutes

  constructor(
    private options: {
      defaultEscalationDelay?: number;
      maxEscalationLevel?: number;
      enableAutoEscalation?: boolean;
      enableScheduledCheck?: boolean;
    } = {}
  ) {
    super();
    
    this.options = {
      defaultEscalationDelay: 30 * 60 * 1000, // 30 minutes
      maxEscalationLevel: 5,
      enableAutoEscalation: true,
      enableScheduledCheck: true,
      ...options
    };

    // Periodic check for escalations
    if (this.options.enableScheduledCheck) {
      setInterval(() => this.processScheduledEscalations(), 60 * 1000); // Every minute
    }
  }

  // Start escalation for an alert
  startEscalation(alert: Alert, ruleId?: string): string {
    const escalationRule = ruleId ? this.escalationRules.get(ruleId) : this.findApplicableRule(alert);
    
    if (!escalationRule || !escalationRule.enabled) {
      logger.debug('No applicable escalation rule found', { alertId: alert.id, ruleId });
      return '';
    }

    const escalationId = uuidv4();
    const escalationInstance: EscalationInstance = {
      id: escalationId,
      alertId: alert.id,
      ruleId: escalationRule.id,
      currentLevel: 0,
      maxLevel: Math.min(escalationRule.escalationLevels.length, this.options.maxEscalationLevel!),
      startedAt: Date.now(),
      status: 'active',
      escalationHistory: [],
      metadata: {}
    };

    // Add start event
    escalationInstance.escalationHistory.push({
      id: uuidv4(),
      type: 'started',
      level: 0,
      timestamp: Date.now(),
      recipients: [],
      metadata: { ruleId: escalationRule.id }
    });

    this.activeEscalations.set(alert.id, escalationInstance);

    // Schedule first escalation
    this.scheduleNextEscalation(escalationInstance, escalationRule);

    this.emit('escalation_started', {
      alertId: alert.id,
      escalationId,
      ruleId: escalationRule.id
    });

    logger.info('Escalation started', {
      alertId: alert.id,
      escalationId,
      ruleId: escalationRule.id,
      maxLevel: escalationInstance.maxLevel
    });

    return escalationId;
  }

  // Stop escalation for an alert
  stopEscalation(alertId: string, reason: string = 'manual'): void {
    const escalation = this.activeEscalations.get(alertId);
    if (!escalation || escalation.status !== 'active') {
      return;
    }

    escalation.status = 'stopped';
    
    // Add stop event
    escalation.escalationHistory.push({
      id: uuidv4(),
      type: 'stopped',
      level: escalation.currentLevel,
      timestamp: Date.now(),
      recipients: [],
      metadata: { reason }
    });

    // Cancel scheduled escalation
    const scheduledTimeout = this.scheduledEscalations.get(alertId);
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      this.scheduledEscalations.delete(alertId);
    }

    this.emit('escalation_stopped', {
      alertId,
      escalationId: escalation.id,
      level: escalation.currentLevel,
      reason
    });

    logger.info('Escalation stopped', {
      alertId,
      escalationId: escalation.id,
      level: escalation.currentLevel,
      reason
    });
  }

  // Pause escalation
  pauseEscalation(alertId: string): void {
    const escalation = this.activeEscalations.get(alertId);
    if (!escalation || escalation.status !== 'active') {
      return;
    }

    escalation.status = 'paused';
    
    // Cancel scheduled escalation
    const scheduledTimeout = this.scheduledEscalations.get(alertId);
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      this.scheduledEscalations.delete(alertId);
    }

    logger.info('Escalation paused', { alertId, escalationId: escalation.id });
  }

  // Resume escalation
  resumeEscalation(alertId: string): void {
    const escalation = this.activeEscalations.get(alertId);
    if (!escalation || escalation.status !== 'paused') {
      return;
    }

    escalation.status = 'active';
    
    const rule = this.escalationRules.get(escalation.ruleId);
    if (rule) {
      this.scheduleNextEscalation(escalation, rule);
    }

    logger.info('Escalation resumed', { alertId, escalationId: escalation.id });
  }

  // Schedule escalation manually
  scheduleEscalation(alertId: string, delay: number): void {
    const escalation = this.activeEscalations.get(alertId);
    if (!escalation) {
      logger.warn('No active escalation found for alert', { alertId });
      return;
    }

    const rule = this.escalationRules.get(escalation.ruleId);
    if (!rule) {
      logger.warn('Escalation rule not found', { ruleId: escalation.ruleId });
      return;
    }

    // Cancel existing scheduled escalation
    const existingTimeout = this.scheduledEscalations.get(alertId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new escalation
    const timeout = setTimeout(() => {
      this.executeEscalation(escalation, rule);
    }, delay);

    this.scheduledEscalations.set(alertId, timeout);
    escalation.nextEscalationAt = Date.now() + delay;
  }

  // Check if escalation is needed (for periodic checks)
  checkEscalation(alert: Alert): void {
    const escalation = this.activeEscalations.get(alert.id);
    if (!escalation || escalation.status !== 'active') {
      return;
    }

    const rule = this.escalationRules.get(escalation.ruleId);
    if (!rule) {
      return;
    }

    // Check if it's time to escalate
    if (escalation.nextEscalationAt && Date.now() >= escalation.nextEscalationAt) {
      this.executeEscalation(escalation, rule);
    }
  }

  // Add escalation rule
  addEscalationRule(rule: Omit<EscalationRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const escalationRule: EscalationRule = {
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...rule
    };

    this.escalationRules.set(escalationRule.id, escalationRule);

    this.emit('escalation_rule_added', escalationRule);

    logger.info('Escalation rule added', {
      ruleId: escalationRule.id,
      name: escalationRule.name
    });

    return escalationRule.id;
  }

  // Update escalation rule
  updateEscalationRule(ruleId: string, updates: Partial<EscalationRule>): void {
    const rule = this.escalationRules.get(ruleId);
    if (!rule) {
      throw new Error(`Escalation rule not found: ${ruleId}`);
    }

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: Date.now()
    };

    this.escalationRules.set(ruleId, updatedRule);

    this.emit('escalation_rule_updated', updatedRule);

    logger.info('Escalation rule updated', { ruleId, name: updatedRule.name });
  }

  // Get escalation status
  getEscalationStatus(alertId: string): EscalationInstance | null {
    return this.activeEscalations.get(alertId) || null;
  }

  // Get all escalation rules
  getEscalationRules(): EscalationRule[] {
    return Array.from(this.escalationRules.values());
  }

  private findApplicableRule(alert: Alert): EscalationRule | null {
    for (const rule of this.escalationRules.values()) {
      if (!rule.enabled) continue;

      for (const trigger of rule.triggers) {
        if (this.evaluateTrigger(trigger, alert)) {
          return rule;
        }
      }
    }
    return null;
  }

  private evaluateTrigger(trigger: EscalationTrigger, alert: Alert): boolean {
    const { conditions } = trigger;

    // Check alert severity
    if (conditions.alertSeverity && !conditions.alertSeverity.includes(alert.severity)) {
      return false;
    }

    // Check alert type
    if (conditions.alertType && !conditions.alertType.includes(alert.type)) {
      return false;
    }

    // Check alert source
    if (conditions.alertSource && !conditions.alertSource.includes(alert.source)) {
      return false;
    }

    return true;
  }

  private scheduleNextEscalation(escalation: EscalationInstance, rule: EscalationRule): void {
    if (escalation.currentLevel >= escalation.maxLevel) {
      this.completeEscalation(escalation);
      return;
    }

    const nextLevel = escalation.currentLevel + 1;
    const escalationLevel = rule.escalationLevels[nextLevel - 1];

    if (!escalationLevel) {
      this.completeEscalation(escalation);
      return;
    }

    const delay = escalationLevel.delay || this.options.defaultEscalationDelay!;
    
    const timeout = setTimeout(() => {
      this.executeEscalation(escalation, rule);
    }, delay);

    this.scheduledEscalations.set(escalation.alertId, timeout);
    escalation.nextEscalationAt = Date.now() + delay;

    logger.debug('Next escalation scheduled', {
      alertId: escalation.alertId,
      currentLevel: escalation.currentLevel,
      nextLevel,
      delay
    });
  }

  private executeEscalation(escalation: EscalationInstance, rule: EscalationRule): void {
    if (escalation.status !== 'active') {
      return;
    }

    escalation.currentLevel++;
    escalation.lastEscalatedAt = Date.now();

    const escalationLevel = rule.escalationLevels[escalation.currentLevel - 1];
    if (!escalationLevel) {
      this.completeEscalation(escalation);
      return;
    }

    // Collect all recipients
    const recipients = [
      ...escalationLevel.recipients.users,
      ...escalationLevel.recipients.groups,
      ...escalationLevel.recipients.channels,
      ...escalationLevel.recipients.integrations
    ];

    // Add escalation event
    const escalationEvent: EscalationEvent = {
      id: uuidv4(),
      type: 'escalated',
      level: escalation.currentLevel,
      timestamp: Date.now(),
      recipients,
      metadata: {
        levelName: escalationLevel.name,
        requireAcknowledgment: escalationLevel.actions.requireAcknowledgment
      }
    };

    escalation.escalationHistory.push(escalationEvent);

    // Remove scheduled escalation
    this.scheduledEscalations.delete(escalation.alertId);

    // Emit escalation event
    this.emit('escalation_triggered', {
      alertId: escalation.alertId,
      escalationId: escalation.id,
      level: escalation.currentLevel,
      levelName: escalationLevel.name,
      recipients,
      timestamp: Date.now(),
      requireAcknowledgment: escalationLevel.actions.requireAcknowledgment
    });

    logger.info('Escalation executed', {
      alertId: escalation.alertId,
      escalationId: escalation.id,
      level: escalation.currentLevel,
      levelName: escalationLevel.name,
      recipientCount: recipients.length
    });

    // Schedule next escalation if auto-escalate is enabled
    if (escalationLevel.actions.escalateAfter && this.options.enableAutoEscalation) {
      this.scheduleNextEscalation(escalation, rule);
    }
  }

  private completeEscalation(escalation: EscalationInstance): void {
    escalation.status = 'completed';
    
    // Add completion event
    escalation.escalationHistory.push({
      id: uuidv4(),
      type: 'resolved',
      level: escalation.currentLevel,
      timestamp: Date.now(),
      recipients: []
    });

    this.emit('escalation_completed', {
      alertId: escalation.alertId,
      escalationId: escalation.id,
      finalLevel: escalation.currentLevel
    });

    logger.info('Escalation completed', {
      alertId: escalation.alertId,
      escalationId: escalation.id,
      finalLevel: escalation.currentLevel
    });
  }

  private processScheduledEscalations(): void {
    const now = Date.now();
    
    for (const [alertId, escalation] of this.activeEscalations.entries()) {
      if (escalation.status === 'active' && 
          escalation.nextEscalationAt && 
          now >= escalation.nextEscalationAt) {
        
        const rule = this.escalationRules.get(escalation.ruleId);
        if (rule) {
          this.executeEscalation(escalation, rule);
        }
      }
    }
  }

  // Clean up completed and old escalations
  cleanup(maxRetentionDays: number = 30): void {
    const cutoff = Date.now() - (maxRetentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [alertId, escalation] of this.activeEscalations.entries()) {
      if ((escalation.status === 'completed' || escalation.status === 'stopped') &&
          escalation.startedAt < cutoff) {
        this.activeEscalations.delete(alertId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old escalations', { cleanedCount });
    }
  }

  destroy(): void {
    // Clear all scheduled timeouts
    for (const timeout of this.scheduledEscalations.values()) {
      clearTimeout(timeout);
    }

    this.removeAllListeners();
    this.escalationRules.clear();
    this.activeEscalations.clear();
    this.scheduledEscalations.clear();
  }
}