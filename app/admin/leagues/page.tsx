'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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
      const isAdmin = emailLower === 'hun@ghkim.com';
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
  const isAdmin = emailLower === 'hun@ghkim.com';

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">Admin: Leagues</h1>
        <p className="hero-subtitle">Loading leagues…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="section">
        <h1 className="section-title">Admin: Leagues</h1>
        <p className="hero-subtitle">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h1 className="section-title">Admin: Leagues</h1>
      {error && (
        <p className="hero-subtitle" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      )}
      {!error && (
        <p className="hero-subtitle">
          This view lists all leagues in the system. Open a league to rename it, manage
          members, or delete it.
        </p>
      )}

      {leagues.length === 0 ? (
        <p className="hero-subtitle" style={{ marginTop: '1rem' }}>
          No leagues found.
        </p>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <ul
            className="section-list"
            style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}
          >
            {leagues.map((league) => (
              <li
                key={league.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.25rem 0',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem' }}>{league.name}</div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      marginTop: '0.1rem',
                    }}
                  >
                    ID: {league.id}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => router.push(`/leagues/${league.id}`)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
