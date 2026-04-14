// prune-movies removes movies that don't align with their group's turn schedule,
// along with any orphaned votes and watch_status rows that reference those movies.
//
// Default mode is a dry-run that prints what would be deleted.
// Pass -execute to actually apply the deletions.
//
//	DATABASE_URL="postgres://..." go run ./cmd/prune-movies
//	DATABASE_URL="postgres://..." go run ./cmd/prune-movies -execute
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	execute := flag.Bool("execute", false, "delete the identified rows (default is dry-run)")
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

	orphans, err := findOrphanMovies(ctx, pool)
	if err != nil {
		slog.Error("query failed", "error", err)
		os.Exit(1)
	}

	if len(orphans) == 0 {
		slog.Info("no orphaned movies found — nothing to do")
		return
	}

	printOrphans(orphans)

	if !*execute {
		fmt.Println()
		fmt.Println("Dry run — no changes made. Re-run with -execute to apply.")
		return
	}

	fmt.Println()
	if err := deleteOrphans(ctx, pool, orphans); err != nil {
		slog.Error("deletion failed", "error", err)
		os.Exit(1)
	}
	slog.Info("done")
}

// ── Types ─────────────────────────────────────────────────────────────────────

type orphanMovie struct {
	ID          int32
	Title       string
	WeekOf      string
	GroupID     int32
	GroupName   string
	VoteCount   int
	WatchCount  int
}

// ── Queries ───────────────────────────────────────────────────────────────────

// findOrphanMovies returns movies whose week_of does not fall on a valid turn
// boundary for their group (start_date + n * turn_length_days).
func findOrphanMovies(ctx context.Context, pool *pgxpool.Pool) ([]orphanMovie, error) {
	rows, err := pool.Query(ctx, `
		SELECT
			m.id,
			m.title,
			m.week_of,
			m.group_id,
			g.name,
			(SELECT COUNT(*) FROM votes       v WHERE v.group_id = m.group_id AND v.week_of = m.week_of) AS vote_count,
			(SELECT COUNT(*) FROM watch_status ws WHERE ws.group_id = m.group_id AND ws.week_of = m.week_of) AS watch_count
		FROM movies m
		JOIN groups g ON g.id = m.group_id
		WHERE
			-- Before the group start date
			m.week_of::date < g.start_date
			OR
			-- Not on a turn boundary: (week_of - start_date) is not a multiple of turn_length_days
			(m.week_of::date - g.start_date) % g.turn_length_days != 0
		ORDER BY m.group_id, m.week_of
	`)
	if err != nil {
		return nil, fmt.Errorf("query orphan movies: %w", err)
	}
	defer rows.Close()

	var orphans []orphanMovie
	for rows.Next() {
		var o orphanMovie
		if err := rows.Scan(&o.ID, &o.Title, &o.WeekOf, &o.GroupID, &o.GroupName, &o.VoteCount, &o.WatchCount); err != nil {
			return nil, err
		}
		orphans = append(orphans, o)
	}
	return orphans, rows.Err()
}

func deleteOrphans(ctx context.Context, pool *pgxpool.Pool, orphans []orphanMovie) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, o := range orphans {
		// Delete votes for this movie's week (no FK, just denormalised week_of)
		tag, err := tx.Exec(ctx,
			`DELETE FROM votes WHERE group_id = $1 AND week_of = $2`,
			o.GroupID, o.WeekOf)
		if err != nil {
			return fmt.Errorf("delete votes for movie %d: %w", o.ID, err)
		}
		slog.Info("deleted votes", "movie_id", o.ID, "week_of", o.WeekOf, "rows", tag.RowsAffected())

		// Delete watch_status for this movie's week
		tag, err = tx.Exec(ctx,
			`DELETE FROM watch_status WHERE group_id = $1 AND week_of = $2`,
			o.GroupID, o.WeekOf)
		if err != nil {
			return fmt.Errorf("delete watch_status for movie %d: %w", o.ID, err)
		}
		slog.Info("deleted watch_status", "movie_id", o.ID, "week_of", o.WeekOf, "rows", tag.RowsAffected())

		// Delete the movie itself
		_, err = tx.Exec(ctx, `DELETE FROM movies WHERE id = $1`, o.ID)
		if err != nil {
			return fmt.Errorf("delete movie %d: %w", o.ID, err)
		}
		slog.Info("deleted movie", "id", o.ID, "title", o.Title, "week_of", o.WeekOf)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ── Display ───────────────────────────────────────────────────────────────────

func printOrphans(orphans []orphanMovie) {
	fmt.Printf("Found %d orphaned movie(s) not on a valid turn boundary:\n\n", len(orphans))

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	fmt.Fprintln(w, "ID\tTitle\tWeek Of\tGroup\tVotes\tWatch Status")
	fmt.Fprintln(w, strings.Repeat("-", 70))
	for _, o := range orphans {
		fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%d\t%d\n",
			o.ID, o.Title, o.WeekOf, o.GroupName, o.VoteCount, o.WatchCount)
	}
	w.Flush()
}
