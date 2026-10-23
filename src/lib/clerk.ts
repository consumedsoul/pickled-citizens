import { createClerkClient } from '@clerk/backend';

/**
 * Clerk Backend API client for server code (server actions and API routes).
 * The secret is read per call so a missing CLERK_SECRET_KEY fails the request
 * that needs Clerk, not module load.
 */
export function clerkBackend() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY not configured');
  return createClerkClient({ secretKey: secret });
}

/**
 * Longest first or last name the app stores or forwards to Clerk. Names are
 * free text with no other validation, so this is the only bound on them.
 */
export const MAX_NAME_LENGTH = 100;

/**
 * Shape of a Clerk Backend API failure (`ClerkAPIResponseError`): a status
 * plus a list of coded errors. Duck-typed so tests and older SDK builds do
 * not need the class itself.
 */
export type ClerkApiError = {
  clerkError: true;
  status: number;
  errors: Array<{ code?: string; message?: string; longMessage?: string }>;
};

export function isClerkApiError(err: unknown): err is ClerkApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { clerkError?: unknown }).clerkError === true &&
    Array.isArray((err as { errors?: unknown }).errors)
  );
}
