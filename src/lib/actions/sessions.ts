'use server';

import { effectiveDupr, isDuprInRange, DUPR_RANGE_ERROR } from '@/lib/dupr';

import { revalidatePath } from 'next/cache';
import { requireUserId, getCurrentEmail } from '@/lib/db/auth-helpers';
import {
  createSession,
  deleteSession,
  getSessionById,
  listGuestsForSession,
  addGuests,
  canManageSession,
  canViewSession,
} from '@/lib/db/queries/sessions';
import {
  listMatchesForSession,
  listPlayersForMatches,
  listResultsForMatches,
  replaceSessionMatches,
  upsertMatchResult,
  updateMatchStatus,
  clearMatchResult,
} from '@/lib/db/queries/matches';
import {
  getLeaguesByIds,
  listLeagueMemberIds,
  isLeagueMember,
} from '@/lib/db/queries/leagues';
import { getProfilesByIds } from '@/lib/db/queries/profiles';
import { logAdminEvent } from '@/lib/db/queries/admin';
import {
  listSessionsForUser,
  aggregateSessionWins,
  type UserSession,
  type SessionWins,
} from '@/lib/db/queries/user-sessions';

export async function getSessionDetail(sessionId: string) {
  const userId = await requireUserId();
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const matches = await listMatchesForSession(sessionId);
  const matchIds = matches.map((m) => m.id);
  const players = await listPlayersForMatches(matchIds);

  // Server actions are POST-reachable RPC endpoints, so "the page only renders
  // for members" is not a gate — this action must authorize for itself, and
  // before it loads anything the viewer has no claim to.
  if (!(await canViewSession(userId, session, players.map((p) => p.userId)))) {
    return null;
  }

  const [results, guests] = await Promise.all([
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
  // Only what the page renders. canViewSession is wider than league
  // membership (a removed player keeps their history), so the response must
  // carry nothing a non-member should not see: no emails, and no league roster.
  const profiles = (await getProfilesByIds(userIds)).map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    // Effective rating: official dupr.com value when synced, else self-reported.
    selfReportedDupr: effectiveDupr(p),
  }));

  let leagueName: string | null = null;
  if (session.leagueId) {
    const leagues = await getLeaguesByIds([session.leagueId]);
    leagueName = leagues[0]?.name ?? null;
  }

  return {
    session,
    matches,
    players,
    results,
    guests,
    profiles,
    leagueName,
    viewerId: userId,
    // The page's edit controls must follow the same rule the write paths
    // enforce (creator or league owner), not a narrower copy of it.
    canManage: await canManageSession(userId, session),
  };
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

export async function clearMatchResultAction(input: { matchId: string }) {
  const userId = await requireUserId();
  await clearMatchResult(userId, input.matchId);
  await updateMatchStatus(userId, input.matchId, 'scheduled');
  return { ok: true };
}

/**
 * Create a session, matches, guests, and match_players in one shot.
 */
