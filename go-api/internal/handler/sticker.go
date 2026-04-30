package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

const superAdminUsername = "dingle_documentary"

var allowedContentTypes = map[string]string{
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

type createStickerRequest struct {
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl"`
	GroupID  *int64 `json:"groupId"`
}

type uploadURLRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	GroupID     *int64 `json:"groupId"`
}

func (h *Handler) GetStickerUploadURL(w http.ResponseWriter, r *http.Request) {
	if h.gcsSvc == nil || !h.gcsSvc.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "File uploads are not configured")
		return
	}

	var req uploadURLRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Filename == "" || req.ContentType == "" {
		writeError(w, http.StatusBadRequest, "filename and contentType are required")
		return
	}

	ext, ok := allowedContentTypes[req.ContentType]
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid content type. Allowed: image/png, image/gif, image/webp")
		return
	}

	// Authorization check
	if req.GroupID == nil {
		if !h.isSuperAdmin(r) {
			writeError(w, http.StatusForbidden, "Only super admin can upload global stickers")
			return
		}
	} else {
		_, ok := h.requireAdmin(w, r, int32(*req.GroupID))
		if !ok {
			return
		}
	}

	// Generate unique object name
	var objectName string
	if req.GroupID == nil {
		objectName = fmt.Sprintf("global/%s%s", uuid.New().String(), ext)
	} else {
		objectName = fmt.Sprintf("groups/%d/%s%s", *req.GroupID, uuid.New().String(), ext)
	}

	result, err := h.gcsSvc.GenerateUploadURL(r.Context(), objectName, req.ContentType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate upload URL")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"uploadUrl":  result.UploadURL,
		"objectName": result.ObjectName,
		"publicUrl":  result.PublicURL,
	})
}

func (h *Handler) isSuperAdmin(r *http.Request) bool {
	userID := h.userID(r)
	user, err := h.q.GetUserByID(r.Context(), userID)
	if err != nil {
		return false
	}
	return user.Username == superAdminUsername
}

func (h *Handler) CreateGlobalSticker(w http.ResponseWriter, r *http.Request) {
	if !h.isSuperAdmin(r) {
		writeError(w, http.StatusForbidden, "Only super admin can create global stickers")
		return
	}

	var req createStickerRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" || req.ImageURL == "" {
		writeError(w, http.StatusBadRequest, "name and imageUrl are required")
		return
	}

	userID := h.userID(r)

	sticker, err := h.q.CreateSticker(r.Context(), db.CreateStickerParams{
		Name:      req.Name,
		ImageUrl:  req.ImageURL,
		GroupID:   nil, // global sticker
		CreatedBy: userID,
	})
	if err != nil {
		if isDuplicateError(err) {
			writeError(w, http.StatusConflict, "A sticker with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to create sticker")
		return
	}

	writeJSON(w, http.StatusCreated, stickerToResponse(sticker))
}

func (h *Handler) ListGlobalStickers(w http.ResponseWriter, r *http.Request) {
	stickers, err := h.q.GetGlobalStickers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch stickers")
		return
	}

	result := make([]map[string]any, 0, len(stickers))
	for _, s := range stickers {
		result = append(result, stickerToResponse(s))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"stickers": result,
	})
}

func (h *Handler) DeleteGlobalSticker(w http.ResponseWriter, r *http.Request) {
	if !h.isSuperAdmin(r) {
		writeError(w, http.StatusForbidden, "Only super admin can delete global stickers")
		return
	}

	stickerIDStr := chi.URLParam(r, "stickerId")
	stickerID, err := strconv.ParseInt(stickerIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid sticker ID")
		return
	}

	// Verify it's a global sticker
	sticker, err := h.q.GetStickerByID(r.Context(), stickerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Sticker not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch sticker")
		return
	}

	if sticker.GroupID != nil {
		writeError(w, http.StatusBadRequest, "This is not a global sticker")
		return
	}

	// Get reaction count for confirmation message
	count, _ := h.q.CountReactionsForSticker(r.Context(), stickerID)

	if err := h.q.DeleteSticker(r.Context(), stickerID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete sticker")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":          "Sticker deleted",
		"reactionsRemoved": count,
	})
}

func (h *Handler) CreateGroupSticker(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	// Verify admin role
	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req createStickerRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" || req.ImageURL == "" {
		writeError(w, http.StatusBadRequest, "name and imageUrl are required")
		return
	}

	userID := h.userID(r)
	groupID64 := int64(groupID)

	sticker, err := h.q.CreateSticker(r.Context(), db.CreateStickerParams{
		Name:      req.Name,
		ImageUrl:  req.ImageURL,
		GroupID:   &groupID64,
		CreatedBy: userID,
	})
	if err != nil {
		if isDuplicateError(err) {
			writeError(w, http.StatusConflict, "A sticker with this name already exists in this group")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to create sticker")
		return
	}

	writeJSON(w, http.StatusCreated, stickerToResponse(sticker))
}

func (h *Handler) ListGroupStickers(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	// Verify membership
	_, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	groupID64 := int64(groupID)
	stickers, err := h.q.GetStickersForGroup(r.Context(), &groupID64)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch stickers")
		return
	}

	// Separate global and group stickers
	globalStickers := make([]map[string]any, 0)
	groupStickers := make([]map[string]any, 0)

	for _, s := range stickers {
		resp := stickerToResponse(s)
		if s.GroupID == nil {
			globalStickers = append(globalStickers, resp)
		} else {
			groupStickers = append(groupStickers, resp)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"globalStickers": globalStickers,
		"groupStickers":  groupStickers,
		"stickers":       append(globalStickers, groupStickers...),
	})
}

func (h *Handler) DeleteGroupSticker(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	// Verify admin role
	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	stickerIDStr := chi.URLParam(r, "stickerId")
	stickerID, err := strconv.ParseInt(stickerIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid sticker ID")
		return
	}

	// Verify it's a sticker from this group
	sticker, err := h.q.GetStickerByID(r.Context(), stickerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Sticker not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch sticker")
		return
	}

	if sticker.GroupID == nil {
		writeError(w, http.StatusForbidden, "Cannot delete global stickers from group admin")
		return
	}

	if *sticker.GroupID != int64(groupID) {
		writeError(w, http.StatusForbidden, "This sticker belongs to another group")
		return
	}

	count, _ := h.q.CountReactionsForSticker(r.Context(), stickerID)

	if err := h.q.DeleteSticker(r.Context(), stickerID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete sticker")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":          "Sticker deleted",
		"reactionsRemoved": count,
	})
}

func stickerToResponse(s db.Sticker) map[string]any {
	resp := map[string]any{
		"id":        s.ID,
		"name":      s.Name,
		"imageUrl":  s.ImageUrl,
		"createdBy": s.CreatedBy,
		"isGlobal":  s.GroupID == nil,
	}
	if s.GroupID != nil {
		resp["groupId"] = *s.GroupID
	}
	return resp
}

func isDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	// PostgreSQL unique violation error code is 23505
	return err.Error() == "ERROR: duplicate key value violates unique constraint \"stickers_name_group_unique\" (SQLSTATE 23505)" ||
		// Also check for pgx wrapped error
		contains(err.Error(), "duplicate key") || contains(err.Error(), "23505")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
