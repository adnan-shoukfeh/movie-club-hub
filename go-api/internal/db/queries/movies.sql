-- name: UpsertMovie :one
INSERT INTO movies (group_id, turn_id, film_id, nominator_user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT ON CONSTRAINT movies_turn_unique
DO UPDATE SET film_id = EXCLUDED.film_id,
              nominator_user_id = EXCLUDED.nominator_user_id
RETURNING id, group_id, turn_id, film_id, nominator_user_id, created_at;

-- name: GetMovieByGroupWeek :one
SELECT m.id, m.group_id, m.turn_id, m.film_id, m.nominator_user_id, m.created_at,
       t.week_of, t.picker_user_id AS set_by_user_id,
       f.imdb_id, f.title, f.poster_url, f.director, f.genre, f.runtime_minutes, f.year
FROM movies m
JOIN turns t ON t.id = m.turn_id
JOIN films f ON f.id = m.film_id
WHERE m.group_id = $1 AND t.week_of = $2;

-- name: DeleteMovieByGroupWeek :execrows
DELETE FROM movies m
USING turns t
WHERE m.turn_id = t.id AND m.group_id = $1 AND t.week_of = $2;

-- name: GetRecentMoviesWithResults :many
SELECT m.group_id, g.name AS group_name, f.title AS movie, t.week_of,
       COALESCE(AVG(v.rating), 0)::real AS average_rating,
       COUNT(v.id)::int AS total_votes
FROM movies m
JOIN groups g ON g.id = m.group_id
JOIN turns t ON t.id = m.turn_id
JOIN films f ON f.id = m.film_id
JOIN memberships mem ON mem.group_id = m.group_id AND mem.user_id = $1
LEFT JOIN _deprecated_votes v ON v.group_id = m.group_id AND v.week_of = t.week_of::text
GROUP BY m.id, g.name, f.title, t.week_of
ORDER BY t.week_of DESC
LIMIT $2;
