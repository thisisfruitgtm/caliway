const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Checking existing user credentials...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserCredentials() {
  try {
    // Get user info
    const { data: users, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.log('❌ Error fetching users:', error.message);
      return;
    }

    if (users.length === 0) {
      console.log('📝 No users found. You can create a test user.');
      return;
    }

    console.log('👥 Found users:');
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User: ${user.username}`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Company ID: ${user.company_id}`);
      console.log(`   - Password Hash: ${user.password_hash.substring(0, 20)}...`);
      console.log(`   - Created: ${user.created_at}`);
      console.log(`   - Last Login: ${user.last_login_at}`);
      
      // Check if it looks like a bcrypt hash
      if (user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$')) {
        console.log('   ✅ Password appears to be bcrypt hashed');
      } else {
        console.log('   ⚠️  Password might not be properly hashed');
      }
    });

    console.log('\n🔑 To test login, you need to know:');
    console.log('1. The original password for the admin user');
    console.log('2. Or create a new test user with a known password');
    
    console.log('\n💡 Options:');
    console.log('A. If you know the admin password, use it to test login');
    console.log('B. Create a new test user with: node create-test-user.js');
    console.log('C. Reset the admin password if you have database access');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkUserCredentials();