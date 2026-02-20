'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';
import { Button } from '@/components/ui/Button';

type League = {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string;
};

type AdminState = {
  loading: boolean;
  email: string | null;
};

export default function AdminLeaguesPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminState>({ loading: true, email: null });
  const [leagues, setLeagues] = useState<League[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        setAdmin({ loading: false, email: null });
        setLoading(false);
        return;
      }

      const email = userData.user.email ?? null;
      setAdmin({ loading: false, email });

      const emailLower = email?.toLowerCase() ?? '';
      const isAdmin = emailLower === ADMIN_EMAIL;
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      const { data, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, owner_id, created_at')
        .order('created_at', { ascending: false });

      if (!active) return;

      if (leaguesError) {
        setError(leaguesError.message);
        setLeagues([]);
      } else {
        setLeagues((data ?? []) as League[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const emailLower = admin.email?.toLowerCase() ?? '';
  const isAdmin = emailLower === ADMIN_EMAIL;

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Leagues</h1>
        <p className="text-app-muted text-sm">Loading leagues...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Leagues</h1>
        <p className="text-app-muted text-sm">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Leagues</h1>
      {error && (
        <p className="text-app-danger text-sm mb-4">{error}</p>
      )}
      {!error && (
        <p className="text-app-muted text-sm mb-6">
          This view lists all leagues in the system. Open a league to rename it, manage
          members, or delete it.
        </p>
      )}

      {leagues.length === 0 ? (
        <p className="text-app-muted text-sm">No leagues found.</p>
      ) : (
        <div className="divide-y divide-app-border">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <div className="text-sm">{league.name}</div>
                <div className="text-xs text-app-muted mt-0.5 font-mono">
                  {league.id}
                </div>
              </div>
              <Button
                variant="sm"
                onClick={() => router.push(`/leagues/${league.id}`)}
              >
                Open
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
