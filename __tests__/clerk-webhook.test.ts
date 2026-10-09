import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The Clerk webhook is the one unauthenticated write path into `profiles`.
 * svix's signature check is the whole gate, so these pin that a request
 * reaches the database only after `verify()` accepts it.
 */

const verify = vi.fn();
vi.mock('svix', () => ({
  Webhook: class {
    verify = verify;
  },
}));
vi.mock('@/lib/db/queries/profiles', () => ({
  upsertProfile: vi.fn(async () => undefined),
  deleteProfile: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db/queries/admin', () => ({
  deleteUserAppData: vi.fn(async () => undefined),
  logAdminEvent: vi.fn(async () => undefined),
}));

const signed = (body: string) =>
  new Request('https://pickledcitizens.com/api/clerkwebhook', {
    method: 'POST',
    body,
    headers: { 'svix-id': 'msg_1', 'svix-timestamp': '1', 'svix-signature': 'v1,abc' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'whsec_test';
});

describe('POST /api/clerkwebhook', () => {
  it('refuses to run without a signing secret', async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const { POST } = await import('@/../app/api/clerkwebhook/route');
    const res = await POST(signed('{}'));
    expect(res.status).toBe(500);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a request with no svix headers before verifying', async () => {
    const { POST } = await import('@/../app/api/clerkwebhook/route');
    const res = await POST(
      new Request('https://pickledcitizens.com/api/clerkwebhook', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a bad signature and writes nothing', async () => {
    verify.mockImplementation(() => {
      throw new Error('No matching signature found');
    });
    const { POST } = await import('@/../app/api/clerkwebhook/route');
    const { upsertProfile } = await import('@/lib/db/queries/profiles');
    const res = await POST(signed('{"type":"user.created"}'));
    expect(res.status).toBe(401);
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it('upserts the profile from the verified payload, lower-casing the primary email', async () => {
    verify.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_1',
        primary_email_address_id: 'em_2',
        email_addresses: [
          { id: 'em_1', email_address: 'Old@Example.com' },
          { id: 'em_2', email_address: 'New@Example.com' },
        ],
        first_name: 'Pat',
        last_name: 'Lee',
        image_url: null,
      },
    });
    const { POST } = await import('@/../app/api/clerkwebhook/route');
    const { upsertProfile } = await import('@/lib/db/queries/profiles');
    const { logAdminEvent } = await import('@/lib/db/queries/admin');
    const res = await POST(signed('{}'));
    expect(res.status).toBe(200);
    expect(upsertProfile).toHaveBeenCalledWith({
      id: 'user_1',
      email: 'new@example.com',
      firstName: 'Pat',
      lastName: 'Lee',
      avatarUrl: null,
    });
    expect(logAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'user.signup', userId: 'user_1' }),
    );
  });
});
