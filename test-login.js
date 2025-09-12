const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || 'default-secret-for-testing-only';

console.log('🔐 Testing login functionality...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin(username, password) {
  try {
    console.log(`👤 Attempting login for: ${username}`);
    
    // 1. Find user by username
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError) {
      console.log('❌ User not found:', userError.message);
      return false;
    }

    console.log('✅ User found in database');

    // 2. Verify password
    const isValidPassword = await bcrypt.compare(password, users.password_hash);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return false;
    }

    console.log('✅ Password verified');

    // 3. Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', users.company_id)
      .single();

    if (companyError) {
      console.log('⚠️  Company not found, but login successful');
    } else {
      console.log(`✅ Company: ${company.name}`);
    }

    // 4. Generate JWT token
    const tokenPayload = {
      userId: users.id,
      username: users.username,
      companyId: users.company_id,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '24h' });
    console.log('✅ JWT token generated');

    // 5. Update last login
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', users.id);

    if (updateError) {
      console.log('⚠️  Could not update last login:', updateError.message);
    } else {
      console.log('✅ Last login updated');
    }

    console.log('\n🎉 Login successful!');
    console.log('📋 User session:');
    console.log(`   User ID: ${users.id}`);
    console.log(`   Username: ${users.username}`);
    console.log(`   Company ID: ${users.company_id}`);
    console.log(`   Company Name: ${company ? company.name : 'Unknown'}`);
    console.log(`   Token: ${token.substring(0, 50)}...`);

    return {
      success: true,
      user: users,
      company: company,
      token: token
    };

  } catch (err) {
    console.error('❌ Login error:', err.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Running login tests...\n');

  // Test 1: Valid credentials
  console.log('Test 1: Valid credentials');
  await testLogin('testuser', 'password123');

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Invalid password
  console.log('Test 2: Invalid password');
  await testLogin('testuser', 'wrongpassword');

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Invalid username
  console.log('Test 3: Invalid username');
  await testLogin('nonexistent', 'password123');

  console.log('\n✅ Login tests completed!');
  console.log('\n💡 If you know the password for the "admin" user, you can test with:');
  console.log('   await testLogin("admin", "your_admin_password");');
}

runTests();