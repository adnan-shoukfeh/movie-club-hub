package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

type omdbSearchResult struct {
	Search   []omdbMovie `json:"Search"`
	Response string      `json:"Response"`
}

type omdbMovie struct {
	ImdbID string `json:"imdbID"`
	Title  string `json:"Title"`
	Year   string `json:"Year"`
	Poster string `json:"Poster"`
}

type omdbDetail struct {
	ImdbID   string `json:"imdbID"`
	Title    string `json:"Title"`
	Year     string `json:"Year"`
	Poster   string `json:"Poster"`
	Director string `json:"Director"`
	Genre    string `json:"Genre"`
	Runtime  string `json:"Runtime"`
}

func (h *Handler) SearchMovies(w http.ResponseWriter, r *http.Request) {
	apiKey := os.Getenv("OMDB_API_KEY")
	if apiKey == "" {
		writeError(w, http.StatusServiceUnavailable, "Movie search is not configured. Please add OMDB_API_KEY.")
		return
	}

	q := queryString(r, "q")
	if q == "" {
		writeError(w, http.StatusBadRequest, "Missing query parameter: q")
		return
	}

	if len(q) < 2 {
		writeJSON(w, http.StatusOK, []any{})
		return
	}

	type movieResult struct {
		ImdbID string  `json:"imdbId"`
		Title  string  `json:"title"`
		Year   *string `json:"year"`
		Poster *string `json:"poster"`
	}

	// If the query looks like an IMDB ID, do a direct detail lookup instead of a title search.
	if isImdbID(q) {
		detail, err := h.fetchOMDBDetail(q, apiKey)
		if err != nil || detail.ImdbID == "" {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		item := movieResult{ImdbID: detail.ImdbID, Title: detail.Title}
		item.Year = filterNA(detail.Year)
		item.Poster = filterNA(detail.Poster)
		writeJSON(w, http.StatusOK, []movieResult{item})
		return
	}

	apiURL := fmt.Sprintf("https://www.omdbapi.com/?s=%s&type=movie&apikey=%s", url.QueryEscape(q), apiKey)

	var body []byte
	if cached, ok := h.omdbCache.get("search:" + q); ok {
		body = cached
	} else {
		resp, err := http.Get(apiURL)
		if err != nil {
			writeError(w, http.StatusBadGateway, "Failed to search movies")
			return
		}
		defer resp.Body.Close()
		body, err = io.ReadAll(resp.Body)
		if err != nil {
			writeError(w, http.StatusBadGateway, "Failed to read movie search response")
			return
		}
		h.omdbCache.set("search:"+q, body, 1*time.Hour)
	}

	var result omdbSearchResult
	if err := json.Unmarshal(body, &result); err != nil {
		writeError(w, http.StatusBadGateway, "Failed to parse movie search response")
		return
	}

	if result.Response != "True" || len(result.Search) == 0 {
		writeJSON(w, http.StatusOK, []any{})
		return
	}

	limit := 8
	if len(result.Search) < limit {
		limit = len(result.Search)
	}

	movies := make([]movieResult, 0, limit)
	for _, m := range result.Search[:limit] {
		item := movieResult{ImdbID: m.ImdbID, Title: m.Title}
		if m.Year != "" && m.Year != "N/A" {
			item.Year = &m.Year
		}
		if m.Poster != "" && m.Poster != "N/A" {
			item.Poster = &m.Poster
		}
		movies = append(movies, item)
	}

	writeJSON(w, http.StatusOK, movies)
}

func (h *Handler) SetMovie(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Group not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	mem, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		Title  string  `json:"title"`
		ImdbID *string `json:"imdbId"`
		WeekOf *string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	title := sanitizeMovieTitle(req.Title)
	if title == "" {
		writeError(w, http.StatusBadRequest, "Movie title cannot be empty.")
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)
	weekOf := getCurrentTurnWeekOf(config)
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	userID := h.userID(r)

	// Authorization
	if mem.Role != "owner" && mem.Role != "admin" {
		currentWeekOf := getCurrentTurnWeekOf(config)
		currentIdx := getTurnIndexForDate(currentWeekOf, config)
		nextWeekOf := getTurnStartDate(currentIdx+1, config)

		pa, paErr := h.q.GetPickerAssignment(r.Context(), db.GetPickerAssignmentParams{
			GroupID: groupID, WeekOf: weekOf,
		})
		isAssignedPicker := paErr == nil && pa.UserID == userID

		if weekOf == nextWeekOf && isAssignedPicker {
			// Picker may set their movie for the immediately-next turn
		} else {
			override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
				GroupID: groupID, WeekOf: timeToPgDate(weekOf),
			})
			if err != nil || !override.MovieUnlockedByAdmin {
				writeError(w, http.StatusForbidden, "Only admins and owners can set the movie")
				return
			}
			if !isAssignedPicker {
				writeError(w, http.StatusForbidden, "Only the assigned picker can set the movie when it has been unlocked")
				return
			}
		}
	}

	var imdbID *string
	if req.ImdbID != nil {
		cleaned := sanitizeImdbID(*req.ImdbID)
		if cleaned != "" {
			imdbID = &cleaned
		}
	}

	// Fetch OMDb details if imdbId provided
	var poster, director, genre, runtime, year *string
	if imdbID != nil {
		if apiKey := os.Getenv("OMDB_API_KEY"); apiKey != "" {
			if detail, err := h.fetchOMDBDetail(*imdbID, apiKey); err == nil {
				poster = filterNA(detail.Poster)
				director = filterNA(detail.Director)
				genre = filterNA(detail.Genre)
				runtime = filterNA(detail.Runtime)
				year = filterNA(detail.Year)
			}
		}
	}

	// Check nomination attribution
	var nominatorUserID *int32
	if imdbID != nil {
		if nom, err := h.q.GetNominationByGroupAndIMDB(r.Context(), db.GetNominationByGroupAndIMDBParams{
			GroupID: groupID, ImdbID: *imdbID,
		}); err == nil {
			nominatorUserID = &nom.UserID
			_ = h.q.DeleteNomination(r.Context(), nom.ID)
		}
	}

	setByUserID := userID
	movie, err := h.q.UpsertMovie(r.Context(), db.UpsertMovieParams{
		GroupID: groupID, Title: title, WeekOf: weekOf,
		SetByUserID: &setByUserID, NominatorUserID: nominatorUserID,
		ImdbID: imdbID, Poster: poster, Director: director,
		Genre: genre, Runtime: runtime, Year: year,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to set movie")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id": movie.ID, "title": movie.Title, "weekOf": movie.WeekOf,
		"imdbId": movie.ImdbID, "poster": movie.Poster,
		"director": movie.Director, "genre": movie.Genre,
		"runtime": movie.Runtime, "year": movie.Year,
		"nominatorUserId": movie.NominatorUserID,
	})
}

func filterNA(s string) *string {
	if s == "" || s == "N/A" {
		return nil
	}
	return &s
}

var imdbIDRe = regexp.MustCompile(`(?i)^tt\d{7,8}$`)

func isImdbID(s string) bool {
	return imdbIDRe.MatchString(s)
}

func (h *Handler) fetchOMDBDetail(imdbID, apiKey string) (omdbDetail, error) {
	cacheKey := "detail:" + imdbID
	if cached, ok := h.omdbCache.get(cacheKey); ok {
		var d omdbDetail
		if err := json.Unmarshal(cached, &d); err == nil {
			return d, nil
		}
	}
	apiURL := fmt.Sprintf("https://www.omdbapi.com/?i=%s&apikey=%s", imdbID, apiKey)
	resp, err := http.Get(apiURL)
	if err != nil {
		return omdbDetail{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return omdbDetail{}, err
	}
	h.omdbCache.set(cacheKey, body, 24*time.Hour)
	var d omdbDetail
	if err := json.Unmarshal(body, &d); err != nil {
		return omdbDetail{}, err
	}
	return d, nil
}
