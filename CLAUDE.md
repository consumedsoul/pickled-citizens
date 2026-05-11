# Pickled Citizens — CLAUDE.md

## Project Overview

Pickled Citizens is a pickleball league management app at **pickledcitizens.com**. It handles league creation, player invites, game session scheduling, balanced team generation, match results, and session history/stats.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with custom theme (see `tailwind.config.js`)
- **Cloudflare D1** (SQLite) — application database, accessed via Drizzle ORM
- **Clerk** — authentication (password + magic link), user identity, profile management UI
- **Cloudflare Workers** — SSR hosting via OpenNext (`@opennextjs/cloudflare`)
- **Wrangler** — Cloudflare CLI for D1 migrations and deploy

## Local Development

```bash
npm install
npm run dev          # Next.js dev server (note: D1 binding is not available in plain `next dev`)
npm run preview      # OpenNext build + Cloudflare preview (D1 + Clerk env required)
npm run lint         # ESLint
```

For local D1 work, use the Wrangler local emulator:

```bash
# Apply Drizzle migrations to local D1
wrangler d1 migrations apply pickled-citizens --local

# Apply to remote (production) D1
wrangler d1 migrations apply pickled-citizens --remote

# Generate a new migration after editing src/lib/db/schema.ts
npx drizzle-kit generate --name <description>
```

Required env (set as Cloudflare secrets, not committed):
- `CLERK_SECRET_KEY` — Clerk Backend API key
- `CLERK_WEBHOOK_SIGNING_SECRET` — for verifying the user.created/updated/deleted webhook

Public env (in `wrangler.toml` `[vars]`):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, etc.

## Deployment

Deploys to Cloudflare Workers (not Pages static). The CI workflow in `.github/workflows/cloudflare-deploy.yml` runs on push to `main`:

```bash
npm run deploy:ci    # opennextjs-cloudflare build && wrangler deploy --config wrangler.worker.toml --keep-vars
```

Config files:
- `wrangler.toml` — Pages build output config (used for `preview`)
- `wrangler.worker.toml` — Workers deploy config (used for `deploy` / CI). **Both files declare the D1 binding `DB`.**
- `open-next.config.ts` — OpenNext Cloudflare config (currently default)
- `drizzle.config.ts` — Drizzle Kit config; reads `src/lib/db/schema.ts`

## Project Structure

```
app/                    # Next.js App Router pages & API routes
  api/
    admin/users/        # POST/PATCH/DELETE — admin user mgmt (Clerk + D1)
    dupr-score/         # DUPR score stub
    leagues/leave/      # POST — leave a league
    og/                 # Open Graph image generation
    session/[id]/metadata/  # Session metadata for social sharing
    webhooks/clerk/     # Clerk lifecycle webhook (svix-verified)
  admin/                # Super-admin pages (events, users, leagues)
  auth/                 # Clerk-hosted SignIn/SignUp + /auth/complete profile finisher
  leagues/[id]/         # League detail page
  sessions/[id]/        # Session detail page
  profile/              # User profile management (embeds Clerk <UserProfile />)

src/
  components/
    ui/                 # Reusable UI components (Button, Input, Select, SectionLabel, Modal)
    AuthStatus.tsx      # Header auth indicator (Clerk)
    Navigation.tsx      # Main nav with active highlighting
    AdminFooterLinks.tsx # Conditional admin nav links
  lib/
    db/
      schema.ts         # Drizzle schema (source of truth for D1)
      client.ts         # getDbAsync() — returns Drizzle client backed by env.DB
      auth-helpers.ts   # requireUserId / requireAdmin via Clerk auth()
      json.ts           # encode/decode helpers for admin_events.payload (TEXT JSON)
      queries/          # Per-domain query modules with explicit auth checks
        profiles.ts, leagues.ts, invites.ts, sessions.ts, matches.ts, admin.ts
    actions/            # 'use server' actions called from client components
      profile.ts, leagues.ts, sessions.ts, account.ts, admin.ts, home.ts
    constants.ts        # Shared constants (ADMIN_EMAIL)
    formatters.ts       # Shared formatting utilities
    teamGeneration.ts   # Snaking team-balance algorithm (extracted for testability)

middleware.ts           # clerkMiddleware — CSP nonce + admin gating

drizzle/                # Drizzle-generated D1 migrations (apply via wrangler)
scripts/
  migrate-to-d1.ts      # One-shot Supabase -> Clerk + D1 importer

__tests__/
  team-generation.test.ts  # Vitest tests for team generation algorithm

public/                 # Static assets
docs/
  prd.md                # Product requirements document
  audits/               # Weekly code audit reports
```

