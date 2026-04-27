-- Picker assignment, turn override, and turn extension queries are thin views
-- over the canonical turns table. Each turn owns its own picker, schedule
-- (start_date / end_date), and admin unlocks (movie_unlocked / reviews_unlocked).
-- Legacy concepts (`extended_days`, `start_offset_days`, per-index extra_days)
-- are derived on read and translated into direct turn updates on write.

-- name: GetPickerAssignment :one
SELECT t.id, t.group_id, t.picker_user_id AS user_id,
       to_char(t.week_of, 'YYYY-MM-DD') AS week_of
FROM turns t
WHERE t.group_id = sqlc.arg(group_id)
  AND t.week_of = sqlc.arg(week_of)::date;

-- name: GetPickerAssignmentsForGroup :many
SELECT t.group_id,
       t.picker_user_id AS user_id,
       to_char(t.week_of, 'YYYY-MM-DD') AS week_of,
       u.username AS picker_username
FROM turns t
JOIN users u ON u.id = t.picker_user_id
WHERE t.group_id = sqlc.arg(group_id)
ORDER BY t.week_of;

-- Returns combined per-turn extra days (turn-extension + override-extended) for
-- each turn whose effective length exceeds the group's base turn_length_days.
-- name: GetTurnExtensions :many
SELECT t.id,
       t.group_id,
       t.turn_index,
       (t.end_date - t.start_date + 1 - g.turn_length_days)::int AS extra_days
FROM turns t
JOIN groups g ON g.id = t.group_id
WHERE t.group_id = sqlc.arg(group_id)
  AND (t.end_date - t.start_date + 1 - g.turn_length_days) > 0
ORDER BY t.turn_index;

-- name: UpsertTurnExtension :exec
UPDATE turns t
SET end_date = t.start_date + (g.turn_length_days - 1 + sqlc.arg(extra_days)::int),
    updated_at = now()
FROM groups g
WHERE g.id = t.group_id
  AND t.group_id = sqlc.arg(group_id)
  AND t.turn_index = sqlc.arg(turn_index);

-- name: GetTurnOverride :one
SELECT t.id,
       t.group_id,
       t.week_of,
       t.reviews_unlocked AS review_unlocked_by_admin,
       t.movie_unlocked   AS movie_unlocked_by_admin,
       (t.end_date - t.start_date + 1 - g.turn_length_days)::int AS extended_days,
       (t.start_date - t.week_of)::int                            AS start_offset_days,
       t.updated_at
FROM turns t
JOIN groups g ON g.id = t.group_id
WHERE t.group_id = sqlc.arg(group_id)
  AND t.week_of = sqlc.arg(week_of)::date;

-- name: GetTurnOverridesForGroup :many
SELECT t.id,
       t.group_id,
       t.week_of,
       t.reviews_unlocked AS review_unlocked_by_admin,
       t.movie_unlocked   AS movie_unlocked_by_admin,
       (t.end_date - t.start_date + 1 - g.turn_length_days)::int AS extended_days,
       (t.start_date - t.week_of)::int                            AS start_offset_days,
       t.updated_at
FROM turns t
JOIN groups g ON g.id = t.group_id
WHERE t.group_id = sqlc.arg(group_id)
ORDER BY t.week_of;

-- name: UpsertTurnOverrideMovieUnlocked :exec
UPDATE turns
SET movie_unlocked = sqlc.arg(movie_unlocked_by_admin), updated_at = now()
WHERE group_id = sqlc.arg(group_id)
  AND week_of = sqlc.arg(week_of)::date;

-- name: UpsertTurnOverrideReviewUnlocked :exec
UPDATE turns
SET reviews_unlocked = sqlc.arg(review_unlocked_by_admin), updated_at = now()
WHERE group_id = sqlc.arg(group_id)
  AND week_of = sqlc.arg(week_of)::date;

-- name: UpsertTurnOverrideExtendedDays :exec
UPDATE turns t
SET end_date = t.start_date + (g.turn_length_days - 1 + sqlc.arg(extended_days)::int),
    updated_at = now()
FROM groups g
WHERE g.id = t.group_id
  AND t.group_id = sqlc.arg(group_id)
  AND t.week_of = sqlc.arg(week_of)::date;

-- Shifts the turn's start_date to (week_of + start_offset_days) while preserving
-- the existing turn length (end_date - start_date stays constant).
-- name: UpsertTurnOverrideStartOffset :exec
UPDATE turns
SET start_date = week_of + sqlc.arg(start_offset_days)::int,
    end_date   = (week_of + sqlc.arg(start_offset_days)::int) + (end_date - start_date),
    updated_at = now()
WHERE group_id = sqlc.arg(group_id)
  AND week_of = sqlc.arg(week_of)::date;
