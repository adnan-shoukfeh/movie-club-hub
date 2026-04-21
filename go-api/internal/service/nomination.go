package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// NominationService handles movie nominations.
type NominationService struct {
	queries *db.Queries
	config  Config
}

// NewNominationService creates a new NominationService.
func NewNominationService(q *db.Queries, cfg Config) *NominationService {
	return &NominationService{queries: q, config: cfg}
}

// List returns all nominations for a group.
func (s *NominationService) List(ctx context.Context, groupID int32) ([]db.GetNominationsByGroupRow, error) {
	return s.queries.GetNominationsByGroup(ctx, groupID)
}

// Create adds a nomination to the group on behalf of userID.
// First upserts the film into the canonical films table, then creates the nomination.
func (s *NominationService) Create(ctx context.Context, userID, groupID int32, imdbID, title, year string, poster *string) (db.CreateNominationRow, error) {
	imdbID = sanitizeImdbID(imdbID)
	title = strings.TrimSpace(title)
	if len(title) > 500 {
		title = title[:500]
	}

	if imdbID == "" || title == "" {
		return db.CreateNominationRow{}, errors.New("imdbId and title are required")
	}

	// Parse year to int32
	var yearInt *int32
	if trimmed := strings.TrimSpace(year); trimmed != "" {
		yearInt = parseYear(trimmed)
	}

	// Clean poster
	var posterPtr *string
	if poster != nil {
		if trimmed := strings.TrimSpace(*poster); trimmed != "" {
			posterPtr = &trimmed
		}
	}

	// Upsert into films table first
	film, err := s.queries.UpsertFilm(ctx, db.UpsertFilmParams{
		ImdbID:    imdbID,
		Title:     title,
		Year:      yearInt,
		PosterUrl: posterPtr,
	})
	if err != nil {
		return db.CreateNominationRow{}, fmt.Errorf("failed to upsert film: %w", err)
	}

	// Create nomination with film_id
	nom, err := s.queries.CreateNomination(ctx, db.CreateNominationParams{
		GroupID: groupID,
		UserID:  userID,
		FilmID:  film.ID,
	})
	if err != nil {
		return db.CreateNominationRow{}, err
	}

	return nom, nil
}

// Delete removes a nomination. Only the nominator, admins, or owners may delete.
func (s *NominationService) Delete(ctx context.Context, userID, groupID int32, nominationID int32) error {
	mem, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}

	nom, err := s.queries.GetNominationByID(ctx, nominationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if nom.UserID != userID && mem.Role != "owner" && mem.Role != "admin" {
		return ErrForbidden
	}

	return s.queries.DeleteNomination(ctx, nominationID)
}

// GetAvailableForTurn returns nominations for a group (all nominations are potential picks).
func (s *NominationService) GetAvailableForTurn(ctx context.Context, groupID int32, weekOf string) ([]db.GetNominationsByGroupRow, error) {
	return s.queries.GetNominationsByGroup(ctx, groupID)
}
