-- Add indexes for hot query paths (WHERE group_id = ? AND week_of = ?)
-- Some of these will become irrelevant after Phases 2-3 drop the source tables.

CREATE INDEX IF NOT EXISTS votes_group_week_idx        ON votes (group_id, week_of);
CREATE INDEX IF NOT EXISTS watch_status_group_week_idx ON watch_status (group_id, week_of);
CREATE INDEX IF NOT EXISTS movies_group_week_idx       ON movies (group_id, week_of);
CREATE INDEX IF NOT EXISTS nominations_group_idx       ON nominations (group_id);
CREATE INDEX IF NOT EXISTS memberships_group_idx       ON memberships (group_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx        ON memberships (user_id);
