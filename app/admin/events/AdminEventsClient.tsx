'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import type { AdminEventOut } from '@/lib/db/queries/admin';

type Props = {
  events: AdminEventOut[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  eventTypes: string[];
  selectedFilter: string;
};

export default function AdminEventsClient({
  events,
  page,
  pageSize,
  hasMore,
  eventTypes,
  selectedFilter,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(filter: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === 'all') params.delete('filter');
    else params.set('filter', filter);
    params.delete('page');
    router.push(`/admin/events?${params.toString()}`);
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p === 0) params.delete('page');
    else params.set('page', String(p));
    router.push(`/admin/events?${params.toString()}`);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Events</h1>
      <p className="text-app-muted text-sm mb-6">
        Internal audit log of key system events. Showing newest first, up to {pageSize} per page.
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
        {eventTypes.map((eventType) => {
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
              const created = event.createdAt ? new Date(event.createdAt) : null;
              const timestamp = created ? created.toLocaleString() : '';
              const parts: string[] = [event.eventType];
              if (event.userEmail) parts.push(`by ${event.userEmail}`);
              if (event.leagueId) parts.push(`league ${event.leagueId}`);
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
            <Button variant="sm" disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>
              Previous
            </Button>
            <span className="text-app-muted text-xs font-mono">Page {page + 1}</span>
            <Button variant="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
