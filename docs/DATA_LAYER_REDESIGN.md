# Movie Club Hub — Data Layer Redesign Engineering Doc

**Version:** 2.1
**Date:** 2026-04-20
**Purpose:** Redesign the database schema to eliminate single-source-of-truth violations, remove dead and duplicate tables, align types with the domain, dedupe OMDb metadata into a canonical films table, and create clean extension points for planned features (reactions, gamification, notifications, movie detail page).
**Audience:** Claude Code agent (executable plan)
**Companion to:** `REFACTORING_PLAN.md` — this doc is the deferred schema work referenced in that doc's Rule 5 and Phase 4.3.
**Scale assumption:** Production holds on the order of a few hundred rows across all tables. Migrations are sub-second. The plan is sized to that reality — no soak periods, no phased dual-write dance. Robustness comes from backups, invariant checks, and round-trip tests, not elapsed time.

---

## Overview

The current schema reflects how the app grew, not how the domain decomposes. Three problems motivate the work:

1. **`votes` + `watch_status` are two tables for one concept** (the `Verdict`). REFACTORING_PLAN Phase 4.3 unifies them at the service layer; this doc finishes the merge at the schema layer.
2. **Turn state is spread across four tables** — `groups` (base schedule), `picker_assignments` (who picks), `turn_overrides` (admin date/unlock adjustments), `turn_extensions` (a second, parallel way to extend turns). `buildTurnConfig` currently reads three of these and sums them. One `turns` table collapses the reads to a single lookup.
3. **`movies` stores OMDb metadata inline per pick,** duplicating title/director/genre/runtime/year for every group that picks the same film. A canonical `films` table dedupes on `imdb_id` and enables the planned movie detail page.

Secondary cleanups bundled in:

- `week_of` is inconsistent across tables (`text` in most, `date` in `turn_overrides`). New tables use `date`.
- `memberships.role` is unconstrained text. Add a CHECK.
- `votes.rating` is `real` (float). Ratings are 0–10 in 0.5 increments — express as `numeric(3,1)` with a CHECK.
- Most FKs have no explicit `ON DELETE`. Add cascade rules explicitly.
- Hot query paths (`WHERE group_id = ? AND week_of = ?`) have no supporting indexes beyond unique constraints. Add composite indexes.

**Core principle:** Robustness through backups and invariant checks, not through prolonged parallel-run periods. Every destructive change is preceded by a Cloud SQL backup. Every backfill runs invariant queries before the migration is considered complete. Old tables are renamed-not-dropped until a post-deploy sanity check passes, then dropped in a follow-up migration.

**Forward-looking principle:** The schema should make future features easy without pre-building them. Stable primary keys on `turns`, `verdicts`, and `films` give future `reactions`, `replies`, and `notifications` tables an obvious FK target. No speculative tables.

---

## Execution Rules for Agent

1. **Execute phases in order.** Each phase depends on the previous for FK integrity.
2. **Take a Cloud SQL backup immediately before running any migration that modifies existing data.** The agent uses `gcloud sql backups create` or verifies that point-in-time recovery covers the migration window. Log the backup ID in the commit message.
3. **Dry-run every Phase 2, 3, and 4 migration against a local dev DB seeded with a production snapshot before touching production.** The "Local Verification Workflow" section below is mandatory, not optional. Phase 1 migrations (additive only) may skip the snapshot restore but must still pass `make test` locally.
4. **One migration file per logical change.** Keep them small; each must round-trip cleanly (`up → down → up` produces identical schema). Add a Make target `make migrate-roundtrip` if one doesn't exist.
5. **Every backfill runs invariant checks before being considered complete.** Row counts, constraint violations, orphaned FKs. See "Backfill Invariants" below. If any check fails, the migration's `up` must error — do not leave a half-migrated table.
6. **Never drop a table in the same migration that creates its replacement.** Minimum two migrations: the first creates + backfills + renames old to `_deprecated_<table>`; the second drops `_deprecated_<table>` after the human confirms the new path works in production. These can ship in consecutive deploys on the same day.
7. **Commit per migration** with message format `db(<phase>.<section>): <short description>`. Include backup ID in the body.
8. **Surface decisions, don't guess.** The remaining open decisions below have recommended defaults. If production data during execution would violate a recommended default (e.g., D1 produces CHECK violations), the agent stops and reports.
9. **Round-trip-test the down migration locally.** The plan leans on point-in-time recovery for production rollback, but a broken down migration means the dev environment can't be reset without a rebuild.

