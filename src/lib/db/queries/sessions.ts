import { eq, inArray } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { chunkedInArray } from '../chunk';
import {
  gameSessions,
  sessionGuests,
  type GameSession,
  type NewGameSession,
  type SessionGuest,
} from '../schema';
import { AuthorizationError } from '../auth-helpers';
import { isLeagueOwner } from './leagues';

export async function listSessionsForLeagues(leagueIds: string[]): Promise<GameSession[]> {
  if (leagueIds.length === 0) return [];
  const db = await getDbAsync();
  return chunkedInArray(leagueIds, (chunk) =>
    db.select().from(gameSessions).where(inArray(gameSessions.leagueId, chunk)),
  );
}

export async function getSessionById(id: string): Promise<GameSession | null> {
  const db = await getDbAsync();
  const rows = await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function canManageSession(
  callerId: string,
  session: Pick<GameSession, 'createdBy' | 'leagueId'>,
): Promise<boolean> {
  if (session.createdBy === callerId) return true;
  if (session.leagueId && (await isLeagueOwner(session.leagueId, callerId))) return true;
  return false;
}

export async function createSession(
  callerId: string,
  input: Omit<NewGameSession, 'id' | 'createdBy' | 'createdAt'>,
): Promise<GameSession> {
  const db = await getDbAsync();
  const id = crypto.randomUUID();
  await db.insert(gameSessions).values({
    id,
    createdBy: callerId,
    createdAt: new Date().toISOString(),
    ...input,
  });
  const created = await getSessionById(id);
  if (!created) throw new Error('Failed to create session');
  return created;
}

export async function updateSession(
  callerId: string,
  sessionId: string,
  patch: Partial<Omit<NewGameSession, 'id' | 'createdBy' | 'createdAt'>>,
): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session) throw new AuthorizationError(404, 'Session not found');
  if (!(await canManageSession(callerId, session))) {
    throw new AuthorizationError(403, 'Cannot manage this session');
  }
  const db = await getDbAsync();
  await db.update(gameSessions).set(patch).where(eq(gameSessions.id, sessionId));
}

export async function deleteSession(callerId: string, sessionId: string): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session) return;
  if (!(await canManageSession(callerId, session))) {
    throw new AuthorizationError(403, 'Cannot delete this session');
  }
  const db = await getDbAsync();
  await db.delete(gameSessions).where(eq(gameSessions.id, sessionId));
}

// ---- Session guests ----

export async function listGuestsForSession(sessionId: string): Promise<SessionGuest[]> {
  const db = await getDbAsync();
  return db.select().from(sessionGuests).where(eq(sessionGuests.sessionId, sessionId));
}

export async function addGuest(
  callerId: string,
  input: { sessionId: string; displayName: string; dupr: number },
): Promise<SessionGuest> {
  const session = await getSessionById(input.sessionId);
  if (!session) throw new AuthorizationError(404, 'Session not found');
  if (!(await canManageSession(callerId, session))) {
    throw new AuthorizationError(403, 'Cannot add guests to this session');
  }
  const db = await getDbAsync();
  const id = crypto.randomUUID();
  await db.insert(sessionGuests).values({
    id,
    sessionId: input.sessionId,
    displayName: input.displayName.trim(),
    dupr: input.dupr,
    createdAt: new Date().toISOString(),
  });
  const rows = await db.select().from(sessionGuests).where(eq(sessionGuests.id, id)).limit(1);
  if (!rows[0]) throw new Error('Failed to add guest');
  return rows[0];
}

export async function removeGuest(callerId: string, guestId: string): Promise<void> {
  const db = await getDbAsync();
  const rows = await db
    .select({ sessionId: sessionGuests.sessionId })
    .from(sessionGuests)
    .where(eq(sessionGuests.id, guestId))
    .limit(1);
  const guest = rows[0];
  if (!guest) return;
  const session = await getSessionById(guest.sessionId);
  if (!session) return;
  if (!(await canManageSession(callerId, session))) {
    throw new AuthorizationError(403, 'Cannot remove guests from this session');
  }
  await db.delete(sessionGuests).where(eq(sessionGuests.id, guestId));
}
