'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId, getCurrentEmail, AuthorizationError } from '@/lib/db/auth-helpers';
import {
  createLeague,
  updateLeague,
  deleteLeague,
  addMember,
  updateMemberRole,
  removeMember,
  listLeagues,
  getLeagueById,
  listMembersOfLeague,
  listMembershipsForUser,
  getLeaguesByIds,
  isLeagueAdmin,
  isLeagueOwner,
} from '@/lib/db/queries/leagues';
import {
  createInvite,
  listInvitesForLeague,
  acceptInvite,
  revokeInvite,
} from '@/lib/db/queries/invites';
import { logAdminEvent } from '@/lib/db/queries/admin';
import { getProfilesByIds } from '@/lib/db/queries/profiles';

export async function listAllLeagues() {
  return listLeagues();
}

export async function listMyLeagues() {
  const userId = await requireUserId();
  const memberships = await listMembershipsForUser(userId);
  const ids = memberships.map((m) => m.leagueId);
  const leagues = await getLeaguesByIds(ids);
  return leagues.map((l) => {
    const m = memberships.find((mm) => mm.leagueId === l.id);
    return { ...l, role: m?.role ?? 'player' };
  });
}

export async function getLeagueDetail(leagueId: string) {
  const userId = await requireUserId();
  const league = await getLeagueById(leagueId);
  if (!league) throw new AuthorizationError(404, 'League not found');
  const members = await listMembersOfLeague(leagueId);
  const profiles = await getProfilesByIds(members.map((m) => m.userId));
  const isAdmin = await isLeagueAdmin(leagueId, userId);
  const isOwner = await isLeagueOwner(leagueId, userId);
  return { league, members, profiles, isAdmin, isOwner, viewerId: userId };
}

export async function createLeagueAction(input: { name: string }) {
  const userId = await requireUserId();
  const email = await getCurrentEmail();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 255) {
    throw new Error('League name must be 1-255 characters');
  }
  const league = await createLeague(userId, { name });
  await logAdminEvent({
    eventType: 'league.created',
    userId,
    userEmail: email,
    leagueId: league.id,
    payload: { name: league.name },
  });
  revalidatePath('/leagues');
  return league;
}

export async function renameLeagueAction(input: { leagueId: string; name: string }) {
  const userId = await requireUserId();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 255) {
    throw new Error('League name must be 1-255 characters');
  }
  await updateLeague(userId, input.leagueId, { name });
  revalidatePath(`/leagues/${input.leagueId}`);
  revalidatePath('/leagues');
  return { ok: true };
}

export async function deleteLeagueAction(input: { leagueId: string }) {
  const userId = await requireUserId();
  const email = await getCurrentEmail();
  await deleteLeague(userId, input.leagueId);
  await logAdminEvent({
    eventType: 'league.deleted',
    userId,
    userEmail: email,
    leagueId: input.leagueId,
  });
  revalidatePath('/leagues');
  return { ok: true };
}

export async function leaveLeagueAction(input: { leagueId: string }) {
  const userId = await requireUserId();
  return removeMember(userId, input.leagueId, userId);
}

export async function addMemberAction(input: {
  leagueId: string;
  userId: string;
  email?: string;
  role?: 'player' | 'admin';
}) {
  const callerId = await requireUserId();
  const callerEmail = await getCurrentEmail();
  await addMember(callerId, input.leagueId, {
    userId: input.userId,
    email: input.email,
    role: input.role,
  });
  await logAdminEvent({
    eventType: 'league.member_added',
    userId: callerId,
    userEmail: callerEmail,
    leagueId: input.leagueId,
    payload: { added_user_id: input.userId, role: input.role ?? 'player' },
  });
  revalidatePath(`/leagues/${input.leagueId}`);
  return { ok: true };
}

export async function setMemberRoleAction(input: {
  leagueId: string;
  userId: string;
  role: 'player' | 'admin';
}) {
  const callerId = await requireUserId();
  await updateMemberRole(callerId, input.leagueId, input.userId, input.role);
  revalidatePath(`/leagues/${input.leagueId}`);
  return { ok: true };
}

export async function removeMemberAction(input: { leagueId: string; userId: string }) {
  const callerId = await requireUserId();
  const result = await removeMember(callerId, input.leagueId, input.userId);
  revalidatePath(`/leagues/${input.leagueId}`);
  return result;
}

// ---- Invites ----

export async function listInvitesAction(leagueId: string) {
  const callerId = await requireUserId();
  return listInvitesForLeague(callerId, leagueId);
}

export async function createInviteAction(input: { leagueId: string; email: string }) {
  const callerId = await requireUserId();
  const callerEmail = await getCurrentEmail();
  const invite = await createInvite(callerId, input);
  await logAdminEvent({
    eventType: 'league.invite_created',
    userId: callerId,
    userEmail: callerEmail,
    leagueId: input.leagueId,
    payload: { invited_email: input.email.toLowerCase() },
  });
  revalidatePath(`/leagues/${input.leagueId}`);
  return invite;
}

export async function acceptInviteAction(inviteId: string) {
  const callerId = await requireUserId();
  const callerEmail = await getCurrentEmail();
  if (!callerEmail) throw new AuthorizationError(401, 'Email required to accept invite');
  await acceptInvite(callerId, callerEmail, inviteId);
  revalidatePath('/leagues');
  return { ok: true };
}

export async function revokeInviteAction(inviteId: string) {
  const callerId = await requireUserId();
  await revokeInvite(callerId, inviteId);
  return { ok: true };
}
