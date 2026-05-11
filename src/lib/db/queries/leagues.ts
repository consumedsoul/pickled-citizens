import { and, eq, ne, inArray, count } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { chunkedInArray } from '../chunk';
import {
  leagues,
  leagueMembers,
  type League,
  type NewLeague,
  type LeagueMember,
} from '../schema';
import { AuthorizationError } from '../auth-helpers';

export async function listLeagues(): Promise<League[]> {
  const db = await getDbAsync();
  return db.select().from(leagues);
}

export async function getLeagueById(id: string): Promise<League | null> {
  const db = await getDbAsync();
  const rows = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLeaguesByIds(ids: string[]): Promise<League[]> {
  if (ids.length === 0) return [];
  const db = await getDbAsync();
  return chunkedInArray(ids, (chunk) =>
    db.select().from(leagues).where(inArray(leagues.id, chunk)),
  );
}

export async function listMembershipsForUser(userId: string): Promise<LeagueMember[]> {
  const db = await getDbAsync();
  return db.select().from(leagueMembers).where(eq(leagueMembers.userId, userId));
}

export async function listMembersOfLeague(leagueId: string): Promise<LeagueMember[]> {
  const db = await getDbAsync();
  return db.select().from(leagueMembers).where(eq(leagueMembers.leagueId, leagueId));
}

export async function isLeagueAdmin(leagueId: string, userId: string): Promise<boolean> {
  const db = await getDbAsync();
  const league = await getLeagueById(leagueId);
  if (league?.ownerId === userId) return true;
  const rows = await db
    .select({ role: leagueMembers.role })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1);
  return rows[0]?.role === 'admin';
}

export async function isLeagueOwner(leagueId: string, userId: string): Promise<boolean> {
  const league = await getLeagueById(leagueId);
  return league?.ownerId === userId;
}

export async function createLeague(
  callerId: string,
  input: Pick<NewLeague, 'name'> & { id?: string },
): Promise<League> {
  const db = await getDbAsync();
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.insert(leagues).values({
      id,
      name: input.name,
      ownerId: callerId,
      createdAt: now,
    }),
    db.insert(leagueMembers).values({
      leagueId: id,
      userId: callerId,
      role: 'admin',
      createdAt: now,
    }),
  ]);
  const created = await getLeagueById(id);
  if (!created) throw new Error('Failed to create league');
  return created;
}

export async function updateLeague(
  callerId: string,
  leagueId: string,
  patch: { name?: string },
): Promise<void> {
  if (!(await isLeagueOwner(leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only the league owner can update the league');
  }
  const db = await getDbAsync();
  if (patch.name !== undefined) {
    await db.update(leagues).set({ name: patch.name }).where(eq(leagues.id, leagueId));
  }
}

export async function deleteLeague(callerId: string, leagueId: string): Promise<void> {
  if (!(await isLeagueOwner(leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only the league owner can delete the league');
  }
  const db = await getDbAsync();
  await db.delete(leagues).where(eq(leagues.id, leagueId));
}

export async function addMember(
  callerId: string,
  leagueId: string,
  member: { userId: string; email?: string; role?: 'player' | 'admin' },
): Promise<void> {
  if (!(await isLeagueAdmin(leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only league admins can add members');
  }
  const db = await getDbAsync();
  await db
    .insert(leagueMembers)
    .values({
      leagueId,
      userId: member.userId,
      email: member.email,
      role: member.role ?? 'player',
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

export async function updateMemberRole(
  callerId: string,
  leagueId: string,
  userId: string,
  role: 'player' | 'admin',
): Promise<void> {
  if (!(await isLeagueAdmin(leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only league admins can change member roles');
  }
  const db = await getDbAsync();
  await db
    .update(leagueMembers)
    .set({ role })
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
}

/**
 * Remove a user from a league.
 * Self-removal is allowed; otherwise caller must be a league admin.
 * Sole-admin protection: the last admin cannot leave/be removed.
 */
export async function removeMember(
  callerId: string,
  leagueId: string,
  userId: string,
): Promise<{ removed: boolean }> {
  const db = await getDbAsync();

  if (callerId !== userId) {
    if (!(await isLeagueAdmin(leagueId, callerId))) {
      throw new AuthorizationError(403, 'Cannot remove another user from this league');
    }
  }

  const membership = await db
    .select({ role: leagueMembers.role })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1);

  if (!membership[0]) {
    return { removed: false };
  }

  if (membership[0].role === 'admin') {
    const otherAdmins = await db
      .select({ count: count() })
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.role, 'admin'),
          ne(leagueMembers.userId, userId),
        ),
      );
    if ((otherAdmins[0]?.count ?? 0) === 0) {
      throw new AuthorizationError(
        409,
        'You are the only admin. Promote another member to admin before leaving.',
      );
    }
  }

  await db
    .delete(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));

  return { removed: true };
}
