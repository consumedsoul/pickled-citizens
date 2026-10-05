# Weekly DUPR sync

Official doubles ratings come from each player's dupr.com page, read through
Hun's logged-in Chrome by a **scheduled task in the Claude desktop app** (Code
tab → Scheduled tasks → "Weekly DUPR sync"). There is no server-side job: DUPR
has no public API and its login needs 2FA, so a logged-in browser is the only
reliable reader.

What one run does:

1. `SELECT id, dupr_url FROM profiles WHERE dupr_url IS NOT NULL` via the
   Cloudflare D1 connector (database `pickled-citizens`).
2. Opens each `dupr_url` in Chrome (Claude in Chrome) and reads the number
   under **Rating → Doubles**. `NR` means not yet rated and is skipped.
3. `UPDATE profiles SET dupr_rating = ?, dupr_synced_at = datetime('now')
   WHERE id = ?` for each rating read. `self_reported_dupr` is never touched.
4. Posts a summary (updated / skipped / failed) back to the session.

The app (`src/lib/dupr.ts` → `effectiveDupr`) uses `dupr_rating` when present
and falls back to `self_reported_dupr`. The admin users page shows both plus
the sync date; the profile page shows the official number read-only.

Requirements for a run to succeed: the Claude desktop app is open, Chrome is
open with the Claude in Chrome extension connected, and that Chrome profile is
signed in to dupr.com. If the app is closed when the task is due, it runs on
next launch.
