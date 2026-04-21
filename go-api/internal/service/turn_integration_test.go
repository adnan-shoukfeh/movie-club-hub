package service

import (
	"testing"
)

func TestTurnService_Integration(t *testing.T) {
	if testQueries == nil {
		t.Skip("no test database available")
	}
	authSvc := NewAuthService(testQueries, Config{TimeZone: "America/New_York"})
	groupSvc := NewGroupService(testQueries, Config{})
	turnSvc := NewTurnService(testQueries, Config{TimeZone: "America/New_York"})
	ctx := t.Context()

	username := "testturn_owner_int"
	cleanUsers(t, username)
	t.Cleanup(func() { cleanUsers(t, username) })

	ownerUser, err := authSvc.RegisterUser(ctx, username, "password123")
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	group, err := groupSvc.Create(ctx, ownerUser.ID, "Turn Test Group", "2024-01-01", 7)
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(ctx, "DELETE FROM picker_assignments WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM memberships WHERE group_id = $1", group.ID)
		testPool.Exec(ctx, "DELETE FROM groups WHERE id = $1", group.ID)
	})

	dbGroup, err := testQueries.GetGroupByID(ctx, group.ID)
	if err != nil {
		t.Fatalf("GetGroupByID: %v", err)
	}

	t.Run("BuildTurnConfig", func(t *testing.T) {
		cfg, err := turnSvc.BuildTurnConfig(ctx, dbGroup)
		if err != nil {
			t.Fatalf("BuildTurnConfig: %v", err)
		}
		if cfg.StartDate != "2024-01-01" {
			t.Errorf("got StartDate %q, want 2024-01-01", cfg.StartDate)
		}
		if cfg.TurnLengthDays != 7 {
			t.Errorf("got TurnLengthDays %d, want 7", cfg.TurnLengthDays)
		}
	})

	t.Run("GetEffectiveDeadline", func(t *testing.T) {
		deadline, err := turnSvc.GetEffectiveDeadline(ctx, group.ID, "2024-01-01")
		if err != nil {
			t.Fatalf("GetEffectiveDeadline: %v", err)
		}
		if deadline.IsZero() {
			t.Error("deadline should not be zero")
		}
	})

	t.Run("GetCurrentWeekOf", func(t *testing.T) {
		weekOf, err := turnSvc.GetCurrentWeekOf(ctx, group.ID)
		if err != nil {
			t.Fatalf("GetCurrentWeekOf: %v", err)
		}
		if len(weekOf) != 10 {
			t.Errorf("got weekOf %q, expected YYYY-MM-DD", weekOf)
		}
	})

	t.Run("GetPicker via rotation (no prior assignment)", func(t *testing.T) {
		// Use a weekOf that has no assignment yet.
		weekOf := "2024-06-03"
		testPool.Exec(ctx, "DELETE FROM picker_assignments WHERE group_id = $1 AND week_of = $2", group.ID, weekOf)
		picker, err := turnSvc.GetPicker(ctx, group.ID, weekOf)
		if err != nil {
			t.Fatalf("GetPicker (rotation): %v", err)
		}
		if picker.ID == 0 {
			t.Error("expected valid picker from rotation")
		}
	})

	t.Run("SetPicker and GetPicker (explicit assignment)", func(t *testing.T) {
		weekOf := "2024-01-01"
		if err := turnSvc.SetPicker(ctx, group.ID, weekOf, ownerUser.ID); err != nil {
			t.Fatalf("SetPicker: %v", err)
		}
		picker, err := turnSvc.GetPicker(ctx, group.ID, weekOf)
		if err != nil {
			t.Fatalf("GetPicker: %v", err)
		}
		if picker.ID != ownerUser.ID {
			t.Errorf("got pickerID %d, want %d", picker.ID, ownerUser.ID)
		}
	})
}
