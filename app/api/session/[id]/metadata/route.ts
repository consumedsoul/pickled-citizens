import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabaseClient';

const DISPLAY_TIMEZONE = process.env.DISPLAY_TIMEZONE || 'America/Los_Angeles';

// Define types for the Supabase response
type SessionRow = {
  id: string;
  league_id: string | null;
  created_by: string;
  created_at: string;
  scheduled_for: string | null;
  player_count: number;
  league: {
    name: string;
  } | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // Fetch real session data from Supabase
    const { data: sessionRow, error: sessionError } = await supabaseServiceRole
      .from('game_sessions')
      .select(
        'id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)'
      )
      .eq('id', sessionId)
      .single() as { data: SessionRow | null, error: { message: string } | null };

    if (sessionError || !sessionRow) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

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
      id: sessionRow.id,
      league_name: sessionRow.league?.name || 'Pickleball Session',
      player_count: sessionRow.player_count || 0,
      formatted_date: formatSessionDate(sessionRow.scheduled_for),
      title: `${sessionRow.league?.name || 'Pickleball Session'} - ${sessionRow.player_count || 0} Players - ${formatSessionDate(sessionRow.scheduled_for, true)}`,
      description: `${sessionRow.league?.name || 'Pickleball Session'} team battle scheduled for ${formatSessionDate(sessionRow.scheduled_for, true)}.`,
      scheduled_for: sessionRow.scheduled_for,
      created_at: sessionRow.created_at,
    };

    return NextResponse.json(sessionData);

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
