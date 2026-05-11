'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { requireUserId } from '@/lib/db/auth-helpers';
import { getDbAsync } from '@/lib/db/client';
import { chunkedInArray } from '@/lib/db/chunk';
import {
  leagueMembers,
  leagues as leaguesTable,
  gameSessions,
  matches,
  matchPlayers,
  matchResults,
} from '@/lib/db/schema';

export type HomeLeague = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string | null;
  memberCount: number;
  role: string;
};

export type HomeSession = {
  id: string;
  leagueId: string | null;
  leagueName: string | null;
  createdBy: string;
  createdAt: string | null;
  scheduledFor: string | null;
  playerCount: number;
};

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
  const db = await getDbAsync();

  // Leagues
  const memberships = await db
    .select({
      leagueId: leagueMembers.leagueId,
      role: leagueMembers.role,
    })
    .from(leagueMembers)
    .where(eq(leagueMembers.userId, userId));

  const leagueIds = memberships.map((m) => m.leagueId);
  const leagueRows = await chunkedInArray(leagueIds, (chunk) =>
    db.select().from(leaguesTable).where(inArray(leaguesTable.id, chunk)),
  );

  const memberCountRows = await chunkedInArray(leagueIds, (chunk) =>
    db
      .select({ leagueId: leagueMembers.leagueId })
      .from(leagueMembers)
      .where(inArray(leagueMembers.leagueId, chunk)),
  );
  const counts = new Map<string, number>();
  for (const row of memberCountRows) {
    counts.set(row.leagueId, (counts.get(row.leagueId) ?? 0) + 1);
  }

  const leagues: HomeLeague[] = leagueRows.map((l) => {
    const m = memberships.find((mm) => mm.leagueId === l.id);
    return {
      id: l.id,
      name: l.name,
      ownerId: l.ownerId,
      createdAt: l.createdAt ?? null,
      memberCount: counts.get(l.id) ?? 0,
      role: m?.role ?? 'player',
    };
  });

  // Sessions: owned OR participating
  const ownedSessions = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.createdBy, userId));

  const playerRows = await db
    .select({ matchId: matchPlayers.matchId, team: matchPlayers.team })
    .from(matchPlayers)
    .where(eq(matchPlayers.userId, userId));

  const matchIds = Array.from(new Set(playerRows.map((p) => p.matchId)));
  const matchRows = await chunkedInArray(matchIds, (chunk) =>
    db.select().from(matches).where(inArray(matches.id, chunk)),
  );
  const sessionIdsFromMatches = Array.from(new Set(matchRows.map((m) => m.sessionId)));
  const participantSessions = await chunkedInArray(sessionIdsFromMatches, (chunk) =>
    db.select().from(gameSessions).where(inArray(gameSessions.id, chunk)),
  );

  const allSessions = new Map<string, (typeof gameSessions.$inferSelect)>();
  for (const s of [...ownedSessions, ...participantSessions]) {
    allSessions.set(s.id, s);
  }
  const sessionLeagueIds = Array.from(
    new Set(
      Array.from(allSessions.values())
        .map((s) => s.leagueId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const leagueNameRows = await chunkedInArray(sessionLeagueIds, (chunk) =>
    db
      .select({ id: leaguesTable.id, name: leaguesTable.name })
      .from(leaguesTable)
      .where(inArray(leaguesTable.id, chunk)),
  );
  const leagueNameMap = new Map(leagueNameRows.map((r) => [r.id, r.name]));

  const sessions: HomeSession[] = Array.from(allSessions.values())
    .map((s) => ({
      id: s.id,
      leagueId: s.leagueId,
      leagueName: s.leagueId ? leagueNameMap.get(s.leagueId) ?? null : null,
      createdBy: s.createdBy,
      createdAt: s.createdAt ?? null,
      scheduledFor: s.scheduledFor,
      playerCount: s.playerCount,
    }))
    .sort((a, b) => {
      const aTime = a.scheduledFor ?? a.createdAt;
      const bTime = b.scheduledFor ?? b.createdAt;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  // Lifetime stats
  const userTeamMap = new Map<string, number>();
  for (const p of playerRows) userTeamMap.set(p.matchId, p.team);

  const userMatchResults = await chunkedInArray(matchIds, (chunk) =>
    db.select().from(matchResults).where(inArray(matchResults.matchId, chunk)),
  );

  let individualWins = 0;
  let individualLosses = 0;
  for (const r of userMatchResults) {
    if (r.team1Score == null || r.team2Score == null) continue;
    const team = userTeamMap.get(r.matchId);
    if (!team) continue;
    if (team === 1) {
      if (r.team1Score > r.team2Score) individualWins++;
      else if (r.team2Score > r.team1Score) individualLosses++;
    } else {
      if (r.team2Score > r.team1Score) individualWins++;
      else if (r.team1Score > r.team2Score) individualLosses++;
    }
  }

  // Team session totals: aggregate all match results within sessions where user participated
  const userSessionIds = sessionIdsFromMatches;
  const userSessionTeams = new Map<string, number>();
  for (const m of matchRows) {
    const team = userTeamMap.get(m.id);
    if (team) userSessionTeams.set(m.sessionId, team);
  }

  const allMatchesInSessions = await chunkedInArray(userSessionIds, (chunk) =>
    db.select().from(matches).where(inArray(matches.sessionId, chunk)),
  );
  const allMatchIdsInSessions = allMatchesInSessions.map((m) => m.id);
  const allResultsInSessions = await chunkedInArray(allMatchIdsInSessions, (chunk) =>
    db.select().from(matchResults).where(inArray(matchResults.matchId, chunk)),
  );
  const matchToSession = new Map(allMatchesInSessions.map((m) => [m.id, m.sessionId]));

  const sessionScores = new Map<string, { t1: number; t2: number; userTeam: number }>();
  for (const r of allResultsInSessions) {
    if (r.team1Score == null || r.team2Score == null) continue;
    const sessionId = matchToSession.get(r.matchId);
    if (!sessionId) continue;
    const userTeam = userSessionTeams.get(sessionId);
    if (!userTeam) continue;
    const cur = sessionScores.get(sessionId) ?? { t1: 0, t2: 0, userTeam };
    cur.t1 += r.team1Score;
    cur.t2 += r.team2Score;
    sessionScores.set(sessionId, cur);
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

// Suppress unused import warnings if any
void and;
