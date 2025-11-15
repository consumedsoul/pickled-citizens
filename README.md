# PickledCitizens 2.0

Lightweight web app for running casual pickleball leagues: create leagues, invite players, schedule sessions, auto-generate balanced doubles matchups, and track results with a simple DUPR-style rating display.

## Features

- **Email-based auth**
  - Magic-link sign up / sign in via Supabase Auth.
  - Profile completion with first/last name, gender, and self-reported DUPR.

- **Leagues**
  - Create and manage leagues (per-user league limit enforced in the database).
  - Case-insensitive duplicate name protection.
  - Members list with names, email, and self-reported DUPR.

- **Game sessions**
  - League owners can schedule sessions for **6, 8, 10, or 12** players.
  - Select players from your league and order them by DUPR (with manual reorder controls).
  - Automatically generates balanced doubles teams and matchups using a snaking algorithm.
  - Sessions are persisted in PostgreSQL via Supabase (`game_sessions`, `matches`, `match_players`, `match_results`).
  - Dedicated session detail view showing:
    - Overall team records (Team A vs Team B).
    - Per-player win/loss and games played.
    - Match-by-match pairings and a simple single-click "Win" toggle for each side.
  - **Permissions**:
    - Session creator (league owner) can update match results.
    - Any player who participates in a session can view it in their history as read-only.

- **Session history**
  - Sessions page shows:
    - **Current / upcoming sessions** at the top (soonest first).
    - **Past sessions** below (most recent first).
  - Uses scheduled time when available, otherwise creation time.

- **Admin tools**
  - Restricted to super-admin (`hun@ghkim.com`) via RLS and UI checks.
  - `/admin/events`: System event log (e.g., league created, session created, user signup).
  - `/admin/users`: User management (view, edit, delete profiles).
  - Footer shows `Logs` and `Users` links only for the super-admin.

- **Branding & UX**
  - Custom logo in the header using `next/image` for crisp rendering.
  - Simple dark theme with minimal dependencies.
  - Basic favicon support via the same logo asset.

## Tech stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript, React 18
- **Backend / DB**: [Supabase](https://supabase.com/) (Postgres, Auth, RLS)
- **Client DB access**: `@supabase/supabase-js` v2

## Project structure (high level)

- `app/`
  - `layout.tsx` – global layout, header, navigation, footer.
  - `page.tsx` – home/landing page (if present).
  - `auth/` – sign up, sign in, and auth-completion flow.
  - `profile/` – user profile management (name, gender, self-reported DUPR, league memberships).
  - `leagues/` – list and manage leagues.
  - `leagues/[id]/` – single league details and roster.
  - `sessions/` – create sessions and show session history.
  - `sessions/[id]/` – individual session detail page (teams, matchups, results).
  - `admin/events/` – admin event log (super-admin only).
  - `admin/users/` – admin user management (super-admin only).
- `src/components/`
  - `AuthStatus.tsx` – header auth indicator + sign in/out.
  - `AdminFooterLinks.tsx` – conditional footer links for super-admin.
- `supabase/schema.sql` – database schema for profiles, leagues, league_members, sessions, matches, match_players, match_results, admin_events, plus RLS policies.

## Getting started

### Prerequisites

- **Node.js** 18+ (Next.js 14 requirement)
- **npm** or **yarn**
- A **Supabase** project with:
  - Auth enabled (email magic link).
  - A Postgres database where you can run `supabase/schema.sql`.

### 1. Install dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

These are used by `lib/supabaseClient.ts` to create a browser-side Supabase client.

> **Note:** Do not commit `.env.local` to version control.

### 3. Apply the database schema

Run the SQL in `supabase/schema.sql` against your Supabase Postgres instance. You can use the Supabase SQL editor or CLI.

This file defines tables like:

- `profiles`
- `leagues`, `league_members`
- `game_sessions`, `matches`, `match_players`, `match_results`
- `admin_events` (with RLS allowing only `hun@ghkim.com` to read events)

It also sets up constraints (e.g., allowed player counts for sessions) and RLS policies.

### 4. Configure the super-admin

The super-admin email is currently hard-coded as:

```text
hun@ghkim.com
```

- RLS policies in `supabase/schema.sql` and UI components like `AdminFooterLinks` assume this email.
- To change the super-admin:
  - Update the RLS policy for `admin_events` in `supabase/schema.sql`.
  - Update any hard-coded checks in components (e.g., `AdminFooterLinks`).

### 5. Run the dev server

```bash
npm run dev
# or
yarn dev
```

Then open:

```text
http://localhost:3000
```

## Key flows

### Sign up & profile

1. User goes to `/auth` and enters:
   - Email, first name, last name, gender, **self-reported DUPR**.
2. App sends a Supabase magic link with redirect to `/auth/complete`.
3. `/auth/complete` upserts the `profiles` row with provided data.
4. User is redirected to `/profile` where they can edit details and see their leagues.

The self-reported DUPR field is **required**, with validation and a helper link to a public guide on estimating pickleball rating.

### Leagues

1. From `/leagues`, authenticated users can create leagues.
2. Creation checks for case-insensitive duplicate names for the same owner.
3. New leagues log an event to `admin_events` for audit.
4. League detail pages show members with name, email, and DUPR.

### Sessions

1. League owners go to `/sessions`.
2. Select a league, date/time, player count, and pick players from the league roster.
3. The app sorts players by DUPR and lets owners manually adjust order.
4. On "Create session", the app:
   - Inserts into `game_sessions`.
   - Creates `matches` and `match_players` rows according to the matchup plan.
   - Logs `session.created` to `admin_events`.
   - Redirects to `/sessions/[id]`.
5. The session detail page lets owners toggle winners for each matchup; results are stored in `match_results`.
6. Non-owner participants can view sessions and standings but cannot modify results.

### Admin views

- `Logs` (footer link → `/admin/events`): paginated list of `admin_events`.
- `Users` (footer link → `/admin/users`): list + edit/delete for user profiles.
- Both are guarded by RLS and client-side checks so only the super-admin can see them.

## Scripts

From `package.json`:

```bash
npm run dev     # Start Next.js dev server
npm run build   # Production build
npm run start   # Start production server (after build)
npm run lint    # Run ESLint
```

## Deployment

Any platform that supports Next.js 14 + environment variables should work (e.g. Vercel, Netlify with Next support, or a custom Node server).

- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in your hosting environment.
- Run database migrations / apply `supabase/schema.sql` to your production Supabase project.

## License

This project is currently proprietary for personal/league use. Adjust this section if you choose to open-source it.
