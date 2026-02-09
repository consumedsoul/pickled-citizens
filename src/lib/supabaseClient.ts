import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function missingSupabaseEnv(): never {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
}

const missingClient = new Proxy({} as SupabaseClient, {
  get() {
    return missingSupabaseEnv();
  },
});

export const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : missingClient;

// Service role client for API routes (bypasses RLS)
// Throws on first use if service role key is missing so misconfiguration is caught immediately
function missingServiceRoleKey(): never {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for API routes that bypass RLS.');
}

const missingServiceRoleClient = new Proxy({} as SupabaseClient, {
  get() {
    return missingServiceRoleKey();
  },
});

export const supabaseServiceRole: SupabaseClient =
  supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : missingServiceRoleClient;
