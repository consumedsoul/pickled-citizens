# Pickled Citizens — CLAUDE.md

## Talking to Hun (read before you reply)

Hun is a **vibe coder**, not a software engineer. He directs the work and judges the
result; he does not read diffs or scroll back through a transcript to work out whether
something is being asked of him. Write every response for him.

**End EVERY response with exactly one status line — including short ones.**

| Line | Use when |
|---|---|
| `✅ **Nothing needed from you.** <what changed>` | Done and verified. Pure FYI. |
| `👉 **Your turn:** <the exact thing to do>` | He must run, click, paste, or check something. |
| `❓ **Need your call:** <question + your recommendation>` | Blocked on a decision only he can make. |

If that line is `👉` or `❓`, repeat it as the FIRST line of the response as well as the
last. An ask buried in the middle is an ask he will miss.

- `👉` must be literal and complete: the command to paste, the button to click, the URL
  to open. Not "you may want to verify the deploy" — instead "open https://… and confirm
  the hero image loads."
- Never use `✅` when something is untested, partially done, or waiting on anything.
  "I think it works" is `👉 Your turn: check X`.
- `❓` always carries your recommendation, not just the question. He is choosing between
  options you have already thought through, not doing the thinking from scratch.
- Plain language. If a technical term is load-bearing, define it in the same sentence in
  six words or fewer. Name the file, page, or button — not the abstraction.
- Lead with what changed and what he can see. Reasoning and internals go below that, or
  are left out unless he asks.

## Project Overview

Pickled Citizens is a pickleball league management app at **pickledcitizens.com**. It handles league creation, adding players by email, game session scheduling, balanced team generation, match results, and session history/stats.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with custom theme (see `tailwind.config.js`)
- **Cloudflare D1** (SQLite) — application database, accessed via Drizzle ORM
- **Clerk** — authentication (password + magic link), user identity, profile management UI
- **Cloudflare** — SSR hosting via OpenNext (`@opennextjs/cloudflare`)
- **Wrangler** — Cloudflare CLI for D1 migrations and deploy

## Local Development

```bash
npm install
npm run dev          # Next.js dev server (note: D1 binding is not available in plain `next dev`)
npm run preview      # OpenNext build + Cloudflare preview (D1 + Clerk env required)
npm run lint         # ESLint
npm test             # Vitest
```

For local D1 work, use the Wrangler local emulator:

```bash
wrangler d1 migrations apply pickled-citizens --local   # apply migrations to local D1
wrangler d1 migrations apply pickled-citizens --remote  # apply to production D1
npx drizzle-kit generate --name <description>           # new migration after editing schema.ts
```

Required env (set as Cloudflare secrets, not committed):
- `CLERK_SECRET_KEY` — Clerk Backend API key
- `CLERK_WEBHOOK_SIGNING_SECRET` — for verifying the user.created/updated/deleted webhook
- `DISPLAY_TIMEZONE` — IANA timezone for session metadata (default `America/Los_Angeles`)

Public env (in `wrangler.toml` `[vars]`):
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, fallback redirect URLs

## Deployment

The app deploys to Cloudflare via **OpenNext for Cloudflare** through Cloudflare's
**Pages GitHub integration** on push to `main`. There is no `wrangler.worker.toml`
and no `deploy` npm script — Cloudflare runs the build itself from the repo.

- `wrangler.toml` — the single Wrangler config. Declares `pages_build_output_dir = ".open-next/pages"`, the D1 binding `DB`, and `[vars]`.
- `npm run pages:build` — assembles the OpenNext build into the `.open-next/pages` layout (also invokes `scripts/write-pages-worker.mjs`).
- `.github/workflows/cloudflare-deploy.yml` — CI gate only: runs `tsc --noEmit`, `npm run lint`, `npm test`. It does **not** deploy.
- `open-next.config.ts` — OpenNext Cloudflare config (currently default).
- `drizzle.config.ts` — Drizzle Kit config; reads `src/lib/db/schema.ts`.

## Project Structure

```
app/                    # Next.js App Router pages & API routes
  api/
    admin/users/        # POST/PATCH/DELETE — admin user mgmt (Clerk + D1)
    clerkwebhook/       # Clerk lifecycle webhook (svix-verified)
    dupr-score/         # DUPR score stub
    leagues/leave/      # POST — leave a league
    og/                 # Open Graph image generation
    session/[id]/metadata/  # Session metadata for social sharing
  admin/                # Super-admin pages (events, users, leagues)
  auth/                 # Clerk SignIn/SignUp + /auth/complete profile finisher
  leagues/[id]/         # League detail page
  sessions/[id]/        # Session detail page
  profile/              # User profile management (embeds Clerk <UserProfile />)
  sitemap.ts            # Dynamic sitemap (/sitemap.xml)

src/
  components/
    ui/                 # Reusable UI components (Button, Input, Modal, SectionLabel)
    sessions/           # CreateSessionForm, SessionsList, GuestModal (extracted from app/sessions/page.tsx)
    AuthStatus.tsx, Navigation.tsx, AdminFooterLinks.tsx, BuildVersion.tsx
  lib/
    db/
      schema.ts         # Drizzle schema (source of truth for D1)
      client.ts         # getDbAsync() — Drizzle client backed by env.DB
      auth-helpers.ts   # requireUserId / requireAdmin via Clerk auth()
      chunk.ts          # chunkedInArray() — works around D1's 100-param limit
      json.ts           # encode/decode helpers for admin_events.payload (TEXT JSON)
      queries/          # Per-domain query modules with explicit auth checks
    actions/            # 'use server' actions called from client components
    constants.ts        # Shared constants (ADMIN_EMAIL)
    formatters.ts       # Shared formatting utilities
    teamGeneration.ts   # Snaking team-balance algorithm (extracted for testability)
    hooks/useAuthUser.ts

middleware.ts           # clerkMiddleware — CSP nonce + admin gating
drizzle/                # Drizzle-generated D1 migrations (apply via wrangler)
scripts/                # write-pages-worker.mjs
__tests__/              # Vitest: team generation + authorization rules
docs/                   # prd.md + AUDITS.md (pointer to the external audit trail)
```

