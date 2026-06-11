'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { formatLeagueName } from '@/lib/formatters';
import { ClientDateTime } from '@/components/ClientDateTime';
import {
  getHomeData,
  type HomeLeague,
  type HomeSession,
  type LifetimeStats,
} from '@/lib/actions/home';

const EMPTY_STATS: LifetimeStats = {
  individualWins: 0,
  individualLosses: 0,
  teamWins: 0,
  teamLosses: 0,
  teamTies: 0,
};

export default function HomePage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  // Depend on the stable user id, not the user object: Clerk hands back a new
  // user object reference on every ~60s token refresh, which would otherwise
  // re-run this effect and visibly reload the page.
  const userId = user?.id ?? null;
  const [leagues, setLeagues] = useState<HomeLeague[]>([]);
  const [sessions, setSessions] = useState<HomeSession[]>([]);
  const [stats, setStats] = useState<LifetimeStats>(EMPTY_STATS);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setLeagues([]);
      setSessions([]);
      setStats(EMPTY_STATS);
      return;
    }
    let active = true;
    setLeaguesLoading(true);
    setSessionsLoading(true);
    (async () => {
      try {
        const data = await getHomeData();
        if (!active) return;
        const sortedLeagues = [...data.leagues].sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        setLeagues(sortedLeagues);
        setSessions(data.sessions);
        setStats(data.stats);
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load home data.';
        setLeaguesError(msg);
        setSessionsError(msg);
      } finally {
        if (active) {
          setLeaguesLoading(false);
          setSessionsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  const upcomingSessions = useMemo(() => {
    const nowTime = new Date().getTime();
    const cutoffTime = nowTime - 12 * 60 * 60 * 1000;
    return sessions
      .map((session) => {
        const effective = session.scheduledFor ?? session.createdAt ?? null;
        const time = effective ? new Date(effective).getTime() : Number.NaN;
        return { session, time };
      })
      .filter((item) => !Number.isNaN(item.time) && item.time >= cutoffTime)
      .sort((a, b) => a.time - b.time)
      .map((item) => item.session);
  }, [sessions]);

  const showCtas = isLoaded && !user;
  const showPersonalizedContent = isLoaded && !!user;

  return (
    <section>
      <div className="pb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-3">Pickled Citizens</h1>
        <p className="text-sm text-app-muted max-w-lg leading-relaxed">
          A lightweight web app for setting up team battle matchups for your league&apos;s
          pickleball sessions.
        </p>
        {showCtas && (
          <div className="flex flex-wrap gap-3 mt-5">
            <Link href="/auth" className="no-underline">
              <Button variant="primary" arrow>
                Get Started
              </Button>
            </Link>
            <Link href="/auth/signin" className="no-underline">
              <Button variant="secondary">Sign In</Button>
            </Link>
          </div>
        )}
      </div>

      {showPersonalizedContent && (
        <>
          <div className="border-t border-app-border pt-8 pb-8">
            <SectionLabel>Your Leagues</SectionLabel>
            <div className="mt-4">
              {leaguesError ? (
                <p className="text-app-danger text-sm">{leaguesError}</p>
              ) : leaguesLoading ? (
                <p className="text-app-muted text-sm">Loading leagues...</p>
              ) : leagues.length === 0 ? (
                <p className="text-app-muted text-sm">
                  You are not a member of any leagues yet. Visit the{' '}
                  <Link href="/leagues">leagues page</Link> to create or join one.
                </p>
              ) : (
                <div className="divide-y divide-app-border">
                  {leagues.map((league) => (
                    <div
                      key={league.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {formatLeagueName(league.name, league.createdAt ?? '')}
                        </div>
                        <div className="text-xs text-app-muted mt-0.5">
                          {league.memberCount}{' '}
                          {league.memberCount === 1 ? 'member' : 'members'}
                        </div>
                      </div>
                      <Button
                        variant="sm"
                        arrow
                        onClick={() => router.push(`/leagues/${league.id}`)}
                      >
                        {league.ownerId === userId ? 'Manage' : 'View'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-app-border pt-8 pb-8">
            <SectionLabel>Upcoming Sessions</SectionLabel>
            <div className="mt-4">
              {sessionsError ? (
                <p className="text-app-danger text-sm">{sessionsError}</p>
              ) : sessionsLoading ? (
                <p className="text-app-muted text-sm">Loading sessions...</p>
              ) : upcomingSessions.length === 0 ? (
                <p className="text-app-muted text-sm">No upcoming sessions.</p>
              ) : (
                <div className="divide-y divide-app-border">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {session.leagueName || 'Unknown league'} &middot;{' '}
                          {session.playerCount} players
                        </div>
                        <div className="text-xs text-app-muted mt-0.5">
                          <ClientDateTime value={session.scheduledFor ?? session.createdAt} />
                        </div>
                      </div>
                      <Button
                        variant="sm"
                        arrow
                        onClick={() => router.push(`/sessions/${session.id}`)}
                      >
                        {session.createdBy === userId ? 'Manage' : 'View'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Link
                  href="/sessions"
                  className="text-sm text-app-muted hover:text-app-text transition-colors"
                >
                  View all sessions &rarr;
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-app-border pt-8 pb-8">
            <SectionLabel>Your Stats</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mt-4">
              <div className="border border-app-border p-5">
                <div className="section-label mb-2">Individual Record</div>
                <div className="font-display text-3xl font-bold tracking-tight">
                  {stats.individualWins}-{stats.individualLosses}
                </div>
                <div className="text-xs text-app-muted mt-1">
                  {stats.individualWins + stats.individualLosses} games played
                </div>
              </div>
              <div className="border border-app-border p-5">
                <div className="section-label mb-2">Team Record</div>
                <div className="font-display text-3xl font-bold tracking-tight">
                  {stats.teamWins}-{stats.teamLosses}-{stats.teamTies}
                </div>
                <div className="text-xs text-app-muted mt-1">
                  {stats.teamWins + stats.teamLosses + stats.teamTies} sessions
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="border-t border-app-border pt-8 pb-8">
        <SectionLabel>v1.0.0 Release</SectionLabel>
        <div className="mt-4">
          <p className="text-sm font-medium text-app-text mb-2">Release highlights</p>
          <ul className="pl-4 text-sm text-app-muted leading-relaxed space-y-1">
            <li>
              Email signup using magic link or password, plus player name and self-assessed DUPR
              rating
            </li>
            <li>Create and manage leagues, with a central view of all member details</li>
            <li>
              Schedule sessions for 6, 8, 10, or 12 players and auto-generate balanced doubles
              matchups
            </li>
            <li>Record results and track both team and individual win-loss records over time</li>
          </ul>
          <p className="text-sm font-medium text-app-text mb-2 mt-6">Coming soon</p>
          <ul className="pl-4 text-sm text-app-muted leading-relaxed space-y-1">
            <li>Email notifications for players and league admins</li>
            <li>League email invitation flow</li>
            <li>Session-specific invitation flow</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-app-border pt-8 pb-4 text-center">
        <a
          href="https://www.buymeacoffee.com/hunkim"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/images/buymeacoffee.png"
            alt="Buy Me A Coffee"
            width={135}
            height={38}
            unoptimized
            className="inline-block"
          />
        </a>
      </div>
    </section>
  );
}