---

## Open Decisions

### D1. Handling pre-Apr 18 inconsistent verdict rows

**Decision needed before:** Phase 3 backfill.
**Context:** Before Apr 18, users could submit a rating without marking watched. Production may have `votes` rows with no corresponding `watch_status` row. The new `verdicts` table has a CHECK constraint that `rating IS NOT NULL` requires `watched = true`.
**Recommendation:** **Option A** — treat any `votes` row as `watched = true` during backfill. A rating implies watching. No data loss.
**Agent action:** Before backfill, agent runs a count: "rows in `votes` with a rating but no `watch_status` row." If count is >0, agent reports the count and a sample of 5 rows, then proceeds with option A unless told otherwise.

### D2. Deprecated-table retention

**Recommendation:** Rename old tables to `_deprecated_<n>_<date>` at cutover. Drop in a follow-up migration after the human confirms the app works (hours, not weeks). Cloud SQL point-in-time recovery is the real rollback guarantee; the rename is just a belt-and-suspenders for same-day rollback.

### D3. Invite code redesign — OUT OF SCOPE

Per REFACTORING_PLAN P0, but a product decision rather than data-model cleanup. Tracked separately.

---

## Principles

### Single source of truth per concept

For every piece of state, one table owns it. Turn scheduling (dates, picker, unlock flags) → `turns`. Engagement (watched, rating, review) → `verdicts`. Film metadata → `films`. No more summing data across multiple tables in application code.

### Types express the domain

- Dates are `date`.
- Ratings are `numeric(3,1)` with CHECK (0 ≤ rating ≤ 10).
- Enumerated values have CHECK constraints.
- IDs on new tables are `bigserial`. `serial` (int4) caps at 2.1B — cheap to avoid.

### Invariants are database-level where possible

The "rating requires watched" invariant is a CHECK constraint on `verdicts`, not just a service-layer rule. The service layer can still validate earlier and return better errors, but the DB is the backstop.

### Explicit cascade rules

