package handler

import (
	"errors"
	"net/http"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

func (h *Handler) SetWatchStatus(w http.ResponseWriter, r *http.Request) {
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
		Watched bool    `json:"watched"`
		WeekOf  *string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	weekOf := ""
	if req.WeekOf != nil && isValidDateStr(*req.WeekOf) {
		weekOf = *req.WeekOf
	}

	userID := h.userID(r)
	if err := h.verdictSvc.MarkWatched(r.Context(), userID, groupID, weekOf, req.Watched); err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Group not found")
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Not a member of this group")
		default:
			writeError(w, http.StatusInternalServerError, "Failed to update watch status")
		}
		return
	}

	msg := "Marked as not yet watched"
	if req.Watched {
		msg = "Marked as watched"
	}
	writeMessage(w, http.StatusOK, msg)
}
