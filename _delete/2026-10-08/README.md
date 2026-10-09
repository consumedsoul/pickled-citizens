# Retired 2026-10-08

Contents here are no longer part of the project and are kept only for a short
grace period before deletion.

- `api/dupr-score/route.ts` — `GET /api/dupr-score?duprId=` stub that always
  answered `{ score: null }` while waiting for a mydupr.com API. Nothing in
  `app/` or `src/` called it, and the plan it was holding a place for was
  replaced by the weekly browser sync (`docs/dupr-sync.md`), which writes the
  official rating straight into `profiles.dupr_rating`. An unauthenticated
  route with no caller is surface area with no feature behind it.