Every FK gets either `ON DELETE CASCADE` or `ON DELETE RESTRICT`. Group-owned tables cascade from `groups`. User references RESTRICT (deleting a user shouldn't silently erase their review history; soft-delete semantics are a separate future decision).

### Indexes match query paths

Every composite unique constraint already acts as an index. For columns used in `WHERE` clauses without a covering unique constraint, add an index.

### Stable IDs for future features

Every row a user might later react to, reply to, or reference in a notification needs a stable PK. Verdicts, turns, and films all get `id bigserial`. No additional work now; future migrations are trivial.

---

## Target Schema (end state)

```
users              (+ avatar_url nullable, for future profile images)
groups             (unchanged)
memberships        (+ CHECK role IN ('member','admin','owner'))
invites            (unchanged — see D3)

turns              NEW — replaces picker_assignments + turn_overrides + turn_extensions;
                   absorbs movies.week_of and movies.set_by_user_id

movies             MODIFIED — per-turn pick; loses OMDb metadata columns;
                   gains turn_id + film_id FKs. Keeps nominator_user_id.

verdicts           NEW — replaces votes + watch_status

nominations        MODIFIED — gains film_id FK; loses inline OMDb columns

films              NEW — canonical OMDb cache, keyed by imdb_id

picker_assignments GONE
turn_overrides     GONE
turn_extensions    GONE
votes              GONE
watch_status       GONE
```

### Table specs

#### `turns`

```sql
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
```

`start_date` and `end_date` are the *effective* dates after any extensions/offsets. The service layer writes these directly on turn creation; no other code computes them. `picker_user_id` is seeded from rotation at creation and never recomputed thereafter — this is the SSOT rule REFACTORING_PLAN Phase 4.2 established.

#### `verdicts`

```sql
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
```

FK to `turn_id`, not `(group_id, week_of)`. This is the structural payoff of having a turns table.

#### `films`

```sql
CREATE TABLE films (
    id              bigserial PRIMARY KEY,
    imdb_id         text NOT NULL UNIQUE,
    title           text NOT NULL,
    year            integer,
    poster_url      text,
    director        text,
    genre           text,
    runtime_minutes integer,
    omdb_fetched_at timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);
```

`MovieService` and `NominationService` upsert into this table on every OMDb fetch. Fresh OMDb responses overwrite stale metadata; `omdb_fetched_at` tracks last refresh.

#### `movies` (modified)

```sql
-- After Phase 4:
-- Columns: id, group_id, turn_id, film_id, nominator_user_id, created_at
-- Dropped: week_of, set_by_user_id, imdb_id, title, poster, director, genre, runtime, year
```

A row is now "the film picked for turn X, originally nominated by user Y." Picker is derivable via `turns.picker_user_id`.

#### `nominations` (modified)

```sql
-- After Phase 4:
-- Columns: id, group_id, user_id, film_id, created_at
-- Dropped: imdb_id, title, year, poster
```

---

## Migration Sequence

Thirteen migrations across four phases. All sub-second at current scale. The agent runs each phase end-to-end, verifies, commits, deploys, then moves on.

### Phase 1: Foundations

Additive, low-risk. These ship independently of the structural changes.

#### 1.1 Query-path indexes

**Migration:** `0003_add_query_indexes`
```sql
CREATE INDEX IF NOT EXISTS votes_group_week_idx        ON votes (group_id, week_of);
CREATE INDEX IF NOT EXISTS watch_status_group_week_idx ON watch_status (group_id, week_of);
CREATE INDEX IF NOT EXISTS movies_group_week_idx       ON movies (group_id, week_of);
CREATE INDEX IF NOT EXISTS nominations_group_idx       ON nominations (group_id);
CREATE INDEX IF NOT EXISTS memberships_group_idx       ON memberships (group_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx        ON memberships (user_id);
```
Some of these indexes will become irrelevant after their source tables drop in Phases 2–3. That's fine — they're cheap insurance during the transition.

#### 1.2 CHECK constraints and avatar column

**Migration:** `0004_add_constraints_and_avatar`
```sql
-- Agent verifies no existing rows violate each constraint BEFORE adding it.
-- If any row violates, agent reports count and sample, then awaits guidance.
ALTER TABLE memberships ADD CONSTRAINT memberships_role_valid
    CHECK (role IN ('member','admin','owner'));
ALTER TABLE votes ADD CONSTRAINT votes_rating_range
    CHECK (rating >= 0 AND rating <= 10);
ALTER TABLE groups ADD CONSTRAINT groups_turn_length_positive
    CHECK (turn_length_days > 0);

-- Forward prep for future profile images feature.
ALTER TABLE users ADD COLUMN avatar_url text;
```

#### 1.3 Explicit FK cascade rules

**Migration:** `0005_explicit_fk_cascades`
Drop and re-add each FK with explicit `ON DELETE CASCADE` (group-owned tables) or `ON DELETE RESTRICT` (user references). This migration touches every FK; round-trip testing is especially important.

---

### Phase 2: Turn unification

Collapse `picker_assignments`, `turn_overrides`, and `turn_extensions` into `turns`.

#### 2.1 Create, backfill, cut over

**Migration:** `0006_create_and_backfill_turns`

**Steps (in one transaction):**

1. `CREATE TABLE turns` per the spec above.
2. Backfill by iterating each group. For each group:
   - Determine the turn range: turn 0 begins at `group.start_date`; generate turns forward to `CURRENT_DATE + 90 days`.
   - For each `turn_index` in that range:
     - `week_of = group.start_date + turn_index * group.turn_length_days`
     - Base `start_date = week_of`, base `end_date = week_of + group.turn_length_days - 1`
     - Apply `turn_overrides[group_id, week_of].start_offset_days` to `start_date`
     - Apply `turn_overrides[group_id, week_of].extended_days` to `end_date`
     - **Also** apply `turn_extensions[group_id, turn_index].extra_days` to `end_date` (this is what `buildTurnConfig` does today — the backfill preserves the summed result)
     - `picker_user_id`: from `picker_assignments[group_id, week_of].user_id` if present, else round-robin from `memberships` ordered by `joined_at` using `turn_index % member_count`
     - `movie_unlocked`, `reviews_unlocked`: from `turn_overrides[group_id, week_of]`, else false
3. Run backfill invariants (see below). If any fail, raise and abort the transaction.

**Code changes in the same release:**
- `TurnService` reads and writes `turns` only.
- Router stops registering the `SetTurnExtension` endpoint.
- sqlc queries touching `picker_assignments` / `turn_overrides` / `turn_extensions` are deleted.

#### 2.2 Rename legacy tables

**Migration:** `0007_rename_legacy_turn_tables`
```sql
ALTER TABLE picker_assignments RENAME TO _deprecated_picker_assignments;
ALTER TABLE turn_overrides     RENAME TO _deprecated_turn_overrides;
ALTER TABLE turn_extensions    RENAME TO _deprecated_turn_extensions;
```

Can be combined with 2.1 into a single migration if the agent is confident; keeping it separate makes rollback granular.

#### 2.3 Drop renamed tables (follow-up, same-day)

**Migration:** `0008_drop_legacy_turn_tables`
Runs after the human confirms in production that the new schema works (spot-check: load a group, see the correct deadline, admin panel still works). At this scale, "works" is verifiable in minutes.

---

### Phase 3: Verdict unification

Same pattern: collapse `votes` + `watch_status` into `verdicts`.

#### 3.1 Create, backfill, cut over

**Migration:** `0009_create_and_backfill_verdicts`

Depends on Phase 2 (FK to `turns.id`).

**Backfill approach (per D1 option A):**
```sql
INSERT INTO verdicts (turn_id, user_id, watched, rating, review, created_at, updated_at)
SELECT
    t.id                                                   AS turn_id,
    COALESCE(v.user_id, ws.user_id)                        AS user_id,
    -- Rating implies watched; otherwise use explicit watch_status
    COALESCE(ws.watched, v.rating IS NOT NULL)             AS watched,
    v.rating,
    v.review,
    LEAST(
        COALESCE(v.created_at, ws.updated_at),
        COALESCE(ws.updated_at, v.created_at)
    )                                                      AS created_at,
    GREATEST(
        COALESCE(v.updated_at, ws.updated_at),
        COALESCE(ws.updated_at, v.updated_at)
    )                                                      AS updated_at
FROM turns t
LEFT JOIN votes v
    ON v.group_id = t.group_id
   AND v.week_of = t.week_of::text
LEFT JOIN watch_status ws
    ON ws.group_id = t.group_id
   AND ws.week_of = t.week_of::text
   AND ws.user_id = COALESCE(v.user_id, ws.user_id)
WHERE v.user_id IS NOT NULL OR ws.user_id IS NOT NULL
ON CONFLICT (turn_id, user_id) DO NOTHING;
```

The `::text` cast bridges the legacy text `week_of` and the new `date` `week_of`. Agent verifies text format is `YYYY-MM-DD` before the cast. If non-standard formats exist, agent reports and awaits guidance.

**Code changes in the same release:**
- `VerdictService` reads and writes `verdicts` only.
- API routes for `/verdict`, `/verdicts` go live; legacy aliases (`/vote`, `/results`, `/watch-status`) either delegate to the new handlers or are removed — per the REFACTORING_PLAN transition strategy, whichever was chosen.
- sqlc queries touching `votes` / `watch_status` are deleted.

#### 3.2 Rename and drop

**Migrations:** `0010_rename_legacy_verdict_tables` and `0011_drop_legacy_verdict_tables`. Same pattern as 2.2/2.3.

---

### Phase 4: Canonical films

#### 4.1 Create and backfill films

**Migration:** `0012_create_and_backfill_films`

```sql
CREATE TABLE films (...); -- per spec

-- Backfill from movies (higher confidence; picked films have been verified)
INSERT INTO films (imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at)
SELECT DISTINCT ON (imdb_id)
    imdb_id,
    title,
    NULLIF(year, '')::integer,
    poster,
    director,
    genre,
    -- movies.runtime is text like "132 min"; strip non-digits
    NULLIF(regexp_replace(COALESCE(runtime, ''), '[^0-9]', '', 'g'), '')::integer,
    created_at,
    created_at
FROM movies
WHERE imdb_id IS NOT NULL AND imdb_id <> ''
ORDER BY imdb_id, created_at DESC
ON CONFLICT (imdb_id) DO NOTHING;

-- Also backfill films from nominations that aren't already present
INSERT INTO films (imdb_id, title, year, poster_url, omdb_fetched_at, created_at)
SELECT DISTINCT ON (imdb_id)
    imdb_id,
    title,
    NULLIF(year, '')::integer,
    poster,
    created_at,
    created_at
FROM nominations
WHERE imdb_id IS NOT NULL AND imdb_id <> ''
ORDER BY imdb_id, created_at DESC
ON CONFLICT (imdb_id) DO NOTHING;
```

#### 4.2 Link movies and nominations to films; drop redundant columns

**Migration:** `0013_link_and_drop_film_columns`

```sql
-- Add FK columns
ALTER TABLE movies      ADD COLUMN film_id bigint REFERENCES films(id) ON DELETE RESTRICT;
ALTER TABLE movies      ADD COLUMN turn_id bigint REFERENCES turns(id) ON DELETE CASCADE;
ALTER TABLE nominations ADD COLUMN film_id bigint REFERENCES films(id) ON DELETE RESTRICT;

-- Populate FKs
UPDATE movies      m SET film_id = f.id FROM films f WHERE m.imdb_id = f.imdb_id;
UPDATE movies      m SET turn_id = t.id FROM turns t WHERE m.group_id = t.group_id AND m.week_of = t.week_of::text;
UPDATE nominations n SET film_id = f.id FROM films f WHERE n.imdb_id = f.imdb_id;

-- Enforce NOT NULL and drop redundant columns
ALTER TABLE movies
    ALTER COLUMN film_id SET NOT NULL,
    ALTER COLUMN turn_id SET NOT NULL,
    DROP COLUMN week_of,
    DROP COLUMN set_by_user_id,
    DROP COLUMN imdb_id,
    DROP COLUMN title,
    DROP COLUMN poster,
    DROP COLUMN director,
    DROP COLUMN genre,
    DROP COLUMN runtime,
    DROP COLUMN year;

ALTER TABLE nominations
    ALTER COLUMN film_id SET NOT NULL,
    DROP COLUMN imdb_id,
    DROP COLUMN title,
    DROP COLUMN year,
    DROP COLUMN poster;
```

**Code changes in the same release:**
- `MovieService.Select()` upserts into `films` first, then inserts/updates `movies` with `turn_id` + `film_id`.
- `NominationService.Create()` upserts into `films` first, then inserts `nominations` with `film_id`.
- All read queries that returned inline OMDb data now JOIN `films`.
- sqlc queries regenerated.

No further drop migration needed — the redundant columns and the extra tables are gone.

---

## Backfill Invariants

Every backfill migration runs these checks within the same transaction as the data load. Any failure raises and rolls back.

```sql
-- 1. Row count matches expectation (documented per migration)
SELECT COUNT(*) FROM <new_table>;
-- Compared against: SELECT COUNT(DISTINCT ...) FROM <old_tables>;

-- 2. No CHECK violations (sanity; the constraint would prevent insert, but catch
--    cases where CHECK was added AFTER backfill)
SELECT COUNT(*) FROM <new_table> WHERE NOT (<each constraint>);

-- 3. No orphaned FKs
SELECT COUNT(*) FROM verdicts v LEFT JOIN turns t ON t.id = v.turn_id WHERE t.id IS NULL;

-- 4. Timestamps coherent (created_at <= updated_at, no future dates)
SELECT COUNT(*) FROM <new_table> WHERE created_at > updated_at OR created_at > now();
```

Each Phase 2, 3, 4 migration includes these checks with documented expected values (usually 0 for violations, exact match for counts).

### Handling inconsistent production data

Three classes of inconsistency are expected:

- **Orphaned `watch_status` rows** (no `votes`): backfill as `watched = true, rating = NULL, review = NULL`. Legal.
- **Orphaned `votes` rows** (no `watch_status`): per D1 option A, backfill as `watched = true, rating = <existing>, review = <existing>`. Legal.
- **Rows referencing a `(group_id, week_of)` outside the generated `turns` range** (old data predating current group start_date, or data too far future): log to `_backfill_rejects_<migration>` table, count reported, continue. If count exceeds 5% of total, stop and await guidance.

The agent never silently drops rows. Rejects go to a side table so a human can inspect.

---

## Testing Strategy

### Migration round-trip

Every migration must satisfy: clean DB → `migrate up` → `migrate down` → `migrate up` yields a schema identical to a single `migrate up`. Add `make migrate-roundtrip` if not present:

```makefile
migrate-roundtrip:
    @docker compose up -d postgres
    @migrate -path migrations -database $(DB_URL) up
    @migrate -path migrations -database $(DB_URL) down -all
    @migrate -path migrations -database $(DB_URL) up
    @./scripts/compare-schema.sh
```

### Backfill fixture tests

For Phases 2.1, 3.1, and 4.1, fixture-driven Go tests:
1. Load a representative dataset (captured from production, PII-stripped, anonymized usernames) into a test DB.
2. Run the backfill.
3. Assert invariants (counts, no CHECK violations, no orphans, no future timestamps).
4. Assert edge cases explicitly: a group with `turn_overrides`, a group without, a user who voted but didn't mark watched, a user who marked watched but didn't vote.

At hundreds of rows, a full production-sized fixture is fine to commit.

### Integration tests

Before each release cutover, the full integration test suite must pass against the new schema. No parallel old-path tests needed — the old tables will be gone within hours.

### Production verification (before dropping `_deprecated_*`)

For each Phase 2 and Phase 3 cutover, the agent produces a short verification script the human runs:
```sql
-- Spot checks post-migration, before drop
SELECT group_id, turn_index, week_of, start_date, end_date FROM turns ORDER BY group_id, turn_index LIMIT 20;
SELECT turn_id, user_id, watched, rating FROM verdicts ORDER BY turn_id LIMIT 20;
```
Plus a manual poke at the running app: load a group, see the correct deadline; load results, see correct verdicts; admin panel loads without error.

Only after this, run the drop migration.

---

## Local Verification Workflow

**This workflow is mandatory before every Phase 2, 3, and 4 migration touches production.** Phase 1 migrations are additive-only and may skip the snapshot restore, but must still pass `make test` locally.

The principle: production is never the first environment a migration runs in. A local Postgres seeded with a recent production snapshot catches almost every category of failure (constraint violations, type mismatches, backfill logic errors, orphaned FKs, slow queries) before a user sees it. At this data scale, the full loop takes 15–30 minutes per phase.

### The loop

1. **Snapshot production data.**
   ```bash
   gcloud sql export sql <instance> gs://<bucket>/predeploy-$(date +%Y%m%d-%H%M).sql --database=<db-name>
   gsutil cp gs://<bucket>/predeploy-<timestamp>.sql ./tmp/
   ```
   If gsutil/gcloud aren't available to the agent's environment, use the most recent automatic Cloud SQL backup and export it via the console.

2. **Restore to a clean local DB.**
   ```bash
   make docker-down && make docker-up        # fresh Postgres container
   make migrate-up                           # apply all existing migrations up to current HEAD
   psql "$DEV_DB_URL" < ./tmp/predeploy-<timestamp>.sql
   ```
   The dev DB now mirrors production at the migration baseline this phase will start from.

3. **Run the new migration locally.**
   ```bash
   make migrate-up
   ```
   Watch for errors during the in-transaction invariant checks. If any invariant fails, the migration aborts — investigate before retrying.

4. **Run invariant queries manually.** The migration runs them in-transaction, but the agent also runs them from `psql` after the migration for a visible count report. Compare against expected values.

5. **Run the full Go test suite against the migrated local DB.**
   ```bash
   DB_URL=$DEV_DB_URL make test
   ```
   Any integration test that hits the DB now exercises the new schema. All must pass.

6. **Boot the app against the local DB and smoke-test by hand.**
   ```bash
   make dev
   ```
   At minimum: log in, load a group's detail page (verifies turns render), load results (verifies verdicts render), load the admin panel (verifies the override UI doesn't 500). For Phase 4, also confirm movie metadata still displays and nominating a new film still works end-to-end.

