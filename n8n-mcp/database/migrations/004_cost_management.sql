-- Cost Management Database Schema

-- Provider pricing data
CREATE TABLE provider_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  input_token_price DECIMAL(10, 8) NOT NULL,
  output_token_price DECIMAL(10, 8) NOT NULL,
  minimum_charge DECIMAL(10, 6) DEFAULT 0,
  free_tokens INTEGER DEFAULT 0,
  requests_per_minute INTEGER DEFAULT 60,
  tokens_per_minute INTEGER DEFAULT 10000,
  requests_per_day INTEGER DEFAULT 10000,
  effective_date TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, model, effective_date)
);

-- User budget configurations
CREATE TABLE user_budget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50), -- NULL for global budget
  budget_type VARCHAR(20) NOT NULL CHECK (budget_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  budget_amount DECIMAL(10, 2) NOT NULL,
  alert_thresholds JSONB DEFAULT '[50, 75, 90, 95]', -- Alert at these percentages
  auto_stop_at_limit BOOLEAN DEFAULT false,
  rollover_unused BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider, budget_type)
);

-- Budget usage tracking
CREATE TABLE budget_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_config_id UUID NOT NULL REFERENCES user_budget_configs(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  current_spend DECIMAL(10, 4) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(budget_config_id, period_start)
);

-- Cost optimization recommendations
CREATE TABLE cost_optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  current_cost DECIMAL(10, 4) NOT NULL,
  projected_cost DECIMAL(10, 4) NOT NULL,
  potential_savings DECIMAL(10, 4) NOT NULL,
  savings_percentage DECIMAL(5, 2) NOT NULL,
  implementation_effort VARCHAR(20) CHECK (implementation_effort IN ('low', 'medium', 'high')),
  implementation_steps JSONB NOT NULL,
  risks JSONB DEFAULT '[]',
  benefits JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'implemented', 'dismissed', 'expired')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cost automation rules
CREATE TABLE cost_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  condition_data JSONB NOT NULL,
  action_data JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  savings_generated DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Budget alerts log
CREATE TABLE budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_config_id UUID NOT NULL REFERENCES user_budget_configs(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  threshold_percentage INTEGER NOT NULL,
  current_spend DECIMAL(10, 4) NOT NULL,
  budget_amount DECIMAL(10, 2) NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_provider_pricing_active ON provider_pricing(provider, model, is_active, effective_date DESC);
CREATE INDEX idx_budget_configs_user_active ON user_budget_configs(user_id, is_active);
CREATE INDEX idx_budget_usage_period ON budget_usage(budget_config_id, period_start, period_end);
CREATE INDEX idx_cost_recommendations_user_status ON cost_optimization_recommendations(user_id, status, created_at DESC);
CREATE INDEX idx_automation_rules_user_enabled ON cost_automation_rules(user_id, enabled);
CREATE INDEX idx_budget_alerts_config_time ON budget_alerts(budget_config_id, sent_at DESC);

-- Insert default provider pricing data
INSERT INTO provider_pricing (provider, model, input_token_price, output_token_price, requests_per_minute, tokens_per_minute) VALUES
('openai', 'gpt-3.5-turbo', 0.0000015, 0.000002, 3500, 90000),
('openai', 'gpt-4', 0.00003, 0.00006, 200, 10000),
('openai', 'gpt-4-turbo', 0.00001, 0.00003, 500, 30000),
('anthropic', 'claude-instant-1', 0.0000008, 0.0000024, 1000, 100000),
('anthropic', 'claude-2', 0.000008, 0.000024, 400, 40000),
('anthropic', 'claude-3-sonnet', 0.000003, 0.000015, 600, 60000),
('google', 'gemini-pro', 0.00000035, 0.00000105, 2000, 120000),
('cohere', 'command', 0.000001, 0.000002, 1000, 100000);

-- Create views for analytics
CREATE VIEW v_user_cost_summary AS
SELECT 
  u.id as user_id,
  u.email,
  DATE(aue.created_at) as usage_date,
  aue.provider,
  COUNT(*) as total_requests,
  SUM(aue.estimated_cost) as total_cost,
  SUM(aue.input_tokens + aue.output_tokens) as total_tokens,
  AVG(aue.estimated_cost) as avg_cost_per_request
FROM users u
JOIN api_usage_events aue ON u.id = aue.user_id
WHERE aue.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.id, u.email, DATE(aue.created_at), aue.provider;

CREATE VIEW v_budget_status AS
SELECT 
  bc.id as budget_config_id,
  bc.user_id,
  bc.provider,
  bc.budget_type,
  bc.budget_amount,
  COALESCE(bu.current_spend, 0) as current_spend,
  COALESCE(bu.request_count, 0) as request_count,
  ROUND((COALESCE(bu.current_spend, 0) / bc.budget_amount * 100), 2) as utilization_percentage,
  CASE 
    WHEN COALESCE(bu.current_spend, 0) / bc.budget_amount >= 0.95 THEN 'critical'
    WHEN COALESCE(bu.current_spend, 0) / bc.budget_amount >= 0.80 THEN 'warning'
    WHEN COALESCE(bu.current_spend, 0) / bc.budget_amount >= 0.50 THEN 'moderate'
    ELSE 'low'
  END as status
FROM user_budget_configs bc
LEFT JOIN budget_usage bu ON bc.id = bu.budget_config_id 
  AND bu.period_start <= CURRENT_DATE 
  AND bu.period_end >= CURRENT_DATE
WHERE bc.is_active = true;