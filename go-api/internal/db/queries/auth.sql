-- name: GetUserByID :one
SELECT id, username, password_hash, created_at
FROM users
WHERE id = $1;

-- name: GetUserByUsername :one
SELECT id, username, password_hash, created_at
FROM users
WHERE username = $1;

-- name: CreateUser :one
INSERT INTO users (username, password_hash)
VALUES ($1, $2)
RETURNING id, username, created_at;

-- name: UpdateUserPasswordHash :exec
UPDATE users SET password_hash = $2 WHERE username = $1;

-- name: UpdateUsername :exec
UPDATE users SET username = $1 WHERE id = $2;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1 WHERE id = $2;
