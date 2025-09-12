const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    // Test basic connection by checking auth status
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('Response data:', data);
    }
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    console.error('Full error:', err);
  }
}

testSupabaseConnection();