package handler

import (
	"errors"
	"net/http"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

func (h *Handler) ListNominations(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	noms, err := h.nominationSvc.List(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch nominations")
		return
	}

	type nomResp struct {
		ID                int32   `json:"id"`
		ImdbID            string  `json:"imdbId"`
		Title             string  `json:"title"`
		Year              *string `json:"year"`
		Poster            *string `json:"poster"`
		NominatorUserID   int32   `json:"nominatorUserId"`
		NominatorUsername string  `json:"nominatorUsername"`
		CreatedAt         string  `json:"createdAt"`
	}

	result := make([]nomResp, 0, len(noms))
	for _, n := range noms {
		result = append(result, nomResp{
			ID: n.ID, ImdbID: n.ImdbID, Title: n.Title,
			Year: n.Year, Poster: n.Poster,
			NominatorUserID:   n.UserID,
			NominatorUsername: n.NominatorUsername,
			CreatedAt:         n.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		})
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) CreateNomination(w http.ResponseWriter, r *http.Request) {
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
		ImdbID string  `json:"imdbId"`
		Title  string  `json:"title"`
		Year   *string `json:"year"`
		Poster *string `json:"poster"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	year := ""
	if req.Year != nil {
		year = *req.Year
	}

	userID := h.userID(r)

	nom, err := h.nominationSvc.Create(r.Context(), userID, groupID, req.ImdbID, req.Title, year, req.Poster)
	if err != nil {
		if errors.Is(err, service.ErrForbidden) {
			writeError(w, http.StatusForbidden, "Not allowed to create nomination")
			return
		}
		// Check for unique constraint violation (duplicate imdbId in group)
		imdbID := sanitizeImdbID(req.ImdbID)
		if existing, lookupErr := h.q.GetNominationByGroupAndIMDB(r.Context(), db.GetNominationByGroupAndIMDBParams{
			GroupID: groupID, ImdbID: imdbID,
		}); lookupErr == nil {
			username := existing.NominatorUsername
			if username == "" {
				username = "unknown"
			}
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":             "Already nominated by " + username,
				"nominatorUsername": existing.NominatorUsername,
			})
			return
		}
		writeError(w, http.StatusBadRequest, "Invalid imdbId or title")
		return
	}

	// Get nominator username
	var nominatorUsername *string
	if u, err := h.q.GetUserByID(r.Context(), userID); err == nil {
		nominatorUsername = &u.Username
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id": nom.ID, "imdbId": nom.ImdbID, "title": nom.Title,
		"year": nom.Year, "poster": nom.Poster,
		"nominatorUserId":   nom.UserID,
		"nominatorUsername": nominatorUsername,
		"createdAt":         nom.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
	})
}

func (h *Handler) DeleteNomination(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	nomID, err := pathInt(r, "nominationId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid nomination ID")
		return
	}

	userID := h.userID(r)

	if err := h.nominationSvc.Delete(r.Context(), userID, groupID, nomID); err != nil {
		if errors.Is(err, service.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Nomination not found")
			return
		}
		if errors.Is(err, service.ErrForbidden) {
			writeError(w, http.StatusForbidden, "Cannot delete another member's nomination")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to delete nomination")
		return
	}

	writeMessage(w, http.StatusOK, "Nomination removed")
}
