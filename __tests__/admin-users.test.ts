import { describe, it, expect, vi } from 'vitest';
import { useDb } from './helpers/fake-db';

vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);

/**
 * The super-admin can add a freshly created user to leagues from the create
 * form. Unlike `addMember`, there is no league-admin gate here — the route is
 * `requireAdmin()`-gated — so the query must at least refuse ids that are not
 * real leagues and must never touch rows that already exist.
 */
describe('adminAddUserToLeagues', () => {
  it('does nothing when no leagues were picked', async () => {
    const fake = useDb([]);
    const { adminAddUserToLeagues } = await import('@/lib/db/queries/admin');
    const joined = await adminAddUserToLeagues('u1', 'a@b.c', []);
    expect(joined).toEqual([]);
    expect(fake.selectsUsed()).toBe(0);
    expect(fake.inserts).toHaveLength(0);
  });

  it('skips ids that are not leagues and inserts player rows for the rest', async () => {
    const fake = useDb([[{ id: 'L1' }, { id: 'L2' }]]);
    const { adminAddUserToLeagues } = await import('@/lib/db/queries/admin');
    const joined = await adminAddUserToLeagues('u1', 'a@b.c', ['L1', 'L2', 'L2', 'bogus']);
    expect(joined).toEqual(['L1', 'L2']);
    expect(fake.inserts).toHaveLength(1);
    const rows = fake.inserts[0] as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.leagueId)).toEqual(['L1', 'L2']);
    expect(rows.every((r) => r.userId === 'u1' && r.role === 'player')).toBe(true);
  });

  it('writes nothing when none of the ids are leagues', async () => {
    const fake = useDb([[]]);
    const { adminAddUserToLeagues } = await import('@/lib/db/queries/admin');
    const joined = await adminAddUserToLeagues('u1', 'a@b.c', ['bogus']);
    expect(joined).toEqual([]);
    expect(fake.inserts).toHaveLength(0);
  });
});
