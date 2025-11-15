import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const duprId = searchParams.get('duprId');

  if (!duprId) {
    return NextResponse.json({ message: 'Missing duprId' }, { status: 400 });
  }

  // Placeholder implementation: this endpoint is a stub.
  // Once you have the exact DUPR API details (URL, auth, response shape),
  // replace the logic below with a real fetch to backend.mydupr.com.

  return NextResponse.json({
    score: null,
    message:
      'DUPR API integration not yet configured. See backend.mydupr.com docs and update this route.',
  });
}
