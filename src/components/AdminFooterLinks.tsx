'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface AdminState {
  loading: boolean;
  email: string | null;
}

export function AdminFooterLinks() {
  const [state, setState] = useState<AdminState>({ loading: true, email: null });

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

  if (state.loading || !state.email) {
    return null;
  }

  const email = state.email.toLowerCase();
  if (email !== 'hun@ghkim.com') {
    return null;
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.8rem',
      }}
    >
      <Link href="/admin/events">Logs</Link>
      <span style={{ opacity: 0.7 }}>·</span>
      <Link href="/admin/users">Users</Link>
    </nav>
  );
}
