package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// MovieResult is a display-only search result from OMDb.
type MovieResult struct {
	ImdbID string
	Title  string
	Year   string
	Poster string
}

type omdbSearchResult struct {
	Search   []omdbSearchItem `json:"Search"`
	Response string           `json:"Response"`
}

type omdbSearchItem struct {
	ImdbID string `json:"imdbID"`
	Title  string `json:"Title"`
	Year   string `json:"Year"`
	Poster string `json:"Poster"`
}

type omdbDetailResult struct {
	ImdbID   string `json:"imdbID"`
	Title    string `json:"Title"`
	Year     string `json:"Year"`
	Poster   string `json:"Poster"`
	Director string `json:"Director"`
	Genre    string `json:"Genre"`
	Runtime  string `json:"Runtime"`
}

var imdbIDRegex = regexp.MustCompile(`(?i)^tt\d{7,8}$`)

func isImdbID(s string) bool {
	return imdbIDRegex.MatchString(s)
}

func filterNA(s string) *string {
	if s == "" || s == "N/A" {
		return nil
	}
	return &s
}

// parseRuntimeMinutes extracts minutes from OMDb runtime string like "132 min".
func parseRuntimeMinutes(runtime string) *int32 {
	if runtime == "" || runtime == "N/A" {
		return nil
	}
	re := regexp.MustCompile(`(\d+)`)
	match := re.FindString(runtime)
	if match == "" {
		return nil
	}
	mins, err := strconv.Atoi(match)
	if err != nil {
		return nil
	}
	m := int32(mins)
	return &m
}

// parseYear extracts year as int32 from string like "2024".
func parseYear(year string) *int32 {
	if year == "" || year == "N/A" {
		return nil
	}
	y, err := strconv.Atoi(year)
	if err != nil {
		return nil
	}
	yi := int32(y)
	return &yi
}

// MovieService handles movie search and selection.
type MovieService struct {
	queries *db.Queries
	config  Config
}

// NewMovieService creates a new MovieService.
func NewMovieService(q *db.Queries, cfg Config) *MovieService {
	return &MovieService{queries: q, config: cfg}
}

// Search queries OMDb and returns results. Results are display-only.
func (s *MovieService) Search(ctx context.Context, query string) ([]MovieResult, error) {
	if s.config.OmdbAPIKey == "" {
		return nil, errors.New("movie search is not configured: missing OMDB_API_KEY")
	}

	if len(query) < 2 {
		return []MovieResult{}, nil
	}

	// If the query looks like an IMDB ID, do a direct detail lookup.
	if isImdbID(query) {
		detail, err := s.fetchOMDbDetail(query)
		if err != nil || detail.ImdbID == "" {
			return []MovieResult{}, nil
		}
		result := MovieResult{
			ImdbID: detail.ImdbID,
			Title:  detail.Title,
		}
		if p := filterNA(detail.Poster); p != nil {
			result.Poster = *p
		}
		if y := filterNA(detail.Year); y != nil {
			result.Year = *y
		}
		return []MovieResult{result}, nil
	}

	apiURL := fmt.Sprintf("https://www.omdbapi.com/?s=%s&type=movie&apikey=%s",
		url.QueryEscape(query), s.config.OmdbAPIKey)

	resp, err := http.Get(apiURL) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("failed to search movies: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read movie search response: %w", err)
	}

	var result omdbSearchResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse movie search response: %w", err)
	}

	if result.Response != "True" || len(result.Search) == 0 {
		return []MovieResult{}, nil
	}

	limit := 8
	if len(result.Search) < limit {
		limit = len(result.Search)
	}

	movies := make([]MovieResult, 0, limit)
	for _, m := range result.Search[:limit] {
		item := MovieResult{ImdbID: m.ImdbID, Title: m.Title}
		if p := filterNA(m.Poster); p != nil {
			item.Poster = *p
		}
		if y := filterNA(m.Year); y != nil {
			item.Year = *y
		}
		movies = append(movies, item)
	}

	return movies, nil
}

