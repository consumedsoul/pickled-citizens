import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { ADMIN_EMAIL } from './src/lib/constants';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isProtectedRoute = createRouteMatcher(['/profile(.*)', '/admin(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === 'development';

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com https://*.clerk.accounts.dev https://*.clerk.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com",
    "img-src 'self' data: https:",
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);

  if (isProtectedRoute(request)) {
    const session = await auth();
    if (!session.userId) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(signInUrl);
    }

    if (isAdminRoute(request)) {
      const email = (session.sessionClaims?.email as string | undefined)?.toLowerCase();
      if (email !== ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next internals, static assets, and the Clerk webhook (which uses
    // svix headers and its own signature verification).
    '/((?!_next/static|_next/image|favicon.ico|images/|llms.txt|robots.txt|sitemap.xml|api/webhooks/).*)',
    // Always run on API routes for auth context (Clerk needs this).
    '/(api|trpc)(.*)',
  ],
};
