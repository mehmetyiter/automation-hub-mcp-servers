import { getAuthHeaders } from './auth-service';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface SecurityEvent {
  id: string;
  userId?: string;
  userEmail?: string;
  eventType: string;
  eventCategory: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'network' | 'malware' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'suppressed';
  title: string;
  description: string;
  sourceIp?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  responseStatus?: number;
  geolocation?: any;
  riskScore: number;
  confidenceScore: number;
  evidence: any[];
  metadata: Record<string, any>;
  ruleId?: string;
  parentIncidentId?: string;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThreatRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'pattern' | 'threshold' | 'anomaly' | 'geolocation' | 'time_based' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: any;
  actions: {
    alert: boolean;
    block_ip?: boolean;
    require_mfa?: boolean;
    escalate?: boolean;
    audit_log?: boolean;
  };
  enabled: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
  triggerCount: number;
  falsePositiveCount: number;
  effectivenessScore: number;
}

export interface SecurityIncident {
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
  damageAssessment?: any;
  assignedTo?: string;
  assignedToEmail?: string;
  createdBy?: string;
  resolvedBy?: string;
  escalatedTo?: string;
  estimatedImpact?: 'minimal' | 'minor' | 'moderate' | 'major' | 'severe';
  actualImpact?: 'minimal' | 'minor' | 'moderate' | 'major' | 'severe';
  mttrMinutes?: number;
  costEstimate?: number;
  externalReference?: string;
  eventCount: number;
  avgRiskScore: number;
  createdAt: string;
  updatedAt: string;
  firstDetectedAt: string;
  incidentStartTime?: string;
  incidentEndTime?: string;
  resolvedAt?: string;
}

export interface TimelineEntry {
  timestamp: string;
  action: string;
  actor: string;
  description: string;
  evidence?: any;
}

export interface ResponseAction {
  id: string;
  action: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  notes?: string;
}

export interface ComplianceFramework {
  name: string;
  version: string;
  requirements: ComplianceRequirement[];
  lastAssessment?: string;
  complianceScore?: number;
  gaps?: ComplianceGap[];
}

export interface ComplianceRequirement {
  id: string;
  category: string;
  title: string;
  description: string;
  controls: string[];
  evidence: string[];
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  lastReviewed?: string;
  reviewer?: string;
  notes?: string;
}

export interface ComplianceGap {
  requirementId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediationPlan?: string;
  estimatedEffort?: string;
  deadline?: string;
  assignedTo?: string;
}

export interface ComplianceReport {
  id: string;
  framework: string;
  reportType: 'assessment' | 'audit' | 'certification' | 'gap_analysis';
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalRequirements: number;
    compliantCount: number;
    partialCount: number;
    nonCompliantCount: number;
    notApplicableCount: number;
    overallScore: number;
  };
  sections: any[];
  findings: any[];
  recommendations: string[];
  generatedAt: string;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  title: string;
}

class SecurityAPIService {
  // Security Dashboard
  async getSecurityDashboard(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/security/dashboard`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch security dashboard');
    }

    const data = await response.json();
    return data.data;
  }

  // Security Events
  async processSecurityEvent(event: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const response = await fetch(`${API_BASE_URL}/security/events`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      throw new Error('Failed to process security event');
    }

    const data = await response.json();
    return data.data;
  }

  async getSecurityEvents(params: {
    userId?: string;
    severity?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: SecurityEvent[]; pagination: any }> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (value instanceof Date) {
          searchParams.append(key, value.toISOString());
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });

    const response = await fetch(`${API_BASE_URL}/security/events?${searchParams}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch security events');
    }

