-- Consolidated initial schema for Movie Club Hub.
-- Combines all Drizzle schema definitions + migrations 0001-0004.

CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password_hash text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
    id serial PRIMARY KEY,
    name text NOT NULL,
    owner_id integer NOT NULL REFERENCES users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    turn_length_days integer NOT NULL DEFAULT 7
);

CREATE TABLE IF NOT EXISTS memberships (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    group_id integer NOT NULL REFERENCES groups(id),
    role text NOT NULL DEFAULT 'member',
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT memberships_user_group_unique UNIQUE (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS movies (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id),
    title text NOT NULL,
    week_of text NOT NULL,
    set_by_user_id integer REFERENCES users(id),
    nominator_user_id integer REFERENCES users(id),
    imdb_id text,
    poster text,
    director text,
    genre text,
    runtime text,
    year text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT movies_group_week_unique UNIQUE (group_id, week_of)
);

CREATE TABLE IF NOT EXISTS votes (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    group_id integer NOT NULL REFERENCES groups(id),
    rating real NOT NULL,
    review text,
    week_of text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT votes_user_group_week_unique UNIQUE (user_id, group_id, week_of)
);

CREATE TABLE IF NOT EXISTS picker_assignments (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id),
    user_id integer NOT NULL REFERENCES users(id),
    week_of text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT picker_group_week_unique UNIQUE (group_id, week_of)
);

CREATE TABLE IF NOT EXISTS nominations (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id),
    user_id integer NOT NULL REFERENCES users(id),
    imdb_id text NOT NULL,
    title text NOT NULL,
    year text,
    poster text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT nominations_group_imdb_unique UNIQUE (group_id, imdb_id)
);

CREATE TABLE IF NOT EXISTS invites (
    id serial PRIMARY KEY,
    code text NOT NULL UNIQUE,
    group_id integer NOT NULL REFERENCES groups(id),
    created_by_user_id integer NOT NULL REFERENCES users(id),
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watch_status (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    group_id integer NOT NULL REFERENCES groups(id),
    week_of text NOT NULL,
    watched boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT watch_status_user_group_week UNIQUE (user_id, group_id, week_of)
);

CREATE TABLE IF NOT EXISTS turn_extensions (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id),
    turn_index integer NOT NULL,
    extra_days integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT turn_extensions_group_turn_unique UNIQUE (group_id, turn_index)
);

CREATE TABLE IF NOT EXISTS turn_overrides (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    week_of date NOT NULL,
    review_unlocked_by_admin boolean NOT NULL DEFAULT false,
    movie_unlocked_by_admin boolean NOT NULL DEFAULT false,
    extended_days integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT turn_overrides_group_week_unique UNIQUE (group_id, week_of)
);

-- SCS session store (alexedwards/scs pgxstore)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    data BYTEA NOT NULL,
    expiry TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expiry);
