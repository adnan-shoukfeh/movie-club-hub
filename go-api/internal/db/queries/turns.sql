-- name: GetTurn :one
SELECT id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
       movie_unlocked, reviews_unlocked, created_at, updated_at
FROM turns
WHERE group_id = $1 AND week_of = $2;

-- name: GetTurnByIndex :one
SELECT id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
       movie_unlocked, reviews_unlocked, created_at, updated_at
FROM turns
WHERE group_id = $1 AND turn_index = $2;

-- name: GetTurnByID :one
SELECT id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
       movie_unlocked, reviews_unlocked, created_at, updated_at
FROM turns
WHERE id = $1;

-- name: GetTurnsForGroup :many
SELECT id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
       movie_unlocked, reviews_unlocked, created_at, updated_at
FROM turns
WHERE group_id = $1
ORDER BY turn_index;

-- name: GetCurrentTurn :one
-- When an admin extends a turn, only that turn's end_date grows; the next turn's
-- start_date is unchanged, so their windows overlap and both rows match the
-- predicate below. Ordering by turn_index keeps the extended (in-progress) turn
-- current until its extended end_date passes, instead of jumping to the next turn.
SELECT id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
       movie_unlocked, reviews_unlocked, created_at, updated_at
FROM turns
WHERE group_id = $1 AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
ORDER BY turn_index
LIMIT 1;

-- name: CreateTurn :one
INSERT INTO turns (
    group_id, turn_index, week_of, picker_user_id, start_date, end_date,
    movie_unlocked, reviews_unlocked
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
          movie_unlocked, reviews_unlocked, created_at, updated_at;

-- name: UpsertTurn :one
INSERT INTO turns (
    group_id, turn_index, week_of, picker_user_id, start_date, end_date,
    movie_unlocked, reviews_unlocked
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT ON CONSTRAINT turns_group_index_unique
DO UPDATE SET
    week_of = EXCLUDED.week_of,
    picker_user_id = EXCLUDED.picker_user_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    movie_unlocked = EXCLUDED.movie_unlocked,
    reviews_unlocked = EXCLUDED.reviews_unlocked,
    updated_at = now()
RETURNING id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
          movie_unlocked, reviews_unlocked, created_at, updated_at;

-- name: UpdateTurnPicker :exec
UPDATE turns
SET picker_user_id = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateTurnDates :exec
-- Keeps week_of aligned with start_date. The deadline math (extendedDays) is
-- computed relative to week_of, so a turn whose week_of drifts from its real
-- start produces wrong deadlines; keeping them equal avoids that.
UPDATE turns
SET week_of = $2, start_date = $2, end_date = $3, updated_at = now()
WHERE id = $1;

-- name: UpdateTurnMovieUnlocked :exec
UPDATE turns
SET movie_unlocked = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateTurnReviewsUnlocked :exec
UPDATE turns
SET reviews_unlocked = $2, updated_at = now()
WHERE id = $1;

-- name: ExtendTurn :exec
UPDATE turns
SET end_date = end_date + ($2 * INTERVAL '1 day'), updated_at = now()
WHERE id = $1;

-- name: GetLatestTurnForGroup :one
SELECT id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
       movie_unlocked, reviews_unlocked, created_at, updated_at
FROM turns
WHERE group_id = $1
ORDER BY turn_index DESC
LIMIT 1;

-- name: DeleteTurn :exec
DELETE FROM turns WHERE id = $1;
