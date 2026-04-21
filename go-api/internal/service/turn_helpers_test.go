package service

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestNewTurnService(t *testing.T) {
	svc := NewTurnService(nil, Config{})
	if svc == nil {
		t.Error("NewTurnService returned nil")
	}
}

func TestGetCurrentTurnWeekOf(t *testing.T) {
	// Start in the past so today is definitely within some turn.
	cfg := TurnConfig{StartDate: "2020-01-01", TurnLengthDays: 7}
	weekOf := getCurrentTurnWeekOf(cfg)
	if len(weekOf) != 10 {
		t.Errorf("getCurrentTurnWeekOf returned invalid date %q", weekOf)
	}
	// weekOf should be a Monday (or start of some turn).
	_, err := time.Parse("2006-01-02", weekOf)
	if err != nil {
		t.Errorf("not a valid date: %v", err)
	}
}

func TestGetMaxFutureTurnIndex(t *testing.T) {
	cfg := TurnConfig{StartDate: "2020-01-01", TurnLengthDays: 7}
	max := getMaxFutureTurnIndex(cfg, 5)
	// Should be current index + 5.
	today := time.Now().UTC().Format("2006-01-02")
	currentIdx := getTurnIndexForDate(today, cfg)
	if max != currentIdx+5 {
		t.Errorf("got %d, want %d", max, currentIdx+5)
	}
}

func TestIsTurnWithinCap(t *testing.T) {
	cfg := TurnConfig{StartDate: "2020-01-01", TurnLengthDays: 7}
	today := time.Now().UTC().Format("2006-01-02")
	currentIdx := getTurnIndexForDate(today, cfg)
	currentWeekOf := getTurnStartDate(currentIdx, cfg)
	futureWeekOf := getTurnStartDate(currentIdx+3, cfg)
	farWeekOf := getTurnStartDate(currentIdx+10, cfg)

	if !isTurnWithinCap(currentWeekOf, cfg, 5) {
		t.Errorf("current turn should be within cap")
	}
	if !isTurnWithinCap(futureWeekOf, cfg, 5) {
		t.Errorf("turn +3 should be within cap of 5")
	}
	if isTurnWithinCap(farWeekOf, cfg, 5) {
		t.Errorf("turn +10 should NOT be within cap of 5")
	}
}

func TestPgDateHelpers(t *testing.T) {
	d := pgtype.Date{Time: time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), Valid: true}
	if pgDateToString(d) != "2024-03-15" {
		t.Errorf("pgDateToString: got %q", pgDateToString(d))
	}
	if !pgDateToTime(d).Equal(d.Time) {
		t.Error("pgDateToTime mismatch")
	}

	invalid := pgtype.Date{Valid: false}
	if pgDateToString(invalid) != "" {
		t.Error("invalid pgtype.Date should return empty string")
	}

	pd := timeToPgDate("2024-03-15")
	if !pd.Valid || pd.Time.Format("2006-01-02") != "2024-03-15" {
		t.Errorf("timeToPgDate: %v", pd)
	}
}
