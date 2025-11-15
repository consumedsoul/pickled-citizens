'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface AuthState {
  loading: boolean;
  email: string | null;
}

export function AuthStatus() {
  const [state, setState] = useState<AuthState>({ loading: true, email: null });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setState({ loading: false, email: data.user?.email ?? null });
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
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
  }

  if (state.loading) {
    return null;
  }

  if (!state.email) {
    return (
      <div style={{ fontSize: '0.8rem' }}>
        <Link href="/auth/signin">Sign in</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
      <span style={{ opacity: 0.8 }}>Signed in as {state.email}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="btn-secondary"
        style={{ paddingInline: '0.75rem' }}
      >
        Sign out
      </button>
    </div>
  );
}
