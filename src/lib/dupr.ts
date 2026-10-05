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
  'DUPR profile link must be a dupr.com address, e.g. ' + DUPR_URL_EXAMPLE;

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
 * Anything that is not an http(s) address on dupr.com is rejected so the
 * admin page never renders a link to an arbitrary site.
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
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !onDupr) {
    throw new Error(DUPR_URL_ERROR);
  }
  url.protocol = 'https:';
  return url.toString();
}