7. **Round-trip the migration.**
   ```bash
   make migrate-down    # one step back
   make migrate-up      # forward again
   ```
   Schema must match after. If `compare-schema.sh` shows drift, the `down` file is broken — fix before proceeding.

8. **Only now, run in production.** Take the Cloud SQL backup (execution rule 2), then apply the migration.

### What this catches

- **CHECK violations from pre-existing data** (surfaces in step 3 as a failed backfill).
- **Week_of text format surprises** (the `::date` cast throws a specific error on bad input).
- **Orphaned FKs** (caught by invariants in step 3 or 4).
- **Queries the service layer didn't know were broken** (caught in step 5).
- **UI paths that silently read a dropped column** (caught in step 6).
- **Broken down migration** (caught in step 7 before it matters in a real rollback).

### What this doesn't catch

- Concurrency issues under real load (not relevant at this scale).
- Data that appears in production between the snapshot and the actual production run — keep the window short (hours, not days). If production changes significantly during verification, re-snapshot.

---



### Primary: Cloud SQL point-in-time recovery

Before any Phase 2, 3, or 4 migration, agent confirms PITR is enabled and notes the pre-migration timestamp. A bad migration is rolled back by restoring to that timestamp — Cloud SQL can do this in minutes.

### Secondary: `down` migration

