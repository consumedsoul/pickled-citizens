'use server';

import { effectiveDupr } from '@/lib/dupr';

import { revalidatePath } from 'next/cache';
import { requireUserId, getCurrentEmail, AuthorizationError } from '@/lib/db/auth-helpers';
import {
  createLeague,
  updateLeague,
  deleteLeague,
  addMember,
  updateMemberRole,
  removeMember,
  getLeagueById,
  isLeagueMember,
  listMembersOfLeague,
  listLeaguesForUser,
  isLeagueAdmin,
  isLeagueOwner,
} from '@/lib/db/queries/leagues';
import { logAdminEvent } from '@/lib/db/queries/admin';
import { getProfilesByIds } from '@/lib/db/queries/profiles';
import { getLeagueStandings } from '@/lib/db/queries/league-standings';
import type { PlayerStanding, RivalRecord } from '@/lib/standings';

/** Names only: the board renders first/last and never needs an address. */
type Named = {
  firstName: string | null;
  lastName: string | null;
};

export type RivalRow = RivalRecord & Named;
export type StandingRow = Omit<PlayerStanding, 'rivals'> & Named & { rivals: RivalRow[] };

/**
 * The league board: every member who has played at least one scored game,
 * best win percentage first, with names attached to them and their rivals.
 * Members only — the board is derived from match history, so this is also a
 * read of who played whom.
 */
export async function getLeagueStandingsAction(leagueId: string): Promise<{
  standings: StandingRow[];
  gamesCounted: number;
  hasRecentSession: boolean;
}> {
  const userId = await requireUserId();
  if (!(await isLeagueMember(leagueId, userId))) {
    throw new AuthorizationError(404, 'League not found');
  }
  const result = await getLeagueStandings(leagueId);
  // Rivals are players too, but one may have left the league since, so look
  // up the union rather than assuming every rival has a standings row.
  const ids = new Set<string>();
  for (const p of result.players) {
    ids.add(p.userId);
    for (const r of p.rivals) ids.add(r.userId);
  }
  const profiles = await getProfilesByIds(Array.from(ids));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const named = (id: string): Named => {
    const profile = byId.get(id);
    return {
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
    };
  };
  return {
    standings: result.players.map((p) => ({
      ...p,
      ...named(p.userId),
      rivals: p.rivals.map((r) => ({ ...r, ...named(r.userId) })),
    })),
    gamesCounted: result.gamesCounted,
    hasRecentSession: result.recentSessionId != null,
  };
}

export async function listMyLeagues() {
  const userId = await requireUserId();
  return listLeaguesForUser(userId);
}

export async function getLeagueDetail(leagueId: string) {
  const userId = await requireUserId();
  const league = await getLeagueById(leagueId);
  if (!league) throw new AuthorizationError(404, 'League not found');
  // isAdmin/isOwner below are UI capability flags, not a gate — membership has
  // to be required explicitly or any authenticated caller with a league ID can
  // read the full roster and every member's profile row, email included.
  if (!(await isLeagueMember(leagueId, userId))) {
    throw new AuthorizationError(404, 'League not found');
  }
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
  let league;
  try {
    league = await createLeague(userId, { name });
  } catch (err) {
    // Returned rather than thrown, like renameLeagueAction: production builds
    // replace thrown server-action messages with a generic one, and the cap
    // and duplicate-name messages are ones the user can act on.
    if (err instanceof AuthorizationError && (err.statusCode === 403 || err.statusCode === 409)) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
  await logAdminEvent({
    eventType: 'league.created',
    userId,
    userEmail: email,
    leagueId: league.id,
    payload: { name: league.name },
  });
  revalidatePath('/leagues');
  return { ok: true as const, league };
}

export async function renameLeagueAction(input: { leagueId: string; name: string }) {
  const userId = await requireUserId();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 255) {
    throw new Error('League name must be 1-255 characters');
  }
  try {
    await updateLeague(userId, input.leagueId, { name });
  } catch (err) {
    // Returned rather than thrown: production builds replace thrown server
    // action messages with a generic one, and this one the user can act on.
    if (err instanceof AuthorizationError && err.statusCode === 409) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
  revalidatePath(`/leagues/${input.leagueId}`);
  revalidatePath('/leagues');
  return { ok: true as const };
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

/**
 * Add a player to a league by their email address. Looks up the profile and
 * inserts the membership. Throws if no profile exists for that email.
 */
export async function addMemberByEmailAction(input: {
  leagueId: string;
  email: string;
}): Promise<{
  member: {
    userId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    selfReportedDupr: number | null;
    role: 'player';
  };
}> {
  const callerId = await requireUserId();
  const callerEmail = await getCurrentEmail();
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  const { getDbAsync } = await import('@/lib/db/client');
  const { profiles } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const db = await getDbAsync();
  const rows = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  const profile = rows[0];
  if (!profile) {
    throw new Error(
      'No player found with that email. Ask them to sign up and save their profile first.',
    );
  }

  await addMember(callerId, input.leagueId, {
    userId: profile.id,
    email: profile.email ?? email,
    role: 'player',
  });

  await logAdminEvent({
    eventType: 'league.member_added',
    userId: callerId,
    userEmail: callerEmail,
    leagueId: input.leagueId,
    payload: { member_user_id: profile.id, member_email: profile.email ?? email },
  });
  revalidatePath(`/leagues/${input.leagueId}`);

  return {
    member: {
      userId: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      selfReportedDupr: effectiveDupr(profile),
      role: 'player',
    },
  };
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
