-- Migration: Create universal credentials tables for multi-platform support
-- Version: 004
-- Date: 2025-01-11

-- Create universal credentials table
CREATE TABLE IF NOT EXISTS universal_credentials (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('n8n', 'zapier', 'make', 'vapi', 'custom')),
    provider VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('api_key', 'oauth2', 'basic_auth', 'bearer_token', 'custom')),
    security_level VARCHAR(20) NOT NULL CHECK (security_level IN ('standard', 'high', 'critical')),
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Encrypted data
    encrypted_data TEXT NOT NULL,
    encryption_context JSONB NOT NULL,
    key_version INTEGER NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    validation_status VARCHAR(20) CHECK (validation_status IN ('valid', 'invalid', 'expired', 'rate_limited', 'unknown')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Indexes for common queries
    CONSTRAINT unique_user_name_platform UNIQUE (user_id, name, platform)
);

-- Create indexes for performance
CREATE INDEX idx_universal_credentials_user_id ON universal_credentials(user_id);
CREATE INDEX idx_universal_credentials_platform ON universal_credentials(platform);
CREATE INDEX idx_universal_credentials_provider ON universal_credentials(provider);
CREATE INDEX idx_universal_credentials_type ON universal_credentials(type);
CREATE INDEX idx_universal_credentials_security_level ON universal_credentials(security_level);
CREATE INDEX idx_universal_credentials_validation_status ON universal_credentials(validation_status);
CREATE INDEX idx_universal_credentials_is_active ON universal_credentials(is_active);
CREATE INDEX idx_universal_credentials_expires_at ON universal_credentials(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_universal_credentials_metadata_gin ON universal_credentials USING gin(metadata);

-- Create credential usage tracking table
CREATE TABLE IF NOT EXISTS credential_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES universal_credentials(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    response_time INTEGER NOT NULL, -- milliseconds
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    error TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Platform-specific IDs
    workflow_id VARCHAR(255), -- n8n
    zap_id VARCHAR(255), -- Zapier
    scenario_id VARCHAR(255), -- Make
    call_id VARCHAR(255), -- Vapi
    
    -- Indexes
    CONSTRAINT check_platform_ids CHECK (
        (platform = 'n8n' AND workflow_id IS NOT NULL) OR
        (platform = 'zapier' AND zap_id IS NOT NULL) OR
        (platform = 'make' AND scenario_id IS NOT NULL) OR
        (platform = 'vapi' AND call_id IS NOT NULL) OR
        (platform = 'custom')
    )
);

-- Create indexes for usage tracking
CREATE INDEX idx_credential_usage_credential_id ON credential_usage_tracking(credential_id);
CREATE INDEX idx_credential_usage_platform ON credential_usage_tracking(platform);
CREATE INDEX idx_credential_usage_timestamp ON credential_usage_tracking(timestamp);
CREATE INDEX idx_credential_usage_operation ON credential_usage_tracking(operation);
CREATE INDEX idx_credential_usage_success ON credential_usage_tracking(success);
CREATE INDEX idx_credential_usage_workflow_id ON credential_usage_tracking(workflow_id) WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_credential_usage_zap_id ON credential_usage_tracking(zap_id) WHERE zap_id IS NOT NULL;
CREATE INDEX idx_credential_usage_scenario_id ON credential_usage_tracking(scenario_id) WHERE scenario_id IS NOT NULL;
CREATE INDEX idx_credential_usage_call_id ON credential_usage_tracking(call_id) WHERE call_id IS NOT NULL;

-- Create credential migrations table
CREATE TABLE IF NOT EXISTS credential_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_credential_id UUID NOT NULL REFERENCES universal_credentials(id) ON DELETE CASCADE,
    target_credential_id UUID REFERENCES universal_credentials(id) ON DELETE SET NULL,
    source_platform VARCHAR(50) NOT NULL,
    target_platform VARCHAR(50) NOT NULL,
    migration_status VARCHAR(20) NOT NULL CHECK (migration_status IN ('pending', 'in_progress', 'completed', 'failed')),
    mappings JSONB NOT NULL,
    transformations JSONB NOT NULL,
    validation_status VARCHAR(20),
    migration_errors TEXT[],
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for migrations
CREATE INDEX idx_credential_migrations_source ON credential_migrations(source_credential_id);
CREATE INDEX idx_credential_migrations_target ON credential_migrations(target_credential_id);
CREATE INDEX idx_credential_migrations_status ON credential_migrations(migration_status);

-- Create platform configurations table
CREATE TABLE IF NOT EXISTS platform_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL UNIQUE,
    supported_providers TEXT[] NOT NULL,
    supported_types TEXT[] NOT NULL,
    required_fields JSONB NOT NULL,
    optional_fields JSONB NOT NULL,
    validation_rules JSONB NOT NULL,
    transformation_rules JSONB,
    default_settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default platform configurations
INSERT INTO platform_configurations (platform, supported_providers, supported_types, required_fields, optional_fields, validation_rules, default_settings) VALUES
('n8n', ARRAY['openai', 'anthropic', 'google', 'cohere', 'azure', 'aws'], 
 ARRAY['api_key', 'oauth2', 'basic_auth'], 
 '{"api_key": ["apiKey"], "oauth2": ["token", "clientId"], "basic_auth": ["username", "password"]}',
 '{"api_key": ["endpoint", "organizationId"], "oauth2": ["refreshToken", "clientSecret"]}',
 '{"apiKey": {"pattern": "^.+$", "minLength": 10}}',
 '{"timeout": 30000, "retries": 3}'),

('zapier', ARRAY['openai', 'anthropic', 'google', 'cohere', 'custom'], 
 ARRAY['api_key', 'oauth2', 'basic_auth', 'bearer_token'],
 '{"api_key": ["apiKey"], "oauth2": ["token", "clientId"], "basic_auth": ["username", "password"], "bearer_token": ["token"]}',
 '{"all": ["endpoint", "description"]}',
 '{"apiKey": {"pattern": "^.+$", "minLength": 10}}',
 '{"timeout": 30000}'),

('make', ARRAY['openai', 'anthropic', 'google', 'cohere', 'azure', 'custom'],
 ARRAY['api_key', 'oauth2', 'basic_auth', 'bearer_token'],
 '{"api_key": ["apiKey"], "oauth2": ["token", "clientId"], "basic_auth": ["username", "password"], "bearer_token": ["token"]}',
 '{"all": ["endpoint", "region", "projectId"]}',
 '{"endpoint": {"type": "url"}}',
 '{"timeout": 30000, "maxExecutionTime": 40}'),

('vapi', ARRAY['openai', 'anthropic', 'google', 'azure', 'custom'],
 ARRAY['api_key', 'bearer_token'],
 '{"api_key": ["apiKey"], "bearer_token": ["token"]}',
 '{"all": ["endpoint", "voiceSettings"]}',
 '{"apiKey": {"pattern": "^.+$", "minLength": 20}}',
 '{"maxCallDuration": 3600, "concurrentCalls": 10}'),

('custom', ARRAY['custom'],
 ARRAY['api_key', 'oauth2', 'basic_auth', 'bearer_token', 'custom'],
 '{}',
 '{}',
 '{}',
 '{"timeout": 30000, "retries": 3}');

-- Create credential lifecycle events table
CREATE TABLE IF NOT EXISTS credential_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES universal_credentials(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'created', 'updated', 'deleted', 'validated', 'used', 
        'rotated', 'expired', 'migrated', 'exported', 'imported'
    )),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details JSONB NOT NULL DEFAULT '{}',
    platform VARCHAR(50),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for lifecycle events
