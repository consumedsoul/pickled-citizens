# Retired 2026-10-02

Contents here are no longer part of the project and are kept only for a short
grace period before deletion.

- `api/leagues/leave/route.ts` — Clerk-authed `POST` that called `removeMember`
  for the caller. Nothing called it: the profile page leaves a league through
  the `leaveLeagueAction` server action, which goes through the same guarded
  `removeMember`. A second, unused entry point to the same mutation is surface
  area with no feature behind it.
