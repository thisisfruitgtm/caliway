import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.SERVICE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SERVICE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
}

// Create and export Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Create admin client for server-side operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin: SupabaseClient = serviceRoleKey && serviceRoleKey !== 'your_supabase_service_role_key'
  ? createClient(supabaseUrl, serviceRoleKey)
  : supabase;

// Export configuration for use in other modules
export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseKey,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_SUPABASE_SERVICE_ROLE_KEY,
};