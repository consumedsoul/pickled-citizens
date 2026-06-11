'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { CreateSessionForm, type LeagueOption } from '@/components/sessions/CreateSessionForm';
import { SessionsList } from '@/components/sessions/SessionsList';
import {
  getSessionsListData,
  type SessionListItem,
} from '@/lib/actions/sessions';

export default function SessionsPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();

  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionResults, setSessionResults] = useState<
    Record<string, { teamGreenWins: number; teamBlueWins: number }>
  >({});
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace('/auth/signin');
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setSessionsLoading(true);
      setError(null);
      try {
        const data = await getSessionsListData();
        if (!active) return;
        setLeagues(data.ownedLeagues.map((l) => ({ id: l.id, name: l.name })));
        const sorted = [...data.sessions].sort((a, b) => {
          const aTime = a.scheduledFor ?? a.createdAt;
          const bTime = b.scheduledFor ?? b.createdAt;
          if (!aTime && !bTime) return 0;
          if (!aTime) return 1;
          if (!bTime) return -1;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        setSessions(sorted);
        setSessionResults(data.results);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load sessions.');
      } finally {
        if (active) {
          setLoading(false);
          setSessionsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, userId, router]);

  if (loading || !isLoaded) {
    return (
      <div className="mt-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
        <p className="text-app-muted text-sm">Loading your sessions...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mt-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
        <p className="text-app-muted text-sm">You must be signed in to create sessions.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
      {userEmail && (
        <p className="text-app-muted text-sm mb-4">Signed in as {userEmail}</p>
      )}
      {error && <p className="text-app-danger text-sm mb-4">{error}</p>}
      {!error && (
        <p className="text-app-muted text-sm mb-6">
          {leagues.length
            ? 'Create a session for one of your leagues, pick 6 / 8 / 10 / 12 players, and generate balanced teams and matchups.'
            : 'You do not own any leagues yet. You can still view sessions you play in below.'}
        </p>
      )}

      {leagues.length > 0 && <CreateSessionForm leagues={leagues} userId={userId} />}

      <SessionsList
        sessions={sessions}
        sessionResults={sessionResults}
        userId={userId}
        sessionsLoading={sessionsLoading}
        hasLeagues={leagues.length > 0}
      />
    </div>
  );
}
