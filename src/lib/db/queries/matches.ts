import { eq, inArray } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { chunkedInArray } from '../chunk';
import {
  matches,
  matchPlayers,
  matchResults,
  type Match,
  type NewMatch,
  type MatchPlayer,
  type NewMatchPlayer,
  type MatchResult,
} from '../schema';
import { AuthorizationError } from '../auth-helpers';
import { canManageSession, getSessionById } from './sessions';

async function requireSessionManager(callerId: string, sessionId: string): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session) throw new AuthorizationError(404, 'Session not found');
  if (!(await canManageSession(callerId, session))) {
    throw new AuthorizationError(403, 'Cannot manage matches for this session');
  }
}

export async function listMatchesForSession(sessionId: string): Promise<Match[]> {
  const db = await getDbAsync();
  return db.select().from(matches).where(eq(matches.sessionId, sessionId));
}

export async function listMatchesForSessions(sessionIds: string[]): Promise<Match[]> {
  if (sessionIds.length === 0) return [];
  const db = await getDbAsync();
  return chunkedInArray(sessionIds, (chunk) =>
    db.select().from(matches).where(inArray(matches.sessionId, chunk)),
  );
}

export async function getMatchById(id: string): Promise<Match | null> {
  const db = await getDbAsync();
  const rows = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listPlayersForMatches(matchIds: string[]): Promise<MatchPlayer[]> {
  if (matchIds.length === 0) return [];
  const db = await getDbAsync();
  return chunkedInArray(matchIds, (chunk) =>
    db.select().from(matchPlayers).where(inArray(matchPlayers.matchId, chunk)),
  );
}

export async function listResultsForMatches(matchIds: string[]): Promise<MatchResult[]> {
  if (matchIds.length === 0) return [];
  const db = await getDbAsync();
  return chunkedInArray(matchIds, (chunk) =>
    db.select().from(matchResults).where(inArray(matchResults.matchId, chunk)),
  );
}

export async function getResultForMatch(matchId: string): Promise<MatchResult | null> {
  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(matchResults)
    .where(eq(matchResults.matchId, matchId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Replace all matches and players for a session. Used when (re)generating teams
 * for a session. Wraps in db.batch for atomicity at the statement level.
 */
export async function replaceSessionMatches(
  callerId: string,
  sessionId: string,
  newMatches: Array<Omit<NewMatch, 'id' | 'sessionId' | 'createdAt'>>,
  newPlayers: Array<{
    matchIndex: number;
    userId?: string | null;
    guestId?: string | null;
    team: 1 | 2;
    position?: number;
  }>,
): Promise<{ matchIds: string[] }> {
  await requireSessionManager(callerId, sessionId);
  const db = await getDbAsync();

  const existingMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.sessionId, sessionId));
  const existingIds = existingMatches.map((m) => m.id);

  const matchIds = newMatches.map(() => crypto.randomUUID());
  const now = new Date().toISOString();

  const matchInserts = newMatches.map((m, idx) => ({
    id: matchIds[idx],
    sessionId,
    courtNumber: m.courtNumber ?? null,
    scheduledOrder: m.scheduledOrder ?? idx + 1,
    status: m.status ?? 'scheduled',
    createdAt: now,
  }));

  const playerInserts: NewMatchPlayer[] = newPlayers.map((p) => ({
    id: crypto.randomUUID(),
    matchId: matchIds[p.matchIndex],
    userId: p.userId ?? null,
    guestId: p.guestId ?? null,
    team: p.team,
    position: p.position ?? 0,
  }));

  const ops = [];
  if (existingIds.length > 0) {
    // Cascading FK deletes match_players + match_results rows
    ops.push(db.delete(matches).where(inArray(matches.id, existingIds)));
  }
  if (matchInserts.length > 0) {
    ops.push(db.insert(matches).values(matchInserts));
  }
  if (playerInserts.length > 0) {
    ops.push(db.insert(matchPlayers).values(playerInserts));
  }

  if (ops.length > 0) {
    // db.batch requires at least one statement; cast to satisfy the typed signature
    await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);
  }

  return { matchIds };
}

export async function upsertMatchResult(
  callerId: string,
  matchId: string,
  result: { team1Score: number | null; team2Score: number | null },
): Promise<void> {
  const match = await getMatchById(matchId);
  if (!match) throw new AuthorizationError(404, 'Match not found');
  await requireSessionManager(callerId, match.sessionId);
  const db = await getDbAsync();
  const now = new Date().toISOString();
  await db
    .insert(matchResults)
    .values({
      matchId,
      team1Score: result.team1Score,
      team2Score: result.team2Score,
      completedAt: now,
    })
    .onConflictDoUpdate({
      target: matchResults.matchId,
      set: {
        team1Score: result.team1Score,
        team2Score: result.team2Score,
        completedAt: now,
      },
    });
}

export async function updateMatchStatus(
  callerId: string,
  matchId: string,
  status: 'scheduled' | 'completed' | 'canceled',
): Promise<void> {
  const match = await getMatchById(matchId);
  if (!match) throw new AuthorizationError(404, 'Match not found');
  await requireSessionManager(callerId, match.sessionId);
  const db = await getDbAsync();
  await db.update(matches).set({ status }).where(eq(matches.id, matchId));
}
