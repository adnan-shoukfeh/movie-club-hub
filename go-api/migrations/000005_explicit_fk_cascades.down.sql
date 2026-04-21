-- Restore FKs to their original state (implicit NO ACTION, except turn_overrides).

-- ─── groups ──────────────────────────────────────────────────────────────────
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_owner_id_fkey;
ALTER TABLE groups ADD CONSTRAINT groups_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id);

-- ─── memberships ─────────────────────────────────────────────────────────────
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;
ALTER TABLE memberships ADD CONSTRAINT memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_group_id_fkey;
ALTER TABLE memberships ADD CONSTRAINT memberships_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

-- ─── movies ──────────────────────────────────────────────────────────────────
ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_group_id_fkey;
ALTER TABLE movies ADD CONSTRAINT movies_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_set_by_user_id_fkey;
ALTER TABLE movies ADD CONSTRAINT movies_set_by_user_id_fkey
    FOREIGN KEY (set_by_user_id) REFERENCES users(id);

ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_nominator_user_id_fkey;
ALTER TABLE movies ADD CONSTRAINT movies_nominator_user_id_fkey
    FOREIGN KEY (nominator_user_id) REFERENCES users(id);

-- ─── votes ───────────────────────────────────────────────────────────────────
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_user_id_fkey;
ALTER TABLE votes ADD CONSTRAINT votes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_group_id_fkey;
ALTER TABLE votes ADD CONSTRAINT votes_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

-- ─── picker_assignments ──────────────────────────────────────────────────────
ALTER TABLE picker_assignments DROP CONSTRAINT IF EXISTS picker_assignments_group_id_fkey;
ALTER TABLE picker_assignments ADD CONSTRAINT picker_assignments_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

ALTER TABLE picker_assignments DROP CONSTRAINT IF EXISTS picker_assignments_user_id_fkey;
ALTER TABLE picker_assignments ADD CONSTRAINT picker_assignments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

-- ─── nominations ─────────────────────────────────────────────────────────────
ALTER TABLE nominations DROP CONSTRAINT IF EXISTS nominations_group_id_fkey;
ALTER TABLE nominations ADD CONSTRAINT nominations_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

ALTER TABLE nominations DROP CONSTRAINT IF EXISTS nominations_user_id_fkey;
ALTER TABLE nominations ADD CONSTRAINT nominations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

-- ─── invites ─────────────────────────────────────────────────────────────────
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_group_id_fkey;
ALTER TABLE invites ADD CONSTRAINT invites_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_created_by_user_id_fkey;
ALTER TABLE invites ADD CONSTRAINT invites_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES users(id);

-- ─── watch_status ────────────────────────────────────────────────────────────
ALTER TABLE watch_status DROP CONSTRAINT IF EXISTS watch_status_user_id_fkey;
ALTER TABLE watch_status ADD CONSTRAINT watch_status_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE watch_status DROP CONSTRAINT IF EXISTS watch_status_group_id_fkey;
ALTER TABLE watch_status ADD CONSTRAINT watch_status_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);

-- ─── turn_extensions ─────────────────────────────────────────────────────────
ALTER TABLE turn_extensions DROP CONSTRAINT IF EXISTS turn_extensions_group_id_fkey;
ALTER TABLE turn_extensions ADD CONSTRAINT turn_extensions_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id);
