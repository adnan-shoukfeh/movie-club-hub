-- Phase 2.3: Drop deprecated turn tables.
-- Only run this migration after production verification confirms turns table works.

DROP TABLE IF EXISTS _deprecated_picker_assignments;
DROP TABLE IF EXISTS _deprecated_turn_overrides;
DROP TABLE IF EXISTS _deprecated_turn_extensions;
