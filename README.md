# Pickled Citizens

Lightweight web app for running casual pickleball leagues: create leagues, invite
players, schedule game sessions, auto-generate balanced doubles matchups, and track
match results with lifetime statistics.

**Live site:** [pickledcitizens.com](https://pickledcitizens.com)

> _Last updated: 2026-06-05_

---

## What it does

- **Leagues** — create leagues, invite members by email, assign per-league admin roles.
  Sole-admin protection prevents a league from being orphaned.
- **Game sessions** — schedule sessions for 6, 8, 10, or 12 players. The app sorts
  players by self-reported DUPR and generates balanced doubles teams with a snaking
  algorithm. Guest (non-member) players can be added to a single session.
- **Match tracking** — record per-match scores, view team and per-player win/loss
  records and lifetime statistics.
- **Admin tools** — a single super-admin sees `/admin/events` (audit log),
  `/admin/users`, and `/admin/leagues`.
- **Social sharing** — Open Graph metadata + dynamic OG image generation per session.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, React Server Components), React 18, TypeScript 5.6 |
| Styling | Tailwind CSS 3.4 — editorial B&W design tokens, monospace labels |
| Database | Cloudflare D1 (SQLite) accessed via Drizzle ORM |
| Auth | Clerk (password + magic link), Clerk-hosted UI |
| Hosting | Cloudflare (SSR) via OpenNext for Cloudflare (`@opennextjs/cloudflare`) |
| CLI / migrations | Wrangler 4 |
| Tests | Vitest |

> **Note:** This project was migrated off Supabase (Postgres + Auth + RLS) to
> Cloudflare D1 + Clerk. The live schema is the Drizzle definition in
> `src/lib/db/schema.ts` with migrations under `drizzle/`.

---

## Project structure

```
app/                       Next.js App Router pages + API routes
  api/
    admin/users/           POST/PATCH/DELETE — admin user mgmt (Clerk + D1)
    clerkwebhook/          Clerk user lifecycle webhook (svix-verified)
    dupr-score/            DUPR score stub (deferred until mydupr.com API)
    leagues/leave/         POST — leave a league
    og/                    Open Graph image generation
    session/[id]/metadata/ Public session metadata for social previews
  admin/                   Super-admin pages (events, users, leagues)
  auth/                    Clerk SignIn/SignUp + /auth/complete profile finisher
  leagues/, sessions/      League + session pages
  sitemap.ts               Dynamic sitemap (/sitemap.xml)
src/
  components/ui/           Reusable UI library (Button, Input, Modal, SectionLabel)
  components/sessions/     CreateSessionForm, SessionsList, GuestModal
  lib/
    db/schema.ts           Drizzle schema — source of truth for D1
    db/client.ts           getDbAsync() — Drizzle client over the Worker DB binding
    db/queries/            Per-domain queries with explicit auth checks
    actions/               'use server' actions called from client components
    teamGeneration.ts      Snaking team-balance algorithm (unit-tested)
middleware.ts              Clerk middleware — CSP nonce + /admin gating
drizzle/                   Drizzle-generated D1 migrations
__tests__/                 Vitest tests
```

Path alias: `@/*` maps to `./src/*`.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Cloudflare account with a D1 database
- A Clerk application

### Install & run

```bash
npm install
npm run dev      # Next.js dev server — NOTE: the D1 binding is NOT available here
npm run preview  # OpenNext build + Cloudflare local preview (D1 + Clerk env required)
npm run lint
npm test
```

For any database work use `npm run preview` (bindings available) or the Wrangler
local D1 emulator.

### Environment variables

Public (committed in `wrangler.toml` `[vars]`):

- `NEXT_PUBLIC_SITE_URL` — public site URL (default `https://pickledcitizens.com`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk client key (safe to commit)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / fallback redirect URLs

Server-only (set as Cloudflare secrets — never commit):

- `CLERK_SECRET_KEY` — Clerk Backend API key
- `CLERK_WEBHOOK_SIGNING_SECRET` — verifies the Clerk user lifecycle webhook
- `DISPLAY_TIMEZONE` — IANA timezone for session metadata (default `America/Los_Angeles`)

> Copy `.env.example` to `.env.local` and fill in the values above to run locally.
> Local `.env.local` files are git-ignored.

---

## Database

D1 is SQLite. The schema lives in `src/lib/db/schema.ts` (Drizzle). To change it:

```bash
# 1. Edit src/lib/db/schema.ts
npx drizzle-kit generate --name <description>
# 2. Apply
wrangler d1 migrations apply pickled-citizens --local    # local
wrangler d1 migrations apply pickled-citizens --remote   # production
```

D1 has **no row-level security** — all authorization is enforced in TypeScript
inside `src/lib/db/queries/`. Each query function takes the calling user's ID
explicitly and checks ownership/membership.

Tables: `profiles`, `leagues`, `league_members`, `league_invites`,
`game_sessions`, `matches`, `match_players`, `match_results`, `session_guests`,
`admin_events`.

---

## Deployment

The app is built with OpenNext for Cloudflare and deployed via Cloudflare's
Pages GitHub integration on push to `main`. `wrangler.toml` declares
`pages_build_output_dir = ".open-next/pages"` and the D1 binding.

The CI workflow (`.github/workflows/cloudflare-deploy.yml`) runs typecheck +
lint + tests as a gate; it does not itself deploy.

```bash
npm run pages:build   # OpenNext build assembled for Cloudflare Pages output
```

---

## Super-admin

A single super-admin email (`hun@ghkim.com`) is defined in `src/lib/constants.ts`
as `ADMIN_EMAIL` and enforced in `middleware.ts`, `src/lib/db/auth-helpers.ts`,
and `src/components/AdminFooterLinks.tsx`. Changing it is a one-line edit — no DB
migration needed.

---

## License

Proprietary — personal/league use. Reach out via GitHub if you would like to use
this codebase for your own league.
