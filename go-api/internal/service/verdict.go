package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// Verdict is the unified domain type combining vote and watch status.
type Verdict struct {
	UserID    int32
	GroupID   int32
	WeekOf    string
	Watched   bool
	Rating    *float32
	Review    *string
	Username  string
	UpdatedAt time.Time
}

// VerdictService unifies vote and watch status operations.
// Now uses the verdicts table as the single source of truth.
type VerdictService struct {
	queries *db.Queries
	pool    *pgxpool.Pool
	config  Config
}

// NewVerdictService creates a new VerdictService.
func NewVerdictService(q *db.Queries, pool *pgxpool.Pool, cfg Config) *VerdictService {
	return &VerdictService{queries: q, pool: pool, config: cfg}
}

// SubmitVerdict writes a verdict atomically.
//
// Rules:
//   - watched=false: upsert verdict with watched=false, clear rating/review
//   - watched=true, rating provided: upsert verdict with rating
//   - watched=true, no rating: upsert verdict with watched=true only
//
// Validates voting window is open. Rating must be 1.0–10.0 if provided.
func (s *VerdictService) SubmitVerdict(ctx context.Context, userID, groupID int32, weekOf string, watched bool, rating *float64, review *string) error {
	if rating != nil {
		if *rating < 1 || *rating > 10 {
			return errors.New("rating must be between 1 and 10")
		}
	}

	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

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

	if weekOf == "" {
		currentWeekOf, err := ts.GetCurrentWeekOf(ctx, groupID)
		if err != nil {
			return err
		}
		weekOf = currentWeekOf
	}

	// Get or create the turn
	turn, err := ts.EnsureTurnExists(ctx, groupID, weekOf)
	if err != nil {
		return err
	}

	// Check movie exists
	if _, err := s.queries.GetMovieByGroupWeek(ctx, db.GetMovieByGroupWeekParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err != nil {
		return errors.New("no movie set for this week")
	}

	// Check voting window using turns table
	config, err := ts.BuildTurnConfig(ctx, group)
	if err != nil {
		return err
	}

	currentWeekOf := getCurrentTurnWeekOf(config)
	isCurrentTurn := weekOf == currentWeekOf

	// Check if reviews are unlocked or voting is open
	reviewsUnlocked := turn.ReviewsUnlocked

	adminExt := 0
	startOffset := 0
	if override, err := s.queries.GetTurnOverride(ctx, db.GetTurnOverrideParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		startOffset = int(override.StartOffsetDays)
		reviewsUnlocked = reviewsUnlocked || override.ReviewUnlockedByAdmin
	}

	if !((isVotingOpen(weekOf, config, adminExt, startOffset) && isCurrentTurn) || reviewsUnlocked) {
		return errors.New("voting is closed for this week")
	}

	// Prepare verdict values
	var ratingNumeric pgtype.Numeric
	var reviewPtr *string

	if !watched {
		// Not watched: clear rating and review
		ratingNumeric = pgtype.Numeric{Valid: false}
		reviewPtr = nil
	} else if rating != nil {
		// Watched with rating
		rounded := math.Round(*rating*10) / 10
		// Use Scan to parse the numeric value
		if err := ratingNumeric.Scan(fmt.Sprintf("%.1f", rounded)); err != nil {
			return fmt.Errorf("invalid rating: %w", err)
		}
		if review != nil {
			s2 := sanitizeReview(*review)
			reviewPtr = &s2
		}
	} else {
		// Watched without rating
		ratingNumeric = pgtype.Numeric{Valid: false}
		reviewPtr = nil
	}

	_, err = s.queries.UpsertVerdict(ctx, db.UpsertVerdictParams{
		TurnID:  turn.ID,
		UserID:  userID,
		Watched: watched,
		Rating:  ratingNumeric,
		Review:  reviewPtr,
	})
	return err
}

// DeleteVerdict removes a verdict's rating (keeps watched status).
func (s *VerdictService) DeleteVerdict(ctx context.Context, userID, groupID int32, weekOf string) error {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

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

	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
	if err != nil {
		return err
	}

	isCurrentTurn := weekOf == currentWeekOf
	reviewsUnlocked := turn.ReviewsUnlocked

	adminExt := 0
	startOffset := 0
	if override, err := s.queries.GetTurnOverride(ctx, db.GetTurnOverrideParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		startOffset = int(override.StartOffsetDays)
		reviewsUnlocked = reviewsUnlocked || override.ReviewUnlockedByAdmin
	}

	if !((isVotingOpen(weekOf, config, adminExt, startOffset) && isCurrentTurn) || reviewsUnlocked) {
		return errors.New("voting is closed for this week")
	}

	return s.queries.ClearVerdictRating(ctx, db.ClearVerdictRatingParams{
		TurnID: turn.ID,
		UserID: userID,
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

	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(weekOf),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []Verdict{}, nil
		}
		return nil, err
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

	if !isResultsAvailable(weekOf, config, adminExt, startOffset) {
		return nil, errors.New("results are not available yet")
	}

	dbVerdicts, err := s.queries.GetVerdictsForTurn(ctx, turn.ID)
	if err != nil {
		return nil, err
	}

	verdicts := make([]Verdict, 0, len(dbVerdicts))
	for _, v := range dbVerdicts {
		var rating *float32
		if v.Rating.Valid {
			f, _ := v.Rating.Float64Value()
			r := float32(f.Float64)
			rating = &r
		}

		verdicts = append(verdicts, Verdict{
			UserID:    v.UserID,
			GroupID:   groupID,
			WeekOf:    weekOf,
			Watched:   v.Watched,
			Rating:    rating,
			Review:    v.Review,
			Username:  v.Username,
			UpdatedAt: v.UpdatedAt.Time,
		})
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

	if weekOf == "" {
		config, err := ts.BuildTurnConfig(ctx, group)
		if err != nil {
			return err
		}
		weekOf = getCurrentTurnWeekOf(config)
	}

	turn, err := ts.EnsureTurnExists(ctx, groupID, weekOf)
	if err != nil {
		return err
	}

	// Get existing verdict to preserve rating/review if any
	existing, err := s.queries.GetVerdict(ctx, db.GetVerdictParams{
		TurnID: turn.ID,
		UserID: userID,
	})

	var ratingNumeric pgtype.Numeric
	var reviewPtr *string

	if err == nil {
		// Existing verdict - preserve rating/review if still watched
		if watched {
			ratingNumeric = existing.Rating
			reviewPtr = existing.Review
		} else {
			// Unwatching clears rating/review
			ratingNumeric = pgtype.Numeric{Valid: false}
			reviewPtr = nil
		}
	} else {
		// No existing verdict
		ratingNumeric = pgtype.Numeric{Valid: false}
		reviewPtr = nil
	}

	_, err = s.queries.UpsertVerdict(ctx, db.UpsertVerdictParams{
		TurnID:  turn.ID,
		UserID:  userID,
		Watched: watched,
		Rating:  ratingNumeric,
		Review:  reviewPtr,
	})
	return err
}

// newTurnServiceFromQueries creates a minimal TurnService for internal use.
func newTurnServiceFromQueries(q *db.Queries) *TurnService {
	return &TurnService{queries: q}
}
