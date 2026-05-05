// reset-password updates a user's password in the database.
//
// Usage:
//
//	go run ./cmd/reset-password <env> <username> <new-password>
//
// env must be "dev" or "prod".
// For prod, the Cloud SQL Auth Proxy must be running first (make db-proxy).
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) != 4 {
		fmt.Fprintf(os.Stderr, "usage: reset-password <env> <username> <new-password>\n")
		fmt.Fprintf(os.Stderr, "  env: dev | prod\n")
		os.Exit(1)
	}

	env := os.Args[1]
	username := os.Args[2]
	newPassword := os.Args[3]

	if env != "dev" && env != "prod" {
		fmt.Fprintf(os.Stderr, "error: env must be \"dev\" or \"prod\", got %q\n", env)
		os.Exit(1)
	}

	dbURL := resolveDBURL(env)

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "error: could not reach database: %v\n", err)
		if env == "prod" {
			fmt.Fprintf(os.Stderr, "hint: is the Cloud SQL proxy running? (make db-proxy)\n")
		}
		os.Exit(1)
	}

	// Verify the user exists before hashing.
	var userID int32
	err = pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1`, username).Scan(&userID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: user %q not found\n", username)
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to hash password: %v\n", err)
		os.Exit(1)
	}

	tag, err := pool.Exec(ctx,
		`UPDATE users SET password_hash = $1 WHERE id = $2`,
		string(hash), userID,
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to update password: %v\n", err)
		os.Exit(1)
	}

	if tag.RowsAffected() == 0 {
		fmt.Fprintf(os.Stderr, "error: no rows updated\n")
		os.Exit(1)
	}

	fmt.Printf("password updated for user %q (id=%d) in %s\n", username, userID, env)
}

func resolveDBURL(env string) string {
	if env == "dev" {
		if url := os.Getenv("DEV_DB_URL"); url != "" {
			return url
		}
		return "postgres://dev:dev@localhost:5433/movieclub?sslmode=disable"
	}

	// prod: connect via Cloud SQL Auth Proxy (make db-proxy runs it on :5454)
	user := os.Getenv("CLOUDSQL_ADMIN_USER")
	pass := os.Getenv("CLOUDSQL_ADMIN_PASS")
	if user == "" || pass == "" {
		fmt.Fprintf(os.Stderr, "error: CLOUDSQL_ADMIN_USER and CLOUDSQL_ADMIN_PASS must be set for prod\n")
		os.Exit(1)
	}
	return fmt.Sprintf("postgres://%s:%s@localhost:5454/movieclub?sslmode=disable", user, pass)
}
