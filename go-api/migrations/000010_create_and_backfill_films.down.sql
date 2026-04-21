-- Rollback: Drop films table.
DROP INDEX IF EXISTS films_title_idx;
DROP TABLE IF EXISTS films;
