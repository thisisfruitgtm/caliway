const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'Not found');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('_supabase_migrations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Connection test result:', error.message);
      
      // If migrations table doesn't exist, that's expected for a new project
      if (error.message.includes('relation "_supabase_migrations" does not exist')) {
        console.log('✓ Connection successful! (Migrations table not found - this is normal for a new project)');
        return true;
      }
      return false;
    } else {
      console.log('✓ Connection successful!');
      console.log('Existing migrations:', data);
      return true;
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n✓ Ready to run migrations!');
  } else {
    console.log('\n✗ Connection failed. Please check your credentials.');
  }
  process.exit(success ? 0 : 1);
});