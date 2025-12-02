import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabaseClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    
    // Test if we can connect to database at all
    console.log('Testing database connection...');
    console.log('Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Try to fetch any session first
    const { data: anySession, error: anyError } = await supabaseServiceRole
      .from('game_sessions')
      .select('id, scheduled_for, player_count')
      .limit(5);
    
    console.log('Any sessions found:', anySession?.length || 0);
    console.log('Any session error:', anyError);
    
    // Now try to fetch the specific session
    const { data: sessionRow, error: sessionError } = await supabaseServiceRole
      .from('game_sessions')
      .select(
        'id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)'
      )
      .eq('id', sessionId)
      .single();

    console.log('Specific session error:', sessionError);
    console.log('Specific session data:', sessionRow);

    return NextResponse.json({
      serviceRoleKeyExists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      anySessionCount: anySession?.length || 0,
      anySessions: anySession,
      specificSessionError: sessionError,
      specificSessionData: sessionRow,
      sessionId: sessionId
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ error: 'Test endpoint failed', details: error }, { status: 500 });
  }
}
