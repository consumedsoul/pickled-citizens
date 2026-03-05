-- Add position column to match_players table
ALTER TABLE public.match_players ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0;