export async function createSessionWithTeamsAction(input: {
  leagueId: string;
  scheduledFor: string | null;
  playerCount: 6 | 8 | 10 | 12;
  // Guest definitions to create in session_guests (the order maps to syntheticIds below)
  guests: Array<{ syntheticId: string; displayName: string; dupr: number }>;
  // Each match: list of 4 players (2 per team, 2 positions)
  matches: Array<{
    scheduledOrder: number;
    players: Array<{
      syntheticId?: string; // for guests; mutually exclusive with userId
      userId?: string; // for league members
      team: 1 | 2;
      position: 0 | 1;
    }>;
  }>;
}): Promise<{ sessionId: string }> {
  const userId = await requireUserId();
  if (!(await isLeagueMember(input.leagueId, userId))) {
    throw new Error('Not a member of this league');
  }
  // The client picks players from the roster, but this action is POST-reachable:
  // an arbitrary user ID here would put a stranger into the session and expose
  // their name and DUPR on the session page. Only league members may be placed.
  const memberIds = await listLeagueMemberIds(input.leagueId);
  for (const m of input.matches) {
    for (const p of m.players) {
      if (p.userId && !memberIds.has(p.userId)) {
        throw new Error('Every player must be a member of this league');
      }
    }
  }
  // Guest ratings feed balancing and the session page like a member's, so
  // they get the same range check as a profile DUPR, not just the browser's.
  for (const g of input.guests) {
    const n = Number(g.dupr);
    if (!Number.isFinite(n) || !isDuprInRange(n)) throw new Error(DUPR_RANGE_ERROR);
    if (!g.displayName?.trim()) throw new Error('Every guest needs a name');
  }
  const callerEmail = await getCurrentEmail();

  const session = await createSession(userId, {
    leagueId: input.leagueId,
    scheduledFor: input.scheduledFor,
    playerCount: input.playerCount,
    location: null,
  });

  // Create guests, mapping syntheticId -> real DB id
  const guestIds = await addGuests(userId, session.id, input.guests);
  const syntheticToGuestId = new Map(
    input.guests.map((g, i) => [g.syntheticId, guestIds[i]] as const),
  );

  // Build matches + players plan for replaceSessionMatches
  const newMatches = input.matches.map((m) => ({
    scheduledOrder: m.scheduledOrder,
    status: 'scheduled' as const,
  }));
  const newPlayers: Array<{
    matchIndex: number;
    userId?: string | null;
    guestId?: string | null;
    team: 1 | 2;
    position: number;
  }> = [];
  input.matches.forEach((m, idx) => {
    for (const p of m.players) {
      if (p.syntheticId) {
        const guestId = syntheticToGuestId.get(p.syntheticId);
        if (!guestId) throw new Error(`Missing guest mapping for ${p.syntheticId}`);
        newPlayers.push({ matchIndex: idx, guestId, team: p.team, position: p.position });
      } else if (p.userId) {
        newPlayers.push({ matchIndex: idx, userId: p.userId, team: p.team, position: p.position });
      } else {
        throw new Error('Match player must have userId or syntheticId');
      }
    }
  });

  await replaceSessionMatches(userId, session.id, newMatches, newPlayers);

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

  return { sessionId: session.id };
}

export type SessionListItem = UserSession;

export type SessionsListData = {
  ownedLeagues: Array<{ id: string; name: string; createdAt: string | null }>;
  sessions: SessionListItem[];
  results: Record<string, SessionWins>;
};

/** Page-level loader for /sessions. */
export async function getSessionsListData(): Promise<SessionsListData> {
  const userId = await requireUserId();
  const { getDbAsync } = await import('@/lib/db/client');
  const { leagues } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const db = await getDbAsync();

  const ownedLeagues = await db
    .select({ id: leagues.id, name: leagues.name, createdAt: leagues.createdAt })
    .from(leagues)
    .where(eq(leagues.ownerId, userId));

  const { sessions } = await listSessionsForUser(userId);
  const results = await aggregateSessionWins(sessions.map((s) => s.id));

  return { ownedLeagues, sessions, results };
}

export async function listLeagueRosterAction(leagueId: string) {
  const userId = await requireUserId();
  if (!(await isLeagueMember(leagueId, userId))) {
    throw new Error('Not a member of this league');
  }
  const { getDbAsync } = await import('@/lib/db/client');
  const { leagueMembers, profiles } = await import('@/lib/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const db = await getDbAsync();
  const members = await db
    .select()
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, leagueId));
  if (members.length === 0) return [];
  const { chunkedInArray } = await import('@/lib/db/chunk');
  const profileRows = await chunkedInArray(
    members.map((m) => m.userId),
    (chunk) => db.select().from(profiles).where(inArray(profiles.id, chunk)),
  );
  return members.map((m) => {
    const profile = profileRows.find((p) => p.id === m.userId);
    return {
      userId: m.userId,
      email: m.email ?? profile?.email ?? null,
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      selfReportedDupr: profile ? effectiveDupr(profile) : null,
    };
  });
}
