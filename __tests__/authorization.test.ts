import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Authorization tests.
 *
 * D1 has no RLS, so every one of these rules is the only thing standing between
 * a caller and someone else's data. The query modules depend on nothing but
 * `getDbAsync`, so stubbing that is enough to drive them without a database.
 */

type Row = Record<string, unknown>;

/**
 * Minimal stand-in for the Drizzle query builder. `select()` pops the next
 * queued result set, so a test declares results in the order the code under
 * test asks for them. The chain is thenable at every step because callers await
 * it after `.where()` in some paths and after `.limit(1)` in others.
 */
function makeDb(selectResults: Row[][]) {
  let cursor = 0;
  const deleteCalls: number[] = [];

  const chainFor = (rows: Row[]) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.from = self;
    chain.where = self;
    chain.limit = self;
    chain.orderBy = self;
    chain.offset = self;
    chain.then = (resolve: (v: Row[]) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject);
    return chain;
  };

  const db = {
    select: () => chainFor(selectResults[cursor++] ?? []),
    delete: () => ({
      where: () => {
        deleteCalls.push(1);
        return Promise.resolve(undefined);
      },
    }),
  };

  return { db, deleteCalls, selectsUsed: () => cursor };
}

const dbMock = vi.hoisted(() => ({ getDbAsync: vi.fn() }));
vi.mock('@/lib/db/client', () => dbMock);

function useDb(selectResults: Row[][]) {
  const harness = makeDb(selectResults);
  dbMock.getDbAsync.mockResolvedValue(harness.db);
  return harness;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chunkedInArray', () => {
  it('returns early on an empty list without calling the runner', async () => {
    const { chunkedInArray } = await import('@/lib/db/chunk');
    const runner = vi.fn();
    expect(await chunkedInArray([], runner)).toEqual([]);
    expect(runner).not.toHaveBeenCalled();
  });

  it('issues a single statement at exactly the 90-parameter cap', async () => {
    const { chunkedInArray } = await import('@/lib/db/chunk');
    const ids = Array.from({ length: 90 }, (_, i) => i);
    const runner = vi.fn(async (chunk: number[]) => chunk);
    await chunkedInArray(ids, runner);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][0]).toHaveLength(90);
  });

  it('splits at 91 — the first size that would exceed D1 s limit', async () => {
    const { chunkedInArray } = await import('@/lib/db/chunk');
    const ids = Array.from({ length: 91 }, (_, i) => i);
    const runner = vi.fn(async (chunk: number[]) => chunk);
    await chunkedInArray(ids, runner);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner.mock.calls.map((c) => c[0].length)).toEqual([90, 1]);
  });

  it('never exceeds the cap and preserves order across many chunks', async () => {
    const { chunkedInArray } = await import('@/lib/db/chunk');
    const ids = Array.from({ length: 200 }, (_, i) => i);
    const runner = vi.fn(async (chunk: number[]) => chunk);
    const out = await chunkedInArray(ids, runner);
    expect(runner.mock.calls.every((c) => c[0].length <= 90)).toBe(true);
    expect(out).toEqual(ids);
  });
});

describe('isLeagueMember', () => {
  it('accepts the owner without needing a league_members row', async () => {
    const { isLeagueMember } = await import('@/lib/db/queries/leagues');
    // Only the league lookup is queried; no membership select is consumed.
    const h = useDb([[{ id: 'L1', ownerId: 'owner' }]]);
    expect(await isLeagueMember('L1', 'owner')).toBe(true);
    expect(h.selectsUsed()).toBe(1);
  });

  it('accepts a non-owner that has a membership row', async () => {
    const { isLeagueMember } = await import('@/lib/db/queries/leagues');
    useDb([[{ id: 'L1', ownerId: 'owner' }], [{ userId: 'member' }]]);
    expect(await isLeagueMember('L1', 'member')).toBe(true);
  });

  it('rejects a user with no membership row', async () => {
    const { isLeagueMember } = await import('@/lib/db/queries/leagues');
    useDb([[{ id: 'L1', ownerId: 'owner' }], []]);
    expect(await isLeagueMember('L1', 'stranger')).toBe(false);
  });

  it('rejects when the league does not exist', async () => {
    const { isLeagueMember } = await import('@/lib/db/queries/leagues');
    useDb([[], []]);
    expect(await isLeagueMember('missing', 'anyone')).toBe(false);
  });
});

describe('canManageSession', () => {
  it('allows the creator without touching the database', async () => {
    const { canManageSession } = await import('@/lib/db/queries/sessions');
    const h = useDb([]);
    expect(
      await canManageSession('creator', { createdBy: 'creator', leagueId: 'L1' }),
    ).toBe(true);
    expect(h.selectsUsed()).toBe(0);
  });

  it('allows the league owner who did not create the session', async () => {
    const { canManageSession } = await import('@/lib/db/queries/sessions');
    useDb([[{ id: 'L1', ownerId: 'owner' }]]);
    expect(
      await canManageSession('owner', { createdBy: 'someone-else', leagueId: 'L1' }),
    ).toBe(true);
  });

  it('rejects a plain league member', async () => {
    const { canManageSession } = await import('@/lib/db/queries/sessions');
    useDb([[{ id: 'L1', ownerId: 'owner' }]]);
    expect(
      await canManageSession('member', { createdBy: 'creator', leagueId: 'L1' }),
    ).toBe(false);
  });

  it('rejects a non-creator on a league-less session', async () => {
    const { canManageSession } = await import('@/lib/db/queries/sessions');
    useDb([]);
    expect(
      await canManageSession('stranger', { createdBy: 'creator', leagueId: null }),
    ).toBe(false);
  });
});

