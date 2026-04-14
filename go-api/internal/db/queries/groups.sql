-- name: CreateGroup :one
INSERT INTO groups (name, owner_id, start_date, turn_length_days)
VALUES ($1, $2, $3, $4)
RETURNING id, name, owner_id, created_at, start_date, turn_length_days;

-- name: GetGroupByID :one
SELECT id, name, owner_id, created_at, start_date, turn_length_days
FROM groups
WHERE id = $1;

-- name: UpdateGroupSettings :one
UPDATE groups
SET start_date = COALESCE($2, start_date),
    turn_length_days = COALESCE($3, turn_length_days)
WHERE id = $1
RETURNING id, name, owner_id, created_at, start_date, turn_length_days;

-- name: CreateMembership :one
INSERT INTO memberships (user_id, group_id, role)
VALUES ($1, $2, $3)
RETURNING id, user_id, group_id, role, joined_at;

-- name: GetMembership :one
SELECT id, user_id, group_id, role, joined_at
FROM memberships
WHERE user_id = $1 AND group_id = $2;

-- name: GetGroupMembers :many
SELECT m.id, m.user_id, m.group_id, m.role, m.joined_at, u.username
FROM memberships m
JOIN users u ON u.id = m.user_id
WHERE m.group_id = $1
ORDER BY m.joined_at;

-- name: GetUserGroups :many
SELECT g.id, g.name, g.owner_id, g.created_at, g.start_date, g.turn_length_days,
       m.role,
       (SELECT COUNT(*) FROM memberships WHERE group_id = g.id) AS member_count
FROM groups g
JOIN memberships m ON m.group_id = g.id
WHERE m.user_id = $1
ORDER BY g.created_at DESC;

-- name: UpdateMemberRole :exec
UPDATE memberships SET role = $3 WHERE user_id = $1 AND group_id = $2;

-- name: DeleteMembership :exec
DELETE FROM memberships WHERE user_id = $1 AND group_id = $2;

-- name: GetGroupMemberCount :one
SELECT COUNT(*) AS count FROM memberships WHERE group_id = $1;

-- name: UpdateGroupOwner :exec
UPDATE groups SET owner_id = $2 WHERE id = $1;
