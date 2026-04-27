package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

var (
	testPool    *pgxpool.Pool
	testQueries *db.Queries
)

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DB_URL")
	if dbURL == "" {
		dbURL = "postgres://dev:dev@localhost:5433/movieclub_test?sslmode=disable"
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil || pool.Ping(context.Background()) != nil {
		// No test DB available — run unit tests only, skip integration tests.
		os.Exit(m.Run())
	}

	pgxURL := strings.Replace(dbURL, "postgres://", "pgx5://", 1)
	pgxURL = strings.Replace(pgxURL, "postgresql://", "pgx5://", 1)

	// Determine migration path (relative to go-api root)
	migDir := os.Getenv("MIGRATION_DIR")
	if migDir == "" {
		migDir = "../../migrations" // relative from internal/service
	}
	// Try absolute path from CWD
	if _, err := os.Stat(migDir); err != nil {
		migDir = "migrations"
	}

	if mg, err := migrate.New("file://"+migDir, pgxURL); err == nil {
		if upErr := mg.Up(); upErr != nil && !errors.Is(upErr, migrate.ErrNoChange) {
			fmt.Fprintf(os.Stderr, "migration failed: %v\n", upErr)
			os.Exit(1)
		}
		mg.Close()
	}

	testPool = pool
	testQueries = db.New(pool)

	code := m.Run()
	pool.Close()
	os.Exit(code)
}

// cleanUsers removes test users and all their FK-dependent data.
func cleanUsers(t *testing.T, usernames ...string) {
	t.Helper()
	if testPool == nil {
		return
	}
	ctx := context.Background()
	for _, u := range usernames {
		// Delete in FK dependency order: leaf tables first, then users.
		stmts := []string{
			`DELETE FROM verdicts WHERE turn_id IN (SELECT id FROM turns WHERE group_id IN (SELECT id FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1)))`,
			`DELETE FROM verdicts WHERE user_id = (SELECT id FROM users WHERE username = $1)`,
			`DELETE FROM turns WHERE group_id IN (SELECT id FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1))`,
			`DELETE FROM nominations WHERE group_id IN (SELECT id FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1))`,
			`DELETE FROM movies WHERE group_id IN (SELECT id FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1))`,
			`DELETE FROM invites WHERE group_id IN (SELECT id FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1))`,
			`DELETE FROM memberships WHERE group_id IN (SELECT id FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1))`,
			`DELETE FROM groups WHERE owner_id = (SELECT id FROM users WHERE username = $1)`,
			`DELETE FROM memberships WHERE user_id = (SELECT id FROM users WHERE username = $1)`,
			`DELETE FROM nominations WHERE user_id = (SELECT id FROM users WHERE username = $1)`,
			`DELETE FROM users WHERE username = $1`,
		}
		for _, stmt := range stmts {
			testPool.Exec(ctx, stmt, u)
		}
	}
}

func TestAuthService_Integration_Register(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	svc := NewAuthService(testQueries, Config{})
	ctx := context.Background()
	username := "testuser_register_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	user, err := svc.RegisterUser(ctx, username, "password123")
	if err != nil {
		t.Fatalf("RegisterUser failed: %v", err)
	}
	if user.Username != username {
		t.Errorf("got username %q, want %q", user.Username, username)
	}

	// Duplicate registration returns ErrUsernameTaken.
	_, err = svc.RegisterUser(ctx, username, "password123")
	if !errors.Is(err, ErrUsernameTaken) {
		t.Errorf("duplicate register: got %v, want ErrUsernameTaken", err)
	}
}

func TestAuthService_Integration_Login(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	svc := NewAuthService(testQueries, Config{})
	ctx := context.Background()
	username := "testuser_login_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	if _, err := svc.RegisterUser(ctx, username, "securepass"); err != nil {
		t.Fatalf("setup RegisterUser failed: %v", err)
	}

	user, err := svc.Login(ctx, username, "securepass")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if user.Username != username {
		t.Errorf("got username %q, want %q", user.Username, username)
	}

	_, err = svc.Login(ctx, username, "wrongpass")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("wrong password: got %v, want ErrInvalidCredentials", err)
	}

	_, err = svc.Login(ctx, "nonexistent_user_xyz", "pass")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("unknown user: got %v, want ErrInvalidCredentials", err)
	}
}

func TestAuthService_Integration_UpdatePassword(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	svc := NewAuthService(testQueries, Config{})
	ctx := context.Background()
	username := "testuser_pwd_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	user, err := svc.RegisterUser(ctx, username, "oldpassword")
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	// Wrong current password returns ErrInvalidCredentials.
	if err := svc.UpdatePassword(ctx, user.ID, "wrongpass", "newpassword"); !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("wrong current password: got %v, want ErrInvalidCredentials", err)
	}

	// Correct flow.
	if err := svc.UpdatePassword(ctx, user.ID, "oldpassword", "newpassword"); err != nil {
		t.Fatalf("UpdatePassword: %v", err)
	}

	// Can now login with new password.
	if _, err := svc.Login(ctx, username, "newpassword"); err != nil {
		t.Fatalf("login with new password: %v", err)
	}
}

func TestAuthService_Integration_UpdateUsername(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	svc := NewAuthService(testQueries, Config{})
	ctx := context.Background()
	original := "testuser_origname_int"
	newname := "testuser_newname_int"
	conflict := "testuser_conflict_int"
	cleanUsers(t, original, newname, conflict)
	t.Cleanup(func() { cleanUsers(t, original, newname, conflict) })

	user, err := svc.RegisterUser(ctx, original, "password123")
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}
	// Create a second user to test conflict.
	if _, err := svc.RegisterUser(ctx, conflict, "password123"); err != nil {
		t.Fatalf("setup conflict user failed: %v", err)
	}

	updated, err := svc.UpdateUsername(ctx, user.ID, newname)
	if err != nil {
		t.Fatalf("UpdateUsername failed: %v", err)
	}
	if updated.Username != newname {
		t.Errorf("got %q, want %q", updated.Username, newname)
	}

	// Updating to an existing username returns ErrUsernameTaken.
	_, err = svc.UpdateUsername(ctx, user.ID, conflict)
	if !errors.Is(err, ErrUsernameTaken) {
		t.Errorf("conflict: got %v, want ErrUsernameTaken", err)
	}
}
