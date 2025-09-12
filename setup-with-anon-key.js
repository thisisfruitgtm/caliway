const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function setupWithAnonKey() {
  console.log('🔧 Setting up database with anon key...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  console.log('📋 Attempting to create tables...');
  
  // Try to create tables one by one with anon key
  const tables = [
    {
      name: 'companies',
      sql: `
        CREATE TABLE IF NOT EXISTS companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          shareable_url VARCHAR(200) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'users', 
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          company_id UUID NOT NULL REFERENCES companies(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'events',
      sql: `
        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      `
    }
  ];

  for (const table of tables) {
    try {
      console.log(`📋 Creating table: ${table.name}`);
      
      // Try using rpc to execute SQL
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: table.sql 
      });
      
      if (error) {
        console.log(`⚠️  RPC method not available for ${table.name}: ${error.message}`);
        console.log(`📝 Please execute this SQL manually in Supabase dashboard:`);
        console.log(`\n${table.sql}\n`);
      } else {
        console.log(`✅ Table ${table.name} created successfully`);
      }
    } catch (err) {
      console.log(`⚠️  Could not create ${table.name} programmatically`);
      console.log(`📝 Please execute this SQL manually in Supabase dashboard:`);
      console.log(`\n${table.sql}\n`);
    }
  }
  
  console.log('\n📋 Manual Setup Instructions:');
  console.log('1. Go to https://supabase.caliway.thisisfruit.com');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of create-tables.sql');
  console.log('4. Click Run to execute');
  console.log('5. Run "node verify-database.js" to confirm setup');
}

setupWithAnonKey();