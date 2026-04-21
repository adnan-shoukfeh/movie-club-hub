-- Rollback: Restore original table names.

ALTER TABLE _deprecated_picker_assignments RENAME TO picker_assignments;
ALTER TABLE _deprecated_turn_overrides     RENAME TO turn_overrides;
ALTER TABLE _deprecated_turn_extensions    RENAME TO turn_extensions;