Path alias: `@/*` maps to `./src/*`.

## Database (Cloudflare D1)

D1 is SQLite. The schema is defined in TypeScript via Drizzle at [src/lib/db/schema.ts](src/lib/db/schema.ts) and migrations live in `drizzle/`.

### Key Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile (name, gender, self-reported DUPR). `id` is the Clerk user ID (text). |
| `leagues` | League container, has an `owner_id` (Clerk user ID). |
| `league_members` | League membership with `role` (player/admin). |
| `league_invites` | Pending/accepted/revoked invites by email. |
| `game_sessions` | Session metadata (league, creator, scheduled time, player count). |
| `matches` | Individual matches within a session (court, status). |
| `match_players` | Players per match with `team` (1/2) and `position`. XOR constraint on user_id/guest_id. |
| `match_results` | Scores and completion timestamp per match. |
| `session_guests` | One-off guest players for a single session. |
| `admin_events` | Audit log. `payload` is TEXT JSON (use the helpers in [src/lib/db/json.ts](src/lib/db/json.ts)). |

### Important Details

- **D1 has no RLS.** All authorization is enforced in TypeScript inside the query modules under [src/lib/db/queries/](src/lib/db/queries/). Each function takes the calling user's ID explicitly and checks ownership/membership.
- **All user-id columns are `text`** because Clerk user IDs (`user_2abc...`) are not UUIDs. There are no FKs to `auth.users` (no such table in D1).
- `player_count` on `game_sessions` is constrained to 6, 8, 10, or 12.
- `match_players.team` is constrained to 1 or 2.
- League owners are auto-promoted to `admin` role in `league_members` via [createLeague](src/lib/db/queries/leagues.ts).
- Schema changes: edit `src/lib/db/schema.ts`, then `npx drizzle-kit generate --name <desc>`, then `wrangler d1 migrations apply pickled-citizens --remote`.
- **D1 `batch()` is not transactional in the Postgres sense** — statements run sequentially and partial failure is not rolled back. Multi-table mutations (cascade deletes, session creation) accept this and rely on idempotent re-runs to clean up.

### Super-Admin

Email `hun@ghkim.com` is the super-admin. Referenced in:
- [src/lib/constants.ts](src/lib/constants.ts) — `ADMIN_EMAIL` constant
- [middleware.ts](middleware.ts) — `/admin/*` route protection via Clerk session claims
- [src/lib/db/auth-helpers.ts](src/lib/db/auth-helpers.ts) — `requireAdmin()` used by admin server actions and API routes
- [src/components/AdminFooterLinks.tsx](src/components/AdminFooterLinks.tsx) — conditional admin nav links
- [app/admin/](app/admin/) pages — server-side gating via middleware

## Authentication (Clerk)

