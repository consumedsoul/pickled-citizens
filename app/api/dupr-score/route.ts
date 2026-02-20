import { NextResponse } from 'next/server';

/**
 * DUPR Score API — Intentionally deferred.
 *
 * This route is a stub that always returns `{ score: null }`.
 * Real DUPR integration is deferred until mydupr.com publishes a stable public API.
 * When available, this route should fetch the player's verified DUPR rating
 * from backend.mydupr.com using their duprId.
 *
 * @status deferred
 * @since 2026-02-08
 */
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
