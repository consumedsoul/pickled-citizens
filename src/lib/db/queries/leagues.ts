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
import { MAX_LEAGUES } from '@/lib/constants';

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

/** Member count per league — one grouped query per chunk, not one query per league. */
export async function countMembersByLeague(leagueIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (leagueIds.length === 0) return counts;
  const db = await getDbAsync();
  const rows = await chunkedInArray(leagueIds, (chunk) =>
    db
      .select({ leagueId: leagueMembers.leagueId, n: count() })
      .from(leagueMembers)
      .where(inArray(leagueMembers.leagueId, chunk))
      .groupBy(leagueMembers.leagueId),
  );
  for (const row of rows) counts.set(row.leagueId, row.n);
  return counts;
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

export async function isLeagueMember(leagueId: string, userId: string): Promise<boolean> {
  const league = await getLeagueById(leagueId);
  if (league?.ownerId === userId) return true;
  const db = await getDbAsync();
  const rows = await db
    .select({ userId: leagueMembers.userId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Leagues the user owns — the set the league cap and name rule apply to.
 * Ownership, not the admin role row: a role row can be shed (demotion, leaving)
 * while `owner_id` keeps every owner power, so counting roles let an owner run
 * unlimited leagues.
 */
async function listOwnedLeagues(userId: string): Promise<League[]> {
  const db = await getDbAsync();
  return db.select().from(leagues).where(eq(leagues.ownerId, userId));
}

/**
 * Every user ID allowed to be placed in a league's session: the member rows
 * plus the owner, who counts as a member even without a row (see isLeagueMember).
 */
export async function listLeagueMemberIds(leagueId: string): Promise<Set<string>> {
  const db = await getDbAsync();
  const league = await getLeagueById(leagueId);
  const rows = await db
    .select({ userId: leagueMembers.userId })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, leagueId));
  const ids = new Set(rows.map((r) => r.userId));
  if (league) ids.add(league.ownerId);
  return ids;
}

function nameTaken(existing: League[], name: string, exceptId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return existing.some((l) => l.id !== exceptId && l.name.trim().toLowerCase() === wanted);
}

/**
 * The league cap and unique-name rule live here, not only in the /leagues
 * click handler: server actions are POST-reachable, so a rule the browser
 * enforces alone is not enforced.
 */
export async function createLeague(
  callerId: string,
  input: Pick<NewLeague, 'name'> & { id?: string },
): Promise<League> {
  const owned = await listOwnedLeagues(callerId);
  if (owned.length >= MAX_LEAGUES) {
    throw new AuthorizationError(403, `You have reached the maximum of ${MAX_LEAGUES} leagues.`);
  }
  if (nameTaken(owned, input.name)) {
    throw new AuthorizationError(409, 'A league with that name already exists.');
  }
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
  if (patch.name !== undefined && nameTaken(await listOwnedLeagues(callerId), patch.name, leagueId)) {
    throw new AuthorizationError(409, 'A league with that name already exists.');
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

/** Admin rows in a league other than `exceptUserId`. */
async function countOtherAdmins(leagueId: string, exceptUserId: string): Promise<number> {
  const db = await getDbAsync();
  const rows = await db
    .select({ count: count() })
    .from(leagueMembers)
    .where(
      and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.role, 'admin'),
        ne(leagueMembers.userId, exceptUserId),
      ),
    );
  return rows[0]?.count ?? 0;
}

/**
 * Change a member's role. The owner's role cannot change and the last admin
 * cannot be demoted — both rules live here, not only in the page's click
 * handler, because server actions are POST-reachable.
 */
export async function updateMemberRole(
  callerId: string,
  leagueId: string,
  userId: string,
  role: 'player' | 'admin',
): Promise<void> {
  if (!(await isLeagueAdmin(leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only league admins can change member roles');
  }
  if (await isLeagueOwner(leagueId, userId)) {
    throw new AuthorizationError(409, 'The league owner is always an admin.');
  }
  if (role === 'player' && (await countOtherAdmins(leagueId, userId)) === 0) {
    throw new AuthorizationError(
      409,
      'Cannot demote the last admin. Promote another member first.',
    );
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
 * The owner cannot leave or be removed (ownership has no transfer path, and an
 * owner without a row keeps every power while vanishing from the roster).
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

  if (await isLeagueOwner(leagueId, userId)) {
    throw new AuthorizationError(
      409,
      'The league owner cannot leave the league. Delete the league instead.',
    );
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
    if ((await countOtherAdmins(leagueId, userId)) === 0) {
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
