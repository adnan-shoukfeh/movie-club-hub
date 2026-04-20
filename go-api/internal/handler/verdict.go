package handler

import (
	"errors"
	"math"
	"net/http"

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

	type verdictEntry struct {
		Username  string  `json:"username"`
		Rating    float32 `json:"rating"`
		Review    *string `json:"review"`
		UpdatedAt string  `json:"updatedAt"`
		Watched   bool    `json:"watched"`
	}
	list := make([]verdictEntry, 0, len(verdicts))
	for _, v := range verdicts {
		entry := verdictEntry{
			Username:  v.Username,
			Review:    v.Review,
			UpdatedAt: v.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
			Watched:   v.Watched,
		}
		if v.Rating != nil {
			entry.Rating = float32(math.Round(float64(*v.Rating)*10) / 10)
		}
		list = append(list, entry)
	}

	writeJSON(w, http.StatusOK, list)
}
