import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'hun@ghkim.com';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Supabase stores auth tokens in cookies with a project-specific prefix:
  // sb-<project-ref>-auth-token (the value is a JSON array: [access_token, refresh_token])
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
  const authCookieName = `sb-${projectRef}-auth-token`;
  const authCookie = request.cookies.get(authCookieName)?.value;

  if (!authCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Parse the auth token — Supabase stores it as a JSON-encoded array or base64-encoded value
  let accessToken: string | null = null;
  try {
    const parsed = JSON.parse(authCookie);
    accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token ?? null;
  } catch {
    // Not JSON — try using the raw value as the access token
    accessToken = authCookie;
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const userEmail = user.email?.toLowerCase();
    if (userEmail !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: '/admin/:path*',
};
