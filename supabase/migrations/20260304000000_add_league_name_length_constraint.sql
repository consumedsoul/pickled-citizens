-- Add length constraint to leagues.name
ALTER TABLE public.leagues
ADD CONSTRAINT league_name_length
CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255);
