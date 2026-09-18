/**
 * Super-admin email address.
 * Used for client-side UI gating; actual authorization is enforced server-side in
 * middleware.ts, src/lib/db/auth-helpers.ts, and the auth checks in src/lib/db/queries/.
 */
export const ADMIN_EMAIL = 'hun@ghkim.com';

/**
 * Supported gender options for user profiles.
 * Used in signup and profile edit forms.
 */
export const GENDER_OPTIONS = ['male', 'female'] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

/**
 * Most leagues one user may administer. Enforced in createLeague
 * (src/lib/db/queries/leagues.ts); the /leagues page reads it only to explain
 * the limit before the server refuses.
 */
export const MAX_LEAGUES = 3;
