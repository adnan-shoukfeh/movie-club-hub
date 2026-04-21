-- Phase 3.2: Rename legacy verdict tables to deprecated.
-- These tables are kept temporarily for rollback safety.

ALTER TABLE votes        RENAME TO _deprecated_votes;
ALTER TABLE watch_status RENAME TO _deprecated_watch_status;
