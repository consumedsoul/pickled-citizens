import { NextRequest, NextResponse } from 'next/server';
import { requireUserId, AuthorizationError } from '@/lib/db/auth-helpers';
import { removeMember } from '@/lib/db/queries/leagues';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = (await request.json().catch(() => null)) as { leagueId?: string } | null;
    const leagueId = body?.leagueId;
    if (!leagueId) {
      return NextResponse.json({ error: 'Missing leagueId.' }, { status: 400 });
    }

    const { removed } = await removeMember(userId, leagueId, userId);
    if (!removed) {
      return NextResponse.json({ error: 'No membership row was deleted.' }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
