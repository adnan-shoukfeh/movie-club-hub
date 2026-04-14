package handler

import (
	"net/http"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

func (h *Handler) SetWatchStatus(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Group not found")
		return
	}

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		Watched bool    `json:"watched"`
		WeekOf  *string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)
	weekOf := getCurrentTurnWeekOf(config)
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	userID := h.userID(r)
	if err := h.q.UpsertWatchStatus(r.Context(), db.UpsertWatchStatusParams{
		UserID: userID, GroupID: groupID, WeekOf: weekOf, Watched: req.Watched,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update watch status")
		return
	}

	msg := "Marked as not yet watched"
	if req.Watched {
		msg = "Marked as watched"
	}
	writeMessage(w, http.StatusOK, msg)
}
