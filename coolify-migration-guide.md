# Coolify Supabase Migration Guide

Since your Supabase is running on Coolify, you'll need to run the migration manually through the admin interface.

## Step 1: Access Your Supabase Admin Panel

1. Go to your Coolify dashboard
2. Navigate to your Supabase service
3. Access the Supabase admin panel (usually available through a link or port)
4. Log in with your admin credentials

## Step 2: Open SQL Editor

1. In the Supabase admin panel, look for "SQL Editor" or "Database" section
2. This should give you a SQL query interface

## Step 3: Run the Migration SQL

Copy and paste the following SQL into the SQL editor and execute it:

```sql
-- Company Calendar Platform Database Schema
-- This file contains the SQL schema for Supabase database setup

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL CHECK (length(name) >= 2),
    shareable_url VARCHAR(200) NOT NULL UNIQUE CHECK (length(shareable_url) >= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE CHECK (length(username) >= 3),
    password_hash VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
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

-- Widget configurations table
CREATE TABLE IF NOT EXISTS widget_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(10) NOT NULL CHECK (theme IN ('light', 'dark', 'auto')),
    primary_color VARCHAR(7) NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    show_upcoming_only BOOLEAN NOT NULL DEFAULT true,
    max_events INTEGER NOT NULL DEFAULT 10 CHECK (max_events >= 1 AND max_events <= 100),
    date_format VARCHAR(20) NOT NULL CHECK (date_format IN ('YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM DD, YYYY')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date_time);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(is_public);
CREATE INDEX IF NOT EXISTS idx_companies_shareable_url ON companies(shareable_url);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at timestamps
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_configs_updated_at BEFORE UPDATE ON widget_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;

-- Policy for companies: Users can only access their own company
CREATE POLICY "Users can view their own company" ON companies
    FOR SELECT USING (id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their own company" ON companies
    FOR UPDATE USING (id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy for users: Users can only access their own user record
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Policy for events: Users can manage events for their company
CREATE POLICY "Users can view their company events" ON events
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert events for their company" ON events
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company events" ON events
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company events" ON events
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Public access policy for events (for calendar feeds and public views)
CREATE POLICY "Public can view public events" ON events
    FOR SELECT USING (is_public = true);

-- Policy for widget configs: Users can manage their company's widget config
CREATE POLICY "Users can view their company widget config" ON widget_configs
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert widget config for their company" ON widget_configs
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company widget config" ON widget_configs
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));
```

## Step 4: Verify the Migration

After running the SQL, verify that the tables were created by running:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('companies', 'users', 'events', 'widget_configs');
```

You should see all 4 tables listed.

## Step 5: Test the Connection

After the migration is complete, run this command to test:

```bash
node test-tables.js
```

## Alternative: Direct Database Access

If you have direct PostgreSQL access to your Coolify database:

1. Connect to your PostgreSQL instance using psql or a database client
2. Run the migration SQL directly
3. This bypasses any Supabase API limitations

## Troubleshooting

If you encounter issues:

1. **Permission errors**: Make sure you're using an admin account
2. **RLS policy errors**: These are expected and can be ignored if tables are created
3. **Function errors**: Some advanced features might not be available in all Supabase versions

## What This Migration Creates

- ✅ 4 main tables with proper relationships
- ✅ UUID primary keys with auto-generation  
- ✅ Data validation constraints
- ✅ Performance indexes
- ✅ Automatic timestamp updates
- ✅ Row Level Security policies
- ✅ Public access for calendar feeds

Once complete, your application will be able to connect to the database using the existing repository classes!