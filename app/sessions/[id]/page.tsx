'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';
import { displayPlayerName, displayPlayerNameShort } from '@/lib/formatters';
import { ClientDateTime } from '@/components/ClientDateTime';
import {
  getSessionDetail,
  recordMatchResultAction,
  clearMatchResultAction,
  deleteSessionAction,
} from '@/lib/actions/sessions';

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

function TeamsPanel({
  teamStats,
  hasMatches,
}: {
  teamStats: { team1: TeamStats; team2: TeamStats };
  hasMatches: boolean;
}) {
  if (!hasMatches) {
    return <p className="text-app-muted text-sm mt-3">No matches found for this session.</p>;
  }
  return (
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
            <div key={p.id} className="flex justify-center">
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
            <div key={p.id} className="flex justify-center">
              <span className="text-sm text-team-blue font-medium text-center py-1 px-3 truncate max-w-[120px] inline-block">
                {displayPlayerName(p)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayersPanel({
  playerStats,
  matches,
  showEmptyState,
}: {
  playerStats: PlayerStats[];
  matches: MatchWithPlayers[];
  showEmptyState: boolean;
}) {
  if (playerStats.length === 0) {
    if (!showEmptyState) return null;
    return (
      <p className="text-app-muted text-sm mt-3">
        Players will appear here once matches and participants are loaded.
      </p>
    );
  }
  return (
    <ul className="mt-3 list-none p-0 m-0 border border-app-border divide-y divide-app-border">
      {playerStats.map((ps) => {
        const team1Count = matches.filter((m) => m.team1.some((p) => p.id === ps.player.id))
          .length;
        const team2Count = matches.filter((m) => m.team2.some((p) => p.id === ps.player.id))
          .length;
        const isTeam1 = team1Count >= team2Count;

        return (
          <li
            key={ps.player.id}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-white"
          >
            <div
              className={`text-sm font-medium ${isTeam1 ? 'text-team-green' : 'text-team-blue'}`}
            >
              {displayPlayerName(ps.player)}
              {ps.player.self_reported_dupr != null &&
                !Number.isNaN(ps.player.self_reported_dupr) && (
                  <> ({ps.player.self_reported_dupr.toFixed(2)})</>
                )}
            </div>
            <div
              className={`text-xs text-right ${isTeam1 ? 'text-team-green' : 'text-team-blue'}`}
            >
              {ps.wins}-{ps.losses}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MatchupsPanel({
  rounds,
  canEdit,
  updatingMatchId,
  onToggleWinner,
  variant,
}: {
  rounds: MatchWithPlayers[][];
  canEdit: boolean;
  updatingMatchId: string | null;
  onToggleWinner: (matchId: string, team: 1 | 2) => void;
  variant: 'compact' | 'fullscreen';
}) {
  const isFullscreen = variant === 'fullscreen';
  return (
    <div className={isFullscreen ? 'mt-3' : 'border border-app-border bg-white px-3 py-2'}>
      {rounds.map((roundMatches, roundIndex) => (
        <div
          key={roundIndex}
          className={roundIndex === 0 ? '' : isFullscreen ? 'mt-3' : 'mt-2'}
        >
          <div
            className={`font-mono text-xs uppercase tracking-label font-medium text-app-muted text-center bg-app-bg-subtle py-1.5 ${isFullscreen ? '' : '-mx-3 px-3'}`}
          >
            ROUND {roundIndex + 1}
          </div>
          {roundMatches.map((match, index) => (
            <div
              key={match.id}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center justify-items-center ${isFullscreen ? 'gap-2 py-2' : 'gap-1 py-1.5'} ${index !== 0 ? 'border-t border-app-border' : ''}`}
            >
              <button
                type="button"
                className={`font-mono text-[0.65rem] uppercase tracking-button px-2 py-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${
                  match.winner === 1
                    ? 'bg-team-green border-team-green text-white'
                    : 'bg-transparent border-app-border text-app-muted'
                }`}
                onClick={canEdit ? () => onToggleWinner(match.id, 1) : undefined}
                disabled={!canEdit || updatingMatchId === match.id}
              >
                Win
              </button>
              {isFullscreen ? (
                <div className="text-team-green text-base font-medium text-center">
                  {match.team1.map(displayPlayerNameShort).join(' + ')}
                </div>
              ) : (
                <div className="text-center flex flex-col md:flex-row md:justify-center md:gap-1 text-sm font-medium text-team-green">
                  {match.team1.map((p, i) => (
                    <span key={p.id}>
                      {displayPlayerNameShort(p)}
                      {i < match.team1.length - 1 && (
                        <span className="hidden md:inline"> +</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <span
                className={`text-app-muted text-center ${isFullscreen ? 'text-sm' : 'text-xs'}`}
              >
                vs
              </span>
              {isFullscreen ? (
                <div className="text-team-blue text-base font-medium text-center">
                  {match.team2.map(displayPlayerNameShort).join(' + ')}
                </div>
              ) : (
                <div className="text-center flex flex-col md:flex-row md:justify-center md:gap-1 text-sm font-medium text-team-blue">
                  {match.team2.map((p, i) => (
                    <span key={p.id}>
                      {displayPlayerNameShort(p)}
                      {i < match.team2.length - 1 && (
                        <span className="hidden md:inline"> +</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={`font-mono text-[0.65rem] uppercase tracking-button px-2 py-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${
                  match.winner === 2
                    ? 'bg-team-blue border-team-blue text-white'
                    : 'bg-transparent border-app-border text-app-muted'
                }`}
                onClick={canEdit ? () => onToggleWinner(match.id, 2) : undefined}
                disabled={!canEdit || updatingMatchId === match.id}
              >
                Win
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const sessionId = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const userId = user?.id ?? null;

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!sessionId) return;
    if (!isLoaded) return;
    if (!user) {
      router.replace('/auth/signin');
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getSessionDetail(sessionId);
        if (!active) return;
        if (!detail) {
          setError('Session not found.');
          setSession(null);
          setMatches([]);
          return;
        }

        setSession({
          id: detail.session.id,
          league_id: detail.session.leagueId ?? null,
          league_name: detail.leagueName ?? null,
          created_by: detail.session.createdBy,
          created_at: detail.session.createdAt ?? '',
          scheduled_for: detail.session.scheduledFor ?? null,
          player_count: detail.session.playerCount,
        });

        const profilesById = new Map(detail.profiles.map((p) => [p.id, p]));
        const guestsById = new Map(detail.guests.map((g) => [g.id, g]));
        const resultsByMatch = new Map(detail.results.map((r) => [r.matchId, r]));

        const playersByMatch = new Map<
          string,
          Array<{
            userId: string | null;
            guestId: string | null;
            team: number;
            position: number;
          }>
        >();
        for (const p of detail.players) {
          const list = playersByMatch.get(p.matchId) ?? [];
          list.push({ userId: p.userId, guestId: p.guestId, team: p.team, position: p.position });
          playersByMatch.set(p.matchId, list);
        }

        function toPlayer(mp: { userId: string | null; guestId: string | null }): SessionPlayer {
          if (mp.guestId) {
            const guest = guestsById.get(mp.guestId);
            if (guest) {
              const name = (guest.displayName ?? '').trim();
              const firstSpace = name.indexOf(' ');
              return {
                id: guest.id,
                first_name: firstSpace === -1 ? name : name.slice(0, firstSpace),
                last_name:
                  firstSpace === -1 ? null : name.slice(firstSpace + 1).trim() || null,
                email: null,
                self_reported_dupr: guest.dupr ?? null,
              };
            }
            return {
              id: mp.guestId,
              first_name: null,
              last_name: null,
              email: null,
              self_reported_dupr: null,
            };
          }
          if (mp.userId) {
            const profile = profilesById.get(mp.userId);
            if (profile) {
              return {
                id: profile.id,
                first_name: profile.firstName,
                last_name: profile.lastName,
                email: profile.email,
                self_reported_dupr:
                  profile.selfReportedDupr != null ? Number(profile.selfReportedDupr) : null,
              };
            }
            return {
              id: mp.userId,
              first_name: null,
              last_name: null,
              email: null,
              self_reported_dupr: null,
            };
          }
          return {
            id: 'unknown',
            first_name: null,
            last_name: null,
            email: null,
            self_reported_dupr: null,
          };
        }

        const sortedMatches = [...detail.matches].sort(
          (a, b) => (a.scheduledOrder ?? 0) - (b.scheduledOrder ?? 0),
        );

        const built: MatchWithPlayers[] = sortedMatches.map((m) => {
          const players = playersByMatch.get(m.id) ?? [];
          const team1 = players
            .filter((p) => p.team === 1)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map(toPlayer);
          const team2 = players
            .filter((p) => p.team === 2)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map(toPlayer);

          const r = resultsByMatch.get(m.id);
          const result: MatchResult = r
            ? {
                team1_score: r.team1Score,
                team2_score: r.team2Score,
                completed_at: r.completedAt,
              }
            : null;
          let winner: 1 | 2 | null = null;
          if (result && result.team1_score != null && result.team2_score != null) {
            if (result.team1_score > result.team2_score) winner = 1;
            else if (result.team2_score > result.team1_score) winner = 2;
          }

          return {
            id: m.id,
            court_number: m.courtNumber,
            scheduled_order: m.scheduledOrder,
            status: m.status,
            team1,
            team2,
            result,
            winner,
          };
        });

        setMatches(built);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load session.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId, isLoaded, user, router]);

  const canEdit = !!session && !!userId && session.created_by === userId;

  const teamStats = useMemo<{ team1: TeamStats; team2: TeamStats }>(() => {
    const team1Roster = new Map<
      string,
      { player: SessionPlayer; firstMatchIndex: number; positionInMatch: number }
    >();
    const team2Roster = new Map<
      string,
      { player: SessionPlayer; firstMatchIndex: number; positionInMatch: number }
    >();
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
      .sort((a, b) =>
        a.firstMatchIndex !== b.firstMatchIndex
          ? a.firstMatchIndex - b.firstMatchIndex
          : a.positionInMatch - b.positionInMatch,
      )
      .map((entry) => entry.player);
    const team2RosterSorted = Array.from(team2Roster.values())
      .sort((a, b) =>
        a.firstMatchIndex !== b.firstMatchIndex
          ? a.firstMatchIndex - b.firstMatchIndex
          : a.positionInMatch - b.positionInMatch,
      )
      .map((entry) => entry.player);

    return {
      team1: { wins: team1Wins, losses: team1Losses, roster: team1RosterSorted },
      team2: { wins: team2Wins, losses: team2Losses, roster: team2RosterSorted },
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
          if (match.winner === team) entry.wins += 1;
          else entry.losses += 1;
        }
      });
    });
    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.games !== a.games) return b.games - a.games;
      return displayPlayerName(a.player)
        .toLowerCase()
        .localeCompare(displayPlayerName(b.player).toLowerCase());
    });
    return list;
  }, [matches]);

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
        await clearMatchResultAction({ matchId });
      } else {
        const team1Score = nextWinner === 1 ? 1 : 0;
        const team2Score = nextWinner === 2 ? 1 : 0;
        await recordMatchResultAction({ matchId, team1Score, team2Score });
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
            : m,
        ),
      );
    } catch (e) {
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
    if (!session) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await deleteSessionAction({ sessionId: session.id });
      closeDeleteDialog();
      router.replace('/sessions');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete session.');
      setDeleteLoading(false);
    }
  }

  if (loading || !isLoaded) {
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
        <ClientDateTime value={session.scheduled_for ?? session.created_at} />
      </p>
      {error && <p className="text-app-danger text-sm mb-4">{error}</p>}
      {!canEdit && (
        <p className="text-app-muted text-xs mb-4">
          Only the session creator can update match results. You can still view the current
          standings.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-0 md:grid-cols-[1fr_2fr] md:gap-x-6">
        <div className="order-1 md:col-start-1 md:row-start-1">
          <SectionLabel>TEAMS</SectionLabel>
          <TeamsPanel teamStats={teamStats} hasMatches={matches.length > 0} />
        </div>

        <div className="order-3 mt-6 md:mt-0 md:col-start-1 md:row-start-2">
          <SectionLabel>PLAYERS</SectionLabel>
          <PlayersPanel playerStats={playerStats} matches={matches} showEmptyState />
        </div>

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
            <p className="text-app-muted text-sm">No matchups to show yet.</p>
          ) : (
            <MatchupsPanel
              rounds={rounds}
              canEdit={canEdit}
              updatingMatchId={updatingMatchId}
              onToggleWinner={handleToggleWinner}
              variant="compact"
            />
          )}
        </div>
      </div>

      {isFullscreen && matches.length > 0 && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto flex flex-col">
          <div className="border-b border-app-border bg-app-bg-subtle px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold">Matchups</h2>
              <p className="text-sm text-app-muted mt-0.5">
                {session.league_name || 'Session'} &middot; {session.player_count} players &middot;{' '}
                <ClientDateTime value={session.scheduled_for ?? session.created_at} />
              </p>
            </div>
            <Button variant="sm" onClick={toggleFullscreen}>
              Exit Full View
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-6 p-6 overflow-auto flex-1">
            <div className="overflow-auto">
              <SectionLabel>TEAMS</SectionLabel>
              <TeamsPanel teamStats={teamStats} hasMatches={matches.length > 0} />
              <div className="mt-6">
                <SectionLabel>PLAYERS</SectionLabel>
                <PlayersPanel
                  playerStats={playerStats}
                  matches={matches}
                  showEmptyState={false}
                />
              </div>
            </div>
            <div className="overflow-auto">
              <SectionLabel>MATCHUPS</SectionLabel>
              <MatchupsPanel
                rounds={rounds}
                canEdit={canEdit}
                updatingMatchId={updatingMatchId}
                onToggleWinner={handleToggleWinner}
                variant="fullscreen"
              />
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
              <Button variant="danger" onClick={handleDeleteSession} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </>
          }
        >
          <p>Are you sure you want to delete this session? This action cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
