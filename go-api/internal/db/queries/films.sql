-- name: UpsertFilm :one
INSERT INTO films (imdb_id, title, year, poster_url, director, genre, runtime_minutes)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (imdb_id)
DO UPDATE SET
    title = EXCLUDED.title,
    year = EXCLUDED.year,
    poster_url = EXCLUDED.poster_url,
    director = EXCLUDED.director,
    genre = EXCLUDED.genre,
    runtime_minutes = EXCLUDED.runtime_minutes,
    omdb_fetched_at = now()
RETURNING id, imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at;

-- name: GetFilmByIMDbID :one
SELECT id, imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at
FROM films
WHERE imdb_id = $1;

-- name: GetFilmByID :one
SELECT id, imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at
FROM films
WHERE id = $1;

-- name: SearchFilmsByTitle :many
SELECT id, imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at
FROM films
WHERE title ILIKE '%' || $1 || '%'
ORDER BY title
LIMIT $2;
