-- name: GetWatchStatuses :many
SELECT v.user_id,
       t.group_id,
       to_char(t.week_of, 'YYYY-MM-DD') AS week_of,
       v.watched
FROM verdicts v
JOIN turns t ON t.id = v.turn_id
WHERE t.group_id = sqlc.arg(group_id)
  AND t.week_of = sqlc.arg(week_of)::date;
