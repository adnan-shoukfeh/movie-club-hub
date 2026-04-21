-- name: UpsertVote :exec
INSERT INTO _deprecated_votes (user_id, group_id, rating, review, week_of)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT ON CONSTRAINT _deprecated_votes_user_group_week_unique
DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review, updated_at = now();

-- name: DeleteVote :exec
DELETE FROM _deprecated_votes WHERE user_id = $1 AND group_id = $2 AND week_of = $3;

-- name: GetUserVote :one
SELECT id, user_id, group_id, rating, review, week_of, created_at, updated_at
FROM _deprecated_votes
WHERE user_id = $1 AND group_id = $2 AND week_of = $3;

-- name: GetVotesForGroupWeek :many
SELECT v.id, v.user_id, u.username, v.rating, v.review, v.week_of, v.updated_at
FROM _deprecated_votes v
JOIN users u ON u.id = v.user_id
WHERE v.group_id = $1 AND v.week_of = $2
ORDER BY v.created_at;

-- name: HasUserVoted :one
SELECT EXISTS(
    SELECT 1 FROM _deprecated_votes WHERE user_id = $1 AND group_id = $2 AND week_of = $3
) AS has_voted;

-- name: GetVoteDistribution :many
SELECT ROUND(rating)::int AS rating, COUNT(*)::int AS count
FROM _deprecated_votes
WHERE group_id = $1 AND week_of = $2
GROUP BY ROUND(rating)
ORDER BY ROUND(rating);

-- name: GetAverageRating :one
SELECT COALESCE(AVG(rating), 0)::real AS average, COUNT(*)::int AS total
FROM _deprecated_votes
WHERE group_id = $1 AND week_of = $2;
