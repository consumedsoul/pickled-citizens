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

      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, created_at, owner_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        const baseLeagues = data ?? [];

        if (!baseLeagues.length) {
          setLeagues([]);
        } else {
          const leagueIds = baseLeagues.map((l) => l.id);

          const { data: memberRows, error: membersError } = await supabase
            .from('league_members')
            .select('league_id')
            .in('league_id', leagueIds);

          if (membersError) {
            setError(membersError.message);
            setLeagues(baseLeagues);
          } else {
            const counts = new Map<string, number>();
            (memberRows ?? []).forEach((row: any) => {
              const leagueId = row.league_id as string;
              counts.set(leagueId, (counts.get(leagueId) ?? 0) + 1);
            });

            const leaguesWithCounts: League[] = baseLeagues.map((league) => ({
              ...league,
              memberCount: counts.get(league.id) ?? 0,
            }));

            setLeagues(leaguesWithCounts);
          }
        }

        const { data: membershipRows, error: membershipError } = await supabase
          .from('league_members')
          .select('league:leagues(id, name, owner_id)')
          .eq('user_id', user.id);

        if (!membershipError && membershipRows) {
          const baseMemberLeagues: League[] = (membershipRows as any[])
            .map((row) => row.league)
            .filter(Boolean);

          if (!baseMemberLeagues.length) {
            setMemberLeagues([]);
          } else {
            const memberLeagueIds = baseMemberLeagues.map((l) => l.id);
            const { data: memberCountsRows, error: memberCountsError } =
              await supabase
                .from('league_members')
                .select('league_id')
                .in('league_id', memberLeagueIds);

            if (memberCountsError) {
              setMemberLeagues(baseMemberLeagues);
            } else {
              const memberCounts = new Map<string, number>();
              (memberCountsRows ?? []).forEach((row: any) => {
                const leagueId = row.league_id as string;
                memberCounts.set(
                  leagueId,
                  (memberCounts.get(leagueId) ?? 0) + 1
                );
              });

              const leaguesWithCounts: League[] = baseMemberLeagues.map(
                (league) => ({
                  ...league,
                  memberCount: memberCounts.get(league.id) ?? 0,
                })
              );

              setMemberLeagues(leaguesWithCounts);
            }
          }
        }
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
    const trimmedName = name.trim();
    if (!userId || !trimmedName || reachedLimit) return;

    setCreating(true);
    setError(null);

    const { data: existingLeagues, error: existingError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('owner_id', userId);

    if (existingError) {
      setError(existingError.message);
      setCreating(false);
      return;
    }

    const duplicate = (existingLeagues ?? []).some(
      (league) => league.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      setError('A league with that name already exists.');
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from('leagues')
      .insert({ name: trimmedName, owner_id: userId })
      .select('id, name, created_at')
      .single();

    if (error) {
      const message = error.message.includes('limit_3_leagues_per_owner')
        ? 'You have reached the maximum of 3 leagues.'
        : error.message;
      setError(message);
    } else if (data) {
      const leagueWithCount: League = { ...data, memberCount: 1 };
      setLeagues((prev) => [leagueWithCount, ...prev]);
      setName('');

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && userData.user) {
        const ownerEmail = userData.user.email?.toLowerCase() ?? null;
        await supabase.from('league_members').upsert({
          league_id: data.id,
          user_id: userData.user.id,
          email: ownerEmail,
        });

        await supabase.from('admin_events').insert({
          event_type: 'league.created',
          user_id: userData.user.id,
          user_email: ownerEmail,
          league_id: data.id,
          payload: { league_name: data.name },
        });
      }
    }

    setCreating(false);
  }

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">Leagues</h1>
        <p className="hero-subtitle">Loading your leagues5</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h1 className="section-title">Leagues</h1>
      {error && (
        <p className="hero-subtitle" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      )}
      {!error && (
        <>
          <p className="hero-subtitle">
            Create a league you can manage and schedule sessions.
          </p>
          {reachedLimit && (
            <p
              className="hero-subtitle"
              style={{ marginTop: '0.5rem', color: '#fbbf24' }}
            >
              You have reached the limit of {MAX_LEAGUES} leagues. Delete one to create
              another.
            </p>
          )}
        </>
      )}

      <form
        onSubmit={handleCreate}
        style={{
          marginTop: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <input
          type="text"
          placeholder="League name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={reachedLimit}
          style={{
            flex: '1 1 200px',
            padding: '0.45rem 0.6rem',
            borderRadius: '0.5rem',
            border: '1px solid #1f2937',
            background: '#020617',
            color: '#e5e7eb',
            opacity: reachedLimit ? 0.6 : 1,
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={creating || !name.trim() || reachedLimit}
        >
          {creating ? 'Creating…' : 'Create league'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 className="section-title">Leagues you manage ({MAX_LEAGUES} max)</h2>
        {leagues.length === 0 ? (
          <p className="hero-subtitle">You don't have any leagues yet.</p>
        ) : (
          <ul className="section-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
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
                <span>
                  {league.name}{' '}
                  {typeof league.memberCount === 'number'
                    ? `(${league.memberCount} ${
                        league.memberCount === 1 ? 'member' : 'members'
                      })`
                    : ''}
                </span>
                <a
                  href={`/leagues/${league.id}`}
                  className="btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  Manage
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 className="section-title">Leagues you're a member of</h2>
        {memberLeagues.length === 0 ? (
          <p className="hero-subtitle">You are not a member of any leagues yet.</p>
        ) : (
          <ul className="section-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {memberLeagues.map((league) => (
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
                <span>
                  {league.name}{' '}
                  {typeof league.memberCount === 'number'
                    ? `(${league.memberCount} ${
                        league.memberCount === 1 ? 'member' : 'members'
                      })`
                    : ''}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a
                    href={`/leagues/${league.id}`}
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
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

