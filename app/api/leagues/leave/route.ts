import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') ?? '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch?.[1]?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { leagueId?: string } | null;
    const leagueId = body?.leagueId;

    if (!leagueId) {
      return NextResponse.json({ error: 'Missing leagueId.' }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseServiceRole.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message ?? 'Invalid auth token.' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // Check if user is an admin of this league
    const { data: membership } = await supabaseServiceRole
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (membership?.role === 'admin') {
      // Count other admins in the league
      const { count } = await supabaseServiceRole
        .from('league_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('league_id', leagueId)
        .eq('role', 'admin')
        .neq('user_id', userId);

      if (count === 0) {
        return NextResponse.json(
          { error: 'You are the only admin. Promote another member to admin before leaving.' },
          { status: 409 }
        );
      }
    }

    const { data: deletedRows, error: deleteError } = await supabaseServiceRole
      .from('league_members')
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .select('league_id');

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: 'No membership row was deleted.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Leave league API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