describe('canViewSession', () => {
  it('allows the creator', async () => {
    const { canViewSession } = await import('@/lib/db/queries/sessions');
    useDb([]);
    expect(
      await canViewSession('creator', { createdBy: 'creator', leagueId: 'L1' }, []),
    ).toBe(true);
  });

  it('allows a league member who did not play', async () => {
    const { canViewSession } = await import('@/lib/db/queries/sessions');
    useDb([[{ id: 'L1', ownerId: 'owner' }], [{ userId: 'member' }]]);
    expect(
      await canViewSession('member', { createdBy: 'creator', leagueId: 'L1' }, []),
    ).toBe(true);
  });

  it('rejects a signed-in stranger holding only the session ID', async () => {
    const { canViewSession } = await import('@/lib/db/queries/sessions');
    useDb([[{ id: 'L1', ownerId: 'owner' }], []]);
    expect(
      await canViewSession('stranger', { createdBy: 'creator', leagueId: 'L1' }, [
        'p1',
        'p2',
      ]),
    ).toBe(false);
  });

  it('keeps participants of an orphaned session (league deleted, league_id nulled)', async () => {
    const { canViewSession } = await import('@/lib/db/queries/sessions');
    const h = useDb([]);
    expect(
      await canViewSession('p2', { createdBy: 'creator', leagueId: null }, ['p1', 'p2']),
    ).toBe(true);
    // Resolved from data already in hand — no league lookup is possible here.
    expect(h.selectsUsed()).toBe(0);
  });

  it('rejects a stranger on an orphaned session', async () => {
    const { canViewSession } = await import('@/lib/db/queries/sessions');
    useDb([]);
    expect(
      await canViewSession('stranger', { createdBy: 'creator', leagueId: null }, ['p1']),
    ).toBe(false);
  });

  it('ignores the null user IDs that guest rows contribute', async () => {
    const { canViewSession } = await import('@/lib/db/queries/sessions');
    useDb([[{ id: 'L1', ownerId: 'owner' }], []]);
    // match_players rows for guests carry userId === null; a caller must never
    // match on those.
    expect(
      await canViewSession('stranger', { createdBy: 'creator', leagueId: 'L1' }, [
        null,
        null,
      ]),
    ).toBe(false);
  });
});

describe('removeMember', () => {
  it('refuses to remove the last admin', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [{ role: 'admin' }], // the target's membership
      [{ count: 0 }], // no other admins remain
    ]);
    await expect(removeMember('admin1', 'L1', 'admin1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.deleteCalls).toHaveLength(0);
  });

  it('removes an admin when another admin remains', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([[{ role: 'admin' }], [{ count: 1 }]]);
    expect(await removeMember('admin1', 'L1', 'admin1')).toEqual({ removed: true });
    expect(h.deleteCalls).toHaveLength(1);
  });

  it('lets a player remove themselves', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([[{ role: 'player' }]]);
    expect(await removeMember('p1', 'L1', 'p1')).toEqual({ removed: true });
    expect(h.deleteCalls).toHaveLength(1);
  });

  it('rejects a non-admin removing somebody else', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    // isLeagueAdmin: league lookup (not owner), then membership role lookup.
    const h = useDb([[{ id: 'L1', ownerId: 'owner' }], []]);
    await expect(removeMember('p1', 'L1', 'p2')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(h.deleteCalls).toHaveLength(0);
  });

  it('reports removed: false for a user who is not a member', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([[]]);
    expect(await removeMember('p1', 'L1', 'p1')).toEqual({ removed: false });
    expect(h.deleteCalls).toHaveLength(0);
  });
});

describe('clearMatchResult', () => {
  it('fails closed on a match that does not exist', async () => {
    const { clearMatchResult } = await import('@/lib/db/queries/matches');
    // The old inline version skipped the manager check when this lookup missed.
    const h = useDb([[]]);
    await expect(clearMatchResult('anyone', 'missing')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(h.deleteCalls).toHaveLength(0);
  });

  it('rejects a league member who cannot manage the session', async () => {
    const { clearMatchResult } = await import('@/lib/db/queries/matches');
    const h = useDb([
      [{ id: 'M1', sessionId: 'S1' }], // the match
      [{ id: 'S1', createdBy: 'creator', leagueId: 'L1' }], // its session
      [{ id: 'L1', ownerId: 'owner' }], // league lookup for the owner check
    ]);
    await expect(clearMatchResult('member', 'M1')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(h.deleteCalls).toHaveLength(0);
  });

  it('lets the league owner clear a result on a session they did not create', async () => {
    const { clearMatchResult } = await import('@/lib/db/queries/matches');
    const h = useDb([
      [{ id: 'M1', sessionId: 'S1' }],
      [{ id: 'S1', createdBy: 'creator', leagueId: 'L1' }],
      [{ id: 'L1', ownerId: 'owner' }],
    ]);
    await clearMatchResult('owner', 'M1');
    expect(h.deleteCalls).toHaveLength(1);
  });
});
