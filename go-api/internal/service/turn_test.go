package service

import (
	"testing"
	"time"
)

// baseConfig is a simple weekly turn config starting 2024-01-01.
var baseConfig = TurnConfig{
	StartDate:      "2024-01-01",
	TurnLengthDays: 7,
	Extensions:     nil,
}

// configWithExtension has turn 2 extended by 3 days (total 10 days for turn 2).
var configWithExtension = TurnConfig{
	StartDate:      "2024-01-01",
	TurnLengthDays: 7,
	Extensions: []TurnExtension{
		{TurnIndex: 2, ExtraDays: 3},
	},
}

// TestGetTurnStartDate tests turn 0, turn 1, and turn N start dates.
func TestGetTurnStartDate(t *testing.T) {
	tests := []struct {
		name      string
		turnIndex int
		config    TurnConfig
		want      string
	}{
		{
			name:      "turn 0 is the start date",
			turnIndex: 0,
			config:    baseConfig,
			want:      "2024-01-01",
		},
		{
			name:      "turn 1 starts 7 days after turn 0",
			turnIndex: 1,
			config:    baseConfig,
			want:      "2024-01-08",
		},
		{
			name:      "turn 2 starts 14 days after turn 0",
			turnIndex: 2,
			config:    baseConfig,
			want:      "2024-01-15",
		},
		{
			name:      "turn 3 with extension: turn 2 had 10 days, so turn 3 starts at day 24",
			turnIndex: 3,
			config:    configWithExtension,
			want:      "2024-01-25",
		},
		{
			name:      "turn 5 with no extensions",
			turnIndex: 5,
			config:    baseConfig,
			want:      "2024-02-05",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getTurnStartDate(tt.turnIndex, tt.config)
			if got != tt.want {
				t.Errorf("getTurnStartDate(%d) = %q, want %q", tt.turnIndex, got, tt.want)
			}
		})
	}
}

// TestGetTurnIndexForDate tests current turn, past turn, and future turn lookups.
func TestGetTurnIndexForDate(t *testing.T) {
	tests := []struct {
		name   string
		date   string
		config TurnConfig
		want   int
	}{
		{
			name:   "date on start date is turn 0",
			date:   "2024-01-01",
			config: baseConfig,
			want:   0,
		},
		{
			name:   "date before start date is turn 0",
			date:   "2023-12-01",
			config: baseConfig,
			want:   0,
		},
		{
			name:   "last day of turn 0 is still turn 0",
			date:   "2024-01-07",
			config: baseConfig,
			want:   0,
		},
		{
			name:   "first day of turn 1",
			date:   "2024-01-08",
			config: baseConfig,
			want:   1,
		},
		{
			name:   "middle of turn 2",
			date:   "2024-01-18",
			config: baseConfig,
			want:   2,
		},
		{
			name:   "turn 2 with extension: date still in turn 2 after day 21",
			date:   "2024-01-24",
			config: configWithExtension,
			want:   2,
		},
		{
			name:   "turn 3 starts after extended turn 2",
			date:   "2024-01-25",
			config: configWithExtension,
			want:   3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getTurnIndexForDate(tt.date, tt.config)
			if got != tt.want {
				t.Errorf("getTurnIndexForDate(%q) = %d, want %d", tt.date, got, tt.want)
			}
		})
	}
}

