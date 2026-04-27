-- Down migration intentionally re-creates empty legacy tables so prior
-- migrations remain re-applicable in isolation. The data they once held has
-- already been promoted into the canonical `verdicts` and `turns` tables.

CREATE TABLE IF NOT EXISTS _deprecated_watch_status (
    id          serial PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id    integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    week_of     text    NOT NULL,
    watched     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT _deprecated_watch_status_user_group_week UNIQUE (user_id, group_id, week_of)
);

CREATE TABLE IF NOT EXISTS _deprecated_votes (
    id          serial PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id    integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    rating      real    NOT NULL,
    review      text,
    week_of     text    NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT _deprecated_votes_user_group_week_unique UNIQUE (user_id, group_id, week_of)
);

CREATE TABLE IF NOT EXISTS _deprecated_picker_assignments (
    id        serial  PRIMARY KEY,
    group_id  integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_of   text    NOT NULL,
    CONSTRAINT picker_group_week_unique UNIQUE (group_id, week_of)
);

CREATE TABLE IF NOT EXISTS _deprecated_turn_extensions (
    id          serial  PRIMARY KEY,
    group_id    integer NOT NULL REFERENCES groups(id),
    turn_index  integer NOT NULL,
    extra_days  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT turn_extensions_group_turn_unique UNIQUE (group_id, turn_index)
);

CREATE TABLE IF NOT EXISTS _deprecated_turn_overrides (
    id                       serial  PRIMARY KEY,
    group_id                 integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    week_of                  date    NOT NULL,
    review_unlocked_by_admin boolean NOT NULL DEFAULT false,
    movie_unlocked_by_admin  boolean NOT NULL DEFAULT false,
    extended_days            integer NOT NULL DEFAULT 0,
    start_offset_days        integer NOT NULL DEFAULT 0,
    updated_at               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT turn_overrides_group_week_unique UNIQUE (group_id, week_of)
);
