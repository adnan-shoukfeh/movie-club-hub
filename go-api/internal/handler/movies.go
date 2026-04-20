package handler

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

func (h *Handler) SearchMovies(w http.ResponseWriter, r *http.Request) {
	q := queryString(r, "q")
	if q == "" {
		writeError(w, http.StatusBadRequest, "Missing query parameter: q")
		return
	}

	results, err := h.movieSvc.Search(r.Context(), q)
	if err != nil {
		if err.Error() == "movie search is not configured: missing OMDB_API_KEY" {
			writeError(w, http.StatusServiceUnavailable, "Movie search is not configured. Please add OMDB_API_KEY.")
			return
		}
		writeError(w, http.StatusBadGateway, "Failed to search movies")
		return
	}

	type movieResult struct {
		ImdbID string  `json:"imdbId"`
		Title  string  `json:"title"`
		Year   *string `json:"year"`
		Poster *string `json:"poster"`
	}

	movies := make([]movieResult, 0, len(results))
	for _, m := range results {
		item := movieResult{ImdbID: m.ImdbID, Title: m.Title}
		if m.Year != "" {
			y := m.Year
			item.Year = &y
		}
		if m.Poster != "" {
			p := m.Poster
			item.Poster = &p
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

	if req.ImdbID == nil || sanitizeImdbID(*req.ImdbID) == "" {
		if sanitizeMovieTitle(req.Title) == "" {
			writeError(w, http.StatusBadRequest, "Movie title cannot be empty.")
			return
		}
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

	// Resolve nominator from nomination if imdbID provided
	var nominatorUserID *int32
	var imdbID string
	if req.ImdbID != nil {
		imdbID = sanitizeImdbID(*req.ImdbID)
		if imdbID != "" {
			if nom, err := h.q.GetNominationByGroupAndIMDB(r.Context(), db.GetNominationByGroupAndIMDBParams{
				GroupID: groupID, ImdbID: imdbID,
			}); err == nil {
				nominatorUserID = &nom.UserID
				_ = h.q.DeleteNomination(r.Context(), nom.ID)
			}
		}
	}

	movie, err := h.movieSvc.Select(r.Context(), groupID, weekOf, imdbID, nominatorUserID)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Group not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
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
