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
        every game of a session, with the head-to-head record. Closest to even lists first,
        and more games count as stronger evidence, so a 12–12 beats a 2–2.
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
  // table-fixed so the Player column wraps instead of pushing the numbers
  // off a phone screen; the narrow columns get explicit widths.
  return (
    <div className="mt-4">
      <table className="w-full table-fixed text-sm border-collapse" data-testid={testId}>
        <colgroup>
          <col className="w-7" />
          <col />
          <col className="w-16 sm:w-20" />
          {!ranked && <col className="hidden sm:table-column sm:w-20" />}
          <col className="hidden sm:table-column sm:w-14" />
        </colgroup>
        <thead>
          <tr className="font-mono text-[0.65rem] uppercase tracking-button text-app-muted text-left">
            <th className="py-2 pr-1 font-medium">{ranked ? '#' : ''}</th>
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="py-2 font-medium text-right">Record</th>
            {!ranked && (
              <th className="py-2 pl-2 font-medium text-right hidden sm:table-cell">Games</th>
            )}
            <th
              className="py-2 pl-2 font-medium text-right hidden sm:table-cell"
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
                <td className="py-2.5 pr-1 font-mono text-app-muted align-top">
                  {ranked ? index + 1 : '–'}
                </td>
                <td className="py-2.5 pr-2 align-top min-w-0">
                  <div
                    className={`font-medium text-app-text break-words ${
                      isViewer ? 'underline' : ''
                    }`}
                  >
                    {name}
                  </div>
                  {row.rivals.length > 0 && (
                    <div className="mt-1 text-xs text-app-muted leading-5">
                      <span className="font-mono uppercase tracking-button text-[0.6rem] mr-2">
                        Rivals
                      </span>
                      {row.rivals.map((r) => (
                        <span key={r.userId} className="inline-block whitespace-nowrap mr-3">
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
                  {!ranked && (
                    <div className="mt-0.5 text-xs text-app-muted font-mono sm:hidden">
                      {row.games} / {RANKED_MIN_GAMES} games
                    </div>
                  )}
                </td>
                <td className="py-2.5 text-right align-top">
                  <div
                    className={`font-mono ${
                      ranked ? 'font-semibold text-app-text' : 'text-app-muted'
                    }`}
                  >
                    {formatWinPct(row.winPct)}
                  </div>
                  <div className="font-mono text-xs text-app-muted">
                    {row.wins}–{row.losses}
                  </div>
                </td>
                {!ranked && (
                  <td className="py-2.5 pl-2 text-right font-mono align-top hidden sm:table-cell">
                    {row.games}
                    <span className="text-app-muted"> / {RANKED_MIN_GAMES}</span>
                  </td>
                )}
                <td className="py-2.5 pl-2 text-right font-mono text-app-muted align-top hidden sm:table-cell">
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
