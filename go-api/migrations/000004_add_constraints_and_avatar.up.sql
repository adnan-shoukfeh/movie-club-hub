-- Add CHECK constraints for domain integrity and avatar column for future profiles.
-- Verify no existing rows violate constraints before running in production.

ALTER TABLE memberships ADD CONSTRAINT memberships_role_valid
    CHECK (role IN ('member', 'admin', 'owner'));

ALTER TABLE votes ADD CONSTRAINT votes_rating_range
    CHECK (rating >= 0 AND rating <= 10);

ALTER TABLE groups ADD CONSTRAINT groups_turn_length_positive
    CHECK (turn_length_days > 0);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
