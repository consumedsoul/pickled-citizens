import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { requireAdmin, AuthorizationError } from '@/lib/db/auth-helpers';
import { upsertProfile, updateProfile } from '@/lib/db/queries/profiles';
import { deleteUserAppData, logAdminEvent } from '@/lib/db/queries/admin';

function clerk() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY not configured');
  return createClerkClient({ secretKey: secret });
}

function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  return null;
}

/** POST /api/admin/users — Create a new user (admin only). */
export async function POST(request: NextRequest) {
  try {
    const { email: callerEmail } = await requireAdmin();

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      first_name?: string;
      last_name?: string;
      self_reported_dupr?: number | null;
    } | null;

    if (!body?.email?.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    const email = body.email.trim().toLowerCase();

    if (body.self_reported_dupr != null) {
      const dupr = body.self_reported_dupr;
      if (dupr < 1.0 || dupr > 8.5) {
        return NextResponse.json(
          { error: 'DUPR must be between 1.0 and 8.5.' },
          { status: 400 },
        );
      }
    }

    // Create the Clerk user (skipping verification so admin can pre-create accounts).
    const created = await clerk().users.createUser({
      emailAddress: [email],
      skipPasswordRequirement: true,
      skipPasswordChecks: true,
    });

    await upsertProfile({
      id: created.id,
      email,
      firstName: body.first_name?.trim() || null,
      lastName: body.last_name?.trim() || null,
      selfReportedDupr: body.self_reported_dupr ?? null,
    });

    await logAdminEvent({
      eventType: 'admin.user_created',
      userEmail: callerEmail,
      payload: { created_user_id: created.id, created_email: email },
    });

    return NextResponse.json({ ok: true, userId: created.id });
  } catch (err) {
    const auth = handleAuthError(err);
    if (auth) return auth;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/admin/users — Update a user's profile (admin only). */
export async function PATCH(request: NextRequest) {
  try {
    const { email: callerEmail } = await requireAdmin();

    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      first_name?: string | null;
      last_name?: string | null;
      self_reported_dupr?: number | null;
    } | null;

    if (!body?.userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.first_name !== undefined) patch.firstName = body.first_name;
    if (body.last_name !== undefined) patch.lastName = body.last_name;
    if (body.self_reported_dupr !== undefined) {
      const dupr = body.self_reported_dupr;
      if (dupr !== null && (dupr < 1.0 || dupr > 8.5)) {
        return NextResponse.json(
          { error: 'DUPR must be between 1.0 and 8.5.' },
          { status: 400 },
        );
      }
      patch.selfReportedDupr = dupr;
    }

    await updateProfile(body.userId, patch);

    await logAdminEvent({
      eventType: 'admin.user_profile_updated',
      userEmail: callerEmail,
      payload: { target_user_id: body.userId, fields_updated: Object.keys(patch) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const auth = handleAuthError(err);
    if (auth) return auth;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/admin/users — Delete a user (admin only). */
export async function DELETE(request: NextRequest) {
  try {
    const { email: callerEmail } = await requireAdmin();

    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      userEmail?: string;
    } | null;

    if (!body?.userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    // Cascade-delete app data first; if Clerk delete then fails, the next
    // run can be re-attempted manually. Using app-data-first ordering makes
    // re-runs idempotent at the DB layer.
    await deleteUserAppData(body.userId, body.userEmail ?? null);

    try {
      await clerk().users.deleteUser(body.userId);
    } catch (err) {
      // Note this in admin events but don't fail the API call — app data is gone.
      await logAdminEvent({
        eventType: 'admin.clerk_delete_failed',
        userEmail: callerEmail,
        payload: {
          target_user_id: body.userId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }

    await logAdminEvent({
      eventType: 'admin.user_deleted',
      userEmail: callerEmail,
      payload: { deleted_user_id: body.userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const auth = handleAuthError(err);
    if (auth) return auth;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
