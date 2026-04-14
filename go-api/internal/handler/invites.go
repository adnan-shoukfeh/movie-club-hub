package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		ExpiresInHours *int `json:"expiresInHours"`
	}
	_ = decodeBody(r, &req)

	// Generate random code
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate invite code")
		return
	}
	code := strings.ToUpper(hex.EncodeToString(bytes))

	var expiresAt *time.Time
	if req.ExpiresInHours != nil {
		hours := *req.ExpiresInHours
		if hours < 1 {
			hours = 1
		}
		if hours > 168 {
			hours = 168
		}
		t := time.Now().Add(time.Duration(hours) * time.Hour)
		expiresAt = &t
	}

	userID := h.userID(r)
	invite, err := h.q.CreateInvite(r.Context(), db.CreateInviteParams{
		Code: code, GroupID: groupID, CreatedByUserID: userID, ExpiresAt: expiresAt,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create invite")
		return
	}

	var expiresAtStr *string
	if invite.ExpiresAt != nil {
		s := invite.ExpiresAt.Format("2006-01-02T15:04:05.000Z")
		expiresAtStr = &s
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":        invite.ID,
		"code":      invite.Code,
		"groupId":   invite.GroupID,
		"expiresAt": expiresAtStr,
		"createdAt": invite.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
	})
}

func (h *Handler) GetInvite(w http.ResponseWriter, r *http.Request) {
	code := sanitizeInviteCode(chi.URLParam(r, "code"))
	if len(code) < 4 {
		writeError(w, http.StatusBadRequest, "Invalid invite code")
		return
	}

	invite, err := h.q.GetInviteByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch invite")
		return
	}

	valid := true
	if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
		valid = false
	}

	var expiresAtStr *string
	if invite.ExpiresAt != nil {
		s := invite.ExpiresAt.Format("2006-01-02T15:04:05.000Z")
		expiresAtStr = &s
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":      invite.Code,
		"groupId":   invite.GroupID,
		"groupName": invite.GroupName,
		"expiresAt": expiresAtStr,
		"valid":     valid,
	})
}

func (h *Handler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	code := sanitizeInviteCode(req.Code)
	if len(code) < 4 {
		writeError(w, http.StatusBadRequest, "Invalid invite code")
		return
	}

	invite, err := h.q.GetInviteByCode(r.Context(), code)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid invite code")
		return
	}

	if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
		writeError(w, http.StatusBadRequest, "Invite link has expired")
		return
	}

	userID := h.userID(r)

	// Check already member
	if _, err := h.q.GetMembership(r.Context(), db.GetMembershipParams{
		UserID: userID, GroupID: invite.GroupID,
	}); err == nil {
		writeError(w, http.StatusBadRequest, "You are already a member of this group")
		return
	}

	_, err = h.q.CreateMembership(r.Context(), db.CreateMembershipParams{
		UserID: userID, GroupID: invite.GroupID, Role: "member",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to join group")
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), invite.GroupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":        group.ID,
		"name":      group.Name,
		"createdAt": group.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		"ownerId":   group.OwnerID,
	})
}
