import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDb } from './helpers/fake-db';

/**
 * Authorization tests.
 *
 * D1 has no RLS, so every one of these rules is the only thing standing between
 * a caller and someone else's data. See helpers/fake-db.ts for the harness.
 */

vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);

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
      [{ id: 'L1', ownerId: 'owner' }], // the target is not the owner
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
    const h = useDb([[{ id: 'L1', ownerId: 'owner' }], [{ role: 'admin' }], [{ count: 1 }]]);
    expect(await removeMember('admin1', 'L1', 'admin1')).toEqual({ removed: true });
    expect(h.deleteCalls).toHaveLength(1);
  });

  it('lets a player remove themselves', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([[{ id: 'L1', ownerId: 'owner' }], [{ role: 'player' }]]);
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
    const h = useDb([[{ id: 'L1', ownerId: 'owner' }], []]);
    expect(await removeMember('p1', 'L1', 'p1')).toEqual({ removed: false });
    expect(h.deleteCalls).toHaveLength(0);
  });

  it('refuses to let the owner leave, even with another admin in place', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([[{ id: 'L1', ownerId: 'owner' }]]);
    await expect(removeMember('owner', 'L1', 'owner')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.deleteCalls).toHaveLength(0);
  });

  it('refuses a co-admin removing the owner', async () => {
    const { removeMember } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [{ id: 'L1', ownerId: 'owner' }], // isLeagueAdmin: league lookup
      [{ role: 'admin' }], // isLeagueAdmin: the co-admin's role row
      [{ id: 'L1', ownerId: 'owner' }], // isLeagueOwner: the target is the owner
    ]);
    await expect(removeMember('coadmin', 'L1', 'owner')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.deleteCalls).toHaveLength(0);
  });
});

describe('updateMemberRole', () => {
  const league = { id: 'L1', ownerId: 'owner' };

  it('refuses to change the owner\'s role, whoever asks', async () => {
    const { updateMemberRole } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [league], // isLeagueAdmin: caller is a co-admin
      [{ role: 'admin' }],
      [league], // isLeagueOwner: target is the owner
    ]);
    await expect(updateMemberRole('coadmin', 'L1', 'owner', 'player')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.updates).toHaveLength(0);
  });

  it('refuses to demote the last admin server-side, not only in the click handler', async () => {
    const { updateMemberRole } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [league], // isLeagueAdmin: caller is the owner
      [league], // isLeagueOwner: target is not
      [{ count: 0 }], // no other admin rows remain
    ]);
    await expect(updateMemberRole('owner', 'L1', 'admin2', 'player')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.updates).toHaveLength(0);
  });

  it('demotes an admin when another admin row remains', async () => {
    const { updateMemberRole } = await import('@/lib/db/queries/leagues');
    const h = useDb([[league], [league], [{ count: 1 }]]);
    await updateMemberRole('owner', 'L1', 'admin2', 'player');
    expect(h.updates).toHaveLength(1);
  });

  it('promotes without counting admins', async () => {
    const { updateMemberRole } = await import('@/lib/db/queries/leagues');
    const h = useDb([[league], [league]]);
    await updateMemberRole('owner', 'L1', 'p1', 'admin');
    expect(h.updates).toHaveLength(1);
    expect(h.selectsUsed()).toBe(2);
  });

  it('rejects a plain member changing roles', async () => {
    const { updateMemberRole } = await import('@/lib/db/queries/leagues');
    const h = useDb([[league], [{ role: 'player' }]]);
    await expect(updateMemberRole('p1', 'L1', 'p2', 'admin')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(h.updates).toHaveLength(0);
  });
});

describe('listLeagueMemberIds', () => {
  it('includes the owner even without a league_members row', async () => {
    const { listLeagueMemberIds } = await import('@/lib/db/queries/leagues');
    useDb([[{ id: 'L1', ownerId: 'owner' }], [{ userId: 'a' }, { userId: 'b' }]]);
    expect(await listLeagueMemberIds('L1')).toEqual(new Set(['a', 'b', 'owner']));
  });

  it('is empty for a league that does not exist', async () => {
    const { listLeagueMemberIds } = await import('@/lib/db/queries/leagues');
    useDb([[], []]);
    expect(await listLeagueMemberIds('nope')).toEqual(new Set());
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

describe('createLeague (league cap + unique name)', () => {
  const owned = (id: string, name: string) => ({ id, name, ownerId: 'u1' });

  it('refuses a fourth league even though the page would also have blocked it', async () => {
    const { createLeague } = await import('@/lib/db/queries/leagues');
    const h = useDb([[owned('a', 'A'), owned('b', 'B'), owned('c', 'C')]]);
    await expect(createLeague('u1', { name: 'D' })).rejects.toMatchObject({ statusCode: 403 });
    expect(h.batches).toHaveLength(0);
  });

  it('refuses a name the caller already owns, ignoring case and spaces', async () => {
    const { createLeague } = await import('@/lib/db/queries/leagues');
    const h = useDb([[owned('a', 'Tuesday Crew')]]);
    await expect(createLeague('u1', { name: '  tuesday crew ' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.batches).toHaveLength(0);
  });

  it('creates when under the cap with a new name', async () => {
    const { createLeague } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [owned('a', 'A'), owned('b', 'B')],
      [{ id: 'new', name: 'C', ownerId: 'u1' }],
    ]);
    await expect(createLeague('u1', { name: 'C' })).resolves.toMatchObject({ name: 'C' });
    expect(h.batches).toHaveLength(1);
  });
});

describe('updateLeague (rename)', () => {
  it('refuses renaming onto another league the caller owns', async () => {
    const { updateLeague } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [{ id: 'a', ownerId: 'u1' }],
      [{ id: 'a', name: 'A', ownerId: 'u1' }, { id: 'b', name: 'Beta', ownerId: 'u1' }],
    ]);
    await expect(updateLeague('u1', 'a', { name: 'BETA' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(h.updates).toHaveLength(0);
  });

  it('allows a case-only rename of the same league', async () => {
    const { updateLeague } = await import('@/lib/db/queries/leagues');
    const h = useDb([[{ id: 'a', ownerId: 'u1' }], [{ id: 'a', name: 'alpha', ownerId: 'u1' }]]);
    await updateLeague('u1', 'a', { name: 'Alpha' });
    expect(h.updates).toHaveLength(1);
  });
});

describe('addGuests', () => {
  const guests = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ displayName: `G${i}`, dupr: 3 }));

  it('authorizes once and writes every guest in one batch, chunked under the param cap', async () => {
    const { addGuests } = await import('@/lib/db/queries/sessions');
    const h = useDb([[{ id: 's1', createdBy: 'u1', leagueId: 'L1' }]]);
    const ids = await addGuests('u1', 's1', guests(16));
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);
    expect(h.selectsUsed()).toBe(1);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(2); // 15 + 1
  });

  it('refuses a caller who cannot manage the session', async () => {
    const { addGuests } = await import('@/lib/db/queries/sessions');
    const h = useDb([
      [{ id: 's1', createdBy: 'owner', leagueId: 'L1' }],
      [{ id: 'L1', ownerId: 'owner' }],
    ]);
    await expect(addGuests('stranger', 's1', guests(1))).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(h.batches).toHaveLength(0);
  });

  it('does nothing for an empty guest list', async () => {
    const { addGuests } = await import('@/lib/db/queries/sessions');
    const h = useDb([]);
    expect(await addGuests('u1', 's1', [])).toEqual([]);
    expect(h.selectsUsed()).toBe(0);
  });
});
