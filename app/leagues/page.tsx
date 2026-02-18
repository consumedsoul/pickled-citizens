'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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

      // Get all leagues where user is a member with their role
      const { data: membershipData, error: membershipError } = await supabase
        .from('league_members')
        .select('league_id, role')
        .eq('user_id', user.id);

      if (!active) return;

      if (membershipError) {
        setError(membershipError.message);
      } else {
        const memberships = (membershipData as any[]) || [];
        
        // Get all league IDs to fetch league details and member counts
        const leagueIds = memberships.map(m => m.league_id);
        
        // Get league details
        const { data: leaguesData, error: leaguesError } = await supabase
          .from('leagues')
          .select('id, name, owner_id')
          .in('id', leagueIds);

        if (!active) return;

        if (leaguesError) {
          setError(leaguesError.message);
          return;
        }

        // Get member counts for all leagues
        const { data: memberCountsData, error: countsError } = await supabase
          .from('league_members')
          .select('league_id')
          .in('league_id', leagueIds);

        if (!active) return;

        const memberCounts = new Map<string, number>();
        if (!countsError && memberCountsData) {
          (memberCountsData as any[]).forEach((row: any) => {
            const leagueId = row.league_id as string;
            memberCounts.set(leagueId, (memberCounts.get(leagueId) ?? 0) + 1);
          });
        }

        // Process leagues and separate by role
        const leagues = (leaguesData as any[]) || [];
        const allLeagues: League[] = leagues.map((league: any) => ({
          id: league.id,
          name: league.name,
          created_at: '', // Will be set later if needed
          owner_id: league.owner_id,
          memberCount: memberCounts.get(league.id) ?? 0,
        }));

        // Separate into admin and regular member leagues
        const adminLeagues = allLeagues.filter(league => 
          memberships.some(m => m.league_id === league.id && m.role === 'admin')
        );
        const memberLeagues = allLeagues.filter(league => 
          memberships.some(m => m.league_id === league.id && m.role === 'player')
        );

        // Sort each group alphabetically by name (case-insensitive)
        adminLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        memberLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        setLeagues(adminLeagues);
        setMemberLeagues(memberLeagues);
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

      // Add the creator as an admin in league_members
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

      // Log admin event
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
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error creating league.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Leagues</h1>
        <p className="text-app-muted">Loading your leagues...</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
      <h1 className="text-base font-medium mb-3">Leagues</h1>
      {error && (
        <p className="text-red-300">
          {error}
        </p>
      )}
      {!error && (
        <>
          <p className="text-app-muted">
            Create a league you can manage and schedule sessions.
          </p>
          {reachedLimit && (
            <p className="text-app-muted mt-2 text-yellow-400">
              You have reached the limit of {MAX_LEAGUES} leagues. Delete one to create
              another.
            </p>
          )}
        </>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-4 flex flex-wrap gap-2"
      >
        <input
          type="text"
          placeholder="League name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={reachedLimit}
          className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text disabled:opacity-60"
        />
        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={creating || reachedLimit}
        >
          {creating ? 'Creating…' : 'Create league'}
        </button>
      </form>

      <div className="mt-6">
        <h2 className="text-base font-medium mb-3">Leagues you manage</h2>
        {leagues.length === 0 ? (
          <p className="text-app-muted">You don&apos;t manage any leagues yet.</p>
        ) : (
          <ul className="list-none pl-0 text-app-muted text-[0.87rem]">
            {leagues.map((league) => (
              <li
                key={league.id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span>
                  👑 {league.name}{' '}
                  {typeof league.memberCount === 'number'
                    ? `(${league.memberCount} ${
                        league.memberCount === 1 ? 'member' : 'members'
                      })`
                    : ''}
                </span>
                <a
                  href={`/leagues/${league.id}`}
                  className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer no-underline hover:bg-gray-50 transition-colors"
                >
                  Manage
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-base font-medium mb-3">Leagues you&apos;re a member of</h2>
        {memberLeagues.length === 0 ? (
          <p className="text-app-muted">You are not a member of any leagues yet.</p>
        ) : (
          <ul className="list-none pl-0 text-app-muted text-[0.87rem]">
            {memberLeagues.map((league) => (
              <li
                key={league.id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span>
                  👤 {league.name}{' '}
                  {typeof league.memberCount === 'number'
                    ? `(${league.memberCount} ${
                        league.memberCount === 1 ? 'member' : 'members'
                      })`
                    : ''}
                </span>
                <div className="flex gap-2">
                  <a
                    href={`/leagues/${league.id}`}
                    className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer no-underline hover:bg-gray-50 transition-colors"
                  >
                    {league.owner_id && userId && league.owner_id === userId
                      ? 'Manage'
                      : 'View'}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

