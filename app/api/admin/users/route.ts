import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';

/**
 * PATCH /api/admin/users — Update a user's profile (admin only).
 * Uses the service role client to bypass RLS.
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    // Verify the caller is the super-admin via their auth token
    const authHeader = request.headers.get('authorization') ?? '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch?.[1]?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseServiceRole.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message ?? 'Invalid auth token.' },
        { status: 401 }
      );
    }

    const callerEmail = userData.user.email?.toLowerCase() ?? '';
    if (callerEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

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

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.first_name !== undefined) updatePayload.first_name = body.first_name;
    if (body.last_name !== undefined) updatePayload.last_name = body.last_name;
    if (body.self_reported_dupr !== undefined) updatePayload.self_reported_dupr = body.self_reported_dupr;

    const { error: updateError } = await supabaseServiceRole
      .from('profiles')
      .update(updatePayload)
      .eq('id', body.userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users — Delete a user via the transactional admin_delete_user() RPC.
 * Uses the service role client to bypass RLS.
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    // Verify the caller is the super-admin
    const authHeader = request.headers.get('authorization') ?? '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch?.[1]?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseServiceRole.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message ?? 'Invalid auth token.' },
        { status: 401 }
      );
    }

    const callerEmail = userData.user.email?.toLowerCase() ?? '';
    if (callerEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
