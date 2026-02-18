/**
 * Super-admin email address.
 * Used for client-side UI gating (actual security enforced by RLS + middleware).
 * Note: Also hardcoded in supabase/schema.sql RLS policies and admin_delete_user function.
 */
export const ADMIN_EMAIL = 'hun@ghkim.com';
