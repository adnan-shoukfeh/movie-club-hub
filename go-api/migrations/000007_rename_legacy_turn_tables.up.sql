-- Phase 2.2: Rename legacy turn tables to deprecated.
-- These tables are kept temporarily for rollback safety.
-- Drop them in migration 000008 after production verification.

ALTER TABLE picker_assignments RENAME TO _deprecated_picker_assignments;
ALTER TABLE turn_overrides     RENAME TO _deprecated_turn_overrides;
ALTER TABLE turn_extensions    RENAME TO _deprecated_turn_extensions;
