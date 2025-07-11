-- Advanced Performance Indexes for N8N MCP Credential Management System

-- Drop existing basic indexes
DROP INDEX IF EXISTS idx_user_credentials_user_id CASCADE;
DROP INDEX IF EXISTS idx_credential_usage_user_id CASCADE;
DROP INDEX IF EXISTS idx_security_events_user_id CASCADE;

-- ============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================

-- User credentials - optimized for common access patterns
CREATE INDEX CONCURRENTLY idx_credentials_user_provider_active 
ON user_credentials(user_id, provider, is_active) 
INCLUDE (encrypted_api_key, encryption_version, last_validated_at)
WHERE is_active = true;

-- Covering index for credential validation queries
CREATE INDEX CONCURRENTLY idx_credentials_validation_check 
ON user_credentials(validation_status, last_validated_at, next_validation_at)
INCLUDE (user_id, provider, is_active)
WHERE is_active = true AND validation_status != 'valid';

-- API usage analytics - optimized for cost calculations
CREATE INDEX CONCURRENTLY idx_usage_cost_analytics 
ON api_usage_events(user_id, created_at DESC, provider) 
INCLUDE (estimated_cost, input_tokens, output_tokens, model)
WHERE estimated_cost > 0;

-- Time-series optimization for usage data
CREATE INDEX CONCURRENTLY idx_usage_time_series 
ON api_usage_events USING BRIN(created_at)
WITH (pages_per_range = 128);

-- Security events - optimized for threat detection
CREATE INDEX CONCURRENTLY idx_security_critical_events 
ON security_events(severity, event_type, created_at DESC)
INCLUDE (user_id, ip_address, metadata)
WHERE severity IN ('high', 'critical');

-- Budget tracking - real-time budget checks
CREATE INDEX CONCURRENTLY idx_budget_realtime_check 
ON budget_usage(budget_config_id, period_end)
INCLUDE (current_spend, request_count)
WHERE period_end >= CURRENT_DATE;

-- ============================================
-- PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ============================================

-- Active sessions for quick authentication
CREATE INDEX CONCURRENTLY idx_sessions_active_auth 
ON user_sessions(session_token, expires_at)
INCLUDE (user_id, ip_address, last_activity)
WHERE is_active = true AND expires_at > NOW();

-- Failed API calls for debugging
CREATE INDEX CONCURRENTLY idx_usage_failures 
ON api_usage_events(user_id, created_at DESC)
WHERE error_message IS NOT NULL;

-- High-cost operations monitoring
CREATE INDEX CONCURRENTLY idx_usage_high_cost 
ON api_usage_events(created_at DESC, estimated_cost DESC)
WHERE estimated_cost > 1.0;

-- ============================================
-- EXPRESSION INDEXES
-- ============================================

-- JSON metadata searches
CREATE INDEX CONCURRENTLY idx_usage_metadata_feature 
ON api_usage_events USING GIN((metadata->'feature'))
WHERE metadata IS NOT NULL;

-- Provider-specific model usage
CREATE INDEX CONCURRENTLY idx_usage_provider_model 
ON api_usage_events((provider || ':' || model), created_at DESC);

-- ============================================
-- QUERY PERFORMANCE VIEWS
-- ============================================

-- Materialized view for hourly usage summaries
CREATE MATERIALIZED VIEW mv_hourly_usage_summary AS
SELECT 
  user_id,
  provider,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as request_count,
  SUM(estimated_cost) as total_cost,
  SUM(input_tokens + output_tokens) as total_tokens,
  AVG(execution_time) as avg_execution_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time) as p95_execution_time,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time) as p99_execution_time
FROM api_usage_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id, provider, DATE_TRUNC('hour', created_at);

CREATE UNIQUE INDEX idx_mv_hourly_usage ON mv_hourly_usage_summary(user_id, provider, hour);

-- Index for fast refresh
CREATE INDEX CONCURRENTLY idx_usage_refresh_mv 
ON api_usage_events(created_at)
WHERE created_at >= NOW() - INTERVAL '7 days';

-- ============================================
-- STATISTICS AND MONITORING
-- ============================================

-- Update table statistics more frequently for critical tables
ALTER TABLE api_usage_events SET (autovacuum_analyze_scale_factor = 0.01);
ALTER TABLE user_credentials SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE budget_usage SET (autovacuum_analyze_scale_factor = 0.01);

-- Create custom statistics for correlated columns
CREATE STATISTICS stats_usage_correlation ON user_id, provider, created_at 
FROM api_usage_events;

CREATE STATISTICS stats_credential_correlation ON user_id, provider, is_active 
FROM user_credentials;