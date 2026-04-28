-- name: CreateInvite :one
INSERT INTO invites (code, group_id, created_by_user_id, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, code, group_id, created_by_user_id, expires_at, created_at;

-- name: GetInviteByCode :one
SELECT i.id, i.code, i.group_id, i.expires_at, i.created_at, g.name AS group_name
FROM invites i
JOIN groups g ON g.id = i.group_id
WHERE i.code = $1;

-- name: GetActiveInviteByGroupID :one
SELECT id, code, group_id, created_by_user_id, expires_at, created_at
FROM invites
WHERE group_id = $1
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT 1;

-- name: DeleteInvitesByGroupID :exec
DELETE FROM invites WHERE group_id = $1;
