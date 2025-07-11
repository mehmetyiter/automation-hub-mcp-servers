-- User Credentials Management Schema
-- PostgreSQL Migration 001

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User credentials table for storing encrypted API keys
CREATE TABLE user_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  key_hash VARCHAR(255) NOT NULL, -- For validation without decryption
  is_active BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMP,
  validation_status VARCHAR(20) DEFAULT 'pending', -- pending, valid, invalid, expired
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Credential usage audit log
CREATE TABLE credential_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  operation VARCHAR(50) NOT NULL, -- store, validate, use, rotate, delete
  status VARCHAR(20) NOT NULL, -- success, failure
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  request_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- API usage tracking for billing and analytics
CREATE TABLE api_usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  operation VARCHAR(50) NOT NULL, -- generation, analysis, validation, optimization
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 6) DEFAULT 0,
  execution_time INTEGER DEFAULT 0, -- milliseconds
  request_id VARCHAR(100),
  feature VARCHAR(100),
  complexity VARCHAR(20), -- simple, moderate, complex
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User budget and limits
CREATE TABLE user_budget_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50),
  daily_limit DECIMAL(10, 2),
  monthly_limit DECIMAL(10, 2),
  requests_per_minute INTEGER DEFAULT 60,
  requests_per_day INTEGER DEFAULT 10000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Security events for monitoring
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- login, credential_access, suspicious_activity
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  description TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User sessions for tracking active sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance optimization

-- User credentials indexes
CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX idx_user_credentials_provider ON user_credentials(provider);
CREATE INDEX idx_user_credentials_validation_status ON user_credentials(validation_status);
CREATE INDEX idx_user_credentials_created_at ON user_credentials(created_at);

-- Credential usage log indexes
CREATE INDEX idx_credential_usage_user_id ON credential_usage_log(user_id);
CREATE INDEX idx_credential_usage_provider ON credential_usage_log(provider);
CREATE INDEX idx_credential_usage_operation ON credential_usage_log(operation);
CREATE INDEX idx_credential_usage_created_at ON credential_usage_log(created_at);
CREATE INDEX idx_credential_usage_status ON credential_usage_log(status);

-- API usage events indexes
CREATE INDEX idx_api_usage_user_id ON api_usage_events(user_id);
CREATE INDEX idx_api_usage_provider ON api_usage_events(provider);
CREATE INDEX idx_api_usage_created_at ON api_usage_events(created_at);
CREATE INDEX idx_api_usage_request_id ON api_usage_events(request_id);
CREATE INDEX idx_api_usage_feature ON api_usage_events(feature);

-- Budget limits indexes
CREATE INDEX idx_budget_limits_user_id ON user_budget_limits(user_id);
CREATE INDEX idx_budget_limits_provider ON user_budget_limits(provider);

-- Security events indexes
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_resolved ON security_events(resolved);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);

-- Composite indexes for common queries
CREATE INDEX idx_user_credentials_user_provider_active ON user_credentials(user_id, provider, is_active);
CREATE INDEX idx_api_usage_user_provider_date ON api_usage_events(user_id, provider, created_at);
CREATE INDEX idx_credential_usage_user_date ON credential_usage_log(user_id, created_at);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credentials_updated_at 
    BEFORE UPDATE ON user_credentials 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_budget_limits_updated_at 
    BEFORE UPDATE ON user_budget_limits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries

-- Active user credentials view
CREATE VIEW v_active_user_credentials AS
SELECT 
    uc.*,
    u.email,
    u.full_name
FROM user_credentials uc
JOIN users u ON uc.user_id = u.id
WHERE uc.is_active = true AND u.is_active = true;

-- User usage summary view
CREATE VIEW v_user_usage_summary AS
SELECT 
    user_id,
    provider,
    DATE(created_at) as usage_date,
    COUNT(*) as total_requests,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(estimated_cost) as total_cost,
    AVG(execution_time) as avg_execution_time
FROM api_usage_events
GROUP BY user_id, provider, DATE(created_at);

-- Security events summary view
CREATE VIEW v_security_summary AS
SELECT 
    user_id,
    event_type,
    severity,
    COUNT(*) as event_count,
    MAX(created_at) as last_occurrence,
    COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved_count
FROM security_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, event_type, severity;

-- Add comments for documentation
COMMENT ON TABLE user_credentials IS 'Stores encrypted API keys for various AI providers';
COMMENT ON TABLE credential_usage_log IS 'Audit log for all credential-related operations';
COMMENT ON TABLE api_usage_events IS 'Tracks API usage for billing and analytics';
COMMENT ON TABLE user_budget_limits IS 'User-defined spending limits and rate limits';
COMMENT ON TABLE security_events IS 'Security-related events and alerts';
COMMENT ON TABLE user_sessions IS 'Active user sessions for authentication';

COMMENT ON COLUMN user_credentials.encrypted_api_key IS 'AES-256-GCM encrypted API key stored as JSON';
COMMENT ON COLUMN user_credentials.key_hash IS 'SHA-256 hash for validation without decryption';
COMMENT ON COLUMN api_usage_events.estimated_cost IS 'Estimated cost in USD based on provider pricing';
COMMENT ON COLUMN api_usage_events.execution_time IS 'Request execution time in milliseconds';