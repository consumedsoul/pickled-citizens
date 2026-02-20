'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';

type AdminEvent = {
  id: string;
  created_at: string;
  event_type: string;
  user_email: string | null;
  league_id: string | null;
  payload: Record<string, unknown> | null;
};

const PAGE_SIZE = 100;

const EVENT_TYPES = [
  'user.signup',
  'league.created',
  'league.member_added',
  'session.created',
  'session.deleted',
] as const;

export default function AdminEventsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const filterParam = searchParams.get('filter') || 'all';
  const selectedFilter =
    filterParam === 'all' || !EVENT_TYPES.includes(filterParam as typeof EVENT_TYPES[number]) ? 'all' : filterParam;

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

      if (email !== ADMIN_EMAIL) {
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
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Events</h1>
        <p className="text-app-muted text-sm">Loading admin event log...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Events</h1>
        <p className="text-app-danger text-sm">{error}</p>
      </div>
    );
  }

  const totalPages =
    totalCount != null && totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Events</h1>
      {userEmail && (
        <p className="text-app-muted text-sm mb-1">{userEmail}</p>
      )}
      <p className="text-app-muted text-sm mb-6">
        Internal audit log of key system events. Showing newest first, up to {PAGE_SIZE} per page.
      </p>

      <div className="flex flex-wrap gap-2 items-center mb-6">
        <SectionLabel>Filter</SectionLabel>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`font-mono text-[0.65rem] uppercase tracking-button px-2.5 py-1 border transition-colors cursor-pointer ${
            selectedFilter === 'all'
              ? 'border-app-text bg-app-text text-white font-medium'
              : 'border-app-border bg-transparent text-app-muted hover:text-app-text'
          }`}
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
              className={`font-mono text-[0.65rem] uppercase tracking-button px-2.5 py-1 border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-app-text bg-app-text text-white font-medium'
                  : 'border-app-border bg-transparent text-app-muted hover:text-app-text'
              }`}
            >
              {eventType}
            </button>
          );
        })}
      </div>

      {events.length === 0 ? (
        <p className="text-app-muted text-sm">No events recorded yet.</p>
      ) : (
        <>
          <div className="divide-y divide-app-border">
            {events.map((event) => {
              const created = new Date(event.created_at);
              const timestamp = created.toLocaleString();

              const parts: string[] = [event.event_type];
              if (event.user_email) parts.push(`by ${event.user_email}`);
              if (event.league_id) parts.push(`league ${event.league_id}`);
              const summary = parts.join(' - ');

              return (
                <div key={event.id} className="py-3">
                  <div className="flex justify-between gap-2 items-baseline">
                    <span className="text-xs text-app-muted font-mono">{timestamp}</span>
                    <span className="text-xs text-app-text">{summary}</span>
                  </div>
                  {event.payload && (
                    <pre className="mt-1 text-xs whitespace-pre-wrap break-words text-app-muted font-mono">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-between items-center gap-3">
            <Button
              variant="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-app-muted text-xs font-mono">
              Page {page + 1}
              {totalPages != null ? ` of ${totalPages}` : ''}
            </span>
            <Button
              variant="sm"
              disabled={events.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
