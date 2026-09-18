import { Suspense } from 'react';
import { requireAdmin } from '@/lib/db/auth-helpers';
import {
  countFailedAdminEvents,
  listAdminEvents,
  listAdminEventTypes,
} from '@/lib/db/queries/admin';
import AdminEventsClient from './AdminEventsClient';

const PAGE_SIZE = 100;

type Search = { filter?: string; page?: string };

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  // Defense in depth: middleware.ts already gates /admin(.*), but listAdminEvents
  // takes no caller ID, so the page authorizes for itself.
  await requireAdmin();
  const filter = searchParams?.filter ?? 'all';
  const [eventTypes, failedCount] = await Promise.all([
    listAdminEventTypes(),
    countFailedAdminEvents(),
  ]);
  const selectedFilter = eventTypes.includes(filter) ? filter : 'all';
  const page = Math.max(0, Number(searchParams?.page ?? 0) || 0);

  // Fetch one extra row so `hasMore` is known without a second count query.
  // The filter is pushed into the query so the page is a page of *matching*
  // rows, not a page of all rows that is then filtered down.
  const events = await listAdminEvents({
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
    eventType: selectedFilter === 'all' ? undefined : selectedFilter,
  });
  const filtered = events.slice(0, PAGE_SIZE);
  const hasMore = events.length > PAGE_SIZE;

  return (
    <Suspense
      fallback={
        <div className="section">
          <h1 className="section-title">Admin events</h1>
          <p className="hero-subtitle">Loading admin event log...</p>
        </div>
      }
    >
      <AdminEventsClient
        events={filtered}
        page={page}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        eventTypes={eventTypes}
        failedCount={failedCount}
        selectedFilter={selectedFilter}
      />
    </Suspense>
  );
}
