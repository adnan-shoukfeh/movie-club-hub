-- name: UpsertWatchStatus :exec
INSERT INTO _deprecated_watch_status (user_id, group_id, week_of, watched)
VALUES ($1, $2, $3, $4)
ON CONFLICT ON CONSTRAINT _deprecated_watch_status_user_group_week
DO UPDATE SET watched = EXCLUDED.watched, updated_at = now();

-- name: GetWatchStatuses :many
SELECT user_id, group_id, week_of, watched
FROM _deprecated_watch_status
WHERE group_id = $1 AND week_of = $2;
