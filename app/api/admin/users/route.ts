import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthorizationError } from '@/lib/db/auth-helpers';
import { upsertProfile, updateProfile } from '@/lib/db/queries/profiles';
import { adminAddUserToLeagues, deleteUserAppData, logAdminEvent } from '@/lib/db/queries/admin';
import { isDuprInRange, normalizeDuprUrl, DUPR_RANGE_ERROR, DUPR_URL_ERROR } from '@/lib/dupr';
import { clerkBackend as clerk, isClerkApiError, MAX_NAME_LENGTH } from '@/lib/clerk';

function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  return null;
}

/**
 * The body is only *typed* as number — at runtime it is whatever JSON arrived.
 * `"abc" < 1.0` and `"abc" > 8.5` are both false, so a plain range check lets
 * strings through, and profiles.self_reported_dupr has no CHECK to stop them.
 * Returns the validated value, or undefined when it is invalid.
 */
function parseDupr(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || !isDuprInRange(value)) {
    return undefined;
  }
  return value;
}

const DUPR_ERROR = DUPR_RANGE_ERROR;

/** Same idea for the profile link: undefined when the value cannot be stored. */
function parseDuprUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  try {
    return normalizeDuprUrl(value);
  } catch {
    return undefined;
  }
}

/**
 * Names: null clears, a string is trimmed (blank becomes null), anything else
 * is refused — the raw body used to reach D1 and Clerk untrimmed and untyped.
 */
function parseName(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > MAX_NAME_LENGTH) return undefined;
  return trimmed || null;
}

const NAME_ERROR = `Names must be text of ${MAX_NAME_LENGTH} characters or fewer.`;

/** POST /api/admin/users — Create a new user (admin only). */
export async function POST(request: NextRequest) {
  try {
    const { email: callerEmail } = await requireAdmin();

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      first_name?: string;
      last_name?: string;
      self_reported_dupr?: number | null;
      dupr_url?: string | null;
      league_ids?: string[];
    } | null;

    if (!body?.email?.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    const email = body.email.trim().toLowerCase();

    const dupr = parseDupr(body.self_reported_dupr ?? null);
    if (dupr === undefined) {
      return NextResponse.json({ error: DUPR_ERROR }, { status: 400 });
    }
    const duprUrl = parseDuprUrl(body.dupr_url ?? null);
    if (duprUrl === undefined) {
      return NextResponse.json({ error: DUPR_URL_ERROR }, { status: 400 });
    }
    const leagueIds = body.league_ids ?? [];
    if (!Array.isArray(leagueIds) || leagueIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'league_ids must be a list of ids.' }, { status: 400 });
    }

    const firstName = parseName(body.first_name);
    const lastName = parseName(body.last_name);
    if (firstName === undefined || lastName === undefined) {
      return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
    }

    // Create the Clerk user (skipping verification so admin can pre-create
    // accounts). The name goes to Clerk too: its user.created webhook upserts
    // the profile moments after this handler does, and a nameless Clerk user
    // used to arrive as blank names that wiped the ones typed here.
    let created: { id: string };
    try {
      created = await clerk().users.createUser({
        emailAddress: [email],
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
      });
    } catch (err) {
      // Clerk refused the account itself (duplicate email, bad address):
      // say why instead of a generic 500, so a retry after a partial create
      // reads as "already exists" rather than as a new failure.
      if (isClerkApiError(err) && err.status >= 400 && err.status < 500) {
        const duplicate = err.errors.some((e) => e.code === 'form_identifier_exists');
        const detail = err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Clerk refused it.';
        return NextResponse.json(
          {
            error: duplicate
              ? `An account with ${email} already exists. Edit it from the list instead.`
              : `Could not create the account: ${detail}`,
          },
          { status: duplicate ? 409 : 400 },
        );
      }
      throw err;
    }

    // The Clerk account now exists. If the profile or league step fails, say
    // so with the id: the webhook still creates a bare profile row, so the
    // admin finishes by editing that user, not by creating it again.
    let joined: string[];
    try {
      await upsertProfile({
        id: created.id,
        email,
        firstName,
        lastName,
        selfReportedDupr: dupr,
        duprUrl,
      });
      joined = await adminAddUserToLeagues(created.id, email, leagueIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('POST /api/admin/users partial create:', err);
      await logAdminEvent({
        eventType: 'admin.user_create_partial',
        userEmail: callerEmail,
        payload: { created_user_id: created.id, created_email: email, error: message },
      });
      return NextResponse.json(
        {
          error: `The account for ${email} was created, but saving the DUPR, link or league picks failed (${message}). Edit the user from the list to finish; do not create it again.`,
          userId: created.id,
        },
        { status: 500 },
      );
    }

    await logAdminEvent({
      eventType: 'admin.user_created',
      userEmail: callerEmail,
      payload: { created_user_id: created.id, created_email: email, league_ids: joined },
    });

    return NextResponse.json({ ok: true, userId: created.id });
  } catch (err) {
    const auth = handleAuthError(err);
    if (auth) return auth;
    console.error('POST /api/admin/users failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      dupr_url?: string | null;
    } | null;

    if (!body?.userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.first_name !== undefined) {
      const name = parseName(body.first_name);
      if (name === undefined) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
      patch.firstName = name;
    }
    if (body.last_name !== undefined) {
      const name = parseName(body.last_name);
      if (name === undefined) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
      patch.lastName = name;
    }
    if (body.self_reported_dupr !== undefined) {
      const dupr = parseDupr(body.self_reported_dupr);
      if (dupr === undefined) {
        return NextResponse.json({ error: DUPR_ERROR }, { status: 400 });
      }
      patch.selfReportedDupr = dupr;
    }
    if (body.dupr_url !== undefined) {
      const url = parseDuprUrl(body.dupr_url);
      if (url === undefined) {
        return NextResponse.json({ error: DUPR_URL_ERROR }, { status: 400 });
      }
      patch.duprUrl = url;
    }

    await updateProfile(body.userId, patch);

    // Mirror name edits to Clerk so its profile page and later user.updated
    // webhooks carry the same name instead of reverting this edit.
    if ('firstName' in patch || 'lastName' in patch) {
      try {
        await clerk().users.updateUser(body.userId, {
          ...('firstName' in patch ? { firstName: (patch.firstName as string | null) ?? '' } : {}),
          ...('lastName' in patch ? { lastName: (patch.lastName as string | null) ?? '' } : {}),
        });
      } catch (err) {
        await logAdminEvent({
          eventType: 'admin.clerk_update_failed',
          userEmail: callerEmail,
          payload: {
            target_user_id: body.userId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    await logAdminEvent({
      eventType: 'admin.user_profile_updated',
      userEmail: callerEmail,
      payload: { target_user_id: body.userId, fields_updated: Object.keys(patch) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const auth = handleAuthError(err);
    if (auth) return auth;
    console.error('PATCH /api/admin/users failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    await deleteUserAppData(body.userId);

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
    console.error('DELETE /api/admin/users failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
