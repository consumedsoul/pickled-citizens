import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDb } from './helpers/fake-db';

/**
 * The "my leagues" list shared by /leagues, home and the profile page. The
 * league cap counts `leagues.owner_id`, so this list must include every owned
 * league even when the owner has no league_members row — otherwise an owner
 * can be told they are at the cap while seeing fewer leagues than that.
 */

vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);

beforeEach(() => {
  vi.clearAllMocks();
});

const league = (id: string, ownerId: string) => ({ id, name: `League ${id}`, ownerId });

describe('listLeaguesForUser', () => {
  it('lists an owned league as admin even without a league_members row', async () => {
    const { listLeaguesForUser } = await import('@/lib/db/queries/leagues');
    const h = useDb([
      [], // memberships
      [league('L1', 'owner')], // owned
      [{ leagueId: 'L1', n: 3 }], // member counts
    ]);
    expect(await listLeaguesForUser('owner')).toEqual([
      { ...league('L1', 'owner'), role: 'admin', memberCount: 3 },
    ]);
    expect(h.selectsUsed()).toBe(3);
  });

  it('merges owned and joined leagues without listing an owned league twice', async () => {
    const { listLeaguesForUser } = await import('@/lib/db/queries/leagues');
    useDb([
      [
        { leagueId: 'L1', role: 'player' }, // stale row: owner demoted before the guard
        { leagueId: 'L2', role: 'player' },
      ],
      [league('L1', 'me')],
      [league('L2', 'other')], // only L2 is fetched by membership
      [
        { leagueId: 'L1', n: 2 },
        { leagueId: 'L2', n: 5 },
      ],
    ]);
    const rows = await listLeaguesForUser('me');
    expect(rows.map((l) => [l.id, l.role, l.memberCount])).toEqual([
      ['L1', 'admin', 2],
      ['L2', 'player', 5],
    ]);
  });

  it('reports a non-owner admin row as admin', async () => {
    const { listLeaguesForUser } = await import('@/lib/db/queries/leagues');
    useDb([[{ leagueId: 'L2', role: 'admin' }], [], [league('L2', 'other')], []]);
    const rows = await listLeaguesForUser('me');
    expect(rows).toEqual([{ ...league('L2', 'other'), role: 'admin', memberCount: 0 }]);
  });

  it('is empty for a user in no leagues without querying further', async () => {
    const { listLeaguesForUser } = await import('@/lib/db/queries/leagues');
    const h = useDb([[], []]);
    expect(await listLeaguesForUser('nobody')).toEqual([]);
    expect(h.selectsUsed()).toBe(2);
  });
});
