# Retired 2026-09-18

Contents here are no longer part of the project and are kept only for a short
grace period before deletion.

- `api/session/[id]/metadata/route.ts` — unauthenticated `GET` that returned a
  session's league name, player count and schedule to anyone holding its ID.
  Documented as "public by design — OG previews", but nothing called it:
  `app/sessions/[id]/layout.tsx` builds its OG tags directly in
  `generateMetadata`. If a public endpoint is wanted again, gate it with
  `canViewSession`.
- `api/og/route.tsx` — public, uncached `ImageResponse` generator with no
  callers. Every page's OG image is the static
  `/images/Pickled-Citizens-Logo-Social.png`.
