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
// Deprecated: Will be removed once admin handlers migrate to using turns table directly.
type TurnConfig struct {
	StartDate      string
	TurnLengthDays int
	Extensions     []TurnExtension
}

// TurnExtension represents an extension applied to a specific turn index.
// Deprecated: Extensions are now baked into turns.end_date.
type TurnExtension struct {
	TurnIndex int `json:"turnIndex"`
	ExtraDays int `json:"extraDays"`
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

// TurnService wraps turn-related DB access.
// The turns table is now the single source of truth for turn scheduling.
type TurnService struct {
	queries *db.Queries
	config  Config
}

// NewTurnService creates a new TurnService.
func NewTurnService(q *db.Queries, cfg Config) *TurnService {
	return &TurnService{queries: q, config: cfg}
}

// GetTurn returns the turn for the given group and weekOf.
func (s *TurnService) GetTurn(ctx context.Context, groupID int32, weekOf string) (db.Turn, error) {
	return s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
}

// GetTurnByIndex returns the turn for the given group and turn index.
func (s *TurnService) GetTurnByIndex(ctx context.Context, groupID int32, turnIndex int32) (db.Turn, error) {
	return s.queries.GetTurnByIndex(ctx, db.GetTurnByIndexParams{
		GroupID:   groupID,
		TurnIndex: turnIndex,
	})
}

// GetCurrentTurn returns the currently active turn for the group.
func (s *TurnService) GetCurrentTurn(ctx context.Context, groupID int32) (db.Turn, error) {
	return s.queries.GetCurrentTurn(ctx, groupID)
}

// BuildTurnConfig constructs the full TurnConfig from DB.
// Deprecated: Kept for backwards compatibility with admin handlers.
// New code should use GetTurn/GetCurrentTurn instead.
func (s *TurnService) BuildTurnConfig(ctx context.Context, group db.Group) (TurnConfig, error) {
	startDate := pgDateToString(group.StartDate)

	baseConfig := TurnConfig{
		StartDate:      startDate,
		TurnLengthDays: int(group.TurnLengthDays),
		Extensions:     nil,
	}

	// Read extensions from legacy tables for backwards compat.
	// TODO: Remove this once admin handlers migrate to turns table.
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

// GetEffectiveDeadline returns the deadline for a turn.
// This is now simply the end_date from the turns table.
func (s *TurnService) GetEffectiveDeadline(ctx context.Context, groupID int32, weekOf string) (time.Time, error) {
	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
	if err != nil {
		// Fallback to legacy calculation if turn doesn't exist.
		return s.getEffectiveDeadlineLegacy(ctx, groupID, weekOf)
	}

	// Return end of day (midnight) on the end_date in the configured timezone.
	loc, _ := time.LoadLocation(s.config.TimeZone)
	if loc == nil {
		loc, _ = time.LoadLocation("America/New_York")
	}
	endDate := pgDateToTime(turn.EndDate)
	deadline := time.Date(endDate.Year(), endDate.Month(), endDate.Day()+1, 0, 0, 0, 0, loc)
	return deadline, nil
}

// getEffectiveDeadlineLegacy is the old implementation for backwards compat.
func (s *TurnService) getEffectiveDeadlineLegacy(ctx context.Context, groupID int32, weekOf string) (time.Time, error) {
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
	turn, err := s.queries.GetCurrentTurn(ctx, groupID)
	if err != nil {
		// Fallback to legacy calculation if no current turn.
		return s.getCurrentWeekOfLegacy(ctx, groupID)
	}
	return pgDateToString(turn.WeekOf), nil
}

// getCurrentWeekOfLegacy is the old implementation for backwards compat.
func (s *TurnService) getCurrentWeekOfLegacy(ctx context.Context, groupID int32) (string, error) {
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
// Now reads from the turns table directly.
func (s *TurnService) GetPicker(ctx context.Context, groupID int32, weekOf string) (db.User, error) {
	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
	if err != nil {
		// Fallback to legacy if turn doesn't exist.
		return s.getPickerLegacy(ctx, groupID, weekOf)
	}
	return s.queries.GetUserByID(ctx, turn.PickerUserID)
}

// getPickerLegacy is the old implementation for backwards compat.
func (s *TurnService) getPickerLegacy(ctx context.Context, groupID int32, weekOf string) (db.User, error) {
	assignment, err := s.queries.GetPickerAssignment(ctx, db.GetPickerAssignmentParams{
		GroupID: groupID,
		WeekOf:  weekOf,
	})
	if err == nil {
		return s.queries.GetUserByID(ctx, assignment.UserID)
	}

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

	if err := s.queries.UpsertPickerAssignment(ctx, db.UpsertPickerAssignmentParams{
		GroupID: groupID,
		UserID:  pickerMember.UserID,
		WeekOf:  weekOf,
	}); err != nil {
		return db.User{}, err
	}

	return s.queries.GetUserByID(ctx, pickerMember.UserID)
}

// SetPicker overrides the picker for a turn.
// Updates both the turns table and legacy picker_assignments for backwards compat.
func (s *TurnService) SetPicker(ctx context.Context, groupID int32, weekOf string, userID int32) error {
	// Update turns table.
	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
	if err == nil {
		if err := s.queries.UpdateTurnPicker(ctx, db.UpdateTurnPickerParams{
			ID:           turn.ID,
			PickerUserID: userID,
		}); err != nil {
			return err
		}
	}

	// Also update legacy table for backwards compat.
	return s.queries.UpsertPickerAssignment(ctx, db.UpsertPickerAssignmentParams{
		GroupID: groupID,
		UserID:  userID,
		WeekOf:  weekOf,
	})
}

// ExtendTurn extends the turn's end_date by the given number of days.
func (s *TurnService) ExtendTurn(ctx context.Context, turnID int64, extraDays int32) error {
	return s.queries.ExtendTurn(ctx, db.ExtendTurnParams{
		ID:     turnID,
		Column2: extraDays,
	})
}

// SetMovieUnlocked sets whether the movie is unlocked for the turn.
func (s *TurnService) SetMovieUnlocked(ctx context.Context, turnID int64, unlocked bool) error {
	return s.queries.UpdateTurnMovieUnlocked(ctx, db.UpdateTurnMovieUnlockedParams{
		ID:            turnID,
		MovieUnlocked: unlocked,
	})
}

// SetReviewsUnlocked sets whether reviews are unlocked for the turn.
func (s *TurnService) SetReviewsUnlocked(ctx context.Context, turnID int64, unlocked bool) error {
	return s.queries.UpdateTurnReviewsUnlocked(ctx, db.UpdateTurnReviewsUnlockedParams{
		ID:              turnID,
		ReviewsUnlocked: unlocked,
	})
}

// EnsureTurnExists creates a turn if it doesn't already exist.
// Used when the system needs to reference a turn that may not have been
// pre-generated by the migration backfill.
func (s *TurnService) EnsureTurnExists(ctx context.Context, groupID int32, weekOf string) (db.Turn, error) {
	// Try to get existing turn.
	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
	if err == nil {
		return turn, nil
	}

	// Need to create the turn.
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		return db.Turn{}, fmt.Errorf("failed to get group: %w", err)
	}

	members, err := s.queries.GetGroupMembers(ctx, groupID)
	if err != nil {
		return db.Turn{}, fmt.Errorf("failed to get members: %w", err)
	}
	if len(members) == 0 {
		return db.Turn{}, fmt.Errorf("group %d has no members", groupID)
	}

	// Calculate turn index from weekOf.
	config, err := s.BuildTurnConfig(ctx, group)
	if err != nil {
		return db.Turn{}, err
	}
	turnIndex := getTurnIndexForDate(weekOf, config)

	// Determine picker via round-robin.
	pickerUserID := members[turnIndex%len(members)].UserID

	// Calculate dates.
	weekOfDate := timeToPgDate(weekOf)
	startDate := weekOfDate
	endDate := pgtype.Date{
		Time:  weekOfDate.Time.AddDate(0, 0, int(group.TurnLengthDays)-1),
		Valid: true,
	}

	return s.queries.UpsertTurn(ctx, db.UpsertTurnParams{
		GroupID:         groupID,
		TurnIndex:       int32(turnIndex),
		WeekOf:          weekOfDate,
		PickerUserID:    pickerUserID,
		StartDate:       startDate,
		EndDate:         endDate,
		MovieUnlocked:   false,
		ReviewsUnlocked: false,
	})
}
