'use server';

import { requireUserId } from '@/lib/db/auth-helpers';
import { listLeaguesForUser } from '@/lib/db/queries/leagues';
import {
  listSessionsForUser,
  listResultsBySession,
  type UserSession,
} from '@/lib/db/queries/user-sessions';

export type HomeLeague = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string | null;
  memberCount: number;
  role: string;
};

export type HomeSession = UserSession;

export type LifetimeStats = {
  individualWins: number;
  individualLosses: number;
  teamWins: number;
  teamLosses: number;
  teamTies: number;
};

export async function getHomeData(): Promise<{
  leagues: HomeLeague[];
  sessions: HomeSession[];
  stats: LifetimeStats;
}> {
  const userId = await requireUserId();

  // Leagues: same rule as /leagues and the profile page (listLeaguesForUser).
  const leagues: HomeLeague[] = (await listLeaguesForUser(userId)).map((l) => ({
    id: l.id,
    name: l.name,
    ownerId: l.ownerId,
    createdAt: l.createdAt ?? null,
    memberCount: l.memberCount,
    role: l.role,
  }));

  // Sessions: owned OR participating
  const { sessions, participation } = await listSessionsForUser(userId);

  // Lifetime stats
  const userTeamByMatch = new Map(participation.map((p) => [p.matchId, p.team]));
  const userTeamBySession = new Map(participation.map((p) => [p.sessionId, p.team]));
  const resultRows = await listResultsBySession(Array.from(userTeamBySession.keys()));

  let individualWins = 0;
  let individualLosses = 0;
  for (const r of resultRows) {
    const team = userTeamByMatch.get(r.matchId);
    if (!team) continue;
    if (team === 1) {
      if (r.team1Score > r.team2Score) individualWins++;
      else if (r.team2Score > r.team1Score) individualLosses++;
    } else {
      if (r.team2Score > r.team1Score) individualWins++;
      else if (r.team1Score > r.team2Score) individualLosses++;
    }
  }

  // Team session totals: every match result in each session the user played in
  const sessionScores = new Map<string, { t1: number; t2: number; userTeam: number }>();
  for (const r of resultRows) {
    const userTeam = userTeamBySession.get(r.sessionId);
    if (!userTeam) continue;
    const cur = sessionScores.get(r.sessionId) ?? { t1: 0, t2: 0, userTeam };
    cur.t1 += r.team1Score;
    cur.t2 += r.team2Score;
    sessionScores.set(r.sessionId, cur);
  }

  let teamWins = 0;
  let teamLosses = 0;
  let teamTies = 0;
  for (const s of sessionScores.values()) {
    if (s.t1 > s.t2) {
      if (s.userTeam === 1) teamWins++;
      else teamLosses++;
    } else if (s.t2 > s.t1) {
      if (s.userTeam === 2) teamWins++;
      else teamLosses++;
    } else {
      teamTies++;
    }
  }

  return {
    leagues,
    sessions,
    stats: { individualWins, individualLosses, teamWins, teamLosses, teamTies },
  };
}
