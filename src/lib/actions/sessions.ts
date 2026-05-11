'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId, getCurrentEmail } from '@/lib/db/auth-helpers';
import {
  createSession,
  updateSession,
  deleteSession,
  getSessionById,
  listSessions,
  listSessionsForLeagues,
  listGuestsForSession,
  addGuest,
  removeGuest,
} from '@/lib/db/queries/sessions';
import {
  listMatchesForSession,
  listMatchesForSessions,
  listPlayersForMatches,
  listResultsForMatches,
  replaceSessionMatches,
  upsertMatchResult,
  updateMatchStatus,
} from '@/lib/db/queries/matches';
import {
  listMembershipsForUser,
  getLeaguesByIds,
  listMembersOfLeague,
} from '@/lib/db/queries/leagues';
import { getProfilesByIds } from '@/lib/db/queries/profiles';
import { logAdminEvent } from '@/lib/db/queries/admin';

export async function listSessionsAction() {
  return listSessions();
}

export async function listMySessionsAction() {
  const userId = await requireUserId();
  const memberships = await listMembershipsForUser(userId);
  const leagueIds = memberships.map((m) => m.leagueId);
  const sessions = await listSessionsForLeagues(leagueIds);
  return sessions;
}

export async function getSessionDetail(sessionId: string) {
  const userId = await requireUserId();
  const session = await getSessionById(sessionId);
  if (!session) return null;
  const matches = await listMatchesForSession(sessionId);
  const matchIds = matches.map((m) => m.id);
  const [players, results, guests] = await Promise.all([
    listPlayersForMatches(matchIds),
    listResultsForMatches(matchIds),
    listGuestsForSession(sessionId),
  ]);

  const userIds = Array.from(
    new Set(
      players
        .map((p) => p.userId)
        .filter((id): id is string => Boolean(id))
        .concat([session.createdBy]),
    ),
  );
  const profiles = await getProfilesByIds(userIds);

  let leagueName: string | null = null;
  let leagueMembers: Awaited<ReturnType<typeof listMembersOfLeague>> = [];
  if (session.leagueId) {
    const leagues = await getLeaguesByIds([session.leagueId]);
    leagueName = leagues[0]?.name ?? null;
    leagueMembers = await listMembersOfLeague(session.leagueId);
  }

  return {
    session,
    matches,
    players,
    results,
    guests,
    profiles,
    leagueName,
    leagueMembers,
    viewerId: userId,
  };
}

export async function createSessionAction(input: {
  leagueId?: string | null;
  scheduledFor?: string | null;
  location?: string | null;
  playerCount: number;
}) {
  const userId = await requireUserId();
  const callerEmail = await getCurrentEmail();
  const session = await createSession(userId, {
    leagueId: input.leagueId ?? null,
    scheduledFor: input.scheduledFor ?? null,
    location: input.location ?? null,
    playerCount: input.playerCount,
  });
  await logAdminEvent({
    eventType: 'session.created',
    userId,
    userEmail: callerEmail,
    leagueId: session.leagueId,
    payload: {
      session_id: session.id,
      player_count: session.playerCount,
      scheduled_for: session.scheduledFor,
    },
  });
  revalidatePath('/sessions');
  if (session.leagueId) revalidatePath(`/leagues/${session.leagueId}`);
  return session;
}

export async function updateSessionAction(input: {
  sessionId: string;
  scheduledFor?: string | null;
  location?: string | null;
}) {
  const userId = await requireUserId();
  await updateSession(userId, input.sessionId, {
    scheduledFor: input.scheduledFor,
    location: input.location,
  });
  revalidatePath(`/sessions/${input.sessionId}`);
  return { ok: true };
}

export async function deleteSessionAction(input: { sessionId: string }) {
  const userId = await requireUserId();
  const callerEmail = await getCurrentEmail();
  const session = await getSessionById(input.sessionId);
  await deleteSession(userId, input.sessionId);
  await logAdminEvent({
    eventType: 'session.deleted',
    userId,
    userEmail: callerEmail,
    leagueId: session?.leagueId ?? null,
    payload: { session_id: input.sessionId },
  });
  revalidatePath('/sessions');
  if (session?.leagueId) revalidatePath(`/leagues/${session.leagueId}`);
  return { ok: true };
}

export async function addGuestAction(input: {
  sessionId: string;
  displayName: string;
  dupr: number;
}) {
  const userId = await requireUserId();
  const guest = await addGuest(userId, input);
  revalidatePath(`/sessions/${input.sessionId}`);
  return guest;
}

export async function removeGuestAction(input: { guestId: string; sessionId: string }) {
  const userId = await requireUserId();
  await removeGuest(userId, input.guestId);
  revalidatePath(`/sessions/${input.sessionId}`);
  return { ok: true };
}

export async function replaceSessionMatchesAction(input: {
  sessionId: string;
  matches: Array<{ courtNumber?: number | null; scheduledOrder?: number; status?: 'scheduled' | 'completed' | 'canceled' }>;
  players: Array<{
    matchIndex: number;
    userId?: string | null;
    guestId?: string | null;
    team: 1 | 2;
    position?: number;
  }>;
}) {
  const userId = await requireUserId();
  const result = await replaceSessionMatches(userId, input.sessionId, input.matches, input.players);
  revalidatePath(`/sessions/${input.sessionId}`);
  return result;
}

export async function recordMatchResultAction(input: {
  matchId: string;
  team1Score: number | null;
  team2Score: number | null;
}) {
  const userId = await requireUserId();
  await upsertMatchResult(userId, input.matchId, {
    team1Score: input.team1Score,
    team2Score: input.team2Score,
  });
  await updateMatchStatus(userId, input.matchId, 'completed');
  return { ok: true };
}

export async function listSessionsForLeaguesAction(leagueIds: string[]) {
  if (leagueIds.length === 0) return { sessions: [], matches: [], results: [] };
  const sessions = await listSessionsForLeagues(leagueIds);
  const matches = await listMatchesForSessions(sessions.map((s) => s.id));
  const results = await listResultsForMatches(matches.map((m) => m.id));
  return { sessions, matches, results };
}
