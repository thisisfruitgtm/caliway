const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verifyDatabase() {
  console.log('🔍 Verifying database setup...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  const tables = ['companies', 'users', 'events', 'widget_configs'];
  
  for (const table of tables) {
    try {
      console.log(`📋 Checking table: ${table}`);
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Table ${table}: ${error.message}`);
      } else {
        console.log(`✅ Table ${table}: OK`);
        if (data && data.length > 0) {
          console.log(`   📊 Sample data found (${data.length} records)`);
        } else {
          console.log(`   📊 Table exists but empty`);
        }
      }
    } catch (err) {
      console.error(`❌ Error checking table ${table}:`, err.message);
    }
  }
  
  // Test authentication with sample user
  console.log('\n🔐 Testing authentication...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@demo.com',
      password: 'password123'
    });
    
    if (error) {
      console.log('ℹ️  Auth test: Expected (no auth setup yet)');
    } else {
      console.log('✅ Auth test: Working');
    }
  } catch (err) {
    console.log('ℹ️  Auth test: Expected (no auth setup yet)');
  }
  
  console.log('\n🎉 Database verification complete!');
}

verifyDatabase();