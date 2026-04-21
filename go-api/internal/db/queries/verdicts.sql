-- name: GetVerdict :one
SELECT id, turn_id, user_id, watched, rating, review, created_at, updated_at
FROM verdicts
WHERE turn_id = $1 AND user_id = $2;

-- name: GetVerdictByID :one
SELECT id, turn_id, user_id, watched, rating, review, created_at, updated_at
FROM verdicts
WHERE id = $1;

-- name: GetVerdictsForTurn :many
SELECT v.id, v.turn_id, v.user_id, v.watched, v.rating, v.review, v.created_at, v.updated_at,
       u.username
FROM verdicts v
JOIN users u ON u.id = v.user_id
WHERE v.turn_id = $1
ORDER BY v.created_at;

-- name: GetVerdictsForUser :many
SELECT v.id, v.turn_id, v.user_id, v.watched, v.rating, v.review, v.created_at, v.updated_at
FROM verdicts v
WHERE v.user_id = $1
ORDER BY v.created_at DESC;

-- name: UpsertVerdict :one
INSERT INTO verdicts (turn_id, user_id, watched, rating, review)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT ON CONSTRAINT verdicts_turn_user_unique
DO UPDATE SET
    watched = EXCLUDED.watched,
    rating = EXCLUDED.rating,
    review = EXCLUDED.review,
    updated_at = now()
RETURNING id, turn_id, user_id, watched, rating, review, created_at, updated_at;

-- name: UpdateVerdictWatched :exec
UPDATE verdicts
SET watched = $2, updated_at = now()
WHERE turn_id = $1 AND user_id = sqlc.arg(user_id);

-- name: UpdateVerdictRating :exec
UPDATE verdicts
SET rating = $2, review = $3, updated_at = now()
WHERE turn_id = $1 AND user_id = sqlc.arg(user_id);

-- name: DeleteVerdict :exec
DELETE FROM verdicts
WHERE turn_id = $1 AND user_id = $2;

-- name: ClearVerdictRating :exec
UPDATE verdicts
SET rating = NULL, review = NULL, updated_at = now()
WHERE turn_id = $1 AND user_id = $2;
