-- name: UpsertMovie :one
INSERT INTO movies (group_id, title, week_of, set_by_user_id, nominator_user_id, imdb_id, poster, director, genre, runtime, year)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT ON CONSTRAINT movies_group_week_unique
DO UPDATE SET title = EXCLUDED.title,
             set_by_user_id = EXCLUDED.set_by_user_id,
             nominator_user_id = EXCLUDED.nominator_user_id,
             imdb_id = EXCLUDED.imdb_id,
             poster = EXCLUDED.poster,
             director = EXCLUDED.director,
             genre = EXCLUDED.genre,
             runtime = EXCLUDED.runtime,
             year = EXCLUDED.year
RETURNING id, group_id, title, week_of, set_by_user_id, nominator_user_id, imdb_id, poster, director, genre, runtime, year, created_at;

-- name: GetMovieByGroupWeek :one
SELECT id, group_id, title, week_of, set_by_user_id, nominator_user_id, imdb_id, poster, director, genre, runtime, year, created_at
FROM movies
WHERE group_id = $1 AND week_of = $2;

-- name: DeleteMovieByGroupWeek :execrows
DELETE FROM movies WHERE group_id = $1 AND week_of = $2;

-- name: GetRecentMoviesWithResults :many
SELECT m.group_id, g.name AS group_name, m.title AS movie, m.week_of,
       COALESCE(AVG(v.rating), 0)::real AS average_rating,
       COUNT(v.id)::int AS total_votes
FROM movies m
JOIN groups g ON g.id = m.group_id
JOIN memberships mem ON mem.group_id = m.group_id AND mem.user_id = $1
LEFT JOIN votes v ON v.group_id = m.group_id AND v.week_of = m.week_of
GROUP BY m.id, g.name
ORDER BY m.week_of DESC
LIMIT $2;
