-- AI-Driven Dynamic Prompt System Database Schema

-- Table for storing deep analysis results
CREATE TABLE deep_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_text TEXT NOT NULL,
    primary_goal VARCHAR(255),
    business_context TEXT,
    urgency VARCHAR(10) CHECK (urgency IN ('low', 'medium', 'high')),
    scope VARCHAR(20) CHECK (scope IN ('small', 'medium', 'large', 'enterprise')),
    complexity_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for recognized patterns
CREATE TABLE patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(50),
    pattern_name VARCHAR(255),
    description TEXT,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Table for workflow architectures
CREATE TABLE workflow_architectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES deep_analyses(id),
    architecture_json JSONB NOT NULL,
    node_count INTEGER,
    connection_count INTEGER,
    estimated_complexity DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for learning feedback
CREATE TABLE feedback_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255),
    workflow_type VARCHAR(50),
    outcome VARCHAR(20) CHECK (outcome IN ('success', 'failure', 'partial')),
    execution_time_ms INTEGER,
    node_count INTEGER,
    error_details JSONB,
    improvements_applied JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for performance metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_key VARCHAR(255) UNIQUE,
    workflow_type VARCHAR(50),
    outcome VARCHAR(20),
    total_count INTEGER DEFAULT 0,
    avg_execution_time_ms DECIMAL(10,2),
    success_rate DECIMAL(3,2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for learned insights
CREATE TABLE learned_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(50),
    category VARCHAR(100),
    description TEXT,
    confidence_score DECIMAL(3,2),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Table for workflow templates (AI-generated)
CREATE TABLE ai_workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(100),
    use_case VARCHAR(255),
    template_structure JSONB,
    success_rate DECIMAL(3,2),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_analyses_created_at ON deep_analyses(created_at DESC);
CREATE INDEX idx_patterns_effectiveness ON patterns(effectiveness_score DESC);
CREATE INDEX idx_feedback_workflow_id ON feedback_data(workflow_id);
CREATE INDEX idx_feedback_timestamp ON feedback_data(timestamp DESC);
CREATE INDEX idx_metrics_workflow_type ON performance_metrics(workflow_type);
CREATE INDEX idx_insights_category ON learned_insights(category);
CREATE INDEX idx_templates_domain ON ai_workflow_templates(domain);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deep_analyses_updated_at BEFORE UPDATE ON deep_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_workflow_templates_updated_at BEFORE UPDATE ON ai_workflow_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();