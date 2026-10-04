# Retired 2026-10-03

Contents here are no longer part of the project and are kept only for a short
grace period before deletion.

- `rating.ts` / `rating.test.ts` — the doubles-Elo league rating (everyone
  starts at 1000, points move after each game by how surprising the result
  was). Shipped and then pulled the same day: league sessions are grouped by
  skill level and the tiers never play each other, so each tier became its own
  ladder centred on 1000 and the top of a 3.0 pool looked identical to the top
  of a 3.5 pool. Replaced by the win-percentage board plus counterpart rivals
  in `src/lib/standings.ts`. A DUPR-seeded variant was discussed and parked
  pending a decision on how DUPRs would be maintained.
