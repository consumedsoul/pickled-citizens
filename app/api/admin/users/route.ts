import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';
import type { Database } from '@/types/database';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/** Helper: verify caller is super-admin via Bearer token. */
async function verifyAdmin(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 }) };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1]?.trim();

  if (!token) {
    return { error: NextResponse.json({ error: 'Missing auth token.' }, { status: 401 }) };
  }

  const { data: userData, error: userError } = await supabaseServiceRole.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: NextResponse.json({ error: userError?.message ?? 'Invalid auth token.' }, { status: 401 }) };
  }

  const callerEmail = userData.user.email?.toLowerCase() ?? '';
  if (callerEmail !== ADMIN_EMAIL) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }

  return { callerEmail };
}

/**
 * POST /api/admin/users — Create a new user (admin only).
 * Creates a Supabase auth user (email_confirm: true to skip verification)
 * and upserts a profiles row.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth && auth.error) return auth.error;
    const { callerEmail } = auth as { callerEmail: string };

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
        return NextResponse.json({ error: 'DUPR must be between 1.0 and 8.5.' }, { status: 400 });
      }
    }

    // Create the auth user — email_confirm: true skips email verification
    const { data: newUser, error: createError } = await supabaseServiceRole.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Upsert profile row
    type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
    const profileData: ProfileInsert = {
      id: newUser.user.id,
      email,
      updated_at: new Date().toISOString(),
      first_name: body.first_name?.trim() || null,
      last_name: body.last_name?.trim() || null,
      self_reported_dupr: body.self_reported_dupr ?? null,
    };

    const { error: profileError } = await supabaseServiceRole
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    await supabaseServiceRole.from('admin_events').insert({
      event_type: 'admin.user_created',
      user_email: callerEmail,
      payload: { created_user_id: newUser.user.id, created_email: email },
    });

    return NextResponse.json({ ok: true, userId: newUser.user.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users — Update a user's profile (admin only).
 * Uses the service role client to bypass RLS.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth && auth.error) return auth.error;
    const { callerEmail } = auth as { callerEmail: string };

    // Parse the request body
    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      first_name?: string | null;
      last_name?: string | null;
      self_reported_dupr?: number | null;
    } | null;

    if (!body?.userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    const updatePayload: ProfileUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (body.first_name !== undefined) updatePayload.first_name = body.first_name;
    if (body.last_name !== undefined) updatePayload.last_name = body.last_name;
    if (body.self_reported_dupr !== undefined) {
      const dupr = body.self_reported_dupr;
      if (dupr !== null && (dupr < 1.0 || dupr > 8.5)) {
        return NextResponse.json(
          { error: 'DUPR must be between 1.0 and 8.5.' },
          { status: 400 }
        );
      }
      updatePayload.self_reported_dupr = dupr;
    }

    const { error: updateError } = await supabaseServiceRole
      .from('profiles')
      .update(updatePayload)
      .eq('id', body.userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await supabaseServiceRole.from('admin_events').insert({
      event_type: 'admin.user_profile_updated',
      user_email: callerEmail,
      payload: { target_user_id: body.userId, fields_updated: Object.keys(updatePayload).filter(k => k !== 'updated_at') },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users — Delete a user via the transactional admin_delete_user() RPC.
 * Uses the service role client to bypass RLS.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth && auth.error) return auth.error;
    const { callerEmail } = auth as { callerEmail: string };

    const body = (await request.json().catch(() => null)) as { userId?: string } | null;

    if (!body?.userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    // Use the transactional RPC to delete all user data in one operation
    const { error: deleteError } = await supabaseServiceRole.rpc('admin_delete_user', {
      user_id_to_delete: body.userId,
    });

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    await supabaseServiceRole.from('admin_events').insert({
      event_type: 'admin.user_deleted',
      user_email: callerEmail,
      payload: { deleted_user_id: body.userId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
