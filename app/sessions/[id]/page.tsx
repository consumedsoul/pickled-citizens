'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Metadata } from 'next';

type SessionPlayer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  self_reported_dupr: number | null;
};

type Session = {
  id: string;
  league_id: string | null;
  league_name: string | null;
  created_by: string;
  created_at: string;
  scheduled_for: string | null;
  player_count: number;
};

type MatchResult = {
  team1_score: number | null;
  team2_score: number | null;
  completed_at: string | null;
} | null;

type MatchWithPlayers = {
  id: string;
  court_number: number | null;
  scheduled_order: number | null;
  status: string;
  team1: SessionPlayer[];
  team2: SessionPlayer[];
  result: MatchResult;
  winner: 1 | 2 | null;
};

type TeamStats = {
  wins: number;
  losses: number;
  roster: SessionPlayer[];
};

type PlayerStats = {
  player: SessionPlayer;
  wins: number;
  losses: number;
  games: number;
};

function formatDateTime(value: string | null) {
  if (!value) return 'Not scheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTimeForMeta(value: string | null) {
  if (!value) return 'Not scheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function displayPlayerName(player: SessionPlayer) {
  const full = `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim();
  if (full) return full;
  return 'Deleted player';
}

function displayPlayerNameShort(player: SessionPlayer) {
  const firstName = player.first_name?.trim() || '';
  const lastName = player.last_name?.trim() || '';
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}`;
  }
  if (firstName) return firstName;
  if (lastName) return lastName;
  return 'Deleted player';
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!sessionId) return;

      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        router.replace('/');
        return;
      }

      const user = authData.user;
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const { data: sessionRow, error: sessionError } = await supabase
        .from('game_sessions')
        .select(
          'id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)'
        )
        .eq('id', sessionId)
        .maybeSingle();

      if (!active) return;

      if (sessionError || !sessionRow) {
        setError(sessionError?.message ?? 'Session not found.');
        setLoading(false);
        return;
      }

      const leagueRel: any = (sessionRow as any).league;
      const leagueName =
        Array.isArray(leagueRel) && leagueRel.length > 0
          ? leagueRel[0]?.name ?? null
          : leagueRel?.name ?? null;

      const baseSession: Session = {
        id: sessionRow.id,
        league_id: sessionRow.league_id ?? null,
        league_name: leagueName,
        created_by: sessionRow.created_by,
        created_at: sessionRow.created_at,
        scheduled_for: sessionRow.scheduled_for ?? null,
        player_count: sessionRow.player_count,
      };

      setSession(baseSession);

      const { data: matchRows, error: matchesError } = await supabase
        .from('matches')
        .select(
          'id, session_id, court_number, scheduled_order, status, match_players(user_id, team), result:match_results(team1_score, team2_score, completed_at)'
        )
        .eq('session_id', sessionId)
        .order('scheduled_order', { ascending: true });

      if (!active) return;

      if (matchesError) {
        setError(matchesError.message);
        setMatches([]);
        setLoading(false);
        return;
      }

      const playerIds = new Set<string>();
      (matchRows ?? []).forEach((row: any) => {
        const mps = (row.match_players ?? []) as { user_id: string; team: number }[];
        mps.forEach((mp) => {
          if (mp.user_id) playerIds.add(mp.user_id);
        });
      });

      const profilesMap = new Map<string, SessionPlayer>();
      if (playerIds.size > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, self_reported_dupr')
          .in('id', Array.from(playerIds));

        if (!active) return;

        if (profilesError) {
          setError(profilesError.message);
          setMatches([]);
          setLoading(false);
          return;
        }

        (profileRows ?? []).forEach((p: any) => {
          let dupr: number | null = null;
          if (p.self_reported_dupr != null) {
            const n = Number(p.self_reported_dupr);
            dupr = Number.isNaN(n) ? null : n;
          }
          profilesMap.set(p.id, {
            id: p.id,
            first_name: p.first_name ?? null,
            last_name: p.last_name ?? null,
            email: p.email ?? null,
            self_reported_dupr: dupr,
          });
        });
      }

      function toPlayer(userId: string): SessionPlayer {
        const profile = profilesMap.get(userId);
        if (profile) return profile;
        return {
          id: userId,
          first_name: null,
          last_name: null,
          email: null,
          self_reported_dupr: null,
        };
      }

      const loadedMatches: MatchWithPlayers[] = (matchRows ?? []).map((row: any) => {
        const mps = (row.match_players ?? []) as { user_id: string; team: number }[];
        const team1 = mps
          .filter((mp) => mp.team === 1)
          .map((mp) => toPlayer(mp.user_id));
        const team2 = mps
          .filter((mp) => mp.team === 2)
          .map((mp) => toPlayer(mp.user_id));

        const rawResult = (row as any).result as
          | { team1_score: number | null; team2_score: number | null; completed_at: string | null }
          | { team1_score: number | null; team2_score: number | null; completed_at: string | null }[]
          | null
          | undefined;

        let result: MatchResult = null;
        if (rawResult) {
          if (Array.isArray(rawResult)) {
            result = rawResult[0] ?? null;
          } else {
            result = rawResult;
          }
        }

        let winner: 1 | 2 | null = null;
        if (result && result.team1_score != null && result.team2_score != null) {
          if (result.team1_score > result.team2_score) winner = 1;
          else if (result.team2_score > result.team1_score) winner = 2;
        }

        return {
          id: row.id,
          court_number: row.court_number ?? null,
          scheduled_order: row.scheduled_order ?? null,
          status: row.status,
          team1,
          team2,
          result,
          winner,
        };
      });

      setMatches(loadedMatches);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [sessionId, router]);

  const canEdit = !!session && !!userId && session.created_by === userId;

  const teamStats = useMemo<{
    team1: TeamStats;
    team2: TeamStats;
  }>(() => {
    const team1Roster = new Map<string, SessionPlayer>();
    const team2Roster = new Map<string, SessionPlayer>();
    let team1Wins = 0;
    let team1Losses = 0;
    let team2Wins = 0;
    let team2Losses = 0;

    matches.forEach((match) => {
      match.team1.forEach((p) => {
        if (!team1Roster.has(p.id)) team1Roster.set(p.id, p);
      });
      match.team2.forEach((p) => {
        if (!team2Roster.has(p.id)) team2Roster.set(p.id, p);
      });

      if (match.winner === 1) {
        team1Wins += 1;
        team2Losses += 1;
      } else if (match.winner === 2) {
        team2Wins += 1;
        team1Losses += 1;
      }
    });

    return {
      team1: {
        wins: team1Wins,
        losses: team1Losses,
        roster: Array.from(team1Roster.values()),
      },
      team2: {
        wins: team2Wins,
        losses: team2Losses,
        roster: Array.from(team2Roster.values()),
      },
    };
  }, [matches]);

  const playerStats = useMemo<PlayerStats[]>(() => {
    const map = new Map<string, PlayerStats>();

    matches.forEach((match) => {
      const participants: { player: SessionPlayer; team: 1 | 2 }[] = [
        ...match.team1.map((p) => ({ player: p, team: 1 as 1 | 2 })),
        ...match.team2.map((p) => ({ player: p, team: 2 as 1 | 2 })),
      ];

      participants.forEach(({ player, team }) => {
        let entry = map.get(player.id);
        if (!entry) {
          entry = { player, wins: 0, losses: 0, games: 0 };
          map.set(player.id, entry);
        }

        if (match.winner != null) {
          entry.games += 1;
          if (match.winner === team) {
            entry.wins += 1;
          } else {
            entry.losses += 1;
          }
        }
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.games !== a.games) return b.games - a.games;
      const an = displayPlayerName(a.player).toLowerCase();
      const bn = displayPlayerName(b.player).toLowerCase();
      return an.localeCompare(bn);
    });
    return list;
  }, [matches]);

  const playerStatsMap = useMemo(() => {
    const m = new Map<string, PlayerStats>();
    playerStats.forEach((ps) => {
      m.set(ps.player.id, ps);
    });
    return m;
  }, [playerStats]);

  const courtsPerRound = useMemo(() => {
    if (!session) return 1;
    if (session.player_count >= 12) return 3;
    if (session.player_count >= 8) return 2;
    return 1;
  }, [session]);

  const rounds = useMemo(() => {
    if (!matches.length) return [] as MatchWithPlayers[][];
    const perRound = courtsPerRound || 1;
    const grouped: MatchWithPlayers[][] = [];
    matches.forEach((match, index) => {
      const roundIndex = Math.floor(index / perRound);
      if (!grouped[roundIndex]) grouped[roundIndex] = [];
      grouped[roundIndex].push(match);
    });
    return grouped;
  }, [matches, courtsPerRound]);

  async function handleToggleWinner(matchId: string, team: 1 | 2) {
    if (!session || !canEdit) return;

    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const currentWinner = match.winner;
    const nextWinner: 1 | 2 | null = currentWinner === team ? null : team;

    setUpdatingMatchId(matchId);
    setError(null);

    try {
      if (nextWinner === null) {
        const { error: deleteError } = await supabase
          .from('match_results')
          .delete()
          .eq('match_id', matchId);
        if (deleteError) {
          setError(deleteError.message);
          setUpdatingMatchId(null);
          return;
        }
      } else {
        const team1Score = nextWinner === 1 ? 1 : 0;
        const team2Score = nextWinner === 2 ? 1 : 0;
        const { error: upsertError } = await supabase
          .from('match_results')
          .upsert(
            {
              match_id: matchId,
              team1_score: team1Score,
              team2_score: team2Score,
              completed_at: new Date().toISOString(),
            },
            { onConflict: 'match_id' }
          );
        if (upsertError) {
          setError(upsertError.message);
          setUpdatingMatchId(null);
          return;
        }
      }

      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                result:
                  nextWinner === null
                    ? null
                    : {
                        team1_score: nextWinner === 1 ? 1 : 0,
                        team2_score: nextWinner === 2 ? 1 : 0,
                        completed_at: new Date().toISOString(),
                      },
                winner: nextWinner,
              }
            : m
        )
      );
    } catch (e: any) {
      setError(e?.message ?? 'Unable to update match result.');
    } finally {
      setUpdatingMatchId(null);
    }
  }

  function openDeleteDialog() {
    setDeleteOpen(true);
    setError(null);
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteLoading(false);
  }

  async function handleDeleteSession() {
    if (!session || !userId) return;
    setDeleteLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', session.id)
        .eq('created_by', userId);

      if (deleteError) {
        setError(deleteError.message);
        setDeleteLoading(false);
        return;
      }

      if (userEmail) {
        await supabase.from('admin_events').insert({
          event_type: 'session.deleted',
          user_id: userId,
          user_email: userEmail.toLowerCase(),
          league_id: session.league_id,
          payload: { session_id: session.id },
        });
      }

      closeDeleteDialog();
      router.replace('/sessions');
    } catch (e: any) {
      setError(e?.message ?? 'Unable to delete session.');
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Session</h1>
        <p className="text-app-muted">Loading session…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Session</h1>
        <p className="text-app-muted" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Session</h1>
        <p className="text-app-muted">Session not found.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <h1 className="text-base font-medium mb-3">Session details</h1>
        {canEdit && (
          <button
            type="button"
            className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={openDeleteDialog}
            style={{
              background: '#b91c1c',
              borderColor: '#b91c1c',
              color: '#fee2e2',
            }}
          >
            Delete session
          </button>
        )}
      </div>
      <p className="text-app-muted" style={{ marginBottom: '0.5rem' }}>
        {session.league_name || 'Deleted league'} · {session.player_count} players ·{' '}
        {formatDateTime(session.scheduled_for ?? session.created_at)}
      </p>
      {!canEdit && (
        <p className="text-app-muted" style={{ fontSize: '0.85rem' }}>
          Only the session creator can update match results. You can still view the
          current standings.
        </p>
      )}

      <div
        className="mt-6 grid grid-cols-1 gap-0 md:grid-cols-[1fr_2fr] md:gap-x-6"
      >
        {/* Teams section - shows first on mobile */}
        <div style={{ order: 1 }} className="md:col-start-1 md:row-start-1">
          <h2 className="text-base font-medium mb-3">Teams</h2>
          {matches.length === 0 ? (
            <p className="text-app-muted" style={{ fontSize: '0.85rem' }}>
              No matches found for this session.
            </p>
          ) : (
            <div
              style={{
                marginTop: 0,
                marginBottom: 0,
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1px',
                  background: '#d1d5db',
                }}
              >
                <div
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: '#14532d',
                    color: '#ffffff',
                    fontWeight: 800,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Courier New", monospace',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span>TEAM</span>
                  <span>GREEN</span>
                </div>
                <div
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: '#1e40af',
                    color: '#ffffff',
                    fontWeight: 800,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Courier New", monospace',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span>TEAM</span>
                  <span>BLUE</span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1px',
                  background: '#d1d5db',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '2rem',
                      textAlign: 'center',
                      color: '#14532d',
                    }}
                  >
                    {teamStats.team1.wins}
                  </div>
                  {teamStats.team1.roster.map((p) => {
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.875rem',
                          display: 'flex',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          textAlign: 'center',
                          color: '#14532d',
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}
                        >
                          {displayPlayerName(p)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '2rem',
                      textAlign: 'center',
                      color: '#1e3a8a',
                    }}
                  >
                    {teamStats.team2.wins}
                  </div>
                  {teamStats.team2.roster.map((p) => {
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.875rem',
                          display: 'flex',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          textAlign: 'center',
                          color: '#1e3a8a',
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}
                        >
                          {displayPlayerName(p)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Players section - shows second on mobile */}
        <div style={{ order: 3 }} className="mt-6 md:mt-0 md:col-start-1 md:row-start-2">
          <h2 className="text-base font-medium mb-3">Players</h2>
          {playerStats.length === 0 ? (
            <p className="text-app-muted" style={{ fontSize: '0.85rem' }}>
              Players will appear here once matches and participants are loaded.
            </p>
          ) : (
            <div
              style={{
                marginTop: 0,
                borderRadius: '0.75rem',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                padding: '0.5rem 0.6rem',
              }}
            >
              <ul
                className="list-none pl-0 text-app-muted text-[0.87rem]"
                style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}
              >
                {playerStats.map((ps) => {
                  const team1Count = matches.filter((m) =>
                    m.team1.some((p) => p.id === ps.player.id)
                  ).length;
                  const team2Count = matches.filter((m) =>
                    m.team2.some((p) => p.id === ps.player.id)
                  ).length;
                  const isTeam1 = team1Count >= team2Count;
                  const nameColor = isTeam1 ? '#14532d' : '#1e3a8a';
                  const recordColor = isTeam1 ? '#14532d' : '#1e3a8a';

                  return (
                  <li
                    key={ps.player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.25rem 0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', color: nameColor, fontWeight: 500 }}>
                        {displayPlayerName(ps.player)}
                        {ps.player.self_reported_dupr != null &&
                          !Number.isNaN(ps.player.self_reported_dupr) && (
                            <> ({ps.player.self_reported_dupr.toFixed(2)})</>
                          )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: recordColor,
                        textAlign: 'right',
                      }}
                    >
                      <div>
                        {ps.wins}-{ps.losses}
                      </div>
                    </div>
                  </li>
                );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Matchups section - shows third on mobile, second column on desktop */}
        <div style={{ order: 2 }} className="mt-6 md:mt-0 md:col-start-2 md:row-start-1 md:row-span-2">
          <h2 className="text-base font-medium mb-3">Matchups</h2>
          {matches.length === 0 ? (
            <p className="text-app-muted" style={{ fontSize: '0.85rem' }}>
              No matchups to show yet.
            </p>
          ) : (
            <div
              style={{
                marginTop: '0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                padding: '0.5rem 0.6rem',
              }}
            >
              {rounds.map((roundMatches, roundIndex) => (
                <div
                  key={roundIndex}
                  style={{
                    marginTop: roundIndex === 0 ? 0 : '0.5rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#4b5563',
                      marginBottom: '0.15rem',
                      textAlign: 'center',
                      background: '#f3f4f6',
                      padding: '0.25rem 0.5rem',
                      marginLeft: '-0.6rem',
                      marginRight: '-0.6rem',
                    }}
                  >
                    ROUND {roundIndex + 1}
                  </div>
                  {roundMatches.map((match, index) => {
                    const team1Names = match.team1.map(displayPlayerNameShort).join(' + ');
                    const team2Names = match.team2.map(displayPlayerNameShort).join(' + ');

                    return (
                      <div
                        key={match.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'auto minmax(0, 1fr) auto minmax(0, 1fr) auto',
                          gap: '0.25rem',
                          alignItems: 'center',
                          justifyItems: 'center',
                          padding: '0.3rem 0',
                          borderTop: index === 0 ? undefined : '1px solid #e5e7eb',
                        }}
                      >
                        <button
                          type="button"
                          className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={
                            canEdit ? () => handleToggleWinner(match.id, 1) : undefined
                          }
                          disabled={!canEdit || updatingMatchId === match.id}
                          style={{
                            padding: '0.15rem 0.4rem',
                            fontSize: '0.75rem',
                            background:
                              match.winner === 1 ? '#14532d' : '#f9fafb',
                            borderColor:
                              match.winner === 1 ? '#14532d' : '#d1d5db',
                            color: match.winner === 1 ? '#ffffff' : '#4b5563',
                          }}
                        >
                          Win
                        </button>
                        <div
                          className="text-center flex flex-col md:flex-row md:justify-center md:gap-1"
                          style={{ color: '#14532d', fontSize: '0.875rem', fontWeight: 500 }}
                        >
                          {match.team1.map((p, i) => (
                            <span key={p.id}>
                              {displayPlayerNameShort(p)}
                              {i < match.team1.length - 1 && <span className="hidden md:inline"> +</span>}
                            </span>
                          ))}
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            textAlign: 'center',
                          }}
                        >
                          vs
                        </span>
                        <div
                          className="text-center flex flex-col md:flex-row md:justify-center md:gap-1"
                          style={{ color: '#1e3a8a', fontSize: '0.875rem', fontWeight: 500 }}
                        >
                          {match.team2.map((p, i) => (
                            <span key={p.id}>
                              {displayPlayerNameShort(p)}
                              {i < match.team2.length - 1 && <span className="hidden md:inline"> +</span>}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={
                            canEdit ? () => handleToggleWinner(match.id, 2) : undefined
                          }
                          disabled={!canEdit || updatingMatchId === match.id}
                          style={{
                            padding: '0.15rem 0.4rem',
                            fontSize: '0.75rem',
                            background:
                              match.winner === 2 ? '#1e40af' : '#f9fafb',
                            borderColor:
                              match.winner === 2 ? '#1e40af' : '#d1d5db',
                            color: match.winner === 2 ? '#ffffff' : '#4b5563',
                          }}
                        >
                          Win
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {canEdit && deleteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
        >
          <div
            className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5"
            style={{
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <h2 className="text-base font-medium mb-3">Delete session</h2>
            <p className="text-app-muted">
              Are you sure you want to delete this session? This action cannot be undone.
            </p>
            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={closeDeleteDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDeleteSession}
                disabled={deleteLoading}
                style={{
                  background: '#b91c1c',
                  borderColor: '#b91c1c',
                  color: '#fee2e2',
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
