-- Rollback: Recreate the deprecated tables (empty).
-- Data cannot be restored - use point-in-time recovery if needed.

CREATE TABLE IF NOT EXISTS _deprecated_picker_assignments (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    week_of text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT picker_group_week_unique UNIQUE (group_id, week_of)
);

CREATE TABLE IF NOT EXISTS _deprecated_turn_overrides (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    week_of date NOT NULL,
    review_unlocked_by_admin boolean NOT NULL DEFAULT false,
    movie_unlocked_by_admin boolean NOT NULL DEFAULT false,
    extended_days integer NOT NULL DEFAULT 0,
    start_offset_days integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT turn_overrides_group_week_unique UNIQUE (group_id, week_of)
);

CREATE TABLE IF NOT EXISTS _deprecated_turn_extensions (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    turn_index integer NOT NULL,
    extra_days integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT turn_extensions_group_turn_unique UNIQUE (group_id, turn_index)
);
