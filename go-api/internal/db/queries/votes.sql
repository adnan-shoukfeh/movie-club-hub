-- Vote queries are thin views over the canonical verdicts table.
-- A "vote" is a verdict with a non-null rating; the deprecated votes
-- table no longer exists.

-- name: UpsertVote :exec
INSERT INTO verdicts (turn_id, user_id, watched, rating, review)
SELECT t.id,
       sqlc.arg(user_id)::int,
       true,
       sqlc.arg(rating)::numeric,
       sqlc.narg(review)
FROM turns t
WHERE t.group_id = sqlc.arg(group_id) AND t.week_of = sqlc.arg(week_of)::date
ON CONFLICT ON CONSTRAINT verdicts_turn_user_unique
DO UPDATE SET rating = EXCLUDED.rating,
              review = EXCLUDED.review,
              watched = true,
              updated_at = now();

-- name: DeleteVote :exec
UPDATE verdicts
SET rating = NULL, review = NULL, updated_at = now()
WHERE user_id = sqlc.arg(user_id)
  AND turn_id = (
    SELECT id FROM turns
    WHERE group_id = sqlc.arg(group_id) AND week_of = sqlc.arg(week_of)::date
  );

-- name: GetUserVote :one
SELECT v.rating::real AS rating, v.review
FROM verdicts v
JOIN turns t ON t.id = v.turn_id
WHERE v.user_id = sqlc.arg(user_id)
  AND t.group_id = sqlc.arg(group_id)
  AND t.week_of = sqlc.arg(week_of)::date
  AND v.rating IS NOT NULL;

-- name: GetVotesForGroupWeek :many
SELECT v.user_id,
       u.username,
       v.rating::real AS rating,
       v.review,
       to_char(t.week_of, 'YYYY-MM-DD') AS week_of,
       v.updated_at
FROM verdicts v
JOIN turns t ON t.id = v.turn_id
JOIN users u ON u.id = v.user_id
WHERE t.group_id = sqlc.arg(group_id)
  AND t.week_of = sqlc.arg(week_of)::date
  AND v.rating IS NOT NULL
ORDER BY v.created_at;

-- name: HasUserVoted :one
SELECT EXISTS(
    SELECT 1 FROM verdicts v
    JOIN turns t ON t.id = v.turn_id
    WHERE v.user_id = sqlc.arg(user_id)
      AND t.group_id = sqlc.arg(group_id)
      AND t.week_of = sqlc.arg(week_of)::date
      AND v.rating IS NOT NULL
) AS has_voted;
