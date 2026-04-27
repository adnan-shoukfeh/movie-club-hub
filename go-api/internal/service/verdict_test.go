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
		testPool.Exec(ctx, "DELETE FROM verdicts WHERE turn_id IN (SELECT id FROM turns WHERE group_id = $1)", group.ID)
		testPool.Exec(ctx, "DELETE FROM turns WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM movies WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	// Create a film first
	film, err := testQueries.UpsertFilm(ctx, db.UpsertFilmParams{
		ImdbID: "tt1234567",
		Title:  "Test Movie",
	})
	if err != nil {
		t.Fatalf("create film: %v", err)
	}

	// Create a turn for this week
	turn, err := testQueries.UpsertTurn(ctx, db.UpsertTurnParams{
		GroupID:      group.ID,
		TurnIndex:    0,
		WeekOf:       timeToPgDate(weekOf),
		PickerUserID: ownerUser.ID,
		StartDate:    timeToPgDate(weekOf),
		EndDate:      timeToPgDate(weekOf), // Will be extended by turn_length_days
	})
	if err != nil {
		t.Fatalf("create turn: %v", err)
	}

	// Create the movie with film_id and turn_id
	_, err = testQueries.UpsertMovie(ctx, db.UpsertMovieParams{
		GroupID: group.ID,
		TurnID:  turn.ID,
		FilmID:  film.ID,
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
		testPool.Exec(ctx, "DELETE FROM verdicts WHERE turn_id IN (SELECT id FROM turns WHERE group_id = $1)", group.ID)
		testPool.Exec(ctx, "DELETE FROM turns WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM movies WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	// Create a film
	film, err := testQueries.UpsertFilm(ctx, db.UpsertFilmParams{
		ImdbID: "tt9999999",
		Title:  "Old Movie",
	})
	if err != nil {
		t.Fatalf("create film: %v", err)
	}

	// Create a turn for the weekOf
	turn, err := testQueries.UpsertTurn(ctx, db.UpsertTurnParams{
		GroupID:      group.ID,
		TurnIndex:    0,
		WeekOf:       timeToPgDate(weekOf),
		PickerUserID: ownerUser.ID,
		StartDate:    timeToPgDate(weekOf),
		EndDate:      timeToPgDate("2024-01-07"),
	})
	if err != nil {
		t.Fatalf("create turn: %v", err)
	}

	// Create the movie with film_id and turn_id
	_, err = testQueries.UpsertMovie(ctx, db.UpsertMovieParams{
		GroupID: group.ID,
		TurnID:  turn.ID,
		FilmID:  film.ID,
	})
	if err != nil {
		t.Fatalf("insert movie: %v", err)
	}

	// Insert verdict directly (voting is closed, can't use SubmitVerdict).
	rating := float32(7.5)
	_, err = testPool.Exec(ctx,
		"INSERT INTO verdicts (turn_id, user_id, watched, rating) VALUES ($1,$2,true,$3) ON CONFLICT DO NOTHING",
		turn.ID, ownerUser.ID, rating,
	)
	if err != nil {
		t.Fatalf("insert verdict: %v", err)
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
		testPool.Exec(ctx, "DELETE FROM verdicts WHERE turn_id IN (SELECT id FROM turns WHERE group_id = $1)", group.ID)
		testPool.Exec(ctx, "DELETE FROM turns WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	if err := verdictSvc.MarkWatched(ctx, ownerUser.ID, group.ID, weekOf, true); err != nil {
		t.Fatalf("MarkWatched: %v", err)
	}

	// GetWatchStatuses (read path used by group detail / status handlers) must
	// reflect the write. Regression guard for the bug where the read path used
	// a deprecated watch_status table while writes went to verdicts.
	statuses, err := testQueries.GetWatchStatuses(ctx, db.GetWatchStatusesParams{
		GroupID: group.ID, WeekOf: timeToPgDate(weekOf),
	})
	if err != nil {
		t.Fatalf("GetWatchStatuses: %v", err)
	}
	var got *bool
	for _, s := range statuses {
		if s.UserID == ownerUser.ID {
			v := s.Watched
			got = &v
			break
		}
	}
	if got == nil || !*got {
		t.Fatalf("GetWatchStatuses after MarkWatched(true): want watched=true, got %v", got)
	}

	// Toggling back to false must also be observable via the read path.
	if err := verdictSvc.MarkWatched(ctx, ownerUser.ID, group.ID, weekOf, false); err != nil {
		t.Fatalf("MarkWatched(false): %v", err)
	}
	statuses, err = testQueries.GetWatchStatuses(ctx, db.GetWatchStatusesParams{
		GroupID: group.ID, WeekOf: timeToPgDate(weekOf),
	})
	if err != nil {
		t.Fatalf("GetWatchStatuses: %v", err)
	}
	for _, s := range statuses {
		if s.UserID == ownerUser.ID && s.Watched {
			t.Fatalf("GetWatchStatuses after MarkWatched(false): expected watched=false")
		}
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
