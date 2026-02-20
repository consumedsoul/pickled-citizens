'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

      const leagueRel = (sessionRow as Record<string, unknown>).league as
        | { name: string }[]
        | { name: string }
        | null;
      const leagueName =
        Array.isArray(leagueRel) && leagueRel.length > 0
          ? leagueRel[0]?.name ?? null
          : !Array.isArray(leagueRel) && leagueRel
            ? leagueRel.name ?? null
            : null;

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
          'id, session_id, court_number, scheduled_order, status, match_players(user_id, team, position), result:match_results(team1_score, team2_score, completed_at)'
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
      type MatchQueryRow = {
        id: string;
        session_id: string;
        court_number: number | null;
        scheduled_order: number | null;
        status: string;
        match_players: { user_id: string; team: number; position: number }[];
        result:
          | { team1_score: number | null; team2_score: number | null; completed_at: string | null }
          | { team1_score: number | null; team2_score: number | null; completed_at: string | null }[]
          | null;
      };
      ((matchRows ?? []) as MatchQueryRow[]).forEach((row) => {
        const mps = row.match_players ?? [];
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

        type ProfileQueryRow = {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          self_reported_dupr: number | null;
        };
        ((profileRows ?? []) as ProfileQueryRow[]).forEach((p) => {
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

      const loadedMatches: MatchWithPlayers[] = ((matchRows ?? []) as MatchQueryRow[]).map((row) => {
        const mps = row.match_players ?? [];
        const team1 = mps
          .filter((mp) => mp.team === 1)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((mp) => toPlayer(mp.user_id));
        const team2 = mps
          .filter((mp) => mp.team === 2)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((mp) => toPlayer(mp.user_id));

        const rawResult = row.result;

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
    const team1Roster = new Map<string, { player: SessionPlayer; firstMatchIndex: number; positionInMatch: number }>();
    const team2Roster = new Map<string, { player: SessionPlayer; firstMatchIndex: number; positionInMatch: number }>();
    let team1Wins = 0;
    let team1Losses = 0;
    let team2Wins = 0;
    let team2Losses = 0;

    matches.forEach((match, matchIndex) => {
      match.team1.forEach((p, positionInMatch) => {
        if (!team1Roster.has(p.id)) {
          team1Roster.set(p.id, { player: p, firstMatchIndex: matchIndex, positionInMatch });
        }
      });
      match.team2.forEach((p, positionInMatch) => {
        if (!team2Roster.has(p.id)) {
          team2Roster.set(p.id, { player: p, firstMatchIndex: matchIndex, positionInMatch });
        }
      });

      if (match.winner === 1) {
        team1Wins += 1;
        team2Losses += 1;
      } else if (match.winner === 2) {
        team2Wins += 1;
        team1Losses += 1;
      }
    });

    const team1RosterSorted = Array.from(team1Roster.values())
      .sort((a, b) => {
        if (a.firstMatchIndex !== b.firstMatchIndex) {
          return a.firstMatchIndex - b.firstMatchIndex;
        }
        return a.positionInMatch - b.positionInMatch;
      })
      .map(entry => entry.player);

    const team2RosterSorted = Array.from(team2Roster.values())
      .sort((a, b) => {
        if (a.firstMatchIndex !== b.firstMatchIndex) {
          return a.firstMatchIndex - b.firstMatchIndex;
        }
        return a.positionInMatch - b.positionInMatch;
      })
      .map(entry => entry.player);

    return {
      team1: {
        wins: team1Wins,
        losses: team1Losses,
        roster: team1RosterSorted,
      },
      team2: {
        wins: team2Wins,
        losses: team2Losses,
        roster: team2RosterSorted,
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to update match result.');
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to delete session.');
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Session</h1>
        <p className="text-app-muted text-sm">Loading session...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Session</h1>
        <p className="text-app-danger text-sm">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Session</h1>
        <p className="text-app-muted text-sm">Session not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Session Details</h1>
        {canEdit && (
          <Button variant="danger" onClick={openDeleteDialog}>
            Delete Session
          </Button>
        )}
      </div>
      <p className="text-sm text-app-muted mb-4">
        {session.league_name || 'Deleted league'} &middot; {session.player_count} players &middot;{' '}
        {formatDateTime(session.scheduled_for ?? session.created_at)}
      </p>
      {error && (
        <p className="text-app-danger text-sm mb-4">{error}</p>
      )}
      {!canEdit && (
        <p className="text-app-muted text-xs mb-4">
          Only the session creator can update match results. You can still view the
          current standings.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-0 md:grid-cols-[1fr_2fr] md:gap-x-6">
        {/* Teams section - shows first on mobile */}
        <div className="order-1 md:col-start-1 md:row-start-1">
          <SectionLabel>TEAMS</SectionLabel>
          {matches.length === 0 ? (
            <p className="text-app-muted text-sm mt-3">
              No matches found for this session.
            </p>
          ) : (
            <div className="mt-3 border border-app-border overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-app-border">
                <div className="bg-team-green text-white font-mono text-xs uppercase tracking-label font-bold text-center py-2 px-3">
                  <span className="block">TEAM</span>
                  <span className="block">GREEN</span>
                </div>
                <div className="bg-team-blue text-white font-mono text-xs uppercase tracking-label font-bold text-center py-2 px-3">
                  <span className="block">TEAM</span>
                  <span className="block">BLUE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-app-border">
                <div className="flex flex-col bg-white">
                  <div className="font-display text-3xl text-center py-2 text-team-green font-bold">
                    {teamStats.team1.wins}
                  </div>
                  {teamStats.team1.roster.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-center"
                    >
                      <span className="text-sm text-team-green font-medium text-center py-1 px-3 truncate max-w-[120px] inline-block">
                        {displayPlayerName(p)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col bg-white">
                  <div className="font-display text-3xl text-center py-2 text-team-blue font-bold">
                    {teamStats.team2.wins}
                  </div>
                  {teamStats.team2.roster.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-center"
                    >
                      <span className="text-sm text-team-blue font-medium text-center py-1 px-3 truncate max-w-[120px] inline-block">
                        {displayPlayerName(p)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Players section - shows second on mobile */}
        <div className="order-3 mt-6 md:mt-0 md:col-start-1 md:row-start-2">
          <SectionLabel>PLAYERS</SectionLabel>
          {playerStats.length === 0 ? (
            <p className="text-app-muted text-sm mt-3">
              Players will appear here once matches and participants are loaded.
            </p>
          ) : (
            <ul className="mt-3 list-none p-0 m-0 border border-app-border divide-y divide-app-border">
              {playerStats.map((ps) => {
                const team1Count = matches.filter((m) =>
                  m.team1.some((p) => p.id === ps.player.id)
                ).length;
                const team2Count = matches.filter((m) =>
                  m.team2.some((p) => p.id === ps.player.id)
                ).length;
                const isTeam1 = team1Count >= team2Count;

                return (
                  <li
                    key={ps.player.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-white"
                  >
                    <div className={`text-sm font-medium ${isTeam1 ? 'text-team-green' : 'text-team-blue'}`}>
                      {displayPlayerName(ps.player)}
                      {ps.player.self_reported_dupr != null &&
                        !Number.isNaN(ps.player.self_reported_dupr) && (
                          <> ({ps.player.self_reported_dupr.toFixed(2)})</>
                        )}
                    </div>
                    <div className={`text-xs text-right ${isTeam1 ? 'text-team-green' : 'text-team-blue'}`}>
                      {ps.wins}-{ps.losses}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Matchups section - shows third on mobile, second column on desktop */}
        <div className="order-2 mt-6 md:mt-0 md:col-start-2 md:row-start-1 md:row-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <SectionLabel>MATCHUPS</SectionLabel>
            {matches.length > 0 && (
              <Button variant="sm" onClick={toggleFullscreen}>
                Full View
              </Button>
            )}
          </div>
          {matches.length === 0 ? (
            <p className="text-app-muted text-sm">
              No matchups to show yet.
            </p>
          ) : (
            <div className="border border-app-border bg-white px-3 py-2">
              {rounds.map((roundMatches, roundIndex) => (
                <div
                  key={roundIndex}
                  className={roundIndex === 0 ? '' : 'mt-2'}
                >
                  <div className="font-mono text-xs uppercase tracking-label font-medium text-app-muted text-center bg-app-bg-subtle py-1.5 -mx-3 px-3">
                    ROUND {roundIndex + 1}
                  </div>
                  {roundMatches.map((match, index) => (
                    <div
                      key={match.id}
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-1 items-center justify-items-center py-1.5 ${index !== 0 ? 'border-t border-app-border' : ''}`}
                    >
                      <button
                        type="button"
                        className={`font-mono text-[0.65rem] uppercase tracking-button px-2 py-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${
                          match.winner === 1
                            ? 'bg-team-green border-team-green text-white'
                            : 'border-app-border bg-transparent text-app-muted'
                        }`}
                        onClick={
                          canEdit ? () => handleToggleWinner(match.id, 1) : undefined
                        }
                        disabled={!canEdit || updatingMatchId === match.id}
                      >
                        Win
                      </button>
                      <div className="text-center flex flex-col md:flex-row md:justify-center md:gap-1 text-sm font-medium text-team-green">
                        {match.team1.map((p, i) => (
                          <span key={p.id}>
                            {displayPlayerNameShort(p)}
                            {i < match.team1.length - 1 && <span className="hidden md:inline"> +</span>}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-app-muted text-center">
                        vs
                      </span>
                      <div className="text-center flex flex-col md:flex-row md:justify-center md:gap-1 text-sm font-medium text-team-blue">
                        {match.team2.map((p, i) => (
                          <span key={p.id}>
                            {displayPlayerNameShort(p)}
                            {i < match.team2.length - 1 && <span className="hidden md:inline"> +</span>}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`font-mono text-[0.65rem] uppercase tracking-button px-2 py-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${
                          match.winner === 2
                            ? 'bg-team-blue border-team-blue text-white'
                            : 'border-app-border bg-transparent text-app-muted'
                        }`}
                        onClick={
                          canEdit ? () => handleToggleWinner(match.id, 2) : undefined
                        }
                        disabled={!canEdit || updatingMatchId === match.id}
                      >
                        Win
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {isFullscreen && matches.length > 0 && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto flex flex-col">
          {/* Fullscreen header */}
          <div className="border-b border-app-border bg-app-bg-subtle px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold">
                Matchups
              </h2>
              <p className="text-sm text-app-muted mt-0.5">
                {session.league_name || 'Session'} &middot; {session.player_count} players &middot; {formatDateTime(session.scheduled_for ?? session.created_at)}
              </p>
            </div>
            <Button variant="sm" onClick={toggleFullscreen}>
              Exit Full View
            </Button>
          </div>

          {/* Fullscreen 2-column layout: Teams+Players | Matchups */}
          <div className="grid grid-cols-[1fr_2fr] gap-6 p-6 overflow-auto flex-1">
            {/* Left column: Teams + Players */}
            <div className="overflow-auto">
              {/* Teams section */}
              <SectionLabel>TEAMS</SectionLabel>
              <div className="mt-3 border border-app-border overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-app-border">
                  <div className="bg-team-green text-white font-mono text-xs uppercase tracking-label font-bold text-center py-2 px-3">
                    <span className="block">TEAM</span>
                    <span className="block">GREEN</span>
                  </div>
                  <div className="bg-team-blue text-white font-mono text-xs uppercase tracking-label font-bold text-center py-2 px-3">
                    <span className="block">TEAM</span>
                    <span className="block">BLUE</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-app-border">
                  <div className="flex flex-col bg-white">
                    <div className="font-display text-3xl text-center py-2 text-team-green font-bold">
                      {teamStats.team1.wins}
                    </div>
                    {teamStats.team1.roster.map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-center"
                      >
                        <span className="text-sm text-team-green font-medium text-center py-1 px-3 truncate max-w-[120px] inline-block">
                          {displayPlayerName(p)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col bg-white">
                    <div className="font-display text-3xl text-center py-2 text-team-blue font-bold">
                      {teamStats.team2.wins}
                    </div>
                    {teamStats.team2.roster.map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-center"
                      >
                        <span className="text-sm text-team-blue font-medium text-center py-1 px-3 truncate max-w-[120px] inline-block">
                          {displayPlayerName(p)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Players section */}
              <div className="mt-6">
                <SectionLabel>PLAYERS</SectionLabel>
                {playerStats.length > 0 && (
                  <ul className="mt-3 list-none p-0 m-0 border border-app-border divide-y divide-app-border">
                    {playerStats.map((ps) => {
                      const team1Count = matches.filter((m) =>
                        m.team1.some((p) => p.id === ps.player.id)
                      ).length;
                      const team2Count = matches.filter((m) =>
                        m.team2.some((p) => p.id === ps.player.id)
                      ).length;
                      const isTeam1 = team1Count >= team2Count;

                      return (
                        <li
                          key={ps.player.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 bg-white"
                        >
                          <div className={`text-sm font-medium ${isTeam1 ? 'text-team-green' : 'text-team-blue'}`}>
                            {displayPlayerName(ps.player)}
                            {ps.player.self_reported_dupr != null &&
                              !Number.isNaN(ps.player.self_reported_dupr) && (
                                <> ({ps.player.self_reported_dupr.toFixed(2)})</>
                              )}
                          </div>
                          <div className={`text-xs text-right ${isTeam1 ? 'text-team-green' : 'text-team-blue'}`}>
                            {ps.wins}-{ps.losses}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Right column: Matchups */}
            <div className="overflow-auto">
              <SectionLabel>MATCHUPS</SectionLabel>
              <div className="mt-3">
                {rounds.map((roundMatches, roundIndex) => (
                  <div
                    key={roundIndex}
                    className={roundIndex === 0 ? '' : 'mt-3'}
                  >
                    <div className="font-mono text-xs uppercase tracking-label text-app-muted font-medium text-center bg-app-bg-subtle py-1.5">
                      ROUND {roundIndex + 1}
                    </div>
                    {roundMatches.map((match, index) => (
                      <div
                        key={match.id}
                        className={`grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-2 items-center justify-items-center py-2 ${index !== 0 ? 'border-t border-app-border' : ''}`}
                      >
                        <button
                          type="button"
                          className={`font-mono text-[0.65rem] uppercase tracking-button px-2 py-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${
                            match.winner === 1
                              ? 'bg-team-green border-team-green text-white'
                              : 'bg-transparent border-app-border text-app-muted'
                          }`}
                          onClick={canEdit ? () => handleToggleWinner(match.id, 1) : undefined}
                          disabled={!canEdit || updatingMatchId === match.id}
                        >
                          Win
                        </button>
                        <div className="text-team-green text-base font-medium text-center">
                          {match.team1.map(displayPlayerNameShort).join(' + ')}
                        </div>
                        <span className="text-sm text-app-muted">vs</span>
                        <div className="text-team-blue text-base font-medium text-center">
                          {match.team2.map(displayPlayerNameShort).join(' + ')}
                        </div>
                        <button
                          type="button"
                          className={`font-mono text-[0.65rem] uppercase tracking-button px-2 py-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${
                            match.winner === 2
                              ? 'bg-team-blue border-team-blue text-white'
                              : 'bg-transparent border-app-border text-app-muted'
                          }`}
                          onClick={canEdit ? () => handleToggleWinner(match.id, 2) : undefined}
                          disabled={!canEdit || updatingMatchId === match.id}
                        >
                          Win
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {canEdit && deleteOpen && (
        <Modal
          title="DELETE SESSION"
          onClose={closeDeleteDialog}
          footer={
            <>
              <Button variant="secondary" onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteSession}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </>
          }
        >
          <p>
            Are you sure you want to delete this session? This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
