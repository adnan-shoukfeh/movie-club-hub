-- Phase 2.1: Create and backfill turns table
-- Consolidates picker_assignments, turn_overrides, turn_extensions into single source of truth.

CREATE TABLE turns (
    id               bigserial PRIMARY KEY,
    group_id         integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    turn_index       integer NOT NULL,
    week_of          date NOT NULL,
    picker_user_id   integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    start_date       date NOT NULL,
    end_date         date NOT NULL,
    movie_unlocked   boolean NOT NULL DEFAULT false,
    reviews_unlocked boolean NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT turns_group_index_unique UNIQUE (group_id, turn_index),
    CONSTRAINT turns_group_week_unique  UNIQUE (group_id, week_of),
    CONSTRAINT turns_dates_ordered      CHECK (end_date >= start_date)
);

CREATE INDEX turns_group_week_idx ON turns (group_id, week_of);

-- Backfill turns from legacy tables.
-- For each group, generate turns from start_date to CURRENT_DATE + 90 days.
DO $$
DECLARE
    grp RECORD;
    member_rec RECORD;
    member_ids INTEGER[];
    turn_idx INTEGER;
    turn_week_of DATE;
    turn_start DATE;
    turn_end DATE;
    base_length INTEGER;
    ext_days INTEGER;
    override_ext INTEGER;
    override_offset INTEGER;
    override_movie BOOLEAN;
    override_review BOOLEAN;
    picker_id INTEGER;
    assigned_picker INTEGER;
    max_date DATE;
    cumulative_offset INTEGER;
BEGIN
    max_date := CURRENT_DATE + INTERVAL '90 days';

    FOR grp IN SELECT id, start_date, turn_length_days FROM groups LOOP
        base_length := grp.turn_length_days;

        -- Get ordered member IDs for round-robin picker assignment
        SELECT array_agg(user_id ORDER BY joined_at) INTO member_ids
        FROM memberships
        WHERE group_id = grp.id;

        IF member_ids IS NULL OR array_length(member_ids, 1) IS NULL THEN
            CONTINUE;  -- Skip groups with no members
        END IF;

        turn_idx := 0;
        cumulative_offset := 0;

        WHILE (grp.start_date + cumulative_offset * INTERVAL '1 day')::date <= max_date LOOP
            turn_week_of := (grp.start_date + cumulative_offset * INTERVAL '1 day')::date;

            -- Get turn_extensions extra_days for this turn_index
            SELECT COALESCE(extra_days, 0) INTO ext_days
            FROM turn_extensions
            WHERE group_id = grp.id AND turn_index = turn_idx;
            IF ext_days IS NULL THEN ext_days := 0; END IF;

            -- Get turn_overrides for this week_of
            SELECT
                COALESCE(extended_days, 0),
                COALESCE(start_offset_days, 0),
                COALESCE(movie_unlocked_by_admin, false),
                COALESCE(review_unlocked_by_admin, false)
            INTO override_ext, override_offset, override_movie, override_review
            FROM turn_overrides
            WHERE group_id = grp.id AND week_of = turn_week_of;

            IF override_ext IS NULL THEN override_ext := 0; END IF;
            IF override_offset IS NULL THEN override_offset := 0; END IF;
            IF override_movie IS NULL THEN override_movie := false; END IF;
            IF override_review IS NULL THEN override_review := false; END IF;

            -- Compute effective start/end dates
            turn_start := turn_week_of + override_offset * INTERVAL '1 day';
            turn_end := turn_start + (base_length - 1 + ext_days + override_ext) * INTERVAL '1 day';

            -- Get picker: check picker_assignments first, then round-robin
            SELECT user_id INTO assigned_picker
            FROM picker_assignments
            WHERE group_id = grp.id AND week_of = turn_week_of::text;

            IF assigned_picker IS NOT NULL THEN
                picker_id := assigned_picker;
            ELSE
                picker_id := member_ids[1 + (turn_idx % array_length(member_ids, 1))];
            END IF;

            -- Insert the turn
            INSERT INTO turns (
                group_id, turn_index, week_of, picker_user_id,
                start_date, end_date, movie_unlocked, reviews_unlocked
            ) VALUES (
                grp.id, turn_idx, turn_week_of, picker_id,
                turn_start, turn_end, override_movie, override_review
            )
            ON CONFLICT DO NOTHING;

            -- Advance to next turn
            cumulative_offset := cumulative_offset + base_length + ext_days + override_ext;
            turn_idx := turn_idx + 1;

            -- Safety: prevent infinite loops
            IF turn_idx > 1000 THEN EXIT; END IF;
        END LOOP;
    END LOOP;
END $$;

-- Backfill invariant checks
DO $$
DECLARE
    orphan_count INTEGER;
    future_count INTEGER;
    constraint_violations INTEGER;
BEGIN
    -- Check for orphaned FKs (should be 0)
    SELECT COUNT(*) INTO orphan_count
    FROM turns t
    LEFT JOIN groups g ON g.id = t.group_id
    WHERE g.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % orphaned turns (no group)', orphan_count;
    END IF;

    -- Check for future timestamps (should be 0)
    SELECT COUNT(*) INTO future_count
    FROM turns
    WHERE created_at > now();

    IF future_count > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % turns with future created_at', future_count;
    END IF;

    -- Check constraint: end_date >= start_date (should be 0 violations)
    SELECT COUNT(*) INTO constraint_violations
    FROM turns
    WHERE end_date < start_date;

    IF constraint_violations > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % turns with end_date < start_date', constraint_violations;
    END IF;

    RAISE NOTICE 'Backfill invariants passed. Turns created: %', (SELECT COUNT(*) FROM turns);
END $$;
