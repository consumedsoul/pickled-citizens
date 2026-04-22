# Pickled Citizens — CLAUDE.md

## Project Overview

Pickled Citizens is a pickleball league management app at **pickledcitizens.com**. It handles league creation, player invites, game session scheduling, balanced team generation, match results, and session history/stats.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with custom theme (see `tailwind.config.js`)
- **Supabase** — PostgreSQL database + Auth (magic link & password)
- **Cloudflare Workers** — SSR hosting via OpenNext (`@opennextjs/cloudflare`)
- **Wrangler** — Cloudflare CLI for deploy

## Local Development

```bash
npm install
npm run dev          # Next.js dev server
npm run preview      # OpenNext build + Cloudflare preview
npm run lint         # ESLint
```

## Deployment

Deploys to Cloudflare Workers (not Pages static). The CI workflow in `.github/workflows/cloudflare-deploy.yml` runs on push to `main`:

```bash
npm run deploy:ci    # opennextjs-cloudflare build && wrangler deploy --config wrangler.worker.toml --keep-vars
```

Config files:
- `wrangler.toml` — Pages build output config (used for `preview`)
- `wrangler.worker.toml` — Workers deploy config (used for `deploy` / CI)
- `open-next.config.ts` — OpenNext Cloudflare config (currently default)

Environment variables are set in `wrangler.toml` `[vars]` for public keys. The `SUPABASE_SERVICE_ROLE_KEY` must be set as a secret in Cloudflare (not committed).

## Project Structure

```
app/                    # Next.js App Router pages & API routes
  api/                  # API route handlers
    admin/users/        # PATCH/DELETE — admin user management (service role)
    dupr-score/         # DUPR score stub
    leagues/leave/      # POST — leave a league
    og/                 # Open Graph image generation
    session/[id]/metadata/  # Session metadata for social sharing
  admin/                # Super-admin pages (events, users, leagues)
  auth/                 # Auth flow pages (signup, signin, complete, reset)
  leagues/[id]/         # League detail page
  sessions/[id]/        # Session detail page
  profile/              # User profile management

src/
  components/
    ui/                 # Reusable UI components (Button, Input, Select, SectionLabel, Modal)
    AuthStatus.tsx      # Header auth indicator
    Navigation.tsx      # Main nav with active highlighting
    AdminFooterLinks.tsx # Conditional admin nav links
  lib/
    supabaseClient.ts   # Exports `supabase` (anon) and `supabaseServiceRole` (bypasses RLS)
    constants.ts        # Shared constants (ADMIN_EMAIL)
    formatters.ts       # Shared formatting utilities (dates, scores, names)
    teamGeneration.ts   # Snaking team-balance algorithm (extracted for testability)
  types/
    database.ts         # TypeScript types for all Supabase tables (Row/Insert/Update/Relationships)

middleware.ts           # Next.js middleware — protects /admin/* routes server-side

__tests__/
  team-generation.test.ts  # Vitest tests for team generation algorithm

supabase/
  schema.sql            # Full DB schema (source of truth)
  migrations/           # Incremental migration files

public/                 # Static assets
docs/
  prd.md                # Product requirements document
  audits/               # Weekly code audit reports
```

Path alias: `@/*` maps to `./src/*`.

## Database (Supabase)

### Key Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile (name, gender, self-reported DUPR) |
| `leagues` | League container, has an `owner_id` |
| `league_members` | League membership with `role` (player/admin) |
| `league_invites` | Pending/accepted/revoked invites by email |
| `game_sessions` | Session metadata (league, creator, scheduled time, player count) |
| `matches` | Individual matches within a session (court, status) |
| `match_players` | Players per match with `team` (1/2) and `position` |
| `match_results` | Scores and completion timestamp per match |
| `admin_events` | Audit log (JSONB payload) — super-admin only |

### Important Details

- **RLS is enabled on all tables.** Use `supabaseServiceRole` only in API routes when you need to bypass it.
- `player_count` on `game_sessions` is constrained to 6, 8, 10, or 12.
- `match_players.team` is constrained to 1 or 2.
- League owners are auto-promoted to `admin` role in `league_members`.
- Schema changes go in `supabase/migrations/` as new timestamped SQL files. Update `supabase/schema.sql` to match.

### Super-Admin

Email `hun@ghkim.com` is the super-admin. Referenced in:
- `supabase/schema.sql` — RLS policy on `admin_events` + `admin_delete_user` function
- `src/lib/constants.ts` — `ADMIN_EMAIL` constant (imported by all admin pages)
- `src/components/AdminFooterLinks.tsx` — conditional admin nav links
- `app/admin/events/AdminEventsClient.tsx`, `app/admin/leagues/page.tsx`, `app/admin/users/page.tsx`, `app/leagues/[id]/page.tsx`
- `middleware.ts` (project root) — server-side route protection for `/admin/*`
- `app/api/admin/users/route.ts` — admin user management API

