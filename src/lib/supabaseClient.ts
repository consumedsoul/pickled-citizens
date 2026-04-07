import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function missingSupabaseEnv(): never {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
}

const missingClient = new Proxy({} as SupabaseClient<Database>, {
  get() {
    return missingSupabaseEnv();
  },
});

// Browser client — uses @supabase/ssr cookie storage so middleware can read the session
export const supabase: SupabaseClient<Database> =
  supabaseUrl && supabaseAnonKey
    ? (createBrowserClient<Database>(supabaseUrl, supabaseAnonKey) as SupabaseClient<Database>)
    : missingClient;

// Service role client for API routes (bypasses RLS)
function missingServiceRoleKey(): never {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for API routes that bypass RLS.');
}

const missingServiceRoleClient = new Proxy({} as SupabaseClient<Database>, {
  get() {
    return missingServiceRoleKey();
  },
});

export const supabaseServiceRole: SupabaseClient<Database> =
  supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient<Database>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : missingServiceRoleClient;
