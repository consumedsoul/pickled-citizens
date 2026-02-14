-- Add performance indexes for frequently queried columns
-- Migration: 20260214000000_add_performance_indexes.sql

-- Index for league members by user (home page, profile queries)
-- Supports: SELECT * FROM league_members WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON public.league_members(user_id);

-- Index for match players by user (stats calculation)
-- Supports: SELECT * FROM match_players WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON public.match_players(user_id);

-- Composite index for session listing by league and date
-- Supports: SELECT * FROM game_sessions WHERE league_id = ? ORDER BY scheduled_for DESC
CREATE INDEX IF NOT EXISTS idx_game_sessions_league_scheduled ON public.game_sessions(league_id, scheduled_for DESC);

-- Index for matches by session (session detail page)
-- Supports: SELECT * FROM matches WHERE session_id = ?
CREATE INDEX IF NOT EXISTS idx_matches_session_id ON public.matches(session_id);

-- Index for match results lookups
-- Supports: SELECT * FROM match_results WHERE match_id = ?
-- Note: match_id is already the primary key, so this is redundant
-- CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON public.match_results(match_id);

-- Index for league invites by email (invite lookups)
-- Supports: SELECT * FROM league_invites WHERE email = ?
CREATE INDEX IF NOT EXISTS idx_league_invites_email ON public.league_invites(email);

-- Index for league invites by league (admin invite management)
-- Supports: SELECT * FROM league_invites WHERE league_id = ?
CREATE INDEX IF NOT EXISTS idx_league_invites_league_id ON public.league_invites(league_id);
