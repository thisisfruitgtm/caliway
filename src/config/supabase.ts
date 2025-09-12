import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
}

// Create and export Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Export configuration for use in other modules
export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseKey,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};