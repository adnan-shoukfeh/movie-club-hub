package handler

import (
	"context"
	"sort"
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
func getDeadlineMs(weekOf string, config TurnConfig, adminExtendedDays int) int64 {
	idx := getTurnIndexForDate(weekOf, config)
	extra := 0
	for _, ext := range config.Extensions {
		if ext.TurnIndex == idx {
			extra = ext.ExtraDays
			break
		}
	}
	turnDays := config.TurnLengthDays + extra + adminExtendedDays
	turnStart, _ := time.Parse("2006-01-02", getTurnStartDate(idx, config))
	turnStart = turnStart.AddDate(0, 0, turnDays)
	return turnStart.UnixMilli()
}

// isVotingOpen returns true if current time < deadline.
func isVotingOpen(weekOf string, config TurnConfig, adminExtendedDays int) bool {
	return time.Now().UnixMilli() < getDeadlineMs(weekOf, config, adminExtendedDays)
}

// isResultsAvailable returns true if current time >= deadline.
func isResultsAvailable(weekOf string, config TurnConfig, adminExtendedDays int) bool {
	return time.Now().UnixMilli() >= getDeadlineMs(weekOf, config, adminExtendedDays)
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

// buildTurnConfig constructs the full TurnConfig from DB, merging base extensions + admin overrides.
func (h *Handler) buildTurnConfig(ctx context.Context, group db.Group) (TurnConfig, error) {
	startDate := pgDateToString(group.StartDate)

	baseConfig := TurnConfig{
		StartDate:      startDate,
		TurnLengthDays: int(group.TurnLengthDays),
		Extensions:     nil,
	}

	exts, err := h.q.GetTurnExtensions(ctx, group.ID)
	if err != nil {
		return baseConfig, err
	}

	for _, e := range exts {
		baseConfig.Extensions = append(baseConfig.Extensions, TurnExtension{
			TurnIndex: int(e.TurnIndex),
			ExtraDays: int(e.ExtraDays),
		})
	}

	overrides, err := h.q.GetTurnOverridesForGroup(ctx, group.ID)
	if err != nil {
		return baseConfig, err
	}

	adminOverrides := make([]db.TurnOverride, 0)
	for _, o := range overrides {
		if o.ExtendedDays > 0 {
			adminOverrides = append(adminOverrides, o)
		}
	}

	if len(adminOverrides) == 0 {
		return baseConfig, nil
	}

	sort.Slice(adminOverrides, func(i, j int) bool {
		return pgDateToTime(adminOverrides[i].WeekOf).Before(pgDateToTime(adminOverrides[j].WeekOf))
	})

	extMap := make(map[int]int)
	for _, ext := range baseConfig.Extensions {
		extMap[ext.TurnIndex] = ext.ExtraDays
	}

	currentConfig := baseConfig
	for _, override := range adminOverrides {
		weekOfStr := pgDateToString(override.WeekOf)
		turnIdx := getTurnIndexForDate(weekOfStr, currentConfig)
		extMap[turnIdx] = extMap[turnIdx] + int(override.ExtendedDays)

		newExts := make([]TurnExtension, 0, len(extMap))
		for idx, days := range extMap {
			newExts = append(newExts, TurnExtension{TurnIndex: idx, ExtraDays: days})
		}
		currentConfig = TurnConfig{
			StartDate:      baseConfig.StartDate,
			TurnLengthDays: baseConfig.TurnLengthDays,
			Extensions:     newExts,
		}
	}

	return currentConfig, nil
}
