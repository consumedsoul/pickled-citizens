'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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
  return d.toLocaleString();
}

function displayPlayerName(player: SessionPlayer) {
  const full = `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim();
  return full || player.email || player.id;
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

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">Session</h1>
        <p className="hero-subtitle">Loading session…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section">
        <h1 className="section-title">Session</h1>
        <p className="hero-subtitle" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="section">
        <h1 className="section-title">Session</h1>
        <p className="hero-subtitle">Session not found.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h1 className="section-title">Session details</h1>
      {userEmail && (
        <p className="hero-subtitle" style={{ marginBottom: '0.25rem' }}>
          Signed in as {userEmail}
        </p>
      )}
      <p className="hero-subtitle" style={{ marginBottom: '0.5rem' }}>
        {session.league_name || 'Unknown league'} · {session.player_count} players ·{' '}
        {formatDateTime(session.scheduled_for ?? session.created_at)}
      </p>
      {!canEdit && (
        <p className="hero-subtitle" style={{ fontSize: '0.85rem' }}>
          Only the session creator can update match results. You can still view the
          current standings.
        </p>
      )}

      <div
        style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 1.2fr)',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Teams column */}
        <div>
          <h2 className="section-title">Teams</h2>
          {matches.length === 0 ? (
            <p className="hero-subtitle" style={{ fontSize: '0.85rem' }}>
              No matches found for this session.
            </p>
          ) : (
            <div
              style={{
                marginTop: '0.75rem',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: '1px solid #1f2937',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  background: '#020617',
                }}
              >
                <div
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: '#15803d',
                    color: '#ecfdf5',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  Team A
                </div>
                <div
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: '#1d4ed8',
                    color: '#dbeafe',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  Team B
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#052e16',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '2rem',
                      textAlign: 'center',
                      color: '#bbf7d0',
                    }}
                  >
                    {teamStats.team1.wins}
                  </div>
                  {teamStats.team1.roster.map((p) => {
                    const stats = playerStatsMap.get(p.id);
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          color: '#dcfce7',
                        }}
                      >
                        <span>{displayPlayerName(p)}</span>
                        <span style={{ opacity: 0.8 }}>
                          {stats ? `${stats.wins}-${stats.losses}` : '0-0'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#172554',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '2rem',
                      textAlign: 'center',
                      color: '#bfdbfe',
                    }}
                  >
                    {teamStats.team2.wins}
                  </div>
                  {teamStats.team2.roster.map((p) => {
                    const stats = playerStatsMap.get(p.id);
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          color: '#dbeafe',
                        }}
                      >
                        <span>{displayPlayerName(p)}</span>
                        <span style={{ opacity: 0.8 }}>
                          {stats ? `${stats.wins}-${stats.losses}` : '0-0'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Matchups column */}
        <div>
          <h2 className="section-title">Matchups</h2>
          {matches.length === 0 ? (
            <p className="hero-subtitle" style={{ fontSize: '0.85rem' }}>
              No matchups to show yet.
            </p>
          ) : (
            <div
              style={{
                marginTop: '0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid #1f2937',
                padding: '0.5rem 0.6rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr) auto',
                  gap: '0.25rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                }}
              >
                <span>Team A pair</span>
                <span></span>
                <span>Team B pair</span>
                <span>Result</span>
              </div>
              {matches.map((match, index) => {
                const teamALabel =
                  match.team1.length >= 2
                    ? `${displayPlayerName(match.team1[0])} + ${displayPlayerName(
                        match.team1[1]
                      )}`
                    : match.team1.map(displayPlayerName).join(', ');
                const teamBLabel =
                  match.team2.length >= 2
                    ? `${displayPlayerName(match.team2[0])} + ${displayPlayerName(
                        match.team2[1]
                      )}`
                    : match.team2.map(displayPlayerName).join(', ');

                let winnerLabel = 'Not recorded';
                if (match.winner === 1) winnerLabel = 'Team A win';
                else if (match.winner === 2) winnerLabel = 'Team B win';

                return (
                  <div
                    key={match.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 140px)',
                      gap: '0.25rem',
                      alignItems: 'center',
                      padding: '0.3rem 0',
                      borderTop: index === 0 ? undefined : '1px solid #1f2937',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: '#bbf7d0' }}>
                      {teamALabel}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                        textAlign: 'center',
                      }}
                    >
                      vs
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#bfdbfe' }}>
                      {teamBLabel}
                    </span>
                    {canEdit ? (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '0.25rem',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleToggleWinner(match.id, 1)}
                          disabled={updatingMatchId === match.id}
                          style={{
                            padding: '0.15rem 0.4rem',
                            fontSize: '0.75rem',
                            background:
                              match.winner === 1 ? '#15803d' : 'transparent',
                            borderColor:
                              match.winner === 1 ? '#15803d' : '#4b5563',
                            color:
                              match.winner === 1 ? '#ecfdf5' : '#e5e7eb',
                          }}
                        >
                          Team A win
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleToggleWinner(match.id, 2)}
                          disabled={updatingMatchId === match.id}
                          style={{
                            padding: '0.15rem 0.4rem',
                            fontSize: '0.75rem',
                            background:
                              match.winner === 2 ? '#1d4ed8' : 'transparent',
                            borderColor:
                              match.winner === 2 ? '#1d4ed8' : '#4b5563',
                            color:
                              match.winner === 2 ? '#dbeafe' : '#e5e7eb',
                          }}
                        >
                          Team B win
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#e5e7eb',
                          textAlign: 'right',
                        }}
                      >
                        {winnerLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Players column */}
        <div>
          <h2 className="section-title">Players</h2>
          {playerStats.length === 0 ? (
            <p className="hero-subtitle" style={{ fontSize: '0.85rem' }}>
              Players will appear here once matches and participants are loaded.
            </p>
          ) : (
            <div
              style={{
                marginTop: '0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid #1f2937',
                padding: '0.5rem 0.6rem',
              }}
            >
              <ul
                className="section-list"
                style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}
              >
                {playerStats.map((ps) => (
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
                      <div style={{ fontSize: '0.85rem' }}>
                        {displayPlayerName(ps.player)}
                      </div>
                      {ps.player.self_reported_dupr != null && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#9ca3af',
                            marginTop: '0.1rem',
                          }}
                        >
                          DUPR {ps.player.self_reported_dupr.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#e5e7eb',
                        textAlign: 'right',
                      }}
                    >
                      <div>
                        {ps.wins}-{ps.losses}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Games: {ps.games}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
