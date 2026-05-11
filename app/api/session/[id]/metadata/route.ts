import { NextRequest, NextResponse } from 'next/server';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getLeagueById } from '@/lib/db/queries/leagues';

const DISPLAY_TIMEZONE = process.env.DISPLAY_TIMEZONE || 'America/Los_Angeles';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSessionById(params.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const league = session.leagueId ? await getLeagueById(session.leagueId) : null;
    const leagueName = league?.name ?? 'Pickleball Session';

    const formatSessionDate = (value: string | null, compact = false) => {
      if (!value) return 'Not scheduled';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'Not scheduled';
      const str = d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: DISPLAY_TIMEZONE,
        hour12: true,
      });
      return compact ? str.replace(',', '').replace(/:\d{2}\s/, ' ') : str;
    };

    const sessionData = {
      id: session.id,
      league_name: leagueName,
      player_count: session.playerCount,
      formatted_date: formatSessionDate(session.scheduledFor),
      title: `${leagueName} - ${session.playerCount} Players - ${formatSessionDate(session.scheduledFor, true)}`,
      description: `${leagueName} team battle scheduled for ${formatSessionDate(session.scheduledFor, true)}.`,
      scheduled_for: session.scheduledFor,
      created_at: session.createdAt,
    };

    return NextResponse.json(sessionData);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
