'use client';

import { useState } from 'react';
import { SectionLabel } from '@/components/ui/SectionLabel';

/**
 * Release history for the home page. Newest first; only the newest is shown
 * in full, the rest sit behind a "Show earlier releases" toggle so the list
 * can grow without pushing the footer down. Add a new release at the top.
 */
const RELEASES: Array<{ version: string; highlights: string[] }> = [
  {
    version: 'v1.1.0',
    highlights: [
      'League rankings board on every league page, ranked by win percentage once a player has 15 games; everyone else is listed below with their progress',
      'Top 3 rivals under each player: the opponent across the net in every game of a session, with the head-to-head record, closest matchups first',
      'Add one-off guest players to a session without a full account',
      'Rankings read cleanly on a phone',
    ],
  },
  {
    version: 'v1.0.0',
    highlights: [
      'Email signup using magic link or password, plus player name and self-assessed DUPR rating',
      'Create and manage leagues, with a central view of all member details',
      'Schedule sessions for 6, 8, 10, or 12 players and auto-generate balanced doubles matchups',
      'Record results and track both team and individual win-loss records over time',
    ],
  },
];

const COMING_SOON = [
  'Email notifications for players and league admins',
  'League email invitation flow',
  'Session-specific invitation flow',
];

export function ReleaseNotes() {
  const [showEarlier, setShowEarlier] = useState(false);
  const [latest, ...earlier] = RELEASES;

  return (
    <div className="border-t border-app-border pt-8 pb-8">
      <Release version={latest.version} highlights={latest.highlights} />

      {earlier.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowEarlier((v) => !v)}
            aria-expanded={showEarlier}
            className="font-mono text-xs uppercase tracking-button text-app-muted hover:text-app-text transition-colors"
          >
            {showEarlier
              ? 'Hide earlier releases'
              : `Show ${earlier.length} earlier ${earlier.length === 1 ? 'release' : 'releases'}`}
          </button>
          {showEarlier && (
            <div className="mt-6 space-y-8">
              {earlier.map((r) => (
                <Release key={r.version} version={r.version} highlights={r.highlights} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <p className="text-sm font-medium text-app-text mb-2">Coming soon</p>
        <ul className="pl-4 text-sm text-app-muted leading-relaxed space-y-1">
          {COMING_SOON.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Release({ version, highlights }: { version: string; highlights: string[] }) {
  return (
    <div>
      <SectionLabel>{version} Release</SectionLabel>
      <div className="mt-4">
        <p className="text-sm font-medium text-app-text mb-2">Release highlights</p>
        <ul className="pl-4 text-sm text-app-muted leading-relaxed space-y-1">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