    const data = await response.json();
    return {
      data: data.data,
      pagination: data.pagination
    };
  }

  // Threat Detection
  async getThreatRules(): Promise<ThreatRule[]> {
    const response = await fetch(`${API_BASE_URL}/security/threats/rules`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch threat rules');
    }

    const data = await response.json();
    return data.data;
  }

  async addThreatRule(rule: Omit<ThreatRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount' | 'falsePositiveCount' | 'effectivenessScore'>): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/security/threats/rules`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rule)
    });

    if (!response.ok) {
      throw new Error('Failed to add threat rule');
    }

    const data = await response.json();
    return data.data.id;
  }

  async updateThreatRule(ruleId: string, updates: Partial<ThreatRule>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/threats/rules/${ruleId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update threat rule');
    }
  }

  async reportFalsePositive(ruleId: string, eventId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/threats/${ruleId}/false-positive`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventId })
    });

    if (!response.ok) {
      throw new Error('Failed to report false positive');
    }
  }

  // Incident Management
  async getIncidents(status?: string): Promise<SecurityIncident[]> {
    const params = status ? `?status=${status}` : '';
    const response = await fetch(`${API_BASE_URL}/security/incidents${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch incidents');
    }

    const data = await response.json();
    return data.data;
  }

  async getIncidentDetails(incidentId: string): Promise<SecurityIncident> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/${incidentId}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch incident details');
    }

    const data = await response.json();
    return data.data;
  }

  async createIncident(incident: Partial<SecurityIncident>): Promise<SecurityIncident> {
    const response = await fetch(`${API_BASE_URL}/security/incidents`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(incident)
    });

    if (!response.ok) {
      throw new Error('Failed to create incident');
    }

    const data = await response.json();
    return data.data;
  }

  async updateIncident(incidentId: string, updates: Partial<SecurityIncident>): Promise<SecurityIncident> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/${incidentId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update incident');
    }

    const data = await response.json();
    return data.data;
  }

  async assignIncident(incidentId: string, userId: string): Promise<SecurityIncident> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/${incidentId}/assign`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      throw new Error('Failed to assign incident');
    }

    const data = await response.json();
    return data.data;
  }

  async escalateIncident(incidentId: string, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/${incidentId}/escalate`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      throw new Error('Failed to escalate incident');
    }
  }

  async addResponseAction(incidentId: string, action: Omit<ResponseAction, 'id'>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/${incidentId}/actions`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(action)
    });

    if (!response.ok) {
      throw new Error('Failed to add response action');
    }
  }

  async updateResponseAction(incidentId: string, actionId: string, updates: Partial<ResponseAction>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/${incidentId}/actions/${actionId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update response action');
    }
  }

  async getIncidentMetrics(period = '30d'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/security/incidents/metrics?period=${period}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch incident metrics');
    }

    const data = await response.json();
    return data.data;
  }

  // Compliance
  async getComplianceStatus(framework?: string): Promise<any> {
    const params = framework ? `?framework=${framework}` : '';
    const response = await fetch(`${API_BASE_URL}/security/compliance/status${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch compliance status');
    }

    const data = await response.json();
    return data.data;
  }

  async getComplianceFrameworkDetails(framework: string): Promise<ComplianceFramework> {
    const response = await fetch(`${API_BASE_URL}/security/compliance/frameworks/${framework}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch framework details');
    }

    const data = await response.json();
    return data.data;
  }

  async generateComplianceReport(params: {
    framework: string;
    reportType: string;
    startDate: Date;
    endDate: Date;
  }): Promise<ComplianceReport> {
    const response = await fetch(`${API_BASE_URL}/security/compliance/reports`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        framework: params.framework,
        reportType: params.reportType,
        startDate: params.startDate.toISOString(),
        endDate: params.endDate.toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate compliance report');
    }

    const data = await response.json();
    return data.data;
  }

  async getComplianceReports(): Promise<ComplianceReport[]> {
    const response = await fetch(`${API_BASE_URL}/security/compliance/reports`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch compliance reports');
    }

    const data = await response.json();
    return data.data;
  }

  async getAuditTrail(filters: {
    startDate?: Date;
    endDate?: Date;
    objectType?: string;
    actorId?: string;
    framework?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const searchParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        if (value instanceof Date) {
          searchParams.append(key, value.toISOString());
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });

    const response = await fetch(`${API_BASE_URL}/security/compliance/audit-trail?${searchParams}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit trail');
    }

    const data = await response.json();
    return data.data;
  }

  // Security Metrics
  async getSecurityMetrics(period = '24h', metricType?: string): Promise<any[]> {
    const params = new URLSearchParams({ period });
    if (metricType) params.append('metricType', metricType);

    const response = await fetch(`${API_BASE_URL}/security/metrics?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch security metrics');
    }

    const data = await response.json();
    return data.data;
  }

  async exportSecurityMetrics(period = '24h'): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/security/metrics/export?period=${period}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to export security metrics');
    }

    return response.blob();
  }

  // Security Configuration
  async getSecurityConfiguration(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/security/config`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch security configuration');
    }

    const data = await response.json();
    return data.data;
  }

  async updateSecurityConfiguration(config: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/config`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error('Failed to update security configuration');
    }
  }

  // Alerts
  async getSecurityAlerts(params: {
    acknowledged?: boolean;
    severity?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE_URL}/security/alerts?${searchParams}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch security alerts');
    }

    const data = await response.json();
    return data.data;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/security/alerts/${alertId}/acknowledge`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to acknowledge alert');
    }
  }

  // Audit Logs
  async getAuditLogs(params: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    resourceType?: string;
    action?: string;
    riskLevel?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: any[]; pagination: any }> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (value instanceof Date) {
          searchParams.append(key, value.toISOString());
        } else if (Array.isArray(value)) {
          searchParams.append(key, value.join(','));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });

    const response = await fetch(`${API_BASE_URL}/security/audit/logs?${searchParams}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }

    const data = await response.json();
    return {
      data: data.data,
      pagination: data.pagination
    };
  }

  async exportAuditLogs(params: any, format: 'json' | 'csv' = 'csv'): Promise<Blob> {
    const searchParams = new URLSearchParams();
    searchParams.append('format', format);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (value instanceof Date) {
          searchParams.append(key, value.toISOString());
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });

    const response = await fetch(`${API_BASE_URL}/security/audit/export?${searchParams}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to export audit logs');
    }

    return response.blob();
  }

  async generateAuditReport(params: {
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/security/audit/reports`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startDate: params.startDate.toISOString(),
        endDate: params.endDate.toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate audit report');
    }

    const data = await response.json();
    return data.data;
  }
}

// Export singleton instance
export const securityAPIService = new SecurityAPIService();

// Helper function to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const userId = localStorage.getItem('user_id');
  
  const headers: HeadersInit = {
    'Accept': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (userId) {
    headers['X-User-Id'] = userId;
  }

  return headers;
}