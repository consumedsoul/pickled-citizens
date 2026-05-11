import { desc, eq } from 'drizzle-orm';
import { getDbAsync } from '../client';
import {
  adminEvents,
  leagueMembers,
  leagueInvites,
  leagues,
  profiles,
  type AdminEvent,
} from '../schema';
import { encodeJson, decodeJson, type Json } from '../json';

export type AdminEventOut = Omit<AdminEvent, 'payload'> & { payload: Json | null };

export async function listAdminEvents(
  options: { limit?: number; offset?: number } = {},
): Promise<AdminEventOut[]> {
  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(adminEvents)
    .orderBy(desc(adminEvents.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
  return rows.map((r) => ({ ...r, payload: decodeJson(r.payload) }));
}

export async function logAdminEvent(input: {
  eventType: string;
  userId?: string | null;
  userEmail?: string | null;
  leagueId?: string | null;
  payload?: Json | null;
}): Promise<void> {
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
}

/**
 * Cascade-delete a user across the schema. Replaces the Postgres
 * `delete_user_cascade()` / `admin_delete_user()` RPCs.
 *
 * D1 cascades handle most child rows (league_members, match_players via
 * auth.users FK in the old schema) — but Clerk owns user identity now, so
 * we can't rely on FK cascades from auth.users. Delete app rows explicitly.
 *
 * Caller is responsible for deleting the Clerk user via Clerk Backend API.
 *
 * Note: D1 batch is sequential; on partial failure the operation is *not*
 * rolled back. Any partial state should be cleaned up by re-running.
 */
export async function deleteUserAppData(userId: string, userEmail: string | null): Promise<void> {
  const db = await getDbAsync();
  const ops = [
    db.delete(leagueMembers).where(eq(leagueMembers.userId, userId)),
    ...(userEmail
      ? [db.delete(leagueInvites).where(eq(leagueInvites.email, userEmail.toLowerCase()))]
      : []),
    db.delete(leagues).where(eq(leagues.ownerId, userId)),
    db.delete(profiles).where(eq(profiles.id, userId)),
  ];
  await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]]);
}
