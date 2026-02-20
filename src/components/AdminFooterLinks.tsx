'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';

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

  const email = state.email?.toLowerCase() ?? null;
  const isAdmin = email === ADMIN_EMAIL;

  return (
    <nav className="flex items-center gap-4 font-mono text-[0.65rem] uppercase tracking-label text-app-muted">
      {isAdmin && (
        <>
          <Link href="/admin/events" className="no-underline hover:text-app-text transition-colors">Logs</Link>
          <Link href="/admin/users" className="no-underline hover:text-app-text transition-colors">Users</Link>
          <Link href="/admin/leagues" className="no-underline hover:text-app-text transition-colors">Leagues</Link>
        </>
      )}
      <Link
        href="https://github.com/consumedsoul/pickled-citizens"
        target="_blank"
        rel="noreferrer"
        className="no-underline hover:text-app-text transition-colors"
      >
        GitHub
      </Link>
    </nav>
  );
}
