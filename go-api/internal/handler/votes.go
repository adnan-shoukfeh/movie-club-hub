package handler

import (
	"errors"
	"math"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

func (h *Handler) SubmitVote(w http.ResponseWriter, r *http.Request) {
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

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		Rating float64 `json:"rating"`
		Review *string `json:"review"`
		WeekOf *string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Rating < 1 || req.Rating > 10 {
		writeError(w, http.StatusBadRequest, "Rating must be between 1 and 10")
		return
	}
	rating := float32(math.Round(req.Rating*10) / 10)

	config, _ := h.buildTurnConfig(r.Context(), group)
	currentWeekOf := getCurrentTurnWeekOf(config)
	weekOf := currentWeekOf
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	// Check movie exists
	if _, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: weekOf,
	}); err != nil {
		writeError(w, http.StatusBadRequest, "No movie set for this week")
		return
	}

	// Check voting window
	adminExt := 0
	reviewUnlocked := false
	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		reviewUnlocked = override.ReviewUnlockedByAdmin
	}

	isCurrentTurn := weekOf == currentWeekOf
	if !((isVotingOpen(weekOf, config, adminExt) && isCurrentTurn) || reviewUnlocked) {
		writeError(w, http.StatusBadRequest, "Voting is closed for this week")
		return
	}

	var review *string
	if req.Review != nil {
		sanitized := sanitizeReview(*req.Review)
		review = &sanitized
	}

	userID := h.userID(r)

	// Check if updating existing vote
	alreadyVoted, _ := h.q.HasUserVoted(r.Context(), db.HasUserVotedParams{
		UserID: userID, GroupID: groupID, WeekOf: weekOf,
	})

	if err := h.q.UpsertVote(r.Context(), db.UpsertVoteParams{
		UserID: userID, GroupID: groupID, Rating: rating, Review: review, WeekOf: weekOf,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to submit vote")
		return
	}

	msg := "Vote submitted"
	if alreadyVoted {
		msg = "Vote updated"
	}
	writeMessage(w, http.StatusOK, msg)
}

func (h *Handler) DeleteVote(w http.ResponseWriter, r *http.Request) {
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

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf *string `json:"weekOf"`
	}
	// Body is optional for DELETE
	_ = decodeBody(r, &req)

	config, _ := h.buildTurnConfig(r.Context(), group)
	currentWeekOf := getCurrentTurnWeekOf(config)
	weekOf := currentWeekOf
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	adminExt := 0
	reviewUnlocked := false
	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		reviewUnlocked = override.ReviewUnlockedByAdmin
	}

	isCurrentTurn := weekOf == currentWeekOf
	if !((isVotingOpen(weekOf, config, adminExt) && isCurrentTurn) || reviewUnlocked) {
		writeError(w, http.StatusBadRequest, "Voting is closed for this week")
		return
	}

	userID := h.userID(r)
	if err := h.q.DeleteVote(r.Context(), db.DeleteVoteParams{
		UserID: userID, GroupID: groupID, WeekOf: weekOf,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to clear vote")
		return
	}

	writeMessage(w, http.StatusOK, "Vote cleared")
}

func (h *Handler) GetResults(w http.ResponseWriter, r *http.Request) {
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

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)
	weekOf := queryString(r, "weekOf")
	if weekOf == "" || !isValidDateStr(weekOf) {
		weekOf = getCurrentTurnWeekOf(config)
	}

	movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: weekOf,
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "No movie for this week")
		return
	}

	adminExt := 0
	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
	}

	if !isResultsAvailable(weekOf, config, adminExt) {
		writeError(w, http.StatusForbidden, "Results are not available yet. Check back after the turn ends.")
		return
	}

	avg, err := h.q.GetAverageRating(r.Context(), db.GetAverageRatingParams{
		GroupID: groupID, WeekOf: weekOf,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to compute results")
		return
	}

	dist, _ := h.q.GetVoteDistribution(r.Context(), db.GetVoteDistributionParams{
		GroupID: groupID, WeekOf: weekOf,
	})

	type distEntry struct {
		Rating int32 `json:"rating"`
		Count  int32 `json:"count"`
	}
	distribution := make([]distEntry, 0, 10)
	distMap := make(map[int32]int32)
	for _, d := range dist {
		distMap[d.Rating] = d.Count
	}
	for i := int32(1); i <= 10; i++ {
		distribution = append(distribution, distEntry{Rating: i, Count: distMap[i]})
	}

	votes, _ := h.q.GetVotesForGroupWeek(r.Context(), db.GetVotesForGroupWeekParams{
		GroupID: groupID, WeekOf: weekOf,
	})

	type voteEntry struct {
		Username  string  `json:"username"`
		Rating    float32 `json:"rating"`
		Review    *string `json:"review"`
		UpdatedAt string  `json:"updatedAt"`
	}
	voteList := make([]voteEntry, 0, len(votes))
	for _, v := range votes {
		voteList = append(voteList, voteEntry{
			Username: v.Username, Rating: v.Rating, Review: v.Review,
			UpdatedAt: v.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
		})
	}

	avgRating := float32(math.Round(float64(avg.Average)*10) / 10)

	writeJSON(w, http.StatusOK, map[string]any{
		"weekOf": weekOf,
		"movieData": map[string]any{
			"id": movie.ID, "title": movie.Title, "weekOf": movie.WeekOf,
			"imdbId": movie.ImdbID, "poster": movie.Poster,
			"director": movie.Director, "genre": movie.Genre,
			"runtime": movie.Runtime, "year": movie.Year,
			"nominatorUserId": movie.NominatorUserID,
		},
		"averageRating": avgRating,
		"totalVotes":    avg.Total,
		"distribution":  distribution,
		"votes":         voteList,
	})
}