- Sign up / sign in / password reset / email change / password change → Clerk-hosted UI components.
- [app/auth/page.tsx](app/auth/page.tsx) wraps `<SignUp />`, [app/auth/signin/page.tsx](app/auth/signin/page.tsx) wraps `<SignIn />`.
- After signup, Clerk redirects to [app/auth/complete/](app/auth/complete/) which collects gender and self-reported DUPR (Clerk doesn't capture those) and persists them via [completeMyProfile](src/lib/actions/profile.ts).
- Profile rows are bootstrapped by the [Clerk webhook](app/api/webhooks/clerk/route.ts) on `user.created` (svix signature verified).
- Server-side: `auth()` from `@clerk/nextjs/server` gives `userId` and `sessionClaims.email`. Helpers in [src/lib/db/auth-helpers.ts](src/lib/db/auth-helpers.ts) wrap this.
- Client-side: `useUser()` / `useAuth()` from `@clerk/nextjs`. The legacy `useAuthUser()` hook in [src/lib/hooks/useAuthUser.ts](src/lib/hooks/useAuthUser.ts) is a thin wrapper for backwards compatibility.

## Data Access Pattern

D1 is server-only (accessed via the Worker `env.DB` binding). Client components must NOT import from `@/lib/db`. Instead they call **server actions** under [src/lib/actions/](src/lib/actions/) which compose query-module calls and add auth checks.

Pattern:
```typescript
// Client component
import { listMyLeagues } from '@/lib/actions/leagues';
const leagues = await listMyLeagues();
```

API routes still exist for callers that need REST (the admin/users endpoints and OG metadata route). Otherwise prefer server actions.

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

- **Team generation** uses a snaking algorithm to balance DUPR across doubles teams (in [src/lib/teamGeneration.ts](src/lib/teamGeneration.ts) and inline in [app/sessions/page.tsx](app/sessions/page.tsx)).
- **8-player sessions** produce 6 rounds (12 games) with controlled matchup repetition.
- **Scheduled times** are rounded to 30-minute intervals in the UI.
- **Session history** sorts upcoming sessions first (by scheduled time), then past sessions most-recent-first.
- **Sole-admin protection**: a league's last admin cannot leave or delete the league. Enforced in [removeMember](src/lib/db/queries/leagues.ts) and [deleteMyAccount](src/lib/actions/account.ts).

## API Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dupr-score` | Stub — returns `{ score: null }`. Awaits mydupr.com integration |
| POST | `/api/leagues/leave` | Clerk-authed. Body: `{ leagueId }`. Calls [removeMember](src/lib/db/queries/leagues.ts). |
| GET | `/api/session/[id]/metadata` | Public. Returns session info for OG tags from D1. |
| GET | `/api/og` | Generates Open Graph images |
| POST | `/api/admin/users` | Admin-only. Creates Clerk user + profile row. Logs `admin.user_created`. |
| PATCH | `/api/admin/users` | Admin-only. Updates a profile via D1. Validates DUPR 1.0–8.5. |
| DELETE | `/api/admin/users` | Admin-only. Cascades app data delete in D1 + deletes Clerk user. |
| POST | `/api/webhooks/clerk` | Svix-verified. user.created/updated/deleted lifecycle hooks. |

## Known Gotchas

- **Admin email is hardcoded** in [src/lib/constants.ts](src/lib/constants.ts) and compared via Clerk session email. Changing it is a one-line edit (no DB migration needed — the old Postgres `admin_events` policy and `admin_delete_user` RPC are gone).
- **CSP**: nonce-based CSP is set in [middleware.ts](middleware.ts) and includes Clerk endpoints (`*.clerk.com`, `*.clerk.accounts.dev`) for `script-src`, `connect-src`, `frame-src`. The layout reads the nonce via `headers().get('x-nonce')`.
- **`robots.txt` references a sitemap** at `https://pickledcitizens.com/sitemap.xml`; the dynamic sitemap is generated by [app/sitemap.ts](app/sitemap.ts).
- **Build version generated at build time**: `next.config.mjs` writes `src/lib/buildVersion.ts` during `next build`. The `M src/lib/buildVersion.ts` status after a local build is expected. Don't remove the file — the footer imports from it.
- **D1 access in OpenNext**: `getCloudflareContext({ async: true })` is required to read the binding inside Server Components and server actions. The sync version may not work depending on call site. Use [getDbAsync()](src/lib/db/client.ts).
- **Local dev DX**: `next dev` does NOT expose the D1 binding. For any DB-touching work, use `npm run preview` (OpenNext local server with bindings) or rely on the migrations-applied local D1 via `wrangler d1 execute --local`.
- **Clerk webhook needs the secret**: set `CLERK_WEBHOOK_SIGNING_SECRET` and configure the endpoint at `https://yourdomain/api/webhooks/clerk` in the Clerk Dashboard. The webhook uses svix signature verification.
- **`admin_events.payload` is TEXT, not JSONB**. Use [encodeJson/decodeJson](src/lib/db/json.ts) helpers when reading/writing.
- **Migration script**: [scripts/migrate-to-d1.ts](scripts/migrate-to-d1.ts) is the one-shot importer from Supabase. It needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (direct Postgres for bcrypt password export), and `CLERK_SECRET_KEY`. It emits `scripts/migration-out/data.sql` to apply via `wrangler d1 execute --remote --file=`.
