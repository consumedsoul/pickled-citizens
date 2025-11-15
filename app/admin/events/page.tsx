'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type AdminEvent = {
  id: string;
  created_at: string;
  event_type: string;
  user_email: string | null;
  league_id: string | null;
  payload: any;
};

const PAGE_SIZE = 100;

export default function AdminEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        router.replace('/');
        return;
      }

      const email = userData.user.email?.toLowerCase() ?? null;
      setUserEmail(email);

      if (email !== 'hun@ghkim.com') {
        setError('You are not authorized to view this page.');
        setLoading(false);
        return;
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: eventsError, count } = await supabase
        .from('admin_events')
        .select('id, created_at, event_type, user_email, league_id, payload', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!active) return;

      if (eventsError) {
        setError(eventsError.message);
      } else {
        setEvents((data ?? []) as AdminEvent[]);
        if (typeof count === 'number') {
          setTotalCount(count);
        }
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [page, router]);

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">Admin events</h1>
        <p className="hero-subtitle">Loading admin event log...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section">
        <h1 className="section-title">Admin events</h1>
        <p className="hero-subtitle" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      </div>
    );
  }

  const totalPages =
    totalCount != null && totalCount > 0
      ? Math.ceil(totalCount / PAGE_SIZE)
      : null;

  return (
    <div className="section">
      <h1 className="section-title">Admin events</h1>
      {userEmail && (
        <p className="hero-subtitle" style={{ marginBottom: '0.5rem' }}>
          Signed in as {userEmail}
        </p>
      )}
      <p className="hero-subtitle">
        Internal audit log of key system events. Showing newest first, up to {PAGE_SIZE} per
        page.
      </p>

      {events.length === 0 ? (
        <p className="hero-subtitle" style={{ marginTop: '1rem' }}>
          No events recorded yet.
        </p>
      ) : (
        <>
          <ul
            className="section-list"
            style={{ listStyle: 'none', paddingLeft: 0, marginTop: '1rem' }}
          >
            {events.map((event) => {
              const created = new Date(event.created_at);
              const timestamp = created.toLocaleString();

              const parts: string[] = [event.event_type];
              if (event.user_email) parts.push(`by ${event.user_email}`);
              if (event.league_id) parts.push(`league ${event.league_id}`);
              const summary = parts.join(' - ');

              return (
                <li
                  key={event.id}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #1f2937',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{timestamp}</span>
                    <span style={{ fontSize: '0.8rem', color: '#d1d5db' }}>{summary}</span>
                  </div>
                  {event.payload && (
                    <pre
                      style={{
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: '#9ca3af',
                      }}
                    >
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous page
            </button>
            <span className="hero-subtitle" style={{ fontSize: '0.8rem' }}>
              Page {page + 1}
              {totalPages != null ? ` of ${totalPages}` : ''}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={events.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next page
            </button>
          </div>
        </>
      )}
    </div>
  );
}
