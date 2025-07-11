-- Security Monitoring Database Schema

-- Threat detection rules
CREATE TABLE threat_detection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('pattern', 'threshold', 'anomaly', 'geolocation', 'time_based', 'behavioral')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_triggered TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  false_positive_count INTEGER DEFAULT 0,
  effectiveness_score DECIMAL(3,2) DEFAULT 0.0
);

-- Enhanced security events
CREATE TABLE security_events_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(100),
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('authentication', 'authorization', 'data_access', 'configuration', 'network', 'malware', 'policy_violation')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive', 'suppressed')),
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  source_ip INET,
  user_agent TEXT,
  request_path VARCHAR(1000),
  request_method VARCHAR(10),
  response_status INTEGER,
  geolocation JSONB,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  evidence JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  rule_id UUID REFERENCES threat_detection_rules(id),
  parent_incident_id UUID,
  assigned_to UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Security incidents
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  incident_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'investigating', 'contained', 'eradicated', 'recovered', 'closed')),
  source VARCHAR(100) NOT NULL,
  affected_systems JSONB DEFAULT '[]',
  affected_users JSONB DEFAULT '[]',
  attack_vectors JSONB DEFAULT '[]',
  indicators_of_compromise JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  response_actions JSONB DEFAULT '[]',
  lessons_learned TEXT,
  damage_assessment JSONB,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  escalated_to VARCHAR(200),
  estimated_impact VARCHAR(20) CHECK (estimated_impact IN ('minimal', 'minor', 'moderate', 'major', 'severe')),
  actual_impact VARCHAR(20) CHECK (actual_impact IN ('minimal', 'minor', 'moderate', 'major', 'severe')),
  mttr_minutes INTEGER, -- Mean Time To Repair
  cost_estimate DECIMAL(10,2),
  external_reference VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  first_detected_at TIMESTAMP DEFAULT NOW(),
  incident_start_time TIMESTAMP,
  incident_end_time TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Security incident events relationship
CREATE TABLE incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES security_events_enhanced(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('root_cause', 'related', 'follow_up', 'evidence')),
  added_at TIMESTAMP DEFAULT NOW(),
  added_by UUID REFERENCES users(id),
  UNIQUE(incident_id, event_id)
);

-- Security metrics tracking
CREATE TABLE security_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(100) NOT NULL,
  metric_name VARCHAR(200) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit VARCHAR(50),
  measurement_period VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  tags JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_type, metric_name, period_start, period_end)
);

-- User behavior baselines
CREATE TABLE user_behavior_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  behavior_type VARCHAR(100) NOT NULL,
  baseline_data JSONB NOT NULL,
  confidence_level DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, behavior_type)
);

-- Security alerts and notifications
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  source VARCHAR(100) NOT NULL,
  target_audience VARCHAR(50) NOT NULL CHECK (target_audience IN ('admin', 'security_team', 'user', 'all')),
  delivery_channels JSONB NOT NULL, -- ['email', 'slack', 'webhook', 'dashboard']
  related_incident_id UUID REFERENCES security_incidents(id),
  related_event_id UUID REFERENCES security_events_enhanced(id),
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Compliance audit trail
CREATE TABLE compliance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_type VARCHAR(100) NOT NULL,
  object_type VARCHAR(100) NOT NULL,
  object_id VARCHAR(200) NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_type VARCHAR(50) NOT NULL DEFAULT 'user',
  timestamp TIMESTAMP DEFAULT NOW(),
  source_ip INET,
  user_agent TEXT,
  before_state JSONB,
  after_state JSONB,
  compliance_frameworks JSONB DEFAULT '[]', -- ['SOC2', 'GDPR', 'HIPAA', etc.]
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  retention_period_days INTEGER DEFAULT 2555, -- 7 years default
  metadata JSONB DEFAULT '{}'
);

-- Security configuration
CREATE TABLE security_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(200) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  config_type VARCHAR(50) NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_security_events_user_time ON security_events_enhanced(user_id, created_at DESC);
CREATE INDEX idx_security_events_type_severity ON security_events_enhanced(event_type, severity);
CREATE INDEX idx_security_events_status_created ON security_events_enhanced(status, created_at DESC);
CREATE INDEX idx_security_events_risk_score ON security_events_enhanced(risk_score DESC);
CREATE INDEX idx_security_events_source_ip ON security_events_enhanced(source_ip) WHERE source_ip IS NOT NULL;

