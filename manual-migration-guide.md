# Manual Migration Guide for Supabase Cloud

Since we need the service role key to run migrations programmatically, here's how to run the migration manually:

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to the **SQL Editor** tab
4. Copy and paste the contents of `supabase/migrations/20250912142528_initial_schema.sql`
5. Click **Run** to execute the migration

## Option 2: Using Service Role Key (Programmatic)

1. Get your service role key from Supabase dashboard:
   - Go to Settings → API
   - Copy the `service_role` key (not the `anon` key)
   
2. Update your `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```

3. Run the migration script:
   ```bash
   node run-migration.js
   ```

## What the Migration Creates

The migration will create:

### Tables:
- `companies` - Store company information and shareable URLs
- `users` - User authentication and company associations
- `events` - Calendar events with scheduling information
- `widget_configs` - Widget customization settings

### Features:
- ✅ UUID primary keys with auto-generation
- ✅ Foreign key relationships with cascade deletes
- ✅ Data validation constraints
- ✅ Performance indexes
- ✅ Automatic timestamp updates
- ✅ Row Level Security (RLS) policies
- ✅ Public access policies for calendar feeds

### Security:
- Row Level Security enabled on all tables
- Users can only access their own company's data
- Public events are accessible for calendar feeds
- Proper authentication checks

## Verification

After running the migration, you can verify it worked by:

1. Checking the Tables tab in Supabase dashboard
2. Running this test script: `node test-tables.js`

## Next Steps

Once the migration is complete, you can:
1. Test the repository connections
2. Create sample data
3. Run the application with real database connectivity