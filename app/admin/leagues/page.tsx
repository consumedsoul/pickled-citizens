import Link from 'next/link';
import { listLeagues } from '@/lib/db/queries/leagues';

export default async function AdminLeaguesPage() {
  const leagues = await listLeagues();
  const sorted = [...leagues].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Leagues</h1>
      <p className="text-app-muted text-sm mb-6">
        This view lists all leagues in the system. Open a league to rename it, manage
        members, or delete it.
      </p>

      {sorted.length === 0 ? (
        <p className="text-app-muted text-sm">No leagues found.</p>
      ) : (
        <div className="divide-y divide-app-border">
          {sorted.map((league) => (
            <div
              key={league.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <div className="text-sm">{league.name}</div>
                <div className="text-xs text-app-muted mt-0.5 font-mono">{league.id}</div>
              </div>
              <Link
                href={`/leagues/${league.id}`}
                className="font-mono text-[0.65rem] uppercase tracking-button border border-app-border px-3 py-1.5 text-app-muted no-underline hover:bg-app-bg-subtle transition-colors"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