CREATE INDEX idx_credential_lifecycle_credential_id ON credential_lifecycle_events(credential_id);
CREATE INDEX idx_credential_lifecycle_user_id ON credential_lifecycle_events(user_id);
CREATE INDEX idx_credential_lifecycle_event_type ON credential_lifecycle_events(event_type);
CREATE INDEX idx_credential_lifecycle_timestamp ON credential_lifecycle_events(timestamp);

-- Create views for easier querying
CREATE OR REPLACE VIEW active_credentials_by_platform AS
SELECT 
    platform,
    provider,
    type,
    COUNT(*) as total_credentials,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN validation_status = 'valid' THEN 1 END) as valid_credentials,
    COUNT(CASE WHEN last_used_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as recently_used
FROM universal_credentials
WHERE is_active = true
GROUP BY platform, provider, type;

CREATE OR REPLACE VIEW credential_usage_summary AS
SELECT 
    c.id as credential_id,
    c.name as credential_name,
    c.platform,
    c.provider,
    COUNT(u.id) as total_uses,
    COUNT(CASE WHEN u.success THEN 1 END) as successful_uses,
    AVG(u.response_time) as avg_response_time,
    SUM(u.tokens_used) as total_tokens,
    SUM(u.cost) as total_cost,
    MAX(u.timestamp) as last_used
FROM universal_credentials c
LEFT JOIN credential_usage_tracking u ON c.id = u.credential_id
WHERE u.timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY c.id, c.name, c.platform, c.provider;

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_universal_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_universal_credentials_updated_at
    BEFORE UPDATE ON universal_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_universal_credentials_updated_at();

CREATE TRIGGER update_platform_configurations_updated_at
    BEFORE UPDATE ON platform_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_universal_credentials_updated_at();

-- Add function to track credential lifecycle events
CREATE OR REPLACE FUNCTION track_credential_lifecycle_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO credential_lifecycle_events (credential_id, user_id, event_type, details, platform)
        VALUES (NEW.id, NEW.user_id, 'created', 
                jsonb_build_object('provider', NEW.provider, 'type', NEW.type),
                NEW.platform);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Track validation changes
        IF OLD.validation_status IS DISTINCT FROM NEW.validation_status THEN
            INSERT INTO credential_lifecycle_events (credential_id, user_id, event_type, details, platform)
            VALUES (NEW.id, NEW.user_id, 'validated',
                    jsonb_build_object('old_status', OLD.validation_status, 'new_status', NEW.validation_status),
                    NEW.platform);
        END IF;
        
        -- Track expiration
        IF NEW.expires_at IS NOT NULL AND NEW.expires_at < CURRENT_TIMESTAMP AND 
           (OLD.expires_at IS NULL OR OLD.expires_at >= CURRENT_TIMESTAMP) THEN
            INSERT INTO credential_lifecycle_events (credential_id, user_id, event_type, details, platform)
            VALUES (NEW.id, NEW.user_id, 'expired',
                    jsonb_build_object('expired_at', NEW.expires_at),
                    NEW.platform);
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO credential_lifecycle_events (credential_id, user_id, event_type, details, platform)
        VALUES (OLD.id, OLD.user_id, 'deleted',
                jsonb_build_object('provider', OLD.provider, 'type', OLD.type),
                OLD.platform);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_credential_lifecycle
    AFTER INSERT OR UPDATE OR DELETE ON universal_credentials
    FOR EACH ROW
    EXECUTE FUNCTION track_credential_lifecycle_event();

-- Add comments for documentation
COMMENT ON TABLE universal_credentials IS 'Stores encrypted credentials for multiple automation platforms';
COMMENT ON TABLE credential_usage_tracking IS 'Tracks usage of credentials across different platforms';
COMMENT ON TABLE credential_migrations IS 'Tracks migrations of credentials between platforms';
COMMENT ON TABLE platform_configurations IS 'Stores configuration for each supported platform';
COMMENT ON TABLE credential_lifecycle_events IS 'Audit log of all credential lifecycle events';