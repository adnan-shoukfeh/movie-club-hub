-- Migration: Ensure nominations table uses created_at (not nominated_at)
-- This is a safety migration for environments where the nominations table
-- was originally created with a nominated_at column before 0001 was finalized.
-- In environments where 0001 already created the column as created_at, this is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nominations' AND column_name = 'nominated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nominations' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE nominations RENAME COLUMN nominated_at TO created_at;
  END IF;
END $$;
