const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('👤 Creating test user with known credentials...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
  try {
    // Get the existing company
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .limit(1);

    if (companyError || !companies || companies.length === 0) {
      console.log('❌ No company found. Creating a test company first...');
      
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          name: 'Test Company',
          shareable_url: 'test-company-' + Date.now()
        })
        .select()
        .single();

      if (createCompanyError) {
        console.log('❌ Failed to create company:', createCompanyError.message);
        return;
      }
      
      companies[0] = newCompany;
      console.log('✅ Created test company:', newCompany.name);
    }

    const company = companies[0];
    console.log('🏢 Using company:', company.name);

    // Test credentials
    const testUsername = 'testuser';
    const testPassword = 'password123';
    
    console.log('🔐 Test credentials:');
    console.log(`   Username: ${testUsername}`);
    console.log(`   Password: ${testPassword}`);

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(testPassword, saltRounds);
    console.log('🔒 Password hashed successfully');

    // Create the test user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        username: testUsername,
        password_hash: hashedPassword,
        company_id: company.id
      })
      .select()
      .single();

    if (userError) {
      if (userError.message.includes('duplicate key')) {
        console.log('⚠️  Test user already exists. Using existing credentials:');
        console.log(`   Username: ${testUsername}`);
        console.log(`   Password: ${testPassword}`);
      } else {
        console.log('❌ Failed to create user:', userError.message);
      }
      return;
    }

    console.log('✅ Test user created successfully!');
    console.log(`   User ID: ${newUser.id}`);
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Company: ${company.name}`);

    console.log('\n🎯 You can now use these credentials to test login:');
    console.log(`   Username: ${testUsername}`);
    console.log(`   Password: ${testPassword}`);

    console.log('\n🧪 Test the login with:');
    console.log('   node test-login.js');

  } catch (err) {
    console.error('❌ Error creating test user:', err.message);
  }
}

createTestUser();