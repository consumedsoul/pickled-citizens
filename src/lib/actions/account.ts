'use server';

import { createClerkClient } from '@clerk/backend';
import { eq, and, ne, inArray } from 'drizzle-orm';
import { requireUserId, getCurrentEmail } from '@/lib/db/auth-helpers';
import { getDbAsync } from '@/lib/db/client';
import { chunkedInArray } from '@/lib/db/chunk';
import { leagueMembers, leagues } from '@/lib/db/schema';
import { deleteUserAppData, logAdminEvent } from '@/lib/db/queries/admin';

function clerk() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY not configured');
  return createClerkClient({ secretKey: secret });
}

// Not exported: every export of a 'use server' module becomes a POST-reachable
// action, and this is only a helper for deleteMyAccount.
async function checkSoleAdminLeagues(
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const db = await getDbAsync();

  const adminMemberships = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.role, 'admin')));
  const leagueIds = adminMemberships.map((m) => m.leagueId);
  if (leagueIds.length === 0) return [];

  // Other admins across all of those leagues in one pass, not a count per league.
  const otherAdmins = await chunkedInArray(leagueIds, (chunk) =>
    db
      .select({ leagueId: leagueMembers.leagueId })
      .from(leagueMembers)
      .where(
        and(
          inArray(leagueMembers.leagueId, chunk),
          eq(leagueMembers.role, 'admin'),
          ne(leagueMembers.userId, userId),
        ),
      ),
  );
  const covered = new Set(otherAdmins.map((r) => r.leagueId));
  const soleIds = leagueIds.filter((id) => !covered.has(id));
  return chunkedInArray(soleIds, (chunk) =>
    db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .where(inArray(leagues.id, chunk)),
  );
}

/**
 * Self-service account deletion.
 * Caller must not be sole admin of any league.
 */
export async function deleteMyAccount(): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const email = await getCurrentEmail();

  const sole = await checkSoleAdminLeagues(userId);
  if (sole.length > 0) {
    throw new Error(
      `You are the sole admin of: ${sole.map((l) => l.name).join(', ')}. ` +
        `Promote another member to admin in these leagues first.`,
    );
  }

  await deleteUserAppData(userId);
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
