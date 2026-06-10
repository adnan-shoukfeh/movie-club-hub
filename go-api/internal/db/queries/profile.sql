-- name: GetUserProfile :one
SELECT id, username, avatar_url, letterboxd_username, created_at
FROM users
WHERE id = $1;

-- name: UpdateLetterboxdUsername :one
UPDATE users
SET letterboxd_username = $2
WHERE id = $1
RETURNING id, username, avatar_url, letterboxd_username, created_at;

-- name: CheckSharedClubMembership :one
SELECT EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.group_id = m2.group_id
    WHERE m1.user_id = $1 AND m2.user_id = $2
) AS shared;

-- name: GetUserStats :one
SELECT
    COALESCE(AVG(rating)::numeric(3,2), 0) AS avg_rating,
    COUNT(*) FILTER (WHERE watched = true) AS total_watched,
    COUNT(*) FILTER (WHERE review IS NOT NULL AND review != '') AS total_reviews
FROM verdicts
WHERE user_id = $1;

-- name: GetUserTopGenres :many
SELECT f.genre, COUNT(*) AS cnt
FROM verdicts v
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE v.user_id = $1 AND v.watched = true AND f.genre IS NOT NULL
GROUP BY f.genre
ORDER BY cnt DESC
LIMIT 5;

-- name: GetUserRecentActivity :many
SELECT
    f.id AS film_id,
    f.title,
    f.year,
    f.poster_url,
    v.rating,
    v.review,
    v.updated_at AS watched_at
FROM verdicts v
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE v.user_id = $1 AND v.watched = true
ORDER BY v.updated_at DESC
LIMIT 10;

-- name: GetUserRecentActivityForViewer :many
-- Only returns activity from clubs shared between viewer and target user
SELECT
    f.id AS film_id,
    f.title,
    f.year,
    f.poster_url,
    v.rating,
    v.review,
    v.updated_at AS watched_at
FROM verdicts v
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE v.user_id = $1
  AND v.watched = true
  AND t.group_id IN (
      SELECT m1.group_id FROM memberships m1
      JOIN memberships m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = $1 AND m2.user_id = $2
  )
ORDER BY v.updated_at DESC
LIMIT 10;

-- name: GetUserRecentComments :many
-- The user's most recent replies (comments), with the film each one is about.
SELECT
    f.id AS film_id,
    f.title,
    f.year,
    f.poster_url,
    vr.body AS comment,
    vr.created_at AS commented_at
FROM verdict_replies vr
JOIN verdicts v ON v.id = vr.verdict_id
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE vr.user_id = $1
ORDER BY vr.created_at DESC
LIMIT 10;

-- name: GetUserRecentCommentsForViewer :many
-- Same as above but only from clubs shared between viewer and target user.
SELECT
    f.id AS film_id,
    f.title,
    f.year,
    f.poster_url,
    vr.body AS comment,
    vr.created_at AS commented_at
FROM verdict_replies vr
JOIN verdicts v ON v.id = vr.verdict_id
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE vr.user_id = $1
  AND t.group_id IN (
      SELECT m1.group_id FROM memberships m1
      JOIN memberships m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = $1 AND m2.user_id = $2
  )
ORDER BY vr.created_at DESC
LIMIT 10;
