package service

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// TurnConfig mirrors the TypeScript TurnConfig interface.
type TurnConfig struct {
	StartDate      string
	TurnLengthDays int
	Extensions     []TurnExtension
}

// TurnExtension represents an extension applied to a specific turn index.
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
// adminExtendedDays shifts the end of the turn (deadline moves later).
// startOffsetDays shifts both the start and end of the turn by the same amount.
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
	// startOffsetDays shifts both start and end — deadline moves by the same offset.
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

// pgDateToString converts a pgtype.Date to a YYYY-MM-DD string.
func pgDateToString(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

// pgDateToTime converts a pgtype.Date to time.Time.
func pgDateToTime(d pgtype.Date) time.Time {
	return d.Time
}

// timeToPgDate converts a YYYY-MM-DD string to pgtype.Date.
func timeToPgDate(s string) pgtype.Date {
	t, _ := time.Parse("2006-01-02", s)
	return pgtype.Date{Time: t, Valid: true}
}

// TurnService wraps pure turn functions with DB access.
type TurnService struct {
	queries *db.Queries
	config  Config
}

// NewTurnService creates a new TurnService.
func NewTurnService(q *db.Queries, cfg Config) *TurnService {
	return &TurnService{queries: q, config: cfg}
}

// BuildTurnConfig constructs the full TurnConfig from DB, merging base extensions + admin overrides.
func (s *TurnService) BuildTurnConfig(ctx context.Context, group db.Group) (TurnConfig, error) {
	startDate := pgDateToString(group.StartDate)

	baseConfig := TurnConfig{
		StartDate:      startDate,
		TurnLengthDays: int(group.TurnLengthDays),
		Extensions:     nil,
	}

	exts, err := s.queries.GetTurnExtensions(ctx, group.ID)
	if err != nil {
		return baseConfig, err
	}

	for _, e := range exts {
		baseConfig.Extensions = append(baseConfig.Extensions, TurnExtension{
			TurnIndex: int(e.TurnIndex),
			ExtraDays: int(e.ExtraDays),
		})
	}

	overrides, err := s.queries.GetTurnOverridesForGroup(ctx, group.ID)
	if err != nil {
		return baseConfig, err
	}

	adminOverrides := make([]db.GetTurnOverridesForGroupRow, 0)
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

// GetEffectiveDeadline is the single source of truth for when a turn ends.
func (s *TurnService) GetEffectiveDeadline(ctx context.Context, groupID int32, weekOf string) (time.Time, error) {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		return time.Time{}, err
	}

	config, err := s.BuildTurnConfig(ctx, group)
	if err != nil {
		return time.Time{}, err
	}

	adminExt := 0
	startOffset := 0
	if override, err := s.queries.GetTurnOverride(ctx, db.GetTurnOverrideParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		startOffset = int(override.StartOffsetDays)
	}

	ms := getDeadlineMs(weekOf, config, adminExt, startOffset)
	return time.UnixMilli(ms), nil
}

// GetCurrentWeekOf returns the weekOf string for the current turn.
func (s *TurnService) GetCurrentWeekOf(ctx context.Context, groupID int32) (string, error) {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		return "", err
	}

	config, err := s.BuildTurnConfig(ctx, group)
	if err != nil {
		return "", err
	}

	return getCurrentTurnWeekOf(config), nil
}

// GetPicker returns the user assigned to pick for the given weekOf.
// If an assignment already exists in picker_assignments it is returned directly.
// Otherwise the picker is calculated from the member rotation, persisted, and returned.
func (s *TurnService) GetPicker(ctx context.Context, groupID int32, weekOf string) (db.User, error) {
	// 1. Check for an existing assignment.
	assignment, err := s.queries.GetPickerAssignment(ctx, db.GetPickerAssignmentParams{
		GroupID: groupID,
		WeekOf:  weekOf,
	})
	if err == nil {
		// Assignment found — return the corresponding user.
		return s.queries.GetUserByID(ctx, assignment.UserID)
	}

	// 2. No assignment — calculate from rotation.
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		return db.User{}, err
	}

	config, err := s.BuildTurnConfig(ctx, group)
	if err != nil {
		return db.User{}, err
	}

	members, err := s.queries.GetGroupMembers(ctx, groupID)
	if err != nil {
		return db.User{}, err
	}
	if len(members) == 0 {
		return db.User{}, fmt.Errorf("group %d has no members", groupID)
	}

	turnIndex := getTurnIndexForDate(weekOf, config)
	pickerIndex := turnIndex % len(members)
	pickerMember := members[pickerIndex]

	// 3. Persist the assignment so future calls are O(1).
	if err := s.queries.UpsertPickerAssignment(ctx, db.UpsertPickerAssignmentParams{
		GroupID: groupID,
		UserID:  pickerMember.UserID,
		WeekOf:  weekOf,
	}); err != nil {
		return db.User{}, err
	}

	return s.queries.GetUserByID(ctx, pickerMember.UserID)
}

// SetPicker overrides the picker for a turn. Used by admin to explicitly assign a user.
func (s *TurnService) SetPicker(ctx context.Context, groupID int32, weekOf string, userID int32) error {
	return s.queries.UpsertPickerAssignment(ctx, db.UpsertPickerAssignmentParams{
		GroupID: groupID,
		UserID:  userID,
		WeekOf:  weekOf,
	})
}
