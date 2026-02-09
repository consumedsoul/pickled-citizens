-- Supabase schema for Pickled Citizens MVP

-- Users are managed by Supabase auth. This table stores app-specific profile data.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  email text,
  first_name text,
  last_name text,
  gender text,
  dupr_id text,
  self_reported_dupr numeric(4, 2),
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
  role text not null default 'player' check (role in ('player', 'admin')),
  email text,
  created_at timestamptz default now(),
  primary key (league_id, user_id)
);

-- Migration: Ensure all leagues have at least one admin
-- This promotes existing owners to admin role in league_members
do $$
begin
  -- Update existing league_members to set owner as admin if they exist
  update public.league_members 
  set role = 'admin' 
  where user_id in (
    select owner_id from public.leagues 
    where id = league_id
  );
  
  -- Insert admin records for owners who aren't already in league_members
  insert into public.league_members (league_id, user_id, role)
  select id, owner_id, 'admin'
  from public.leagues
  where not exists (
    select 1 from public.league_members 
    where league_id = leagues.id and user_id = leagues.owner_id
  );
end $$;

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
  position int not null default 0,
  primary key (match_id, user_id)
);

-- Match results / history
create table if not exists public.match_results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  team1_score int,
  team2_score int,
  completed_at timestamptz
);

-- Admin events
create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  league_id uuid references public.leagues(id) on delete set null,
  payload jsonb
);

alter table public.admin_events enable row level security;
create policy admin_events_insert_authenticated on public.admin_events
  for insert
  with check (auth.role() = 'authenticated');
create policy admin_events_select_admin on public.admin_events
  for select
  using ((auth.jwt() ->> 'email') = 'hun@ghkim.com');

-- Function to delete a user from auth.users (admin only)
create or replace function admin_delete_user(user_id_to_delete uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only allow the admin user to delete accounts
  if (auth.jwt() ->> 'email') <> 'hun@ghkim.com' then
    raise exception 'Permission denied: admin access required';
  end if;
  
  -- Delete the user from auth.users
  delete from auth.users where id = user_id_to_delete;
end;
$$;

-- RLS POLICIES

-- Profiles: Authenticated users can read all, only edit own
alter table public.profiles enable row level security;
create policy profiles_read_authenticated on public.profiles
  for select
  using (auth.role() = 'authenticated');
create policy profiles_write_own on public.profiles
  for insert
  with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id);

-- Leagues: Users can see all leagues, but only owners can manage
alter table public.leagues enable row level security;
create policy leagues_select_all_authenticated on public.leagues
  for select
  using (auth.role() = 'authenticated');
create policy leagues_manage_owner on public.leagues
  for insert
  with check (owner_id = auth.uid());
create policy leagues_update_owner on public.leagues
  for update
  using (owner_id = auth.uid());
create policy leagues_delete_owner on public.leagues
  for delete
  using (owner_id = auth.uid());

-- League members: Users can see all members (for league context), but only admins can manage
alter table public.league_members enable row level security;
create policy league_members_select_all_authenticated on public.league_members
  for select
  using (auth.role() = 'authenticated');
create policy league_members_manage_admin on public.league_members
  for insert
  with check (
    auth.uid() in (
      select owner_id from public.leagues where id = league_id
    )
  );
create policy league_members_update_admin on public.league_members
  for update
  using (
    auth.uid() in (
      select owner_id from public.leagues where id = league_id
    )
  );
create policy league_members_delete_admin on public.league_members
  for delete
  using (
    auth.uid() in (
      select owner_id from public.leagues where id = league_id
    ) or user_id = auth.uid()
  );

-- League invites: Users can see invites they sent or for leagues they admin
alter table public.league_invites enable row level security;
create policy league_invites_select_own on public.league_invites
  for select
  using (
    invited_by = auth.uid() or 
    league_id in (select league_id from public.league_members where user_id = auth.uid() and role = 'admin') or
    league_id in (select id from public.leagues where owner_id = auth.uid())
  );
create policy league_invites_manage_admin on public.league_invites
  for all
  using (
    league_id in (select id from public.leagues where owner_id = auth.uid())
  )
  with check (
    league_id in (select id from public.leagues where owner_id = auth.uid())
  );

-- Game sessions: Users can see all sessions, but only creators or league owners can manage
alter table public.game_sessions enable row level security;
create policy game_sessions_select_all_authenticated on public.game_sessions
  for select
  using (auth.role() = 'authenticated');
create policy game_sessions_insert_owner on public.game_sessions
  for insert
  with check (
    created_by = auth.uid() or
    league_id in (select id from public.leagues where owner_id = auth.uid())
  );
create policy game_sessions_update_owner on public.game_sessions
  for update
  using (
    created_by = auth.uid() or
    league_id in (select id from public.leagues where owner_id = auth.uid())
  );
create policy game_sessions_delete_owner on public.game_sessions
  for delete
  using (
    created_by = auth.uid() or
    league_id in (select id from public.leagues where owner_id = auth.uid())
  );

-- Matches: Users can see all matches, but only session creators or league owners can manage
alter table public.matches enable row level security;
create policy matches_select_all_authenticated on public.matches
  for select
  using (auth.role() = 'authenticated');
create policy matches_insert_owner on public.matches
  for insert
  with check (
    session_id in (
      select id from public.game_sessions 
      where created_by = auth.uid() or
      league_id in (select id from public.leagues where owner_id = auth.uid())
    )
  );
create policy matches_update_owner on public.matches
  for update
  using (
    session_id in (
      select id from public.game_sessions 
      where created_by = auth.uid() or
      league_id in (select id from public.leagues where owner_id = auth.uid())
    )
  );
create policy matches_delete_owner on public.matches
  for delete
  using (
    session_id in (
      select id from public.game_sessions 
      where created_by = auth.uid() or
      league_id in (select id from public.leagues where owner_id = auth.uid())
    )
  );

-- Match players: Users can see all match players, but only match/session owners can manage
alter table public.match_players enable row level security;
create policy match_players_select_all_authenticated on public.match_players
  for select
  using (auth.role() = 'authenticated');
create policy match_players_insert_owner on public.match_players
  for insert
  with check (
    match_id in (
      select id from public.matches 
      where session_id in (
        select id from public.game_sessions 
        where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
      )
    )
  );
create policy match_players_update_owner on public.match_players
  for update
  using (
    match_id in (
      select id from public.matches 
      where session_id in (
        select id from public.game_sessions 
        where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
      )
    )
  );
create policy match_players_delete_owner on public.match_players
  for delete
  using (
    match_id in (
      select id from public.matches 
      where session_id in (
        select id from public.game_sessions 
        where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
      )
    )
  );

-- Match results: Users can see all match results, but only match/session owners can manage
alter table public.match_results enable row level security;
create policy match_results_select_all_authenticated on public.match_results
  for select
  using (auth.role() = 'authenticated');
create policy match_results_insert_owner on public.match_results
  for insert
  with check (
    match_id in (
      select id from public.matches 
      where session_id in (
        select id from public.game_sessions 
        where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
      )
    )
  );
create policy match_results_update_owner on public.match_results
  for update
  using (
    match_id in (
      select id from public.matches 
      where session_id in (
        select id from public.game_sessions 
        where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
      )
    )
  );
create policy match_results_delete_owner on public.match_results
  for delete
  using (
    match_id in (
      select id from public.matches 
      where session_id in (
        select id from public.game_sessions 
        where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
      )
    )
  );