ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_turn_length_positive;

ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_rating_range;

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_valid;
