-- name: CreateNomination :one
INSERT INTO nominations (group_id, user_id, film_id)
VALUES ($1, $2, $3)
RETURNING id, group_id, user_id, film_id, created_at;

-- name: GetNominationsByGroup :many
SELECT n.id, n.group_id, n.user_id, n.film_id, n.created_at,
       f.imdb_id, f.title, f.year, f.poster_url,
       u.username AS nominator_username
FROM nominations n
JOIN films f ON f.id = n.film_id
JOIN users u ON u.id = n.user_id
WHERE n.group_id = $1
ORDER BY n.created_at DESC;

-- name: GetNominationByID :one
SELECT n.id, n.group_id, n.user_id, n.film_id, n.created_at,
       f.imdb_id, f.title, f.year, f.poster_url
FROM nominations n
JOIN films f ON f.id = n.film_id
WHERE n.id = $1;

-- name: GetNominationByGroupAndIMDB :one
SELECT n.id, n.group_id, n.user_id, n.film_id, n.created_at,
       f.imdb_id, f.title, f.year, f.poster_url,
       u.username AS nominator_username
FROM nominations n
JOIN films f ON f.id = n.film_id
JOIN users u ON u.id = n.user_id
WHERE n.group_id = $1 AND f.imdb_id = $2;

-- name: DeleteNomination :exec
DELETE FROM nominations WHERE id = $1;
