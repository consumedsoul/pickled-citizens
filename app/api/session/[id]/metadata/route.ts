import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabaseClient';

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
    const { data: sessionRow, error: sessionError } = await supabaseServiceRole
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

    // Format date for metadata - fix timezone and format
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
        timeZone: 'America/Los_Angeles', // Force Pacific timezone
        hour12: true,
      });
    };

    // Format for title ( more concise
    const formatDateTimeForTitle = (value: string | null) => {
      if (!value) return 'Not scheduled';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'Not scheduled';
      return d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles', // Force Pacific timezone
        hour12: true,
      }).replace(',', '').replace(/:\d{2}\s/, ' ');
    };

    const sessionData = {
      id: sessionRow.id,
      league_name: sessionRow.league?.name || 'Pickleball Session',
      player_count: sessionRow.player_count || 0,
      formatted_date: formatDateTimeForMeta(sessionRow.scheduled_for),
      title: `${sessionRow.league?.name || 'Pickleball Session'} - ${sessionRow.player_count || 0} Players - ${formatDateTimeForTitle(sessionRow.scheduled_for)}`,
      description: `${sessionRow.league?.name || 'Pickleball Session'} team battle scheduled for ${formatDateTimeForTitle(sessionRow.scheduled_for)}.`,
      scheduled_for: sessionRow.scheduled_for,
      created_at: sessionRow.created_at,
    };

    return NextResponse.json(sessionData);

  } catch (error) {
    console.error('Error fetching session metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
