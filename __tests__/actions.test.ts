import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDb } from './helpers/fake-db';

/**
 * Server-action layer. The query modules enforce the rules; these tests check
 * that the actions composing them return no more than their gate justifies
 * and refuse bad input before writing anything.
 */

vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/queries/admin', () => ({ logAdminEvent: vi.fn(async () => undefined) }));
vi.mock('@/lib/db/auth-helpers', () => {
  class AuthorizationError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
      this.name = 'AuthorizationError';
    }
  }
  return {
    AuthorizationError,
    requireUserId: vi.fn(),
    requireAdmin: vi.fn(),
    getCurrentEmail: vi.fn(async () => 'caller@example.com'),
  };
});

async function signInAs(userId: string) {
  const { requireUserId } = await import('@/lib/db/auth-helpers');
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

beforeEach(() => {
  vi.clearAllMocks();
});

const session = { id: 'S1', createdBy: 'creator', leagueId: 'L1', playerCount: 8 };
const league = { id: 'L1', name: 'Tuesday Crew', ownerId: 'creator' };

describe('getSessionDetail', () => {
  it('gives a former league member their old session without emails or the league roster', async () => {
    await signInAs('ex');
    const { getSessionDetail } = await import('@/lib/actions/sessions');
    const h = useDb([
      [session],
      [{ id: 'M1', sessionId: 'S1' }],
      [
        { matchId: 'M1', userId: 'ex', guestId: null, team: 1, position: 0 },
        { matchId: 'M1', userId: 'creator', guestId: null, team: 2, position: 0 },
      ],
      // "ex" played, so canViewSession needs no membership lookup.
      [{ matchId: 'M1', team1Score: 1, team2Score: 0 }],
      [{ id: 'G1', sessionId: 'S1', displayName: 'Guest' }],
      [
        { id: 'ex', email: 'ex@example.com', firstName: 'Ex', lastName: 'Member', selfReportedDupr: 3.5 },
        { id: 'creator', email: 'c@example.com', firstName: 'C', lastName: 'R', selfReportedDupr: 4 },
      ],
      [league],
      [league], // canManageSession → isLeagueOwner
    ]);
    const detail = await getSessionDetail('S1');
    expect(detail).not.toBeNull();
    expect(detail).not.toHaveProperty('leagueMembers');
    expect(detail!.profiles).toEqual([
      { id: 'ex', firstName: 'Ex', lastName: 'Member', selfReportedDupr: 3.5 },
      { id: 'creator', firstName: 'C', lastName: 'R', selfReportedDupr: 4 },
    ]);
    expect(JSON.stringify(detail)).not.toContain('@example.com');
    expect(detail).toMatchObject({
      leagueName: 'Tuesday Crew',
      viewerId: 'ex',
      canManage: false,
      results: [{ matchId: 'M1' }],
      guests: [{ id: 'G1' }],
    });
    expect(h.selectsUsed()).toBe(8);
  });

  it('returns null to a non-member before loading results, guests or profiles', async () => {
    await signInAs('stranger');
    const { getSessionDetail } = await import('@/lib/actions/sessions');
    const h = useDb([
      [session],
      [{ id: 'M1', sessionId: 'S1' }],
      [{ matchId: 'M1', userId: 'creator', guestId: null, team: 1, position: 0 }],
      [league], // isLeagueMember → league lookup
      [], // no membership row
    ]);
    expect(await getSessionDetail('S1')).toBeNull();
    expect(h.selectsUsed()).toBe(5);
  });

  it('returns null for a session that does not exist', async () => {
    await signInAs('anyone');
    const { getSessionDetail } = await import('@/lib/actions/sessions');
    const h = useDb([[]]);
    expect(await getSessionDetail('missing')).toBeNull();
    expect(h.selectsUsed()).toBe(1);
  });
});

describe('createSessionWithTeamsAction', () => {
  const input = {
    leagueId: 'L1',
    scheduledFor: null,
    playerCount: 8 as const,
    guests: [],
    matches: [
      {
        scheduledOrder: 0,
        players: [
          { userId: 'caller', team: 1 as const, position: 0 as const },
          { userId: 'intruder', team: 2 as const, position: 0 as const },
        ],
      },
    ],
  };

  it('refuses a user ID that is not a league member before creating anything', async () => {
    await signInAs('caller');
    const { createSessionWithTeamsAction } = await import('@/lib/actions/sessions');
    const h = useDb([
      [league], // isLeagueMember → league lookup (caller is not the owner)
      [{ userId: 'caller' }], // caller's membership row
      [league], // listLeagueMemberIds → league lookup
      [{ userId: 'caller' }, { userId: 'm2' }], // roster: no "intruder"
    ]);
    await expect(createSessionWithTeamsAction(input)).rejects.toThrow(
      'Every player must be a member of this league',
    );
    expect(h.selectsUsed()).toBe(4);
    expect(h.batches).toEqual([]);
  });

  it('refuses a caller who is not in the league at all', async () => {
    await signInAs('outsider');
    const { createSessionWithTeamsAction } = await import('@/lib/actions/sessions');
    const h = useDb([[league], []]);
    await expect(createSessionWithTeamsAction(input)).rejects.toThrow(
      'Not a member of this league',
    );
    expect(h.selectsUsed()).toBe(2);
  });
});
