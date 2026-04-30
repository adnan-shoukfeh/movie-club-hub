-- name: CreateReaction :one
INSERT INTO reactions (entity_type, entity_id, user_id, sticker_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT ON CONSTRAINT reactions_unique DO NOTHING
RETURNING id, entity_type, entity_id, user_id, sticker_id, created_at;

-- name: DeleteReaction :exec
DELETE FROM reactions
WHERE id = $1;

-- name: DeleteReactionByUserAndSticker :execrows
DELETE FROM reactions
WHERE entity_type = $1 AND entity_id = $2 AND user_id = $3 AND sticker_id = $4;

-- name: GetReactionsForEntity :many
SELECT r.id, r.entity_type, r.entity_id, r.user_id, r.sticker_id, r.created_at,
       s.name AS sticker_name, s.image_url AS sticker_image_url,
       u.username
FROM reactions r
JOIN stickers s ON s.id = r.sticker_id
JOIN users u ON u.id = r.user_id
WHERE r.entity_type = $1 AND r.entity_id = $2
ORDER BY r.created_at;

-- name: GetReactionSummaryForEntity :many
SELECT r.sticker_id, s.name AS sticker_name, s.image_url AS sticker_image_url,
       COUNT(*) AS count
FROM reactions r
JOIN stickers s ON s.id = r.sticker_id
WHERE r.entity_type = $1 AND r.entity_id = $2
GROUP BY r.sticker_id, s.name, s.image_url
ORDER BY count DESC;

-- name: GetUserReactionsForEntity :many
SELECT r.id, r.sticker_id
FROM reactions r
WHERE r.entity_type = $1 AND r.entity_id = $2 AND r.user_id = $3;

-- name: DeleteReactionsForEntity :exec
DELETE FROM reactions
WHERE entity_type = $1 AND entity_id = $2;

-- name: GetReactionByID :one
SELECT id, entity_type, entity_id, user_id, sticker_id, created_at
FROM reactions
WHERE id = $1;
