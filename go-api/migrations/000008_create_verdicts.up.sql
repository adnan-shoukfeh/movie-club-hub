-- Phase 3.1: Create and backfill verdicts table
-- Unifies votes + watch_status into single source of truth.
-- FK to turns.id for structural integrity.

CREATE TABLE verdicts (
    id         bigserial PRIMARY KEY,
    turn_id    bigint NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    watched    boolean NOT NULL DEFAULT false,
    rating     numeric(3,1),
    review     text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT verdicts_turn_user_unique        UNIQUE (turn_id, user_id),
    CONSTRAINT verdicts_rating_range            CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
    CONSTRAINT verdicts_rating_requires_watched CHECK (rating IS NULL OR watched = true),
    CONSTRAINT verdicts_review_requires_watched CHECK (review IS NULL OR watched = true)
);

CREATE INDEX verdicts_turn_idx ON verdicts (turn_id);
CREATE INDEX verdicts_user_idx ON verdicts (user_id);

-- Backfill verdicts from votes + watch_status.
-- Per D1 Option A: any votes row implies watched=true.
-- The ::text cast bridges legacy text week_of and new date week_of in turns.

-- First, insert from votes (these users definitely watched and rated).
INSERT INTO verdicts (turn_id, user_id, watched, rating, review, created_at, updated_at)
SELECT
    t.id AS turn_id,
    v.user_id,
    true AS watched,  -- D1 Option A: rating implies watched
    v.rating::numeric(3,1),
    v.review,
    v.created_at,
    v.updated_at
FROM votes v
JOIN turns t ON t.group_id = v.group_id AND t.week_of::text = v.week_of
ON CONFLICT (turn_id, user_id) DO NOTHING;

-- Then, insert watch_status rows that don't have a corresponding vote.
INSERT INTO verdicts (turn_id, user_id, watched, rating, review, created_at, updated_at)
SELECT
    t.id AS turn_id,
    ws.user_id,
    ws.watched,
    NULL AS rating,
    NULL AS review,
    ws.updated_at AS created_at,
    ws.updated_at
FROM watch_status ws
JOIN turns t ON t.group_id = ws.group_id AND t.week_of::text = ws.week_of
WHERE NOT EXISTS (
    SELECT 1 FROM votes v
    WHERE v.group_id = ws.group_id
      AND v.week_of = ws.week_of
      AND v.user_id = ws.user_id
)
ON CONFLICT (turn_id, user_id) DO NOTHING;

-- Backfill invariant checks
DO $$
DECLARE
    orphan_count INTEGER;
    constraint_violations INTEGER;
    future_count INTEGER;
BEGIN
    -- Check for orphaned FKs (should be 0)
    SELECT COUNT(*) INTO orphan_count
    FROM verdicts v
    LEFT JOIN turns t ON t.id = v.turn_id
    WHERE t.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % orphaned verdicts (no turn)', orphan_count;
    END IF;

    -- Check rating range violations (should be 0 due to CHECK constraint)
    SELECT COUNT(*) INTO constraint_violations
    FROM verdicts
    WHERE rating IS NOT NULL AND (rating < 0 OR rating > 10);

    IF constraint_violations > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % verdicts with invalid rating', constraint_violations;
    END IF;

    -- Check rating without watched violations (should be 0)
    SELECT COUNT(*) INTO constraint_violations
    FROM verdicts
    WHERE rating IS NOT NULL AND watched = false;

    IF constraint_violations > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % verdicts with rating but watched=false', constraint_violations;
    END IF;

    -- Check for future timestamps (should be 0)
    SELECT COUNT(*) INTO future_count
    FROM verdicts
    WHERE created_at > now();

    IF future_count > 0 THEN
        RAISE EXCEPTION 'Backfill invariant failed: % verdicts with future created_at', future_count;
    END IF;

    RAISE NOTICE 'Backfill invariants passed. Verdicts created: %', (SELECT COUNT(*) FROM verdicts);
END $$;
