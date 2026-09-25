import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDb } from './helpers/fake-db';

/**
 * The owned-or-participating session pipeline shared by the home page and
 * /sessions. Both loaders must see the same list in the same order.
 */

vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);

beforeEach(() => {
  vi.clearAllMocks();
});

const session = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  leagueId: null,
  createdBy: 'u1',
  createdAt: '2026-09-01T00:00:00Z',
  scheduledFor: null,
  playerCount: 8,
  ...extra,
});

describe('listSessionsForUser', () => {
  it('merges owned and played sessions, dedupes, names leagues and sorts newest first', async () => {
    const { listSessionsForUser } = await import('@/lib/db/queries/user-sessions');
    const h = useDb([
      [session('S1', { leagueId: 'L1', scheduledFor: '2026-09-05T00:00:00Z' })], // owned
      [{ matchId: 'M1', team: 2 }, { matchId: 'M2', team: 1 }], // match_players rows
      [{ id: 'M1', sessionId: 'S1' }, { id: 'M2', sessionId: 'S2' }], // their matches
      [
        session('S1', { leagueId: 'L1', scheduledFor: '2026-09-05T00:00:00Z' }),
        session('S2', { createdBy: 'other', scheduledFor: '2026-09-20T00:00:00Z' }),
      ], // participant sessions (S1 also owned)
      [{ id: 'L1', name: 'Tuesday Crew' }],
    ]);
    const { sessions, participation } = await listSessionsForUser('u1');
    expect(sessions.map((s) => s.id)).toEqual(['S2', 'S1']);
    expect(sessions[1]).toMatchObject({ leagueId: 'L1', leagueName: 'Tuesday Crew' });
    expect(sessions[0].leagueName).toBeNull();
    expect(participation).toEqual([
      { matchId: 'M1', sessionId: 'S1', team: 2 },
      { matchId: 'M2', sessionId: 'S2', team: 1 },
    ]);
    expect(h.selectsUsed()).toBe(5);
  });

  it('puts undated sessions last and falls back to creation time', async () => {
    const { listSessionsForUser } = await import('@/lib/db/queries/user-sessions');
    useDb([
      [
        session('undated', { createdAt: null }),
        session('created-late', { createdAt: '2026-09-10T00:00:00Z' }),
        session('scheduled-early', { scheduledFor: '2026-09-02T00:00:00Z' }),
      ],
      [], // played nothing
    ]);
    const { sessions } = await listSessionsForUser('u1');
    expect(sessions.map((s) => s.id)).toEqual(['created-late', 'scheduled-early', 'undated']);
  });

  it('returns nothing for a user with no sessions without querying further', async () => {
    const { listSessionsForUser } = await import('@/lib/db/queries/user-sessions');
    const h = useDb([[], []]);
    expect(await listSessionsForUser('nobody')).toEqual({ sessions: [], participation: [] });
    expect(h.selectsUsed()).toBe(2);
  });
});

describe('aggregateSessionWins', () => {
  it('counts each side\'s match wins per session and skips unfinished results', async () => {
    const { aggregateSessionWins } = await import('@/lib/db/queries/user-sessions');
    useDb([
      [
        { id: 'M1', sessionId: 'S1' },
        { id: 'M2', sessionId: 'S1' },
        { id: 'M3', sessionId: 'S1' },
        { id: 'M4', sessionId: 'S2' },
      ],
      [
        { matchId: 'M1', team1Score: 1, team2Score: 0 },
        { matchId: 'M2', team1Score: 0, team2Score: 1 },
        { matchId: 'M3', team1Score: 1, team2Score: 0 },
        { matchId: 'M4', team1Score: null, team2Score: null },
      ],
    ]);
    expect(await aggregateSessionWins(['S1', 'S2'])).toEqual({
      S1: { teamGreenWins: 2, teamBlueWins: 1 },
    });
  });

  it('is empty for no sessions', async () => {
    const { aggregateSessionWins } = await import('@/lib/db/queries/user-sessions');
    const h = useDb([]);
    expect(await aggregateSessionWins([])).toEqual({});
    expect(h.selectsUsed()).toBe(0);
  });
});
