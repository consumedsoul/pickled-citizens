'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId, getCurrentEmail } from '@/lib/db/auth-helpers';
import {
  createSession,
  updateSession,
  deleteSession,
  getSessionById,
  listSessionsForLeagues,
  listGuestsForSession,
  addGuest,
  removeGuest,
  canManageSession,
} from '@/lib/db/queries/sessions';
import {
  listMatchesForSession,
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
  isLeagueMember,
} from '@/lib/db/queries/leagues';
import { getProfilesByIds } from '@/lib/db/queries/profiles';
import { logAdminEvent } from '@/lib/db/queries/admin';

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

export async function clearMatchResultAction(input: { matchId: string }) {
  const userId = await requireUserId();
  const { getDbAsync } = await import('@/lib/db/client');
  const { matchResults, matches: matchesTable } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const db = await getDbAsync();
  // Authorization: ensure caller can manage the parent session
  const matchRow = await db
    .select({ sessionId: matchesTable.sessionId })
    .from(matchesTable)
    .where(eq(matchesTable.id, input.matchId))
    .limit(1);
  const sessionId = matchRow[0]?.sessionId;
  if (sessionId) {
    const session = await getSessionById(sessionId);
    if (!session || !(await canManageSession(userId, session))) {
      throw new Error('Cannot edit results for this match');
    }
  }
  await db.delete(matchResults).where(eq(matchResults.matchId, input.matchId));
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
  const callerEmail = await getCurrentEmail();

  const session = await createSession(userId, {
    leagueId: input.leagueId,
    scheduledFor: input.scheduledFor,
    playerCount: input.playerCount,
    location: null,
  });

  // Create guests, mapping syntheticId -> real DB id
  const syntheticToGuestId = new Map<string, string>();
  for (const g of input.guests) {
    const created = await addGuest(userId, {
      sessionId: session.id,
      displayName: g.displayName,
      dupr: g.dupr,
    });
    syntheticToGuestId.set(g.syntheticId, created.id);
  }

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

export type SessionListItem = {
  id: string;
  leagueId: string | null;
  leagueName: string | null;
  createdBy: string;
  createdAt: string | null;
  scheduledFor: string | null;
  playerCount: number;
};

export type SessionsListData = {
  ownedLeagues: Array<{ id: string; name: string; createdAt: string | null }>;
  sessions: SessionListItem[];
  results: Record<string, { teamGreenWins: number; teamBlueWins: number }>;
};

/** Page-level loader for /sessions. */
export async function getSessionsListData(): Promise<SessionsListData> {
  const userId = await requireUserId();
  const { getDbAsync } = await import('@/lib/db/client');
  const { leagues, gameSessions, matches, matchResults, matchPlayers } =
    await import('@/lib/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const db = await getDbAsync();

  const ownedLeagues = await db
    .select({ id: leagues.id, name: leagues.name, createdAt: leagues.createdAt })
    .from(leagues)
    .where(eq(leagues.ownerId, userId));

  const ownedSessions = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.createdBy, userId));

  const { chunkedInArray } = await import('@/lib/db/chunk');
  const playerRows = await db
    .select({ matchId: matchPlayers.matchId })
    .from(matchPlayers)
    .where(eq(matchPlayers.userId, userId));
  const matchIds = Array.from(new Set(playerRows.map((p) => p.matchId)));
  const participantMatches = await chunkedInArray(matchIds, (chunk) =>
    db.select().from(matches).where(inArray(matches.id, chunk)),
  );
  const participantSessionIds = Array.from(
    new Set(participantMatches.map((m) => m.sessionId)),
  );
  const participantSessions = await chunkedInArray(participantSessionIds, (chunk) =>
    db.select().from(gameSessions).where(inArray(gameSessions.id, chunk)),
  );

  const allSessions = new Map<string, (typeof gameSessions.$inferSelect)>();
  for (const s of [...ownedSessions, ...participantSessions]) {
    allSessions.set(s.id, s);
  }
  const sessionLeagueIds = Array.from(
    new Set(
      Array.from(allSessions.values())
        .map((s) => s.leagueId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const leagueNameRows = await chunkedInArray(sessionLeagueIds, (chunk) =>
    db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .where(inArray(leagues.id, chunk)),
  );
  const leagueNameMap = new Map(leagueNameRows.map((l) => [l.id, l.name]));

  const sessionList: SessionListItem[] = Array.from(allSessions.values()).map((s) => ({
    id: s.id,
    leagueId: s.leagueId,
    leagueName: s.leagueId ? leagueNameMap.get(s.leagueId) ?? null : null,
    createdBy: s.createdBy,
    createdAt: s.createdAt ?? null,
    scheduledFor: s.scheduledFor,
    playerCount: s.playerCount,
  }));

  // Aggregate match results per session
  const sessionIds = sessionList.map((s) => s.id);
  const allMatches = await chunkedInArray(sessionIds, (chunk) =>
    db.select().from(matches).where(inArray(matches.sessionId, chunk)),
  );
  const allMatchIds = allMatches.map((m) => m.id);
  const allResults = await chunkedInArray(allMatchIds, (chunk) =>
    db.select().from(matchResults).where(inArray(matchResults.matchId, chunk)),
  );
  const matchToSession = new Map(allMatches.map((m) => [m.id, m.sessionId]));
  const results: Record<string, { teamGreenWins: number; teamBlueWins: number }> = {};
  for (const r of allResults) {
    if (r.team1Score == null || r.team2Score == null) continue;
    const sessionId = matchToSession.get(r.matchId);
    if (!sessionId) continue;
    const cur = results[sessionId] ?? { teamGreenWins: 0, teamBlueWins: 0 };
    if (r.team1Score > r.team2Score) cur.teamGreenWins += 1;
    else if (r.team2Score > r.team1Score) cur.teamBlueWins += 1;
    results[sessionId] = cur;
  }

  return { ownedLeagues, sessions: sessionList, results };
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
      selfReportedDupr:
        profile?.selfReportedDupr != null ? Number(profile.selfReportedDupr) : null,
    };
  });
}
