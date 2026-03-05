'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/lib/hooks/useAuthUser';

export function AuthStatus() {
  const router = useRouter();
  const state = useAuthUser();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (state.loading) {
    return null;
  }

  if (!state.email) {
    return (
      <Link
        href="/auth/signin"
        className="inline-flex items-center font-mono text-[0.65rem] uppercase tracking-button border border-app-border px-3 py-1.5 text-app-muted no-underline hover:bg-app-bg-subtle transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center font-mono text-[0.65rem] uppercase tracking-button border border-app-border px-3 py-1.5 text-app-muted cursor-pointer hover:bg-app-bg-subtle transition-colors bg-transparent"
    >
      Sign out
    </button>
  );
}
