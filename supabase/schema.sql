-- Supabase schema for PickledCitizens MVP

-- Users are managed by Supabase auth. This table stores app-specific profile data.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  display_name text,
  avatar_url text
);

-- Leagues
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade
);

-- League members
create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player',
  created_at timestamptz default now(),
  primary key (league_id, user_id)
);

-- Player invites
create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending', -- pending, accepted, revoked
  created_at timestamptz default now(),
  accepted_at timestamptz
);

-- Game sessions (for 6/8/10/12 players, all doubles)
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  scheduled_for timestamptz,
  location text,
  player_count int not null check (player_count in (6, 8, 10, 12))
);

-- Matches within a session (all doubles)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  court_number int,
  scheduled_order int,
  status text not null default 'scheduled', -- scheduled, completed, canceled
  created_at timestamptz default now()
);

-- Match participants (teams of 2)
create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team int not null check (team in (1, 2)),
  primary key (match_id, user_id)
);

-- Match results / history
create table if not exists public.match_results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  team1_score int,
  team2_score int,
  completed_at timestamptz
);
