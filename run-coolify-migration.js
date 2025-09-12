const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🚀 Running migration on Coolify Supabase instance...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/20250912142528_initial_schema.sql', 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('📊 Executing SQL statements...');
    
    // Split the SQL into individual statements and execute them one by one
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);
        
        try {
          // For Coolify/self-hosted Supabase, we need to use the SQL execution approach
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            // If exec_sql doesn't exist, try using a direct query approach
            if (error.message.includes('function exec_sql') || error.message.includes('does not exist')) {
              console.log('   ⚠️  exec_sql not available, trying alternative approach...');
              
              // For DDL statements, we might need to use the REST API directly
              const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ sql: statement + ';' })
              });
              
              if (response.ok) {
                console.log('   ✅ Success (via REST API)');
                successCount++;
              } else {
                const errorText = await response.text();
                console.log('   ❌ Error:', errorText);
                errorCount++;
              }
            } else {
              console.log('   ❌ Error:', error.message);
              errorCount++;
            }
          } else {
            console.log('   ✅ Success');
            successCount++;
          }
        } catch (err) {
          console.log('   ❌ Exception:', err.message);
          errorCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${statements.length}`);
    
    // Test the tables were created
    console.log('\n🔍 Verifying tables were created...');
    
    const tables = ['companies', 'users', 'events', 'widget_configs'];
    
    for (const table of tables) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (tableError) {
          console.log(`❌ Table '${table}':`, tableError.message);
        } else {
          console.log(`✅ Table '${table}': Created successfully`);
        }
      } catch (err) {
        console.log(`❌ Table '${table}':`, err.message);
      }
    }
    
    if (successCount > 0) {
      console.log('\n🎉 Migration completed! Some statements may have failed but core tables should be created.');
    } else {
      console.log('\n⚠️  Migration had issues. You may need to run the SQL manually.');
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n💡 Alternative approach:');
    console.log('1. Copy the SQL from: supabase/migrations/20250912142528_initial_schema.sql');
    console.log('2. Access your Coolify Supabase admin panel');
    console.log('3. Go to SQL Editor and paste the migration SQL');
    console.log('4. Execute the SQL manually');
  }
}

runMigration();