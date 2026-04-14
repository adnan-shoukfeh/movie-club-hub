package handler

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
)

type authRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type userResponse struct {
	ID        int32  `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
}

func toUserResponse(u db.User) userResponse {
	return userResponse{
		ID:        u.ID,
		Username:  u.Username,
		CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
	}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	username := sanitizeUsername(req.Username)
	if !isValidUsername(username) {
		writeError(w, http.StatusBadRequest, "Username must be 2-32 characters, alphanumeric and underscores only.")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "Password must be at least 8 characters.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	// Check if user exists without password (created via some other flow)
	existing, err := h.q.GetUserByUsername(r.Context(), username)
	if err == nil && existing.PasswordHash == nil {
		// Update existing user with password hash
		hashStr := string(hash)
		if err := h.q.UpdateUserPasswordHash(r.Context(), db.UpdateUserPasswordHashParams{
			Username:     username,
			PasswordHash: &hashStr,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to update user")
			return
		}
		h.sm.SetUserID(r, int64(existing.ID))
		writeJSON(w, http.StatusCreated, toUserResponse(existing))
		return
	} else if err == nil {
		writeError(w, http.StatusConflict, "Username is already taken.")
		return
	}

	hashStr := string(hash)
	user, err := h.q.CreateUser(r.Context(), db.CreateUserParams{
		Username:     username,
		PasswordHash: &hashStr,
	})
	if err != nil {
		writeError(w, http.StatusConflict, "Username is already taken.")
		return
	}

	h.sm.SetUserID(r, int64(user.ID))
	writeJSON(w, http.StatusCreated, userResponse{
		ID:        user.ID,
		Username:  user.Username,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	username := sanitizeUsername(req.Username)
	user, err := h.q.GetUserByUsername(r.Context(), username)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid username or password.")
		return
	}

	if user.PasswordHash == nil {
		writeError(w, http.StatusUnauthorized, "Invalid username or password.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid username or password.")
		return
	}

	h.sm.SetUserID(r, int64(user.ID))
	writeJSON(w, http.StatusOK, toUserResponse(user))
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if err := h.sm.Destroy(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to logout")
		return
	}
	writeMessage(w, http.StatusOK, "Logged out")
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.sm.GetUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	user, err := h.q.GetUserByID(r.Context(), int32(userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "Not authenticated")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch user")
		return
	}

	writeJSON(w, http.StatusOK, toUserResponse(user))
}

// requireMembership fetches the user's membership in a group. Returns the membership or writes an error.
func (h *Handler) requireMembership(w http.ResponseWriter, r *http.Request, groupID int32) (*db.Membership, bool) {
	userID, _ := h.sm.GetUserID(r)
	mem, err := h.q.GetMembership(r.Context(), db.GetMembershipParams{
		UserID:  int32(userID),
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusForbidden, "Not a member of this group")
			return nil, false
		}
		writeError(w, http.StatusInternalServerError, "Failed to check membership")
		return nil, false
	}
	return &mem, true
}

// requireAdmin checks that the user is admin or owner. Returns the membership or writes an error.
func (h *Handler) requireAdmin(w http.ResponseWriter, r *http.Request, groupID int32) (*db.Membership, bool) {
	mem, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return nil, false
	}
	if mem.Role != "owner" && mem.Role != "admin" {
		writeError(w, http.StatusForbidden, "Insufficient permissions")
		return nil, false
	}
	return mem, true
}

// requireOwner checks the user is the group owner. Returns the membership or writes an error.
func (h *Handler) requireOwner(w http.ResponseWriter, r *http.Request, groupID int32) (*db.Membership, bool) {
	mem, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return nil, false
	}
	if mem.Role != "owner" {
		writeError(w, http.StatusForbidden, "Only the current owner can transfer ownership")
		return nil, false
	}
	return mem, true
}

// helper to get the session user ID from middleware context
func (h *Handler) userID(r *http.Request) int32 {
	id, _ := h.sm.GetUserID(r)
	return int32(id)
}

// unused but keeps import of session package
var _ = session.UserIDKey
