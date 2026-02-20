# Pickled Citizens

Lightweight web app for running casual pickleball leagues: create leagues, invite players, schedule sessions, auto-generate balanced doubles matchups, and track results with lifetime statistics and DUPR-style rating display.

**Live Site**: [pickledcitizens.com](https://pickledcitizens.com)

---

## Features

- **Email-based Authentication**
  - Magic-link sign up / sign in via Supabase Auth.
  - Profile completion with first/last name, gender, and self-reported DUPR.
  - Password reset flow with email verification.
  - Secure session management with automatic token refresh.

- **Multi-Admin League System**
  - Create leagues with multiple administrators instead of single owners.
  - Admins can promote/demote members to admin status.
  - Minimum 1 admin required per league (enforced at database and UI level).
  - Admins cannot demote themselves if they're the sole admin.
  - Automatic admin assignment for league creators.
  - Visual distinction between admins (👑) and regular members (👤).
  - League owner retains ultimate control while delegating admin responsibilities.

- **League Management**
  - Create and manage leagues with role-based permissions.
  - Members list with names, email, self-reported DUPR, and admin status.
  - League sorting: managed leagues appear first (A-Z), followed by member leagues (A-Z).
  - Member count display for each league.
  - League invites system for adding new members.
  - Leave league functionality with sole admin protection.
  - Dedicated admin page (`/admin/leagues`) for super-admin oversight.

- **Game Sessions**
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
  - Session metadata API for sharing and social previews.

- **Session History & Statistics**
  - Sessions page shows:
    - **Current / upcoming sessions** at the top (soonest first).
    - **Past sessions** below (most recent first).
  - Uses scheduled time when available, otherwise creation time.
  - History page (`/history`) — placeholder (not yet implemented).
  - Lifetime statistics tracking:
    - Individual wins/losses (personal match record).
    - Team wins/losses/ties (Team A vs Team B record).
    - Total games played.
    - Win percentages and performance metrics.

- **Account Security**
  - Account deletion protection for sole admins of any league.
  - Clear error messages displayed directly at deletion points.
  - League deletion protection for sole admins.
  - Admin event logging for all role changes and deletions.
  - Secure profile management with email verification.

- **Admin Tools**
  - Restricted to a **configured super-admin user** via RLS and UI checks.
  - `/admin/events`: System event log (league created, session created, user signup, role changes).
  - `/admin/users`: User management (view, edit, delete profiles).
  - `/admin/leagues`: League oversight and management.
  - Footer shows `Logs`, `Users`, and `Leagues` links only for the super-admin.
  - Admin function for deleting users from auth system.

- **Branding & UX**
  - Custom logo in the header using `next/image` for crisp rendering.
  - Clean, modern design with custom color palette (Tailwind CSS).
  - Favicon and social media preview images.
  - Landing page with clear CTA for sign up / sign in.
  - Contextual error messages displayed at relevant action points.
  - Visual indicators for user roles and permissions.
  - Responsive design for mobile and desktop.
  - Active navigation highlighting.

---

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, React Server Components)
- **Language**: TypeScript 5.6, React 18
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/) with custom design tokens
- **Backend / DB**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Row Level Security)
- **Client DB Access**: `@supabase/supabase-js` v2.48
- **Hosting**: [Cloudflare Workers](https://workers.cloudflare.com/) (SSR) via [OpenNext for Cloudflare](https://opennext.js.org/) v1.3
- **Build Tool**: [Wrangler 4.54](https://developers.cloudflare.com/workers/wrangler/)
- **Repository**: GitHub (consumedsoul/pickled-citizens)

---

## Project Structure

### Application Routes (`app/`)
- `layout.tsx` – Global layout with header, navigation, footer, and metadata.
- `page.tsx` – Home/landing page with league sorting, session history, and lifetime stats.
- `globals.css` – Global styles and Tailwind directives.

#### Authentication (`auth/`)
- `page.tsx` – Sign up page with magic link flow.
- `signin/page.tsx` – Sign in page for existing users.
- `complete/` – Auth completion handler (upserts profile, redirects).
  - `page.tsx` – Server component wrapper.
  - `AuthCompleteClient.tsx` – Client component for auth completion logic.
- `reset/` – Password reset flow.
  - `page.tsx` – Request password reset.
  - `complete/page.tsx` – Complete password reset.

#### User Pages
- `profile/page.tsx` – User profile management with deletion protection.
- `history/page.tsx` – Session history placeholder (not yet implemented).
- `account-deleted/page.tsx` – Confirmation page after account deletion.

#### League Management (`leagues/`)
- `page.tsx` – List all leagues with role-based sorting.
- `[id]/page.tsx` – Single league details with member management and admin controls.

#### Session Management (`sessions/`)
- `page.tsx` – Create sessions and view session history (upcoming/past).
- `[id]/` – Individual session details.
  - `layout.tsx` – Session layout wrapper.
  - `page.tsx` – Session detail page (teams, matchups, results).

#### Admin Pages (`admin/`)
- `events/` – System event log (super-admin only).
  - `page.tsx` – Server component wrapper.
  - `AdminEventsClient.tsx` – Client component with pagination.
- `users/page.tsx` – User management (view, edit, delete).
- `leagues/page.tsx` – League oversight and management.

#### API Routes (`api/`)
- `dupr-score/route.ts` – DUPR score lookup/validation.
- `leagues/leave/route.ts` – Leave league endpoint.
- `session/[id]/metadata/route.ts` – Session metadata for social sharing.
- `og/route.tsx` – Open Graph image generation.

### Components (`src/components/`)
- `AuthStatus.tsx` – Header auth indicator with sign in/out button.
- `Navigation.tsx` – Main navigation with active route highlighting.
- `AdminFooterLinks.tsx` – Conditional footer links for super-admin.

### Types (`src/types/`)
- `database.ts` – TypeScript type definitions for all Supabase tables (Row, Insert, Update).
- `supabase.ts` – Generated Supabase types (needs regeneration).

### Library (`src/lib/`)
- `supabaseClient.ts` – Supabase client initialization (browser and service role).

### Database (`supabase/`)
- `schema.sql` – Complete database schema:
  - Tables: `profiles`, `leagues`, `league_members`, `league_invites`, `game_sessions`, `matches`, `match_players`, `match_results`, `admin_events`.
  - Row Level Security (RLS) policies for all tables.
  - Multi-admin role system with migration scripts.
  - Admin functions for user deletion.

### Configuration Files
- `next.config.mjs` – Next.js configuration.
- `tailwind.config.js` – Tailwind CSS with custom color palette.
- `tsconfig.json` – TypeScript configuration.
- `.eslintrc.json` – ESLint rules (TypeScript, no-console).
- `.env.example` – Environment variable template.
- `wrangler.toml` – Cloudflare Pages configuration.
- `wrangler.worker.toml` – Cloudflare Workers configuration.
- `open-next.config.ts` – OpenNext for Cloudflare configuration.
- `postcss.config.js` – PostCSS configuration.

#### Middleware
- `admin/middleware.ts` – Server-side admin route protection (JWT verification).

### Documentation (`docs/`)
- `prd.md` – Product Requirements Document.
- `audits/` – Weekly code audit reports.

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

## Database Schema

Run the SQL in `supabase/schema.sql` against your Supabase Postgres instance (via the Supabase SQL editor or CLI).

### Tables

- **`profiles`** – User profile data (name, gender, DUPR, display name, avatar).
- **`leagues`** – League information with owner reference.
- **`league_members`** – Many-to-many relationship with role system ('player' or 'admin').
- **`league_invites`** – Pending/accepted/revoked league invitations.
- **`game_sessions`** – Session metadata (league, creator, date, player count).
- **`matches`** – Individual matches within sessions (court, order, status).
- **`match_players`** – Match participants with team assignments (team 1 or 2).
- **`match_results`** – Match scores and completion timestamps.
- **`admin_events`** – System audit log for admin actions and events.

### Security Features

- **Row Level Security (RLS)** enabled on all tables with granular policies.
- **Role-based access control** for league admins vs regular members.
- **Super-admin policies** restricting admin_events to configured email.
- **Cascading deletes** to maintain referential integrity.
- **Check constraints** for data validation (player counts, roles, teams).
- **Admin function** (`admin_delete_user`) for secure user deletion.

### Migrations

- Automatic promotion of league owners to admin role in `league_members`.
- Ensures all leagues have at least one admin member.

---

## Super-Admin Configuration

A single **super-admin user** is configured for system-wide admin access and event log viewing.

### Current Implementation

The super-admin email is currently hardcoded in two locations:
1. **Database RLS Policy** (`supabase/schema.sql`):
   - `admin_events_select_admin` policy checks `(auth.jwt() ->> 'email') = 'hun@ghkim.com'`
   - `admin_delete_user` function checks the same email
2. **UI Component** (`src/components/AdminFooterLinks.tsx`):
   - Line 38: `const isAdmin = email === 'hun@ghkim.com';`

### Changing the Super-Admin

To configure a different super-admin user:

1. **Update the database schema** (`supabase/schema.sql`):
   ```sql
   -- Line 123: Update the admin_events RLS policy
   create policy admin_events_select_admin on public.admin_events
     for select
     using ((auth.jwt() ->> 'email') = 'your-email@example.com');
   
   -- Line 133: Update the admin_delete_user function
   if (auth.jwt() ->> 'email') <> 'your-email@example.com' then
     raise exception 'Permission denied: admin access required';
   end if;
   ```

2. **Update the UI component** (`src/components/AdminFooterLinks.tsx`):
   ```typescript
   const isAdmin = email === 'your-email@example.com';
   ```

3. **Apply the schema changes** to your Supabase instance via SQL editor.

**Security Note**: Consider using environment variables or Supabase secrets for production deployments instead of hardcoding email addresses.

---

## Key Flows

### Sign Up & Profile

1. User visits `/auth` and enters:
   - Email, first name, last name, gender, **self-reported DUPR** (required).
2. Supabase sends a magic link email with redirect to `/auth/complete`.
3. `/auth/complete` verifies the token and upserts the `profiles` table.
4. User is redirected to home page (`/`) with authenticated session.
5. User can edit profile details at `/profile`.

**DUPR Field**: Required numeric field (0.00-8.00) with validation and helper link to DUPR rating guide.

### Sign In

1. Existing users visit `/auth/signin`.
2. Enter email to receive magic link.
3. Click link to authenticate and return to home page.

### Password Reset

1. User visits `/auth/reset` and enters email.
2. Supabase sends password reset email.
3. User clicks link and completes reset at `/auth/reset/complete`.

### Multi-Admin League Management

1. **Create League**: From `/leagues`, authenticated users create leagues (automatically become admin and owner).
2. **Manage Members** at `/leagues/[id]`:
   - View members separated into "League Admins" and "Members" sections.
   - Promote regular members to admin status (owner only).
   - Demote admins to regular members (owner only, if not sole admin).
   - Remove members from the league.
3. **Audit Trail**: All role changes logged to `admin_events`.
4. **Protection**: League deletion blocked for sole admins with contextual error messages.

### League Display & Sorting

1. **Home page** (`/`) and **leagues page** (`/leagues`) display:
   - **Managed leagues first** (where user is admin), sorted A-Z with 👑 icon.
   - **Member leagues below** (where user is regular member), sorted A-Z with 👤 icon.
2. Each league shows member count and creation year.
3. Role-based access controls throughout the application.

### Session Creation & Management

1. **Create Session**: League admins visit `/sessions`.
2. **Configure Session**:
   - Select a league.
   - Choose date/time and location (optional).
   - Select player count (6, 8, 10, or 12).
   - Pick players from league roster.
3. **Player Ordering**: App sorts by DUPR with manual reordering allowed.
4. **Generate Matchups**: On "Create session":
   - Inserts into `game_sessions`.
   - Creates `matches` and `match_players` using snaking algorithm.
   - **8-player format**: Generates 6 rounds (12 games) with repeated matchups.
   - Logs `session.created` to `admin_events`.
   - Redirects to `/sessions/[id]`.
5. **Record Results**: Session detail page allows admins to toggle winners; results stored in `match_results`.
6. **View Access**: All participants can view sessions read-only; only creator can edit.

### Session History & Statistics

1. **Sessions Page** (`/sessions`): Shows upcoming sessions (soonest first) and past sessions (most recent first).
2. **History Page** (`/history`): Placeholder — not yet implemented.
3. **Home Page** (`/`): Displays lifetime statistics:
   - Individual wins/losses (personal match record).
   - Team wins/losses/ties (Team A vs Team B record).
   - Win percentages calculated automatically.

### Account Security

1. **Account Deletion**: Profile page checks for sole admin status across all leagues.
2. **League Deletion**: Blocked if user is sole admin of the league.
3. **Error Messages**: Contextual errors displayed at action points.
4. **Required Action**: Admin must promote another member before deletion can proceed.
5. **Audit Trail**: All deletions and role changes logged to `admin_events`.

### Admin Views (Super-Admin Only)

- **Logs** (`/admin/events`): Paginated system event log with filtering.
- **Users** (`/admin/users`): User management (view, edit, delete profiles).
- **Leagues** (`/admin/leagues`): League oversight and management.
- **Access Control**: Guarded by RLS policies and client-side checks.
- **Footer Links**: Only visible to configured super-admin email.

---

## Recent Updates

### Multi-Admin System
- **Database**: Added `role` column to `league_members` table with 'player'/'admin' constraints.
- **Migration**: Automatic promotion of existing league owners to admin status.
- **UI**: Separate admin/member sections with promotion/demotion controls.
- **Security**: Sole admin protection for league and account deletion.
- **Sorting**: Role-based league display (admin leagues first, then member leagues).

### Enhanced 8-Player Sessions
- **Extended gameplay**: 6 rounds (12 games) instead of 3 rounds (6 games).
- **Repeated matchups**: Rounds 4-6 repeat the pairings from rounds 1-3.
- **Better session length**: More playtime for 8-player groups.

### Session History & Statistics
- **Lifetime stats**: Individual and team win/loss tracking on home page.
- **Win percentages**: Automatic calculation of performance metrics.

### Admin Tools Enhancement
- **Leagues admin page**: Added `/admin/leagues` for super-admin oversight.
- **Event logging**: Comprehensive audit trail for all admin actions.
- **User management**: Enhanced profile editing and deletion capabilities.

### UX Improvements
- **Contextual errors**: Messages appear at relevant action points.
- **Navigation**: Active route highlighting for better orientation.
- **Responsive design**: Mobile-friendly layouts throughout.
- **Social sharing**: Open Graph metadata for session sharing.

---

## Scripts

Available npm commands from `package.json`:

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build (Next.js)
npm run start        # Start production server (after build)
npm run lint         # Run ESLint

# Cloudflare deployment
npm run preview      # Build OpenNext bundle + run local Cloudflare preview
npm run deploy       # Build OpenNext bundle + deploy to Cloudflare Workers
npm run deploy:ci    # CI/CD deployment (same as deploy)
npm run pages:build  # Build for Cloudflare Pages (legacy)

# Development tools
npm run cf-typegen   # Generate Cloudflare environment type definitions
```

### Development Workflow

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build and preview locally (Cloudflare environment)
npm run preview

# Deploy to production
npm run deploy
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

## Development Best Practices

### Code Organization
- **Server Components**: Use by default for better performance
- **Client Components**: Mark with `'use client'` only when needed (hooks, browser APIs)
- **Type Safety**: Leverage TypeScript for all code
- **RLS First**: Rely on Supabase RLS policies for security, not just client-side checks

### Database Changes
1. Update `supabase/schema.sql` with new schema changes
2. Test locally with Supabase CLI or SQL editor
3. Apply to production database via Supabase dashboard
4. Document migrations in schema file comments

### Styling Guidelines
- Use Tailwind utility classes
- Follow custom color palette defined in `tailwind.config.js`
- Maintain responsive design (mobile-first approach)
- Keep consistent spacing and typography

### Testing Deployment
```bash
# Test locally with Cloudflare Workers environment
npm run preview

# Access at http://localhost:8788
```

---

## Contributing

This is a personal project for managing pickleball leagues. If you'd like to use it for your own league or contribute improvements:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Test thoroughly (especially RLS policies)
5. Submit a pull request with description

### Areas for Contribution
- Additional session formats (round robin, king of the court)
- Enhanced statistics and analytics
- Mobile app wrapper
- Internationalization (i18n)
- Accessibility improvements

---

## Support & Contact

- **Repository**: [github.com/consumedsoul/pickled-citizens](https://github.com/consumedsoul/pickled-citizens)
- **Live Site**: [pickledcitizens.com](https://pickledcitizens.com)
- **Issues**: Report bugs or request features via GitHub Issues

---

## License

This project is currently proprietary for personal/league use.

If you'd like to use this codebase for your own pickleball league, please reach out via GitHub.

Future consideration for open-source licensing (MIT, Apache 2.0, etc.) may be evaluated based on community interest.
