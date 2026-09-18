import { eq } from 'drizzle-orm';
import { getDbAsync } from '../client';
import {
  gameSessions,
  sessionGuests,
  type GameSession,
  type NewGameSession,
  type SessionGuest,
} from '../schema';
import { AuthorizationError } from '../auth-helpers';
import { isLeagueOwner, isLeagueMember } from './leagues';

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

/**
 * Read access to a session. Broader than canManageSession: any league member
 * may view, not just the creator and league owner.
 *
 * `participantIds` are the user IDs already loaded from match_players. They
 * matter because `game_sessions.league_id` is ON DELETE SET NULL — deleting a
 * league orphans its sessions, and the people who played in them should keep
 * access to their own history even though there is no league left to join.
 */
export async function canViewSession(
  callerId: string,
  session: Pick<GameSession, 'createdBy' | 'leagueId'>,
  participantIds: ReadonlyArray<string | null>,
): Promise<boolean> {
  if (session.createdBy === callerId) return true;
  if (participantIds.includes(callerId)) return true;
  if (session.leagueId && (await isLeagueMember(session.leagueId, callerId))) return true;
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

/**
 * Insert a session's guests in one batch. Authorizes once — the answer cannot
 * change between rows — and generates IDs here so the caller gets them back in
 * input order without reading the rows back.
 */
export async function addGuests(
  callerId: string,
  sessionId: string,
  guests: ReadonlyArray<{ displayName: string; dupr: number }>,
): Promise<string[]> {
  if (guests.length === 0) return [];
  const session = await getSessionById(sessionId);
  if (!session) throw new AuthorizationError(404, 'Session not found');
  if (!(await canManageSession(callerId, session))) {
    throw new AuthorizationError(403, 'Cannot add guests to this session');
  }
  const db = await getDbAsync();
  const now = new Date().toISOString();
  const rows = guests.map((g) => ({
    id: crypto.randomUUID(),
    sessionId,
    displayName: g.displayName.trim(),
    dupr: g.dupr,
    createdAt: now,
  }));
  // 5 bound columns per row; 15 rows keeps each statement under D1's 100-param cap.
  const INSERT_CHUNK = 15;
  const ops = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    ops.push(db.insert(sessionGuests).values(rows.slice(i, i + INSERT_CHUNK)));
  }
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);
  return rows.map((r) => r.id);
}
