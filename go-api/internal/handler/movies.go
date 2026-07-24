package handler

import (
	"errors"
	"fmt"
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

	// Title is intentionally excluded: all movie metadata comes from OMDb (SSOT).
	// The frontend may display search results, but only the imdbId is trusted for storage.
	var req struct {
		ImdbID *string `json:"imdbId"`
		WeekOf *string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ImdbID == nil || sanitizeImdbID(*req.ImdbID) == "" {
		writeError(w, http.StatusBadRequest, "imdbId is required.")
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)
	currentWeekOf := getCurrentTurnWeekOf(config)
	if ct, err := h.q.GetCurrentTurn(r.Context(), groupID); err == nil {
		currentWeekOf = pgDateToString(ct.WeekOf)
	}

	weekOf := currentWeekOf
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	userID := h.userID(r)

	// Authorization: a non-admin may set the movie only for a turn they are the
	// assigned picker of, and only for the current turn or a later one (they can't
	// rewrite a past turn's movie). Admins and owners are unrestricted.
	if mem.Role != "owner" && mem.Role != "admin" {
		pa, paErr := h.q.GetPickerAssignment(r.Context(), db.GetPickerAssignmentParams{
			GroupID: groupID, WeekOf: timeToPgDate(weekOf),
		})
		isAssignedPicker := paErr == nil && pa.UserID == userID

		if isAssignedPicker && weekOf >= currentWeekOf {
			// The turn's assigned picker may set or change their own movie.
		} else {
			override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
				GroupID: groupID, WeekOf: timeToPgDate(weekOf),
			})
			if err != nil || !override.MovieUnlockedByAdmin {
				writeError(w, http.StatusForbidden, "Only admins and owners can set the movie")
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

	// Schedule weeks are computed (getTurnStartDate) and may not yet have a
	// turns row — e.g. an admin backfilling a movie on a past or future week.
	// Ensure the row exists so movieSvc.Select can attach the movie to it.
	if _, err := h.turnSvc.EnsureTurnExists(r.Context(), groupID, weekOf); err != nil {
		writeError(w, http.StatusBadRequest, "Could not resolve a turn for the selected week")
		return
	}

	_, err = h.movieSvc.Select(r.Context(), groupID, weekOf, imdbID, nominatorUserID)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Group not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Fetch full movie data including film details
	movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch movie after insert")
		return
	}

	var runtimeStr *string
	if movie.RuntimeMinutes != nil {
		s := fmt.Sprintf("%d min", *movie.RuntimeMinutes)
		runtimeStr = &s
	}
	var yearStr *string
	if movie.Year != nil {
		s := fmt.Sprintf("%d", *movie.Year)
		yearStr = &s
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id": movie.ID, "title": movie.Title, "weekOf": pgDateToString(movie.WeekOf),
		"imdbId": movie.ImdbID, "poster": movie.PosterUrl,
		"director": movie.Director, "genre": movie.Genre,
		"runtime": runtimeStr, "year": yearStr,
		"nominatorUserId": movie.NominatorUserID,
	})
}
