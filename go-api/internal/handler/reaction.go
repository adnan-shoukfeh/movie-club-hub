package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

type createReactionRequest struct {
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityId"`
	StickerID  int64  `json:"stickerId"`
}

func (h *Handler) CreateReaction(w http.ResponseWriter, r *http.Request) {
	var req createReactionRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.EntityType == "" || req.EntityID == 0 || req.StickerID == 0 {
		writeError(w, http.StatusBadRequest, "entityType, entityId, and stickerId are required")
		return
	}

	if req.EntityType != "verdict" {
		writeError(w, http.StatusBadRequest, "Only 'verdict' entityType is currently supported")
		return
	}

	userID := h.userID(r)

	// Verify the entity exists and user has access
	if req.EntityType == "verdict" {
		verdict, err := h.q.GetVerdictByID(r.Context(), req.EntityID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusNotFound, "Verdict not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "Failed to verify verdict")
			return
		}

		// Get turn to verify group membership
		turn, err := h.q.GetTurnByID(r.Context(), verdict.TurnID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to verify group access")
			return
		}

		// Verify user is a member of the group
		_, err = h.q.GetMembership(r.Context(), db.GetMembershipParams{
			UserID:  userID,
			GroupID: turn.GroupID,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusForbidden, "Not a member of this group")
				return
			}
			writeError(w, http.StatusInternalServerError, "Failed to verify membership")
			return
		}
	}

	// Verify sticker exists
	_, err := h.q.GetStickerByID(r.Context(), req.StickerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Sticker not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to verify sticker")
		return
	}

	reaction, err := h.q.CreateReaction(r.Context(), db.CreateReactionParams{
		EntityType: req.EntityType,
		EntityID:   req.EntityID,
		UserID:     userID,
		StickerID:  req.StickerID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create reaction")
		return
	}

	// CreateReaction returns empty if conflict (already exists)
	if reaction.ID == 0 {
		writeMessage(w, http.StatusOK, "Reaction already exists")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":         reaction.ID,
		"entityType": reaction.EntityType,
		"entityId":   reaction.EntityID,
		"stickerId":  reaction.StickerID,
	})
}

func (h *Handler) DeleteReaction(w http.ResponseWriter, r *http.Request) {
	reactionIDStr := chi.URLParam(r, "reactionId")
	reactionID, err := strconv.ParseInt(reactionIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid reaction ID")
		return
	}

	userID := h.userID(r)

	// Verify user owns the reaction
	reaction, err := h.q.GetReactionByID(r.Context(), reactionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Reaction not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch reaction")
		return
	}

	if reaction.UserID != userID {
		writeError(w, http.StatusForbidden, "Cannot delete another user's reaction")
		return
	}

	if err := h.q.DeleteReaction(r.Context(), reactionID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete reaction")
		return
	}

	writeMessage(w, http.StatusOK, "Reaction deleted")
}

func (h *Handler) ToggleReaction(w http.ResponseWriter, r *http.Request) {
	var req createReactionRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.EntityType == "" || req.EntityID == 0 || req.StickerID == 0 {
		writeError(w, http.StatusBadRequest, "entityType, entityId, and stickerId are required")
		return
	}

	userID := h.userID(r)

	// Try to delete first (toggle off)
	rowsAffected, err := h.q.DeleteReactionByUserAndSticker(r.Context(), db.DeleteReactionByUserAndStickerParams{
		EntityType: req.EntityType,
		EntityID:   req.EntityID,
		UserID:     userID,
		StickerID:  req.StickerID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to toggle reaction")
		return
	}

	if rowsAffected > 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"action": "removed",
		})
		return
	}

	// Reaction didn't exist, create it
	if req.EntityType == "verdict" {
		verdict, err := h.q.GetVerdictByID(r.Context(), req.EntityID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusNotFound, "Verdict not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "Failed to verify verdict")
			return
		}

		turn, err := h.q.GetTurnByID(r.Context(), verdict.TurnID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to verify group access")
			return
		}

		_, err = h.q.GetMembership(r.Context(), db.GetMembershipParams{
			UserID:  userID,
			GroupID: turn.GroupID,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusForbidden, "Not a member of this group")
				return
			}
			writeError(w, http.StatusInternalServerError, "Failed to verify membership")
			return
		}
	}

	_, err = h.q.GetStickerByID(r.Context(), req.StickerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Sticker not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to verify sticker")
		return
	}

	reaction, err := h.q.CreateReaction(r.Context(), db.CreateReactionParams{
		EntityType: req.EntityType,
		EntityID:   req.EntityID,
		UserID:     userID,
		StickerID:  req.StickerID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create reaction")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"action":    "added",
		"id":        reaction.ID,
		"stickerId": reaction.StickerID,
	})
}

