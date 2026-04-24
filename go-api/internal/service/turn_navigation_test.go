package service

import (
	"testing"
)

// TestNavigationBackFromTurn0 verifies that navigating back from Turn 0
// stays at Turn 0 (no negative turns).
func TestNavigationBackFromTurn0(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	turn0Start := getTurnStartDate(0, config)
	idx := getTurnIndexForDate(turn0Start, config)

	if idx != 0 {
		t.Errorf("turn 0 start date should return index 0, got %d", idx)
	}

	// Simulating "go back" from turn 0: newIdx = max(0, 0-1) = 0
	newIdx := idx - 1
	if newIdx < 0 {
		newIdx = 0
	}

	backDate := getTurnStartDate(newIdx, config)
	if backDate != turn0Start {
		t.Errorf("going back from turn 0 should stay at turn 0, got %s", backDate)
	}
}

// TestNavigationForwardBackConsistency verifies that navigating forward
// then back returns to the original turn.
func TestNavigationForwardBackConsistency(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	tests := []struct {
		name      string
		startTurn int
	}{
		{"from turn 0", 0},
		{"from turn 1", 1},
		{"from turn 5", 5},
		{"from turn 10", 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			startDate := getTurnStartDate(tt.startTurn, config)
			startIdx := getTurnIndexForDate(startDate, config)

			// Go forward
			forwardDate := getTurnStartDate(startIdx+1, config)
			forwardIdx := getTurnIndexForDate(forwardDate, config)

			// Go back
			backDate := getTurnStartDate(forwardIdx-1, config)
			backIdx := getTurnIndexForDate(backDate, config)

			if backIdx != startIdx {
				t.Errorf("forward then back: started at %d, ended at %d", startIdx, backIdx)
			}
			if backDate != startDate {
				t.Errorf("forward then back: started at %s, ended at %s", startDate, backDate)
			}
		})
	}
}

// TestNavigationWithExtensions verifies navigation works correctly when
// turns have extensions.
func TestNavigationWithExtensions(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions: []TurnExtension{
			{TurnIndex: 1, ExtraDays: 7},  // Turn 1 is 14 days
			{TurnIndex: 3, ExtraDays: 14}, // Turn 3 is 21 days
		},
	}

	// Verify turn boundaries with extensions
	tests := []struct {
		name      string
		turnIndex int
		wantStart string
	}{
		{"turn 0", 0, "2024-01-01"},
		{"turn 1 (7 days after)", 1, "2024-01-08"},
		{"turn 2 (14 more days)", 2, "2024-01-22"},     // 7 + 14 = day 21 -> Jan 22
		{"turn 3 (7 more days)", 3, "2024-01-29"},      // 21 + 7 = day 28 -> Jan 29
		{"turn 4 (21 more days)", 4, "2024-02-19"},     // 28 + 21 = day 49 -> Feb 19
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getTurnStartDate(tt.turnIndex, config)
			if got != tt.wantStart {
				t.Errorf("getTurnStartDate(%d) = %s, want %s", tt.turnIndex, got, tt.wantStart)
			}
		})
	}

	// Test navigation through extended turns
	t.Run("navigate through extended turn 1", func(t *testing.T) {
		// Start at turn 0
		idx := 0
		date := getTurnStartDate(idx, config)

		// Navigate forward to turn 1
		idx++
		date = getTurnStartDate(idx, config)
		if date != "2024-01-08" {
			t.Errorf("turn 1 start = %s, want 2024-01-08", date)
		}

		// Navigate forward to turn 2 (after extended turn 1)
		idx++
		date = getTurnStartDate(idx, config)
		if date != "2024-01-22" {
			t.Errorf("turn 2 start = %s, want 2024-01-22", date)
		}

		// Navigate back to turn 1
		idx--
		date = getTurnStartDate(idx, config)
		if date != "2024-01-08" {
			t.Errorf("back to turn 1 = %s, want 2024-01-08", date)
		}
	})
}

// TestDateWithinExtendedTurn verifies that dates within an extended turn
// return the correct turn index.
func TestDateWithinExtendedTurn(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions: []TurnExtension{
			{TurnIndex: 1, ExtraDays: 7}, // Turn 1 is 14 days (Jan 8-21)
		},
	}

	tests := []struct {
		name     string
		date     string
		wantTurn int
	}{
		{"last day of turn 0", "2024-01-07", 0},
		{"first day of turn 1", "2024-01-08", 1},
		{"middle of turn 1", "2024-01-14", 1},
		{"day 13 of turn 1 (extended)", "2024-01-20", 1},
		{"last day of turn 1 (extended)", "2024-01-21", 1},
		{"first day of turn 2", "2024-01-22", 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getTurnIndexForDate(tt.date, config)
			if got != tt.wantTurn {
				t.Errorf("getTurnIndexForDate(%s) = %d, want %d", tt.date, got, tt.wantTurn)
			}
		})
	}
}

