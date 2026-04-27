-- Phase 4: Drop the legacy tables that have been fully superseded by
-- `verdicts` (votes + watch_status) and `turns` (picker_assignments,
-- turn_overrides, turn_extensions). Reads/writes against these tables
-- have all been migrated to the canonical sources, so dropping them
-- removes the only remaining drift risk.

DROP TABLE IF EXISTS _deprecated_watch_status;
DROP TABLE IF EXISTS _deprecated_votes;
DROP TABLE IF EXISTS _deprecated_picker_assignments;
DROP TABLE IF EXISTS _deprecated_turn_overrides;
DROP TABLE IF EXISTS _deprecated_turn_extensions;
