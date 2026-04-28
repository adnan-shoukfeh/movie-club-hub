package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID := h.userID(r)
	invite, err := h.groupSvc.CreateInvite(r.Context(), userID, groupID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Insufficient permissions")
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Not found")
		default:
			writeError(w, http.StatusInternalServerError, "Internal error")
		}
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

func (h *Handler) GetActiveInvite(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID := h.userID(r)
	invite, err := h.groupSvc.GetActiveInvite(r.Context(), userID, groupID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Insufficient permissions")
		case errors.Is(err, service.ErrNotFound):
			writeJSON(w, http.StatusOK, map[string]any{"code": nil})
			return
		default:
			writeError(w, http.StatusInternalServerError, "Internal error")
		}
		return
	}

	var expiresAtStr *string
	if invite.ExpiresAt != nil {
		s := invite.ExpiresAt.Format("2006-01-02T15:04:05.000Z")
		expiresAtStr = &s
	}

	writeJSON(w, http.StatusOK, map[string]any{
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
