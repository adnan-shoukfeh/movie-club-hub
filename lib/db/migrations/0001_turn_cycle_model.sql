-- Migration: Turn & Cycle Model Foundation
-- Adds group turn configuration, nominations pool, vote updatedAt, and movie nominator attribution.

-- 1. Group turn configuration
ALTER TABLE groups ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS turn_length_days integer NOT NULL DEFAULT 7;

-- Backfill: existing groups use their created_at date as the start_date, 7-day turns as the default.
UPDATE groups SET start_date = created_at::date WHERE start_date = CURRENT_DATE;

-- 2. Turn extensions table — stores per-turn deadline overrides set by admins
CREATE TABLE IF NOT EXISTS turn_extensions (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES groups(id),
  turn_index integer NOT NULL,
  extra_days integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT turn_extensions_group_turn_unique UNIQUE (group_id, turn_index)
);

-- 3. Vote updatedAt — track when a vote was last modified
ALTER TABLE votes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- 4. Movie nominator attribution — nullable FK to the user who nominated this film
ALTER TABLE movies ADD COLUMN IF NOT EXISTS nominator_user_id integer REFERENCES users(id);

-- 5. Nominations pool table — group members propose films before the picker chooses
CREATE TABLE IF NOT EXISTS nominations (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES groups(id),
  user_id integer NOT NULL REFERENCES users(id),
  imdb_id text NOT NULL,
  title text NOT NULL,
  poster text,
  year text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nominations_group_imdb_unique UNIQUE (group_id, imdb_id)
);