func (h *Handler) GetReactions(w http.ResponseWriter, r *http.Request) {
	entityType := queryString(r, "entityType")
	entityIDStr := queryString(r, "entityId")

	if entityType == "" || entityIDStr == "" {
		writeError(w, http.StatusBadRequest, "entityType and entityId query params are required")
		return
	}

	entityID, err := strconv.ParseInt(entityIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid entityId")
		return
	}

	userID := h.userID(r)

	// Get reaction summary (stickers with counts)
	summary, err := h.q.GetReactionSummaryForEntity(r.Context(), db.GetReactionSummaryForEntityParams{
		EntityType: entityType,
		EntityID:   entityID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch reactions")
		return
	}

	// Get user's own reactions
	userReactions, err := h.q.GetUserReactionsForEntity(r.Context(), db.GetUserReactionsForEntityParams{
		EntityType: entityType,
		EntityID:   entityID,
		UserID:     userID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch user reactions")
		return
	}

	// Format response
	type reactionSummary struct {
		StickerID  int64  `json:"stickerId"`
		Name       string `json:"name"`
		ImageURL   string `json:"imageUrl"`
		Count      int64  `json:"count"`
		UserReacted bool  `json:"userReacted"`
	}

	userStickerIDs := make(map[int64]bool)
	for _, ur := range userReactions {
		userStickerIDs[ur.StickerID] = true
	}

	reactions := make([]reactionSummary, 0, len(summary))
	for _, s := range summary {
		reactions = append(reactions, reactionSummary{
			StickerID:   s.StickerID,
			Name:        s.StickerName,
			ImageURL:    s.StickerImageUrl,
			Count:       s.Count,
			UserReacted: userStickerIDs[s.StickerID],
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"reactions": reactions,
	})
}

func (h *Handler) GetReactionDetails(w http.ResponseWriter, r *http.Request) {
	entityType := queryString(r, "entityType")
	entityIDStr := queryString(r, "entityId")

	if entityType == "" || entityIDStr == "" {
		writeError(w, http.StatusBadRequest, "entityType and entityId query params are required")
		return
	}

	entityID, err := strconv.ParseInt(entityIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid entityId")
		return
	}

	// Get all reactions with user info
	reactions, err := h.q.GetReactionsForEntity(r.Context(), db.GetReactionsForEntityParams{
		EntityType: entityType,
		EntityID:   entityID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch reactions")
		return
	}

	type reactionDetail struct {
		ID          int64  `json:"id"`
		StickerID   int64  `json:"stickerId"`
		StickerName string `json:"stickerName"`
		ImageURL    string `json:"imageUrl"`
		Username    string `json:"username"`
		UserID      int32  `json:"userId"`
	}

	result := make([]reactionDetail, 0, len(reactions))
	for _, r := range reactions {
		result = append(result, reactionDetail{
			ID:          r.ID,
			StickerID:   r.StickerID,
			StickerName: r.StickerName,
			ImageURL:    r.StickerImageUrl,
			Username:    r.Username,
			UserID:      r.UserID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"reactions": result,
	})
}
