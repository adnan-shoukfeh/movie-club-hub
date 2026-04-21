-- Rollback: Restore original table names.

ALTER TABLE _deprecated_votes        RENAME TO votes;
ALTER TABLE _deprecated_watch_status RENAME TO watch_status;
