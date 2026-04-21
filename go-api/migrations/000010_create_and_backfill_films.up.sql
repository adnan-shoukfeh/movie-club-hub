-- Phase 4.1: Create canonical films table and backfill from movies + nominations.

CREATE TABLE films (
    id              bigserial PRIMARY KEY,
    imdb_id         text NOT NULL UNIQUE,
    title           text NOT NULL,
    year            integer,
    poster_url      text,
    director        text,
    genre           text,
    runtime_minutes integer,
    omdb_fetched_at timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Backfill from movies (higher confidence; picked films have been verified)
INSERT INTO films (imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at)
SELECT DISTINCT ON (imdb_id)
    imdb_id,
    title,
    NULLIF(year, '')::integer,
    poster,
    director,
    genre,
    NULLIF(regexp_replace(COALESCE(runtime, ''), '[^0-9]', '', 'g'), '')::integer,
    created_at,
    created_at
FROM movies
WHERE imdb_id IS NOT NULL AND imdb_id <> ''
ORDER BY imdb_id, created_at DESC
ON CONFLICT (imdb_id) DO NOTHING;

-- Also backfill films from nominations that aren't already present
INSERT INTO films (imdb_id, title, year, poster_url, omdb_fetched_at, created_at)
SELECT DISTINCT ON (imdb_id)
    imdb_id,
    title,
    NULLIF(year, '')::integer,
    poster,
    created_at,
    created_at
FROM nominations
WHERE imdb_id IS NOT NULL AND imdb_id <> ''
ORDER BY imdb_id, created_at DESC
ON CONFLICT (imdb_id) DO NOTHING;

-- Invariant checks
DO $$
DECLARE
    movies_count integer;
    films_count integer;
    orphan_count integer;
BEGIN
    -- Check that we captured all unique imdb_ids from movies
    SELECT COUNT(DISTINCT imdb_id) INTO movies_count
    FROM movies WHERE imdb_id IS NOT NULL AND imdb_id <> '';

    SELECT COUNT(*) INTO films_count FROM films;

    IF films_count < movies_count THEN
        RAISE EXCEPTION 'Films count (%) is less than distinct movie imdb_ids (%)', films_count, movies_count;
    END IF;

    -- Check no movies have imdb_id not in films
    SELECT COUNT(*) INTO orphan_count
    FROM movies m
    WHERE m.imdb_id IS NOT NULL AND m.imdb_id <> ''
      AND NOT EXISTS (SELECT 1 FROM films f WHERE f.imdb_id = m.imdb_id);

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Found % movies with imdb_id not in films table', orphan_count;
    END IF;
END $$;

CREATE INDEX films_title_idx ON films (title);
