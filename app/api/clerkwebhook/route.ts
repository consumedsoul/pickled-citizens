import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { upsertProfile, deleteProfile } from '@/lib/db/queries/profiles';
import { deleteUserAppData, logAdminEvent } from '@/lib/db/queries/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Clerk webhook receiver.
 *
 * Handles user lifecycle events from Clerk:
 *  - user.created  -> create a profile row keyed by Clerk user ID
 *  - user.updated  -> sync email and name fields
 *  - user.deleted  -> cascade-delete app data
 *
 * Set CLERK_WEBHOOK_SIGNING_SECRET in Cloudflare secrets and configure the
 * endpoint in Clerk Dashboard > Webhooks > Endpoints.
 */
export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CLERK_WEBHOOK_SIGNING_SECRET not configured' },
      { status: 500 },
    );
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  const body = await request.text();
  let event: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const u = event.data;
      const primaryEmail =
        u.email_addresses.find((e) => e.id === u.primary_email_address_id)?.email_address ??
        u.email_addresses[0]?.email_address ??
        null;

      await upsertProfile({
        id: u.id,
        email: primaryEmail?.toLowerCase() ?? null,
        firstName: u.first_name ?? null,
        lastName: u.last_name ?? null,
        avatarUrl: u.image_url ?? null,
      });

      if (event.type === 'user.created') {
        await logAdminEvent({
          eventType: 'user.signup',
          userId: u.id,
          userEmail: primaryEmail?.toLowerCase() ?? null,
          payload: { source: 'clerk_webhook' },
        });
      }
      break;
    }
    case 'user.deleted': {
      const userId = event.data.id;
      if (userId) {
        await deleteUserAppData(userId, null);
        await deleteProfile(userId);
        await logAdminEvent({
          eventType: 'user.deleted',
          userId,
          payload: { source: 'clerk_webhook' },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
