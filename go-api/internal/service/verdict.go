package service

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// Verdict is the unified domain type combining vote and watch status.
// It does not map 1:1 to any single DB table.
type Verdict struct {
	UserID    int32
	GroupID   int32
	WeekOf    string
	Watched   bool
	Rating    *float32
	Review    *string
	Username  string // populated on reads
	UpdatedAt time.Time
}

// VerdictService unifies vote and watch status operations.
type VerdictService struct {
	queries *db.Queries
	pool    *pgxpool.Pool
	config  Config
}

// NewVerdictService creates a new VerdictService.
func NewVerdictService(q *db.Queries, pool *pgxpool.Pool, cfg Config) *VerdictService {
	return &VerdictService{queries: q, pool: pool, config: cfg}
}

// SubmitVerdict writes vote and watch status atomically.
// If watched=false, rating/review must be nil.
// Validates voting window is open.
func (s *VerdictService) SubmitVerdict(ctx context.Context, userID, groupID int32, weekOf string, watched bool, rating *float64, review *string) error {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Check membership
	if _, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}

	ts := newTurnServiceFromQueries(s.queries)
	config, err := ts.BuildTurnConfig(ctx, group)
	if err != nil {
		return err
	}

	currentWeekOf := getCurrentTurnWeekOf(config)
	if weekOf == "" {
		weekOf = currentWeekOf
	}

	// Validate rating range
	if rating != nil {
		if *rating < 1 || *rating > 10 {
			return errors.New("rating must be between 1 and 10")
		}
	}

	// Check movie exists
	if _, err := s.queries.GetMovieByGroupWeek(ctx, db.GetMovieByGroupWeekParams{
		GroupID: groupID,
		WeekOf:  weekOf,
	}); err != nil {
		return errors.New("no movie set for this week")
	}

	// Check voting window
	adminExt := 0
	reviewUnlocked := false
	if override, err := s.queries.GetTurnOverride(ctx, db.GetTurnOverrideParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		reviewUnlocked = override.ReviewUnlockedByAdmin
	}

	isCurrentTurn := weekOf == currentWeekOf
	if !((isVotingOpen(weekOf, config, adminExt) && isCurrentTurn) || reviewUnlocked) {
		return errors.New("voting is closed for this week")
	}

	// Upsert watch status
	if err := s.queries.UpsertWatchStatus(ctx, db.UpsertWatchStatusParams{
		UserID:  userID,
		GroupID: groupID,
		WeekOf:  weekOf,
		Watched: watched,
	}); err != nil {
		return err
	}

	// Upsert vote if rating provided
	if rating != nil {
		rounded := float32(math.Round(*rating*10) / 10)

		var sanitizedReview *string
		if review != nil {
			s2 := sanitizeReview(*review)
			sanitizedReview = &s2
		}

		if err := s.queries.UpsertVote(ctx, db.UpsertVoteParams{
			UserID:  userID,
			GroupID: groupID,
			Rating:  rounded,
			Review:  sanitizedReview,
			WeekOf:  weekOf,
		}); err != nil {
			return err
		}
	}

	return nil
}

// DeleteVerdict removes a vote (watch status remains). Validates voting window.
func (s *VerdictService) DeleteVerdict(ctx context.Context, userID, groupID int32, weekOf string) error {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Check membership
	if _, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}

	ts := newTurnServiceFromQueries(s.queries)
	config, err := ts.BuildTurnConfig(ctx, group)
	if err != nil {
		return err
	}

	currentWeekOf := getCurrentTurnWeekOf(config)
	if weekOf == "" {
		weekOf = currentWeekOf
	}

	adminExt := 0
	reviewUnlocked := false
	if override, err := s.queries.GetTurnOverride(ctx, db.GetTurnOverrideParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		reviewUnlocked = override.ReviewUnlockedByAdmin
	}

	isCurrentTurn := weekOf == currentWeekOf
	if !((isVotingOpen(weekOf, config, adminExt) && isCurrentTurn) || reviewUnlocked) {
		return errors.New("voting is closed for this week")
	}

	return s.queries.DeleteVote(ctx, db.DeleteVoteParams{
		UserID:  userID,
		GroupID: groupID,
		WeekOf:  weekOf,
	})
}

// GetVerdicts returns all verdicts for a group/week. Only available after deadline.
func (s *VerdictService) GetVerdicts(ctx context.Context, userID, groupID int32, weekOf string) ([]Verdict, error) {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Check membership
	if _, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrForbidden
		}
		return nil, err
	}

	ts := newTurnServiceFromQueries(s.queries)
	config, err := ts.BuildTurnConfig(ctx, group)
	if err != nil {
		return nil, err
	}

	if weekOf == "" {
		weekOf = getCurrentTurnWeekOf(config)
	}

	adminExt := 0
	if override, err := s.queries.GetTurnOverride(ctx, db.GetTurnOverrideParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
	}

	if !isResultsAvailable(weekOf, config, adminExt) {
		return nil, errors.New("results are not available yet")
	}

	votes, err := s.queries.GetVotesForGroupWeek(ctx, db.GetVotesForGroupWeekParams{
		GroupID: groupID,
		WeekOf:  weekOf,
	})
	if err != nil {
		return nil, err
	}

	watchStatuses, _ := s.queries.GetWatchStatuses(ctx, db.GetWatchStatusesParams{
		GroupID: groupID,
		WeekOf:  weekOf,
	})
	watchMap := make(map[int32]bool)
	for _, ws := range watchStatuses {
		watchMap[ws.UserID] = ws.Watched
	}

	verdicts := make([]Verdict, 0, len(votes))
	for _, v := range votes {
		rating := v.Rating
		verdict := Verdict{
			UserID:    v.UserID,
			GroupID:   groupID,
			WeekOf:    weekOf,
			Watched:   watchMap[v.UserID],
			Rating:    &rating,
			Review:    v.Review,
			Username:  v.Username,
			UpdatedAt: v.UpdatedAt,
		}
		verdicts = append(verdicts, verdict)
	}

	return verdicts, nil
}

// MarkWatched records that a user has watched (or not watched) the movie.
func (s *VerdictService) MarkWatched(ctx context.Context, userID, groupID int32, weekOf string, watched bool) error {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Check membership
	if _, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}

	if weekOf == "" {
		ts := newTurnServiceFromQueries(s.queries)
		config, err := ts.BuildTurnConfig(ctx, group)
		if err != nil {
			return err
		}
		weekOf = getCurrentTurnWeekOf(config)
	}

	return s.queries.UpsertWatchStatus(ctx, db.UpsertWatchStatusParams{
		UserID:  userID,
		GroupID: groupID,
		WeekOf:  weekOf,
		Watched: watched,
	})
}

// newTurnServiceFromQueries creates a minimal TurnService for internal use.
func newTurnServiceFromQueries(q *db.Queries) *TurnService {
	return &TurnService{queries: q}
}
