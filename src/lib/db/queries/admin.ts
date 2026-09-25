import { count, desc, eq, like } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { adminEvents, leagueMembers, leagues, profiles, type AdminEvent } from '../schema';
import { encodeJson, decodeJson, type Json } from '../json';

export type AdminEventOut = Omit<AdminEvent, 'payload'> & { payload: Json | null };

export async function listAdminEvents(
  options: { limit?: number; offset?: number; eventType?: string } = {},
): Promise<AdminEventOut[]> {
  const db = await getDbAsync();
  // The event-type filter must be applied in SQL, not after slicing a page —
  // filtering an already-paginated page silently returns fewer rows than exist.
  const rows = await db
    .select()
    .from(adminEvents)
    .where(options.eventType ? eq(adminEvents.eventType, options.eventType) : undefined)
    .orderBy(desc(adminEvents.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
  return rows.map((r) => ({ ...r, payload: decodeJson(r.payload) }));
}

/**
 * Every event type that has actually been logged, for the /admin/events filter.
 * Derived rather than hardcoded: a literal list drifted to 5 of 13 types and
 * hid both `*_failed` events, the ones that need manual cleanup.
 */
export async function listAdminEventTypes(): Promise<string[]> {
  const db = await getDbAsync();
  const rows = await db
    .selectDistinct({ eventType: adminEvents.eventType })
    .from(adminEvents)
    .orderBy(adminEvents.eventType);
  return rows.map((r) => r.eventType);
}

/**
 * Count of `*_failed` events (e.g. a user whose app data was deleted but whose
 * Clerk account survived). Each one needs a manual look.
 */
export async function countFailedAdminEvents(): Promise<number> {
  const db = await getDbAsync();
  const rows = await db
    .select({ n: count() })
    .from(adminEvents)
    .where(like(adminEvents.eventType, '%failed'));
  return rows[0]?.n ?? 0;
}

export async function logAdminEvent(input: {
  eventType: string;
  userId?: string | null;
  userEmail?: string | null;
  leagueId?: string | null;
  payload?: Json | null;
}): Promise<void> {
  // Never throws: callers log after their primary write has landed, and a
  // failed audit row must not turn a successful create/delete into an error.
  try {
    const db = await getDbAsync();
    await db.insert(adminEvents).values({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      eventType: input.eventType,
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      leagueId: input.leagueId ?? null,
      payload: encodeJson(input.payload ?? null),
    });
  } catch (err) {
    console.error(`logAdminEvent(${input.eventType}) failed:`, err);
  }
}

/**
 * Delete a user's app data: their league memberships, the leagues they own
 * (sessions in those leagues keep existing with league_id set to NULL), and
 * their profile row.
 *
 * Deliberately NOT deleted: game_sessions.created_by and match_players.user_id
 * still hold the user's ID so other players keep their match history. Those
 * columns are plain text (Clerk IDs, no FK), and the UI renders the missing
 * profile as "Deleted player".
 *
 * Caller is responsible for deleting the Clerk user via Clerk Backend API.
 *
 * Note: D1 batch is sequential; on partial failure the operation is *not*
 * rolled back. Any partial state should be cleaned up by re-running.
 */
export async function deleteUserAppData(userId: string): Promise<void> {
  const db = await getDbAsync();
  const ops = [
    db.delete(leagueMembers).where(eq(leagueMembers.userId, userId)),
    db.delete(leagues).where(eq(leagues.ownerId, userId)),
    db.delete(profiles).where(eq(profiles.id, userId)),
  ];
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);
}
