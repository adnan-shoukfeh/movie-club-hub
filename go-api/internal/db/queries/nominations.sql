-- name: CreateNomination :one
INSERT INTO nominations (group_id, user_id, imdb_id, title, year, poster)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, group_id, user_id, imdb_id, title, year, poster, created_at;

-- name: GetNominationsByGroup :many
SELECT n.id, n.group_id, n.user_id, n.imdb_id, n.title, n.year, n.poster, n.created_at, u.username AS nominator_username
FROM nominations n
JOIN users u ON u.id = n.user_id
WHERE n.group_id = $1
ORDER BY n.created_at DESC;

-- name: GetNominationByID :one
SELECT id, group_id, user_id, imdb_id, title, year, poster, created_at
FROM nominations
WHERE id = $1;

-- name: GetNominationByGroupAndIMDB :one
SELECT n.id, n.group_id, n.user_id, n.imdb_id, n.title, n.year, n.poster, n.created_at, u.username AS nominator_username
FROM nominations n
JOIN users u ON u.id = n.user_id
WHERE n.group_id = $1 AND n.imdb_id = $2;

-- name: DeleteNomination :exec
DELETE FROM nominations WHERE id = $1;
