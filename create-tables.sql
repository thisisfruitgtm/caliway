-- Essential tables for Company Calendar Platform
-- Execute these commands in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL CHECK (length(name) >= 2),
    shareable_url VARCHAR(200) NOT NULL UNIQUE CHECK (length(shareable_url) >= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE CHECK (length(username) >= 3),
    password_hash VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL CHECK (length(title) >= 3),
    description TEXT NOT NULL CHECK (length(description) >= 10),
    start_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(200),
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_event_times CHECK (start_date_time < end_date_time)
);

-- 4. Widget configurations table
CREATE TABLE widget_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    primary_color VARCHAR(7) NOT NULL DEFAULT '#667eea' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    show_upcoming_only BOOLEAN NOT NULL DEFAULT true,
    max_events INTEGER NOT NULL DEFAULT 10 CHECK (max_events >= 1 AND max_events <= 100),
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD' CHECK (date_format IN ('YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM DD, YYYY')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_events_company_id ON events(company_id);
CREATE INDEX idx_events_start_date ON events(start_date_time);
CREATE INDEX idx_events_public ON events(is_public);
CREATE INDEX idx_companies_shareable_url ON companies(shareable_url);

-- 6. Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Triggers to automatically update updated_at timestamps
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_configs_updated_at BEFORE UPDATE ON widget_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Insert sample data for testing
INSERT INTO companies (name, shareable_url) VALUES 
    ('Demo Company', 'demo-company-calendar');

INSERT INTO users (username, password_hash, company_id) VALUES 
    ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LrUpm', (SELECT id FROM companies WHERE name = 'Demo Company'));

-- The password for 'admin' user is 'password123' (hashed with bcrypt)