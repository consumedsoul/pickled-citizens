import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('splits the membership insert so no statement binds more than 90 values', async () => {
    // 5 bound values per row: 19 rows is 95 params in one statement, over D1's cap.
    const ids = Array.from({ length: 19 }, (_, i) => `L${i}`);
    const fake = useDb([ids.map((id) => ({ id }))]);
    const { adminAddUserToLeagues } = await import('@/lib/db/queries/admin');
    const joined = await adminAddUserToLeagues('u1', 'a@b.c', ids);
    expect(joined).toEqual(ids);
    expect(fake.inserts).toHaveLength(2);
    const sizes = fake.inserts.map((rows) => (rows as unknown[]).length);
    expect(sizes).toEqual([18, 1]);
    expect(Math.max(...sizes) * 5).toBeLessThanOrEqual(90);
  });
});

/**
 * Route-level checks for /api/admin/users: the gate runs before any Clerk or
 * database call, every body field is validated on the server, and the two
 * failure modes the UI cannot recover from on its own — a duplicate email and
 * a create that died after the Clerk account existed — come back with a
 * specific message instead of a generic 500.
 */
const clerkUsers = {
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
};
vi.mock('@/lib/clerk', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clerk')>('@/lib/clerk');
  return { ...actual, clerkBackend: () => ({ users: clerkUsers }) };
});
vi.mock('@/lib/db/queries/profiles', () => ({
  upsertProfile: vi.fn(async () => undefined),
  updateProfile: vi.fn(async () => undefined),
}));
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
  return { AuthorizationError, requireAdmin: vi.fn() };
});

const request = (method: string, body: unknown) =>
  new Request('https://pickledcitizens.com/api/admin/users', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as import('next/server').NextRequest;

async function asAdmin() {
  const { requireAdmin } = await import('@/lib/db/auth-helpers');
  vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin', email: 'hun@ghkim.com' });
}

beforeEach(() => {
  vi.clearAllMocks();
  clerkUsers.createUser.mockResolvedValue({ id: 'user_new' });
  clerkUsers.updateUser.mockResolvedValue({ id: 'user_1' });
});

describe('POST /api/admin/users', () => {
  it('refuses a non-admin before touching Clerk or the database', async () => {
    const { requireAdmin, AuthorizationError } = await import('@/lib/db/auth-helpers');
    vi.mocked(requireAdmin).mockRejectedValue(new AuthorizationError(403, 'Admin access required'));
    const { POST } = await import('@/../app/api/admin/users/route');
    const res = await POST(request('POST', { email: 'x@example.com' }));
    expect(res.status).toBe(403);
    expect(clerkUsers.createUser).not.toHaveBeenCalled();
  });

  it('rejects a non-dupr.com link, a bad league list and a non-string name', async () => {
    await asAdmin();
    const { POST } = await import('@/../app/api/admin/users/route');
    const bad = [
      { email: 'x@example.com', dupr_url: 'https://evil.example/player/1' },
      { email: 'x@example.com', league_ids: 'L1' },
      { email: 'x@example.com', league_ids: [1] },
      { email: 'x@example.com', first_name: { $gt: '' } },
      { email: 'x@example.com', last_name: 'x'.repeat(101) },
    ];
    for (const body of bad) {
      const res = await POST(request('POST', body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(clerkUsers.createUser).not.toHaveBeenCalled();
  });

  it('creates the Clerk user with trimmed names, then the profile and league rows', async () => {
    await asAdmin();
    useDb([[{ id: 'L1' }]]);
    const { POST } = await import('@/../app/api/admin/users/route');
    const { upsertProfile } = await import('@/lib/db/queries/profiles');
    const res = await POST(
      request('POST', {
        email: ' New@Example.com ',
        first_name: '  Pat ',
        last_name: '',
        self_reported_dupr: 3.5,
        dupr_url: 'http://dupr.com/dashboard/player/42/',
        league_ids: ['L1'],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: 'user_new' });
    expect(clerkUsers.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: ['new@example.com'], firstName: 'Pat', lastName: undefined }),
    );
    expect(upsertProfile).toHaveBeenCalledWith({
      id: 'user_new',
      email: 'new@example.com',
      firstName: 'Pat',
      lastName: null,
      selfReportedDupr: 3.5,
      duprUrl: 'https://dashboard.dupr.com/dashboard/player/42',
    });
  });

  it('answers a duplicate email with 409 and says to edit instead', async () => {
    await asAdmin();
    clerkUsers.createUser.mockRejectedValue({
      clerkError: true,
      status: 422,
      errors: [{ code: 'form_identifier_exists', longMessage: 'That email address is taken.' }],
    });
    const { POST } = await import('@/../app/api/admin/users/route');
    const { upsertProfile } = await import('@/lib/db/queries/profiles');
    const res = await POST(request('POST', { email: 'dup@example.com' }));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/dup@example.com already exists/);
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it('reports a create that failed after Clerk with the new user id, and logs it', async () => {
    await asAdmin();
    const fake = useDb([]);
    const { upsertProfile } = await import('@/lib/db/queries/profiles');
    vi.mocked(upsertProfile).mockRejectedValueOnce(new Error('D1_ERROR: too many SQL variables'));
    const { POST } = await import('@/../app/api/admin/users/route');
    const res = await POST(request('POST', { email: 'half@example.com', league_ids: ['L1'] }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string; userId?: string };
    expect(json.userId).toBe('user_new');
    expect(json.error).toMatch(/was created, but/);
    expect(json.error).toMatch(/Edit the user/);
    // The audit row is the only insert: no league rows were attempted.
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]).toMatchObject({ eventType: 'admin.user_create_partial' });
  });
});

describe('PATCH /api/admin/users', () => {
  it('trims the names it stores and mirrors the same values to Clerk', async () => {
    await asAdmin();
    useDb([]);
    const { PATCH } = await import('@/../app/api/admin/users/route');
    const { updateProfile } = await import('@/lib/db/queries/profiles');
    const res = await PATCH(
      request('PATCH', { userId: 'user_1', first_name: ' Sam ', last_name: '  ', self_reported_dupr: null }),
    );
    expect(res.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith('user_1', {
      firstName: 'Sam',
      lastName: null,
      selfReportedDupr: null,
    });
    expect(clerkUsers.updateUser).toHaveBeenCalledWith('user_1', { firstName: 'Sam', lastName: '' });
  });

  it('refuses a non-string name before writing', async () => {
    await asAdmin();
    const { PATCH } = await import('@/../app/api/admin/users/route');
    const { updateProfile } = await import('@/lib/db/queries/profiles');
    const res = await PATCH(request('PATCH', { userId: 'user_1', first_name: 42 }));
    expect(res.status).toBe(400);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(clerkUsers.updateUser).not.toHaveBeenCalled();
  });
});