// Select re-fetches OMDb data for the given imdbID and upserts it as the group's movie for weekOf.
// OMDb is the single source of truth (SSOT): all persisted metadata originates here.
// The method upserts the film into the canonical films table, then links it to the turn.
func (s *MovieService) Select(ctx context.Context, groupID int32, weekOf string, imdbID string, nominatorUserID *int32) (db.UpsertMovieRow, error) {
	title := ""
	var poster, director, genre *string
	var runtimeMinutes, year *int32

	if imdbID != "" && s.config.OmdbAPIKey != "" {
		detail, err := s.fetchOMDbDetail(imdbID)
		if err == nil && detail.ImdbID != "" {
			title = detail.Title
			poster = filterNA(detail.Poster)
			director = filterNA(detail.Director)
			genre = filterNA(detail.Genre)
			runtimeMinutes = parseRuntimeMinutes(detail.Runtime)
			year = parseYear(detail.Year)
		}
	}

	if title == "" {
		return db.UpsertMovieRow{}, errors.New("could not fetch movie details from OMDb")
	}

	title = sanitizeMovieTitle(title)
	cleanedImdbID := sanitizeImdbID(imdbID)
	if cleanedImdbID == "" {
		return db.UpsertMovieRow{}, errors.New("invalid imdb ID")
	}

	// Upsert into films table first
	film, err := s.queries.UpsertFilm(ctx, db.UpsertFilmParams{
		ImdbID:         cleanedImdbID,
		Title:          title,
		Year:           year,
		PosterUrl:      poster,
		Director:       director,
		Genre:          genre,
		RuntimeMinutes: runtimeMinutes,
	})
	if err != nil {
		return db.UpsertMovieRow{}, fmt.Errorf("failed to upsert film: %w", err)
	}

	// Get the turn for this group/week
	weekDate, err := time.Parse("2006-01-02", weekOf)
	if err != nil {
		return db.UpsertMovieRow{}, fmt.Errorf("invalid week_of format: %w", err)
	}
	var pgDate pgtype.Date
	pgDate.Time = weekDate
	pgDate.Valid = true

	turn, err := s.queries.GetTurn(ctx, db.GetTurnParams{
		GroupID: groupID,
		WeekOf:  pgDate,
	})
	if err != nil {
		return db.UpsertMovieRow{}, fmt.Errorf("failed to get turn for week %s: %w", weekOf, err)
	}

	// Upsert movie with film_id and turn_id
	return s.queries.UpsertMovie(ctx, db.UpsertMovieParams{
		GroupID:         groupID,
		TurnID:          turn.ID,
		FilmID:          film.ID,
		NominatorUserID: nominatorUserID,
	})
}

// fetchOMDbDetail fetches full movie details from OMDb by imdbID.
func (s *MovieService) fetchOMDbDetail(imdbID string) (omdbDetailResult, error) {
	apiURL := fmt.Sprintf("https://www.omdbapi.com/?i=%s&apikey=%s", imdbID, s.config.OmdbAPIKey)
	resp, err := http.Get(apiURL) //nolint:noctx
	if err != nil {
		return omdbDetailResult{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return omdbDetailResult{}, err
	}

	var d omdbDetailResult
	if err := json.Unmarshal(body, &d); err != nil {
		return omdbDetailResult{}, err
	}
	return d, nil
}

// sanitizeMovieTitle trims and limits movie title to 200 characters.
func sanitizeMovieTitle(raw string) string {
	return sanitizeText(raw, 200)
}

// sanitizeImdbID strips non-alphanumeric characters and limits to 20 chars.
func sanitizeImdbID(raw string) string {
	s := strings.TrimSpace(raw)
	// Remove non-alphanumeric
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	result := b.String()
	if len(result) > 20 {
		result = result[:20]
	}
	return result
}

// sanitizeText trims, removes control chars, and limits to maxLen.
func sanitizeText(raw string, maxLen int) string {
	s := strings.TrimSpace(raw)
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, s)
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	return s
}

// sanitizeReview trims and limits review to 2000 characters.
func sanitizeReview(raw string) string {
	return sanitizeText(raw, 2000)
}
