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
 * Format an ISO date string into a human-readable locale string.
 * Returns "Not scheduled" when the value is null / undefined / invalid.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const d = new Date(value);
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
  const year = new Date(createdAt).getFullYear();
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
