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
    dupr-score/         # DUPR score stub
    leagues/leave/      # POST — leave a league
    og/                 # Open Graph image generation
    session/[id]/metadata/  # Session metadata for social sharing
  admin/                # Super-admin pages (events, users, leagues)
  auth/                 # Auth flow pages (signup, signin, complete, reset)
  leagues/[id]/         # League detail page
  sessions/[id]/        # Session detail page
  history/              # Full session history
  profile/              # User profile management

src/
  components/           # Shared components (AuthStatus, Navigation, AdminFooterLinks)
  lib/
    supabaseClient.ts   # Exports `supabase` (anon) and `supabaseServiceRole` (bypasses RLS)

supabase/
  schema.sql            # Full DB schema (source of truth)
  migrations/           # Incremental migration files

public/                 # Static assets
docs/                   # PRD
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

Email `hun@ghkim.com` is the super-admin. Checked in:
- `supabase/schema.sql` — RLS policy on `admin_events`
- `src/components/AdminFooterLinks.tsx` — conditional admin nav links

## Authentication

- **Magic link** sign-up flow: email → `/auth/complete` → profile upsert → home
- **Password** sign-in at `/auth/signin`, reset at `/auth/reset`
- Supabase handles JWT tokens and auto-refresh
- Two Supabase clients in `src/lib/supabaseClient.ts`:
  - `supabase` — anon key, for client-side and server components
  - `supabaseServiceRole` — service role, for API routes only

## API Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dupr-score` | Stub — returns `{ score: null }`. Awaits mydupr.com integration |
| POST | `/api/leagues/leave` | Bearer token auth. Body: `{ leagueId }` |
| GET | `/api/session/[id]/metadata` | Uses service role. Returns session info for OG tags |
| GET | `/api/og` | Generates Open Graph images |

## Tailwind Theme

Custom colors defined in `tailwind.config.js`:
- `app-bg`, `app-bg-alt`, `app-border`, `app-text`, `app-muted`
- `app-accent` (#14532d), `app-dark`, `app-light-gray`, `app-link` (#263FA9)
- Max-width utility: `max-w-app` (960px)

## Key Business Logic

- **Team generation** uses a snaking algorithm to balance DUPR across doubles teams.
- **8-player sessions** produce 6 rounds (12 games) with controlled matchup repetition.
- **Scheduled times** are rounded to 30-minute intervals in the UI.
- **Session history** sorts upcoming sessions first (by scheduled time), then past sessions most-recent-first.
- **Sole-admin protection**: a league's last admin cannot leave or delete the league.
