const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

async function setupDatabase() {
  console.log('Setting up Supabase database...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  // For database setup, we need the service role key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key') {
    console.error('❌ Missing or invalid SUPABASE_SERVICE_ROLE_KEY');
    console.log('Please set the service role key in your .env file');
    return;
  }

  try {
    // Use service role key for admin operations
    const supabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);
    
    // Read the schema file
    const schema = fs.readFileSync('database/schema.sql', 'utf8');
    
    console.log('📄 Schema file loaded, executing SQL...');
    
    // Execute the schema
    const { data, error } = await supabase.rpc('exec_sql', { sql: schema });
    
    if (error) {
      console.error('❌ Failed to execute schema:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Database schema created successfully!');
      console.log('Response:', data);
    }
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.error('Full error:', err);
  }
}

setupDatabase();