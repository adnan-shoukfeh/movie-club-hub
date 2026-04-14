-- Migration: Admin Panel Turn Overrides
-- Adds per-turn override flags for the admin panel feature:
-- review_unlocked_by_admin, movie_unlocked_by_admin, extended_days

-- 0. Safety: ensure turn_extensions.created_at exists (may be missing in some environments)
ALTER TABLE turn_extensions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS turn_overrides (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_of date NOT NULL,
  review_unlocked_by_admin boolean NOT NULL DEFAULT false,
  movie_unlocked_by_admin boolean NOT NULL DEFAULT false,
  extended_days integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT turn_overrides_group_week_unique UNIQUE (group_id, week_of)
);
