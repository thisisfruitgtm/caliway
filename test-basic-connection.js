const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testBasicConnection() {
  console.log('Testing basic Supabase connection...');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    // Test basic connection by trying to access a simple endpoint
    console.log('🔗 Testing connection to Supabase...');
    
    // Try to select from companies table (this will fail if table doesn't exist)
    const { data, error } = await supabase
      .from('companies')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation "companies" does not exist')) {
        console.log('⚠️  Connection successful, but database tables not created yet');
        console.log('📋 Please run the database setup using the instructions in setup-instructions.md');
      } else {
        console.error('❌ Database query failed:', error.message);
      }
    } else {
      console.log('✅ Supabase connection and database setup successful!');
      console.log('📊 Companies table accessible');
    }
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    
    if (err.message.includes('fetch')) {
      console.log('🌐 This might be a network connectivity issue');
      console.log('🔍 Please check if the Supabase URL is correct and accessible');
    }
  }
}

testBasicConnection();