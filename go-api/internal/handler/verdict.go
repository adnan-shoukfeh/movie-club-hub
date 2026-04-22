package handler

import (
	"errors"
	"fmt"
	"math"
	"net/http"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

func (h *Handler) SubmitVerdict(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		Rating  float64 `json:"rating"`
		Review  *string `json:"review"`
		WeekOf  *string `json:"weekOf"`
		Watched *bool   `json:"watched"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Rating < 1 || req.Rating > 10 {
		writeError(w, http.StatusBadRequest, "Rating must be between 1 and 10")
		return
	}
	rounded := math.Round(req.Rating*10) / 10

	weekOf := ""
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	watched := req.Watched != nil && *req.Watched

	userID := h.userID(r)

	if err := h.verdictSvc.SubmitVerdict(r.Context(), userID, groupID, weekOf, watched, &rounded, req.Review); err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Group not found")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Not a member of this group")
		default:
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	writeMessage(w, http.StatusOK, "Verdict submitted")
}

func (h *Handler) DeleteVerdict(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf *string `json:"weekOf"`
	}
	// Body is optional for DELETE
	_ = decodeBody(r, &req)

	weekOf := ""
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	userID := h.userID(r)

	if err := h.verdictSvc.DeleteVerdict(r.Context(), userID, groupID, weekOf); err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Group not found")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Not a member of this group")
		default:
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	writeMessage(w, http.StatusOK, "Verdict cleared")
}

func (h *Handler) GetVerdicts(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	weekOf := queryString(r, "weekOf")
	if !isValidDateStr(weekOf) {
		weekOf = ""
	}

	userID := h.userID(r)

	verdicts, err := h.verdictSvc.GetVerdicts(r.Context(), userID, groupID, weekOf)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Group not found")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Not a member of this group")
		default:
			writeError(w, http.StatusForbidden, err.Error())
		}
		return
	}

	// Get the actual weekOf from the first verdict, or use provided/default
	actualWeekOf := weekOf
	if len(verdicts) > 0 {
		actualWeekOf = verdicts[0].WeekOf
	} else if weekOf == "" {
		// Get current turn week
		group, err := h.q.GetGroupByID(r.Context(), groupID)
		if err == nil {
			if config, err := h.buildTurnConfig(r.Context(), group); err == nil {
				actualWeekOf = getCurrentTurnWeekOf(config)
			}
		}
	}

	// Build votes list
	type voteEntry struct {
		Username  string  `json:"username"`
		Rating    float32 `json:"rating"`
		Review    *string `json:"review"`
		UpdatedAt string  `json:"updatedAt"`
		Watched   bool    `json:"watched"`
	}
	votes := make([]voteEntry, 0, len(verdicts))
	var totalRating float64
	ratingCount := 0

	// Distribution: ratings 1-10
	distribution := make([]struct {
		Rating int `json:"rating"`
		Count  int `json:"count"`
	}, 10)
	for i := range distribution {
		distribution[i].Rating = i + 1
	}

	for _, v := range verdicts {
		entry := voteEntry{
			Username:  v.Username,
			Review:    v.Review,
			UpdatedAt: v.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
			Watched:   v.Watched,
		}
		if v.Rating != nil {
			rating := float32(math.Round(float64(*v.Rating)*10) / 10)
			entry.Rating = rating
			totalRating += float64(rating)
			ratingCount++
			// Add to distribution (round to nearest integer for bucket)
			bucket := int(math.Round(float64(rating)))
			if bucket >= 1 && bucket <= 10 {
				distribution[bucket-1].Count++
			}
		}
		votes = append(votes, entry)
	}

	// Calculate average
	var averageRating float64
	if ratingCount > 0 {
		averageRating = math.Round(totalRating/float64(ratingCount)*10) / 10
	}

	// Get movie data
	var movieData any
	movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID,
		WeekOf:  timeToPgDate(actualWeekOf),
	})
	if err == nil {
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
		movieData = map[string]any{
			"id":      movie.ID,
			"title":   movie.Title,
			"weekOf":  pgDateToString(movie.WeekOf),
			"imdbId":  movie.ImdbID,
			"poster":  movie.PosterUrl,
			"director": movie.Director,
			"genre":   movie.Genre,
			"runtime": runtimeStr,
			"year":    yearStr,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"weekOf":        actualWeekOf,
		"movieData":     movieData,
		"averageRating": averageRating,
		"totalVotes":    ratingCount,
		"distribution":  distribution,
		"votes":         votes,
	})
}
