-- Queries for legacy turn management tables (deprecated).
-- These reference the renamed _deprecated_* tables.
-- TODO: Remove once handlers are fully migrated to turns table.

-- name: UpsertPickerAssignment :exec
INSERT INTO _deprecated_picker_assignments (group_id, user_id, week_of)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT picker_group_week_unique
DO UPDATE SET user_id = EXCLUDED.user_id;

-- name: DeletePickerAssignment :exec
DELETE FROM _deprecated_picker_assignments WHERE group_id = $1 AND week_of = $2;

-- name: GetPickerAssignment :one
SELECT id, group_id, user_id, week_of
FROM _deprecated_picker_assignments
WHERE group_id = $1 AND week_of = $2;

-- name: GetPickerAssignmentsForGroup :many
SELECT pa.group_id, pa.user_id, pa.week_of, u.username AS picker_username
FROM _deprecated_picker_assignments pa
JOIN users u ON u.id = pa.user_id
WHERE pa.group_id = $1
ORDER BY pa.week_of;

-- name: GetTurnExtensions :many
SELECT id, group_id, turn_index, extra_days
FROM _deprecated_turn_extensions
WHERE group_id = $1;

-- name: UpsertTurnExtension :exec
INSERT INTO _deprecated_turn_extensions (group_id, turn_index, extra_days)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT turn_extensions_group_turn_unique
DO UPDATE SET extra_days = EXCLUDED.extra_days;

-- name: GetTurnOverride :one
SELECT id, group_id, week_of, review_unlocked_by_admin, movie_unlocked_by_admin, extended_days, start_offset_days, updated_at
FROM _deprecated_turn_overrides
WHERE group_id = $1 AND week_of = $2;

-- name: GetTurnOverridesForGroup :many
SELECT id, group_id, week_of, review_unlocked_by_admin, movie_unlocked_by_admin, extended_days, start_offset_days, updated_at
FROM _deprecated_turn_overrides
WHERE group_id = $1
ORDER BY week_of;

-- name: UpsertTurnOverride :exec
INSERT INTO _deprecated_turn_overrides (group_id, week_of, review_unlocked_by_admin, movie_unlocked_by_admin, extended_days)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT ON CONSTRAINT turn_overrides_group_week_unique
DO UPDATE SET review_unlocked_by_admin = EXCLUDED.review_unlocked_by_admin,
             movie_unlocked_by_admin = EXCLUDED.movie_unlocked_by_admin,
             extended_days = EXCLUDED.extended_days,
             updated_at = now();

-- name: UpsertTurnOverrideMovieUnlocked :exec
INSERT INTO _deprecated_turn_overrides (group_id, week_of, movie_unlocked_by_admin)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT turn_overrides_group_week_unique
DO UPDATE SET movie_unlocked_by_admin = EXCLUDED.movie_unlocked_by_admin, updated_at = now();

-- name: UpsertTurnOverrideReviewUnlocked :exec
INSERT INTO _deprecated_turn_overrides (group_id, week_of, review_unlocked_by_admin)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT turn_overrides_group_week_unique
DO UPDATE SET review_unlocked_by_admin = EXCLUDED.review_unlocked_by_admin, updated_at = now();

-- name: UpsertTurnOverrideExtendedDays :one
INSERT INTO _deprecated_turn_overrides (group_id, week_of, extended_days)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT turn_overrides_group_week_unique
DO UPDATE SET extended_days = EXCLUDED.extended_days, updated_at = now()
RETURNING id, group_id, week_of, review_unlocked_by_admin, movie_unlocked_by_admin, extended_days, start_offset_days, updated_at;

-- name: UpsertTurnOverrideStartOffset :one
INSERT INTO _deprecated_turn_overrides (group_id, week_of, start_offset_days)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT turn_overrides_group_week_unique
DO UPDATE SET start_offset_days = EXCLUDED.start_offset_days, updated_at = now()
RETURNING id, group_id, week_of, review_unlocked_by_admin, movie_unlocked_by_admin, extended_days, start_offset_days, updated_at;
