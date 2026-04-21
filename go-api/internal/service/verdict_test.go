package service

import (
	"context"
	"errors"
	"testing"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

func TestVerdictService_Integration(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	authSvc := NewAuthService(testQueries, Config{TimeZone: "America/New_York"})
	groupSvc := NewGroupService(testQueries, Config{})
	verdictSvc := NewVerdictService(testQueries, testPool, Config{TimeZone: "America/New_York"})
	ctx := context.Background()

	username := "testverdict_owner_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	ownerUser, err := authSvc.RegisterUser(ctx, username, "password123")
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	// Use a 365-day turn starting today so voting window is open the whole year.
	group, err := groupSvc.Create(ctx, ownerUser.ID, "Verdict Test Group", "", 365)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	weekOf := group.StartDate.Time.Format("2006-01-02")
	t.Cleanup(func() {
		testPool.Exec(ctx, "DELETE FROM watch_status WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM votes WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM movies WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	imdbID := "tt1234567"
	_, err = testQueries.UpsertMovie(ctx, db.UpsertMovieParams{
		GroupID:     group.ID,
		Title:       "Test Movie",
		WeekOf:      weekOf,
		SetByUserID: &ownerUser.ID,
		ImdbID:      &imdbID,
	})
	if err != nil {
		t.Fatalf("insert movie: %v", err)
	}

	t.Run("mark unwatched", func(t *testing.T) {
		err := verdictSvc.SubmitVerdict(ctx, ownerUser.ID, group.ID, weekOf, false, nil, nil)
		if err != nil {
			t.Fatalf("SubmitVerdict (unwatched): %v", err)
		}
	})

	t.Run("mark watched without rating", func(t *testing.T) {
		err := verdictSvc.SubmitVerdict(ctx, ownerUser.ID, group.ID, weekOf, true, nil, nil)
		if err != nil {
			t.Fatalf("SubmitVerdict (watched, no rating): %v", err)
		}
	})

	t.Run("submit with rating and review", func(t *testing.T) {
		rating := 8.5
		review := "great film"
		err := verdictSvc.SubmitVerdict(ctx, ownerUser.ID, group.ID, weekOf, true, &rating, &review)
		if err != nil {
			t.Fatalf("SubmitVerdict (with rating): %v", err)
		}
	})

	t.Run("invalid rating rejected", func(t *testing.T) {
		invalid := 11.0
		err := verdictSvc.SubmitVerdict(ctx, ownerUser.ID, group.ID, weekOf, true, &invalid, nil)
		if err == nil {
			t.Error("expected error for rating > 10")
		}
	})

	t.Run("delete verdict", func(t *testing.T) {
		err := verdictSvc.DeleteVerdict(ctx, ownerUser.ID, group.ID, weekOf)
		if err != nil {
			t.Fatalf("DeleteVerdict: %v", err)
		}
	})

	t.Run("non-member forbidden", func(t *testing.T) {
		rating := 7.0
		err := verdictSvc.SubmitVerdict(ctx, 999999, group.ID, weekOf, true, &rating, nil)
		if !errors.Is(err, ErrForbidden) {
			t.Errorf("non-member: got %v, want ErrForbidden", err)
		}
	})

	t.Run("delete verdict non-member forbidden", func(t *testing.T) {
		err := verdictSvc.DeleteVerdict(ctx, 999999, group.ID, weekOf)
		if !errors.Is(err, ErrForbidden) {
			t.Errorf("non-member delete: got %v, want ErrForbidden", err)
		}
	})

	t.Run("delete verdict group not found", func(t *testing.T) {
		err := verdictSvc.DeleteVerdict(ctx, ownerUser.ID, 999999, weekOf)
		if !errors.Is(err, ErrNotFound) {
			t.Errorf("non-existent group: got %v, want ErrNotFound", err)
		}
	})

	t.Run("submit verdict group not found", func(t *testing.T) {
		rating := 7.0
		err := verdictSvc.SubmitVerdict(ctx, ownerUser.ID, 999999, weekOf, true, &rating, nil)
		if !errors.Is(err, ErrNotFound) {
			t.Errorf("non-existent group: got %v, want ErrNotFound", err)
		}
	})

	t.Run("submit verdict no movie set", func(t *testing.T) {
		// Use a weekOf with no movie.
		err := verdictSvc.SubmitVerdict(ctx, ownerUser.ID, group.ID, "2099-01-01", false, nil, nil)
		if err == nil || errors.Is(err, ErrForbidden) || errors.Is(err, ErrNotFound) {
			t.Errorf("expected 'no movie set' error, got %v", err)
		}
	})
}

// TestVerdictService_GetVerdicts_ResultsAvailable uses a past group so results are available.
func TestVerdictService_GetVerdicts_ResultsAvailable(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	authSvc := NewAuthService(testQueries, Config{TimeZone: "America/New_York"})
	groupSvc := NewGroupService(testQueries, Config{})
	verdictSvc := NewVerdictService(testQueries, testPool, Config{TimeZone: "America/New_York"})
	ctx := context.Background()

	username := "testverdict_get_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	ownerUser, err := authSvc.RegisterUser(ctx, username, "password123")
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	// Past start date with short turn — results are already available.
	group, err := groupSvc.Create(ctx, ownerUser.ID, "Verdict Get Group", "2024-01-01", 7)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	weekOf := "2024-01-01"
	t.Cleanup(func() {
		testPool.Exec(ctx, "DELETE FROM watch_status WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM votes WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM movies WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	imdbID := "tt9999999"
	if _, err = testQueries.UpsertMovie(ctx, db.UpsertMovieParams{
		GroupID: group.ID, Title: "Old Movie", WeekOf: weekOf,
		SetByUserID: &ownerUser.ID, ImdbID: &imdbID,
	}); err != nil {
		t.Fatalf("insert movie: %v", err)
	}

	// Insert vote and watch status directly (voting is closed, can't use SubmitVerdict).
	rating := float32(7.5)
	_, err = testPool.Exec(ctx,
		"INSERT INTO watch_status (user_id, group_id, week_of, watched) VALUES ($1,$2,$3,true) ON CONFLICT DO NOTHING",
		ownerUser.ID, group.ID, weekOf,
	)
	if err != nil {
		t.Fatalf("insert watch_status: %v", err)
	}
	_, err = testPool.Exec(ctx,
		"INSERT INTO votes (user_id, group_id, rating, week_of) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
		ownerUser.ID, group.ID, rating, weekOf,
	)
	if err != nil {
		t.Fatalf("insert vote: %v", err)
	}

	verdicts, err := verdictSvc.GetVerdicts(ctx, ownerUser.ID, group.ID, weekOf)
	if err != nil {
		t.Fatalf("GetVerdicts: %v", err)
	}
	if len(verdicts) == 0 {
		t.Error("expected at least one verdict")
	}

	// Non-member cannot get verdicts.
	_, err = verdictSvc.GetVerdicts(ctx, 999999, group.ID, weekOf)
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("non-member GetVerdicts: got %v, want ErrForbidden", err)
	}

	// Group not found.
	_, err = verdictSvc.GetVerdicts(ctx, ownerUser.ID, 999999, weekOf)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("non-existent group GetVerdicts: got %v, want ErrNotFound", err)
	}
}

func TestVerdictService_MarkWatched(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	authSvc := NewAuthService(testQueries, Config{})
	groupSvc := NewGroupService(testQueries, Config{})
	verdictSvc := NewVerdictService(testQueries, testPool, Config{TimeZone: "America/New_York"})
	ctx := context.Background()

	username := "testverdict_mw_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	ownerUser, err := authSvc.RegisterUser(ctx, username, "password123")
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	group, err := groupSvc.Create(ctx, ownerUser.ID, "MarkWatched Group", "", 365)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	weekOf := group.StartDate.Time.Format("2006-01-02")
	t.Cleanup(func() {
		testPool.Exec(ctx, "DELETE FROM watch_status WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	if err := verdictSvc.MarkWatched(ctx, ownerUser.ID, group.ID, weekOf, true); err != nil {
		t.Fatalf("MarkWatched: %v", err)
	}

	// Empty weekOf uses current week via BuildTurnConfig.
	if err := verdictSvc.MarkWatched(ctx, ownerUser.ID, group.ID, "", false); err != nil {
		t.Fatalf("MarkWatched (empty weekOf): %v", err)
	}

	// Non-member gets ErrForbidden.
	if err := verdictSvc.MarkWatched(ctx, 999999, group.ID, weekOf, true); !errors.Is(err, ErrForbidden) {
		t.Errorf("non-member: got %v, want ErrForbidden", err)
	}

	// Group not found.
	if err := verdictSvc.MarkWatched(ctx, ownerUser.ID, 999999, weekOf, true); !errors.Is(err, ErrNotFound) {
		t.Errorf("non-existent group: got %v, want ErrNotFound", err)
	}
}
