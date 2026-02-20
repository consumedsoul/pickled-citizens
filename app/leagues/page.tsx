'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';

type League = {
  id: string;
  name: string;
  created_at: string;
  memberCount?: number;
  owner_id?: string;
};

const MAX_LEAGUES = 3;

export default function LeaguesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [memberLeagues, setMemberLeagues] = useState<League[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const reachedLimit = leagues.length >= MAX_LEAGUES;

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

      const user = userData.user;
      setUserId(user.id);

      const { data: membershipData, error: membershipError } = await supabase
        .from('league_members')
        .select('league_id, role')
        .eq('user_id', user.id);

      if (!active) return;

      if (membershipError) {
        setError(membershipError.message);
      } else {
        const memberships = (membershipData as { league_id: string; role: string }[]) || [];
        const leagueIds = memberships.map(m => m.league_id);

        const { data: leaguesData, error: leaguesError } = await supabase
          .from('leagues')
          .select('id, name, owner_id')
          .in('id', leagueIds);

        if (!active) return;

        if (leaguesError) {
          setError(leaguesError.message);
          return;
        }

        const { data: memberCountsData, error: countsError } = await supabase
          .from('league_members')
          .select('league_id')
          .in('league_id', leagueIds);

        if (!active) return;

        const memberCounts = new Map<string, number>();
        if (!countsError && memberCountsData) {
          (memberCountsData as { league_id: string }[]).forEach((row) => {
            const leagueId = row.league_id;
            memberCounts.set(leagueId, (memberCounts.get(leagueId) ?? 0) + 1);
          });
        }

        type LeagueQueryRow = { id: string; name: string; owner_id: string };
        const leaguesList = (leaguesData as LeagueQueryRow[]) || [];
        const allLeagues: League[] = leaguesList.map((league) => ({
          id: league.id,
          name: league.name,
          created_at: '',
          owner_id: league.owner_id,
          memberCount: memberCounts.get(league.id) ?? 0,
        }));

        const adminLeagues = allLeagues.filter(league =>
          memberships.some(m => m.league_id === league.id && m.role === 'admin')
        );
        const memberLeaguesList = allLeagues.filter(league =>
          memberships.some(m => m.league_id === league.id && m.role === 'player')
        );

        adminLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        memberLeaguesList.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        setLeagues(adminLeagues);
        setMemberLeagues(memberLeaguesList);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

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

    setCreating(true);

    try {
      const { data: existingLeagues, error: existingError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('owner_id', userId);

      if (existingError) {
        setError(existingError.message);
        return;
      }

      const duplicate = (existingLeagues ?? []).some(
        (league) =>
          league.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicate) {
        setError('A league with that name already exists.');
        return;
      }

      const { data, error } = await supabase
        .from('leagues')
        .insert({ name: trimmedName, owner_id: userId })
        .select('id, name, created_at')
        .single();

      if (error || !data) {
        const message = error?.message?.includes('limit_3_leagues_per_owner')
          ? 'You have reached the maximum of 3 leagues.'
          : error?.message ?? 'Unable to create league.';
        setError(message);
        return;
      }

      const { error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: data.id,
          user_id: userId,
          role: 'admin',
          email: (await supabase.auth.getUser()).data.user?.email || '',
        });

      if (memberError) {
        setError(`Failed to add admin: ${memberError.message}`);
        return;
      }

      const leagueWithCount: League = { ...data, memberCount: 1 };
      setLeagues((prev) => [leagueWithCount, ...prev]);
      setName('');

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!userError && userData.user) {
        const ownerEmail = userData.user.email?.toLowerCase() ?? null;
        await supabase.from('admin_events').insert({
          event_type: 'league.created',
          user_id: userData.user.id,
          user_email: ownerEmail,
          league_id: data.id,
          payload: { league_name: trimmedName },
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error creating league.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
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
        <Button
          type="submit"
          variant="primary"
          disabled={creating || reachedLimit}
        >
          {creating ? 'Creating...' : 'Create League'}
        </Button>
      </form>

      {/* Leagues you manage */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Leagues You Manage</SectionLabel>
        <div className="mt-4">
          {leagues.length === 0 ? (
            <p className="text-app-muted text-sm">You don&apos;t manage any leagues yet.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {leagues.map((league) => (
                <div
                  key={league.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-app-text">
                      {league.name}
                    </div>
                    {typeof league.memberCount === 'number' && (
                      <div className="text-xs text-app-muted mt-0.5">
                        {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'}
                      </div>
                    )}
                  </div>
                  <a href={`/leagues/${league.id}`} className="no-underline">
                    <Button variant="sm" arrow>Manage</Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leagues you're a member of */}
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
                    <div className="text-sm font-medium text-app-text">
                      {league.name}
                    </div>
                    {typeof league.memberCount === 'number' && (
                      <div className="text-xs text-app-muted mt-0.5">
                        {league.memberCount} {league.memberCount === 1 ? 'member' : 'members'}
                      </div>
                    )}
                  </div>
                  <a href={`/leagues/${league.id}`} className="no-underline">
                    <Button variant="sm" arrow>
                      {league.owner_id && userId && league.owner_id === userId ? 'Manage' : 'View'}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
