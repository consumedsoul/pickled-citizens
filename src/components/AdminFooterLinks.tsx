'use client';

import Link from 'next/link';
import { ADMIN_EMAIL } from '@/lib/constants';
import { useAuthUser } from '@/lib/hooks/useAuthUser';

export function AdminFooterLinks() {
  const state = useAuthUser();

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