// TestIsVotingOpen tests open and closed voting states.
func TestIsVotingOpen(t *testing.T) {
	// Use a start date far in the past so current date is well past the deadline.
	pastConfig := TurnConfig{
		StartDate:      "2020-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}
	// Use a start date far in the future so current date is before the deadline.
	futureConfig := TurnConfig{
		StartDate:      "2099-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	// For a past config, voting should be closed on any historical weekOf.
	pastWeekOf := "2020-01-01"
	if isVotingOpen(pastWeekOf, pastConfig, 0) {
		t.Errorf("isVotingOpen(%q) should be false for past turn with no extension", pastWeekOf)
	}

	// For a future config, voting should be open.
	futureWeekOf := "2099-01-01"
	if !isVotingOpen(futureWeekOf, futureConfig, 0) {
		t.Errorf("isVotingOpen(%q) should be true for future turn", futureWeekOf)
	}

	// Admin extension can keep voting open: add enough days to a past turn.
	today := time.Now().UTC().Format("2006-01-02")
	recentConfig := TurnConfig{
		StartDate:      today,
		TurnLengthDays: 7,
		Extensions:     nil,
	}
	// Today is turn 0. Without extension, voting is open (deadline is 7 days away).
	if !isVotingOpen(today, recentConfig, 0) {
		t.Errorf("isVotingOpen should be true for current turn started today")
	}
}

// TestIsResultsAvailable tests before/after deadline states.
func TestIsResultsAvailable(t *testing.T) {
	pastConfig := TurnConfig{
		StartDate:      "2020-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}
	futureConfig := TurnConfig{
		StartDate:      "2099-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	// Past turn: results should be available.
	if !isResultsAvailable("2020-01-01", pastConfig, 0) {
		t.Errorf("isResultsAvailable should be true for past turn")
	}

	// Future turn: results should not be available yet.
	if isResultsAvailable("2099-01-01", futureConfig, 0) {
		t.Errorf("isResultsAvailable should be false for future turn")
	}

	// isResultsAvailable is the complement of isVotingOpen.
	weekOf := "2020-06-01"
	if isVotingOpen(weekOf, pastConfig, 0) == isResultsAvailable(weekOf, pastConfig, 0) {
		t.Errorf("isVotingOpen and isResultsAvailable must not both return the same value for the same turn")
	}
}

// TestGetDeadlineMs tests deadline calculation including with extensions.
func TestGetDeadlineMs(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	// Turn 0 deadline: 2024-01-08 00:00:00 EST = 2024-01-08 05:00:00 UTC
	// UnixMilli for 2024-01-08 00:00:00 America/New_York
	loc, _ := time.LoadLocation("America/New_York")
	expectedDeadline := time.Date(2024, 1, 8, 0, 0, 0, 0, loc)
	expectedMs := expectedDeadline.UnixMilli()

	got := getDeadlineMs("2024-01-01", config, 0)
	if got != expectedMs {
		t.Errorf("getDeadlineMs turn 0 = %d, want %d", got, expectedMs)
	}

	// With 3 admin extension days: deadline moves to 2024-01-11
	expectedDeadlineExtended := time.Date(2024, 1, 11, 0, 0, 0, 0, loc)
	expectedMsExtended := expectedDeadlineExtended.UnixMilli()

	gotExtended := getDeadlineMs("2024-01-01", config, 3)
	if gotExtended != expectedMsExtended {
		t.Errorf("getDeadlineMs with 3 admin days = %d, want %d", gotExtended, expectedMsExtended)
	}

	// With turn extension on turn 0: deadline moves to 2024-01-10 (7+2 days)
	configWithExt := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions:     []TurnExtension{{TurnIndex: 0, ExtraDays: 2}},
	}
	expectedDeadlineExt := time.Date(2024, 1, 10, 0, 0, 0, 0, loc)
	expectedMsExt := expectedDeadlineExt.UnixMilli()
	gotExt := getDeadlineMs("2024-01-01", configWithExt, 0)
	if gotExt != expectedMsExt {
		t.Errorf("getDeadlineMs with turn extension = %d, want %d", gotExt, expectedMsExt)
	}
}

// Stub tests for services that require a live DB.

func TestAuthService_RequiresIntegrationDB(t *testing.T) {
	t.Skip("requires integration test DB")
}

func TestGroupService_RequiresIntegrationDB(t *testing.T) {
	t.Skip("requires integration test DB")
}

func TestVerdictService_RequiresIntegrationDB(t *testing.T) {
	t.Skip("requires integration test DB")
}

func TestMovieService_RequiresIntegrationDB(t *testing.T) {
	t.Skip("requires integration test DB")
}

func TestNominationService_RequiresIntegrationDB(t *testing.T) {
	t.Skip("requires integration test DB")
}