## Authentication

- **Magic link** sign-up flow: email → `/auth/complete` → profile upsert → home
- **Password** sign-in at `/auth/signin`, reset at `/auth/reset`
- Supabase handles JWT tokens and auto-refresh
- Two Supabase clients in `src/lib/supabaseClient.ts`:
  - `supabase` — anon key, for client-side and server components
  - `supabaseServiceRole` — service role, for API routes only

## Design System & Tailwind Theme

Editorial-inspired B&W design: sharp edges (no border-radius), monospace uppercase labels, generous whitespace.

**Fonts** (loaded via `next/font/google` in `app/layout.tsx`):
- `font-sans` — Inter (body text)
- `font-display` — Space Grotesk (headings, large numbers)
- `font-mono` — IBM Plex Mono (labels, buttons, code)

**Color palette** (defined in `tailwind.config.js`):
- `app-bg` (#fff), `app-bg-subtle` (#fafafa), `app-border` (rgba(26,26,26,0.12))
- `app-text` (#1a1a1a), `app-muted` (rgba(26,26,26,0.52)), `app-accent` (#1a1a1a)
- `app-danger` (#dc2626), `app-success` (#16a34a)
- `team-green` (#14532d), `team-blue` (#1e40af) — preserved for match/session views
- Max-width utility: `max-w-app` (960px)

**Letter spacing**: `tracking-label` (0.15em), `tracking-button` (0.08em)

**UI Components** (`src/components/ui/`):
- `Button` — variants: primary, secondary, danger, sm, ghost. All monospace uppercase.
- `Input` + `Select` — sharp borders, transparent bg, monospace labels.
- `SectionLabel` — monospace uppercase `text-xs` labels.
- `Modal` — overlay dialog with backdrop.

**Design patterns**:
- Section separators: `border-t border-app-border pt-8 mt-8`
- List items: `divide-y divide-app-border`
- Page headings: `font-display text-2xl font-bold tracking-tight`
- No emojis — use text badges or monospace labels instead

## Key Business Logic

- **Team generation** uses a snaking algorithm to balance DUPR across doubles teams.
- **8-player sessions** produce 6 rounds (12 games) with controlled matchup repetition.
- **Scheduled times** are rounded to 30-minute intervals in the UI.
- **Session history** sorts upcoming sessions first (by scheduled time), then past sessions most-recent-first.
- **Sole-admin protection**: a league's last admin cannot leave or delete the league.

## API Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dupr-score` | Stub — returns `{ score: null }`. Awaits mydupr.com integration |
| POST | `/api/leagues/leave` | Bearer token auth. Body: `{ leagueId }` |
| GET | `/api/session/[id]/metadata` | Uses service role. Returns session info for OG tags |
| GET | `/api/og` | Generates Open Graph images |
| POST | `/api/admin/users` | Admin-only. Creates auth user with `email_confirm: true` (skips verification) + upserts profile. Audit logged as `admin.user_created` |
| PATCH | `/api/admin/users` | Admin-only. Bearer token + email check. Updates user profiles via service role. Validates DUPR 1.0–8.5 |
| DELETE | `/api/admin/users` | Admin-only. Bearer token + email check. Deletes user and cascading data via `admin_delete_user` RPC |

## Known Gotchas

- **Admin email hardcoded in schema**: `supabase/schema.sql` (RLS + functions) hardcodes `hun@ghkim.com` directly — changing it requires a migration. `middleware.ts` and all client-side code correctly import `ADMIN_EMAIL` from `src/lib/constants.ts`.
- **CSP uses `unsafe-inline` for scripts**: `next.config.mjs` has a CSP header but `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com` is needed for Next.js hydration and the Cloudflare Web Analytics beacon. Proper fix is nonce-based CSP via middleware — see audit 2026-04-22.
- **`robots.txt` references a non-existent sitemap**: `public/robots.txt` advertises `https://pickledcitizens.com/sitemap.xml` but no sitemap route is implemented. Add `app/sitemap.ts` using the Next.js 14 Metadata API — see audit 2026-04-22.
- **Build version is generated at build time**: `next.config.mjs` writes `src/lib/buildVersion.ts` during `next build` (Pacific time). The file is checked in but mutated by every build; the `M src/lib/buildVersion.ts` status after a local build is expected. Do not remove the file — the footer imports from it.
- **`@supabase/ssr` required for middleware auth**: The browser client uses `createBrowserClient` from `@supabase/ssr` (cookie-based) so the Next.js middleware at `middleware.ts` can read the session. Reverting to `createClient` from `@supabase/supabase-js` will break `/admin/*` route protection.
