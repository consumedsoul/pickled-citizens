'use client';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { displayPlayerName, displayPlayerNameShort } from '@/lib/formatters';
import {
  formatWinPct,
  rankedPlayers,
  unrankedPlayers,
  RANKED_MIN_GAMES,
  RIVALS_SHOWN,
} from '@/lib/standings';
import type { StandingRow } from '@/lib/actions/leagues';

type Props = {
  standings: StandingRow[];
  gamesCounted: number;
  hasRecentSession: boolean;
  loading: boolean;
  error: string | null;
  viewerId: string | null;
};

/**
 * The league board. Two tables from one standings list:
 *   - Rankings: players with RANKED_MIN_GAMES or more, best win % first.
 *   - Not yet ranked: everyone else, most games first, then first name.
 * Each row carries the player's closest rivals (counterparts across the net).
 */
export function LeagueStandings({
  standings,
  gamesCounted,
  hasRecentSession,
  loading,
  error,
  viewerId,
}: Props) {
  const ranked = rankedPlayers(standings);
  const unranked = unrankedPlayers(standings, (p) => p.firstName);

  return (
    <div className="border-t border-app-border mt-6 pt-6">
      <SectionLabel>Rankings</SectionLabel>
      <p className="text-sm text-app-muted mt-2">
        Ranked by win percentage. Players join the board after {RANKED_MIN_GAMES} games. Under
        each name are their top {RIVALS_SHOWN} rivals: the player across the net from them in
        every game of a session, with the head-to-head record, closest to even first.
      </p>

      {loading && <p className="text-app-muted text-sm mt-4">Calculating rankings...</p>}
      {!loading && error && <p className="text-app-danger text-sm mt-4">{error}</p>}
      {!loading && !error && standings.length === 0 && (
        <p className="text-app-muted text-sm mt-4">
          No scored games yet. Rankings appear once a session has results entered.
        </p>
      )}

      {!loading && !error && standings.length > 0 && (
        <>
          {ranked.length === 0 ? (
            <p className="text-app-muted text-sm mt-4">
              Nobody has reached {RANKED_MIN_GAMES} games yet. The board fills in as sessions
              are played.
            </p>
          ) : (
            <StandingsTable
              rows={ranked}
              ranked
              hasRecentSession={hasRecentSession}
              viewerId={viewerId}
              testId="league-standings"
            />
          )}

          {unranked.length > 0 && (
            <div className="mt-8">
              <SectionLabel>Not Yet Ranked ({unranked.length})</SectionLabel>
              <p className="text-sm text-app-muted mt-2">
                Fewer than {RANKED_MIN_GAMES} games so far. Sorted by games played, closest to
                qualifying first.
              </p>
              <StandingsTable
                rows={unranked}
                ranked={false}
                hasRecentSession={hasRecentSession}
                viewerId={viewerId}
                testId="league-unranked"
              />
            </div>
          )}

          <p className="text-xs text-app-muted mt-3">
            {gamesCounted} scored {gamesCounted === 1 ? 'game' : 'games'} counted. Guests are
            not ranked and do not count as rivals.
          </p>
        </>
      )}
    </div>
  );
}

function StandingsTable({
  rows,
  ranked,
  hasRecentSession,
  viewerId,
  testId,
}: {
  rows: StandingRow[];
  ranked: boolean;
  hasRecentSession: boolean;
  viewerId: string | null;
  testId: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse" data-testid={testId}>
        <thead>
          <tr className="font-mono text-[0.65rem] uppercase tracking-button text-app-muted text-left">
            <th className="py-2 pr-2 font-medium w-8">{ranked ? '#' : ''}</th>
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="py-2 pr-2 font-medium text-right">Win %</th>
            <th className="py-2 pr-2 font-medium text-right">W–L</th>
            {!ranked && <th className="py-2 pr-2 font-medium text-right">Games</th>}
            <th
              className="py-2 font-medium text-right"
              title="Record in the most recent session"
            >
              Last
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border border-t border-b border-app-border">
          {rows.map((row, index) => {
            const isViewer = row.userId === viewerId;
            const name = displayPlayerName({
              first_name: row.firstName,
              last_name: row.lastName,
              email: row.email,
            });
            const playedLast = row.lastWins + row.lastLosses > 0;
            return (
              <tr key={row.userId} className={isViewer ? 'bg-app-border/20' : undefined}>
                <td className="py-2.5 pr-2 font-mono text-app-muted align-top">
                  {ranked ? index + 1 : '–'}
                </td>
                <td className="py-2.5 pr-2 align-top">
                  <div className={`font-medium text-app-text ${isViewer ? 'underline' : ''}`}>
                    {name}
                  </div>
                  {row.rivals.length > 0 && (
                    <div className="mt-0.5 text-xs text-app-muted">
                      <span className="font-mono uppercase tracking-button text-[0.6rem] mr-1.5">
                        Rivals
                      </span>
                      {row.rivals.map((r, i) => (
                        <span key={r.userId} className="whitespace-nowrap">
                          {i > 0 && <span className="mx-1.5">·</span>}
                          {displayPlayerNameShort({
                            first_name: r.firstName,
                            last_name: r.lastName,
                            email: r.email,
                          })}{' '}
                          <span className="font-mono text-app-text">
                            {r.wins}–{r.losses}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td
                  className={`py-2.5 pr-2 text-right font-mono align-top ${
                    ranked ? 'font-semibold text-app-text' : 'text-app-muted'
                  }`}
                >
                  {formatWinPct(row.winPct)}
                </td>
                <td className="py-2.5 pr-2 text-right font-mono align-top">
                  {row.wins}–{row.losses}
                </td>
                {!ranked && (
                  <td className="py-2.5 pr-2 text-right font-mono align-top">
                    {row.games}
                    <span className="text-app-muted"> / {RANKED_MIN_GAMES}</span>
                  </td>
                )}
                <td className="py-2.5 text-right font-mono text-app-muted align-top">
                  {hasRecentSession && playedLast ? `${row.lastWins}–${row.lastLosses}` : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
