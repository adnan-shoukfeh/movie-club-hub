package service

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

var (
	ErrProfileNotFound    = errors.New("profile not found")
	ErrProfileAccessDenied = errors.New("access denied: no shared club membership")
	ErrInvalidLetterboxd  = errors.New("invalid Letterboxd username: alphanumeric and underscores only, max 50 characters")
)

// letterboxdUsernameRegex allows letters, digits, underscores, up to 50 chars.
// Empty string is allowed (used to clear the username).
var letterboxdUsernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{1,50}$`)

// isValidLetterboxdUsername returns true if username is valid for Letterboxd
// (alphanumeric + underscore, 1-50 chars). Empty string is also valid (clears the field).
func isValidLetterboxdUsername(username string) bool {
	if username == "" {
		return true
	}
	return letterboxdUsernameRegex.MatchString(username)
}

// parseGenres splits a comma-separated genre string into a trimmed slice.
// Returns nil for an empty input.
func parseGenres(genre string) []string {
	if genre == "" {
		return nil
	}
	parts := strings.Split(genre, ",")
	genres := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			genres = append(genres, trimmed)
		}
	}
	if len(genres) == 0 {
		return nil
	}
	return genres
}

// UserStats contains aggregated watch statistics for a user.
type UserStats struct {
	TotalWatched int64   `json:"totalWatched"`
	TotalReviews int64   `json:"totalReviews"`
	AvgRating    float64 `json:"avgRating"`
}

// ActivityItem represents a single watched film in a user's recent activity.
type ActivityItem struct {
	FilmID    int64     `json:"filmId"`
	Title     string    `json:"title"`
	Year      *int32    `json:"year"`
	PosterURL *string   `json:"posterUrl"`
	Rating    *float64  `json:"rating"`
	Review    *string   `json:"review"`
	WatchedAt time.Time `json:"watchedAt"`
}

// ProfileResponse is the full profile payload returned by GetProfile.
type ProfileResponse struct {
	ID                 int32          `json:"id"`
	Username           string         `json:"username"`
	AvatarURL          *string        `json:"avatarUrl"`
	LetterboxdUsername *string        `json:"letterboxdUsername"`
	CreatedAt          time.Time      `json:"createdAt"`
	Stats              UserStats      `json:"stats"`
	TopGenres          []string       `json:"topGenres"`
	RecentActivity     []ActivityItem `json:"recentActivity"`
}

// ProfileService handles user profile reads and updates.
type ProfileService struct {
	queries *db.Queries
}

// NewProfileService creates a new ProfileService.
func NewProfileService(q *db.Queries) *ProfileService {
	return &ProfileService{queries: q}
}

// GetProfile returns the full profile for targetUserID as seen by viewerUserID.
// If viewerUserID == targetUserID the viewer sees their own full profile.
// Otherwise, the viewer must share at least one club with the target.
// Errors: ErrProfileNotFound, ErrProfileAccessDenied, wrapped DB errors.
func (s *ProfileService) GetProfile(ctx context.Context, targetUserID, viewerUserID int32) (*ProfileResponse, error) {
	// Fetch core profile row.
	profile, err := s.queries.GetUserProfile(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("get user profile: %w", err)
	}

	// Access-control: other users must share a club.
	isSelf := viewerUserID == targetUserID
	if !isSelf {
		shared, err := s.queries.CheckSharedClubMembership(ctx, db.CheckSharedClubMembershipParams{
			UserID:   viewerUserID,
			UserID_2: targetUserID,
		})
		if err != nil {
			return nil, fmt.Errorf("check shared membership: %w", err)
		}
		if !shared {
			return nil, ErrProfileAccessDenied
		}
	}

	// Stats.
	statsRow, err := s.queries.GetUserStats(ctx, targetUserID)
	if err != nil {
		return nil, fmt.Errorf("get user stats: %w", err)
	}
	stats := UserStats{
		TotalWatched: statsRow.TotalWatched,
		TotalReviews: statsRow.TotalReviews,
		AvgRating:    toFloat64(statsRow.AvgRating),
	}

	// Top genres.
	genreRows, err := s.queries.GetUserTopGenres(ctx, targetUserID)
	if err != nil {
		return nil, fmt.Errorf("get top genres: %w", err)
	}
	topGenres := make([]string, 0, len(genreRows))
	for _, row := range genreRows {
		if row.Genre == nil {
			continue
		}
		// Each genre field may be a comma-separated list (e.g. "Drama, Thriller").
		topGenres = append(topGenres, parseGenres(*row.Genre)...)
	}

	// Recent activity (scope depends on viewer).
	var activityRows []db.GetUserRecentActivityRow
	var activityRowsForViewer []db.GetUserRecentActivityForViewerRow

	if isSelf {
		activityRows, err = s.queries.GetUserRecentActivity(ctx, targetUserID)
		if err != nil {
			return nil, fmt.Errorf("get recent activity: %w", err)
		}
	} else {
		activityRowsForViewer, err = s.queries.GetUserRecentActivityForViewer(ctx, db.GetUserRecentActivityForViewerParams{
			UserID:   targetUserID,
			UserID_2: viewerUserID,
		})
		if err != nil {
			return nil, fmt.Errorf("get recent activity for viewer: %w", err)
		}
	}

	recentActivity := buildActivityItems(activityRows, activityRowsForViewer)

	return &ProfileResponse{
		ID:                 profile.ID,
		Username:           profile.Username,
		AvatarURL:          profile.AvatarUrl,
		LetterboxdUsername: profile.LetterboxdUsername,
		CreatedAt:          profile.CreatedAt,
		Stats:              stats,
		TopGenres:          topGenres,
		RecentActivity:     recentActivity,
	}, nil
}

// UpdateLetterboxdUsername validates and sets the Letterboxd username for a user.
// Pass an empty string to clear the field.
// Errors: ErrInvalidLetterboxd, ErrProfileNotFound, wrapped DB errors.
func (s *ProfileService) UpdateLetterboxdUsername(ctx context.Context, userID int32, username string) (*ProfileResponse, error) {
	if !isValidLetterboxdUsername(username) {
		return nil, ErrInvalidLetterboxd
	}

	var ptr *string
	if username != "" {
		ptr = &username
	}

	row, err := s.queries.UpdateLetterboxdUsername(ctx, db.UpdateLetterboxdUsernameParams{
		ID:                 userID,
		LetterboxdUsername: ptr,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("update letterboxd username: %w", err)
	}

	return &ProfileResponse{
		ID:                 row.ID,
		Username:           row.Username,
		AvatarURL:          row.AvatarUrl,
		LetterboxdUsername: row.LetterboxdUsername,
		CreatedAt:          row.CreatedAt,
	}, nil
}

// buildActivityItems converts DB rows into ActivityItem slices.
// Exactly one of the two input slices will be non-empty.
func buildActivityItems(
	rows []db.GetUserRecentActivityRow,
	rowsForViewer []db.GetUserRecentActivityForViewerRow,
) []ActivityItem {
	if len(rows) > 0 {
		items := make([]ActivityItem, 0, len(rows))
		for _, r := range rows {
			items = append(items, ActivityItem{
				FilmID:    r.FilmID,
				Title:     r.Title,
				Year:      r.Year,
				PosterURL: r.PosterUrl,
				Rating:    numericToFloat64Ptr(r.Rating),
				Review:    r.Review,
				WatchedAt: r.WatchedAt.Time,
			})
		}
		return items
	}

	items := make([]ActivityItem, 0, len(rowsForViewer))
	for _, r := range rowsForViewer {
		items = append(items, ActivityItem{
			FilmID:    r.FilmID,
			Title:     r.Title,
			Year:      r.Year,
			PosterURL: r.PosterUrl,
			Rating:    numericToFloat64Ptr(r.Rating),
			Review:    r.Review,
			WatchedAt: r.WatchedAt.Time,
		})
	}
	return items
}

// numericToFloat64Ptr converts a pgtype.Numeric rating to *float64.
func numericToFloat64Ptr(n pgtype.Numeric) *float64 {
	val, err := n.Value()
	if err != nil || val == nil {
		return nil
	}
	f := driverValueToFloat64(val)
	return &f
}

// toFloat64 converts the interface{} returned by GetUserStatsRow.AvgRating to float64.
// The DB returns a numeric or nil; we default to 0 on failure.
func toFloat64(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int64:
		return float64(val)
	case []byte:
		f := 0.0
		fmt.Sscanf(string(val), "%f", &f)
		return f
	case string:
		f := 0.0
		fmt.Sscanf(val, "%f", &f)
		return f
	case pgtype.Numeric:
		if !val.Valid {
			return 0
		}
		f8, err := val.Float64Value()
		if err != nil || !f8.Valid {
			return 0
		}
		return f8.Float64
	}
	return 0
}

// driverValueToFloat64 converts a driver.Value to float64.
func driverValueToFloat64(v driver.Value) float64 {
	return toFloat64(v)
}
