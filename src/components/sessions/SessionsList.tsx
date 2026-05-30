'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClientDateTime } from '@/components/ClientDateTime';
import type { SessionListItem } from '@/lib/actions/sessions';

type SessionsListProps = {
  sessions: SessionListItem[];
  sessionResults: Record<string, { teamGreenWins: number; teamBlueWins: number }>;
  userId: string;
  sessionsLoading: boolean;
  hasLeagues: boolean;
};

export function SessionsList({
  sessions,
  sessionResults,
  userId,
  sessionsLoading,
  hasLeagues,
}: SessionsListProps) {
  const nowTime = new Date().getTime();
  const cutoffTime = nowTime - 12 * 60 * 60 * 1000;
  const enriched = sessions.map((session) => {
    const effective = session.scheduledFor ?? session.createdAt;
    const time = effective ? new Date(effective).getTime() : Number.NaN;
    return { session, time };
  });

  const upcomingSessions = enriched
    .filter((item) => !Number.isNaN(item.time) && item.time >= cutoffTime)
    .sort((a, b) => a.time - b.time)
    .map((item) => item.session);

  const pastSessions = enriched
    .filter((item) => Number.isNaN(item.time) || item.time < cutoffTime)
    .sort((a, b) => {
      const aNaN = Number.isNaN(a.time);
      const bNaN = Number.isNaN(b.time);
      if (aNaN && bNaN) return 0;
      if (aNaN) return 1;
      if (bNaN) return -1;
      return b.time - a.time;
    })
    .map((item) => item.session);

  return (
    <div className="mt-10 border-t border-app-border pt-8">
      {sessionsLoading ? (
        <p className="text-app-muted text-sm">Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p className="text-app-muted text-sm">
          {hasLeagues
            ? 'No sessions yet. Create one above to see it here.'
            : "No sessions yet. You'll see sessions you play in here."}
        </p>
      ) : (
        <>
          {upcomingSessions.length > 0 && (
            <div className={pastSessions.length ? 'mb-10' : ''}>
              <SectionLabel>CURRENT / UPCOMING</SectionLabel>
              <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-app-text">
                        {session.leagueName || 'Unknown league'} &mdash; {session.playerCount}{' '}
                        players
                      </div>
                      <div className="text-app-muted text-sm mt-0.5">
                        <ClientDateTime value={session.scheduledFor ?? session.createdAt} />
                      </div>
                    </div>
                    <Link
                      href={`/sessions/${session.id}`}
                      prefetch={false}
                      className="no-underline"
                    >
                      <Button variant="sm" arrow>
                        {session.createdBy === userId ? 'Manage' : 'View'}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pastSessions.length > 0 && (
            <div>
              <SectionLabel>PAST SESSIONS</SectionLabel>
              <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                {pastSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-app-text">
                        {session.leagueName || 'Unknown league'} &mdash; {session.playerCount}{' '}
                        players
                      </div>
                      <div className="text-app-muted text-sm mt-0.5">
                        <ClientDateTime value={session.scheduledFor ?? session.createdAt} />
                      </div>
                      {(() => {
                        const summary = sessionResults[session.id];
                        if (!summary) return null;
                        const green = summary.teamGreenWins;
                        const blue = summary.teamBlueWins;
                        if (green === 0 && blue === 0) return null;
                        let label: string;
                        let colorClass: string;
                        if (green > blue) {
                          label = `Team Green won ${green}-${blue}`;
                          colorClass = 'text-team-green';
                        } else if (blue > green) {
                          label = `Team Blue won ${blue}-${green}`;
                          colorClass = 'text-team-blue';
                        } else {
                          label = `Teams tied ${green}-${blue}`;
                          colorClass = 'text-app-muted';
                        }
                        return (
                          <span
                            className={`font-mono text-[0.65rem] uppercase tracking-button mt-1 inline-block ${colorClass}`}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <Link
                      href={`/sessions/${session.id}`}
                      prefetch={false}
                      className="no-underline"
                    >
                      <Button variant="sm" arrow>
                        {session.createdBy === userId ? 'Manage' : 'View'}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
