-- Rollback: Drop verdicts table
-- Legacy tables (votes, watch_status) still exist at this point.

DROP INDEX IF EXISTS verdicts_turn_idx;
DROP INDEX IF EXISTS verdicts_user_idx;
DROP TABLE IF EXISTS verdicts;
