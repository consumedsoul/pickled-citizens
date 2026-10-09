/**
 * Shared formatting utilities used across the Pickled Citizens app.
 *
 * Centralised here to avoid duplicating the same helpers in multiple page
 * components.
 */

// ---------------------------------------------------------------------------
// Date / time
// ---------------------------------------------------------------------------

/**
 * SQLite's `datetime('now')` writes "2026-10-03 19:00:00": UTC, but with no
 * "T" or "Z", so `new Date()` reads it as local time in Chrome and as an
 * invalid date in some Safari versions. Rewrite that shape as ISO UTC and
 * leave every other string alone.
 */
export function normalizeDbTimestamp(value: string): string {
  const m = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  return m ? `${m[1]}T${m[2]}Z` : value;
}

/** `new Date()` for a column that may hold SQLite or ISO text; null when invalid. */
export function parseDbTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(normalizeDbTimestamp(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * One shape for string comparison: "YYYY-MM-DDTHH:MM". Accepts datetime-local
 * text ("2026-10-03T19:00"), ISO instants and SQLite text; "" when empty.
 */
export function sortableTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeDbTimestamp(value).replace(" ", "T").slice(0, 16);
}

/**
 * Format an ISO date string into a human-readable locale string.
 * Returns "Not scheduled" when the value is null / undefined / invalid.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const d = new Date(normalizeDbTimestamp(value));
  if (Number.isNaN(d.getTime())) return "Not scheduled";
  return d.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// League
// ---------------------------------------------------------------------------

/**
 * Format a league name with its establishment year, e.g. "My League (est. 2024)".
 */
export function formatLeagueName(name: string, createdAt: string): string {
  // UTC year is deterministic across server (UTC) and client (local tz);
  // local getFullYear() can disagree near Jan 1 in non-UTC zones.
  const year = new Date(createdAt).getUTCFullYear();
  return `${name} (est. ${year})`;
}

// ---------------------------------------------------------------------------
// Player name helpers
// ---------------------------------------------------------------------------

/** Minimal shape required by the player-name helpers. */
export type PlayerNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

/**
 * Return the player's full display name.
 *
 * Priority: "First Last" > "Deleted player".
 */
export function displayPlayerName(player: PlayerNameFields): string {
  const full = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
  if (full) return full;
  return "Deleted player";
}

/**
 * Return a short version of the player's name (first name + last initial).
 *
 * Priority: "First L" > "First" > "Last" > "Deleted player".
 */
export function displayPlayerNameShort(player: PlayerNameFields): string {
  const firstName = player.first_name?.trim() || "";
  const lastName = player.last_name?.trim() || "";
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}`;
  }
  if (firstName) return firstName;
  if (lastName) return lastName;
  return "Deleted player";
}
