import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDb } from './helpers/fake-db';

/**
 * Shapes a league's D1 rows into games for the standings engine. Guests become
 * a per-side count, unscored matches are dropped, and ordering follows the
 * session's time so a late-entered score still lands in its own week.
 */

vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listSessionGamesForLeague', () => {
  it('returns one game per fully scored match with members and guests split per side', async () => {
    const { listSessionGamesForLeague } = await import('@/lib/db/queries/league-standings');
    const h = useDb([
      [
        { id: 'S1', scheduledFor: '2026-09-01T18:00:00Z', createdAt: '2026-08-30T00:00:00Z' },
        { id: 'S2', scheduledFor: null, createdAt: '2026-09-08T00:00:00Z' },
      ],
      [
        { id: 'M1', sessionId: 'S1', scheduledOrder: 1 },
        { id: 'M2', sessionId: 'S1', scheduledOrder: 2 }, // no result → dropped
        { id: 'M3', sessionId: 'S2', scheduledOrder: 1 },
        { id: 'M4', sessionId: 'S2', scheduledOrder: 2 }, // half-scored → dropped
      ],
      [
        { matchId: 'M1', team1Score: 1, team2Score: 0, completedAt: '2026-09-01T18:30:00Z' },
        { matchId: 'M3', team1Score: 0, team2Score: 1, completedAt: null },
        { matchId: 'M4', team1Score: 1, team2Score: null, completedAt: null },
      ],
      [
        { matchId: 'M1', userId: 'a', guestId: null, team: 1 },
        { matchId: 'M1', userId: null, guestId: 'g1', team: 1 },
        { matchId: 'M1', userId: 'c', guestId: null, team: 2 },
        { matchId: 'M1', userId: 'd', guestId: null, team: 2 },
        { matchId: 'M3', userId: 'a', guestId: null, team: 1 },
        { matchId: 'M3', userId: 'c', guestId: null, team: 1 },
        { matchId: 'M3', userId: 'b', guestId: null, team: 2 },
        { matchId: 'M3', userId: 'd', guestId: null, team: 2 },
      ],
    ]);
    const games = await listSessionGamesForLeague('L1');
    expect(games.map((g) => g.matchId)).toEqual(['M1', 'M3']);
    expect(games[0]).toMatchObject({
      sessionId: 'S1',
      order: 1,
      team1: { userIds: ['a'], guestCount: 1 },
      team2: { userIds: ['c', 'd'], guestCount: 0 },
      team1Score: 1,
      team2Score: 0,
    });
    // Session time leads; completion time only breaks ties within a session.
    expect(games[0].playedAt).toBe('2026-09-01T18:00:00Z|2026-09-01T18:30:00Z');
    expect(games[1].playedAt).toBe('2026-09-08T00:00:00Z|');
    expect(h.selectsUsed()).toBe(4);
  });

  it('short-circuits a league with no sessions or no matches', async () => {
    const { listSessionGamesForLeague } = await import('@/lib/db/queries/league-standings');
    let h = useDb([[]]);
    expect(await listSessionGamesForLeague('L1')).toEqual([]);
    expect(h.selectsUsed()).toBe(1);
    h = useDb([[{ id: 'S1', scheduledFor: null, createdAt: null }], []]);
    expect(await listSessionGamesForLeague('L1')).toEqual([]);
    expect(h.selectsUsed()).toBe(2);
  });

  it('getLeagueStandings runs the engine over the shaped games', async () => {
    const { getLeagueStandings } = await import('@/lib/db/queries/league-standings');
    useDb([
      [{ id: 'S1', scheduledFor: '2026-09-01T18:00:00Z', createdAt: null }],
      [
        { id: 'M1', sessionId: 'S1', scheduledOrder: 1 },
        { id: 'M2', sessionId: 'S1', scheduledOrder: 2 },
      ],
      [
        { matchId: 'M1', team1Score: 1, team2Score: 0, completedAt: null },
        { matchId: 'M2', team1Score: 0, team2Score: 1, completedAt: null },
      ],
      [
        { matchId: 'M1', userId: 'a', guestId: null, team: 1 },
        { matchId: 'M1', userId: 'b', guestId: null, team: 1 },
        { matchId: 'M1', userId: 'c', guestId: null, team: 2 },
        { matchId: 'M1', userId: 'd', guestId: null, team: 2 },
        { matchId: 'M2', userId: 'a', guestId: null, team: 1 },
        { matchId: 'M2', userId: 'd', guestId: null, team: 1 },
        { matchId: 'M2', userId: 'c', guestId: null, team: 2 },
        { matchId: 'M2', userId: 'b', guestId: null, team: 2 },
      ],
    ]);
    const standings = await getLeagueStandings('L1');
    expect(standings.gamesCounted).toBe(2);
    expect(standings.recentSessionId).toBe('S1');
    const a = standings.players.find((p) => p.userId === 'a')!;
    expect(a).toMatchObject({ games: 2, wins: 1, losses: 1, winPct: 0.5 });
    // c was across the net from a in both games.
    expect(a.rivals).toEqual([{ userId: 'c', wins: 1, losses: 1, games: 2 }]);
  });
});