CREATE INDEX idx_incidents_status_priority ON security_incidents(status, priority, created_at DESC);
CREATE INDEX idx_incidents_assigned_to ON security_incidents(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_incidents_severity_time ON security_incidents(severity, created_at DESC);
CREATE INDEX idx_incidents_type_status ON security_incidents(incident_type, status);

CREATE INDEX idx_threat_rules_enabled ON threat_detection_rules(enabled, rule_type);
CREATE INDEX idx_threat_rules_effectiveness ON threat_detection_rules(effectiveness_score DESC) WHERE enabled = true;

CREATE INDEX idx_security_metrics_type_period ON security_metrics(metric_type, period_start, period_end);
CREATE INDEX idx_behavior_baselines_user ON user_behavior_baselines(user_id, behavior_type);

CREATE INDEX idx_compliance_audit_time ON compliance_audit_trail(timestamp DESC);
CREATE INDEX idx_compliance_audit_object ON compliance_audit_trail(object_type, object_id);
CREATE INDEX idx_compliance_audit_actor ON compliance_audit_trail(actor_id, timestamp DESC);

-- Partitioning for large tables (optional, for high-volume environments)
-- CREATE TABLE security_events_enhanced_y2024 PARTITION OF security_events_enhanced
-- FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Views for common queries
CREATE VIEW v_critical_security_events AS
SELECT 
  se.*,
  u.email as user_email,
  tr.name as rule_name
FROM security_events_enhanced se
LEFT JOIN users u ON se.user_id = u.id
LEFT JOIN threat_detection_rules tr ON se.rule_id = tr.id
WHERE se.severity IN ('high', 'critical') 
  AND se.status = 'open'
  AND se.created_at >= NOW() - INTERVAL '24 hours';

CREATE VIEW v_incident_summary AS
SELECT 
  si.*,
  u_assigned.email as assigned_to_email,
  u_created.email as created_by_email,
  COUNT(ie.event_id) as event_count,
  AVG(se.risk_score) as avg_risk_score
FROM security_incidents si
LEFT JOIN users u_assigned ON si.assigned_to = u_assigned.id
LEFT JOIN users u_created ON si.created_by = u_created.id
LEFT JOIN incident_events ie ON si.id = ie.incident_id
LEFT JOIN security_events_enhanced se ON ie.event_id = se.id
GROUP BY si.id, u_assigned.email, u_created.email;

CREATE VIEW v_security_metrics_daily AS
SELECT 
  DATE(period_start) as date,
  metric_type,
  metric_name,
  AVG(metric_value) as avg_value,
  MIN(metric_value) as min_value,
  MAX(metric_value) as max_value,
  COUNT(*) as measurement_count
FROM security_metrics
WHERE measurement_period = 'hourly'
  AND period_start >= NOW() - INTERVAL '30 days'
GROUP BY DATE(period_start), metric_type, metric_name;

-- Insert default threat detection rules
INSERT INTO threat_detection_rules (name, description, rule_type, severity, conditions, actions) VALUES
('Multiple Failed Login Attempts', 'Detect multiple failed login attempts from same IP', 'threshold', 'medium', 
 '{"event_type": "authentication_failed", "threshold": 5, "time_window": "5m", "group_by": "source_ip"}',
 '{"alert": true, "block_ip": false, "escalate": false}'),

('Unusual Geographic Access', 'Detect access from unusual geographic locations', 'geolocation', 'high',
 '{"check_user_location_history": true, "distance_threshold_km": 1000, "time_threshold_hours": 2}',
 '{"alert": true, "require_mfa": true, "escalate": true}'),

('Credential Access Anomaly', 'Detect unusual credential access patterns', 'anomaly', 'high',
 '{"analyze_access_patterns": true, "deviation_threshold": 3, "min_baseline_days": 7}',
 '{"alert": true, "require_additional_auth": true, "escalate": false}'),

('High-Risk API Usage', 'Detect high-risk API operations', 'pattern', 'critical',
 '{"event_type": "api_request", "risk_score_threshold": 80, "sensitive_operations": ["delete", "export", "admin"]}',
 '{"alert": true, "escalate": true, "audit_log": true}'),

('Off-Hours Access', 'Detect access during unusual hours', 'time_based', 'medium',
 '{"business_hours": {"start": "08:00", "end": "18:00"}, "check_weekends": true, "timezone": "UTC"}',
 '{"alert": true, "require_justification": true, "escalate": false}');

-- Insert default security configuration
INSERT INTO security_configuration (config_key, config_value, config_type, description) VALUES
('threat_detection_enabled', 'true', 'boolean', 'Enable threat detection engine'),
('anomaly_detection_sensitivity', '0.7', 'number', 'Anomaly detection sensitivity (0.0-1.0)'),
('incident_auto_assignment', 'true', 'boolean', 'Auto-assign incidents to security team'),
('alert_channels', '["email", "slack"]', 'array', 'Default alert delivery channels'),
('compliance_frameworks', '["SOC2", "GDPR"]', 'array', 'Active compliance frameworks'),
('security_metrics_retention_days', '90', 'number', 'Security metrics retention period'),
('baseline_update_frequency_hours', '24', 'number', 'User behavior baseline update frequency'),
('incident_escalation_threshold_minutes', '60', 'number', 'Auto-escalation threshold for critical incidents');