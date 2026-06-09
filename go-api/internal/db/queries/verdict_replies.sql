-- name: CreateVerdictReply :one
INSERT INTO verdict_replies (verdict_id, user_id, body)
VALUES ($1, $2, $3)
RETURNING id, verdict_id, user_id, body, created_at, updated_at;

-- name: GetRepliesForVerdicts :many
SELECT vr.id, vr.verdict_id, vr.user_id, vr.body, vr.created_at, vr.updated_at,
       u.username, u.avatar_url
FROM verdict_replies vr
JOIN users u ON u.id = vr.user_id
WHERE vr.verdict_id = ANY($1::bigint[])
ORDER BY vr.created_at;
