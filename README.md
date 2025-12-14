# Pickled Citizens

Lightweight web app for running casual pickleball leagues: create leagues, invite players, schedule sessions, auto-generate balanced doubles matchups, and track results with a simple DUPR-style rating display.

---

## Features

- **Email-based auth**
  - Magic-link sign up / sign in via Supabase Auth.
  - Profile completion with first/last name, gender, and self-reported DUPR.

- **Multi-Admin League System**
  - Create leagues with multiple administrators instead of single owners.
  - Admins can promote/demote members to admin status.
  - Minimum 1 admin required per league (enforced at database and UI level).
  - Admins cannot demote themselves if they're the sole admin.
  - Automatic admin assignment for league creators.
  - Visual distinction between admins (👑) and regular members (👤).

- **Leagues**
  - Create and manage leagues with per-user league limits enforced in the database.
  - Case-insensitive duplicate league name protection.
  - Members list with names, email, self-reported DUPR, and admin status.
  - League sorting: managed leagues appear first (A-Z), followed by member leagues (A-Z).
  - Role-based permissions for league management.

- **Game sessions**
  - League admins can schedule sessions for **6, 8, 10, or 12** players.
  - Select players from a league and order them by DUPR (with manual reordering).
  - Automatically generates balanced doubles teams and matchups using a snaking algorithm.
  - **Enhanced 8-player format**: 6 rounds (12 games total) with repeated matchups for extended play.
  - Sessions are persisted in PostgreSQL via Supabase (`game_sessions`, `matches`, `match_players`, `match_results`).
  - Session detail view shows:
    - Overall team records (Team A vs Team B).
    - Per-player win/loss and games played.
    - Match-by-match pairings and a simple single-click "Win" toggle for each side.
  - **Permissions**:
    - Session creator (league admin) can update match results.
    - Any player who participates in a session can view it in their history as read-only.

- **Session history**
  - Sessions page shows:
    - **Current / upcoming sessions** at the top (soonest first).
    - **Past sessions** below (most recent first).
  - Uses scheduled time when available, otherwise creation time.

- **Account Security**
  - Account deletion protection for sole admins of any league.
  - Clear error messages displayed directly at deletion points.
  - League deletion protection for sole admins.
  - Admin event logging for all role changes and deletions.

- **Admin tools**
  - Restricted to a **configured super-admin user** via RLS and UI checks.
  - `/admin/events`: System event log (e.g., league created, session created, user signup, role changes).
  - `/admin/users`: User management (view, edit, delete profiles).
  - Footer shows `Logs` and `Users` links only for the super-admin.

- **Branding & UX**
  - Custom logo in the header using `next/image` for crisp rendering.
  - Simple dark theme with minimal dependencies.
  - Favicon based on the same logo asset.
  - Landing page with clear CTA for sign up / sign in.
  - Contextual error messages displayed at relevant action points.
  - Visual indicators for user roles and permissions.

---

