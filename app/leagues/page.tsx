'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { listMyLeagues, createLeagueAction } from '@/lib/actions/leagues';

type LeagueRow = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string | null;
  role: string;
  memberCount: number;
};

const MAX_LEAGUES = 3;

export default function LeaguesPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [loading, setLoading] = useState(true);
  const [adminLeagues, setAdminLeagues] = useState<LeagueRow[]>([]);
  const [memberLeagues, setMemberLeagues] = useState<LeagueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const userId = user?.id ?? null;
  const reachedLimit = adminLeagues.length >= MAX_LEAGUES;

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace('/auth/signin');
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = (await listMyLeagues()) as LeagueRow[];
        if (!active) return;
        const admins = rows.filter((r) => r.role === 'admin');
        const members = rows.filter((r) => r.role !== 'admin');
        admins.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        members.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        setAdminLeagues(admins);
        setMemberLeagues(members);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load leagues.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, userId, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!userId) {
      setError('Please sign in again.');
      return;
    }
    if (!trimmedName) {
      setError('Please enter a league name.');
      return;
    }
    if (reachedLimit) {
      setError(`You have reached the maximum of ${MAX_LEAGUES} leagues.`);
      return;
    }
    if (
      adminLeagues.some(
        (l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      setError('A league with that name already exists.');
      return;
    }

    setCreating(true);
    try {
      const created = await createLeagueAction({ name: trimmedName });
      setAdminLeagues((prev) => [
        {
          id: created.id,
          name: created.name,
          ownerId: created.ownerId,
          createdAt: created.createdAt ?? null,
          role: 'admin',
          memberCount: 1,
        },
        ...prev,
      ]);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create league.');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !isLoaded) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Leagues</h1>
        <p className="text-app-muted text-sm">Loading your leagues...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Leagues</h1>

      {error && <p className="text-app-danger text-sm mt-2">{error}</p>}

      {!error && (
        <>
          <p className="text-sm text-app-muted">
            Create a league you can manage and schedule sessions.
          </p>
          {reachedLimit && (
            <p className="text-sm text-yellow-600 mt-2">
              You have reached the limit of {MAX_LEAGUES} leagues. Delete one to create another.
            </p>
          )}
        </>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="League name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={reachedLimit}
          className="flex-1 min-w-[200px] px-3 py-2.5 border border-app-border bg-transparent text-app-text text-sm placeholder:text-app-light-gray focus:outline-none focus:border-app-text transition-colors disabled:opacity-60"
        />
        <Button type="submit" variant="primary" disabled={creating || reachedLimit}>
          {creating ? 'Creating...' : 'Create League'}
        </Button>
      </form>

      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Leagues You Manage</SectionLabel>
        <div className="mt-4">
          {adminLeagues.length === 0 ? (
            <p className="text-app-muted text-sm">You don&apos;t manage any leagues yet.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {adminLeagues.map((league) => (
                <div
                  key={league.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-app-text">{league.name}</div>
                    <div className="text-xs text-app-muted mt-0.5">
                      {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                  <Link href={`/leagues/${league.id}`} className="no-underline">
                    <Button variant="sm" arrow>
                      Manage
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Leagues You&apos;re a Member Of</SectionLabel>
        <div className="mt-4">
          {memberLeagues.length === 0 ? (
            <p className="text-app-muted text-sm">You are not a member of any leagues yet.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {memberLeagues.map((league) => (
                <div
                  key={league.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-app-text">{league.name}</div>
                    <div className="text-xs text-app-muted mt-0.5">
                      {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                  <Link href={`/leagues/${league.id}`} className="no-underline">
                    <Button variant="sm" arrow>
                      {league.ownerId && userId && league.ownerId === userId ? 'Manage' : 'View'}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
