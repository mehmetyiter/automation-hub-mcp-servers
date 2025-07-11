-- API Integration Database Schema

-- API keys and access tokens
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_name VARCHAR(200) NOT NULL,
  key_hash VARCHAR(256) NOT NULL UNIQUE, -- Hashed API key
  key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[], -- Permissions: ['read', 'write', 'admin']
  rate_limit INTEGER DEFAULT 1000, -- Requests per minute
  daily_limit INTEGER DEFAULT 50000, -- Requests per day
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- API usage tracking
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  endpoint VARCHAR(200) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  request_size_bytes INTEGER DEFAULT 0,
  response_size_bytes INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  date DATE GENERATED ALWAYS AS (created_at::DATE) STORED
);

-- Webhook configurations
CREATE TABLE webhook_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret_key VARCHAR(256) NOT NULL, -- For webhook signature verification
  events TEXT[] NOT NULL, -- ['credential.created', 'usage.limit_reached', etc.]
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  last_triggered_at TIMESTAMP,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Webhook delivery logs
CREATE TABLE webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhook_configurations(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  http_status_code INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 1,
  next_retry_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Real-time subscriptions
CREATE TABLE realtime_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id VARCHAR(100) NOT NULL,
  subscribed_events TEXT[] NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  last_ping_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- API rate limiting
CREATE TABLE rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(200) NOT NULL, -- API key, user ID, or IP
  bucket_type VARCHAR(50) NOT NULL, -- 'minute', 'hour', 'day'
  current_count INTEGER DEFAULT 0,
  max_count INTEGER NOT NULL,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(identifier, bucket_type, window_start)
);

-- Indexes for performance
CREATE INDEX idx_api_keys_user_active ON api_keys(user_id, is_active);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

CREATE INDEX idx_api_usage_logs_date ON api_usage_logs(date);
CREATE INDEX idx_api_usage_logs_api_key ON api_usage_logs(api_key_id, created_at DESC);
CREATE INDEX idx_api_usage_logs_user ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_usage_logs_endpoint ON api_usage_logs(endpoint, created_at DESC);

CREATE INDEX idx_webhook_configs_user ON webhook_configurations(user_id, is_active);
CREATE INDEX idx_webhook_configs_events ON webhook_configurations USING GIN(events);

CREATE INDEX idx_webhook_delivery_status ON webhook_delivery_logs(status, next_retry_at);
CREATE INDEX idx_webhook_delivery_webhook ON webhook_delivery_logs(webhook_id, created_at DESC);

CREATE INDEX idx_realtime_subs_user ON realtime_subscriptions(user_id, is_active);
CREATE INDEX idx_realtime_subs_connection ON realtime_subscriptions(connection_id);

CREATE INDEX idx_rate_limit_buckets_window ON rate_limit_buckets(identifier, bucket_type, window_end);

-- Partitioning for api_usage_logs (monthly partitions)
-- This helps with performance when you have millions of API calls
-- CREATE TABLE api_usage_logs_y2024m01 PARTITION OF api_usage_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');