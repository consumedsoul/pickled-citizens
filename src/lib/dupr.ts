/**
 * DUPR helpers shared by the profile, signup, session, league, and admin pages.
 *
 * Ratings display with three decimals (3.000) to match dupr.com. A profile may
 * also carry a link to the player's public DUPR page so an admin can check the
 * official rating before correcting the self-reported one.
 */

export const DUPR_MIN = 1.0;
export const DUPR_MAX = 8.5;

/** Example shown greyed-out in the profile-link field. */
export const DUPR_URL_EXAMPLE = 'https://dashboard.dupr.com/dashboard/player/7667170290';

export const DUPR_RANGE_ERROR = 'DUPR must be between 1.000 and 8.500.';
export const DUPR_FORMAT_ERROR = 'DUPR must be a number like 3.750.';
export const DUPR_URL_ERROR =
  'DUPR profile link must be a dupr.com player page, e.g. ' + DUPR_URL_EXAMPLE;

/** A usable rating: a finite number inside the DUPR scale. */
function usableRating(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && isDuprInRange(n) ? n : null;
}

/**
 * The rating the app balances and ranks with: the official dupr.com rating
 * when the weekly sync has read one, otherwise what the player typed in.
 *
 * Both values are range-checked here, not only at write time. The official
 * rating is written by a browser agent reading a rendered page (see
 * docs/dupr-sync.md), so a misread number must not silently reorder every
 * session the player is in; an out-of-range official rating falls back to
 * the self-reported one as if the sync had never run.
 */
export function effectiveDupr(p: {
  duprRating?: number | null;
  selfReportedDupr?: number | null;
}): number | null {
  return usableRating(p.duprRating) ?? usableRating(p.selfReportedDupr);
}

/** 3.5 → "3.500". */
export function formatDupr(value: number): string {
  return value.toFixed(3);
}

/** Accepts "3", "3.5", "3.75", "3.750". Returns null when the text is not a rating. */
export function parseDuprInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}(\.\d{1,3})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function isDuprInRange(n: number): boolean {
  return n >= DUPR_MIN && n <= DUPR_MAX;
}

/**
 * Normalises a pasted DUPR profile link. Empty input means "no link" (null).
 *
 * Only a player page (`/dashboard/player/<digits>`) on dupr.com is accepted,
 * and it is rewritten to the canonical form. The weekly sync opens every
 * stored link in a logged-in browser, so this is what keeps a stored link from
 * being an arbitrary dupr.com page (settings, sign-out) or another site. It
 * does not stop a player linking someone else's page; the sync compares the
 * page's player name with the profile name for that.
 */
export function normalizeDuprUrl(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(DUPR_URL_ERROR);
  }
  const host = url.hostname.toLowerCase();
  const onDupr = host === 'dupr.com' || host.endsWith('.dupr.com');
  const player = url.pathname.match(/^\/dashboard\/player\/(\d+)\/?$/);
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !onDupr || !player) {
    throw new Error(DUPR_URL_ERROR);
  }
  return `https://dashboard.dupr.com/dashboard/player/${player[1]}`;
}