Every migration has a tested `down`. For pre-drop migrations (2.1, 2.2, 3.1, 3.2, 4.1, 4.2), the down can be run in-place because the deprecated tables still exist. Post-drop, down migrations recreate the table structure but cannot restore data — at that point, restore from PITR.

### Tertiary: manual forward-fix

At hundreds of rows, individual row issues are fixable by hand via `psql`. Agent should prefer a forward-fix over a full rollback when the problem is a single row or a small number of edge cases.

### Incident runbook

1. Detect: post-deploy smoke fails, or a user reports an issue.
2. Triage: is this a code bug against the new schema (fix forward) or a data integrity issue (rollback)?
3. Rollback: trigger PITR, wait ~5 min, redeploy previous Cloud Run revision.
4. Post-mortem: write what went wrong, what the invariant check missed, add a check for next time.

---

## Success Criteria

- [ ] `turns` is the single source for all turn scheduling state
- [ ] `verdicts` is the single source for watch + rating + review
- [ ] `films` is the canonical OMDb cache; `movies` and `nominations` reference by FK
- [ ] `picker_assignments`, `turn_overrides`, `turn_extensions`, `votes`, `watch_status` are dropped
- [ ] Per-pick and per-nomination OMDb columns are dropped from `movies` and `nominations`
- [ ] Every FK has an explicit `ON DELETE`
- [ ] `memberships.role`, `verdicts.rating`, `groups.turn_length_days` have CHECK constraints
- [ ] All hot-path queries have supporting indexes
- [ ] `sqlc generate` compiles; all tests pass
- [ ] Every migration has a tested `up` and `down`
- [ ] `make migrate-roundtrip` passes
- [ ] Every Phase 2–4 migration ran the full Local Verification Workflow before prod
- [ ] Production verified: one group's turn schedule, one user's verdict history, one film's metadata all render correctly post-migration

---

## Out of Scope

- Audit/history tables (event sourcing or temporal preservation). Current behavior is destructive updates; changing this is a product decision.
- Soft deletes. Same — product decision.
- Invite code redesign. See D3.
- Engagement features (reactions, replies, notifications, gamification). Schema supports these by FK'ing to `verdicts.id`, `turns.id`, `films.id`; no work here.

---

## Summary Timeline

| Phase | Name | Migrations | Effort |
|-------|------|-----------|--------|
| 1 | Foundations (indexes, constraints, cascades, avatar col) | 0003–0005 | ~half day |
| 2 | Turn unification (incl. local verification) | 0006–0008 | ~1 day |
| 3 | Verdict unification (incl. local verification) | 0009–0011 | ~1 day |
| 4 | Canonical films (incl. local verification) | 0012–0013 | ~half day |

**Total:** ~3 engineer-days of focused work. Each Phase 2–4 effort estimate includes the ~15–30 minutes of local dry-run verification. No mandatory soak periods — post-migration verification in production is hours, not weeks. The robustness comes from backups + local-dev dry runs + invariants + round-trip tests, none of which require elapsed time.

---

*End of document.*
