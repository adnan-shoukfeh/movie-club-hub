package handler

import (
	"context"
	"time"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// TurnConfig mirrors the TypeScript TurnConfig interface.
type TurnConfig struct {
	StartDate      string
	TurnLengthDays int
	Extensions     []TurnExtension
}

type TurnExtension struct {
	TurnIndex int
	ExtraDays int
}

// cumulativeDaysUpToTurn calculates total days for turns 0..index-1 including extensions.
func cumulativeDaysUpToTurn(index int, config TurnConfig) int {
	total := 0
	for i := 0; i < index; i++ {
		extra := 0
		for _, ext := range config.Extensions {
			if ext.TurnIndex == i {
				extra = ext.ExtraDays
				break
			}
		}
		total += config.TurnLengthDays + extra
	}
	return total
}

// getTurnStartDate returns the start date (YYYY-MM-DD) for a given turn index.
func getTurnStartDate(turnIndex int, config TurnConfig) string {
	start, _ := time.Parse("2006-01-02", config.StartDate)
	offset := cumulativeDaysUpToTurn(turnIndex, config)
	start = start.AddDate(0, 0, offset)
	return start.Format("2006-01-02")
}

// getTurnIndexForDate returns the turn index containing the given date.
func getTurnIndexForDate(dateStr string, config TurnConfig) int {
	target, _ := time.Parse("2006-01-02", dateStr)
	start, _ := time.Parse("2006-01-02", config.StartDate)

	if target.Before(start) {
		return 0
	}

	targetMs := target.UnixMilli()
	startMs := start.UnixMilli()

	idx := 0
	elapsed := 0
	for {
		extra := 0
		for _, ext := range config.Extensions {
			if ext.TurnIndex == idx {
				extra = ext.ExtraDays
				break
			}
		}
		turnDays := config.TurnLengthDays + extra
		turnStartMs := startMs + int64(elapsed)*86400000
		turnEndMs := turnStartMs + int64(turnDays)*86400000
		if targetMs < turnEndMs {
			return idx
		}
		elapsed += turnDays
		idx++
		if idx > 10000 {
			return idx
		}
	}
}

// getCurrentTurnWeekOf returns the current turn's start date.
func getCurrentTurnWeekOf(config TurnConfig) string {
	today := time.Now().UTC().Format("2006-01-02")
	idx := getTurnIndexForDate(today, config)
	return getTurnStartDate(idx, config)
}

// getDeadlineMs returns the deadline (Unix millis) for a given weekOf.
// startOffsetDays shifts when the turn actually starts (and thus when it ends).
func getDeadlineMs(weekOf string, config TurnConfig, adminExtendedDays int, startOffsetDays int) int64 {
	idx := getTurnIndexForDate(weekOf, config)
	extra := 0
	for _, ext := range config.Extensions {
		if ext.TurnIndex == idx {
			extra = ext.ExtraDays
			break
		}
	}
	turnDays := config.TurnLengthDays + extra + adminExtendedDays
	loc, _ := time.LoadLocation("America/New_York")
	turnStart, _ := time.ParseInLocation("2006-01-02", getTurnStartDate(idx, config), loc)
	turnStart = turnStart.AddDate(0, 0, startOffsetDays+turnDays)
	return turnStart.UnixMilli()
}

// isVotingOpen returns true if current time < deadline.
func isVotingOpen(weekOf string, config TurnConfig, adminExtendedDays int, startOffsetDays int) bool {
	return time.Now().UnixMilli() < getDeadlineMs(weekOf, config, adminExtendedDays, startOffsetDays)
}

// isResultsAvailable returns true if current time >= deadline.
func isResultsAvailable(weekOf string, config TurnConfig, adminExtendedDays int, startOffsetDays int) bool {
	return time.Now().UnixMilli() >= getDeadlineMs(weekOf, config, adminExtendedDays, startOffsetDays)
}

// getMaxFutureTurnIndex returns current turn index + memberCount.
func getMaxFutureTurnIndex(config TurnConfig, memberCount int) int {
	today := time.Now().UTC().Format("2006-01-02")
	currentIdx := getTurnIndexForDate(today, config)
	return currentIdx + memberCount
}

// isTurnWithinCap checks if a weekOf is within the allowed future range.
func isTurnWithinCap(weekOf string, config TurnConfig, memberCount int) bool {
	idx := getTurnIndexForDate(weekOf, config)
	maxIdx := getMaxFutureTurnIndex(config, memberCount)
	return idx <= maxIdx
}

// buildTurnConfig constructs the full TurnConfig from the turns table.
// GetTurnExtensions already returns the effective per-turn extra days
// (legacy turn_extensions and turn_overrides.extended_days are both encoded
// in turns.start_date / turns.end_date).
func (h *Handler) buildTurnConfig(ctx context.Context, group db.Group) (TurnConfig, error) {
	startDate := pgDateToString(group.StartDate)

	config := TurnConfig{
		StartDate:      startDate,
		TurnLengthDays: int(group.TurnLengthDays),
	}

	exts, err := h.q.GetTurnExtensions(ctx, group.ID)
	if err != nil {
		return config, err
	}
	for _, e := range exts {
		config.Extensions = append(config.Extensions, TurnExtension{
			TurnIndex: int(e.TurnIndex),
			ExtraDays: int(e.ExtraDays),
		})
	}
	return config, nil
}
