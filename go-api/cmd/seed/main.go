// Seed command: imports data from embedded JSON files into the database.
// Run against any DATABASE_URL — local dev, Cloud SQL, etc.
//
//	DATABASE_URL="postgres://..." go run ./cmd/seed
//	DATABASE_URL="postgres://..." go run ./cmd/seed -reset   # truncate all tables first
package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed data/*.json
var dataFS embed.FS

func main() {
	reset := flag.Bool("reset", false, "truncate all tables before seeding")
	flag.Parse()

	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		slog.Error("failed to connect", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}

	if *reset {
		if err := truncateAll(ctx, pool); err != nil {
			slog.Error("failed to truncate tables", "error", err)
			os.Exit(1)
		}
		slog.Info("all tables truncated")
	}

	steps := []struct {
		name string
		fn   func(context.Context, *pgxpool.Pool) (int, error)
	}{
		{"users", seedUsers},
		{"groups", seedGroups},
		{"memberships", seedMemberships},
		{"movies", seedMovies},
		{"nominations", seedNominations},
		{"invites", seedInvites},
		{"picker_assignments", seedPickerAssignments},
		{"votes", seedVotes},
		{"watch_status", seedWatchStatus},
		{"turn_extensions", seedTurnExtensions},
		{"turn_overrides", seedTurnOverrides},
	}

	for _, s := range steps {
		n, err := s.fn(ctx, pool)
		if err != nil {
			slog.Error("seed failed", "table", s.name, "error", err)
			os.Exit(1)
		}
		slog.Info("seeded", "table", s.name, "rows", n)
	}

	if err := resetSequences(ctx, pool); err != nil {
		slog.Error("failed to reset sequences", "error", err)
		os.Exit(1)
	}
	slog.Info("sequences reset")
	slog.Info("seed complete")
}

// ── JSON row types ────────────────────────────────────────────────────────────

type userRow struct {
	ID           int32     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash *string   `json:"password_hash"`
	CreatedAt    time.Time `json:"created_at"`
}

type groupRow struct {
	ID             int32     `json:"id"`
	Name           string    `json:"name"`
	OwnerID        int32     `json:"owner_id"`
	CreatedAt      time.Time `json:"created_at"`
	StartDate      string    `json:"start_date"` // "YYYY-MM-DD"
	TurnLengthDays int32     `json:"turn_length_days"`
}

type membershipRow struct {
	ID       int32     `json:"id"`
	UserID   int32     `json:"user_id"`
	GroupID  int32     `json:"group_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type movieRow struct {
	ID              int32     `json:"id"`
	GroupID         int32     `json:"group_id"`
	Title           string    `json:"title"`
	WeekOf          string    `json:"week_of"`
	SetByUserID     *int32    `json:"set_by_user_id"`
	NominatorUserID *int32    `json:"nominator_user_id"`
	ImdbID          *string   `json:"imdb_id"`
	Poster          *string   `json:"poster"`
	Director        *string   `json:"director"`
	Genre           *string   `json:"genre"`
	Runtime         *string   `json:"runtime"`
	Year            *string   `json:"year"`
	CreatedAt       time.Time `json:"created_at"`
}

type nominationRow struct {
	ID        int32     `json:"id"`
	GroupID   int32     `json:"group_id"`
	UserID    int32     `json:"user_id"`
	ImdbID    string    `json:"imdb_id"`
	Title     string    `json:"title"`
	Year      *string   `json:"year"`
	Poster    *string   `json:"poster"`
	CreatedAt time.Time `json:"created_at"`
}

type inviteRow struct {
	ID              int32      `json:"id"`
	Code            string     `json:"code"`
	GroupID         int32      `json:"group_id"`
	CreatedByUserID int32      `json:"created_by_user_id"`
	ExpiresAt       *time.Time `json:"expires_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

type pickerAssignmentRow struct {
	ID        int32     `json:"id"`
	GroupID   int32     `json:"group_id"`
	UserID    int32     `json:"user_id"`
	WeekOf    string    `json:"week_of"`
	CreatedAt time.Time `json:"created_at"`
}

type voteRow struct {
	ID        int32     `json:"id"`
	UserID    int32     `json:"user_id"`
	GroupID   int32     `json:"group_id"`
	Rating    float32   `json:"rating"`
	Review    *string   `json:"review"`
	WeekOf    string    `json:"week_of"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type watchStatusRow struct {
	ID        int32     `json:"id"`
	UserID    int32     `json:"user_id"`
	GroupID   int32     `json:"group_id"`
	WeekOf    string    `json:"week_of"`
	Watched   bool      `json:"watched"`
	UpdatedAt time.Time `json:"updated_at"`
}

type turnExtensionRow struct {
	ID        int32     `json:"id"`
	GroupID   int32     `json:"group_id"`
	TurnIndex int32     `json:"turn_index"`
	ExtraDays int32     `json:"extra_days"`
	CreatedAt time.Time `json:"created_at"`
}

type turnOverrideRow struct {
	ID                    int32     `json:"id"`
	GroupID               int32     `json:"group_id"`
	WeekOf                string    `json:"week_of"` // "YYYY-MM-DD"
	ReviewUnlockedByAdmin bool      `json:"review_unlocked_by_admin"`
	MovieUnlockedByAdmin  bool      `json:"movie_unlocked_by_admin"`
	ExtendedDays          int32     `json:"extended_days"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func loadJSON[T any](name string) ([]T, error) {
	b, err := dataFS.ReadFile("data/" + name + ".json")
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", name, err)
	}
	var rows []T
	if err := json.Unmarshal(b, &rows); err != nil {
		return nil, fmt.Errorf("parse %s: %w", name, err)
	}
	return rows, nil
}

// ── Seed functions ────────────────────────────────────────────────────────────

func seedUsers(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[userRow]("users")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO users (id, username, password_hash, created_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.Username, r.PasswordHash, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert user %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedGroups(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[groupRow]("groups")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO groups (id, name, owner_id, created_at, start_date, turn_length_days)
			VALUES ($1, $2, $3, $4, $5::date, $6)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.Name, r.OwnerID, r.CreatedAt, r.StartDate, r.TurnLengthDays)
		if err != nil {
			return 0, fmt.Errorf("insert group %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedMemberships(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[membershipRow]("memberships")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO memberships (id, user_id, group_id, role, joined_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.UserID, r.GroupID, r.Role, r.JoinedAt)
		if err != nil {
			return 0, fmt.Errorf("insert membership %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedMovies(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[movieRow]("movies")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO movies (id, group_id, title, week_of, set_by_user_id, nominator_user_id,
			                    imdb_id, poster, director, genre, runtime, year, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.Title, r.WeekOf, r.SetByUserID, r.NominatorUserID,
			r.ImdbID, r.Poster, r.Director, r.Genre, r.Runtime, r.Year, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert movie %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedNominations(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[nominationRow]("nominations")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO nominations (id, group_id, user_id, imdb_id, title, year, poster, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.UserID, r.ImdbID, r.Title, r.Year, r.Poster, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert nomination %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedInvites(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[inviteRow]("invites")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO invites (id, code, group_id, created_by_user_id, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.Code, r.GroupID, r.CreatedByUserID, r.ExpiresAt, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert invite %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedPickerAssignments(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[pickerAssignmentRow]("picker_assignments")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO picker_assignments (id, group_id, user_id, week_of, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.UserID, r.WeekOf, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert picker_assignment %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedVotes(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[voteRow]("votes")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO votes (id, user_id, group_id, rating, review, week_of, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.UserID, r.GroupID, r.Rating, r.Review, r.WeekOf, r.CreatedAt, r.UpdatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert vote %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedWatchStatus(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[watchStatusRow]("watch_status")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO watch_status (id, user_id, group_id, week_of, watched, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.UserID, r.GroupID, r.WeekOf, r.Watched, r.UpdatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert watch_status %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedTurnExtensions(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[turnExtensionRow]("turn_extensions")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO turn_extensions (id, group_id, turn_index, extra_days, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.TurnIndex, r.ExtraDays, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert turn_extension %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedTurnOverrides(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[turnOverrideRow]("turn_overrides")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO turn_overrides (id, group_id, week_of, review_unlocked_by_admin,
			                           movie_unlocked_by_admin, extended_days, updated_at)
			VALUES ($1, $2, $3::date, $4, $5, $6, $7)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.WeekOf, r.ReviewUnlockedByAdmin,
			r.MovieUnlockedByAdmin, r.ExtendedDays, r.UpdatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert turn_override %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func truncateAll(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE
			turn_overrides,
			turn_extensions,
			watch_status,
			votes,
			picker_assignments,
			invites,
			nominations,
			movies,
			memberships,
			groups,
			users
		RESTART IDENTITY CASCADE
	`)
	return err
}

func resetSequences(ctx context.Context, pool *pgxpool.Pool) error {
	seqs := []string{
		`SELECT setval('users_id_seq',              COALESCE((SELECT MAX(id) FROM users), 1))`,
		`SELECT setval('groups_id_seq',             COALESCE((SELECT MAX(id) FROM groups), 1))`,
		`SELECT setval('memberships_id_seq',        COALESCE((SELECT MAX(id) FROM memberships), 1))`,
		`SELECT setval('movies_id_seq',             COALESCE((SELECT MAX(id) FROM movies), 1))`,
		`SELECT setval('nominations_id_seq',        COALESCE((SELECT MAX(id) FROM nominations), 1))`,
		`SELECT setval('invites_id_seq',            COALESCE((SELECT MAX(id) FROM invites), 1))`,
		`SELECT setval('picker_assignments_id_seq', COALESCE((SELECT MAX(id) FROM picker_assignments), 1))`,
		`SELECT setval('votes_id_seq',              COALESCE((SELECT MAX(id) FROM votes), 1))`,
		`SELECT setval('watch_status_id_seq',       COALESCE((SELECT MAX(id) FROM watch_status), 1))`,
		`SELECT setval('turn_extensions_id_seq',    COALESCE((SELECT MAX(id) FROM turn_extensions), 1))`,
		`SELECT setval('turn_overrides_id_seq',     COALESCE((SELECT MAX(id) FROM turn_overrides), 1))`,
	}
	for _, q := range seqs {
		if _, err := pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("%s: %w", q, err)
		}
	}
	return nil
}
