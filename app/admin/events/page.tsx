'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

const EVENT_TYPES = [
  'user.signup',
  'league.created',
  'league.member_added',
  'session.created',
  'session.deleted',
] as const;

export default function AdminEventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const filterParam = searchParams.get('filter') || 'all';
  const selectedFilter = filterParam === 'all' || !EVENT_TYPES.includes(filterParam as any) 
    ? 'all' 
    : filterParam;

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

      let query = supabase
        .from('admin_events')
        .select('id, created_at, event_type, user_email, league_id, payload', {
          count: 'exact',
        })
        .order('created_at', { ascending: false });

      if (selectedFilter !== 'all') {
        query = query.eq('event_type', selectedFilter);
      }

      const { data, error: eventsError, count } = await query.range(from, to);

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
  }, [page, selectedFilter, router]);

  function setFilter(filter: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
    }
    router.push(`/admin/events?${params.toString()}`);
    setPage(0);
  }

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

      <div style={{ marginTop: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Filter:</span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              background: selectedFilter === 'all' ? '#10b981' : '#f9fafb',
              color: selectedFilter === 'all' ? '#ffffff' : '#111827',
              cursor: 'pointer',
              fontWeight: selectedFilter === 'all' ? 500 : 400,
            }}
          >
            All
          </button>
          {EVENT_TYPES.map((eventType) => {
            const isSelected = selectedFilter === eventType;
            return (
              <button
                key={eventType}
                type="button"
                onClick={() => setFilter(eventType)}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  background: isSelected ? '#10b981' : '#f9fafb',
                  color: isSelected ? '#ffffff' : '#111827',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 500 : 400,
                }}
              >
                {eventType}
              </button>
            );
          })}
        </div>
      </div>

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
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{timestamp}</span>
                    <span style={{ fontSize: '0.8rem', color: '#111827' }}>{summary}</span>
                  </div>
                  {event.payload && (
                    <pre
                      style={{
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: '#4b5563',
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
