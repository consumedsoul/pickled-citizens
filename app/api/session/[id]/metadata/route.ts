import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // Fetch real session data from Supabase
    const { data: sessionRow, error: sessionError } = await supabase
      .from('game_sessions')
      .select(
        'id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)'
      )
      .eq('id', sessionId)
      .single() as { data: SessionRow | null, error: any };

    if (sessionError || !sessionRow) {
      console.error('Session fetch error:', sessionError);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Format date for metadata
    const formatDateTimeForMeta = (value: string | null) => {
      if (!value) return 'Not scheduled';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'Not scheduled';
      return d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const sessionData = {
      id: sessionRow.id,
      league_name: sessionRow.league?.name || 'Pickleball Session',
      player_count: sessionRow.player_count || 0,
      formatted_date: formatDateTimeForMeta(sessionRow.scheduled_for),
      scheduled_for: sessionRow.scheduled_for,
      created_at: sessionRow.created_at,
    };

    return NextResponse.json(sessionData);

  } catch (error) {
    console.error('Error fetching session metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
