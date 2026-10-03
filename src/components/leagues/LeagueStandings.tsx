'use client';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { displayPlayerName } from '@/lib/formatters';
import { formatDelta, formatRating, PROVISIONAL_GAMES } from '@/lib/rating';
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
 * The league ranking board. Rows come pre-sorted (best first) from the
 * rating engine; this component only renders them.
 */
export function LeagueStandings({
  standings,
  gamesCounted,
  hasRecentSession,
  loading,
  error,
  viewerId,
}: Props) {
  return (
    <div className="border-t border-app-border mt-6 pt-6">
      <SectionLabel>Rankings</SectionLabel>
      <p className="text-sm text-app-muted mt-2">
        Everyone starts at 1000. Points move after every recorded game based on who you beat
        and who you lost to, so beating a stronger pair is worth more than beating a weaker
        one. Margin counts a little. Players under {PROVISIONAL_GAMES} games are still settling.
      </p>

      {loading && <p className="text-app-muted text-sm mt-4">Calculating rankings...</p>}
      {!loading && error && <p className="text-app-danger text-sm mt-4">{error}</p>}
      {!loading && !error && standings.length === 0 && (
        <p className="text-app-muted text-sm mt-4">
          No scored games yet. Rankings appear once a session has results entered.
        </p>
      )}

      {!loading && !error && standings.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse" data-testid="league-standings">
            <thead>
              <tr className="font-mono text-[0.65rem] uppercase tracking-button text-app-muted text-left">
                <th className="py-2 pr-2 font-medium w-8">#</th>
                <th className="py-2 pr-2 font-medium">Player</th>
                <th className="py-2 pr-2 font-medium text-right">Rating</th>
                <th className="py-2 pr-2 font-medium text-right" title="Change over the most recent session">
                  Last
                </th>
                <th className="py-2 pr-2 font-medium text-right">W–L</th>
                <th className="py-2 pr-2 font-medium text-right">Win %</th>
                <th className="py-2 font-medium text-right hidden sm:table-cell">Pts +/−</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border border-t border-b border-app-border">
              {standings.map((row, index) => {
                const isViewer = row.userId === viewerId;
                const name = displayPlayerName({
                  first_name: row.firstName,
                  last_name: row.lastName,
                  email: row.email,
                });
                const winPct = row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0;
                const diff = row.pointsFor - row.pointsAgainst;
                const delta = Math.round(row.recentDelta);
                return (
                  <tr key={row.userId} className={isViewer ? 'bg-app-border/20' : undefined}>
                    <td className="py-2.5 pr-2 font-mono text-app-muted">{index + 1}</td>
                    <td className="py-2.5 pr-2">
                      <span className={`font-medium text-app-text ${isViewer ? 'underline' : ''}`}>
                        {name}
                      </span>
                      {row.provisional && (
                        <span
                          className="ml-2 inline-block font-mono text-[0.55rem] uppercase tracking-button px-1 py-0.5 border border-app-border text-app-muted align-middle"
                          title={`Fewer than ${PROVISIONAL_GAMES} games`}
                        >
                          new
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono font-semibold text-app-text">
                      {formatRating(row.rating)}
                    </td>
                    <td
                      className={`py-2.5 pr-2 text-right font-mono ${
                        !hasRecentSession || delta === 0
                          ? 'text-app-muted'
                          : delta > 0
                            ? 'text-green-700'
                            : 'text-app-danger'
                      }`}
                    >
                      {hasRecentSession ? formatDelta(row.recentDelta) : '–'}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono">
                      {row.wins}–{row.losses}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono">{winPct}%</td>
                    <td className="py-2.5 text-right font-mono text-app-muted hidden sm:table-cell">
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-app-muted mt-2">
            {gamesCounted} scored {gamesCounted === 1 ? 'game' : 'games'} counted. Guests play
            as a fixed 1000 and are not ranked.
          </p>
        </div>
      )}
    </div>
  );
}
