-- name: CreateSticker :one
INSERT INTO stickers (name, image_url, group_id, created_by)
VALUES ($1, $2, $3, $4)
RETURNING id, name, image_url, group_id, created_by, created_at;

-- name: GetStickerByID :one
SELECT id, name, image_url, group_id, created_by, created_at
FROM stickers
WHERE id = $1;

-- name: GetGlobalStickers :many
SELECT id, name, image_url, group_id, created_by, created_at
FROM stickers
WHERE group_id IS NULL
ORDER BY created_at;

-- name: GetGroupStickers :many
SELECT id, name, image_url, group_id, created_by, created_at
FROM stickers
WHERE group_id = $1
ORDER BY created_at;

-- name: GetStickersForGroup :many
SELECT id, name, image_url, group_id, created_by, created_at
FROM stickers
WHERE group_id IS NULL OR group_id = $1
ORDER BY group_id NULLS FIRST, created_at;

-- name: DeleteSticker :exec
DELETE FROM stickers
WHERE id = $1;

-- name: DeleteStickerIfOwned :execrows
DELETE FROM stickers
WHERE id = $1 AND (group_id IS NULL OR group_id = $2);

-- name: CountReactionsForSticker :one
SELECT COUNT(*) FROM reactions WHERE sticker_id = $1;
