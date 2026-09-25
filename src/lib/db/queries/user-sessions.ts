import { eq, inArray } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { chunkedInArray } from '../chunk';
import { gameSessions, leagues, matches, matchPlayers, matchResults } from '../schema';

/**
 * The "sessions a user is involved in" pipeline, shared by the home page and
 * the /sessions page. It used to be copied into both loaders and had already
 * drifted (one sorted, the other did not); a rule that lives here is enforced
 * in both.
 *
 * Read path: `userId` is the subject of the query, not a gate. The calling
 * server action owns authentication.
 */

export type UserSession = {
  id: string;
  leagueId: string | null;
  leagueName: string | null;
  createdBy: string;
  createdAt: string | null;
  scheduledFor: string | null;
  playerCount: number;
};

/** One match the user played: which session it belongs to and which side they were on. */
export type Participation = {
  matchId: string;
  sessionId: string;
  team: number;
};

/** Newest first, by scheduled time falling back to creation time; undated last. */
function byNewest(a: UserSession, b: UserSession): number {
  const aTime = a.scheduledFor ?? a.createdAt;
  const bTime = b.scheduledFor ?? b.createdAt;
  if (!aTime && !bTime) return 0;
  if (!aTime) return 1;
  if (!bTime) return -1;
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

/** Sessions the user created or played in, deduplicated, with league names. */
export async function listSessionsForUser(
  userId: string,
): Promise<{ sessions: UserSession[]; participation: Participation[] }> {
  const db = await getDbAsync();

  const ownedSessions = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.createdBy, userId));

  const playerRows = await db
    .select({ matchId: matchPlayers.matchId, team: matchPlayers.team })
    .from(matchPlayers)
    .where(eq(matchPlayers.userId, userId));
  const teamByMatch = new Map(playerRows.map((p) => [p.matchId, p.team]));

  const matchRows = await chunkedInArray(Array.from(teamByMatch.keys()), (chunk) =>
    db
      .select({ id: matches.id, sessionId: matches.sessionId })
      .from(matches)
      .where(inArray(matches.id, chunk)),
  );
  const participation: Participation[] = matchRows.map((m) => ({
    matchId: m.id,
    sessionId: m.sessionId,
    team: teamByMatch.get(m.id) ?? 0,
  }));

  const participantSessionIds = Array.from(new Set(participation.map((p) => p.sessionId)));
  const participantSessions = await chunkedInArray(participantSessionIds, (chunk) =>
    db.select().from(gameSessions).where(inArray(gameSessions.id, chunk)),
  );

  const bySessionId = new Map<string, typeof gameSessions.$inferSelect>();
  for (const s of [...ownedSessions, ...participantSessions]) bySessionId.set(s.id, s);

  const leagueIds = Array.from(
    new Set(
      Array.from(bySessionId.values())
        .map((s) => s.leagueId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const leagueNameRows = await chunkedInArray(leagueIds, (chunk) =>
    db.select({ id: leagues.id, name: leagues.name }).from(leagues).where(inArray(leagues.id, chunk)),
  );
  const leagueNameById = new Map(leagueNameRows.map((l) => [l.id, l.name]));

  const sessions = Array.from(bySessionId.values())
    .map<UserSession>((s) => ({
      id: s.id,
      leagueId: s.leagueId,
      leagueName: s.leagueId ? leagueNameById.get(s.leagueId) ?? null : null,
      createdBy: s.createdBy,
      createdAt: s.createdAt ?? null,
      scheduledFor: s.scheduledFor,
      playerCount: s.playerCount,
    }))
    .sort(byNewest);

  return { sessions, participation };
}

export type SessionResultRow = {
  sessionId: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
};

/** Every fully recorded match result in the given sessions, tagged with its session. */
export async function listResultsBySession(sessionIds: string[]): Promise<SessionResultRow[]> {
  const db = await getDbAsync();
  const matchRows = await chunkedInArray(sessionIds, (chunk) =>
    db
      .select({ id: matches.id, sessionId: matches.sessionId })
      .from(matches)
      .where(inArray(matches.sessionId, chunk)),
  );
  const sessionByMatch = new Map(matchRows.map((m) => [m.id, m.sessionId]));
  const resultRows = await chunkedInArray(Array.from(sessionByMatch.keys()), (chunk) =>
    db.select().from(matchResults).where(inArray(matchResults.matchId, chunk)),
  );
  const out: SessionResultRow[] = [];
  for (const r of resultRows) {
    const sessionId = sessionByMatch.get(r.matchId);
    if (!sessionId || r.team1Score == null || r.team2Score == null) continue;
    out.push({ sessionId, matchId: r.matchId, team1Score: r.team1Score, team2Score: r.team2Score });
  }
  return out;
}

export type SessionWins = { teamGreenWins: number; teamBlueWins: number };

/** Matches each side (team 1 = green, team 2 = blue) won, per session. */
export async function aggregateSessionWins(
  sessionIds: string[],
): Promise<Record<string, SessionWins>> {
  const wins: Record<string, SessionWins> = {};
  for (const r of await listResultsBySession(sessionIds)) {
    const cur = wins[r.sessionId] ?? { teamGreenWins: 0, teamBlueWins: 0 };
    if (r.team1Score > r.team2Score) cur.teamGreenWins += 1;
    else if (r.team2Score > r.team1Score) cur.teamBlueWins += 1;
    wins[r.sessionId] = cur;
  }
  return wins;
}
