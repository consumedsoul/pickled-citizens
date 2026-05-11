import { and, eq, or } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { leagueInvites, leagueMembers, leagues, type LeagueInvite } from '../schema';
import { AuthorizationError } from '../auth-helpers';
import { isLeagueAdmin } from './leagues';

export async function listInvitesForLeague(
  callerId: string,
  leagueId: string,
): Promise<LeagueInvite[]> {
  if (!(await isLeagueAdmin(leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only league admins can view invites');
  }
  const db = await getDbAsync();
  return db.select().from(leagueInvites).where(eq(leagueInvites.leagueId, leagueId));
}

export async function listInvitesByEmail(email: string): Promise<LeagueInvite[]> {
  const db = await getDbAsync();
  return db
    .select()
    .from(leagueInvites)
    .where(
      and(eq(leagueInvites.email, email.toLowerCase()), eq(leagueInvites.status, 'pending')),
    );
}

export async function createInvite(
  callerId: string,
  input: { leagueId: string; email: string },
): Promise<LeagueInvite> {
  if (!(await isLeagueAdmin(input.leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only league admins can send invites');
  }
  const db = await getDbAsync();
  const id = crypto.randomUUID();
  await db.insert(leagueInvites).values({
    id,
    leagueId: input.leagueId,
    email: input.email.toLowerCase(),
    invitedBy: callerId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  const rows = await db.select().from(leagueInvites).where(eq(leagueInvites.id, id)).limit(1);
  if (!rows[0]) throw new Error('Failed to create invite');
  return rows[0];
}

export async function acceptInvite(
  callerId: string,
  callerEmail: string,
  inviteId: string,
): Promise<void> {
  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(leagueInvites)
    .where(eq(leagueInvites.id, inviteId))
    .limit(1);
  const invite = rows[0];
  if (!invite) throw new AuthorizationError(404, 'Invite not found');
  if (invite.email.toLowerCase() !== callerEmail.toLowerCase()) {
    throw new AuthorizationError(403, 'This invite is for a different email address');
  }
  if (invite.status !== 'pending') {
    throw new AuthorizationError(409, 'Invite is no longer pending');
  }

  await db.batch([
    db
      .insert(leagueMembers)
      .values({
        leagueId: invite.leagueId,
        userId: callerId,
        email: callerEmail,
        role: 'player',
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing(),
    db
      .update(leagueInvites)
      .set({ status: 'accepted', acceptedAt: new Date().toISOString() })
      .where(eq(leagueInvites.id, inviteId)),
  ]);
}

export async function revokeInvite(callerId: string, inviteId: string): Promise<void> {
  const db = await getDbAsync();
  const rows = await db
    .select({ leagueId: leagueInvites.leagueId })
    .from(leagueInvites)
    .where(eq(leagueInvites.id, inviteId))
    .limit(1);
  const invite = rows[0];
  if (!invite) return;
  if (!(await isLeagueAdmin(invite.leagueId, callerId))) {
    throw new AuthorizationError(403, 'Only league admins can revoke invites');
  }
  await db
    .update(leagueInvites)
    .set({ status: 'revoked' })
    .where(eq(leagueInvites.id, inviteId));
}

/**
 * Lookup helper: which leagues can the caller see invites for?
 * Used by admin views that aggregate invites across all admin'd leagues.
 */
export async function listInvitesAcrossAdminLeagues(
  callerId: string,
): Promise<LeagueInvite[]> {
  const db = await getDbAsync();
  const adminLeagues = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.userId, callerId), eq(leagueMembers.role, 'admin')));
  const ownedLeagues = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.ownerId, callerId));
  const ids = Array.from(
    new Set([...adminLeagues.map((r) => r.leagueId), ...ownedLeagues.map((r) => r.id)]),
  );
  if (ids.length === 0) return [];
  return db
    .select()
    .from(leagueInvites)
    .where(or(...ids.map((id) => eq(leagueInvites.leagueId, id)))!);
}