// TestMultipleExtensions verifies correct calculation with multiple extensions.
func TestMultipleExtensions(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions: []TurnExtension{
			{TurnIndex: 0, ExtraDays: 3},  // Turn 0: 10 days
			{TurnIndex: 2, ExtraDays: 5},  // Turn 2: 12 days
			{TurnIndex: 4, ExtraDays: 2},  // Turn 4: 9 days
		},
	}

	// Calculate expected dates:
	// Turn 0: Jan 1-10 (10 days)
	// Turn 1: Jan 11-17 (7 days)
	// Turn 2: Jan 18-29 (12 days)
	// Turn 3: Jan 30-Feb 5 (7 days)
	// Turn 4: Feb 6-14 (9 days)
	// Turn 5: Feb 15-21 (7 days)

	tests := []struct {
		turnIndex int
		wantStart string
	}{
		{0, "2024-01-01"},
		{1, "2024-01-11"},
		{2, "2024-01-18"},
		{3, "2024-01-30"},
		{4, "2024-02-06"},
		{5, "2024-02-15"},
	}

	for _, tt := range tests {
		t.Run("turn_"+string(rune('0'+tt.turnIndex)), func(t *testing.T) {
			got := getTurnStartDate(tt.turnIndex, config)
			if got != tt.wantStart {
				t.Errorf("getTurnStartDate(%d) = %s, want %s", tt.turnIndex, got, tt.wantStart)
			}
		})
	}
}

// TestTurnIndexBoundaryConditions tests edge cases at turn boundaries.
func TestTurnIndexBoundaryConditions(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	tests := []struct {
		name     string
		date     string
		wantTurn int
	}{
		{"exactly on start date", "2024-01-01", 0},
		{"day before start", "2023-12-31", 0},
		{"week before start", "2023-12-25", 0},
		{"exactly on turn 1 boundary", "2024-01-08", 1},
		{"one day before turn 1 boundary", "2024-01-07", 0},
		{"exactly on turn 2 boundary", "2024-01-15", 2},
		{"far in future", "2025-06-15", 75}, // 531 days / 7 = 75.8, so turn 75
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getTurnIndexForDate(tt.date, config)
			if got != tt.wantTurn {
				t.Errorf("getTurnIndexForDate(%s) = %d, want %d", tt.date, got, tt.wantTurn)
			}
		})
	}
}

// TestCumulativeDaysCalculation verifies the cumulative days helper.
func TestCumulativeDaysCalculation(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions: []TurnExtension{
			{TurnIndex: 1, ExtraDays: 3}, // Turn 1 is 10 days
		},
	}

	tests := []struct {
		turnIndex int
		wantDays  int
	}{
		{0, 0},   // Before turn 0, no days accumulated
		{1, 7},   // After turn 0 (7 days)
		{2, 17},  // After turn 0 (7) + turn 1 (10)
		{3, 24},  // After turn 0 (7) + turn 1 (10) + turn 2 (7)
	}

	for _, tt := range tests {
		t.Run("cumulative_to_turn_"+string(rune('0'+tt.turnIndex)), func(t *testing.T) {
			got := cumulativeDaysUpToTurn(tt.turnIndex, config)
			if got != tt.wantDays {
				t.Errorf("cumulativeDaysUpToTurn(%d) = %d, want %d", tt.turnIndex, got, tt.wantDays)
			}
		})
	}
}

// TestRoundTripNavigation tests navigating multiple times forward and back.
func TestRoundTripNavigation(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions: []TurnExtension{
			{TurnIndex: 2, ExtraDays: 7},
		},
	}

	startIdx := 1
	currentIdx := startIdx

	// Navigate forward 5 times
	for i := 0; i < 5; i++ {
		currentIdx++
	}

	// Navigate back 5 times
	for i := 0; i < 5; i++ {
		currentIdx--
	}

	if currentIdx != startIdx {
		t.Errorf("after round trip: got turn %d, want turn %d", currentIdx, startIdx)
	}

	startDate := getTurnStartDate(startIdx, config)
	endDate := getTurnStartDate(currentIdx, config)

	if startDate != endDate {
		t.Errorf("after round trip: started at %s, ended at %s", startDate, endDate)
	}
}
