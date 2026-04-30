-- Stickers: admin-uploaded images for reactions
-- group_id NULL = global sticker available to all groups
CREATE TABLE stickers (
    id          bigserial PRIMARY KEY,
    name        text NOT NULL,
    image_url   text NOT NULL,
    group_id    bigint REFERENCES groups(id) ON DELETE CASCADE,
    created_by  integer NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT stickers_name_group_unique UNIQUE (name, group_id)
);

CREATE INDEX stickers_group_idx ON stickers (group_id);

-- Reactions: polymorphic reactions on any entity type
-- entity_type allows extending to nominations, picks, etc.
CREATE TABLE reactions (
    id           bigserial PRIMARY KEY,
    entity_type  text NOT NULL,
    entity_id    bigint NOT NULL,
    user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sticker_id   bigint NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT reactions_unique UNIQUE (entity_type, entity_id, user_id, sticker_id)
);

CREATE INDEX reactions_entity_idx ON reactions (entity_type, entity_id);
CREATE INDEX reactions_user_idx ON reactions (user_id);
CREATE INDEX reactions_sticker_idx ON reactions (sticker_id);
