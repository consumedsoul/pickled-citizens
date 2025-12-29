'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface AuthState {
  loading: boolean;
  email: string | null;
  userId: string | null;
}

export function AuthStatus() {
  const router = useRouter();
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
    router.push('/');
  }

  if (state.loading) {
    return null;
  }

  if (!state.email) {
    return (
      <div className="text-[0.8rem] flex items-center gap-2">
        <Link 
          href="/auth/signin" 
          className="rounded-full px-3 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer no-underline hover:bg-gray-50 transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="text-[0.8rem] flex items-center gap-2">
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-full px-3 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
