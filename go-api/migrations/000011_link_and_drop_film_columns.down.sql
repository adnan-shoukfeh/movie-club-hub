-- Rollback: Restore inline OMDb columns to movies and nominations.

-- Drop indexes and constraints
DROP INDEX IF EXISTS nominations_film_idx;
DROP INDEX IF EXISTS movies_film_idx;
ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_turn_unique;

-- Restore movies columns
ALTER TABLE movies
    ADD COLUMN week_of text,
    ADD COLUMN set_by_user_id integer REFERENCES users(id),
    ADD COLUMN imdb_id text,
    ADD COLUMN title text,
    ADD COLUMN poster text,
    ADD COLUMN director text,
    ADD COLUMN genre text,
    ADD COLUMN runtime text,
    ADD COLUMN year text;

-- Restore nominations columns
ALTER TABLE nominations
    ADD COLUMN imdb_id text,
    ADD COLUMN title text,
    ADD COLUMN year text,
    ADD COLUMN poster text;

-- Populate movies columns from films and turns
UPDATE movies m SET
    week_of = t.week_of::text,
    set_by_user_id = t.picker_user_id,
    imdb_id = f.imdb_id,
    title = f.title,
    poster = f.poster_url,
    director = f.director,
    genre = f.genre,
    runtime = CASE WHEN f.runtime_minutes IS NOT NULL THEN f.runtime_minutes::text || ' min' ELSE NULL END,
    year = f.year::text
FROM films f, turns t
WHERE m.film_id = f.id AND m.turn_id = t.id;

-- Populate nominations columns from films
UPDATE nominations n SET
    imdb_id = f.imdb_id,
    title = f.title,
    year = f.year::text,
    poster = f.poster_url
FROM films f
WHERE n.film_id = f.id;

-- Make required columns NOT NULL and restore constraints
ALTER TABLE movies ALTER COLUMN title SET NOT NULL;
ALTER TABLE movies ALTER COLUMN week_of SET NOT NULL;
ALTER TABLE nominations ALTER COLUMN imdb_id SET NOT NULL;
ALTER TABLE nominations ALTER COLUMN title SET NOT NULL;

-- Drop the FK columns
ALTER TABLE movies DROP COLUMN film_id;
ALTER TABLE movies DROP COLUMN turn_id;
ALTER TABLE nominations DROP COLUMN film_id;

-- Restore unique constraint that depends on week_of
-- (Already exists from original schema as movies_group_week_unique)
