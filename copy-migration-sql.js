const fs = require('fs');

console.log('📋 Copy this SQL to your Supabase SQL Editor:\n');
console.log('=' .repeat(80));
console.log('');

try {
  const migrationSQL = fs.readFileSync('supabase/migrations/20250912142528_initial_schema.sql', 'utf8');
  console.log(migrationSQL);
  console.log('');
  console.log('=' .repeat(80));
  console.log('');
  console.log('📝 Instructions:');
  console.log('1. Copy the SQL above');
  console.log('2. Go to your Supabase dashboard: https://supabase.com/dashboard');
  console.log('3. Navigate to your project');
  console.log('4. Go to SQL Editor');
  console.log('5. Paste the SQL and click "Run"');
  console.log('6. After running, test with: node test-tables.js');
  console.log('');
} catch (err) {
  console.error('Error reading migration file:', err.message);
}