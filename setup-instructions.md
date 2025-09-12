# Supabase Database Setup Instructions

## Step 1: Access Supabase Dashboard
1. Go to https://supabase.caliway.thisisfruit.com/project/default/editor
2. Log in to your Supabase dashboard

## Step 2: Execute Database Schema
1. Navigate to the SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `database/schema.sql` into the SQL editor
3. Click "Run" to execute the schema

## Step 3: Verify Tables Created
After running the schema, you should have these tables:
- `companies`
- `users` 
- `events`
- `widget_configs`

## Step 4: Update Environment Variables
Make sure your `.env` file has the correct values:

```env
SUPABASE_URL=https://supabase.caliway.thisisfruit.com
SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
```

You can find these keys in your Supabase project settings under "API".

## Step 5: Test Connection
Run the connection test:
```bash
node test-supabase-connection.js
```

## Alternative: Manual Table Creation
If you prefer to create tables manually, here are the essential tables:

### Companies Table
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    shareable_url VARCHAR(200) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Events Table
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    start_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(200),
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Widget Configs Table
```sql
CREATE TABLE widget_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
    theme VARCHAR(10) NOT NULL DEFAULT 'light',
    primary_color VARCHAR(7) NOT NULL DEFAULT '#667eea',
    show_upcoming_only BOOLEAN NOT NULL DEFAULT true,
    max_events INTEGER NOT NULL DEFAULT 10,
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```