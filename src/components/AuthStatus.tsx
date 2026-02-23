'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface AuthState {
  loading: boolean;
  email: string | null;
}

export function AuthStatus() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    loading: true,
    email: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setState({ loading: false, email: data.user?.email ?? null });
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setState({ loading: false, email: session?.user?.email ?? null });
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setState({ loading: false, email: null });
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