## Tech stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript, React 18
- **Backend / DB**: [Supabase](https://supabase.com/) (Postgres, Auth, RLS)
- **Client DB access**: `@supabase/supabase-js` v2
- **Hosting**: Cloudflare Workers (SSR) via [OpenNext for Cloudflare](https://opennext.js.org/)

---

## Project structure (high level)

- `app/`
  - `layout.tsx` – global layout, header, navigation, footer.
  - `page.tsx` – home/landing page with league sorting.
  - `auth/` – sign up and auth-completion flow (magic link).
  - `auth/signin` – existing user sign-in.
  - `auth/complete` – completes signup, upserts profile, and redirects.
  - `profile/` – user profile management with admin deletion protection.
  - `leagues/` – list and manage leagues with role-based sorting.
  - `leagues/[id]/` – single league details with multi-admin management.
  - `sessions/` – create sessions and show session history.
  - `sessions/[id]/` – individual session detail page (teams, matchups, results).
  - `admin/events/` – admin event log (super-admin only).
  - `admin/users/` – admin user management (super-admin only).

- `src/components/`
  - `AuthStatus.tsx` – header auth indicator + sign in/out.
  - `AdminFooterLinks.tsx` – conditional footer links for the super-admin.

- `src/lib/`
  - `supabaseClient.ts` – initializes the browser-side Supabase client.

- `supabase/`
  - `schema.sql` – database schema for profiles, leagues, league_members (with role system), sessions, matches, match_players, match_results, admin_events, plus RLS policies and migration scripts.

- `docs/`
  - Additional project documentation (if present).

---

## Getting started

### Prerequisites

- **Node.js** 18+ (Next.js 14 requirement)
- **npm** or **yarn**
- A **Supabase** project with:
  - Auth enabled (email magic link).
  - A Postgres database where you can run `supabase/schema.sql`.

---

## Environment variables

Create a `.env.local` file in the project root with your Supabase credentials and site URL:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=https://your-site-url.example.com
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used by `src/lib/supabaseClient.ts`.
- `NEXT_PUBLIC_SITE_URL` is used by the auth flow for redirect URLs (falls back to `window.location.origin` in development).
- `SUPABASE_SERVICE_ROLE_KEY` is used by server-side Route Handlers that bypass RLS (e.g. `/api/session/[id]/metadata`).
- **Do not commit** `.env.local` to version control.

---

## Database schema

Run the SQL in `supabase/schema.sql` against your Supabase Postgres instance (via the Supabase SQL editor or CLI).

This file defines tables like:

- `profiles`
- `leagues`, `league_members` (with role-based admin system)
- `game_sessions`, `matches`, `match_players`, `match_results`
- `admin_events` (with RLS allowing only the configured super-admin to read events)

It also sets up:
- Constraints (e.g., allowed player counts for sessions, role validation)
- RLS policies for multi-admin security
- Migration scripts to promote existing owners to admin roles

---

## Super-admin configuration

A single **super-admin user** is used for admin views and event log access.

- RLS policies in `supabase/schema.sql` and UI components like `AdminFooterLinks` assume a specific super-admin identifier (e.g., a particular email).
- To change the super-admin:
  1. Update the RLS policy for `admin_events` (and any other admin tables) in `supabase/schema.sql`.
  2. Update any hard-coded checks in components (e.g., `AdminFooterLinks`, auth-related code).

Avoid committing any real personal identifiers (like actual email addresses) to version control.

---

## Key flows

### Sign up & profile

1. User goes to `/auth` and enters:
   - Email, first name, last name, gender, **self-reported DUPR**.
2. App sends a Supabase magic link with redirect to `/auth/complete`.
3. `/auth/complete` upserts the `profiles` row with the provided data.
4. User is redirected to `/profile` where they can edit details and see their leagues.

The self-reported DUPR field is **required**, with validation and a helper link to a public guide on estimating pickleball rating.

### Multi-Admin League Management

1. From `/leagues`, authenticated users can create leagues (automatically become admin).
2. League admins can manage members through `/leagues/[id]`:
   - View members separated into "League Admins" and "Members" sections
   - Promote regular members to admin status
   - Demote admins to regular members (if not the sole admin)
   - Remove members from the league
3. Role changes are logged to `admin_events` for audit.
4. League deletion is blocked for sole admins with clear error messaging.

### League Display & Sorting

1. Home page and leagues page show:
   - **Managed leagues first** (where user is admin), sorted A-Z
   - **Member leagues below** (where user is regular member), sorted A-Z
2. Visual indicators: 👑 for managed leagues, 👤 for member leagues
3. Role-based access controls throughout the application.

### Sessions

1. League admins go to `/sessions`.
2. Select a league, date/time, player count, and pick players from the league roster.
3. The app sorts players by DUPR and allows manual ordering.
4. On "Create session", the app:
   - Inserts into `game_sessions`.
   - Creates `matches` and `match_players` rows according to the matchup plan.
   - For 8-player sessions: generates 6 rounds (12 games) with repeated matchups
   - Logs `session.created` to `admin_events`.
   - Redirects to `/sessions/[id]`.
5. The session detail page lets admins toggle winners for each matchup; results are stored in `match_results`.
6. Non-admin participants can view sessions and standings but cannot modify results.

### Account Security

1. Account deletion checks for sole admin status across all leagues.
2. League deletion checks if user is the sole admin of that league.
3. Clear error messages appear at relevant action points (not just page top).
4. Admin must promote another member before deletion can proceed.

### Admin views

- `Logs` (footer link → `/admin/events`): paginated list of `admin_events` including role changes.
- `Users` (footer link → `/admin/users`): list + edit/delete for user profiles.
- Both are guarded by RLS and client-side checks so only the super-admin can see them.

---

## Recent Updates

### Multi-Admin System (Latest)
- **Database**: Added `role` column to `league_members` table with 'player'/'admin' constraints
- **Migration**: Automatic promotion of existing league owners to admin status
- **UI**: Separate admin/member sections with promotion/demotion controls
- **Security**: Sole admin protection for league and account deletion
- **Sorting**: Role-based league display (admin leagues first, then member leagues)

### Enhanced 8-Player Sessions
- **Extended gameplay**: 6 rounds (12 games) instead of 3 rounds (6 games)
- **Repeated matchups**: Rounds 4-6 repeat the pairings from rounds 1-3
- **Better session length**: More playtime for 8-player groups

### Improved Error Handling
- **Contextual errors**: Messages appear at relevant action points
- **Better UX**: No need to scroll to see error messages
- **Clear guidance**: Specific instructions for admin-related actions

---

## Scripts

From `package.json`:

```bash
npm run dev     # Start Next.js dev server
npm run build   # Production build
npm run start   # Start production server (after build)
npm run lint    # Run ESLint
npm run preview # Build OpenNext bundle + run a local Cloudflare-style preview
npm run deploy  # Build OpenNext bundle + deploy to Cloudflare (preserves dashboard vars)
npm run cf-typegen # Generate Cloudflare env type definitions
```

---

## Development

1. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

2. Configure `.env.local` as described above.
3. Apply `supabase/schema.sql` to your Supabase instance.
4. Run the dev server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Visit `http://localhost:3000`.

---

## Deployment

This app is deployed to **Cloudflare Workers** using **OpenNext**.

### Cloudflare build + deploy (recommended)

Use Cloudflare’s **Workers → Build → Connect to repository** integration so pushes to `main` build and deploy automatically.

In Cloudflare Worker build configuration, use:

```bash
# Build command
npx opennextjs-cloudflare build

# Deploy command
npx wrangler deploy --keep-vars
```

### Cloudflare environment variables

There are two places variables matter:

- **Build-time** (used during `next build`): set `NEXT_PUBLIC_*` values in Cloudflare’s build “Variables and secrets”.
- **Runtime** (used by the Worker at request time): set `SUPABASE_SERVICE_ROLE_KEY` as an encrypted secret.

Recommended configuration:

- `NEXT_PUBLIC_SUPABASE_URL` (variable)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (variable)
- `NEXT_PUBLIC_SITE_URL` (variable)
- `SUPABASE_SERVICE_ROLE_KEY` (secret / encrypted)

### Local deploy (optional)

If you deploy from your machine instead of Cloudflare Git integration:

```bash
npm run deploy
```

`--keep-vars` is used to avoid wiping dashboard-managed variables.

### Domain routing + Supabase cutover

1. Configure Cloudflare DNS so `pickledcitizens.com` and `www.pickledcitizens.com` are proxied (orange cloud) and no longer point at Netlify.
2. Add Worker routes:
   - `pickledcitizens.com/*`
   - `www.pickledcitizens.com/*`
3. In Supabase, add allowed redirect URLs (Authentication → URL Configuration):
   - `https://pickledcitizens.com/auth/complete`
   - `https://www.pickledcitizens.com/auth/complete`
   - (If using password reset) `https://pickledcitizens.com/auth/reset/complete`
4. Set Supabase Site URL to `https://pickledcitizens.com`.

---

## License

This project is currently proprietary for personal/league use.  
Adjust this section if you choose to open-source it (e.g., MIT, Apache 2.0, etc.).
