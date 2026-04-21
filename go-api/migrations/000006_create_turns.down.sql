-- Rollback: Drop turns table
-- Legacy tables (picker_assignments, turn_overrides, turn_extensions) still exist at this point.

DROP INDEX IF EXISTS turns_group_week_idx;
DROP TABLE IF EXISTS turns;
