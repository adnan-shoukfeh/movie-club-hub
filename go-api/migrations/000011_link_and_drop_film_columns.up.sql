-- Phase 4.2: Link movies and nominations to films; drop redundant columns.

-- Add FK columns
ALTER TABLE movies ADD COLUMN film_id bigint REFERENCES films(id) ON DELETE RESTRICT;
ALTER TABLE movies ADD COLUMN turn_id bigint REFERENCES turns(id) ON DELETE CASCADE;
ALTER TABLE nominations ADD COLUMN film_id bigint REFERENCES films(id) ON DELETE RESTRICT;

-- Populate FKs
UPDATE movies m SET film_id = f.id FROM films f WHERE m.imdb_id = f.imdb_id;
UPDATE movies m SET turn_id = t.id FROM turns t WHERE m.group_id = t.group_id AND m.week_of = t.week_of::text;
UPDATE nominations n SET film_id = f.id FROM films f WHERE n.imdb_id = f.imdb_id;

-- Invariant checks before dropping columns
DO $$
DECLARE
    null_film_count integer;
    null_turn_count integer;
    nom_null_film_count integer;
BEGIN
    -- Check all movies with imdb_id have film_id set
    SELECT COUNT(*) INTO null_film_count
    FROM movies WHERE imdb_id IS NOT NULL AND imdb_id <> '' AND film_id IS NULL;

    IF null_film_count > 0 THEN
        RAISE EXCEPTION 'Found % movies with imdb_id but no film_id', null_film_count;
    END IF;

    -- Check all movies have turn_id set
    SELECT COUNT(*) INTO null_turn_count FROM movies WHERE turn_id IS NULL;

    IF null_turn_count > 0 THEN
        RAISE EXCEPTION 'Found % movies with no turn_id', null_turn_count;
    END IF;

    -- Check all nominations with imdb_id have film_id set
    SELECT COUNT(*) INTO nom_null_film_count
    FROM nominations WHERE imdb_id IS NOT NULL AND imdb_id <> '' AND film_id IS NULL;

    IF nom_null_film_count > 0 THEN
        RAISE EXCEPTION 'Found % nominations with imdb_id but no film_id', nom_null_film_count;
    END IF;
END $$;

-- Enforce NOT NULL on the FK columns
ALTER TABLE movies ALTER COLUMN film_id SET NOT NULL;
ALTER TABLE movies ALTER COLUMN turn_id SET NOT NULL;
ALTER TABLE nominations ALTER COLUMN film_id SET NOT NULL;

-- Drop redundant columns from movies
ALTER TABLE movies
    DROP COLUMN week_of,
    DROP COLUMN set_by_user_id,
    DROP COLUMN imdb_id,
    DROP COLUMN title,
    DROP COLUMN poster,
    DROP COLUMN director,
    DROP COLUMN genre,
    DROP COLUMN runtime,
    DROP COLUMN year;

-- Drop redundant columns from nominations
ALTER TABLE nominations
    DROP COLUMN imdb_id,
    DROP COLUMN title,
    DROP COLUMN year,
    DROP COLUMN poster;

-- Add unique constraint: one movie per turn
ALTER TABLE movies ADD CONSTRAINT movies_turn_unique UNIQUE (turn_id);

-- Add indexes for the new FK columns
CREATE INDEX movies_film_idx ON movies (film_id);
CREATE INDEX nominations_film_idx ON nominations (film_id);
