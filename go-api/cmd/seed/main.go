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
		{"films", seedFilms},
		{"turns", seedTurns},
		{"movies", seedMovies},
		{"nominations", seedNominations},
		{"verdicts", seedVerdicts},
		{"invites", seedInvites},
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

type filmRow struct {
	ID             int64      `json:"id"`
	ImdbID         string     `json:"imdb_id"`
	Title          string     `json:"title"`
	Year           *int32     `json:"year"`
	PosterURL      *string    `json:"poster_url"`
	Director       *string    `json:"director"`
	Genre          *string    `json:"genre"`
	RuntimeMinutes *int32     `json:"runtime_minutes"`
	OmdbFetchedAt  time.Time  `json:"omdb_fetched_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type turnRow struct {
	ID              int64     `json:"id"`
	GroupID         int32     `json:"group_id"`
	TurnIndex       int32     `json:"turn_index"`
	WeekOf          string    `json:"week_of"`   // "YYYY-MM-DD"
	PickerUserID    int32     `json:"picker_user_id"`
	StartDate       string    `json:"start_date"` // "YYYY-MM-DD"
	EndDate         string    `json:"end_date"`   // "YYYY-MM-DD"
	MovieUnlocked   bool      `json:"movie_unlocked"`
	ReviewsUnlocked bool      `json:"reviews_unlocked"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type movieRow struct {
	ID              int32     `json:"id"`
	GroupID         int32     `json:"group_id"`
	NominatorUserID *int32    `json:"nominator_user_id"`
	FilmID          int64     `json:"film_id"`
	TurnID          int64     `json:"turn_id"`
	CreatedAt       time.Time `json:"created_at"`
}

type nominationRow struct {
	ID        int32     `json:"id"`
	GroupID   int32     `json:"group_id"`
	UserID    int32     `json:"user_id"`
	FilmID    int64     `json:"film_id"`
	CreatedAt time.Time `json:"created_at"`
}

type verdictRow struct {
	ID        int64      `json:"id"`
	TurnID    int64      `json:"turn_id"`
	UserID    int32      `json:"user_id"`
	Watched   bool       `json:"watched"`
	Rating    *float64   `json:"rating"`
	Review    *string    `json:"review"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type inviteRow struct {
	ID              int32      `json:"id"`
	Code            string     `json:"code"`
	GroupID         int32      `json:"group_id"`
	CreatedByUserID int32      `json:"created_by_user_id"`
	ExpiresAt       *time.Time `json:"expires_at"`
	CreatedAt       time.Time  `json:"created_at"`
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

func seedFilms(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[filmRow]("films")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO films (id, imdb_id, title, year, poster_url, director, genre, runtime_minutes, omdb_fetched_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.ImdbID, r.Title, r.Year, r.PosterURL, r.Director, r.Genre, r.RuntimeMinutes, r.OmdbFetchedAt, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert film %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedTurns(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[turnRow]("turns")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO turns (id, group_id, turn_index, week_of, picker_user_id, start_date, end_date,
			                   movie_unlocked, reviews_unlocked, created_at, updated_at)
			VALUES ($1, $2, $3, $4::date, $5, $6::date, $7::date, $8, $9, $10, $11)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.TurnIndex, r.WeekOf, r.PickerUserID,
			r.StartDate, r.EndDate, r.MovieUnlocked, r.ReviewsUnlocked,
			r.CreatedAt, r.UpdatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert turn %d: %w", r.ID, err)
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
			INSERT INTO movies (id, group_id, nominator_user_id, film_id, turn_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.NominatorUserID, r.FilmID, r.TurnID, r.CreatedAt)
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
			INSERT INTO nominations (id, group_id, user_id, film_id, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.GroupID, r.UserID, r.FilmID, r.CreatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert nomination %d: %w", r.ID, err)
		}
	}
	return len(rows), nil
}

func seedVerdicts(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := loadJSON[verdictRow]("verdicts")
	if err != nil {
		return 0, err
	}
	for _, r := range rows {
		_, err := pool.Exec(ctx, `
			INSERT INTO verdicts (id, turn_id, user_id, watched, rating, review, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO NOTHING`,
			r.ID, r.TurnID, r.UserID, r.Watched, r.Rating, r.Review, r.CreatedAt, r.UpdatedAt)
		if err != nil {
			return 0, fmt.Errorf("insert verdict %d: %w", r.ID, err)
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

func truncateAll(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE
			verdicts,
			movies,
			nominations,
			films,
			turns,
			invites,
			memberships,
			groups,
			users
		RESTART IDENTITY CASCADE
	`)
	return err
}

func resetSequences(ctx context.Context, pool *pgxpool.Pool) error {
	seqs := []string{
		`SELECT setval('users_id_seq',        COALESCE((SELECT MAX(id) FROM users), 1))`,
		`SELECT setval('groups_id_seq',        COALESCE((SELECT MAX(id) FROM groups), 1))`,
		`SELECT setval('memberships_id_seq',   COALESCE((SELECT MAX(id) FROM memberships), 1))`,
		`SELECT setval('films_id_seq',         COALESCE((SELECT MAX(id) FROM films), 1))`,
		`SELECT setval('turns_id_seq',         COALESCE((SELECT MAX(id) FROM turns), 1))`,
		`SELECT setval('movies_id_seq',        COALESCE((SELECT MAX(id) FROM movies), 1))`,
		`SELECT setval('nominations_id_seq',   COALESCE((SELECT MAX(id) FROM nominations), 1))`,
		`SELECT setval('verdicts_id_seq',      COALESCE((SELECT MAX(id) FROM verdicts), 1))`,
		`SELECT setval('invites_id_seq',       COALESCE((SELECT MAX(id) FROM invites), 1))`,
	}
	for _, q := range seqs {
		if _, err := pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("%s: %w", q, err)
		}
	}
	return nil
}
