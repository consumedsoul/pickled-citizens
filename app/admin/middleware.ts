import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL } from '@/lib/constants';

// Admin middleware for server-side route protection
// Ensures only the super-admin user can access /admin/* routes

export async function middleware(request: NextRequest) {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Get auth token from cookies
  const authToken = request.cookies.get('sb-access-token')?.value;

  if (!authToken) {
    // No auth token, redirect to home
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Create Supabase client to verify user
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(authToken);

    if (error || !user) {
      // Invalid token or user not found
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Check if user is admin
    const userEmail = user.email?.toLowerCase();
    if (userEmail !== ADMIN_EMAIL) {
      // Not an admin, redirect to home
      return NextResponse.redirect(new URL('/', request.url));
    }

    // User is admin, allow access
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: '/admin/:path*',
};
