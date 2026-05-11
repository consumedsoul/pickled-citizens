'use server';

import { createClerkClient } from '@clerk/backend';
import { count, eq, and, ne, inArray } from 'drizzle-orm';
import { requireUserId, getCurrentEmail } from '@/lib/db/auth-helpers';
import { getDbAsync } from '@/lib/db/client';
import { leagueMembers, leagues } from '@/lib/db/schema';
import { deleteUserAppData, logAdminEvent } from '@/lib/db/queries/admin';

function clerk() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY not configured');
  return createClerkClient({ secretKey: secret });
}

export async function checkSoleAdminLeagues(): Promise<
  Array<{ id: string; name: string }>
> {
  const userId = await requireUserId();
  const db = await getDbAsync();

  const adminMemberships = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.role, 'admin')));
  const leagueIds = adminMemberships.map((m) => m.leagueId);
  if (leagueIds.length === 0) return [];

  const sole: Array<{ id: string; name: string }> = [];
  for (const leagueId of leagueIds) {
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
      const league = await db
        .select({ id: leagues.id, name: leagues.name })
        .from(leagues)
        .where(eq(leagues.id, leagueId))
        .limit(1);
      if (league[0]) sole.push(league[0]);
    }
  }
  return sole;
}

/**
 * Self-service account deletion.
 * Caller must not be sole admin of any league.
 */
export async function deleteMyAccount(): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const email = await getCurrentEmail();

  const sole = await checkSoleAdminLeagues();
  if (sole.length > 0) {
    throw new Error(
      `You are the sole admin of: ${sole.map((l) => l.name).join(', ')}. ` +
        `Promote another member to admin in these leagues first.`,
    );
  }

  await deleteUserAppData(userId, email);
  try {
    await clerk().users.deleteUser(userId);
  } catch (err) {
    await logAdminEvent({
      eventType: 'account.clerk_delete_failed',
      userId,
      userEmail: email,
      payload: { error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }

  await logAdminEvent({
    eventType: 'account.deleted',
    userId,
    userEmail: email,
    payload: { source: 'self_service' },
  });

  return { ok: true };
}

// Suppress unused-import for inArray if lint is strict
void inArray;
