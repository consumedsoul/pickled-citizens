'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface AuthState {
  loading: boolean;
  email: string | null;
  userId: string | null;
}

export function AuthStatus() {
  const [state, setState] = useState<AuthState>({ 
    loading: true, 
    email: null, 
    userId: null
  });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      
      const user = data.user;
      if (!user) {
        setState({ loading: false, email: null, userId: null });
        return;
      }

      setState({ 
        loading: false, 
        email: user.email ?? null, 
        userId: user.id
      });
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      const user = session?.user;
      if (!user) {
        setState({ loading: false, email: null, userId: null });
        return;
      }

      setState({ 
        loading: false, 
        email: user.email ?? null, 
        userId: user.id
      });
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setState({ loading: false, email: null, userId: null });
  }

  if (state.loading) {
    return null;
  }

  if (!state.email) {
    return (
      <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Link 
          href="/auth/signin" 
          className="btn-secondary"
          style={{ paddingInline: '0.75rem', textDecoration: 'none' }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