Path alias: `@/*` maps to `./src/*`.

## Database (Cloudflare D1)

D1 is SQLite. The schema is defined in TypeScript via Drizzle at `src/lib/db/schema.ts` and migrations live in `drizzle/`.

### Key Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile. `id` is the Clerk user ID (text). |
| `leagues` | League container with `owner_id` (Clerk user ID). |
| `league_members` | League membership with `role` (player/admin). |
| `game_sessions` | Session metadata (league, creator, scheduled time, player count). |
| `matches` | Individual matches within a session. |
| `match_players` | Players per match with `team` (1/2). XOR constraint on user_id/guest_id. |
| `match_results` | Scores and completion timestamp per match. |
| `session_guests` | One-off guest players for a single session. |
| `admin_events` | Audit log. `payload` is TEXT JSON (use helpers in `src/lib/db/json.ts`). |

### Important Details

- **Authorization is tested.** `__tests__/authorization.test.ts` covers `isLeagueMember`, `canManageSession`, `canViewSession`, `removeMember`'s sole-admin guard and `chunkedInArray`'s 90-param boundary. It stubs `getDbAsync` only — no database needed. Add a case here when you add a rule.
- **D1 has no RLS.** Authorization is enforced in TypeScript, but **not uniformly at the query layer**. *Mutations* in `src/lib/db/queries/` take the caller's ID and check ownership/membership themselves. *Reads* (`getSessionById`, `listLeagues`, `listMembersOfLeague`, `listAllProfiles`, `listAdminEvents`, `listGuestsForSession`, `listMatchesForSession`, `listPlayersForMatches`) take **no caller ID and perform no check** — the calling server action or page owns the gate. Server actions are POST-reachable RPC endpoints; "the page only renders for members" is not a defense.
- **All user-id columns are `text`** — Clerk user IDs are not UUIDs. No FKs to an `auth.users` table.
- `player_count` on `game_sessions` is constrained to 6, 8, 10, or 12; `match_players.team` to 1 or 2.
- **D1 `batch()` is not transactional** — statements run sequentially; partial failure is not rolled back. Multi-table mutations rely on idempotent re-runs.

### Super-Admin

Email `hun@ghkim.com` is the super-admin. Referenced in `src/lib/constants.ts` (`ADMIN_EMAIL`), `middleware.ts`, `src/lib/db/auth-helpers.ts`, and `src/components/AdminFooterLinks.tsx`.

## Authentication (Clerk)

- Sign up / sign in / password reset / email change → Clerk-hosted UI components.
- After signup, Clerk redirects to `app/auth/complete/` which collects gender and self-reported DUPR and persists them.
- Profile rows are bootstrapped by the Clerk webhook (`app/api/clerkwebhook/route.ts`) on `user.created` (svix signature verified).
- Server-side: `auth()` from `@clerk/nextjs/server`. Helpers in `src/lib/db/auth-helpers.ts`.

## Data Access Pattern

D1 is server-only. Client components must NOT import from `@/lib/db`; they call **server actions** under `src/lib/actions/` which compose query-module calls and add auth checks.

## API Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dupr-score` | Stub — returns `{ score: null }`. Awaits mydupr.com integration |
| POST | `/api/leagues/leave` | Clerk-authed. Calls `removeMember`. |
| GET | `/api/session/[id]/metadata` | Public (by design — OG previews). Returns session info from D1. |
| GET | `/api/og` | Generates Open Graph images |
| POST/PATCH/DELETE | `/api/admin/users` | Admin-only Clerk user + profile management. |
| POST | `/api/clerkwebhook` | Svix-verified. user.created/updated/deleted lifecycle hooks. |

## Known Gotchas

- **Admin email is hardcoded** in `src/lib/constants.ts`. Changing it is a one-line edit.
- **CSP**: nonce-based CSP is set per-request in `middleware.ts` (includes Clerk + Turnstile + Cloudflare Insights). The layout reads the nonce via `headers().get('x-nonce')`.
- **`robots.txt` references `/sitemap.xml`** — generated dynamically by `app/sitemap.ts`.
- **Build version injected at build time**: `next.config.mjs` sets `env: { NEXT_PUBLIC_BUILD_VERSION }`, read in `BuildVersion.tsx` via `process.env.NEXT_PUBLIC_BUILD_VERSION`. No generated source file — the old `src/lib/buildVersion.ts` is git-ignored.
- **D1 access in OpenNext**: use `getDbAsync()` (`getCloudflareContext({ async: true })`) inside Server Components and server actions.
- **`next dev` does NOT expose the D1 binding** — use `npm run preview` for DB work.
- **`admin_events.payload` is TEXT, not JSONB** — use `encodeJson/decodeJson`.
- **Audits live outside this repo** — see `docs/AUDITS.md`. The old in-repo `docs/audits/` trail was retired to `_delete/2026-09-07/`; its "Open" items are stale.

## Sync Policy (always — no prompting needed)

After ANY code/content change, finish the session by syncing without being asked:

1. `git add -A && git commit -m "<concise message>" && git push origin main`
2. Push = deploy: Cloudflare's Pages GitHub integration builds and deploys `main` (the GH Action is a CI gate only — it does not deploy).
3. If D1 schema/migrations changed, also run `wrangler d1 migrations apply pickled-citizens --remote`.

Never leave work uncommitted or unpushed. Never wait for Hun to say "push/commit/sync".
