const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey || supabaseServiceKey === 'your_supabase_service_role_key') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required for running migrations');
  console.log('Please update your .env file with the service role key from your Supabase dashboard');
  process.exit(1);
}

console.log('🚀 Running database migration...');
console.log('URL:', supabaseUrl);

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/20250912142528_initial_schema.sql', 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('📊 Executing SQL...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution (this might not work with complex SQL)
      console.log('Trying alternative approach...');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`📝 Found ${statements.length} SQL statements to execute`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          
          try {
            const { error: stmtError } = await supabase.rpc('exec_sql', { 
              sql: statement + ';' 
            });
            
            if (stmtError) {
              console.log(`⚠️  Statement ${i + 1} result:`, stmtError.message);
            } else {
              console.log(`✅ Statement ${i + 1} executed successfully`);
            }
          } catch (err) {
            console.log(`⚠️  Statement ${i + 1} error:`, err.message);
          }
        }
      }
    } else {
      console.log('✅ Migration executed successfully!');
      console.log('Result:', data);
    }
    
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
    
    console.log('\n🎉 Migration process completed!');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();