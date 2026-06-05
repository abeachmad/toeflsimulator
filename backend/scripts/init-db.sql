-- TOEFL iBT 2026 Test Simulator Database Schema
-- PostgreSQL 16+ with JSONB support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Test Items Table
CREATE TABLE IF NOT EXISTS test_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id VARCHAR(100) UNIQUE NOT NULL,
    section VARCHAR(50) NOT NULL CHECK (section IN ('reading', 'listening', 'writing', 'speaking')),
    type VARCHAR(100) NOT NULL,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    stage INTEGER CHECK (stage IN (1, 2)),
    content TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT,
    irt_parameters JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam Sessions Table
CREATE TABLE IF NOT EXISTS exam_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,
    current_section VARCHAR(50),
    current_module INTEGER,
    current_question INTEGER,
    answers JSONB DEFAULT '[]'::jsonb,
    ability_estimates JSONB DEFAULT '{}'::jsonb,
    completed_modules JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'paused', 'completed', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CEFR Conversion Table
CREATE TABLE IF NOT EXISTS cefr_conversion (
    id SERIAL PRIMARY KEY,
    section VARCHAR(50) NOT NULL,
    theta_min DECIMAL(5, 2) NOT NULL,
    theta_max DECIMAL(5, 2) NOT NULL,
    cefr_band INTEGER NOT NULL CHECK (cefr_band BETWEEN 1 AND 6),
    scale_score INTEGER NOT NULL CHECK (scale_score BETWEEN 0 AND 30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance (Task 25.1 — Requirement 21.4)
CREATE INDEX idx_test_items_section ON test_items(section);
CREATE INDEX idx_test_items_difficulty ON test_items(difficulty_level);
CREATE INDEX idx_test_items_stage ON test_items(stage);
CREATE INDEX idx_test_items_type ON test_items(type);
-- Composite index for common query pattern: section + difficulty + stage
CREATE INDEX idx_test_items_section_difficulty_stage ON test_items(section, difficulty_level, stage);
-- GIN index on JSONB columns for fast containment queries (Task 25.1)
CREATE INDEX idx_test_items_irt_parameters_gin ON test_items USING GIN(irt_parameters);
CREATE INDEX idx_test_items_metadata_gin ON test_items USING GIN(metadata);
CREATE INDEX idx_exam_sessions_session_id ON exam_sessions(session_id);
CREATE INDEX idx_exam_sessions_user_id ON exam_sessions(user_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status);
-- GIN index for JSONB answer/ability searches
CREATE INDEX idx_exam_sessions_answers_gin ON exam_sessions USING GIN(answers);
CREATE INDEX idx_exam_sessions_ability_gin ON exam_sessions USING GIN(ability_estimates);
CREATE INDEX idx_cefr_conversion_section ON cefr_conversion(section);
-- Partial index: active sessions only
CREATE INDEX idx_exam_sessions_active ON exam_sessions(session_id) WHERE status = 'in_progress';

-- Insert sample CEFR conversion data (ETS 2026 Official Conversion)
INSERT INTO cefr_conversion (section, theta_min, theta_max, cefr_band, scale_score) VALUES
-- Reading Section
('reading', -3.00, -1.50, 1, 0),
('reading', -1.50, -0.80, 2, 8),
('reading', -0.80, -0.20, 3, 15),
('reading', -0.20, 0.50, 4, 20),
('reading', 0.50, 1.20, 5, 25),
('reading', 1.20, 3.00, 6, 30),
-- Listening Section
('listening', -3.00, -1.50, 1, 0),
('listening', -1.50, -0.80, 2, 8),
('listening', -0.80, -0.20, 3, 15),
('listening', -0.20, 0.50, 4, 20),
('listening', 0.50, 1.20, 5, 25),
('listening', 1.20, 3.00, 6, 30),
-- Writing Section
('writing', -3.00, -1.50, 1, 0),
('writing', -1.50, -0.80, 2, 8),
('writing', -0.80, -0.20, 3, 15),
('writing', -0.20, 0.50, 4, 20),
('writing', 0.50, 1.20, 5, 25),
('writing', 1.20, 3.00, 6, 30),
-- Speaking Section
('speaking', -3.00, -1.50, 1, 0),
('speaking', -1.50, -0.80, 2, 8),
('speaking', -0.80, -0.20, 3, 15),
('speaking', -0.20, 0.50, 4, 20),
('speaking', 0.50, 1.20, 5, 25),
('speaking', 1.20, 3.00, 6, 30);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updated_at
CREATE TRIGGER update_test_items_updated_at
    BEFORE UPDATE ON test_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_sessions_updated_at
    BEFORE UPDATE ON exam_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create database user for application (optional, comment out if not needed)
-- CREATE USER toefl_app WITH PASSWORD 'your_secure_password';
-- GRANT CONNECT ON DATABASE toefl_simulator TO toefl_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO toefl_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO toefl_app;
