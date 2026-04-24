-- Guest players: one-off participants attached to a single session.
-- A guest is not a league member and has no auth.users row; they appear
-- in team generation and match rosters but are excluded from lifetime stats.

create table if not exists public.session_guests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  dupr numeric(3, 2) not null check (dupr >= 1.0 and dupr <= 8.5),
  created_at timestamptz not null default now()
);

create index if not exists session_guests_session_id_idx
  on public.session_guests(session_id);

alter table public.session_guests enable row level security;

create policy session_guests_select_authenticated on public.session_guests
  for select
  using (auth.role() = 'authenticated');

create policy session_guests_insert_owner on public.session_guests
  for insert
  with check (
    session_id in (
      select id from public.game_sessions
      where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
    )
  );

create policy session_guests_update_owner on public.session_guests
  for update
  using (
    session_id in (
      select id from public.game_sessions
      where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
    )
  );

create policy session_guests_delete_owner on public.session_guests
  for delete
  using (
    session_id in (
      select id from public.game_sessions
      where created_by = auth.uid() or
        league_id in (select id from public.leagues where owner_id = auth.uid())
    )
  );

-- Relax match_players so a roster slot may reference either a real user
-- (user_id) or a guest (guest_id). Exactly one must be set.
alter table public.match_players
  drop constraint match_players_pkey;

alter table public.match_players
  add column if not exists id uuid primary key default gen_random_uuid();

alter table public.match_players
  alter column user_id drop not null;

alter table public.match_players
  add column if not exists guest_id uuid references public.session_guests(id) on delete cascade;

alter table public.match_players
  add constraint match_players_one_identity
    check ((user_id is null) <> (guest_id is null));

create unique index if not exists match_players_match_user_uq
  on public.match_players(match_id, user_id) where user_id is not null;

create unique index if not exists match_players_match_guest_uq
  on public.match_players(match_id, guest_id) where guest_id is not null;
