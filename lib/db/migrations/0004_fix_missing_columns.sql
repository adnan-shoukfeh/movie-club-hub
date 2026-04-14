-- Migration: Fix missing columns from prior schema additions
-- Adds nominator_user_id to movies (was in schema but not in DB)
-- Adds updated_at to votes (was in schema but not in DB)
-- Makes nominations.week_of nullable if it exists (column may or may not be present)

ALTER TABLE movies ADD COLUMN IF NOT EXISTS nominator_user_id integer REFERENCES users(id);

ALTER TABLE votes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nominations' AND column_name = 'week_of'
  ) THEN
    ALTER TABLE nominations ALTER COLUMN week_of DROP NOT NULL;
  END IF;
END $$;
