import { eq, inArray } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { chunkedInArray } from '../chunk';
import { gameSessions, matches, matchPlayers, matchResults } from '../schema';
import { computeStandings, type RatedGame, type Standings } from '@/lib/rating';

/**
 * Read path for the league ranking board. `leagueId` is the subject, not a
 * gate: the calling server action must have checked membership first.
 *
 * Every fully scored game in the league's sessions, shaped for the rating
 * engine. Guests are counted per side but never identified, since a guest row
 * belongs to a single session.
 */
export async function listRatedGamesForLeague(leagueId: string): Promise<RatedGame[]> {
  const db = await getDbAsync();

  const sessions = await db
    .select({
      id: gameSessions.id,
      scheduledFor: gameSessions.scheduledFor,
      createdAt: gameSessions.createdAt,
    })
    .from(gameSessions)
    .where(eq(gameSessions.leagueId, leagueId));
  if (sessions.length === 0) return [];
  const sessionTime = new Map(
    sessions.map((s) => [s.id, s.scheduledFor ?? s.createdAt ?? '']),
  );

  const matchRows = await chunkedInArray(Array.from(sessionTime.keys()), (chunk) =>
    db
      .select({
        id: matches.id,
        sessionId: matches.sessionId,
        scheduledOrder: matches.scheduledOrder,
      })
      .from(matches)
      .where(inArray(matches.sessionId, chunk)),
  );
  if (matchRows.length === 0) return [];
  const matchIds = matchRows.map((m) => m.id);

  const resultRows = await chunkedInArray(matchIds, (chunk) =>
    db.select().from(matchResults).where(inArray(matchResults.matchId, chunk)),
  );
  const resultByMatch = new Map(resultRows.map((r) => [r.matchId, r]));

  const playerRows = await chunkedInArray(matchIds, (chunk) =>
    db
      .select({
        matchId: matchPlayers.matchId,
        userId: matchPlayers.userId,
        guestId: matchPlayers.guestId,
        team: matchPlayers.team,
      })
      .from(matchPlayers)
      .where(inArray(matchPlayers.matchId, chunk)),
  );
  const playersByMatch = new Map<string, typeof playerRows>();
  for (const p of playerRows) {
    const list = playersByMatch.get(p.matchId) ?? [];
    list.push(p);
    playersByMatch.set(p.matchId, list);
  }

  const games: RatedGame[] = [];
  for (const m of matchRows) {
    const r = resultByMatch.get(m.id);
    if (!r || r.team1Score == null || r.team2Score == null) continue;
    const team1 = { userIds: [] as string[], guestCount: 0 };
    const team2 = { userIds: [] as string[], guestCount: 0 };
    for (const p of playersByMatch.get(m.id) ?? []) {
      const side = p.team === 1 ? team1 : team2;
      if (p.userId) side.userIds.push(p.userId);
      else if (p.guestId) side.guestCount += 1;
    }
    games.push({
      matchId: m.id,
      sessionId: m.sessionId,
      // Session time first so a score typed in late still lands in its week;
      // completedAt only breaks ties inside one session.
      playedAt: `${sessionTime.get(m.sessionId) ?? ''}|${r.completedAt ?? ''}`,
      order: m.scheduledOrder ?? 0,
      team1,
      team2,
      team1Score: r.team1Score,
      team2Score: r.team2Score,
    });
  }
  return games;
}

export async function getLeagueStandings(leagueId: string): Promise<Standings> {
  return computeStandings(await listRatedGamesForLeague(leagueId));
}
