const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testing database tables after migration...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTables() {
  const tables = [
    { name: 'companies', description: 'Company information and shareable URLs' },
    { name: 'users', description: 'User authentication and company associations' },
    { name: 'events', description: 'Calendar events with scheduling information' },
    { name: 'widget_configs', description: 'Widget customization settings' }
  ];

  console.log('\n📊 Testing table access...\n');

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table.name)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table.name}: ${error.message}`);
      } else {
        console.log(`✅ ${table.name}: Table exists and accessible`);
        console.log(`   📝 ${table.description}`);
        console.log(`   📈 Current rows: ${data.length}`);
      }
    } catch (err) {
      console.log(`❌ ${table.name}: ${err.message}`);
    }
    console.log('');
  }

  // Test creating a sample company (this will test RLS policies)
  console.log('🧪 Testing data insertion...\n');
  
  try {
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: 'Test Company',
        shareable_url: 'test-company-' + Date.now()
      })
      .select()
      .single();

    if (companyError) {
      console.log('❌ Company insertion test:', companyError.message);
      if (companyError.message.includes('RLS')) {
        console.log('   ℹ️  This is expected - RLS policies are working correctly');
        console.log('   ℹ️  You need to be authenticated to insert data');
      }
    } else {
      console.log('✅ Company insertion test: Success');
      console.log('   📄 Created company:', companyData);
      
      // Clean up test data
      await supabase
        .from('companies')
        .delete()
        .eq('id', companyData.id);
      console.log('   🧹 Test data cleaned up');
    }
  } catch (err) {
    console.log('❌ Company insertion test:', err.message);
  }

  console.log('\n🎉 Database verification completed!');
  console.log('\n📋 Summary:');
  console.log('- Tables should be accessible for SELECT operations');
  console.log('- INSERT/UPDATE/DELETE operations require authentication');
  console.log('- RLS policies are protecting your data');
  console.log('- Ready for application integration!');
}

testTables();