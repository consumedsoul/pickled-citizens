import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // For testing purposes, return mock data
    // In production, this would fetch from Supabase
    const mockSessionData = {
      id: sessionId,
      league_name: 'Weekend Warriors League',
      player_count: 8,
      formatted_date: 'Sat, Jun 15, 2024, 2:00 PM',
      scheduled_for: '2024-06-15T21:00:00.000Z',
      created_at: '2024-06-01T12:00:00.000Z',
    };

    return NextResponse.json(mockSessionData);

  } catch (error) {
    console.error('Error fetching session metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
