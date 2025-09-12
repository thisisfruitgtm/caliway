const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Analyzing your Supabase project...');
console.log('URL:', supabaseUrl);

// Try to extract project info from the JWT token
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (err) {
    return null;
  }
}

const tokenInfo = decodeJWT(supabaseKey);
if (tokenInfo) {
  console.log('\n📄 Token information:');
  console.log('- Issuer:', tokenInfo.iss);
  console.log('- Role:', tokenInfo.role);
  console.log('- Issued at:', new Date(tokenInfo.iat * 1000));
  console.log('- Expires at:', new Date(tokenInfo.exp * 1000));
  
  if (tokenInfo.ref) {
    console.log('- Project ref:', tokenInfo.ref);
  }
}

// Try to make a request to get more info
const supabase = createClient(supabaseUrl, supabaseKey);

async function getProjectInfo() {
  try {
    // Try to access the REST API info endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (response.ok) {
      console.log('\n✅ API is accessible');
      console.log('- Status:', response.status);
      console.log('- Headers available:', Object.keys(response.headers));
    }
    
    // Try to get some system info
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);
      
    if (error) {
      console.log('\n📊 Database info:', error.message);
    } else {
      console.log('\n📊 Existing tables:', data.map(t => t.table_name));
    }
    
  } catch (err) {
    console.log('\n❌ Error getting project info:', err.message);
  }
}

console.log('\n🔗 For CLI linking, you might need:');
console.log('1. The project reference ID (usually 20 characters)');
console.log('2. Your Supabase access token from the dashboard');
console.log('\nTo get these:');
console.log('- Go to https://supabase.com/dashboard');
console.log('- Select your project');
console.log('- Go to Settings → General → Reference ID');
console.log('- Go to Settings → Access Tokens to generate a token');

getProjectInfo();